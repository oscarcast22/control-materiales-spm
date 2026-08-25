# Operación, seguridad y recuperación

## Estado actual

El sistema está en desarrollo local y todavía no se ha entregado a usuarios. `APP_ENV=local`, `APP_DEBUG=true` y HTTP son apropiados únicamente para este entorno. No copiar esa configuración a un servidor.

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

Esto es adecuado para desarrollo y un futuro piloto controlado. No constituye por sí solo un despliegue seguro en Internet.

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

Configure previamente PostgreSQL en `.env`. El comando de usuarios crea una cuenta activa y verificada. No pase la contraseña mediante `--password` en una terminal compartida porque puede quedar en el historial o lista de procesos; utilice el prompt oculto.

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

## Respaldo

Respaldar diariamente como una sola unidad lógica:

1. PostgreSQL, mediante `pg_dump` con formato personalizado.
2. `storage/app/private`, que contiene evidencia adjunta.
3. La versión desplegada del código y la referencia segura de sus secretos.

No basta con crear respaldos: probar periódicamente una restauración en un entorno aislado. La restauración debe recuperar primero la base, luego los archivos privados, ejecutar migraciones pendientes y verificar que un adjunto pueda descargarse mediante una cuenta autorizada.

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
- No hay monitoreo ni despliegue automatizado porque todavía no existe un entorno de producción.
- El inventario físico no se calcula ni se presenta.

Estos riesgos son aceptables durante el refinamiento local. Deben revisarse cuando cambien la audiencia o la exposición de red.
