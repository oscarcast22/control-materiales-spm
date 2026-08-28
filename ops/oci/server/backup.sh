#!/usr/bin/env bash

set -Eeuo pipefail

: "${OBJECT_NAMESPACE:?Falta OBJECT_NAMESPACE}"
: "${BACKUP_BUCKET:?Falta BACKUP_BUCKET}"

BACKUP_CLASS=${1:-daily}
[[ $BACKUP_CLASS == daily || $BACKUP_CLASS == release ]] || { echo 'Clase inválida.' >&2; exit 1; }

APP_ROOT=/srv/control-materiales/current
SHARED_ROOT=/srv/control-materiales/shared
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
COMMIT=$(sed -n '1p' "$APP_ROOT/REVISION" 2>/dev/null || printf unknown)
WORK_DIR=$(mktemp -d "$SHARED_ROOT/backups/.tmp.XXXXXX")
ARCHIVE="$SHARED_ROOT/backups/control-materiales-$TIMESTAMP-$COMMIT.tar.gz"
trap 'rm -rf "$WORK_DIR" "$ARCHIVE"' EXIT

export PGPASSFILE="$SHARED_ROOT/.pgpass"
pg_dump \
    --host=127.0.0.1 \
    --username=control_materiales_app \
    --dbname=control_materiales_spm \
    --format=custom \
    --no-owner \
    --no-acl \
    --file="$WORK_DIR/database.dump"

pg_restore --list "$WORK_DIR/database.dump" >/dev/null
tar -C "$SHARED_ROOT/storage/app" -czf "$WORK_DIR/private.tar.gz" private
php "$APP_ROOT/ops/oci/manifest.php" >"$WORK_DIR/application-manifest.json"

DB_SHA=$(sha256sum "$WORK_DIR/database.dump" | awk '{print $1}')
PRIVATE_SHA=$(sha256sum "$WORK_DIR/private.tar.gz" | awk '{print $1}')
cat >"$WORK_DIR/manifest.json" <<EOF
{"created_at":"$TIMESTAMP","commit":"$COMMIT","database_sha256":"$DB_SHA","private_sha256":"$PRIVATE_SHA"}
EOF

tar -C "$WORK_DIR" -czf "$ARCHIVE" database.dump private.tar.gz manifest.json application-manifest.json
sha256sum "$ARCHIVE" >"$ARCHIVE.sha256"

OBJECT_NAME="$BACKUP_CLASS/$(basename "$ARCHIVE")"
oci os object put \
    --auth instance_principal \
    --namespace-name "$OBJECT_NAMESPACE" \
    --bucket-name "$BACKUP_BUCKET" \
    --name "$OBJECT_NAME" \
    --file "$ARCHIVE" \
    --force >/dev/null
oci os object put \
    --auth instance_principal \
    --namespace-name "$OBJECT_NAMESPACE" \
    --bucket-name "$BACKUP_BUCKET" \
    --name "$OBJECT_NAME.sha256" \
    --file "$ARCHIVE.sha256" \
    --force >/dev/null

rm -f "$ARCHIVE.sha256"
echo "Respaldo cargado: $OBJECT_NAME"
