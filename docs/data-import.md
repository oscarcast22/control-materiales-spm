# Catálogos e importación de agosto de 2026

## Fuente autorizada

La única fuente transaccional es `Captura de vales 2025 (1).xlsx`, conservada fuera del repositorio. Aunque el nombre menciona 2025, el importador sólo considera fechas de agosto de 2026 en las hojas `Vale de Almacen` y `Vale de Patio`. Ignora `Vale papeleria)` y cualquier otro mes o año.

No se importan transacciones de 2025, aplicaciones de material, existencias ni datos de subdirección o departamento.

## Catálogos previos

Antes de simular la carga deben existir:

- los tipos de vale Almacén (`warehouse`) y Patio (`yard`);
- materiales, unidades, alias y su disponibilidad por tipo de vale, todos versionados;
- personas y alias, con funciones separadas para recibir, entregar y autorizar;
- ubicaciones, alias y el mapeo versionado de textos históricos de destino;
- el programa SPM-06 y la acción SPM-06-01.

Nelson Treto y Fco. Fierro están habilitados únicamente para entregar. Cipriano Salas es el único autorizador inicial. El importador no crea personas, materiales, programas o acciones a partir de texto desconocido.

Los nombres de materiales proceden de los textos de la fila que contiene `FOLIO` y `ENTREGO MATERIAL`. Los valores numéricos de la fila superior de `Vale de Almacen` no son nombres, códigos ni unidades y se ignoran por completo. El seeder usa exclusivamente el JSON versionado resultante; nunca abre el Excel.

Los 527 textos normalizados encontrados en la columna Destino de ambas hojas, incluidos los de años que no se importan, se clasificaron una sola vez. Produjeron 309 ubicaciones canónicas y un mapeo que separa lugares de descripciones de uso; 70 frases ambiguas permanecen marcadas para revisión. Esta extracción no importa transacciones de 2025.

Los prefijos `Mto.`, `Mnto.` y `Mtno.` se interpretan como mantenimiento, no como parte del lugar. Lo mismo ocurre con actividades inequívocas como fortalecimiento, fabricación, reportes o alumbrado. Las abreviaturas geográficas (`Col.`, `Fracc.`, `Av.`, `Blvd.` y `Pob.`) y las abreviaturas de nombres propios (`Fco.`, `Gral.` y `Priv.`) sí se conservan. Una frase ambigua permanece como descripción y se marca para revisión en vez de crear una ubicación dudosa.

Los textos completos que mezclan actividad y lugar se reconocen exclusivamente mediante el mapeo histórico; no se agregan como alias de la ubicación. Los alias quedan reservados para abreviaturas, nombres alternativos, errores históricos reconocidos y nombres anteriores. Tampoco se crea un alias idéntico al nombre canónico.

## Procedimiento

Conservar una copia intacta del libro fuera del repositorio y ejecutar primero:

```bash
php artisan legacy:import-control "/ruta/Captura de vales 2025 (1).xlsx" --dry-run
```

La simulación analiza el libro y consulta los catálogos sin escribir. Si el resumen no presenta vales activos omitidos inesperadamente, ejecutar:

```bash
php artisan legacy:import-control "/ruta/Captura de vales 2025 (1).xlsx"
```

No ejecutar el importador desde un seeder. La escritura real es transaccional y la huella del archivo evita cargar dos veces el mismo contenido.

## Reglas de transformación

- Cada renglón de agosto representa un vale y se importa de forma atómica.
- Una salida o entrada requiere folio, fecha, movimiento reconocido, al menos una ubicación o descripción de uso, receptor, entregador y al menos un material resuelto.
- Si falta un dato o una referencia de catálogo, no se crea ninguna parte del vale. El renglón queda en `legacy_import_rows` con sus incidencias.
- Los renglones `CANCELADO` crean un vale mínimo sin personas, destino ni materiales. Reservan el folio y no crean responsabilidad operativa.
- Un renglón `Prestado` puede crear un vale histórico mínimo con folio, fecha y nombre libre de quien lo tiene. No inventa movimiento, personas ni materiales ausentes.
- Sólo los vales de Almacén interpretan programa y acción. Sus valores numéricos se normalizan como códigos completos; por ejemplo, `6` y `1` se resuelven como SPM-06 y SPM-06-01. Los vales de Patio ignoran esas columnas y guardan ambos campos en `null`.
- Una frase puede asociar varias ubicaciones y una actividad. Los ocho destinos de agosto están mapeados explícitamente; un texto no clasificado se conserva completo como descripción y marca el vale para revisión.
- Almacén y Patio mantienen series de folio independientes. Un conflicto existente aborta antes de escribir trazas o vales.
- No se crean aplicaciones: todo material válido comienza con pendiente igual a entregado.

## Preparación de la carga definitiva

Corregir en el Excel fuente los vales activos omitidos y volver a ejecutar `--dry-run`. Los nombres no resueltos deben asociarse de forma explícita en Catálogos o corregirse en el archivo; no se aceptan registros provisionales.

Al finalizar, revisar:

- cantidad de renglones de agosto detectados;
- vales listos, prestados, cancelados listos e inválidos omitidos;
- que cada fila inválida muestre una causa comprensible;
- que no existan conflictos de folio;

Con el libro recibido el resultado de referencia es: 15 renglones de agosto, 14 vales listos (2 cancelados y 1 prestado), 1 activo inválido omitido y 25 partidas listas. El único pendiente es el folio `16576`, que no indica quién recibió el material.

- que la base siga sin aplicaciones importadas.

La importación real se hará únicamente cuando el folio `16576` tenga un receptor válido y el archivo corregido produzca 15 vales listos, cero inválidos y 28 partidas.
