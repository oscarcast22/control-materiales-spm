#!/usr/bin/env bash

set -Eeuo pipefail

OPS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PROJECT_DIR=$(cd "$OPS_DIR/../.." && pwd)
STATE_DIR=${STATE_DIR:-"$OPS_DIR/.state"}

log() {
    printf '[control-materiales] %s\n' "$*"
}

die() {
    printf '[control-materiales] ERROR: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Falta el comando requerido: $1"
}

require_env() {
    local name=$1
    [[ -n ${!name:-} ]] || die "Falta la variable requerida: $name"
}

ensure_state_dir() {
    mkdir -p "$STATE_DIR"
    chmod 700 "$STATE_DIR"
}

oci_cmd() {
    local args=(--profile "${OCI_PROFILE:-CONTROL_MATERIALES}")

    if [[ -n ${OCI_CLI_AUTH:-} ]]; then
        args+=(--auth "$OCI_CLI_AUTH")
    fi

    oci "$@" "${args[@]}"
}

profile_value() {
    local key=$1
    local config=${OCI_CONFIG_FILE:-"$HOME/.oci/config"}
    local profile=${OCI_PROFILE:-CONTROL_MATERIALES}

    [[ -f $config ]] || return 1

    awk -F= -v wanted_profile="$profile" -v wanted_key="$key" '
        /^\[/ {
            current=$0
            gsub(/^\[|\]$/, "", current)
            next
        }
        current == wanted_profile && $1 == wanted_key {
            value=substr($0, index($0, "=")+1)
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
            print value
            exit
        }
    ' "$config"
}

require_clean_release() {
    require_command git

    [[ $(git -C "$PROJECT_DIR" branch --show-current) == main ]] || die 'El despliegue sólo se permite desde main.'
    [[ -z $(git -C "$PROJECT_DIR" status --porcelain) ]] || die 'El árbol de trabajo no está limpio.'

    git -C "$PROJECT_DIR" fetch --quiet origin main

    local head remote
    head=$(git -C "$PROJECT_DIR" rev-parse HEAD)
    remote=$(git -C "$PROJECT_DIR" rev-parse origin/main)
    [[ $head == "$remote" ]] || die 'HEAD no coincide con origin/main.'
}

write_state() {
    local key=$1
    local value=$2
    ensure_state_dir
    printf '%s\n' "$value" >"$STATE_DIR/$key"
    chmod 600 "$STATE_DIR/$key"
}

read_state() {
    local key=$1
    [[ -f "$STATE_DIR/$key" ]] || return 1
    sed -n '1p' "$STATE_DIR/$key"
}

ssh_target() {
    printf '%s@%s' "${DEPLOY_SSH_USER:-ubuntu}" "${DEPLOY_HOST:?Falta DEPLOY_HOST}"
}

ssh_args() {
    local key=${DEPLOY_SSH_KEY:-"$HOME/.ssh/id_ed25519"}
    printf '%s\n' -i "$key" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new
}
