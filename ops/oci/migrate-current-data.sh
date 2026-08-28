#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_command jq
require_command pg_dump
require_command pg_restore
require_command rsync
require_command scp
require_command ssh
require_clean_release

DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
[[ -n $DEPLOY_HOST ]] || die 'Falta DEPLOY_HOST o el estado de provision.sh.'
mapfile -t SSH_ARGS < <(ssh_args)
TARGET=$(ssh_target)

ensure_state_dir
ARTIFACT_DIR="$SCRIPT_DIR/artifacts/first-cutover-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$ARTIFACT_DIR"
DUMP_FILE="$ARTIFACT_DIR/database.dump"
SOURCE_MANIFEST="$ARTIFACT_DIR/source-manifest.json"
REMOTE_MANIFEST="$ARTIFACT_DIR/remote-manifest.json"
PGPASS_FILE="$ARTIFACT_DIR/.pgpass"

SOURCE_WAS_STOPPED=false
bring_source_up() {
    rm -f "${PGPASS_FILE:-}"
    if [[ $SOURCE_WAS_STOPPED == true ]]; then
        (cd "$PROJECT_DIR" && php artisan up) >/dev/null 2>&1 || true
    fi
}
trap bring_source_up EXIT

log 'Poniendo el origen local en mantenimiento para obtener un corte consistente'
(cd "$PROJECT_DIR" && php artisan down --retry=60)
SOURCE_WAS_STOPPED=true

(cd "$PROJECT_DIR" && php ops/oci/manifest.php) >"$SOURCE_MANIFEST"

DB_HOST=$(cd "$PROJECT_DIR" && php -r 'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo config("database.connections.pgsql.host");')
DB_PORT=$(cd "$PROJECT_DIR" && php -r 'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo config("database.connections.pgsql.port");')
DB_NAME=$(cd "$PROJECT_DIR" && php -r 'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo config("database.connections.pgsql.database");')
DB_USER=$(cd "$PROJECT_DIR" && php -r 'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo config("database.connections.pgsql.username");')
DB_PASSWORD=$(cd "$PROJECT_DIR" && php -r 'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo config("database.connections.pgsql.password");')
printf '%s:%s:%s:%s:%s\n' "$DB_HOST" "$DB_PORT" "$DB_NAME" "$DB_USER" "$DB_PASSWORD" >"$PGPASS_FILE"
chmod 0600 "$PGPASS_FILE"

PGPASSFILE="$PGPASS_FILE" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --no-owner \
    --no-acl \
    --file="$DUMP_FILE"
pg_restore --list "$DUMP_FILE" >/dev/null

REMOTE_DUMP=/tmp/control-materiales-first-cutover.dump
scp "${SSH_ARGS[@]}" "$DUMP_FILE" "$TARGET:$REMOTE_DUMP"
rsync -az --delete -e "ssh ${SSH_ARGS[*]}" \
    "$PROJECT_DIR/storage/app/private/" \
    "$TARGET:/tmp/control-materiales-private/"

log 'Restaurando el corte en PostgreSQL productivo'
ssh "${SSH_ARGS[@]}" "$TARGET" 'sudo bash -s' <<'REMOTE'
set -Eeuo pipefail
APP_ROOT=/srv/control-materiales/current
SHARED_ROOT=/srv/control-materiales/shared
export PGPASSFILE="$SHARED_ROOT/.pgpass"

systemctl stop control-materiales-queue.service 2>/dev/null || true
sudo -u materiales php "$APP_ROOT/artisan" down --retry=60 || true
sudo -u materiales env PGPASSFILE="$PGPASSFILE" pg_restore \
    --host=127.0.0.1 \
    --username=control_materiales_app \
    --dbname=control_materiales_spm \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    /tmp/control-materiales-first-cutover.dump
rm -f /tmp/control-materiales-first-cutover.dump

rm -rf "$SHARED_ROOT/storage/app/private"
install -d -o materiales -g www-data -m 0770 "$SHARED_ROOT/storage/app/private"
cp -a /tmp/control-materiales-private/. "$SHARED_ROOT/storage/app/private/"
rm -rf /tmp/control-materiales-private
chown -R materiales:www-data "$SHARED_ROOT/storage/app/private"
find "$SHARED_ROOT/storage/app/private" -type d -exec chmod 0770 {} +
find "$SHARED_ROOT/storage/app/private" -type f -exec chmod 0660 {} +

sudo -u materiales php "$APP_ROOT/artisan" migrate --force --no-interaction
sudo -u materiales env PGPASSFILE="$PGPASSFILE" psql \
    --host=127.0.0.1 \
    --username=control_materiales_app \
    --dbname=control_materiales_spm \
    --command='TRUNCATE TABLE sessions, cache, cache_locks'
sudo -u materiales php "$APP_ROOT/artisan" optimize
systemctl reload php8.4-fpm
systemctl enable --now control-materiales-queue.service
systemctl restart control-materiales-queue.service
sudo -u materiales php "$APP_ROOT/artisan" up
REMOTE

ssh "${SSH_ARGS[@]}" "$TARGET" 'sudo -u materiales php /srv/control-materiales/current/ops/oci/manifest.php' >"$REMOTE_MANIFEST"

if ! diff -u <(jq -S . "$SOURCE_MANIFEST") <(jq -S . "$REMOTE_MANIFEST"); then
    die "El manifiesto productivo no coincide. Se conservaron los artefactos en $ARTIFACT_DIR y no debe ejecutarse el corte DNS."
fi

ssh "${SSH_ARGS[@]}" "$TARGET" 'sudo bash -s' <<'REMOTE'
set -Eeuo pipefail
set -a
# shellcheck disable=SC1091
source /etc/control-materiales-backup.env
set +a
sudo -u materiales env \
    OBJECT_NAMESPACE="$OBJECT_NAMESPACE" \
    BACKUP_BUCKET="$BACKUP_BUCKET" \
    BACKUP_RETENTION_DAYS="$BACKUP_RETENTION_DAYS" \
    /usr/local/sbin/control-materiales-backup release
REMOTE
bring_source_up
SOURCE_WAS_STOPPED=false

log "Datos restaurados y verificados. Respaldo local conservado en $ARTIFACT_DIR"
