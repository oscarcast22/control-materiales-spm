# Producto y flujo operativo

## Problema que resuelve

Los vales de material se llenan a mano y después se transcriben. Las hojas históricas mezclan información, repiten catálogos y contienen errores. La aplicación sustituye esa captura dispersa por un registro trazable que responde:

- qué material recibió cada técnico;
- cuánto reportó como aplicado en trabajos;
- cuánto continúa pendiente de comprobar;
- qué documentos o catálogos necesitan revisión.

La usuaria principal captura y revisa información administrativa. No controla el almacén físico y no dispone de existencias iniciales ni de todas sus entradas.

## Flujo principal

1. Se captura un vale con tipo, folio, fecha, movimiento, técnico, persona que entrega, una o varias ubicaciones, una descripción opcional de uso o actividad y una o más partidas. En toda salida, de Almacén o Patio, el programa fijo SPM-06 se asigna automáticamente y la acción es obligatoria; el indicador se asigna si es único o se elige cuando la acción tiene dos. Entradas, cancelados y prestados capturados directamente no conservan esta clasificación. Un prestado puede conservar opcionalmente un técnico, una persona responsable escrita como texto libre y partidas de material. La hora no se transcribe: el sistema conserva automáticamente cuándo se creó el registro.
2. Cada partida conserva la cantidad entregada y referencia el material y la unidad canónicos del catálogo. Los materiales marcados como luminaria admiten además un texto opcional con rangos o folios individuales, sin interpretar ni sumar esos valores. Cada unidad define si admite sólo enteros o cantidades fraccionarias de hasta tres decimales; inicialmente Metro y Litro admiten fracciones. Corregir esos catálogos actualiza cómo se muestran todos los vales relacionados; no convierte cantidades.
3. Posteriormente se registran una o varias **aplicaciones**. Cada captura agrupa una fecha, el tipo y número obligatorios de la orden de servicio, una ubicación o dirección libre opcional, detalles comunes opcionales y el desglose de materiales utilizados; la evidencia privada es opcional. La ubicación admite sugerencias del catálogo, pero el texto capturado no crea ni modifica ubicaciones canónicas.
4. La aplicación recalcula el saldo. Un vale queda liquidado cuando todas sus partidas llegan exactamente a cero.
5. Una aplicación incorrecta se corrige o anula desde su edición con un motivo obligatorio. Al corregir una cantidad, el valor anterior se conserva anulado y la cantidad corregida se registra como reemplazo auditable; nada se elimina del historial. Los reportes históricos sin orden siguen visibles, pero al corregirlos debe documentarse una orden.
6. Un vale activo puede cancelarse conservando sus aplicaciones vigentes como antecedente de sólo lectura o anulándolas en conjunto. La interfaz propone la anulación cuando existen aplicaciones; cada anulación y la cancelación conservan fecha, usuario y auditoría. La razón de cancelación es opcional. En una salida cancelada, las partidas se presentan como material sin usar y dejan de generar responsabilidad pendiente, sin modificar sus cantidades ni crear devoluciones o movimientos de inventario.
7. Si el formato físico ya está cancelado, se registra sólo su tipo, folio y fecha; el sistema no exige personas ni materiales.
8. El resumen avisa los huecos en las series numéricas de Almacén y Patio para facilitar la conciliación de documentos.
9. Si un formato físico fue prestado, se registra su tipo, folio y fecha. Opcionalmente conserva el técnico relacionado, el nombre libre de la persona responsable y una o más partidas con las cantidades prestadas. La administradora también puede marcar como prestado un vale activo ya capturado: se conservan todos sus datos como referencia y, cuando existen aplicaciones vigentes, la interfaz propone anularlas pero permite conservarlas como antecedente de sólo lectura. Un prestado no genera saldo pendiente, no admite nuevas aplicaciones ni devolución.

Los adjuntos son evidencia privada del vale físico o del reporte de aplicación. La fotografía del vale puede consultarse y ampliarse dentro de su formulario de edición para comparar la captura sin descargarla. Las incidencias del importador se conservan hasta que una persona marque su revisión como atendida.

## Conceptos

| Concepto       | Significado                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Entregado      | Cantidad documentada en la partida del vale de salida.                                                                         |
| Aplicado       | Cantidad reportada como utilizada en uno o más trabajos.                                                                       |
| Pendiente      | Entregado menos aplicado. Aún debe documentarse como utilizado.                                                                |
| Liquidado      | Todas las partidas activas tienen pendiente cero.                                                                              |
| Inconsistencia | Alguna partida tiene pendiente negativo, normalmente por datos heredados.                                                      |
| Por revisar    | El importador detectó información inferida, ambigua o anómala que requiere atención humana.                                    |
| Prestado       | Registro administrativo de un formato prestado; puede conservar responsable, técnico y materiales sin generar saldo operativo. |

“Liquidado” significa que todo el material entregado quedó documentado como aplicado. No equivale a existencia física disponible.

## Alcance del MVP

- Acceso privado mediante cuentas administradoras y cuentas técnicas vinculadas de forma única a una persona activa que recibe material. El acceso técnico se crea sin correo: su usuario se genera uniendo nombre y apellidos en minúsculas y su contraseña es el número de cobro registrado.
- Captura, consulta, edición, impresión, cancelación controlada y eliminación definitiva de vales por la administradora. El borrado se reserva para errores de captura y elimina toda la huella operativa, archivos, auditoría y traza de importación del vale. Las salidas canceladas conservan sus partidas como material sin usar; las entradas canceladas conservan las cantidades únicamente como referencia.
- Registro rápido de folios cancelados y revisión de continuidad por tipo de vale.
- Materiales filtrados estrictamente según el tipo de vale elegido.
- Registro, conversión y corrección auditada de folios prestados, con técnico, persona responsable y materiales opcionales. La conversión conserva los datos previos del vale como referencia.
- Varias partidas por vale y adjuntos privados JPG, PNG, WebP o PDF.
- Folios descriptivos opcionales por partida para materiales marcados como luminaria, disponibles también en entradas y vales prestados y visibles en el detalle imprimible.
- Captura rápida de aplicaciones agrupadas por fecha, tipo y número de orden de servicio obligatorios, con ubicación o dirección libre, detalles comunes, desglose por material, evidencia opcional reemplazable y corrección o anulación auditada. Los tipos iniciales son Normal y 072, y el catálogo de opciones es extensible.
- Vista “Mis vales” para cada técnico, con sus saldos pendientes e inconsistencias y un historial que reúne vales liquidados y prestados asignados. Sólo permite operar vales de salida activos asignados a su persona desde el `2026-01-01`; los prestados son únicamente de consulta.
- Administración del acceso técnico desde Personas: alta automática, pausa/reactivación y restablecimiento al número de cobro, sin mostrar la contraseña ni permitir que el técnico la cambie.
- Catálogos editables y alias, organizados en Personas, Materiales, Ubicaciones y una sección conjunta de Programa, acciones e indicadores. SPM-06, los códigos y sus relaciones son estructurales; en acciones e indicadores sólo se corrigen nombres y estados con auditoría. Las unidades se administran dentro de Materiales; Almacén y Patio son tipos estructurales fijos y no se administran desde la interfaz. Un registro sólo se elimina de forma permanente si no está asignado a un vale ni tiene dependencias de catálogo que perderían información; los registros con historia se desactivan o corrigen. Los nombres canónicos se reflejan en todos los vales relacionados, y materiales y unidades también normalizan las partidas existentes sin convertir cantidades. La fusión auditada de duplicados permanece como contingencia técnica y no se expone en la interfaz.
- Catálogo buscable de ubicaciones con alta desde el vale; una actividad no geográfica se conserva por separado como texto libre.
- Seguimiento desde 2026 por material, técnico y detalle.
- Búsqueda de vales por folio u orden de servicio en Vales, Mis vales, Seguimiento y la captura rápida de aplicaciones; las órdenes presentes sólo en aplicaciones anuladas no generan coincidencias.
- Exportación XLSX con los mismos filtros del seguimiento y el contexto de cada aplicación.
- Vales y seguimiento abren con Almacén como contexto predeterminado; Patio o la vista combinada se consultan mediante una selección explícita. El resumen siempre presenta el panorama general de Almacén y Patio.
- Importación trazable y repetible únicamente de agosto de 2026 desde el control actualizado.

## Fuera de alcance

- Existencias físicas o disponibilidad actual del almacén.
- Compras, proveedores, costos, pedidos o reabastecimiento.
- Importación transaccional de 2025.
- Roles configurables, permisos por matriz o aprobaciones jerárquicas. Los únicos roles fijos son administrador y técnico.
- OCR automático de fotografías.
- Aplicación móvil nativa, API pública o integraciones externas.

## Criterios para el refinamiento frontend

- Priorizar captura rápida, legibilidad y prevención de errores sobre densidad de información.
- Mantener visibles la unidad y el material junto a cada cantidad.
- Presentar los enteros sin ceros decimales y conservar la fracción únicamente cuando fue capturada; el placeholder sugiere un decimal sin impedir capturas de hasta tres.
- No presentar un total general de cantidades heterogéneas en cálculos contables, tablas por material/unidad ni exportaciones. Las filas resumidas por vale en Vales y Seguimiento pueden mostrar un total abstracto de “materiales” para consulta rápida, siempre acompañado de un desglose con las cantidades y unidades reales.
- Conservar etiquetas y estados de dominio; un rediseño no debe cambiar sus cálculos.
- Diseñar primero para escritorio, con funcionamiento correcto en tablet y móvil.
- Aplicar los filtros de consulta al cambiar cada campo; la búsqueda textual espera brevemente a que la usuaria termine de escribir y no requiere un botón de confirmación.
- Los estados vacíos deben explicar qué falta capturar; nunca insinuar que existe inventario cero.
- En el resumen, priorizar los tres indicadores accionables: vales con saldo pendiente, materiales por comprobar y técnicos con pendientes. “Materiales por comprobar” cuenta partidas pendientes; no suma cantidades ni representa materiales únicos. Los vales liquidados se muestran como referencia secundaria y las inconsistencias o revisiones sólo ocupan espacio cuando existen.
- El control de tema de la barra lateral alterna directamente entre claro y oscuro. La opción de seguir el tema del sistema permanece disponible en Apariencia.
- Las interacciones pueden transicionar color, borde y sombra de forma breve, pero no deben desplazar, escalar ni producir un efecto de rebote al presionar botones, filtros o selectores.
- Al expandir o contraer la barra lateral, conservar la alineación óptica de iconos y controles y el mismo ritmo vertical para evitar saltos durante la transición.
