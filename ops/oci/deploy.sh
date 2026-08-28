#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

FIRST_RELEASE=false
SKIP_CHECKS=false
for argument in "$@"; do
    case "$argument" in
        --first-release) FIRST_RELEASE=true ;;
        --skip-checks) SKIP_CHECKS=true ;;
        *) die "Opción desconocida: $argument" ;;
    esac
done

require_command composer
require_command npm
require_command rsync
require_command ssh
require_clean_release

DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
[[ -n $DEPLOY_HOST ]] || die 'Falta DEPLOY_HOST o el estado de provision.sh.'
mapfile -t SSH_ARGS < <(ssh_args)
TARGET=$(ssh_target)
COMMIT=$(git -C "$PROJECT_DIR" rev-parse HEAD)
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT:0:12}"

if [[ $SKIP_CHECKS == false ]]; then
    log 'Ejecutando verificación PHP y de dominio'
    (cd "$PROJECT_DIR" && composer test)
    log 'Ejecutando verificaciones frontend'
    (cd "$PROJECT_DIR" && npm ci && npm run format:check && npm run types:check && npm run lint:check && npm run build)
    log 'Auditando dependencias bloqueadas'
    (cd "$PROJECT_DIR" && composer audit --locked --no-interaction && npm audit --omit=dev --audit-level=moderate)
else
    [[ -d "$PROJECT_DIR/public/build" ]] || die 'No existe public/build; no puede omitirse el build.'
    log 'ADVERTENCIA: se omitieron verificaciones por solicitud explícita.'
fi

STAGE_DIR=$(mktemp -d)
trap 'rm -rf "$STAGE_DIR"' EXIT
git -C "$PROJECT_DIR" archive "$COMMIT" | tar -x -C "$STAGE_DIR"
install -d "$STAGE_DIR/public/build"
rsync -a --delete "$PROJECT_DIR/public/build/" "$STAGE_DIR/public/build/"
printf '%s\n' "$COMMIT" >"$STAGE_DIR/REVISION"

REMOTE_STAGE="/tmp/control-materiales-release-$RELEASE_ID"
ssh "${SSH_ARGS[@]}" "$TARGET" "mkdir -p '$REMOTE_STAGE'"
rsync -az --delete -e "ssh ${SSH_ARGS[*]}" "$STAGE_DIR/" "$TARGET:$REMOTE_STAGE/"

log "Instalando release $RELEASE_ID"
ssh "${SSH_ARGS[@]}" "$TARGET" "sudo env RELEASE_ID='$RELEASE_ID' FIRST_RELEASE='$FIRST_RELEASE' bash -s" <<'REMOTE'
set -Eeuo pipefail

RELEASE_DIR="/srv/control-materiales/releases/$RELEASE_ID"
SHARED_DIR=/srv/control-materiales/shared
REMOTE_STAGE="/tmp/control-materiales-release-$RELEASE_ID"

[[ ! -e $RELEASE_DIR ]] || { echo 'El release ya existe.' >&2; exit 1; }
install -d -o materiales -g www-data -m 0750 "$RELEASE_DIR"
cp -a "$REMOTE_STAGE/." "$RELEASE_DIR/"
rm -rf "$REMOTE_STAGE"
chown -R materiales:www-data "$RELEASE_DIR"
find "$RELEASE_DIR" -type d -exec chmod 0750 {} +
find "$RELEASE_DIR" -type f -exec chmod 0640 {} +
chmod 0750 "$RELEASE_DIR/artisan"

rm -rf "$RELEASE_DIR/storage"
ln -s "$SHARED_DIR/storage" "$RELEASE_DIR/storage"

if [[ ! -f $SHARED_DIR/.env ]]; then
    [[ $FIRST_RELEASE == true ]] || { echo 'Falta .env; use --first-release.' >&2; exit 1; }
    [[ -s /root/.control-materiales-db-password ]] || { echo 'Falta la contraseña inicial de base.' >&2; exit 1; }
    DB_PASSWORD=$(</root/.control-materiales-db-password)
    APP_KEY="base64:$(openssl rand -base64 32 | tr -d '\n')"
    umask 077
    {
        printf 'APP_NAME="Control de Materiales SPM"\n'
        printf 'APP_ENV=production\n'
        printf 'APP_KEY=%s\n' "$APP_KEY"
        printf 'APP_DEBUG=false\n'
        printf 'APP_URL=https://materiales.utopiadigital.tech\n'
        printf 'APP_LOCALE=es\nAPP_FALLBACK_LOCALE=es\nAPP_FAKER_LOCALE=es_MX\n'
        printf 'APP_MAINTENANCE_DRIVER=file\nBCRYPT_ROUNDS=12\n'
        printf 'LOG_CHANNEL=daily\nLOG_LEVEL=warning\nLOG_DAILY_DAYS=14\n'
        printf 'DB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432\n'
        printf 'DB_DATABASE=control_materiales_spm\nDB_USERNAME=control_materiales_app\n'
        printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD"
        printf 'SESSION_DRIVER=database\nSESSION_LIFETIME=120\nSESSION_ENCRYPT=false\nSESSION_DOMAIN=null\nSESSION_SECURE_COOKIE=true\n'
        printf 'FILESYSTEM_DISK=local\nQUEUE_CONNECTION=database\nCACHE_STORE=database\n'
        printf 'MAIL_MAILER=log\nMAIL_FROM_ADDRESS="no-reply@utopiadigital.tech"\nMAIL_FROM_NAME="Control de Materiales SPM"\n'
        printf 'VOUCHER_SEQUENCE_START_WAREHOUSE=16576\nVOUCHER_SEQUENCE_START_YARD=3753\n'
        printf 'VITE_APP_NAME="Control de Materiales SPM"\n'
    } >"$SHARED_DIR/.env"
    chown materiales:materiales "$SHARED_DIR/.env"
    chmod 0600 "$SHARED_DIR/.env"
fi

ln -s "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
sudo -u materiales composer install \
    --working-dir="$RELEASE_DIR" \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --optimize-autoloader
sudo -u materiales php "$RELEASE_DIR/artisan" optimize

if [[ $FIRST_RELEASE == true ]]; then
    ln -sfn "$RELEASE_DIR" /srv/control-materiales/current
    chown -h materiales:www-data /srv/control-materiales/current
    systemctl reload php8.3-fpm
    systemctl reload nginx
    echo 'Primer release preparado; resta restaurar la base antes de habilitar la cola.'
    exit 0
fi

if [[ -x /usr/local/sbin/control-materiales-backup ]]; then
    sudo -u materiales /usr/local/sbin/control-materiales-backup release
fi

if [[ -L /srv/control-materiales/current ]]; then
    sudo -u materiales php /srv/control-materiales/current/artisan down --retry=60 || true
fi

sudo -u materiales php "$RELEASE_DIR/artisan" migrate --force --no-interaction
ln -sfn "$RELEASE_DIR" /srv/control-materiales/current
chown -h materiales:www-data /srv/control-materiales/current
systemctl reload php8.3-fpm
systemctl enable --now control-materiales-queue.service
systemctl restart control-materiales-queue.service
sudo -u materiales php "$RELEASE_DIR/artisan" up
REMOTE

log "Release preparado: $RELEASE_ID ($COMMIT)"
