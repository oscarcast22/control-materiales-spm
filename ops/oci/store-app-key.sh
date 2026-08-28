#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_command base64
require_command jq
require_command oci
require_command ssh

DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
COMPARTMENT_ID=${OCI_COMPARTMENT_ID:-$(read_state compartment_id || true)}
[[ -n $DEPLOY_HOST && -n $COMPARTMENT_ID ]] || die 'Falta el estado de provision.sh.'

VAULT_NAME=${VAULT_NAME:-control-materiales-spm-vault}
KEY_NAME=${KEY_NAME:-control-materiales-spm-key}
SECRET_NAME=${SECRET_NAME:-control-materiales-spm-app-key}
mapfile -t SSH_ARGS < <(ssh_args)
TARGET=$(ssh_target)

APP_KEY=$(ssh "${SSH_ARGS[@]}" "$TARGET" "sudo -u materiales sed -n 's/^APP_KEY=//p' /srv/control-materiales/shared/.env")
[[ $APP_KEY == base64:* ]] || die 'No se obtuvo una APP_KEY válida del servidor.'
APP_KEY_BASE64=$(printf '%s' "$APP_KEY" | base64 -w0)

VAULT_JSON=$(oci_cmd kms management vault list \
    --compartment-id "$COMPARTMENT_ID" \
    --query "data[?\"display-name\"=='$VAULT_NAME' && \"lifecycle-state\"=='ACTIVE'] | [0]")
VAULT_ID=$(jq -r '.id // empty' <<<"$VAULT_JSON")

if [[ -z $VAULT_ID ]]; then
    log 'Creando Vault para el secreto de recuperación'
    VAULT_JSON=$(oci_cmd kms management vault create \
        --compartment-id "$COMPARTMENT_ID" \
        --display-name "$VAULT_NAME" \
        --vault-type DEFAULT \
        --wait-for-state ACTIVE \
        --query data)
    VAULT_ID=$(jq -r '.id' <<<"$VAULT_JSON")
fi
MANAGEMENT_ENDPOINT=$(jq -r '."management-endpoint"' <<<"$VAULT_JSON")

KEY_ID=$(oci_cmd kms management key list \
    --endpoint "$MANAGEMENT_ENDPOINT" \
    --compartment-id "$COMPARTMENT_ID" \
    --query "data[?\"display-name\"=='$KEY_NAME' && \"lifecycle-state\"=='ENABLED'].id | [0]" \
    --raw-output)

if [[ -z $KEY_ID || $KEY_ID == null ]]; then
    log 'Creando llave de cifrado administrada por software'
    KEY_ID=$(oci_cmd kms management key create \
        --endpoint "$MANAGEMENT_ENDPOINT" \
        --compartment-id "$COMPARTMENT_ID" \
        --display-name "$KEY_NAME" \
        --key-shape '{"algorithm":"AES","length":32}' \
        --protection-mode SOFTWARE \
        --wait-for-state ENABLED \
        --query 'data.id' \
        --raw-output)
fi

SECRET_ID=$(oci_cmd vault secret list \
    --compartment-id "$COMPARTMENT_ID" \
    --name "$SECRET_NAME" \
    --lifecycle-state ACTIVE \
    --query 'data[0].id' \
    --raw-output)

if [[ -z $SECRET_ID || $SECRET_ID == null ]]; then
    SECRET_ID=$(oci_cmd vault secret create-base64 \
        --compartment-id "$COMPARTMENT_ID" \
        --secret-name "$SECRET_NAME" \
        --vault-id "$VAULT_ID" \
        --key-id "$KEY_ID" \
        --secret-content-content "$APP_KEY_BASE64" \
        --wait-for-state ACTIVE \
        --query 'data.id' \
        --raw-output)
else
    oci_cmd vault secret update-base64 \
        --secret-id "$SECRET_ID" \
        --secret-content-content "$APP_KEY_BASE64" \
        --wait-for-state ACTIVE \
        --force >/dev/null
fi

unset APP_KEY APP_KEY_BASE64
write_state vault_id "$VAULT_ID"
write_state vault_key_id "$KEY_ID"
write_state app_key_secret_id "$SECRET_ID"
log 'APP_KEY respaldada en OCI Vault sin conceder acceso a la VM.'
