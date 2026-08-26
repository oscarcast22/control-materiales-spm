# Producto y flujo operativo

## Problema que resuelve

Los vales de material se llenan a mano y después se transcriben. Las hojas históricas mezclan información, repiten catálogos y contienen errores. La aplicación sustituye esa captura dispersa por un registro trazable que responde:

- qué material recibió cada técnico;
- cuánto reportó como aplicado en trabajos;
- cuánto continúa pendiente de comprobar;
- qué documentos o catálogos necesitan revisión.

La usuaria principal captura y revisa información administrativa. No controla el almacén físico y no dispone de existencias iniciales ni de todas sus entradas.

## Flujo principal

1. Se captura un vale con folio, fecha, área, técnico, personal relacionado, destino y una o más partidas.
2. Cada partida conserva el nombre del material, unidad y cantidad entregada en ese momento.
3. Posteriormente se registran una o varias **aplicaciones** con fecha, cantidad, referencia opcional y evidencia privada opcional.
4. La aplicación recalcula el saldo. Un vale queda liquidado cuando todas sus partidas llegan exactamente a cero.
5. Una aplicación incorrecta se anula con motivo; no se elimina del historial.
6. Un vale sólo puede cancelarse si no tiene aplicaciones vigentes.

Los adjuntos son evidencia privada del vale físico o del reporte de aplicación. Las incidencias del importador se conservan hasta que una persona marque su revisión como atendida.

## Conceptos

| Concepto | Significado |
| --- | --- |
| Entregado | Cantidad documentada en la partida del vale de salida. |
| Aplicado | Cantidad reportada como utilizada en uno o más trabajos. |
| Pendiente | Entregado menos aplicado. Aún debe documentarse como utilizado. |
| Liquidado | Todas las partidas activas tienen pendiente cero. |
| Inconsistencia | Alguna partida tiene pendiente negativo, normalmente por datos heredados. |
| Por revisar | El importador detectó información inferida, ambigua o anómala que requiere atención humana. |

“Liquidado” significa que todo el material entregado quedó documentado como aplicado. No equivale a existencia física disponible.

## Alcance del MVP

- Acceso privado mediante cuentas creadas por consola.
- Captura, consulta, edición, impresión y cancelación controlada de vales.
- Varias partidas por vale y adjuntos privados JPG, PNG, WebP o PDF.
- Captura rápida de varias aplicaciones del mismo vale, con evidencia opcional y anulación auditada.
- Catálogos editables, alias y fusión de duplicados.
- Seguimiento desde 2026 por material, técnico y detalle.
- Exportación XLSX con los mismos filtros del seguimiento.
- Importación trazable y repetible del histórico aceptado de 2026.

## Fuera de alcance

- Existencias físicas o disponibilidad actual del almacén.
- Compras, proveedores, costos, pedidos o reabastecimiento.
- Importación transaccional de 2025.
- Roles diferenciados, aprobaciones jerárquicas o acceso directo de técnicos.
- OCR automático de fotografías.
- Aplicación móvil nativa, API pública o integraciones externas.

## Criterios para el refinamiento frontend

- Priorizar captura rápida, legibilidad y prevención de errores sobre densidad de información.
- Mantener visibles la unidad y el material junto a cada cantidad.
- No presentar un total general de cantidades heterogéneas.
- Conservar etiquetas y estados de dominio; un rediseño no debe cambiar sus cálculos.
- Diseñar primero para escritorio, con funcionamiento correcto en tablet y móvil.
- Los estados vacíos deben explicar qué falta capturar; nunca insinuar que existe inventario cero.
