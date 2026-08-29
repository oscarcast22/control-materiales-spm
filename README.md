# Control de Materiales SPM

Aplicación interna para capturar vales de salida de almacén y comprobar qué material se aplicó y qué continúa pendiente. Está construida con Laravel, Inertia, React, TypeScript y PostgreSQL.

## Documentación

- [`AGENTS.md`](AGENTS.md): reglas y contexto obligatorio para futuras sesiones de desarrollo.
- [`docs/product.md`](docs/product.md): problema, flujo operativo, glosario y alcance del MVP.
- [`docs/architecture.md`](docs/architecture.md): componentes, relaciones de datos e invariantes.
- [`docs/data-import.md`](docs/data-import.md): fuentes históricas, transformación y reconciliación.
- [`docs/operations.md`](docs/operations.md): seguridad, instalación, respaldo y checklist de producción.
- [`docs/infrastructure.md`](docs/infrastructure.md): infraestructura productiva, despliegue desde `main`, verificación y recuperación.

La aplicación está desplegada en producción en `https://materiales.utopiadigital.tech`. El desarrollo se realiza únicamente en localhost; no existe un túnel público de desarrollo.

## Alcance actual

- Acceso privado con cuentas creadas por consola; el registro público está deshabilitado.
- Captura y edición de entradas y salidas de Almacén o Patio con varios materiales.
- Catálogos organizados en Personas, Materiales —con sus unidades habituales—, Ubicaciones y una sección conjunta de Programas y acciones. Almacén y Patio son tipos estructurales fijos.
- Aplicaciones parciales o en bloque, con saldo por partida.
- Anulación auditada de movimientos, registro mínimo y corrección de folios físicos prestados, y cancelación controlada de vales.
- Fotos o PDF del vale guardados en almacenamiento privado.
- Consulta, filtros, impresión y exportación XLSX del seguimiento de material.
- Resúmenes por material y por técnico de lo entregado, aplicado y pendiente desde 2026.
- Resumen operativo centrado en vales con saldo, partidas por comprobar y técnicos con pendientes; los vales liquidados y las incidencias permanecen accesibles sin competir con esas prioridades.
- Catálogos iniciales depurados y versionados; importación separada de agosto de 2026.

## Requisitos

- PHP 8.4 o superior con extensiones habituales de Laravel y `zip`.
- Composer 2.
- Node.js 22 o superior y npm.
- PostgreSQL 15 o superior.

## Instalación

```bash
cp .env.example .env
composer install
npm install
php artisan key:generate
```

Cree la base y un usuario de PostgreSQL, y luego ajuste `DB_DATABASE`, `DB_USERNAME` y `DB_PASSWORD` en `.env`. Después ejecute:

```bash
php artisan migrate --seed
npm run build
php artisan app:create-user
```

El último comando solicita nombre, correo y contraseña y crea una cuenta activa con correo verificado. Para desarrollo local:

```bash
composer dev
```

## Catálogos iniciales e histórico

`php artisan migrate --seed` carga directamente el catálogo inicial incluido en `database/data`; no requiere ningún Excel. Contiene 843 materiales canónicos asignados explícitamente a Almacén, Patio o ambos, 309 ubicaciones reutilizables, 7 nombres alternativos, 44 personas, unidades, el programa SPM-06 y la acción SPM-06-01.

La depuración fusiona únicamente equivalencias inequívocas y conserva como registros separados los calibres, medidas, potencias, modelos o identidades dudosas. Los nombres originales aceptados quedan como alias. El catálogo versiona los textos descriptivos de las columnas de Almacén y Patio; la fila numérica situada encima de los materiales de Almacén se ignora. Las unidades se infieren sólo para presentaciones explícitas o familias previamente uniformes. Hay 199 materiales con `s/e`; los 176 agregados desde el libro sin unidad inferible quedan marcados para revisión.

Los 527 textos normalizados de la columna Destino se conservan en un mapeo versionado. Los lugares reutilizables alimentan el catálogo de ubicaciones; las actividades o usos permanecen como descripción libre. Las abreviaturas históricas de actividades, como `Mto.`, `Mnto.` y `Mtno.`, se separan del nombre del lugar y se conservan únicamente como actividad. Un vale puede seleccionar varias ubicaciones y agregar una descripción cuando el documento mezcla ambos conceptos.

Después de instalar, entre a **Catálogos** para revisar los 18 nombres de persona que siguen siendo ambiguos. Nelson Treto y Fco. Fierro aparecen sólo como entregadores; Cipriano Salas se asigna automáticamente como autorizador mientras sea la única opción activa.

La única fuente transaccional autorizada es `Captura de vales 2025 (1).xlsx`, siempre fuera del repositorio. Sólo se leen las hojas de Almacén y Patio y únicamente los renglones de agosto de 2026. Haga primero una copia intacta y revise sin escribir:

```bash
php artisan legacy:import-control "/ruta/Captura de vales 2025 (1).xlsx" --dry-run
```

Para importarlo:

```bash
php artisan legacy:import-control "/ruta/Captura de vales 2025 (1).xlsx"
```

Cada renglón se valida como una unidad. Un vale activo con datos o catálogos sin resolver se omite por completo y queda trazado para corregir la fuente. Los cancelados se guardan como vales mínimos para reservar el folio, sin crear responsabilidad; los préstamos históricos mínimos también se conservan. Antes de escribir, el comando comprueba conflictos de folio y la carga efectiva es transaccional. Con el archivo actual la simulación esperada es 15 renglones, 14 vales listos (2 cancelados, 1 prestado), 1 inválido por receptor ausente y 25 partidas. Consulte [`docs/data-import.md`](docs/data-import.md) para la reconciliación completa.

## Cómo se calculan los saldos

- El pendiente de una salida es la cantidad entregada menos lo documentado como aplicado.
- El seguimiento incluye únicamente vales de salida activos emitidos desde el 1 de enero de 2026; las entradas y los vales prestados o cancelados no generan responsabilidad para un técnico.
- Una cifra positiva es material que todavía debe documentarse como aplicado en un trabajo.
- Una cifra negativa indica que se comprobó más de lo entregado y se muestra como inconsistencia.
- Las cantidades se agregan exclusivamente por material y unidad; no se genera un total que mezcle piezas, metros u otros artículos.

La aplicación no presenta estos saldos como existencias de almacén. Conocer el inventario físico requeriría una existencia inicial y el registro completo de entradas, información que no forma parte del flujo actual.

## Modelo de datos

- `storage_locations`: implementación interna de los tipos de vale Almacén y Patio.
- `material_storage_location`: disponibilidad estricta de cada material por tipo de vale.
- `destinations` y `destination_aliases`: ubicaciones canónicas y variantes históricas reconocidas.
- `destination_voucher`: relación que permite asociar uno o varios lugares al mismo vale.
- `vouchers`: documento de entrada o salida; el folio es único dentro de cada tipo.
- `voucher_items`: cantidad entregada y referencias al material y unidad canónicos; su descripción se sincroniza para búsqueda y presentación.
- `material_application_reports`: encabezado y evidencia opcional de una aplicación capturada en bloque.
- `material_applications`: cantidades aplicadas a las partidas de un vale.
- `inventory_adjustments`: infraestructura reservada para un posible inventario físico; no tiene rutas ni interfaz activas.
- `audit_events`: historial del usuario y valores anteriores/posteriores de operaciones sensibles.
- `legacy_import_rows`: copia trazable de cada renglón leído del Excel histórico.

Las migraciones representan directamente este esquema final. No contienen migraciones transitorias de renombrado o compatibilidad porque el proyecto parte de una base limpia.

Las estructuras de inventario físico se conservan como infraestructura reservada, pero sus pantallas y operaciones no se exponen. Sólo deberán activarse si en el futuro se dispone de existencias iniciales y movimientos completos de almacén.

## Verificación

```bash
composer test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

## Operación y respaldo

- Sirva únicamente el directorio `public/` mediante HTTPS.
- Mantenga `APP_DEBUG=false` en producción.
- Ejecute `php artisan optimize` al desplegar.
- Respalde diariamente PostgreSQL y `storage/app/private`; ambos son necesarios para una restauración completa.
- Pruebe periódicamente la restauración de esos respaldos en un entorno separado.
- No publique ni copie los Excel originales al repositorio.
- Mantenga privado el repositorio: el catálogo versionado contiene nombres del personal que aparece en los documentos internos.

La primera versión contempla un solo nivel de permisos para todas las cuentas activas. Las altas se controlan por consola para evitar registros no autorizados.
