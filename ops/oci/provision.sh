#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_command oci
require_command jq
require_command ssh-keygen

OCI_PROFILE=${OCI_PROFILE:-CONTROL_MATERIALES}
OCI_CLI_AUTH=${OCI_CLI_AUTH:-api_key}
APP_COMPARTMENT_NAME=${APP_COMPARTMENT_NAME:-control-materiales-spm-prod}
VCN_NAME=${VCN_NAME:-control-materiales-spm-vcn}
SUBNET_NAME=${SUBNET_NAME:-control-materiales-spm-public}
INSTANCE_NAME=${INSTANCE_NAME:-control-materiales-spm-web}
PUBLIC_IP_NAME=${PUBLIC_IP_NAME:-control-materiales-spm-ip}
BACKUP_BUCKET=${BACKUP_BUCKET:-control-materiales-spm-backups}
BACKUP_DYNAMIC_GROUP=${BACKUP_DYNAMIC_GROUP:-control-materiales-spm-backup-instance}
BACKUP_POLICY=${BACKUP_POLICY:-control-materiales-spm-backup-policy}
SSH_PUBLIC_KEY=${SSH_PUBLIC_KEY:-"$HOME/.ssh/id_ed25519.pub"}
SSH_INGRESS_CIDR=${SSH_INGRESS_CIDR:-}
OCI_CONFIG_FILE=${OCI_CONFIG_FILE:-"$HOME/.oci/config"}

[[ -f $SSH_PUBLIC_KEY ]] || die "No existe la llave pública SSH: $SSH_PUBLIC_KEY"
[[ $SSH_INGRESS_CIDR =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/(32|[12]?[0-9]|3[01])$ ]] || die 'SSH_INGRESS_CIDR debe ser un CIDR IPv4 explícito; se recomienda /32.'

TENANCY_ID=${OCI_TENANCY_ID:-$(profile_value tenancy || true)}
[[ -n $TENANCY_ID ]] || die 'No se pudo obtener tenancy del perfil OCI.'

HOME_REGION=$(oci_cmd iam region-subscription list \
    --tenancy-id "$TENANCY_ID" \
    --query 'data[?"is-home-region"]."region-name" | [0]' \
    --raw-output)
[[ -n $HOME_REGION && $HOME_REGION != null ]] || die 'No se pudo detectar la región principal.'

CONFIG_REGION=$(profile_value region || true)
[[ $CONFIG_REGION == "$HOME_REGION" ]] || die "El perfil debe usar la región principal $HOME_REGION; actualmente usa ${CONFIG_REGION:-ninguna}."

log "Región principal: $HOME_REGION"

COMPARTMENT_ID=$(oci_cmd iam compartment list \
    --compartment-id "$TENANCY_ID" \
    --name "$APP_COMPARTMENT_NAME" \
    --lifecycle-state ACTIVE \
    --query 'data[0].id' \
    --raw-output)

if [[ -z $COMPARTMENT_ID || $COMPARTMENT_ID == null ]]; then
    log "Creando compartimento $APP_COMPARTMENT_NAME"
    COMPARTMENT_ID=$(oci_cmd iam compartment create \
        --compartment-id "$TENANCY_ID" \
        --name "$APP_COMPARTMENT_NAME" \
        --description 'Producción de Control de Materiales SPM' \
        --wait-for-state ACTIVE \
        --query 'data.id' \
        --raw-output)
fi

VCN_ID=$(oci_cmd network vcn list \
    --compartment-id "$COMPARTMENT_ID" \
    --display-name "$VCN_NAME" \
    --lifecycle-state AVAILABLE \
    --query 'data[0].id' \
    --raw-output)

if [[ -z $VCN_ID || $VCN_ID == null ]]; then
    log "Creando VCN $VCN_NAME"
    VCN_ID=$(oci_cmd network vcn create \
        --compartment-id "$COMPARTMENT_ID" \
        --display-name "$VCN_NAME" \
        --cidr-block 10.42.0.0/16 \
        --dns-label cmspm \
        --wait-for-state AVAILABLE \
        --query 'data.id' \
        --raw-output)
fi

VCN_JSON=$(oci_cmd network vcn get --vcn-id "$VCN_ID" --query data)
ROUTE_TABLE_ID=$(jq -r '."default-route-table-id"' <<<"$VCN_JSON")
SECURITY_LIST_ID=$(jq -r '."default-security-list-id"' <<<"$VCN_JSON")

IGW_ID=$(oci_cmd network internet-gateway list \
    --compartment-id "$COMPARTMENT_ID" \
    --vcn-id "$VCN_ID" \
    --display-name control-materiales-spm-igw \
    --lifecycle-state AVAILABLE \
    --query 'data[0].id' \
    --raw-output)

if [[ -z $IGW_ID || $IGW_ID == null ]]; then
    log 'Creando Internet Gateway'
    IGW_ID=$(oci_cmd network internet-gateway create \
        --compartment-id "$COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --display-name control-materiales-spm-igw \
        --is-enabled true \
        --wait-for-state AVAILABLE \
        --query 'data.id' \
        --raw-output)
fi

ROUTE_RULES=$(jq -cn --arg gateway "$IGW_ID" '[{destination:"0.0.0.0/0",destinationType:"CIDR_BLOCK",networkEntityId:$gateway}]')
oci_cmd network route-table update \
    --rt-id "$ROUTE_TABLE_ID" \
    --route-rules "$ROUTE_RULES" \
    --force \
    --wait-for-state AVAILABLE >/dev/null

INGRESS_RULES=$(jq -cn --arg ssh "$SSH_INGRESS_CIDR" '[
    {protocol:"6",source:$ssh,sourceType:"CIDR_BLOCK",tcpOptions:{destinationPortRange:{min:22,max:22}}},
    {protocol:"6",source:"0.0.0.0/0",sourceType:"CIDR_BLOCK",tcpOptions:{destinationPortRange:{min:80,max:80}}},
    {protocol:"6",source:"0.0.0.0/0",sourceType:"CIDR_BLOCK",tcpOptions:{destinationPortRange:{min:443,max:443}}}
]')
EGRESS_RULES='[{"destination":"0.0.0.0/0","destinationType":"CIDR_BLOCK","protocol":"all"}]'
oci_cmd network security-list update \
    --security-list-id "$SECURITY_LIST_ID" \
    --ingress-security-rules "$INGRESS_RULES" \
    --egress-security-rules "$EGRESS_RULES" \
    --force \
    --wait-for-state AVAILABLE >/dev/null

SUBNET_ID=$(oci_cmd network subnet list \
    --compartment-id "$COMPARTMENT_ID" \
    --vcn-id "$VCN_ID" \
    --display-name "$SUBNET_NAME" \
    --lifecycle-state AVAILABLE \
    --query 'data[0].id' \
    --raw-output)

if [[ -z $SUBNET_ID || $SUBNET_ID == null ]]; then
    log "Creando subred $SUBNET_NAME"
    SUBNET_ID=$(oci_cmd network subnet create \
        --compartment-id "$COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --display-name "$SUBNET_NAME" \
        --cidr-block 10.42.1.0/24 \
        --dns-label public \
        --route-table-id "$ROUTE_TABLE_ID" \
        --security-list-ids "[\"$SECURITY_LIST_ID\"]" \
        --prohibit-public-ip-on-vnic false \
        --wait-for-state AVAILABLE \
        --query 'data.id' \
        --raw-output)
fi

INSTANCE_ID=$(oci_cmd compute instance list \
    --compartment-id "$COMPARTMENT_ID" \
    --display-name "$INSTANCE_NAME" \
    --lifecycle-state RUNNING \
    --query 'data[0].id' \
    --raw-output)

if [[ -z $INSTANCE_ID || $INSTANCE_ID == null ]]; then
    AD=${OCI_AVAILABILITY_DOMAIN:-$(oci_cmd iam availability-domain list \
        --compartment-id "$TENANCY_ID" \
        --query 'data[0].name' \
        --raw-output)}
    IMAGE_ID=$(oci_cmd compute image list \
        --compartment-id "$TENANCY_ID" \
        --operating-system 'Canonical Ubuntu' \
        --operating-system-version '24.04' \
        --shape VM.Standard.A1.Flex \
        --sort-by TIMECREATED \
        --sort-order DESC \
        --query 'data[0].id' \
        --raw-output)
    [[ -n $IMAGE_ID && $IMAGE_ID != null ]] || die 'No se encontró una imagen Ubuntu 24.04 compatible con A1.'

    log "Creando VM A1 en $AD (1 OCPU, 4 GB)"
    INSTANCE_ID=$(oci_cmd compute instance launch \
        --availability-domain "$AD" \
        --compartment-id "$COMPARTMENT_ID" \
        --display-name "$INSTANCE_NAME" \
        --shape VM.Standard.A1.Flex \
        --shape-config '{"ocpus":1,"memoryInGBs":4}' \
        --image-id "$IMAGE_ID" \
        --subnet-id "$SUBNET_ID" \
        --assign-public-ip false \
        --boot-volume-size-in-gbs 50 \
        --ssh-authorized-keys-file "$SSH_PUBLIC_KEY" \
        --wait-for-state RUNNING \
        --query 'data.id' \
        --raw-output)
fi

VNIC_ID=$(oci_cmd compute vnic-attachment list \
    --compartment-id "$COMPARTMENT_ID" \
    --instance-id "$INSTANCE_ID" \
    --query 'data[0]."vnic-id"' \
    --raw-output)
PRIVATE_IP_ID=$(oci_cmd network private-ip list \
    --vnic-id "$VNIC_ID" \
    --query 'data[?"is-primary"].id | [0]' \
    --raw-output)

PUBLIC_IP_ID=$(oci_cmd network public-ip list \
    --compartment-id "$COMPARTMENT_ID" \
    --scope REGION \
    --lifetime RESERVED \
    --query "data[?\"display-name\"=='$PUBLIC_IP_NAME'].id | [0]" \
    --raw-output)

if [[ -z $PUBLIC_IP_ID || $PUBLIC_IP_ID == null ]]; then
    log 'Creando y asignando IP pública reservada'
    PUBLIC_IP_ID=$(oci_cmd network public-ip create \
        --compartment-id "$COMPARTMENT_ID" \
        --display-name "$PUBLIC_IP_NAME" \
        --lifetime RESERVED \
        --private-ip-id "$PRIVATE_IP_ID" \
        --wait-for-state ASSIGNED \
        --query 'data.id' \
        --raw-output)
else
    oci_cmd network public-ip update \
        --public-ip-id "$PUBLIC_IP_ID" \
        --private-ip-id "$PRIVATE_IP_ID" \
        --wait-for-state ASSIGNED \
        --force >/dev/null
fi

PUBLIC_IP=$(oci_cmd network public-ip get \
    --public-ip-id "$PUBLIC_IP_ID" \
    --query 'data."ip-address"' \
    --raw-output)

NAMESPACE=$(oci_cmd os ns get --query data --raw-output)
if BUCKET_RESULT=$(oci_cmd os bucket get \
    --namespace-name "$NAMESPACE" \
    --bucket-name "$BACKUP_BUCKET" 2>&1); then
    :
elif [[ $BUCKET_RESULT == *'"code": "BucketNotFound"'* ]]; then
    log "Creando bucket privado $BACKUP_BUCKET"
    oci_cmd os bucket create \
        --compartment-id "$COMPARTMENT_ID" \
        --namespace-name "$NAMESPACE" \
        --name "$BACKUP_BUCKET" \
        --public-access-type NoPublicAccess \
        --storage-tier Standard \
        --versioning Disabled >/dev/null
else
    printf '%s\n' "$BUCKET_RESULT" >&2
    die 'No se pudo comprobar el bucket de respaldos.'
fi

DYNAMIC_GROUP_ID=$(oci_cmd iam dynamic-group list \
    --compartment-id "$TENANCY_ID" \
    --name "$BACKUP_DYNAMIC_GROUP" \
    --lifecycle-state ACTIVE \
    --query 'data[0].id' \
    --raw-output)

if [[ -z $DYNAMIC_GROUP_ID || $DYNAMIC_GROUP_ID == null ]]; then
    log 'Creando identidad de instancia para respaldos'
    DYNAMIC_GROUP_ID=$(oci_cmd iam dynamic-group create \
        --compartment-id "$TENANCY_ID" \
        --name "$BACKUP_DYNAMIC_GROUP" \
        --description 'Únicamente la VM productiva de Control de Materiales SPM' \
        --matching-rule "instance.id = '$INSTANCE_ID'" \
        --wait-for-state ACTIVE \
        --query 'data.id' \
        --raw-output)
fi

POLICY_ID=$(oci_cmd iam policy list \
    --compartment-id "$TENANCY_ID" \
    --name "$BACKUP_POLICY" \
    --lifecycle-state ACTIVE \
    --query 'data[0].id' \
    --raw-output)
POLICY_STATEMENTS=$(jq -cn \
    --arg group "$BACKUP_DYNAMIC_GROUP" \
    --arg compartment "$COMPARTMENT_ID" \
    --arg bucket "$BACKUP_BUCKET" \
    --arg object_storage_service "objectstorage-$HOME_REGION" \
    '[
        "Allow dynamic-group " + $group + " to read buckets in compartment id " + $compartment,
        "Allow dynamic-group " + $group + " to manage objects in compartment id " + $compartment + " where target.bucket.name = '\''" + $bucket + "'\''",
        "Allow dynamic-group " + $group + " to read objectstorage-namespaces in tenancy",
        "Allow service " + $object_storage_service + " to manage object-family in compartment id " + $compartment + " where any {request.permission='\''BUCKET_INSPECT'\'', request.permission='\''BUCKET_READ'\'', request.permission='\''OBJECT_INSPECT'\'', request.permission='\''OBJECT_UPDATE_TIER'\'', request.permission='\''OBJECT_DELETE'\'', request.permission='\''OBJECT_VERSION_DELETE'\''}"
    ]')

if [[ -z $POLICY_ID || $POLICY_ID == null ]]; then
    oci_cmd iam policy create \
        --compartment-id "$TENANCY_ID" \
        --name "$BACKUP_POLICY" \
        --description 'Acceso mínimo de la VM al bucket de respaldos' \
        --statements "$POLICY_STATEMENTS" \
        --wait-for-state ACTIVE >/dev/null
else
    oci_cmd iam policy update \
        --policy-id "$POLICY_ID" \
        --statements "$POLICY_STATEMENTS" \
        --version-date '' \
        --force >/dev/null
fi

# Las actualizaciones de políticas IAM suelen tardar unos segundos en aplicarse
# al principal regional de Object Storage.
sleep 15

LIFECYCLE_ITEMS='[{"name":"eliminar-respaldos-diarios-antiguos","action":"DELETE","timeAmount":30,"timeUnit":"DAYS","isEnabled":true,"objectNameFilter":{"inclusionPrefixes":["daily/"]}}]'
oci_cmd os object-lifecycle-policy put \
    --namespace-name "$NAMESPACE" \
    --bucket-name "$BACKUP_BUCKET" \
    --items "$LIFECYCLE_ITEMS" \
    --force >/dev/null

write_state tenancy_id "$TENANCY_ID"
write_state compartment_id "$COMPARTMENT_ID"
write_state instance_id "$INSTANCE_ID"
write_state public_ip_id "$PUBLIC_IP_ID"
write_state public_ip "$PUBLIC_IP"
write_state object_namespace "$NAMESPACE"
write_state backup_bucket "$BACKUP_BUCKET"
write_state backup_dynamic_group_id "$DYNAMIC_GROUP_ID"

log "Infraestructura lista. IP reservada: $PUBLIC_IP"
log "Estado guardado en $STATE_DIR (no versionado)."
