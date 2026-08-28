#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_command ssh

DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
[[ -n $DEPLOY_HOST ]] || die 'Falta DEPLOY_HOST o el estado de provision.sh.'
mapfile -t SSH_ARGS < <(ssh_args)
TARGET=$(ssh_target)

log 'Restaurando el respaldo diario más reciente en una base temporal aislada'
ssh "${SSH_ARGS[@]}" "$TARGET" 'sudo bash -s' <<'REMOTE'
set -Eeuo pipefail

source /etc/control-materiales-backup.env
RESTORE_ID=$(date -u +%Y%m%d%H%M%S)
RESTORE_DB="control_materiales_restore_check_$RESTORE_ID"
WORK_DIR=$(mktemp -d /srv/control-materiales/shared/backups/.restore.XXXXXX)
ARCHIVE="$WORK_DIR/backup.tar.gz"

cleanup() {
    sudo -u postgres dropdb --if-exists "$RESTORE_DB" >/dev/null 2>&1 || true
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

OBJECT_NAME=$(sudo -u materiales oci os object list \
    --auth instance_principal \
    --namespace-name "$OBJECT_NAMESPACE" \
    --bucket-name "$BACKUP_BUCKET" \
    --prefix daily/ \
    --all \
    --query 'reverse(sort_by(data[?ends_with(name, `.tar.gz`)], &"time-created"))[0].name' \
    --raw-output)
[[ -n $OBJECT_NAME && $OBJECT_NAME != null ]] || { echo 'No existe un respaldo diario.' >&2; exit 1; }

sudo -u materiales oci os object get \
    --auth instance_principal \
    --namespace-name "$OBJECT_NAMESPACE" \
    --bucket-name "$BACKUP_BUCKET" \
    --name "$OBJECT_NAME" \
    --file "$ARCHIVE" >/dev/null
tar -C "$WORK_DIR" -xzf "$ARCHIVE"
pg_restore --list "$WORK_DIR/database.dump" >/dev/null

sudo -u postgres createdb --owner=control_materiales_app "$RESTORE_DB"
PGPASSFILE=/srv/control-materiales/shared/.pgpass
sudo -u materiales env PGPASSFILE="$PGPASSFILE" pg_restore \
    --host=127.0.0.1 \
    --username=control_materiales_app \
    --dbname="$RESTORE_DB" \
    --no-owner \
    --no-acl \
    "$WORK_DIR/database.dump"

TABLES=$(sudo -u postgres psql --dbname="$RESTORE_DB" --tuples-only --no-align --command="SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
VOUCHERS=$(sudo -u postgres psql --dbname="$RESTORE_DB" --tuples-only --no-align --command='SELECT count(*) FROM vouchers')
[[ $TABLES -ge 24 ]] || { echo "Restauración incompleta: $TABLES tablas." >&2; exit 1; }
echo "Restauración verificada desde $OBJECT_NAME: $TABLES tablas, $VOUCHERS vales."
REMOTE
