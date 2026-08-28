#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_command curl
require_command ssh

DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
[[ -n $DEPLOY_HOST ]] || die 'Falta DEPLOY_HOST o el estado de provision.sh.'
mapfile -t SSH_ARGS < <(ssh_args)
TARGET=$(ssh_target)

ssh "${SSH_ARGS[@]}" "$TARGET" 'sudo bash -s' <<'REMOTE'
set -Eeuo pipefail

echo 'Servicios'
systemctl is-active nginx php8.4-fpm postgresql control-materiales-queue.service control-materiales-schedule.timer control-materiales-backup.timer
echo
echo 'Release'
readlink -f /srv/control-materiales/current
sed -n '1p' /srv/control-materiales/current/REVISION
echo
echo 'Laravel'
sudo -u materiales php /srv/control-materiales/current/artisan about --only=environment,drivers
sudo -u materiales php /srv/control-materiales/current/artisan migrate:status --no-ansi
echo
echo 'Plataforma'
sudo -u materiales composer check-platform-reqs --no-dev --working-dir=/srv/control-materiales/current
echo
echo 'Firewall'
ufw status | sed -n '1,80p'
REMOTE

if [[ ${1:-} == --public ]]; then
    log 'Comprobando el endpoint público'
    curl --fail --silent --show-error \
        --location \
        --max-time 20 \
        --output /dev/null \
        --write-out 'HTTP %{http_code} %{url_effective}\n' \
        https://materiales.utopiadigital.tech/up
fi
