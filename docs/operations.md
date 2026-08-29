# Operación, seguridad y recuperación

## Estado actual

El sistema está activo en producción en `https://materiales.utopiadigital.tech`. Producción usa `APP_ENV=production`, `APP_DEBUG=false` y HTTPS. El entorno local conserva su propia base y configuración de desarrollo, funciona sólo mediante localhost y no debe recibir capturas productivas.

La topología, el inventario de recursos y el workflow vigente para publicar cambios desde `main` están documentados en [`docs/infrastructure.md`](infrastructure.md).

Los controles ya presentes incluyen:

- registro público deshabilitado y cuentas creadas por consola;
- contraseña hasheada, rate limiting, correo verificado y cierre de sesión para cuentas inactivas;
- CSRF y cookies HTTP-only/SameSite proporcionados por Laravel;
- dos factores y passkeys opcionales;
- gates/policies en operaciones y descargas;
- adjuntos privados con tipo y tamaño validados;
- transacciones, bloqueos y auditoría para cambios sensibles;
- prohibición de comandos destructivos de base en el entorno de producción;
- pruebas, análisis estático y auditorías de dependencias automatizables.

Estos controles se complementan en producción con la red, los servicios y los respaldos descritos en la guía de infraestructura. Cualquier cambio de exposición, usuarios o alcance requiere una nueva revisión de riesgos.

## Instalación local

```bash
cp .env.example .env
composer install
npm install
php artisan key:generate
php artisan migrate --seed
npm run build
php artisan app:create-user
```

El seeder carga las unidades habituales desde el catálogo versionado. Si el histórico se importa después de este paso, cada material reconocido conserva esa unidad. Para una base donde el histórico ya fue importado con `s/e`, usar primero la simulación y después la aplicación descritas en `docs/data-import.md`; no volver a importar el libro para corregir unidades.

El mismo seeder carga 309 ubicaciones y 7 nombres alternativos útiles para búsqueda y deduplicación. El formulario permite buscar una o varias, crear una nueva sin salir del vale y describir por separado el uso o actividad.

Nelson Treto y Fco. Fierro quedan habilitados inicialmente sólo para entregar material; no aparecen como técnicos que reciben. Cipriano Salas queda como único autorizador y el formulario lo asigna automáticamente mientras sea la única opción activa.

Configure previamente PostgreSQL en `.env`. El comando de usuarios crea una cuenta activa y verificada. No pase la contraseña mediante `--password` en una terminal compartida porque puede quedar en el historial o lista de procesos; utilice el prompt oculto.

## Primera carga de datos en un entorno nuevo

Este apartado documenta una instalación nueva e independiente. No debe
ejecutarse contra la producción vigente, que ya contiene datos operativos. Para
actualizar producción desde `main`, seguir exclusivamente
[`docs/infrastructure.md`](infrastructure.md#workflow-habitual-desde-main).

Con `APP_ENV=production`, después de configurar PostgreSQL y disponer de un respaldo si la base ya existe, cargar primero el esquema y el catálogo versionado:

```bash
php artisan migrate --seed --force
```

`--force` confirma que la migración y el seeder se ejecutan deliberadamente en producción; no sustituye la revisión previa ni autoriza comandos destructivos. Nunca usar `migrate:fresh` o `db:wipe`.

Conservar el Excel fuera del repositorio y simular la única importación histórica permitida:

```bash
php artisan legacy:import-control "/ruta/Captura de vales 2025 (1).xlsx" --dry-run
```

Sólo si el resumen es correcto, ejecutar la carga real:

```bash
php artisan legacy:import-control "/ruta/Captura de vales 2025 (1).xlsx"
```

Verificar finalmente que las partidas reconocidas conservaron su unidad curada:

```bash
php artisan catalog:sync-material-units
```

En una primera carga ordenada debe mostrar cero materiales y cero partidas por actualizar. El importador no crea materiales o personas desconocidos: omite el vale completo, conserva la incidencia en la traza y exige corregir el Excel o el catálogo antes de la carga definitiva. No importa transacciones de 2025 ni meses distintos de agosto de 2026.

Con la fuente actual, la simulación debe mostrar 14 vales listos, un solo inválido (`16576`, sin receptor) y 25 partidas. No ejecutar la carga real hasta corregir ese receptor y obtener 15 vales listos, cero inválidos y 28 partidas.

Los inicios de las series se pueden ajustar antes del despliegue con `VOUCHER_SEQUENCE_START_WAREHOUSE` y `VOUCHER_SEQUENCE_START_YARD`. Los valores iniciales del MVP son `16576` y `3753` respectivamente.

Si el histórico se cargó antes que el catálogo curado, no volver a importar el libro. Respaldar la base, revisar la simulación anterior y seguir el procedimiento con `--apply` de [`docs/data-import.md`](data-import.md#sincronización-de-una-base-ya-importada).

## Checklist antes de producción

- Servidor mantenido y accesible únicamente por HTTPS.
- `APP_ENV=production`, `APP_DEBUG=false` y `APP_URL` con el dominio HTTPS final.
- `SESSION_SECURE_COOKIE=true`; dominio y proxy confiable revisados.
- `APP_KEY`, contraseña de PostgreSQL y secretos únicos almacenados fuera del repositorio.
- Usuario de base con los permisos mínimos necesarios y sin acceso remoto público.
- Disco privado persistente y sin acceso directo desde el servidor web.
- Correo real configurado si se habilitará recuperación de contraseña.
- Al menos dos cuentas administrativas controladas para evitar bloqueo accidental.
- Autenticación de dos factores habilitada cuando el entorno lo permita.
- Límites de tamaño del servidor web compatibles con los 10 MB por adjunto.
- `php artisan optimize` ejecutado después de desplegar.
- Auditorías y suite completa sin fallos.
- Encabezados HSTS, `X-Content-Type-Options`, política de framing y CSP definidos en el proxy según el dominio final.
- Logs persistentes con rotación, permisos restringidos y sin datos sensibles innecesarios.

No deben definirse encabezados de proxy, orígenes de passkeys o dominios de cookies antes de conocer la topología real de despliegue.

## Despliegue en Oracle Cloud

La producción se automatiza con [`ops/oci/`](../ops/oci/README.md). La topología aprobada usa una sola VM Ubuntu ARM con Nginx, PHP-FPM, PostgreSQL local, una IP reservada y un túnel Cloudflare dedicado ejecutado en el VPS. PostgreSQL no se expone en la VCN.

El aprovisionador está limitado a la región principal, `VM.Standard.A1.Flex`, 1 OCPU, 4 GB de memoria y 50 GB de arranque. Si no existe capacidad gratuita se detiene; no sustituye la forma por una pagada. Los identificadores de OCI se conservan en un directorio ignorado por Git.

Cada release debe cumplir estas condiciones:

- `main` limpio y exactamente igual a `origin/main`;
- suite completa, verificaciones frontend y auditorías aprobadas;
- assets construidos localmente con Node 22.13 o posterior;
- paquete creado desde `git archive HEAD`, sin `.env`, adjuntos, dumps, `vendor` ni `node_modules`;
- dependencias PHP instaladas para ARM en el servidor;
- activación mediante symlink, con respaldo previo en despliegues posteriores.

El primer traslado no ejecuta seeders ni el importador histórico. Se pone el origen local en mantenimiento, se crea un `pg_dump` en formato personalizado, se restaura como el usuario limitado de la aplicación, se ejecutan únicamente migraciones pendientes y se comparan conteos de todas las tablas de dominio y archivos privados. Un resultado distinto bloquea el cambio DNS.

Producción usa `materiales.utopiadigital.tech` y un túnel Cloudflare dedicado cuyo conector se ejecuta como servicio en el VPS. El registro productivo es un CNAME proxied hacia ese túnel. El antiguo túnel local fue eliminado; desarrollo se usa únicamente en localhost. Nginx recibe el tráfico del conector por loopback y conserva disponible el certificado Cloudflare Origin CA como alternativa de origen.

Después del corte, Oracle es la única fuente productiva. El entorno local deja de ser candidato de rollback en cuanto exista una escritura nueva en producción.

El inventario completo, los servicios systemd, la estructura de releases y el procedimiento cotidiano de despliegue se mantienen en [`docs/infrastructure.md`](infrastructure.md). No ejecutar `migrate-current-data.sh` durante una actualización normal.

## Respaldo

Respaldar diariamente como una sola unidad lógica:

1. PostgreSQL, mediante `pg_dump` con formato personalizado.
2. `storage/app/private`, que contiene evidencia adjunta.
3. La versión desplegada del código y la referencia segura de sus secretos.

No basta con crear respaldos: probar periódicamente una restauración en un entorno aislado. La restauración debe recuperar primero la base, luego los archivos privados, ejecutar migraciones pendientes y verificar que un adjunto pueda descargarse mediante una cuenta autorizada.

En Oracle, el timer diario genera una unidad con el dump, archivos privados, hashes, commit y manifiesto de conteos. La VM la carga a un bucket privado mediante Instance Principal; no conserva credenciales de usuario OCI. Los respaldos diarios se eliminan a los 30 días y los previos a releases se conservan de forma separada.

La `APP_KEY` productiva se guarda como secreto en OCI Vault con una llave administrada por software. La VM no recibe permiso para leer ese secreto. La restauración aislada automatizada crea una base con prefijo `control_materiales_restore_check_`, valida el dump y elimina exclusivamente esa base temporal.

## Verificación de una versión

```bash
composer test
npm run format:check
npm run types:check
npm run lint:check
npm run build
composer audit --locked --no-interaction
npm audit --omit=dev --audit-level=moderate
```

Registrar la versión del commit, fecha, resultado de migraciones, respaldo previo y responsable del despliegue. La aplicación expone `/up` para una comprobación básica de disponibilidad; no sustituye una prueba funcional de login, consulta y descarga privada.

## Recuperación y rollback

- El código puede volver al commit anterior sólo si sus migraciones siguen siendo compatibles.
- Nunca usar `migrate:fresh` para resolver un despliegue fallido con datos reales.
- Antes de una migración irreversible, crear y verificar un respaldo.
- Si la base y el código quedan desalineados, detener la captura, restaurar el conjunto completo y documentar el incidente.
- Los Excel originales no son un respaldo de la aplicación ni de sus adjuntos.

## Riesgos aceptados del MVP

- Una sola clase de usuario activo puede modificar toda la información operativa.
- La auditoría no tiene todavía una pantalla administrativa ni almacenamiento inmutable externo.
- Los adjuntos no pasan por antivirus; sólo se restringen extensión, MIME y tamaño.
- El despliegue es manual desde una computadora administrativa; todavía no existe CI/CD ni monitoreo externo con alertas.
- El inventario físico no se calcula ni se presenta.

Estos riesgos se aceptan para el piloto productivo actual. Deben revisarse cuando cambien la audiencia, el volumen, la criticidad o la exposición de red.
