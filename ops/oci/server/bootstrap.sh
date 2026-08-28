#!/usr/bin/env bash

set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo 'Este script requiere root.' >&2; exit 1; }
: "${SSH_INGRESS_CIDR:?Falta SSH_INGRESS_CIDR}"
: "${OBJECT_NAMESPACE:?Falta OBJECT_NAMESPACE}"
: "${BACKUP_BUCKET:?Falta BACKUP_BUCKET}"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl software-properties-common

if ! apt-cache show php8.4-cli >/dev/null 2>&1; then
    add-apt-repository --yes ppa:ondrej/php
    apt-get update
fi

apt-get install -y \
    acl ca-certificates composer curl jq nginx openssl postgresql postgresql-client python3-venv rsync unzip ufw \
    php8.4-bcmath php8.4-cli php8.4-curl php8.4-fpm php8.4-intl php8.4-mbstring php8.4-pgsql php8.4-xml php8.4-zip

update-alternatives --set php /usr/bin/php8.4

if ! command -v oci >/dev/null 2>&1; then
    python3 -m venv /opt/oci-cli
    /opt/oci-cli/bin/pip install --disable-pip-version-check oci-cli
    ln -sfn /opt/oci-cli/bin/oci /usr/local/bin/oci
fi

if ! id materiales >/dev/null 2>&1; then
    useradd --system --home-dir /srv/control-materiales --create-home --shell /usr/sbin/nologin materiales
fi
usermod -a -G www-data materiales

install -d -o materiales -g www-data -m 0750 /srv/control-materiales
install -d -o materiales -g www-data -m 0750 /srv/control-materiales/releases
install -d -o materiales -g www-data -m 0750 /srv/control-materiales/shared
install -d -o materiales -g www-data -m 0770 \
    /srv/control-materiales/shared/storage \
    /srv/control-materiales/shared/storage/app \
    /srv/control-materiales/shared/storage/app/private \
    /srv/control-materiales/shared/storage/framework \
    /srv/control-materiales/shared/storage/framework/cache \
    /srv/control-materiales/shared/storage/framework/cache/data \
    /srv/control-materiales/shared/storage/framework/sessions \
    /srv/control-materiales/shared/storage/framework/views \
    /srv/control-materiales/shared/storage/logs \
    /srv/control-materiales/shared/backups

DB_PASSWORD_FILE=/root/.control-materiales-db-password
if [[ ! -s $DB_PASSWORD_FILE ]]; then
    umask 077
    openssl rand -hex 24 >"$DB_PASSWORD_FILE"
fi
DB_PASSWORD=$(<"$DB_PASSWORD_FILE")

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='control_materiales_app'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE control_materiales_app LOGIN PASSWORD '$DB_PASSWORD'"
else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE control_materiales_app PASSWORD '$DB_PASSWORD'"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='control_materiales_spm'" | grep -q 1; then
    sudo -u postgres createdb --owner=control_materiales_app control_materiales_spm
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER DATABASE control_materiales_spm OWNER TO control_materiales_app"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET listen_addresses = 'localhost'"
systemctl restart postgresql

install -o materiales -g materiales -m 0600 /dev/null /srv/control-materiales/shared/.pgpass
printf '127.0.0.1:5432:*:control_materiales_app:%s\n' "$DB_PASSWORD" \
    >/srv/control-materiales/shared/.pgpass
chown materiales:materiales /srv/control-materiales/shared/.pgpass
chmod 0600 /srv/control-materiales/shared/.pgpass

install -o root -g root -m 0644 "$SCRIPT_DIR/php-control-materiales.ini" /etc/php/8.4/fpm/conf.d/99-control-materiales.ini
install -o root -g root -m 0644 "$SCRIPT_DIR/php-fpm-pool.conf" /etc/php/8.4/fpm/pool.d/control-materiales.conf

install -o root -g root -m 0755 "$SCRIPT_DIR/backup.sh" /usr/local/sbin/control-materiales-backup
install -o root -g root -m 0644 "$SCRIPT_DIR/control-materiales-queue.service" /etc/systemd/system/control-materiales-queue.service
install -o root -g root -m 0644 "$SCRIPT_DIR/control-materiales-schedule.service" /etc/systemd/system/control-materiales-schedule.service
install -o root -g root -m 0644 "$SCRIPT_DIR/control-materiales-schedule.timer" /etc/systemd/system/control-materiales-schedule.timer
install -o root -g root -m 0644 "$SCRIPT_DIR/control-materiales-backup.service" /etc/systemd/system/control-materiales-backup.service
install -o root -g root -m 0644 "$SCRIPT_DIR/control-materiales-backup.timer" /etc/systemd/system/control-materiales-backup.timer

install -o root -g root -m 0640 /dev/null /etc/control-materiales-backup.env
{
    printf 'OBJECT_NAMESPACE=%s\n' "$OBJECT_NAMESPACE"
    printf 'BACKUP_BUCKET=%s\n' "$BACKUP_BUCKET"
    printf 'BACKUP_RETENTION_DAYS=30\n'
} >/etc/control-materiales-backup.env

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$SSH_INGRESS_CIDR" to any port 22 proto tcp
while IFS= read -r cidr || [[ -n $cidr ]]; do
    [[ -n $cidr ]] || continue
    ufw allow from "$cidr" to any port 80 proto tcp
    ufw allow from "$cidr" to any port 443 proto tcp
done < <(curl -fsS https://www.cloudflare.com/ips-v4)
ufw --force enable

rm -f /etc/nginx/sites-enabled/default
systemctl daemon-reload
systemctl enable php8.4-fpm nginx postgresql control-materiales-schedule.timer control-materiales-backup.timer
systemctl restart php8.4-fpm nginx
systemctl start control-materiales-schedule.timer control-materiales-backup.timer

echo 'Servidor base listo.'
