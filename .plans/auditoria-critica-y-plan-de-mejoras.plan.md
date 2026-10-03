# Auditoría crítica y plan de mejoras — Metrónomo by Cucco

Fecha: 2026-10-02 · Rama base: `claude/nice-dirac-8kunr0` (commit `400fbe9`)

Estado medido: `npm run lint` limpio, `tsc -b` limpio, `vitest` 58/58 en verde con 96.6% de cobertura, `vite build` OK (JS ≈ 620 KB sin comprimir / 188 KB gzip, precache PWA 4.7 MB).

**Veredicto:** los indicadores verdes son engañosos. La cobertura excluye `App.tsx` y todo `src/components/**` (≈ 4.000 líneas), y los dos hooks con tests (`useMetronomeAudio`, `usePresetManager`) **no se usan en ninguna parte**. Los bugs más graves están justo en el código que no se testea: la integración UI ↔ Scheduler.

## Estado de implementación

Las cuatro fases están implementadas en la rama `claude/nice-dirac-8kunr0`. Cada bug crítico tiene un test de regresión: unitario en Vitest y/o E2E en Playwright, que escucha la salida real de Web Audio.

| Ítem | Estado | Cómo se verifica |
|------|--------|------------------|
| C1 click muteado en Metrónomo | ✅ | `MixerConsole.test.tsx`, `e2e/audio.spec.ts` (onsets cada 0.5 s a ♩=120) |
| C2/C3 ediciones ignoradas o revertidas | ✅ | `Scheduler.test.ts` (hot-swap), `useMetronomeEngine.test.ts`, E2E en vivo |
| C4 candombe mudo | ✅ | `DrumSynthesizer.test.ts` (todo instrumento de preset llega a su canal), E2E |
| C5 trainer/silencio/formas sin UI | ✅ | Nuevo `PracticeModes`, `App.test.tsx`, E2E |
| C6 compases no contados | ✅ | `Scheduler.test.ts`, E2E |
| C7 fugas (StrictMode, workers, rAF) | ✅ | `Scheduler.dispose()`, `App.test.tsx` (unmount libera el motor) |
| A1 stop no corta | ✅ | `VoiceTracker` + fades, E2E (silencio < 80 ms tras detener) |
| A2–A12 timing, compuestos, sampleRate, iOS, bus del click, mute, ruteo | ✅ | `Scheduler.test.ts`, `meter.test.ts`, `DrumSynthesizer.test.ts` |
| Arquitectura, rendimiento, persistencia | ✅ | Store externo + `useSyncExternalStore`, `usePersistentState` validado |
| PWA, nginx, Docker, CI, README | ✅ | E2E PWA, `nginx -t`, workflow `ci.yml` |
| Bugs extra encontrados al implementar | ✅ | 6/8 del editor era `[2,8]`, "negras" ignoraba el tempo, `zamba_base` no sonaba, mutación de estado en la armonía, side effects dentro de `setState` en el Pomodoro, `alert()` bloqueantes |

---

## 1. Bugs críticos (rompen funcionalidad visible)

| # | Bug | Dónde | Efecto para el usuario |
|---|-----|-------|------------------------|
| C1 | El click se mutea siempre: se compara contra `'metronomo'`, pero el id real es `'metronome_4_4'` | `src/components/MixerConsole.tsx:151` | **El preset "Metrónomo" no suena.** Un metrónomo sin click. |
| C2 | `Scheduler.setPattern` ignora cualquier patrón con el mismo `id`; el editor conserva el id al editar | `src/audio/Scheduler.ts:213`, `src/components/PatternEditor.tsx:117,153,183,203` | **Las ediciones de la grilla nunca llegan al audio** (ni parado ni sonando). El editor es decorativo. |
| C3 | Mientras suena, el callback del scheduler pisa el estado con el patrón viejo en cada paso | `src/App.tsx:340` (`setCurrentPattern(activePattern)`) | Cualquier edición en vivo se revierte en ~100 ms. |
| C4 | Candombe se enruta a canales inexistentes (`tom_high`, `tom_low`, `tom_floor`); `playBuffer` devuelve `true` sin sonar | `src/audio/DrumSynthesizer.ts:1082-1093` y `:310-311` | **El ritmo Candombe solo suena la clave.** |
| C5 | Trainer de velocidad, modo silencio y Formas tienen `useState` sin setter; no hay UI que los active | `src/App.tsx:255-268` | Funciones anunciadas en el README que no se pueden usar. |
| C6 | Los compases practicados solo suman cuando hay armonía cargada | `src/audio/Scheduler.ts:403` | El contador de StudyTools queda en 0 en el uso normal. |
| C7 | StrictMode crea dos `Scheduler` (dos Workers, dos loops de rAF, dos grafos de audio, doble descarga de samples); el cleanup solo hace `stop()` | `src/App.tsx:330-352`, `Scheduler.ts:137-160` | Fugas en dev y en cada remount: nada se destruye nunca. |

## 2. Bugs de motor de audio / timing

- **A1 – Stop no corta lo agendado.** `stop()` solo detiene el worker; las notas ya programadas (hasta 100 ms) y los acordes del `PolyphonicSynth` (medio compás) siguen sonando. Falta un bus por "sesión" que se pueda silenciar con un fade de ~10 ms.
- **A2 – Fin de Forma.** Al terminar la forma se llama `stop()` dentro de `nextStep`, pero el `while` de `scheduler()` sigue iterando sin chequear `isPlaying`, y el evento "¡TERMINÓ!" se dispara ~100 ms antes del audio (`Scheduler.ts:350,553-564`).
- **A3 – Jitter aleatorio en el click.** "Humanize" de ±1.5 ms se aplica a todo, incluido el click guía (`Scheduler.ts:409`). En un metrónomo de estudio el click tiene que ser exacto; el humanize debe ser opcional y nunca aplicarse al click.
- **A4 – Offsets negativos al arrancar.** Con `nextNoteTime` clampeado a `currentTime`, los grooves con anticipación (−3…−6 ms) agendan en el pasado → el navegador los dispara tarde y apilados.
- **A5 – Semántica de BPM en compases compuestos.** `timePerBar = 60/bpm · 4/den · num` hace que en 6/8 el BPM sea de corchea; el click cae en cada corchea (6 por compás). Chacarera a 140 "BPM" = 140 corcheas/min, inconsistente con cómo un músico lo entiende (negra con punto). Hay que definir la unidad de pulso por patrón (`beatUnit`) y mostrarla.
- **A6 – `stepsPerBeat = sub / num` no entero** (ej. subdivisiones mixtas) → el click nunca cae en algunos tiempos. Validar o calcular por fracción.
- **A7 – Cambio de preset en vivo:** `loadPreset` aplica el `recommendedTempo` inmediatamente pero el patrón entra al siguiente compás (`App.tsx:421`), y el Scheduler vuelve a cambiar el tempo en el borde de compás (`Scheduler.ts:580`). Doble fuente de verdad.
- **A8 – `sampleRate: 44100` forzado** (`AudioContextManager.ts:23`): fuerza resampleo en dispositivos de 48 kHz (la mayoría de móviles) y agrega latencia. Quitarlo.
- **A9 – Estados `interrupted`/`suspended` en iOS** (llamada entrante, bloqueo de pantalla) no se manejan; tampoco `visibilitychange`.
- **A10 – Cadena master con saturador `tanh` + low-shelf +3 dB** colorea y comprime el click. El click debería ir por un bus limpio.
- **A11 – Mute duplicado.** El mixer manda `setMute` y además `setVolume(0)`, lo que pisa `originalVolume` (`MixerConsole.tsx:154-155,186-188`). Funciona de casualidad por el orden de llamadas.
- **A12 – Ruteo de mixer arbitrario:** toms → canal snare/kick, ride → hihat, palmas/caja → snare. El mapa vive duplicado en `MixerConsole.getChannelForInstrument` y en cada `play*` del synth; ya divergen (ver C4).

## 3. Arquitectura y estado

- **App.tsx es un "god component"** que duplica la lógica de los hooks que no usa. Elegir una única fuente: un hook `useMetronomeEngine` (o store mínimo) que posea el Scheduler, con `dispose()` real.
- **Re-render global en cada paso.** El callback hace 7 `setState` por paso → re-render de toda la app (MUI incluido) 8–16 veces/seg. Además `setBpm(newBpm)` en cada paso dispara el efecto `setTempo`.
- **ConductorVisual reinicia su loop de rAF en cada paso** (dependencia `currentStepIndex` en `ConductorVisual.tsx:530`).
- **VU del mixer:** efecto que depende de `peaks` y hace `setPeaks` en cada frame → re-render a 60 fps mientras suena (`MixerConsole.tsx:118-147`). Animar por refs/DOM directo.
- **Canvas sin DPR** en ConductorVisual → borroso en pantallas retina.
- **`RhythmPatterns.ts` importa React y lucide** (datos acoplados a UI); los íconos deberían vivir en la capa de componentes.
- **Strings como identificadores** (`'Chacarera Simple'`, `name.includes('(2da)')` en `Scheduler.ts:567`) → frágil; usar enums/ids.
- **Sin persistencia:** BPM, patrón custom, mixer, tareas y armonía se pierden al recargar.

## 4. Testing y calidad

- La cobertura del 95% excluye exactamente donde están C1–C5. Los tests de hooks testean código muerto.
- No hay tests de integración UI↔audio (Testing Library ya está instalado).
- No hay CI (`.github/` no existe): nada impide mergear un lint/test roto.
- No hay test que valide que **todo instrumento usado en un preset tiene canal y sonido** (habría atrapado C4).

## 5. PWA, despliegue y seguridad

- **Íconos PWA inexistentes:** el manifest pide `pwa-192x192.png`, `pwa-512x512.png`, `favicon.ico`, etc., que no están en `public/`. `public/vite.svg` y `src/assets/react.svg` pesan 0 bytes. La app no es instalable correctamente.
- **Precache sin `.ogg`:** `globPatterns` omite `ogg` → offline no suenan bombo, palmas, caja, cajón, clave ni candombe (justo los instrumentos folklóricos).
- **`sw.js` cacheado 1 mes por nginx** (regla `\.js$`) → las actualizaciones del service worker quedan bloqueadas hasta 30 días. `index.html`, `sw.js` y `manifest.webmanifest` deben ir con `no-cache`; `/assets/*` (hasheados) con `immutable, max-age=31536000`.
- `X-XSS-Protection` está deprecado (eliminar); `gzip_min_length 10240` es demasiado alto; falta `application/manifest+json` y `image/svg+xml` en `gzip_types`.
- **Dockerfile** usa `node:20` (fuera de soporte desde abril 2026) → `node:22`/`24`. `docker-compose` con `version:` obsoleto.
- Branding inconsistente: manifest "Antigravity Metrónomo", `theme_color #ffffff` en una UI oscura, `<title>metronomo-app</title>`, `lang="en"` en una app en español.
- README mezcla el template de Vite y afirma "no usa samples", pero carga 19 WAV/OGG.

## 6. UX y accesibilidad

- Atajo Espacio: si el foco está en un botón, puede haber doble toggle; los sliders MUI no están excluidos.
- Canvas clickeables sin alternativa de teclado ni `aria-label`.
- Tap tempo con `Date.now()` (usar `performance.now()`), promedio de solo 4 taps, sin reset visible.
- Preview de instrumentos deshabilitado mientras suena (`App.tsx:301`).
- Sin rango/validación visible de BPM ni atajos ↑/↓ para ajustar tempo.

---

## Plan de implementación (priorizado, para ejecutar ya)

### Fase 1 — Hotfixes de funcionalidad (≈ 1 sesión, alto impacto, bajo riesgo)
1. **C1:** reemplazar el literal por una constante compartida (`METRONOME_PATTERN_ID`) y desmutear el click en el preset metrónomo.
2. **C2/C3:** `Scheduler.setPattern` compara por contenido/versión (no por id) y reconstruye el `stepCache` en caliente; quitar `setCurrentPattern(activePattern)` del callback y notificar solo cambios reales de patrón en cola.
3. **C4:** centralizar `INSTRUMENT_CHANNEL` en un único módulo usado por synth y mixer; corregir candombe/toms.
4. **C6:** contar compases en el wrap de `nextStep`, independientemente de la armonía.
5. **A3/A4:** sin jitter en el click; clamp de `playTime >= currentTime`.
6. **A8:** quitar `sampleRate` forzado.
7. Test de regresión por cada bug (incluido "todo instrumento de cada preset suena por un canal existente").

### Fase 2 — Ciclo de vida y rendimiento del motor
1. `Scheduler.dispose()`: termina worker, cancela rAF, desconecta nodos; usarlo en el cleanup (arregla C7).
2. Bus de sesión con fade-out al `stop()` (A1) y corrección del fin de forma (A2).
3. Un solo hook `useMetronomeEngine` como fuente de verdad; borrar el código muerto o migrar `App.tsx` a los hooks existentes.
4. Separar estado de alta frecuencia (paso actual) del resto: suscripción por ref/`useSyncExternalStore` solo en los componentes visuales; BPM se actualiza solo si cambió.
5. Arreglar loops de rAF (ConductorVisual, VU del mixer) y DPR del canvas.
6. Manejo de `visibilitychange` y estado `interrupted` en iOS (A9).

### Fase 3 — Funciones prometidas y persistencia
1. UI para Trainer de velocidad, Modo silencio y Formas (C5), o sacarlos del README si no van.
2. `beatUnit` por patrón y click en negra con punto para compuestos (A5/A6).
3. Persistir en `localStorage` (con versión de esquema): BPM, último patrón, patrones custom, mixer, armonía, tareas.
4. Tap tempo con `performance.now()` y ventana de 6–8 taps; atajos ↑/↓ y validación de BPM.

### Fase 4 — PWA, despliegue y calidad continua
1. Generar íconos (192/512/maskable/apple-touch/favicon) y corregir manifest (nombre, colores, `lang="es"`, título).
2. Agregar `ogg` a `globPatterns`; revisar si `ride.wav`/`tom*.wav` pueden pasar a OGG/Opus para bajar el precache.
3. nginx: `no-cache` para `index.html`/`sw.js`/manifest, `immutable` para `/assets/`, quitar `X-XSS-Protection`, ajustar gzip.
4. Dockerfile a `node:22-alpine`, quitar `version:` de compose.
5. GitHub Actions: lint + typecheck + test + build en cada PR.
6. Incluir `src/components/**` y `App.tsx` en la cobertura con umbral realista y tests de integración con Testing Library.
7. Reescribir el README (quitar template de Vite y la afirmación de "sin samples").

### Criterio de "hecho" por fase
`npm run lint && npx tsc -b && npm test && npm run build` en verde, más verificación manual en navegador: el preset Metrónomo suena, una edición de grilla se escucha en el siguiente compás, Candombe suena completo, stop corta en < 20 ms.
