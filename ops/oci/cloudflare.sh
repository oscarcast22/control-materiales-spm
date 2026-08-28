#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_command curl
require_command jq
require_command scp
require_command ssh
require_env CF_API_TOKEN

ACTION=${1:-status}
CF_ZONE_NAME=${CF_ZONE_NAME:-utopiadigital.tech}
PRODUCTION_HOST=${PRODUCTION_HOST:-materiales.utopiadigital.tech}
DEVELOPMENT_HOST=${DEVELOPMENT_HOST:-materiales-dev.utopiadigital.tech}
CF_TUNNEL_ID=${CF_TUNNEL_ID:-de95d898-32c6-48aa-9f63-a1823fb37f19}
CF_API=https://api.cloudflare.com/client/v4

cf_api() {
    local method=$1
    local path=$2
    local data=${3:-}
    local response
    local args=(-fsS -X "$method" "$CF_API$path" -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json')
    [[ -z $data ]] || args+=(--data "$data")
    response=$(curl "${args[@]}")
    [[ $(jq -r '.success' <<<"$response") == true ]] || {
        jq -r '.errors[]? | "Cloudflare: \(.code) \(.message)"' <<<"$response" >&2
        return 1
    }
    printf '%s' "$response"
}

ZONE_ID=$(cf_api GET "/zones?name=$CF_ZONE_NAME&status=active" | jq -r '.result[0].id')
[[ -n $ZONE_ID && $ZONE_ID != null ]] || die "No se encontró la zona $CF_ZONE_NAME."

record_json() {
    local name=$1
    cf_api GET "/zones/$ZONE_ID/dns_records?name=$name" | jq -c '.result[0] // empty'
}

upsert_record() {
    local name=$1
    local payload=$2
    local current record_id
    current=$(record_json "$name")
    record_id=$(jq -r '.id // empty' <<<"${current:-{}}")
    if [[ -n $record_id ]]; then
        cf_api PUT "/zones/$ZONE_ID/dns_records/$record_id" "$payload" >/dev/null
    else
        cf_api POST "/zones/$ZONE_ID/dns_records" "$payload" >/dev/null
    fi
}

prepare_development() {
    ensure_state_dir
    local current
    current=$(record_json "$PRODUCTION_HOST")
    [[ -n $current ]] && printf '%s\n' "$current" >"$STATE_DIR/cloudflare-production-record.json"
    chmod 600 "$STATE_DIR/cloudflare-production-record.json" 2>/dev/null || true

    local payload
    payload=$(jq -cn \
        --arg type CNAME \
        --arg name "$DEVELOPMENT_HOST" \
        --arg content "$CF_TUNNEL_ID.cfargotunnel.com" \
        '{type:$type,name:$name,content:$content,proxied:true,ttl:1}')
    upsert_record "$DEVELOPMENT_HOST" "$payload"
    log "$DEVELOPMENT_HOST apunta al túnel existente."
    log 'Antes de reiniciar cloudflared, agregue ese hostname al ingress local conservando temporalmente el hostname productivo.'
}

install_origin_certificate() {
    DEPLOY_HOST=${DEPLOY_HOST:-$(read_state public_ip || true)}
    [[ -n $DEPLOY_HOST ]] || die 'Falta DEPLOY_HOST o el estado de la IP.'
    mapfile -t SSH_ARGS < <(ssh_args)
    local target csr response certificate cert_file
    target=$(ssh_target)
    cert_file="$STATE_DIR/origin.pem"
    ensure_state_dir

    ssh "${SSH_ARGS[@]}" "$target" \
        "sudo install -d -o root -g root -m 0700 /etc/ssl/control-materiales && sudo test -s /etc/ssl/control-materiales/origin.key || sudo openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout /etc/ssl/control-materiales/origin.key -out /etc/ssl/control-materiales/origin.csr -subj '/CN=$PRODUCTION_HOST' -addext 'subjectAltName=DNS:$PRODUCTION_HOST' && sudo chmod 0600 /etc/ssl/control-materiales/origin.key"
    csr=$(ssh "${SSH_ARGS[@]}" "$target" 'sudo sed -n "1,/END CERTIFICATE REQUEST/p" /etc/ssl/control-materiales/origin.csr')
    response=$(cf_api POST /certificates "$(jq -cn --arg csr "$csr" --arg host "$PRODUCTION_HOST" '{csr:$csr,hostnames:[$host],request_type:"origin-ecc",requested_validity:1095}')")
    certificate=$(jq -r '.result.certificate' <<<"$response")
    [[ $certificate == *'BEGIN CERTIFICATE'* ]] || die 'Cloudflare no devolvió un certificado válido.'
    printf '%s\n' "$certificate" >"$cert_file"
    chmod 600 "$cert_file"

    scp "${SSH_ARGS[@]}" "$cert_file" "$target:/tmp/control-materiales-origin.pem"
    scp "${SSH_ARGS[@]}" "$SCRIPT_DIR/server/nginx-control-materiales.conf" "$target:/tmp/control-materiales-nginx.conf"
    ssh "${SSH_ARGS[@]}" "$target" 'set -e; sudo install -o root -g root -m 0644 /tmp/control-materiales-origin.pem /etc/ssl/control-materiales/origin.pem; sudo install -o root -g root -m 0644 /tmp/control-materiales-nginx.conf /etc/nginx/sites-available/control-materiales; sudo ln -sfn /etc/nginx/sites-available/control-materiales /etc/nginx/sites-enabled/control-materiales; sudo install -d -o root -g root -m 0755 /etc/nginx/snippets; { curl -fsS https://www.cloudflare.com/ips-v4; echo; curl -fsS https://www.cloudflare.com/ips-v6; } | sed "s|^|set_real_ip_from |; s|$|;|" | sudo tee /etc/nginx/snippets/cloudflare-real-ip.conf >/dev/null; sudo nginx -t; sudo systemctl reload nginx; rm -f /tmp/control-materiales-origin.pem /tmp/control-materiales-nginx.conf'
    rm -f "$cert_file"

    cf_api PATCH "/zones/$ZONE_ID/settings/ssl" '{"value":"strict"}' >/dev/null
    log 'Certificado Origin CA instalado y Cloudflare configurado en Full (strict).'
}

cutover() {
    local public_ip payload
    public_ip=${DEPLOY_HOST:-$(read_state public_ip || true)}
    [[ -n $public_ip ]] || die 'No se encontró la IP productiva.'
    payload=$(jq -cn --arg name "$PRODUCTION_HOST" --arg content "$public_ip" '{type:"A",name:$name,content:$content,proxied:true,ttl:1}')
    upsert_record "$PRODUCTION_HOST" "$payload"
    cf_api PATCH "/zones/$ZONE_ID/settings/ssl" '{"value":"strict"}' >/dev/null
    log "$PRODUCTION_HOST apunta a la IP reservada de Oracle mediante Cloudflare."
}

rollback_dns() {
    local payload
    payload=$(jq -cn \
        --arg name "$PRODUCTION_HOST" \
        --arg content "$CF_TUNNEL_ID.cfargotunnel.com" \
        '{type:"CNAME",name:$name,content:$content,proxied:true,ttl:1}')
    upsert_record "$PRODUCTION_HOST" "$payload"
    log "$PRODUCTION_HOST volvió al túnel. Verifique que el ingress local aún acepte este hostname."
}

case "$ACTION" in
    prepare) prepare_development ;;
    origin-cert) install_origin_certificate ;;
    cutover) cutover ;;
    rollback) rollback_dns ;;
    status)
        record_json "$DEVELOPMENT_HOST" | jq '{name,type,content,proxied}'
        record_json "$PRODUCTION_HOST" | jq '{name,type,content,proxied}'
        ;;
    *) die 'Uso: cloudflare.sh {prepare|origin-cert|cutover|rollback|status}' ;;
esac
