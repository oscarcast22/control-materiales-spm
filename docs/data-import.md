# Catálogos e importación histórica

## Fuentes recibidas

| Archivo | Uso decidido |
| --- | --- |
| `Captura de vales 2025.xlsx` | Contexto para depurar catálogos. Sus transacciones no se importan. |
| `CONTROL DE ORDEN DE SERVICIO.xlsx` | Única fuente de transacciones históricas aceptadas desde 2026. |
| `Control de vales simplificado - VALIDACIÓN v2.xlsx` | Prototipo sustituido por la aplicación; no se usa para cargar producción. |

Los catálogos depurados ya están versionados en `database/data/materials.json` y `database/data/people.json`. Una instalación nueva no necesita los tres libros para cargar catálogos.

## Catálogo versionado

- 377 materiales canónicos.
- 45 personas, de las cuales 19 requieren revisión humana.
- Siete unidades y 13 acciones observadas del programa SPM-06.
- Alias para conservar variantes ortográficas inequívocas.

Los calibres, medidas, potencias, modelos o identidades dudosas no se fusionan automáticamente. Los materiales comienzan con unidad `s/e` cuando el libro no permite determinarla con seguridad.

Las unidades habituales también forman parte del catálogo versionado. La curación conservadora actual contiene 303 materiales en pieza, 28 en metro, 4 en kilogramo, 2 en metro cúbico, 7 en rollo y 4 en juego; 29 materiales conservan `s/e` porque el nombre no distingue con seguridad entre litro, envase, paquete, bulto u otra presentación. El seeder sólo reemplaza una unidad `s/e`: nunca sobrescribe una corrección manual ya especificada.

## Comando

Siempre conservar una copia intacta del libro fuera del repositorio. Primero ejecutar:

```bash
php artisan legacy:import-control "/ruta/CONTROL DE ORDEN DE SERVICIO.xlsx" --from=2026-01-01 --dry-run
```

Sólo después de revisar el resumen, ejecutar sin `--dry-run`:

```bash
php artisan legacy:import-control "/ruta/CONTROL DE ORDEN DE SERVICIO.xlsx" --from=2026-01-01
```

No ejecutar el importador desde un seeder. En producción, migrar y cargar catálogos antes de importar el histórico.

Después de una primera carga ordenada, verificar con:

```bash
php artisan catalog:sync-material-units
```

El resultado esperado es cero materiales y cero partidas por actualizar. Los materiales nuevos que no pertenecen al catálogo pueden permanecer en `s/e` y marcados para revisión.

Al resolver un material conocido, el importador copia su unidad habitual a la partida. Un nombre nuevo o no resuelto conserva `s/e` y queda marcado para revisión.

## Sincronización de una base ya importada

Para revisar cuántos materiales y partidas históricas siguen en `s/e`, ejecutar sin opciones:

```bash
php artisan catalog:sync-material-units
```

La simulación no escribe. Después de revisar el resumen y disponer de respaldo, aplicar con:

```bash
php artisan catalog:sync-material-units --apply
```

La sincronización sólo modifica unidades `s/e` de materiales versionados y partidas vinculadas mediante `legacy_import_rows`. No cambia cantidades, aplicaciones, devoluciones ni saldos; conserva unidades previamente corregidas y registra auditoría por cada actualización.

## Reglas de transformación

- El corte es inclusivo y se evalúa por renglón.
- Si un folio combina fechas anteriores y posteriores, sólo se acepta la parte desde 2026 y el vale queda marcado para revisión.
- Una fila sin fecha sólo se importa si un comentario permite inferir inequívocamente una fecha de 2026.
- Los comentarios internos de `REPORTE 1` a `REPORTE 10` pueden aportar fechas y contexto.
- Una fecha ambigua no se inventa: se conserva el comentario, se usa la fecha documentada del vale cuando corresponde y se registra el motivo de revisión.
- Los nombres se resuelven primero contra catálogos y alias canónicos.
- Un folio conflictivo con datos ya capturados aborta la carga antes de escribir.
- La escritura completa es transaccional.
- `source_hash`, hoja y número de fila impiden importar dos veces el mismo contenido.
- Cada fila considerada queda en `legacy_import_rows`, incluso cuando no pudo producir un registro operativo.

## Estado local verificado

Instantánea del 25 de agosto de 2026 después de la importación actual:

| Dato | Cantidad |
| --- | ---: |
| Vales | 216 |
| Vales activos | 203 |
| Vales cancelados | 13 |
| Partidas | 619 |
| Aplicaciones/devoluciones | 775 |
| Filas trazadas | 636 |
| Filas no resueltas | 4 |
| Vales pendientes de revisión | 127 |
| Personas después de importar | 47 |

Estas cifras son una referencia de reconciliación del libro utilizado, no una constante del sistema. Las 47 personas locales incluyen dos registros creados durante la importación; el catálogo base continúa teniendo 45.

El seguimiento derivado de la misma base contiene 203 vales entregados: 94 pendientes, 107 liquidados y 2 inconsistentes; hay 192 partidas y 16 técnicos con pendientes.

## Revisión posterior

- Corregir nombres ambiguos desde Catálogos; el nombre anterior queda como alias.
- Fusionar sólo duplicados confirmados.
- Revisar en cada vale las razones conservadas por el importador.
- Marcar una revisión como atendida únicamente después de comprobar el documento fuente.
- No corregir inconsistencias eliminando trazabilidad o reduciendo cantidades sin evidencia.
