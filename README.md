# Control de Materiales SPM

Aplicación interna para capturar vales de salida de almacén y comprobar qué material se aplicó, qué se devolvió y qué continúa pendiente. Está construida con Laravel, Inertia, React, TypeScript y PostgreSQL.

## Documentación

- [`AGENTS.md`](AGENTS.md): reglas y contexto obligatorio para futuras sesiones de desarrollo.
- [`docs/product.md`](docs/product.md): problema, flujo operativo, glosario y alcance del MVP.
- [`docs/architecture.md`](docs/architecture.md): componentes, relaciones de datos e invariantes.
- [`docs/data-import.md`](docs/data-import.md): fuentes históricas, transformación y reconciliación.
- [`docs/operations.md`](docs/operations.md): seguridad, instalación, respaldo y checklist de producción.

El proyecto se encuentra en refinamiento local y todavía no se ha desplegado ni entregado a usuarios.

## Alcance actual

- Acceso privado con cuentas creadas por consola; el registro público está deshabilitado.
- Captura y edición de entradas y salidas de Almacén o Patio con varios materiales.
- Catálogos de materiales, unidades, personas, programas y acciones.
- Aplicaciones/consumos y devoluciones parciales, con saldo por partida.
- Anulación auditada de movimientos y cancelación controlada de vales.
- Fotos o PDF del vale guardados en almacenamiento privado.
- Consulta, filtros, impresión y exportación XLSX del seguimiento de material.
- Resúmenes por material y por técnico de lo entregado, aplicado, devuelto y pendiente desde 2026.
- Catálogos iniciales depurados y versionados; importación separada del historial confiable desde 2026.

## Requisitos

- PHP 8.3 o superior con extensiones habituales de Laravel y `zip`.
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

`php artisan migrate --seed` carga directamente el catálogo inicial incluido en `database/data`; no requiere ningún Excel. Contiene 377 materiales canónicos, sus alias históricos, 45 personas, unidades y las 13 acciones observadas del programa SPM-06.

La depuración fusiona únicamente equivalencias inequívocas y conserva como registros separados los calibres, medidas, potencias, modelos o identidades dudosas. Los nombres originales aceptados quedan como alias. Como las hojas no proporcionan unidades estructuradas confiables, los materiales comienzan con `s/e` hasta que se confirme su unidad habitual.

Después de instalar, entre a **Catálogos** para revisar los 19 nombres de persona que siguen siendo ambiguos. Si corrige un nombre, la forma anterior se conserva como alias; si dos registros representan lo mismo, utilice **Fusionar**.

Los libros `Captura de vales 2025.xlsx` y `Control de vales simplificado - VALIDACIÓN v2.xlsx` ya no son necesarios. El contenido transaccional de 2025 no se importa. Sólo `CONTROL DE ORDEN DE SERVICIO.xlsx` se utiliza una vez si se desea incorporar el historial elegible de 2026. Haga primero una copia intacta y revise sin escribir:

```bash
php artisan legacy:import-control "/ruta/CONTROL DE ORDEN DE SERVICIO.xlsx" --from=2026-01-01 --dry-run
```

Para importarlo:

```bash
php artisan legacy:import-control "/ruta/CONTROL DE ORDEN DE SERVICIO.xlsx" --from=2026-01-01
```

El corte es inclusivo y se aplica por renglón. Si un folio contiene filas anteriores y posteriores al límite, sólo se importa su parte válida y el vale queda marcado para revisión. Las filas sin fecha únicamente se importan cuando ésta puede inferirse de un comentario inequívoco de 2026; las demás se conservan como no resueltas sin inventar un vale. Cada fila considerada queda guardada en la tabla de trazabilidad y el mismo archivo no se importa dos veces.

La importación histórica utiliza OpenSpout por streaming, lee directamente los comentarios internos de las columnas `REPORTE 1` a `REPORTE 10` y reutiliza los alias del catálogo depurado. Una fecha de aplicación sólo se acepta si tiene un formato inequívoco y corresponde a 2026; en caso contrario se usa la fecha del vale, se conserva el comentario original y se registra el motivo de revisión. Desde el detalle del vale se pueden consultar estas incidencias y marcar la revisión como atendida con auditoría.

Antes de escribir, el comando valida la estructura del libro, calcula todos los resultados y comprueba que ningún folio choque con los ya capturados. La importación efectiva es transaccional: ante cualquier error no se conserva una carga parcial. No utilice este comando mediante un seeder ni ejecute `migrate:fresh` para cargar el historial.

## Cómo se calculan los saldos

- El pendiente de una salida es la cantidad entregada menos lo comprobado como usado y lo devuelto.
- El seguimiento incluye únicamente vales de salida activos emitidos desde el 1 de enero de 2026; las entradas y los vales cancelados no generan responsabilidad para un técnico.
- Una cifra positiva es material que todavía debe aplicarse en un trabajo o devolverse. La aplicación no intenta anticipar cuál de las dos acciones ocurrirá.
- Una cifra negativa indica que se comprobó más de lo entregado y se muestra como inconsistencia.
- Las cantidades se agregan exclusivamente por material y unidad; no se genera un total que mezcle piezas, metros u otros artículos.
- Las devoluciones históricas permanecen en cero cuando el documento original no las identifica; no se infieren datos faltantes.

La aplicación no presenta estos saldos como existencias de almacén. Conocer el inventario físico requeriría una existencia inicial y el registro completo de entradas, información que no forma parte del flujo actual.

## Modelo de datos

- `storage_locations`: áreas físicas como Almacén y Patio, con su fecha de inicio de control.
- `vouchers`: documento de entrada o salida; el folio es único dentro de cada área.
- `voucher_items`: material, unidad y cantidad documentada en cada renglón.
- `material_dispositions`: comprobaciones de consumo o devoluciones ligadas a una salida.
- `inventory_adjustments`: correcciones positivas o negativas justificadas, sin modificar vales.
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
