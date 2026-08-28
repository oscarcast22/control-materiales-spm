---
name: Operación en Cristal
updated: '2026-08-28'
language: es-MX
sources:
    tokens: resources/css/app.css
    primitives: resources/js/components/ui/
    layout: resources/js/components/ui/sidebar.tsx
typography:
    sans: IBM Plex Sans Variable
    mono: IBM Plex Mono
palette:
    light:
        background: '#eef4fb'
        surface: '#fbfdff'
        surface-raised: '#ffffff'
        text-primary: '#15213b'
        text-secondary: '#40516d'
        primary: '#164a8c'
        electric: '#0787d1'
        success: '#087b57'
        warning: '#8a5200'
        danger: '#b42318'
        info: '#096a82'
    dark:
        background: '#0b1220'
        surface: '#111c2d'
        surface-raised: '#17243a'
        text-primary: '#f1f5f9'
        text-secondary: '#d3dfef'
        primary: '#93c5fd'
        electric: '#7dd3fc'
        success: '#72e0b5'
        warning: '#ffd18a'
        danger: '#ffb4ab'
        info: '#a7e4ef'
radius:
    control: 0.5rem
    compact-surface: 0.75rem
    surface: 1rem
    large-surface: 1.5rem
layout:
    spacing-unit: 0.25rem
    page-mobile: 1rem
    page-tablet: 1.5rem
    page-desktop: 2rem
    content-max: 80rem
    wide-max: 90rem
---

# Sistema de diseño

## Propósito

Esta es una interfaz operativa interna de Servicios Públicos Municipales. Debe ayudar a una persona administrativa no técnica a capturar vales físicos, registrar material aplicado y reconocer saldos pendientes sin confundirlos con existencias de almacén.

La experiencia debe sentirse moderna, tecnológica y precisa, pero también sobria y fácil de leer durante jornadas prolongadas. No es una interfaz editorial, promocional ni de inventario físico.

Si este documento contradice la implementación, los tokens de `resources/css/app.css` y los componentes de `resources/js/components/ui/` son la fuente de verdad técnica. Actualice este archivo cuando cambie el sistema visual.

## Dirección visual

La dirección se denomina **Operación en Cristal**: un sistema administrativo de alta claridad con glassmorphism moderado, profundidad localizada y color semántico.

Principios:

- **Lienzo continuo:** el fondo ambiental pertenece a toda la aplicación; el contenido principal no es una tarjeta gigante.
- **Una sola estructura dominante:** el sidebar es el único gran panel elevado. Debe acompañar, no competir con el trabajo.
- **Elevación local:** tarjetas, filtros, tablas, popovers y diálogos manejan su propio contraste y profundidad.
- **Cristal con propósito:** la transparencia separa capas funcionales. No debe aplicarse a cada elemento ni reducir la legibilidad.
- **Color operativo:** azul para interacción; verde, ámbar, rojo y cian para estados. El color nunca sustituye texto, icono o etiqueta.
- **Tecnología sobria:** sin cuadrículas decorativas, ruido, neón excesivo, grandes glows ni recursos editoriales.

## Lienzo y estructura

### Fondo global

- El `body` usa `--background` y un único degradado radial azul fijo y tenue en la zona superior derecha.
- La opacidad del degradado es 11% en claro y 12% en oscuro.
- No usar patrones de cuadrícula, tramas, ruido ni degradados múltiples en el fondo global.
- El wrapper y el `main` son transparentes para que el lienzo sea continuo.

### Sidebar

- Es un panel inset flotante con superficie de cristal neutra, borde fino, radio de 16 px y sombra ambiental suave.
- En claro se integra con las tarjetas mediante un blanco gris azulado translúcido. En oscuro adopta la familia de las superficies oscuras.
- El elemento activo es una pastilla azul suave con texto e icono azules; no usa línea lateral ni resplandor.
- Logo, navegación, tema y usuario comparten la misma jerarquía discreta.
- Debe conservar su identidad al estar expandido, contraído y abierto como sheet móvil.

### Header de aplicación

- Es sticky y mide 64 px.
- En la parte superior es completamente transparente para no cortar el degradado global.
- Después de 8 px de scroll activa `background/80`, blur y un divisor inferior tenue.
- No usa sombra. La transición dura 200 ms y sólo modifica fondo, borde y backdrop-filter.

### Contenido

- Ancho estándar: 1280 px. Ancho amplio y completo: 1440 px.
- Padding horizontal: 16 px en móvil, 24 px en tablet y 32 px desde 1200 px.
- Padding vertical de página: 24 px; 32 px desde 1200 px.
- Las páginas usan un flujo vertical de 24 px. Las secciones densas pueden usar 16 px internamente.
- Los encabezados de página se apoyan directamente sobre el lienzo y usan un divisor estructural, no una superficie elevada.

## Color

Todos los colores se consumen mediante tokens semánticos. No introduzca hexadecimales aislados en componentes salvo un detalle óptico documentado.

### Roles principales

- `primary`: acciones principales, enlaces, foco y navegación activa.
- `electric`: acento tecnológico controlado y detalles de información.
- `success`: material liquidado o acción completada.
- `warning`: saldos pendientes o continuidad que requiere revisión.
- `danger`: anomalías, inconsistencias y acciones destructivas.
- `info`: mensajes operativos o aclaraciones de contexto.
- `violet` y `coral`: apoyos secundarios en acentos de métricas; nunca dominan una pantalla.

Cada estado dispone de un tono principal y una superficie `*-subtle`. En modo oscuro cambian tanto el fondo como el texto; no invierta colores manualmente dentro de los componentes.

## Tipografía

- **IBM Plex Sans Variable** es la tipografía principal para interfaz, formularios y datos.
- **IBM Plex Mono** se reserva para folios, chips técnicos, códigos, periodos y metadatos donde el ritmo tabular aporta valor.
- Los números dinámicos usan cifras tabulares.
- Títulos principales: 26 px en móvil y 32 px en escritorio; el dashboard puede usar 32/40 px.
- Títulos de sección: 18 px, semibold.
- Cuerpo habitual: 14 px con 20-24 px de interlineado.
- Encabezados de tabla y labels operativos: 10-11 px, bold, mayúsculas y tracking entre 0.08 y 0.12 em.
- Use tracking negativo sólo en titulares. Evite pesos light y texto secundario con contraste insuficiente.

## Superficies y profundidad

### Glass panel

`glass-panel` es la superficie estándar para tarjetas y métricas principales:

- Fondo `--glass`.
- Borde `--border`.
- Blur de 18 px y saturación de 130%.
- Highlight interior de 1 px y sombra ambiental de baja opacidad.

### Glass panel strong

`glass-panel-strong` se usa en tablas, filtros, popovers y diálogos:

- Fondo `--glass-strong`.
- Blur de 20 px y saturación de 125%.
- Mayor opacidad para proteger la lectura de contenido denso.

Reglas:

- Una superficie elevada debe corresponder a una unidad funcional completa.
- No anide glass panels sólo por decoración.
- Use bordes para estructura o estado; use sombras para elevación.
- El sidebar puede elevarse como estructura. El `main` y el wrapper nunca reciben borde, radio o sombra.

## Formas

- Controles: 8 px (`rounded-lg`).
- Métricas compactas: 12 px (`rounded-xl`).
- Tarjetas, tablas, filtros y diálogos: 16 px (`rounded-2xl`).
- Badges y chips: forma pill.
- Los radios anidados deben ser concéntricos: radio exterior = radio interior + padding visual.
- No fuerce radios en divisores, filas o superficies que deban continuar visualmente.

## Componentes

### Botones

- Altura estándar: 40 px; 44 px en móvil o tamaño grande.
- Primario: degradado vertical entre `primary` y `primary-hover`, borde azul y sombra táctil contenida.
- Outline: cristal fuerte, borde reforzado y texto primario.
- Destructivo: rojo semántico con profundidad menor que el primario.
- Press: `scale(0.96)`. Transición de 150 ms sobre propiedades explícitas.
- Foco: borde de ring y halo de 3 px. El estado disabled mantiene texto legible.

### Campos y selección

- Altura estándar de 40 px y mínima móvil de 44 px.
- Fondo `glass-strong`, borde reforzado y sombra interior mínima.
- En foco, el borde cambia a `ring`, el fondo gana opacidad y aparece un halo de 3 px.
- Labels siempre visibles sobre el control; placeholder no sustituye etiqueta.
- Errores usan borde y ring `danger`, acompañados de mensaje textual.

### Checkboxes

- Tamaño de 20 px, radio de 6 px y borde visible.
- Checked: degradado `primary` a `electric`, check blanco y sombra corta.
- El área interactiva debe ser cómoda aunque el indicador visible sea compacto.

### Tarjetas y métricas

- Las tarjetas base usan `glass-panel`, radio de 16 px y borde.
- Las métricas usan acentos superiores de 1 px, un glow muy difuso y un icono sobre superficie semántica.
- El color refuerza la categoría; label y valor siempre explican el significado.
- No sumar materiales o unidades incompatibles en una métrica común.

### Tablas

- La tabla completa vive dentro de `glass-panel-strong` con radio de 16 px.
- Header sticky translúcido, labels de 11 px en mayúsculas y divisor inferior.
- Filas separadas por un borde; no usar zebra striping.
- Hover con tinte primario de muy baja opacidad.
- En móvil se permite scroll horizontal y se muestra una indicación textual.
- Cantidades mantienen su unidad visible y usan cifras tabulares.

### Badges y alertas

- Badges en forma pill con fondo semántico tenue, icono cuando aporta significado y label explícito.
- Alertas reservan color fuerte para borde, icono o encabezado; el cuerpo debe seguir siendo fácil de leer.
- Pendiente, liquidado, cancelado y anomalía nunca dependen únicamente del color.

### Diálogos, popovers y sheets

- Usan `glass-panel-strong`, blur, borde y una sombra más profunda que las tarjetas.
- Overlay azul muy oscuro al 55% con blur moderado.
- El botón de cierre tiene un área mínima de 40 px.
- En móvil respetan un margen exterior de 16 px y permiten scroll interno cuando sea necesario.

## Movimiento e interacción

- Transiciones habituales: 150-200 ms, `ease-out`.
- Nunca usar `transition: all`; enumere propiedades.
- No añadir animaciones decorativas a interacciones frecuentes.
- Hover, foco, active y disabled deben tener señales estáticas además de movimiento.
- `prefers-reduced-motion` reduce animaciones y transiciones a 0.01 ms.
- Use `will-change` sólo al resolver un problema medido de rendimiento.

## Responsive y accesibilidad

- Ancho mínimo soportado: 320 px.
- Targets: 44 px en móvil y al menos 40 px en escritorio denso.
- El foco siempre es visible y no debe recortarse por overflow.
- La interfaz debe funcionar con teclado y lector de pantalla; iconos decorativos usan `aria-hidden`.
- Mantenga contraste suficiente en ambos temas y no use color como única señal.
- Respete zoom, textos largos, nombres de materiales extensos y tablas sin resultados.
- La navegación móvil se presenta como sheet; el contenido principal no debe desbordar horizontalmente.

## Lenguaje de producto

- Todo texto de interfaz se escribe en español claro para una persona administrativa no técnica.
- Prefiera verbos operativos: “Capturar vale”, “Registrar aplicación”, “Ver seguimiento”.
- “Pendiente” significa entregado menos aplicado; no significa existencia de almacén.
- “Liquidado” significa que todo lo entregado fue documentado como aplicado.
- No presente cantidades de materiales o unidades diferentes como un total común.
- Los detalles de dominio viven en `docs/product.md`; este documento sólo define cómo comunicarlos visualmente.

## Evitar

- Cuadrículas, ruido, texturas o patrones decorativos en el fondo.
- Un contenedor principal elevado alrededor de toda la página.
- Sidebar oscuro dominante en tema claro.
- Glassmorphism de baja opacidad que comprometa contraste.
- Glows fuertes, neón, morado dominante o gradientes decorativos sin función.
- Composición editorial, hero marketing, ilustraciones genéricas o exceso de espacio vacío.
- Colores, sombras o radios duplicados fuera de los tokens y primitives compartidos.

## Verificación

Después de cambios visuales:

```bash
npm run format:check
npm run types:check
npm run lint:check
npm run build
```

Ejecute también la auditoría Playwright con credenciales de prueba configuradas en variables de entorno:

```bash
npm run visual:audit
```

Revise al menos escritorio claro, escritorio oscuro y móvil claro, incluidos sidebar expandido/contraído, header en top/scroll, formularios, tablas, estados vacíos y diálogos.
