# Operación en Oracle Cloud

Estos scripts aprovisionan y despliegan el piloto productivo de Control de Materiales SPM. No contienen secretos ni crean recursos pagados deliberadamente.

## Requisitos locales

- Bash, `jq`, `git`, `ssh`, `rsync`, PostgreSQL client, Composer y Node 22.13 o posterior.
- OCI CLI autenticado en la región principal de la cuenta.
- Llave pública SSH Ed25519.
- Token temporal de Cloudflare limitado a la zona `utopiadigital.tech` con permisos DNS, SSL/certificados y configuración SSL.

Autenticar OCI sin dejar una llave API permanente:

```bash
oci session authenticate --profile-name CONTROL_MATERIALES
export OCI_PROFILE=CONTROL_MATERIALES
export OCI_CLI_AUTH=security_token
```

Definir la IP pública desde la que se administrará el servidor y aprovisionar:

```bash
export SSH_INGRESS_CIDR="$(curl -fsS https://api.ipify.org)/32"
ops/oci/provision.sh
```

El script usa exclusivamente la región principal, `VM.Standard.A1.Flex`, 1 OCPU, 4 GB de RAM, 50 GB de arranque y un bucket privado. Si no existe capacidad A1 o se agotó una cuota, se detiene; nunca cambia automáticamente a una forma pagada.

Los OCID y la IP resultante se guardan en `ops/oci/.state/`, que está ignorado por Git.

## Orden del primer despliegue

1. `provision.sh`
2. `configure-server.sh`
3. `cloudflare.sh prepare`
4. `deploy.sh --first-release`
5. `migrate-current-data.sh`
6. `store-app-key.sh`
7. Crear la segunda cuenta con `php artisan app:create-user` mediante SSH.
8. `cloudflare.sh cutover`
9. `status.sh --public`

Antes del corte, generar e instalar el certificado del origen:

```bash
read -rsp 'Token limitado de Cloudflare: ' CF_API_TOKEN && echo
export CF_API_TOKEN
ops/oci/cloudflare.sh prepare
ops/oci/cloudflare.sh origin-cert
```

Después de validar el primer respaldo diario, comprobar una restauración aislada:

```bash
ops/oci/restore-check.sh
```

No ejecutar el corte si `main` no está limpio, las verificaciones no pasan o el manifiesto del respaldo no coincide con la restauración.
