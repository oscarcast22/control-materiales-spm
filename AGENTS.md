# Guía para agentes

## Propósito y usuaria

Esta es una aplicación interna de Servicios Públicos Municipales para que una persona capture vales físicos y controle el material entregado a técnicos. La usuaria no administra el inventario del almacén ni conoce sus existencias físicas.

El flujo operativo es: **vale de salida → material entregado → aplicación en trabajos → saldo pendiente**. La interfaz y los textos deben estar en español claro y ser cómodos para una usuaria administrativa no técnica.

Antes de modificar reglas de negocio lea:

- [`docs/product.md`](docs/product.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/data-import.md`](docs/data-import.md)
- [`docs/operations.md`](docs/operations.md)

## Reglas que no deben romperse

- El seguimiento operativo comienza obligatoriamente el `2026-01-01`.
- No importar transacciones de 2025. Ese histórico fue descartado por sus inconsistencias.
- `Pendiente = entregado - aplicado`.
- Un saldo negativo es una inconsistencia; no debe ocultarse ni convertirse automáticamente en cero.
- No sumar cantidades de materiales o unidades diferentes en un total común.
- Las entradas, los vales cancelados y las aplicaciones anuladas no generan responsabilidad pendiente para un técnico.
- Las correcciones contables se anulan con motivo y auditoría; no se borran silenciosamente.
- El folio se normaliza y es único dentro de cada área de resguardo.
- “Liquidado” significa que el técnico documentó como aplicado todo el material entregado. No significa que se conozca la existencia del almacén.
- La infraestructura de inventario físico permanece reservada, sin rutas ni interfaz. No reactivarla sin existencia inicial y movimientos completos del almacén.
- El único rol actual es una cuenta activa con todos los permisos del MVP.

## Fuentes de verdad

- Esquema: `database/migrations/` y modelos de `app/Models/`.
- Estados: `app/Enums/`.
- Saldos y presentación de vales: `app/Support/VoucherData.php`.
- Seguimiento desde 2026: `app/Support/MaterialTracking.php`.
- Catálogos iniciales: `database/data/*.json`.
- Importación histórica: `app/Console/Commands/ImportLegacyControl.php` y sus clases de soporte.
- Contratos del frontend: `resources/js/types/`.

Los Excel originales no son archivos de ejecución de la aplicación ni deben copiarse al repositorio. Sólo se usa `CONTROL DE ORDEN DE SERVICIO.xlsx` durante una importación histórica controlada.

## Trabajo seguro

- Preserve los cambios existentes del usuario y revise `git status` antes de editar.
- No ejecute `migrate:fresh`, `db:wipe`, importaciones reales ni seeders contra una base con datos sin autorización explícita.
- Un `--dry-run` del importador es seguro; la carga efectiva modifica la base.
- No publique nombres del personal, adjuntos, respaldos, `.env` ni libros de Excel.
- Los adjuntos deben permanecer en el disco privado `local` y servirse únicamente mediante controladores autorizados.
- No añada roles, inventario físico, OCR ni integraciones externas como parte de un refinamiento visual.

## Verificación obligatoria

Después de cambios PHP o de dominio:

```bash
composer test
```

Después de cambios frontend:

```bash
npm run format:check
npm run types:check
npm run lint:check
npm run build
```

Para un checkpoint o preparación de despliegue ejecute también:

```bash
composer audit --locked --no-interaction
npm audit --omit=dev --audit-level=moderate
```

No corrija fallos eliminando pruebas, debilitando validaciones o suprimiendo errores de análisis estático.
