#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_command rsync
require_command ssh
require_env SSH_INGRESS_CIDR
[[ $SSH_INGRESS_CIDR =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/(32|[12]?[0-9]|3[01])$ ]] || die 'SSH_INGRESS_CIDR debe ser un CIDR IPv4 explícito.'

DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
[[ -n $DEPLOY_HOST ]] || die 'No se encontró la IP de despliegue; ejecute provision.sh o defina DEPLOY_HOST.'
OBJECT_NAMESPACE=${OBJECT_NAMESPACE:-$(read_state object_namespace || true)}
BACKUP_BUCKET=${BACKUP_BUCKET:-$(read_state backup_bucket || true)}
[[ -n $OBJECT_NAMESPACE && -n $BACKUP_BUCKET ]] || die 'Falta el estado de Object Storage.'

mapfile -t SSH_ARGS < <(ssh_args)
TARGET=$(ssh_target)

log "Esperando SSH en $DEPLOY_HOST"
for attempt in {1..30}; do
    if ssh "${SSH_ARGS[@]}" -o ConnectTimeout=5 "$TARGET" true 2>/dev/null; then
        break
    fi
    if ((attempt == 30)); then
        die 'La VM no aceptó SSH después de 30 intentos.'
    fi
    sleep 5
done

REMOTE_TMP=/tmp/control-materiales-ops
ssh "${SSH_ARGS[@]}" "$TARGET" "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP'"
rsync -az --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
    -e "ssh ${SSH_ARGS[*]}" \
    "$SCRIPT_DIR/server/" "$TARGET:$REMOTE_TMP/"

log 'Instalando y endureciendo el servidor'
ssh "${SSH_ARGS[@]}" "$TARGET" \
    "sudo env SSH_INGRESS_CIDR='$SSH_INGRESS_CIDR' OBJECT_NAMESPACE='$OBJECT_NAMESPACE' BACKUP_BUCKET='$BACKUP_BUCKET' bash '$REMOTE_TMP/bootstrap.sh'"

write_state deploy_host "$DEPLOY_HOST"
log 'Servidor base configurado.'
