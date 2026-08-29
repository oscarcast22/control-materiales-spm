# Infraestructura productiva y despliegue

## Propósito

Este documento describe la infraestructura que ejecuta la aplicación en
producción y el procedimiento habitual para publicar cambios desde `main`. La
fuente de verdad ejecutable son los scripts de [`ops/oci/`](../ops/oci/); este
documento explica su topología, sus límites y la forma segura de operarlos.

El aprovisionamiento inicial ya terminó. Los comandos de creación de recursos,
migración del origen local y corte DNS se conservan para recuperación y
trazabilidad, pero no forman parte de un despliegue cotidiano.

## Estado actual

Producción está activa desde el 28 de agosto de 2026.

| Componente          | Configuración                                                       |
| ------------------- | ------------------------------------------------------------------- |
| URL productiva      | `https://materiales.utopiadigital.tech`                             |
| Proveedor           | Oracle Cloud Infrastructure (OCI), Free Tier                        |
| Región              | US East (Ashburn), región `us-ashburn-1`                            |
| Compartimento       | `control-materiales-spm-prod`                                       |
| Instancia           | `control-materiales-spm-web`                                        |
| Forma               | `VM.Standard.A1.Flex`, ARM, 1 OCPU y 4 GB de RAM                    |
| Sistema             | Ubuntu 24.04                                                        |
| Volumen de arranque | 50 GB                                                               |
| Base de datos       | PostgreSQL 16 local, sin puerto público                             |
| Runtime             | Nginx, PHP 8.4-FPM y Laravel                                        |
| Entrada web         | Túnel Cloudflare dedicado ejecutado en el VPS                       |
| Respaldos           | OCI Object Storage, bucket privado `control-materiales-spm-backups` |
| Retención diaria    | 30 días                                                             |
| Desarrollo          | Sólo localhost; el túnel público de desarrollo fue eliminado        |

En la consola de OCI debe seleccionarse el compartimento
`control-materiales-spm-prod`. La vista del compartimento raíz no muestra la
instancia, la VCN ni el bucket del proyecto.

## Topología

```text
Navegador
   │ HTTPS
   ▼
Cloudflare DNS y proxy
   │ túnel saliente cifrado
   ▼
cloudflared en el VPS
   │ HTTPS por loopback
   ▼
Nginx :443
   │ socket Unix
   ▼
PHP 8.4-FPM / Laravel
   ├── PostgreSQL en 127.0.0.1:5432
   ├── storage privado persistente
   ├── worker de colas
   └── planificador Laravel

VPS ── Instance Principal ──► bucket privado de Object Storage
```

El registro `materiales.utopiadigital.tech` es un CNAME proxied hacia un túnel
dedicado. El conector de ese túnel corre como `cloudflared.service` en Oracle;
no depende de la computadora de desarrollo. La IP pública reservada se conserva
para administración por SSH y contingencia, pero el tráfico web normal entra
por el túnel.

## Recursos de OCI

Los nombres estables se definen en [`ops/oci/provision.sh`](../ops/oci/provision.sh):

- compartimento `control-materiales-spm-prod`;
- VCN `control-materiales-spm-vcn`, CIDR `10.42.0.0/16`;
- subred pública `control-materiales-spm-public`, CIDR `10.42.1.0/24`;
- Internet Gateway `control-materiales-spm-igw`;
- instancia `control-materiales-spm-web`;
- IP reservada `control-materiales-spm-ip`;
- bucket `control-materiales-spm-backups`;
- grupo dinámico `control-materiales-spm-backup-instance`;
- política `control-materiales-spm-backup-policy`;
- Vault, llave administrada por software y secreto de respaldo de `APP_KEY`.

Los OCID, la IP y los identificadores operativos locales se guardan en
`ops/oci/.state/`. Ese directorio está ignorado por Git y no debe copiarse a la
documentación ni publicarse.

La VM usa Instance Principal para escribir únicamente en el bucket de
respaldos. No contiene una llave API de una persona. El secreto de `APP_KEY` en
Vault es una copia de recuperación; la VM no tiene permiso para leerlo.

## Organización del servidor

```text
/srv/control-materiales/
├── current -> releases/<release-activo>
├── releases/
│   └── <fecha>-<commit>/
└── shared/
    ├── .env
    ├── .pgpass
    ├── storage/
    │   ├── app/private/
    │   ├── framework/
    │   └── logs/
    └── backups/
```

Cada release es inmutable. `current` cambia de forma atómica mediante un
symlink. El `.env`, las sesiones, los logs y los adjuntos privados viven en
`shared`, por lo que no se reemplazan al publicar código.

Los procesos principales son:

| Unidad systemd                      | Responsabilidad                                     |
| ----------------------------------- | --------------------------------------------------- |
| `nginx.service`                     | Servir la aplicación y encabezados de seguridad     |
| `php8.4-fpm.service`                | Ejecutar Laravel en un pool dedicado                |
| `postgresql.service`                | Base productiva local                               |
| `control-materiales-queue.service`  | Procesar la cola y reiniciarse automáticamente      |
| `control-materiales-schedule.timer` | Ejecutar el planificador cada minuto                |
| `control-materiales-backup.timer`   | Crear el respaldo diario alrededor de las 03:15 UTC |
| `cloudflared.service`               | Mantener el túnel productivo                        |

La ubicación PHP de Nginx reserva un búfer FastCGI de `32k` para los
encabezados de respuesta. Es necesario porque Inertia y Vite pueden emitir un
encabezado `Link` con la precarga de varios fragmentos; reducirlo al valor
predeterminado puede provocar respuestas `502` en páginas con más dependencias,
aunque `/up` continúe respondiendo correctamente.

## Requisitos para desplegar

Un despliegue normal se ejecuta desde la computadora administrativa que
conserva:

- el repositorio y `ops/oci/.state/`;
- la llave SSH `~/.ssh/id_ed25519` autorizada en la VM;
- acceso de red desde la IP pública permitida para SSH;
- PHP, Composer, Node, npm, Git, SSH y rsync.

No se necesita iniciar sesión en OCI ni crear un token de Cloudflare para un
despliegue normal. Esas credenciales sólo se requieren para cambiar recursos de
infraestructura o DNS.

El script rechaza el despliegue si:

- la rama actual no es `main`;
- el árbol de trabajo tiene cambios;
- `HEAD` no coincide exactamente con `origin/main`;
- falla cualquier prueba, análisis, build o auditoría;
- no puede establecer la conexión SSH.

## Workflow habitual desde `main`

Después de integrar y subir los cambios a GitHub:

```bash
cd /home/diseno-web/web/oscar/control-materiales-spm
git switch main
git pull --ff-only origin main
git status --short
ops/oci/deploy.sh
ops/oci/status.sh --public
```

`git status --short` debe producir una salida vacía. No usar
`--first-release` en actualizaciones normales.

El despliegue realiza, en orden:

1. confirma que el commit local es exactamente `origin/main`;
2. ejecuta `composer test`;
3. instala dependencias frontend reproducibles con `npm ci`;
4. ejecuta formato, tipos, lint y build;
5. ejecuta las auditorías de Composer y npm;
6. genera el paquete desde `git archive`, sin secretos, adjuntos ni bases;
7. transfiere el paquete por SSH;
8. instala las dependencias PHP de producción para ARM;
9. crea un respaldo de clase `release` antes de activar el cambio;
10. pone brevemente la versión anterior en mantenimiento;
11. ejecuta únicamente `php artisan migrate --force --no-interaction`;
12. cambia el symlink `current`, recarga PHP-FPM y reinicia la cola;
13. levanta la nueva versión.

La base, los adjuntos privados y el `.env` no se reemplazan durante este flujo.
Los usuarios pueden ver una pausa breve mientras se activa el release.

## Verificación posterior

El despliegue no termina operativamente hasta comprobar:

```bash
ops/oci/status.sh --public
curl -I https://materiales.utopiadigital.tech/up
```

El endpoint `/up` debe responder `HTTP 200`. Además, realizar una prueba
funcional con una cuenta autorizada:

1. abrir la pantalla de acceso;
2. iniciar sesión;
3. consultar un vale existente;
4. confirmar que un adjunto privado autorizado se descarga;
5. revisar que el release mostrado por `status.sh` corresponda al commit de
   `main`.

## Migraciones y cambios de datos

Las migraciones nuevas deben ser compatibles con la versión que está activa al
inicio del despliegue. Para cambios destructivos o que reescriban grandes
volúmenes, diseñar una migración por etapas y probarla con una copia aislada.

En producción nunca ejecutar:

```bash
php artisan migrate:fresh
php artisan db:wipe
php artisan migrate --seed
ops/oci/migrate-current-data.sh
```

`migrate-current-data.sh` se utilizó exclusivamente para el primer corte. Volver
a ejecutarlo copiaría la base local sobre producción y podría destruir capturas
nuevas. Tampoco deben repetirse el seeder ni la importación histórica para
actualizar código.

## Respaldos y prueba de restauración

El timer diario empaqueta como una sola unidad lógica:

- un `pg_dump` PostgreSQL en formato personalizado;
- `storage/app/private`;
- hashes SHA-256;
- el commit desplegado;
- un manifiesto de conteos de tablas y archivos.

Los objetos diarios se guardan bajo `daily/` y se eliminan a los 30 días. Los
respaldos previos a un despliegue se guardan bajo `release/` y no forman parte
de esa regla diaria.

La prueba segura de restauración es:

```bash
ops/oci/restore-check.sh
```

El script descarga el respaldo diario más reciente, crea una base temporal con
prefijo `control_materiales_restore_check_`, restaura y valida el contenido, y
elimina esa base al terminar. No sustituye ni modifica la base productiva.

## Fallos y rollback

Si una verificación local falla, el servidor no se modifica. Corregir el cambio,
subir un nuevo commit a `main` y volver a ejecutar el despliegue; no usar
`--skip-checks` como solución habitual.

Si falla la activación remota:

1. no ejecutar seeders ni comandos destructivos;
2. comprobar `ops/oci/status.sh --public`;
3. verificar el estado de `current`, PHP-FPM, la cola y las migraciones;
4. volver al release anterior sólo si sus migraciones son compatibles con el
   esquema actual;
5. si el esquema y los datos deben retroceder, detener la captura y restaurar
   juntos el dump y los adjuntos del mismo respaldo.

Los releases anteriores se conservan en `/srv/control-materiales/releases/`.
Cambiar manualmente el symlink sin revisar compatibilidad de migraciones puede
dejar el código y la base desalineados. Debe tratarse como una intervención de
recuperación, no como el flujo normal.

## Acceso SSH y cambios de IP

SSH está restringido a un CIDR administrativo explícito tanto en la lista de
seguridad de OCI como en UFW. Si la IP pública de la computadora cambia, una
conexión puede terminar en timeout aunque producción continúe funcionando.

Para recuperar acceso se deben actualizar ambos controles: la regla TCP/22 de
la VCN y la regla de UFW en la VM. Esto requiere una sesión temporal de OCI y,
si UFW todavía bloquea la IP nueva, acceso por la consola de la instancia o un
método de contingencia aprobado. No abrir SSH permanentemente a `0.0.0.0/0`.

## Secretos y credenciales

Nunca versionar ni copiar a tickets, documentación o mensajes:

- `.env` productivo;
- contraseña de PostgreSQL o `.pgpass`;
- credenciales JSON de Cloudflare Tunnel;
- tokens de Cloudflare;
- llaves privadas SSH u OCI;
- respaldos, adjuntos o Excel originales;
- valores de secretos de OCI Vault.

Para cambios excepcionales de infraestructura, usar credenciales temporales y
revocarlas al terminar. Un despliegue de aplicación no debe ampliar permisos de
la VM ni requerir credenciales personales de OCI.

## Comandos por finalidad

| Finalidad                   | Comando                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| Publicar `main`             | `ops/oci/deploy.sh`                                                        |
| Revisar servicios y release | `ops/oci/status.sh --public`                                               |
| Probar un respaldo          | `ops/oci/restore-check.sh`                                                 |
| Aprovisionar recursos       | `ops/oci/provision.sh` — sólo infraestructura inicial o recuperación       |
| Configurar el servidor      | `ops/oci/configure-server.sh` — no es un despliegue cotidiano              |
| Copiar la base local        | `ops/oci/migrate-current-data.sh` — sólo primer corte, no repetir          |
| Administrar DNS/certificado | `ops/oci/cloudflare.sh` — requiere token temporal y autorización explícita |
