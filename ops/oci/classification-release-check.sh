#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

MODE=${1:-before}
[[ $MODE == before || $MODE == after ]] || {
    echo 'Uso: classification-release-check.sh {before|after}' >&2
    exit 1
}

require_command ssh

DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
[[ -n $DEPLOY_HOST ]] || die 'Falta DEPLOY_HOST o el estado de provision.sh.'
mapfile -t SSH_ARGS < <(ssh_args)
TARGET=$(ssh_target)

ssh "${SSH_ARGS[@]}" "$TARGET" "sudo bash -s -- '$MODE'" <<'REMOTE'
set -Eeuo pipefail

MODE=$1
MIGRATION=2026_09_01_120000_add_action_indicators_and_populate_spm06_catalog
ENV_FILE=/srv/control-materiales/shared/.env
PGPASSFILE=/srv/control-materiales/shared/.pgpass

DATABASE=$(sed -n 's/^DB_DATABASE=//p' "$ENV_FILE" | head -n 1)
USERNAME=$(sed -n 's/^DB_USERNAME=//p' "$ENV_FILE" | head -n 1)
[[ -n $DATABASE && -n $USERNAME ]] || {
    echo 'No se pudo leer la conexión de PostgreSQL.' >&2
    exit 1
}

query() {
    sudo -u materiales env PGPASSFILE="$PGPASSFILE" psql \
        --host=127.0.0.1 \
        --username="$USERNAME" \
        --dbname="$DATABASE" \
        --tuples-only \
        --no-align \
        --set ON_ERROR_STOP=1 \
        --command="$1"
}

APPLIED=$(query "SELECT count(*) FROM migrations WHERE migration = '$MIGRATION'")
if [[ $MODE == before && $APPLIED != 0 ]]; then
    echo 'La migración de clasificación ya aparece aplicada; no continúe el corte.' >&2
    exit 1
fi
if [[ $MODE == after && $APPLIED != 1 ]]; then
    echo 'La migración de clasificación no aparece aplicada; revise el despliegue.' >&2
    exit 1
fi

SNAPSHOT=$(query "SELECT count(*) || '|' || count(*) FILTER (WHERE needs_review) || '|' || md5(COALESCE(string_agg(concat_ws('|', id::text, COALESCE(program_id::text, ''), COALESCE(action_id::text, ''), needs_review::text, COALESCE(review_reasons::text, '')), ',' ORDER BY id), '')) FROM vouchers")
ITEMS=$(query 'SELECT count(*) FROM voucher_items')
APPLICATIONS=$(query 'SELECT count(*) FROM material_applications')
HAS_INDICATOR=$(query "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vouchers' AND column_name = 'action_indicator_id'")
INDICATORS_ASSIGNED=n/a
if [[ $HAS_INDICATOR == 1 ]]; then
    INDICATORS_ASSIGNED=$(query 'SELECT count(*) FROM vouchers WHERE action_indicator_id IS NOT NULL')
fi

echo "Estado de migración: $([[ $APPLIED == 1 ]] && echo aplicada || echo pendiente)"
echo "Huella de vales: $SNAPSHOT"
echo "Partidas: $ITEMS"
echo "Aplicaciones: $APPLICATIONS"
echo "Indicadores asignados a vales: $INDICATORS_ASSIGNED"
REMOTE
