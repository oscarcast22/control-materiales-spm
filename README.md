# Control de Materiales SPM

Aplicación interna para capturar vales de salida de almacén y comprobar qué material se aplicó, qué se devolvió y qué continúa pendiente. Está construida con Laravel, Inertia, React, TypeScript y PostgreSQL.

## Alcance actual

- Acceso privado con cuentas creadas por consola; el registro público está deshabilitado.
- Captura y edición de entradas y salidas de Almacén o Patio con varios materiales.
- Catálogos de materiales, unidades, personas, programas y acciones.
- Aplicaciones/consumos y devoluciones parciales, con saldo por partida.
- Anulación auditada de movimientos y cancelación controlada de vales.
- Fotos o PDF del vale guardados en almacenamiento privado.
- Consulta, filtros, impresión y exportación XLSX de saldos y movimientos.
- Existencia neta por área desde una fecha de inicio, con ajustes auditados.
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

El corte se aplica al folio completo: un folio con fechas anteriores y posteriores al límite se omite entero para no crear documentos parciales. También se omiten folios sin fecha válida. Cada fila aceptada queda conservada en una tabla de trazabilidad y el mismo archivo no se importa dos veces. Los conflictos o saldos anómalos quedan marcados para revisión.

La importación histórica utiliza OpenSpout por streaming y reutiliza los alias del catálogo depurado, por lo que variantes como abreviaturas o errores ortográficos se relacionan con su registro canónico.

## Cómo se calculan los saldos

- El pendiente de una salida es la cantidad entregada menos lo comprobado como usado y lo devuelto.
- Una entrada independiente aumenta la existencia del área; una salida la disminuye y una devolución la repone.
- El consumo no vuelve a restar existencia porque el material salió físicamente al emitir el vale.
- Cada área comienza en cero desde su fecha de inicio, configurable en Catálogos. Los documentos anteriores siguen consultables, pero no afectan la existencia.
- Una cifra negativa señala falta de una entrada, devolución o ajuste; no se corrige editando el historial.
- Los ajustes requieren motivo y pueden anularse con trazabilidad completa.

La cifra se presenta como **existencia calculada desde el inicio**. No debe considerarse un conteo físico certificado hasta registrar un ajuste basado en un inventario real.

## Modelo de datos

- `storage_locations`: áreas físicas como Almacén y Patio, con su fecha de inicio de control.
- `vouchers`: documento de entrada o salida; el folio es único dentro de cada área.
- `voucher_items`: material, unidad y cantidad documentada en cada renglón.
- `material_dispositions`: comprobaciones de consumo o devoluciones ligadas a una salida.
- `inventory_adjustments`: correcciones positivas o negativas justificadas, sin modificar vales.
- `audit_events`: historial del usuario y valores anteriores/posteriores de operaciones sensibles.
- `legacy_import_rows`: copia trazable de cada renglón leído del Excel histórico.

Las migraciones representan directamente este esquema final. No contienen migraciones transitorias de renombrado o compatibilidad porque el proyecto parte de una base limpia.

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
