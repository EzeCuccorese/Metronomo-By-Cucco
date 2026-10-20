# Changelog

## 1.0.1 - 2026-10-20

### Fixes
- Refresh lockfiles after the version bump.

## 1.0.0 - 2026-10-20

### Features
- Single project version with PR-based releases (#65).
- Tips de primer uso (U10) [apilado sobre #59].
- Modo escenario / atril (U7) [apilado sobre #57].
- Canales en uso, Solo y vista compacta (U6) [apilado sobre #56].
- Transporte fijo y modo bolsillo (U3/U8) [apilado sobre #54].
- Menú Vista con presets por actividad (U2) [apilado sobre #53].
- Paneles plegables y ocultables (U1).
- Modo escenario en el registro de atajos (F) y en la paleta.
- Comandos de Vista en la paleta (presets y paneles).
- Tres tips de primer uso con Snackbar de MUI.
- Distribución tracker de 2 filas y etiquetas según el layout del teclado.
- Entrada MIDI nativa (Chrome/Android) con avisos donde no existe.
- Paleta de comandos ⌘K / Ctrl+K con cmdk.
- Modo escenario / atril con pulso gigante.
- Teclado PC descubrible, velocidad C/V y pedal de sustain.
- Registro único de atajos, hoja de ayuda (?) y tooltips derivados.
- Canales en uso, Solo y filas compactas horizontales.
- Barra de transporte fija y modo bolsillo.
- Two-row tracker layout and layout-aware key labels.
- Menu Vista con presets por actividad.
- Paneles plegables y ocultables con estado persistido.
- Native Web MIDI input with device selector, shared sustain and unavailable notices.
- Command palette (Cmd/Ctrl+K) over the shortcut registry with cmdk.

### Fixes
- Base the next version on the last release commit.
- Tips sin listeners cuando ya se vieron todos; viewport robusto en el e2e.
- Modo escenario monta su contenido solo abierto, acota el pulso y pide pantalla completa en el gesto.
- La fila de estado conserva su alto para que nada salte al ocultar el chip.
- Nombre del validador y melodia vacia no cuenta como uso del piano.
- Barra compacta con ref al encabezado y mejoras de accesibilidad del boton de tempo.
- Menu Vista sin listas anidadas y lectura de storage protegida.
- Plegar solo con id y limpiar oyentes de claves persistidas.
- Guard overlapping connect(), fall back to event.target, disable empty selector.
- Ctrl+K toggles, accept 'bpm' suffix, search by key, simpler grouping.
- Release held keys and pedal on Esc, collapse the band margin on touch.
- Derive octave codes by value, warn on duplicate handler ids, fix indentation.

