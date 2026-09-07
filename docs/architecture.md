# Arquitectura y modelo de datos

## Vista general

La aplicación es un monolito Laravel con páginas Inertia y React. No existe una API pública separada.

```text
Navegador React/TypeScript
        │ Inertia + formularios HTTP
        ▼
Rutas web protegidas por sesión, CSRF y correo verificado
        ▼
Controladores Laravel ── políticas, validación y transacciones
        ▼
Servicios de dominio y modelos Eloquent
        ▼
PostgreSQL + almacenamiento privado de adjuntos
```

- Laravel controla autenticación, autorización, validación, transacciones y descarga privada.
- React renderiza formularios, catálogos, detalle de vales, dashboard y seguimiento.
- PostgreSQL conserva documentos, movimientos, catálogos, auditoría y trazabilidad de importación.
- OpenSpout se utiliza para leer y generar XLSX sin cargar libros completos en memoria.

## Servicios de dominio

- `Normalizer`: genera claves comparables para folios, materiales, ubicaciones y personas.
- `VoucherSequence`: detecta huecos numéricos por tipo a partir de los inicios configurados. Las trazas inválidas pueden extender el último folio observado, pero nunca cuentan como folios presentes.
- `VoucherData`: construye el contrato de presentación de un vale y calcula los estados de sus partidas.
- `Voucher::visibleTo(User)`: conserva todos los vales para administradores y limita al técnico a salidas activas propias desde el corte de 2026.
- `MaterialTracking`: aplica el corte de 2026 y agrega partidas por material/unidad o por técnico.
- `CatalogIndexData`: valida la sección y los filtros de Catálogos, limita las consultas a los datos visibles y construye su navegación y paginación.
- `LegacyControlWorkbook`: lee únicamente las hojas de Almacén y Patio y selecciona agosto de 2026.
- `ImportLegacyControl`: valida, prepara y escribe la importación histórica dentro de una transacción.

La pantalla y el XLSX de seguimiento consumen el mismo agregador para evitar resultados divergentes.

Las consultas de vales y seguimiento comparten el mismo alcance por tipo de vale. El parámetro `voucher_type_id` acepta un identificador activo o `all`; cuando se omite, el sistema usa Almacén (`warehouse`). El frontend conserva este alcance en ordenamiento, paginación, enlaces de detalle y exportación, y actualiza los resultados mediante visitas parciales de Inertia. El resumen no acepta este filtro: siempre agrega Almacén y Patio en un panorama general.

Vales, Mis vales, Seguimiento y su exportación aceptan el parámetro textual `search`. La búsqueda localiza vales completos por folio u orden de servicio vigente; Seguimiento además busca técnico receptor, destino, descripción de actividad o material. El selector rápido reutiliza el alcance de folio u orden y conserva sus filtros de salida activa con saldo pendiente. Las aplicaciones anuladas no producen coincidencias.

Catálogos acepta `section=people|materials|destinations|programs` y abre Personas cuando el parámetro falta o es inválido. Personas, Materiales y Ubicaciones se consultan en páginas de 25 registros; el programa fijo, las acciones y los indicadores se presentan juntos. `search`, `status` y `review` se aplican en el servidor, con `role` exclusivo de Personas y `voucher_type_id` exclusivo de Materiales. La búsqueda de nombres usa claves normalizadas y alias. Los cambios de filtro y página reemplazan únicamente las props `catalog` y `filters` mediante visitas parciales de Inertia; las unidades y tipos de vale sólo se cargan para la sección que los necesita.

## Relaciones principales

```mermaid
erDiagram
    USERS ||--o{ VOUCHERS : creates_updates
    PEOPLE ||--o| USERS : technical_account
    STORAGE_LOCATIONS ||--o{ VOUCHERS : contains
    PEOPLE ||--o{ VOUCHERS : receives_delivers_authorizes
    PROGRAMS ||--o{ VOUCHERS : classifies
    PROGRAMS ||--o{ ACTIONS : contains
    ACTIONS ||--o{ VOUCHERS : classifies
    ACTIONS ||--|{ ACTION_INDICATORS : defines
    ACTION_INDICATORS ||--o{ VOUCHERS : classifies
    DESTINATIONS }o--o{ VOUCHERS : locates
    VOUCHERS ||--|{ VOUCHER_ITEMS : contains
    MATERIALS ||--o{ VOUCHER_ITEMS : identifies
    UNITS ||--o{ VOUCHER_ITEMS : measures
    VOUCHERS ||--o{ MATERIAL_APPLICATION_REPORTS : documents
    MATERIAL_APPLICATION_REPORTS ||--o{ MATERIAL_APPLICATIONS : groups
    VOUCHER_ITEMS ||--o{ MATERIAL_APPLICATIONS : accounts
    VOUCHERS ||--o{ VOUCHER_ATTACHMENTS : evidences
    MATERIALS ||--o{ MATERIAL_ALIASES : recognizes
    PEOPLE ||--o{ PERSON_ALIASES : recognizes
    DESTINATIONS ||--o{ DESTINATION_ALIASES : recognizes
    USERS ||--o{ AUDIT_EVENTS : performs
    VOUCHERS ||--o{ LEGACY_IMPORT_ROWS : traces
```

## Diccionario resumido

| Tabla                          | Responsabilidad                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                        | Cuentas autorizadas con rol fijo, usuario opcional, correo opcional y vínculo único a persona para técnicos. `is_active` bloquea inmediatamente el acceso.                                                                            |
| `storage_locations`            | Configuración estructural de los tipos de vale Almacén y Patio; no expone rutas de administración.                                                                                                                                    |
| `material_storage_location`    | Relación editable que limita qué materiales se pueden capturar en cada tipo de vale.                                                                                                                                                  |
| `units`                        | Unidad estructurada usada para cantidades; `decimal_places` distingue las unidades enteras de las que admiten fracciones de hasta tres posiciones.                                                                                  |
| `materials`                    | Catálogo canónico; conserva unidad habitual y bandera de revisión.                                                                                                                                                                    |
| `material_aliases`             | Variantes históricas que apuntan al material canónico.                                                                                                                                                                                |
| `people`                       | Técnicos y personal; sus banderas indican quién recibe, entrega o autoriza.                                                                                                                                                           |
| `person_aliases`               | Escrituras alternativas de una misma persona.                                                                                                                                                                                         |
| `programs`                     | Programa fijo de toda salida activa, de Almacén o Patio, inicialmente SPM-06.                                                                                                                                                         |
| `actions`                      | Las 17 acciones oficiales subordinadas al programa fijo SPM-06.                                                                                                                                                                       |
| `action_indicators`            | Los 21 indicadores oficiales; cada acción tiene uno o dos y conserva código y nombre breve.                                                                                                                                           |
| `destinations`                 | Ubicaciones geográficas reutilizables, activables y normalizadas.                                                                                                                                                                     |
| `destination_aliases`          | Abreviaturas, nombres alternativos o anteriores que apuntan a una ubicación canónica; nunca contienen actividades.                                                                                                                    |
| `destination_voucher`          | Relación de una o varias ubicaciones con cada vale.                                                                                                                                                                                   |
| `vouchers`                     | Cabecera del documento, estado, revisión y responsables.                                                                                                                                                                              |
| `voucher_items`                | Cantidad entregada o prestada, según el estado del vale, y referencias al material y unidad canónicos; la descripción se mantiene sincronizada para búsquedas y presentación.                                                         |
| `material_application_reports` | Agrupa una aplicación capturada en bloque: fecha, tipo y número de orden de servicio, ubicación o dirección libre, detalles comunes, desglose de materiales y evidencia opcional. Los históricos pueden conservar orden y tipo nulos. |
| `material_applications`        | Cantidad aplicada a una partida; una anulación conserva fecha, usuario y motivo.                                                                                                                                                      |
| `voucher_attachments`          | Metadatos de evidencia guardada en almacenamiento privado.                                                                                                                                                                            |
| `audit_events`                 | Valores anteriores y posteriores de operaciones sensibles.                                                                                                                                                                            |
| `legacy_import_rows`           | Copia del renglón original, incidencias y vínculo al registro importado.                                                                                                                                                              |
| `inventory_adjustments`        | Infraestructura reservada de inventario físico; no tiene rutas activas.                                                                                                                                                               |

## Invariantes

- `vouchers(storage_location_id, folio_key)` es único. `folio_key` deriva del folio normalizado.
- Las cantidades se almacenan con decimal de tres posiciones por compatibilidad de datos. Cada unidad restringe las capturas nuevas a enteros o a un máximo de tres decimales; Metro y Litro admiten fracciones y la interfaz sugiere un decimal. Las cantidades deben ser positivas, salvo el cero usado para anular una aplicación desde su edición.
- Una aplicación nueva requiere tipo y número de orden de servicio y no puede superar el pendiente; las partidas se bloquean durante la transacción para evitar carreras. Los tipos se validan contra un enum extensible que inicialmente ofrece Normal y 072; la columna se conserva como texto para permitir nuevas opciones mediante cambios de aplicación sin alterar el esquema.
- Una aplicación anulada deja de afectar las sumas, pero permanece auditable. Corregir una cantidad requiere motivo, anula el valor anterior y crea su reemplazo dentro del mismo grupo de aplicación.
- Una partida con aplicaciones vigentes no puede cambiar de material, cantidad ni eliminarse; primero se anulan las aplicaciones con motivo.
- La unidad de cada partida siempre deriva de la unidad predeterminada del material. Corregir el nombre o la unidad canónica del material se propaga a todos sus vales, conserva la cantidad numérica y deja auditoría.
- No se puede reducir la precisión de una unidad ni cambiar un material a una unidad entera cuando sus partidas, aplicaciones o ajustes relacionados contienen fracciones incompatibles; nunca se redondean para permitir el cambio.
- Los códigos y relaciones de SPM-06, acciones e indicadores son inmutables; acciones e indicadores sólo permiten corregir nombre y estado.
- No se puede desactivar una unidad usada por materiales activos, la última persona activa para una función necesaria, la última acción disponible ni el último indicador de una acción activa.
- Un registro de catálogo sólo se elimina si no referencia vales ni otras dependencias que perderían información: unidades no usadas por materiales, partidas o ajustes reservados, y personas que no sean la última persona activa para una función necesaria. El programa SPM-06, sus acciones e indicadores no se eliminan desde la aplicación; únicamente se corrigen sus nombres y estados. La eliminación permitida deja auditoría y la base restringe las referencias históricas.
- Un vale con aplicaciones vigentes no puede cancelarse. Después de anularlas con motivo, el vale puede cancelarse con una razón opcional; la operación siempre conserva fecha, usuario y auditoría.
- Un cancelado mínimo puede crearse sin movimiento, personas, destino ni partidas para conservar la serie física.
- Las partidas de una salida cancelada se conservan sin alterar `quantity` ni el cálculo histórico `pendiente = entregado - aplicado`; la interfaz las clasifica como material sin usar y el estado cancelado excluye el vale de la responsabilidad operativa. Esta clasificación no crea entradas, devoluciones ni ajustes de inventario.
- Un prestado conserva tipo, folio y fecha; puede asociar opcionalmente un técnico, un nombre libre de persona responsable y partidas de material. No se deriva de un vale operativo, no admite aplicaciones y sus partidas no generan saldo.
- Un vale operativo requiere al menos una ubicación o una descripción de uso o actividad; ambas pueden coexistir.
- Toda salida activa de Almacén o Patio conserva `program_id`, `action_id` y `action_indicator_id`. El programa es siempre SPM-06; el indicador debe pertenecer a la acción. Entradas, cancelados y prestados conservan los tres campos en `null`.
- La ubicación o dirección de una aplicación es texto libre opcional e independiente del destino del vale. El catálogo de ubicaciones sólo aporta sugerencias de llenado y una aplicación nunca crea registros en él.
- La continuidad numérica inicia por defecto en Almacén `16576` y Patio `3753`; los inicios se configuran por entorno.
- Sólo las salidas activas desde `2026-01-01` alimentan el seguimiento. Entradas, prestados y cancelados quedan fuera.
- Las agregaciones cuantitativas se separan por `material_id` y `unit_id`.
- El total abstracto de “materiales” mostrado en las filas resumidas de Vales y Seguimiento es una ayuda visual acompañada siempre por el desglose de partidas. `VoucherData` expone los totales de cada vale para la tabla general; Seguimiento los calcula en el frontend sobre las partidas filtradas. Ninguno forma parte de agregaciones contables por material/unidad ni del XLSX.
- Los adjuntos residen en el disco privado y sólo se descargan después de autorizar el vale.
- Una cuenta técnica requiere `person_id` único, persona activa y función `can_receive_material`. Esa función y el estado de la persona no pueden retirarse mientras exista el vínculo.

## Estados derivados

```text
partida pendiente     pendiente > 0
partida liquidada     pendiente = 0
partida inconsistente pendiente < 0

vale inconsistente    alguna partida inconsistente
vale pendiente        ninguna inconsistente y alguna pendiente
vale liquidado        todas sus partidas liquidadas
```

Las entradas usan el estado informativo `received`. Los vales cancelados usan `cancelled` y los prestados usan `loaned`; ambos reservan numeración y quedan fuera del seguimiento operativo. Los prestados asignados aparecen como consulta en el historial del técnico, sin permisos de aplicación.

## Seguridad y permisos

Todas las rutas operativas requieren sesión; cuando corresponde, Fortify conserva la verificación de correo. El acceso se limita a cuentas activas y acepta correo o username normalizado. Una cuenta técnica sin correo no usa recuperación automática y debe solicitar un restablecimiento administrativo.

Los roles fijos son `administrator` y `technician`. Los gates globales reservan Catálogos, Seguimiento y administración de cuentas al administrador. Las policies separan consulta, edición, cancelación, revisión, impresión y captura de aplicaciones. No existe un `Gate::before`: cada operación debe estar declarada. El scope limita consultas y las policies vuelven a validar accesos directos.

Un técnico ve solamente “Mis vales”, Seguridad y Apariencia. Puede registrar aplicaciones en sus vales de salida activos, consultar su historial de liquidados y prestados asignados, y modificar, anular o gestionar evidencia únicamente en reportes creados por su cuenta mientras el vale operativo continúe asignado y la cuenta/persona sigan habilitadas. Un prestado es siempre de sólo lectura para el técnico. Las capacidades compartidas con React sólo ocultan controles; el servidor conserva la decisión definitiva.
