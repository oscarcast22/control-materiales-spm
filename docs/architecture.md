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

- `Normalizer`: genera claves comparables para folios, materiales y personas.
- `VoucherData`: construye el contrato de presentación de un vale y calcula los estados de sus partidas.
- `MaterialTracking`: aplica el corte de 2026 y agrega partidas por material/unidad o por técnico.
- `LegacyControlWorkbook` y `LegacyReportComment`: aíslan la lectura del libro y la interpretación conservadora de comentarios.
- `ImportLegacyControl`: valida, prepara y escribe la importación histórica dentro de una transacción.

La pantalla y el XLSX de seguimiento consumen el mismo agregador para evitar resultados divergentes.

## Relaciones principales

```mermaid
erDiagram
    USERS ||--o{ VOUCHERS : creates_updates
    STORAGE_LOCATIONS ||--o{ VOUCHERS : contains
    PEOPLE ||--o{ VOUCHERS : receives_delivers_authorizes
    PROGRAMS ||--o{ ACTIONS : has
    PROGRAMS ||--o{ VOUCHERS : classifies
    ACTIONS ||--o{ VOUCHERS : classifies
    VOUCHERS ||--|{ VOUCHER_ITEMS : contains
    MATERIALS ||--o{ VOUCHER_ITEMS : identifies
    UNITS ||--o{ VOUCHER_ITEMS : measures
    VOUCHERS ||--o{ MATERIAL_APPLICATION_REPORTS : documents
    MATERIAL_APPLICATION_REPORTS ||--o{ MATERIAL_APPLICATIONS : groups
    VOUCHER_ITEMS ||--o{ MATERIAL_APPLICATIONS : accounts
    VOUCHERS ||--o{ VOUCHER_ATTACHMENTS : evidences
    MATERIALS ||--o{ MATERIAL_ALIASES : recognizes
    PEOPLE ||--o{ PERSON_ALIASES : recognizes
    USERS ||--o{ AUDIT_EVENTS : performs
    VOUCHERS ||--o{ LEGACY_IMPORT_ROWS : traces
```

## Diccionario resumido

| Tabla | Responsabilidad |
| --- | --- |
| `users` | Cuentas autorizadas. `is_active` bloquea inmediatamente el acceso. |
| `storage_locations` | Área de origen del vale, actualmente Almacén o Patio. |
| `units` | Unidad estructurada usada para cantidades. |
| `materials` | Catálogo canónico; conserva unidad habitual y bandera de revisión. |
| `material_aliases` | Variantes históricas que apuntan al material canónico. |
| `people` | Técnicos y personal; sus banderas indican quién recibe o entrega. |
| `person_aliases` | Escrituras alternativas de una misma persona. |
| `programs`, `actions` | Clasificación opcional del trabajo municipal. |
| `vouchers` | Cabecera del documento, estado, revisión y responsables. |
| `voucher_items` | Material, unidad, descripción histórica y cantidad entregada. |
| `material_application_reports` | Datos comunes y evidencia opcional de una aplicación capturada en bloque. |
| `material_applications` | Cantidad aplicada a una partida; una anulación conserva fecha, usuario y motivo. |
| `voucher_attachments` | Metadatos de evidencia guardada en almacenamiento privado. |
| `audit_events` | Valores anteriores y posteriores de operaciones sensibles. |
| `legacy_import_rows` | Copia del renglón original, incidencias y vínculo al registro importado. |
| `inventory_adjustments` | Infraestructura reservada de inventario físico; no tiene rutas activas. |

## Invariantes

- `vouchers(storage_location_id, folio_key)` es único. `folio_key` deriva del folio normalizado.
- Las cantidades utilizan decimal con tres posiciones y deben ser positivas al capturarse.
- Una aplicación nueva no puede superar el pendiente; las partidas se bloquean durante la transacción para evitar carreras.
- Una aplicación anulada deja de afectar las sumas, pero permanece auditable.
- No se puede reducir una partida por debajo de lo ya comprobado ni eliminarla si posee movimientos vigentes.
- Un vale con movimientos vigentes no puede cancelarse.
- Las salidas activas desde `2026-01-01` alimentan el seguimiento. Entradas y cancelados quedan fuera.
- Las agregaciones cuantitativas se separan por `material_id` y `unit_id`.
- Los adjuntos residen en el disco privado y sólo se descargan después de autorizar el vale.

## Estados derivados

```text
partida pendiente     pendiente > 0
partida liquidada     pendiente = 0
partida inconsistente pendiente < 0

vale inconsistente    alguna partida inconsistente
vale pendiente        ninguna inconsistente y alguna pendiente
vale liquidado        todas sus partidas liquidadas
```

Las entradas usan el estado informativo `received`. Los vales cancelados usan `cancelled` y no participan en el seguimiento.

## Seguridad y permisos

Todas las rutas operativas requieren sesión y correo verificado. Las políticas y gates permiten operar únicamente a cuentas activas. El MVP tiene un solo nivel de permisos; cualquier cuenta activa puede gestionar vales, catálogos y reportes. Laravel proporciona CSRF, regeneración de sesión, hashing de contraseñas y rate limiting del acceso. Dos factores y passkeys están disponibles como opciones de la cuenta.

Esta arquitectura es suficiente para el MVP de una usuaria, pero no representa separación de funciones. Antes de incorporar almacén, técnicos u otras áreas debe diseñarse un modelo de roles.
