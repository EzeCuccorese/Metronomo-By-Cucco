> **Estado:** Completado (2026-10). Todo lo recomendado está en `main`: M0 audio en iOS (#41), pnpm 11 (#38), Oxlint type-aware y solo TS 7 (#39), Vitest Browser Mode y WebKit en Playwright (#44), fase Adaptativo (#45: manifest, metas de iOS, safe areas, layouts, objetivos de 44 px, aviso de actualización y proyectos de Playwright por dispositivo) y hosting en Cloudflare Workers Static Assets (#46, deploy manual). **Queda fuera del código:** el checklist manual en el iPhone (M0 y fase Adaptativo). Siguen opcionales o a demanda: oxfmt, vúmetros en AudioWorklet y la migración de MUI. El plan se conserva tal como se escribió; las columnas "Hoy" describen `main` en `5dcab7c` (2026-10-04).

# Evaluación de tooling, librerías y uso en el celular — Metrónomo by Cucco

Fecha: 2026-10-03 (actualizado 2026-10-04) · Rama: `docs/plan-tooling-and-mobile`

## Objetivo

Responder dos preguntas:

1. ¿Qué herramientas, frameworks y librerías conviene migrar, y las elecciones actuales son las mejores para esta app?
2. ¿Cómo dejar la app como web adaptativa (PWA) que se instale en el iPhone propio y funcione bien en teléfono, tablet y escritorio, sin app nativa?

Dispositivos objetivo: solo el último iPhone con el último iOS (Safari y PWA en pantalla de inicio), Safari de macOS 27 y el último Chrome.

**Cómo leer las fuentes.** Cada dato de 2026 lleva su fuente al final del documento. Lo marcado **[sin verificar]** no tiene fuente primaria o se basa en una sola fuente secundaria. Hay que confirmarlo antes de ejecutar la fase que depende de ese dato.

## Punto de partida (medido en `main`)

| Área | Hoy |
|---|---|
| Runtime / gestor | Node 26 (`.nvmrc`, CI, Docker), npm |
| Build | Vite 8 (Rolldown), `vite-plugin-pwa` 2.0 (Workbox `generateSW`), `build.target: esnext` |
| Tipos | TypeScript 7.0 (`typescript7`) para `tsc -b`, y TypeScript 6.0 solo para typescript-eslint, que declara peer `typescript <6.1.0` |
| Lint | ESLint 10 flat config + typescript-eslint 8 (sin reglas *type-aware*) + react-hooks 7 + react-refresh |
| Tests | Vitest 5 + jsdom con mocks de `AudioContext`, y Playwright (solo Chromium) con una sonda de audio real |
| UI | React 19.3, MUI **v9.4** + Emotion, canvas 2D (`ConductorVisual`, `InteractiveInstrumentVisual`) |
| Audio | Web Audio crudo: reloj en Worker (`setInterval` de 25 ms) con agendado *lookahead* (`Scheduler.ts`), samples solo Opus con síntesis de respaldo, piano con armonía, teclado tocable y modo melodía (`PolyphonicSynth`) |
| Estado | Store externo con `useSyncExternalStore` (`src/state/playbackStore.ts`) y `usePersistentState` validado en `localStorage` |
| Bundle (gzip) | `mui` 104 kB · `vendor` (React) 68 kB · app 39 kB · CSS 3,5 kB. El precache PWA suma 66 entradas y 6,25 MB, casi todo samples e imágenes |
| Deploy | Imagen Docker con nginx 1.31 en GHCR, con headers OWASP en `deploy/security-headers.conf` |

> Nota: este plan se basa en `main`, que ya incluye el PR #20 (todos los samples en **Opus**, sin WAV/OGG) y el PR #26 (piano: armonía, teclado tocable y modo melodía). MUI es la **v9.4**. Falta verificar en el iPhone que `decodeAudioData` acepta Opus (checklist de M0).

## Resumen ejecutivo

Recomendaciones ordenadas por impacto sobre esfuerzo:

| # | Recomendación | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | **M0: endurecer el audio en iOS** (en PR aparte). `navigator.audioSession.type = 'playback'` para que suene con el switch de silencio, Screen Wake Lock mientras suena, `resume()` en `visibilitychange`/`statechange` (manejando `interrupted`) y verificación del bug de WebKit 291892. | Alto: hoy en iPhone el click puede no sonar | Bajo (1–2 días) |
| 2 | **Fase Adaptativo: PWA instalable y layouts para teléfono (vertical y horizontal), tablet y escritorio.** Manifest completo, metas de iOS, safe areas, `dvh/svh`, objetivos táctiles de 44 px, aviso de actualización, offline y Playwright con WebKit y viewports. **Sin app nativa:** se instala con Compartir → Agregar a inicio sobre HTTPS (Cloudflare). | Alto: es la experiencia real en el iPhone | Medio (1–2 semanas, ver sección C) |
| 3 | **Reemplazar ESLint + typescript-eslint por Oxlint con type-aware (tsgolint, basado en TS 7).** Se elimina TypeScript 6 y el alias `typescript7`, y el lint pasa a tener reglas con tipos, que hoy no tiene. | Medio: una sola versión de TS, lint 10x+ más rápido | Bajo (1 día) |
| 4 | **Seguridad de la cadena de dependencias.** Migrar a pnpm 11 (`minimumReleaseAge` de 24 h por defecto y builds de dependencias bloqueados). Si se descarta pnpm, configurar en npm 11 `min-release-age` y `ignore-scripts`. | Medio: defensa contra gusanos tipo Shai-Hulud | Bajo (medio día) |
| 5 | **Tests de audio y canvas en Vitest Browser Mode** (Chromium real vía Playwright) para `Scheduler`, `DrumSynthesizer` y `PolyphonicSynth` con `OfflineAudioContext`. jsdom queda para hooks y lógica pura. | Medio: menos mocks y más confianza en el timing | Medio (3–5 días) |

Quedan en PR: M0, pnpm, Oxlint, Vitest Browser Mode y Cloudflare. Lo que **no** cambiaría está al final: React, Vite, Web Audio crudo, el store propio, Playwright y la PWA con Workbox. Sobre MUI: es el mayor costo de bundle, pero hoy migrarlo no se justifica (detalle abajo).

## A. Tooling

| Área | Actual | Recomendado | Por qué | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| Gestor de paquetes | npm 11 | **pnpm 11**, instalado sin corepack | Node 25+ ya no trae corepack. pnpm 11 trae `minimumReleaseAge` de 1440 min por defecto, builds de dependencias bloqueados salvo `allowBuilds`, y bloquea subdependencias git/tarball. Es exactamente la defensa contra Shai-Hulud (sep. y nov. 2025). Bun también tiene `minimumReleaseAge` y scripts apagados, pero suma un runtime más sin beneficio para un SPA. | 0,5 día | Bajo. El plan de pnpm sigue **en espera**: decide el usuario. |
| Lint | ESLint 10 + typescript-eslint 8 sobre TS 6 | **Oxlint 1.x + `oxlint-tsgolint`** (type-aware, sobre TS 7) | typescript-eslint no soporta TS 7 porque falta la API programática, prevista para TS 7.1 [sin verificar la fecha]. tsgolint ya es estable (jul. 2026) y cubre 59 de 61 reglas type-aware. Oxlint tiene reglas `react-hooks`, `react-refresh` y `typescript` nativas. Biome 2 es una alternativa válida, pero su inferencia de tipos propia es menos completa. | 1 día | Medio-bajo. Las reglas del React Compiler en `eslint-plugin-react-hooks` 7 quizá no estén todas en Oxlint [sin verificar]. Si importan, mantener ESLint solo con ese plugin, sin type-aware. |
| Formateo | Ninguno | **Opcional: oxfmt** cuando salga de beta | No hay formatter hoy y el estilo es mixto (`;` y `"` en algunos archivos). Es de bajo valor para un repo de una persona. | 0,5 día | Bajo |
| Type checker | TS 7.0 (`typescript7`) + TS 6.0 | **Solo TS 7**, como `typescript@7` sin alias, cuando se quite typescript-eslint | El alias existe solo por ESLint. Con Oxlint se borra `typescript@6` y `package.json` vuelve a `tsc -b`. | Incluido en Lint | Bajo |
| Tests unitarios | Vitest 5 + jsdom con mocks de Web Audio | **Vitest 5 con dos proyectos:** `unit` (jsdom) y `browser` (Browser Mode, provider `@vitest/browser-playwright`, Chromium) | Browser Mode es estable desde Vitest 4. En Chromium real existen `AudioContext`, `OfflineAudioContext` y canvas: se puede renderizar un compás offline y medir onsets y niveles en vez de afirmar llamadas a mocks. Los mocks hoy validan "se llamó `start(t)`", no "sonó en t". | 3–5 días | Medio. Es más lento que jsdom, y la cobertura v8 en Browser Mode necesita configurarse aparte. |
| E2E | Playwright (Chromium) + sonda de audio + axe | **Mantener.** Agregar el proyecto `webkit` para smoke tests de UI y PWA. | Playwright es el estándar. La sonda de audio real es un activo. WebKit de Playwright no es Safari iOS, pero detecta regresiones de CSS/JS en WebKit. El audio en iOS se valida a mano en el dispositivo (checklist de la fase M0). Los viewports y WebKit se detallan en la fase Adaptativo. | 0,5 día | Bajo |
| Bundler | Vite 8 (Rolldown) | **Mantener** | Es lo más moderno del ecosistema. Vite+ (VoidZero) unifica Vite, Vitest, Oxlint y oxfmt bajo un CLI. Conviene mirarlo cuando sea GA [sin verificar el estado], pero no aporta nada que no se pueda lograr con las piezas sueltas. | — | — |
| Hosting (en PR) | Docker + nginx en GHCR (sin destino de deploy definido en el repo) | **Cloudflare Workers Static Assets** (o Pages) con `_headers`. Docker queda para self-hosting. | Es un sitio 100% estático. Cloudflare sirve `_headers` (CSP, `Cache-Control`), da CDN global y HTTPS gratis, y deploya desde CI con `wrangler`. Pages está en modo mantenimiento y Workers es lo recomendado para proyectos nuevos [fuente secundaria]. GitHub Pages **no** sirve: no permite headers propios (CSP, `no-cache` del `sw.js`). Netlify es equivalente a Cloudflare. | 1 día | Bajo. Hay que mantener nginx y `_headers` sincronizados (se pueden generar ambos desde `deploy/security-headers.conf`, como ya hace `vite.config.ts`). |
| CI | 3 jobs (quality, e2e, nginx) + publish Docker + Gemini review | **Mantener la estructura.** La deriva de la imagen nginx entre CI y Dockerfile ya se corrigió en el PR #36. El job e2e suma los proyectos WebKit y de viewports de la fase Adaptativo (sección C). | La estructura es correcta. | 0,5 día | Bajo |

### Detalle: pnpm sin corepack en Node 26

```bash
npm i -g pnpm@11          # local; o mise/fnm, sin corepack
pnpm import               # genera pnpm-lock.yaml desde package-lock.json
rm package-lock.json
```

- `package.json` lleva `"packageManager": "pnpm@11.x.y"` (lo respeta `pnpm/action-setup` en CI) y `"devEngines": { "packageManager": { "name": "pnpm" } }`.
- En `pnpm-workspace.yaml` va `allowBuilds` vacío: hoy ninguna dependencia necesita build. Si en el futuro Playwright o esbuild lo piden, se agregan de forma explícita.
- CI: `pnpm/action-setup` + `actions/setup-node` con `cache: pnpm`.
- Dockerfile: `RUN npm i -g pnpm@11 && pnpm install --frozen-lockfile`.

Si se decide quedarse en npm, la alternativa mínima es un `.npmrc` con `min-release-age=1` (días, npm ≥ 11.10) e `ignore-scripts=true`. npm 12 apagará los install scripts por defecto [sin verificar la fecha].

## B. Frameworks y librerías

| Área | Actual | Recomendado | Por qué | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| Framework UI | React 19.3 | **Mantener React.** Probar el React Compiler en modo `annotation` solo si aparecen problemas de render. | El camino caliente (audio, paso actual, vúmetros, canvas) ya vive fuera de React: Worker, store externo y updates imperativos. Preact, Solid o Svelte ahorrarían unos 40–60 kB gzip de React pero obligan a reescribir toda la UI y salir de MUI. El React Compiler 1.0 es estable (oct. 2025), pero en `@vitejs/plugin-react` 6 el soporte nativo (`oxc-transform-react`) figura como **experimental** en su README. No hay un problema de render medido que lo justifique. | — | — |
| UI kit / estilos | MUI v9 + Emotion (104 kB gzip) | **Mantener MUI v9 por ahora.** Si se quiere bajar el bundle, migrar de a poco a **Base UI 1.x + CSS Modules** (o vanilla-extract), pantalla por pantalla. | El look "hardware" es mayormente custom: canvas, `sx` y theme oscuro. MUI aporta sobre todo Dialog, Slider, Menu, Tabs y accesibilidad. Pigment CSS (el MUI zero-runtime) está **en pausa**: no es opción. Base UI 1.0 es estable (dic. 2025), headless y del mismo equipo, así que la API resulta familiar. Tailwind v4 + shadcn también sirve, pero obliga a reescribir todo el estilo a utilidades. Panda y vanilla-extract son zero-runtime y válidos. El ahorro posible es de ~80–100 kB gzip y algo de CPU de Emotion en el arranque. En una PWA cacheada offline eso pesa poco: **impacto bajo para un esfuerzo alto.** | Alto (2–3 semanas) | Medio |
| Estado | Store propio con `useSyncExternalStore` + `usePersistentState` | **Mantener** | Tiene 66 líneas, hace exactamente lo necesario (snapshots inmutables, igualdad por campo) y está testeado. Zustand o Jotai agregarían una dependencia para lo mismo. | — | — |
| Motor de audio | Web Audio crudo, reloj en Worker + lookahead | **Mantener Web Audio crudo.** No usar Tone.js. | El patrón lookahead sobre `currentTime` es justamente lo que hace Tone.js por dentro. Este código ya agrega microtiming por groove, corte de voces en ~12 ms, cambios de patrón al paso siguiente y buses por canal. Tone.js sumaría unos 100 kB y otra capa de abstracción sobre el timing, que es lo crítico. | — | — |
| AudioWorklet | No se usa | **Solo para medición** (vúmetros con RMS/peak en el hilo de audio, enviado por `MessagePort`). **No** para agendar. | El agendado lookahead ya es *sample-accurate*: los eventos se fijan en tiempo de audio y el jitter del Worker solo mueve el momento en que se agenda, no el instante en que suena. Mover el scheduler a un Worklet complica todo sin ganancia audible. Los vúmetros con `AnalyserNode` leídos desde rAF ya funcionan. Es opcional. | 1–2 días | Bajo |
| Reloj del Worker | `setInterval` de 25 ms en un Worker | **Mantener** | Es el patrón clásico ("A Tale of Two Clocks"). Con un lookahead ≥ 100 ms tolera los throttles del navegador en primer plano. | — | — |
| Formatos de audio | Solo Opus (PR #20, ya en `main`) | **Mantener Opus** y verificar en el iPhone que `decodeAudioData` lo acepta. Si no, usar AAC (`.m4a`). | Achicó fuerte el precache. Si falla la decodificación, la app cae a síntesis sin aviso: conviene un test E2E o manual que lo detecte (checklist de M0). | 0,5 día | Bajo |
| MIDI | No hay | **No priorizar.** Si se hace, que sea una mejora progresiva solo en Chrome. | Web MIDI sigue sin soporte en Safari (macOS e iOS; WebKit bug 107250 abierto). En el target principal (iPhone) no existe. | — | — |
| Visuales | Canvas 2D en el hilo principal | **Mantener canvas 2D.** OffscreenCanvas en Worker solo si se mide jank. | Son dibujos simples a 60 fps. WebGL no aporta. OffscreenCanvas 2D en Worker existe en Safari desde 16.4–17 [sin verificar la versión exacta], pero su beneficio es nulo mientras el hilo principal esté libre. | — | — |
| PWA | `vite-plugin-pwa` 2.0 (Workbox `generateSW`) | **Mantener** | Funciona, precachea samples y está integrado con Vite. Serwist (fork de Workbox) es la alternativa si Workbox se estanca. Hoy no hay motivo para cambiar [no hay anuncio oficial sobre el mantenimiento de Workbox]. | — | — |

## C. Web adaptativa (PWA) en iPhone, Safari macOS y Chrome

**Alcance.** La app es una **web adaptativa e instalable (PWA)**, para uso personal en el último iPhone (Safari y pantalla de inicio), Safari de macOS 27 y el último Chrome. **Decisión del usuario: no hay app nativa** (ni Capacitor, Tauri, React Native, Xcode, APK ni sideloading). No se publica en tiendas.

### Por qué no nativo

Una app nativa permitiría seguir sonando con la pantalla bloqueada y vibrar al pulso. En iOS una PWA no puede ninguna de las dos cosas: el audio se corta al bloquear o pasar a background, y `navigator.vibrate` no existe. **El usuario aceptó esa limitación** a cambio de no mantener un proyecto nativo, firmas que vencen ni herramientas de terceros. Consecuencia de diseño: la app es para tocar con la pantalla encendida (por eso el wake lock de M0 es obligatorio) y la UI avisa si el audio se interrumpe.

### Qué exige un metrónomo

1. **Timing estable.** Lo da el agendado sobre el reloj de audio, igual en Safari y Chrome.
2. **Latencia constante.** No afecta a un metrónomo: el músico se sincroniza con lo que oye. El jitter sí, y ya está resuelto por el lookahead.
3. **Que suene con el switch de silencio activado** (`navigator.audioSession.type = 'playback'`, iOS 17+).
4. **Pantalla encendida mientras suena** (Wake Lock; en PWA instalada funciona desde iOS 18.4).
5. **Bluetooth.** Agrega unos 150–300 ms de latencia fija [sin verificar el rango]. Es inevitable: advertirlo en la UI y recomendar cable o el parlante del teléfono.

### Instalar en el iPhone

Requiere que la app esté servida por **HTTPS** (hosting en Cloudflare, sección A). Una vez deployada:

1. Abrir la URL en **Safari**.
2. Tocar **Compartir** (cuadrado con flecha).
3. Elegir **Agregar a inicio** (puede requerir deslizar la lista).
4. Dejar "Abrir como app web" activado, confirmar el nombre y tocar **Agregar**.
5. Abrir el ícono desde la pantalla de inicio: corre en modo standalone, sin barra de Safari. Abrirla una vez con conexión para que el service worker precachee los samples.
6. Actualizaciones: se aplican solas al abrir con conexión (ver "Aviso de actualización" abajo). No hay nada que reinstalar ni que renovar.

### Fases

#### M0. Endurecer el audio en iOS (se implementa en un PR aparte)

> **Estado:** implementado en #41. El checklist manual en el iPhone (punto 4) queda a cargo del usuario.

1. En `src/audio/AudioContextManager.ts`:
   - Antes del primer `resume()`, si existe `navigator.audioSession`, setear `navigator.audioSession.type = 'playback'`.
   - Escuchar `statechange` y `document.visibilitychange`, y reanudar con `resume()` en estado `suspended` o `interrupted`.
   - `resume()` devuelve una promesa que WebKit puede rechazar (o dejar sin resolver) si no hay gesto de usuario activo. Siempre capturar con `.catch(...)`, sin promesas sueltas. Si falla, marcar `pendingResume = true` y reintentar en el próximo `pointerdown`/`keydown` (listener `{ once: true }`).
   - Si `resume()` no resuelve en 1 s (bug 291892), recrear el contexto y reconstruir el grafo. Hace falta un `dispose()` en `DrumSynthesizer` y `PolyphonicSynth`.
2. Wake lock: `src/hooks/useWakeLock.ts` con `navigator.wakeLock.request('screen')` mientras `isPlaying`, y volver a pedirlo en `visibilitychange` (el sistema lo libera al ocultarse la página).
   - Envolver `request` en `try/catch` (`NotAllowedError` con batería baja o ahorro de energía): seguir sin wake lock y sin romper la reproducción.
   - Guardar el `WakeLockSentinel` y llamar a `release()` cuando `isPlaying` pasa a `false` y en el cleanup del efecto.
3. Aviso de Bluetooth en la UI (texto). Opcional: compensación visual con `AudioContext.outputLatency` [sin verificar que Safari reporte la latencia BT].
4. **Checklist manual en el iPhone (iOS actual), como PWA instalada y en Safari:**
   - Suena con el switch de silencio activado.
   - Vuelve a sonar después de bloquear y desbloquear, y después de una llamada.
   - La pantalla no se apaga mientras suena.
   - Los samples (Opus) decodifican y no cae a síntesis.
   - 10 minutos a 120 BPM sin derivas audibles.
5. Tests: unit con un `audioSession` mockeado. El caso de recrear el contexto va en Vitest Browser Mode.

#### Adaptativo. Fase de adaptación a teléfono, tablet y escritorio

Estado medido en `main` y trabajo pendiente. Esfuerzo: **S** ≤ 0,5 día, **M** 1–2 días, **L** 3+ días. Cada ítem es verificable.

**Manifest e instalación**

| # | Ítem | Hoy (en `main`) | Hacer / verificar | Esfuerzo |
|---|---|---|---|---|
| A1 | Manifest: `display`, `orientation`, colores | `vite.config.ts` ya declara `display: 'standalone'`, `orientation: 'any'`, `theme_color #13110f`, `background_color #070605` | Mantener. Verificar que `background_color` coincide con el fondo real (`#070605` en `App.css`, `#0c0b0a` en `index.css`: unificar) para que el splash no parpadee. Agregar `display_override: ['standalone']` si hace falta | S |
| A2 | `id` del manifest | No tiene | Agregar `id: '/'` para que la identidad de la app no dependa de `start_url` | S |
| A3 | Íconos maskable | Hay `maskable-512x512.png` | Verificar con el visor maskable de DevTools que el motivo cabe en la zona segura (80 %). Agregar maskable 192 px | S |
| A4 | `screenshots` para la UI de instalación | No hay | Agregar 2 capturas (`form_factor: 'narrow'` 390×844 y `'wide'` 1440×900) en `public/screenshots/`, para el diálogo de instalación enriquecido de Chrome | S |
| A5 | `apple-touch-icon` y metas de iOS | `index.html` ya tiene `apple-touch-icon.png` y `theme-color`. Faltan `apple-mobile-web-app-capable` / `mobile-web-app-capable`, `apple-mobile-web-app-title` y `apple-mobile-web-app-status-bar-style` | Agregarlas (`black-translucent` si el contenido llega bajo la barra de estado; si no, `black`). Confirmar que el ícono es 180×180 sin transparencia | S |

**Pantalla, safe areas y viewport**

| # | Ítem | Hoy | Hacer / verificar | Esfuerzo |
|---|---|---|---|---|
| B1 | Safe areas (notch, Dynamic Island, barra de inicio) | `index.html` ya tiene `viewport-fit=cover`, pero **ningún CSS usa `env(safe-area-inset-*)`** | Aplicar `padding` con `env(safe-area-inset-top/right/bottom/left)` en el contenedor raíz (`main` de `App.tsx`) y en toda barra fija. Verificar en standalone y en landscape (el notch pasa al costado) | M |
| B2 | Alto de viewport | `App.tsx` usa `100dvh`, pero `index.css`, `App.css` (`html, body`, `#root`) usan `100vh` | Reemplazar por `100svh` en el fondo y `100dvh` donde el layout deba seguir a la barra del navegador. Verificar que no haya salto al mostrar u ocultar la barra de Safari | S |
| B3 | Zoom y doble toque accidentales | `touch-action` solo en `piano.css` | Poner `touch-action: manipulation` en botones, sliders y controles del mixer, y `touch-action: none` en las superficies de arrastre. Verificar que el doble toque rápido sobre TAP o BPM no haga zoom | S |
| B4 | Selección y menú contextual en controles | No evaluado | `user-select: none` y `-webkit-touch-callout: none` en teclas, botones de tempo y mixer; no en textos | S |

**Layouts por tamaño**

| # | Ítem | Hoy | Hacer / verificar | Esfuerzo |
|---|---|---|---|---|
| L1 | Breakpoints coherentes | Mezcla de breakpoints de MUI (`xs/sm/md` en `sx`) y `@media` sueltos (`899px` en el mixer, `600px` y `1000px` en `piano.css`) | Definir una tabla única (p. ej. 600 / 900 / 1200) y usarla en CSS y `sx`. Documentarla en `src/theme` | M |
| L2 | **Teléfono vertical** (390×844) | Mixer en una fila con scroll horizontal (`@media max-width: 899px`); hay un test a 390 px en `pwa-a11y.spec.ts` | Control principal (BPM, play, TAP) al alcance del pulgar, abajo. Sin scroll horizontal de la página | M |
| L3 | **Teléfono horizontal** (844×390, atril) | **No hay reglas de `orientation` ni de altura baja.** Con 390 px de alto el header y el chasis ocupan casi todo | `@media (orientation: landscape) and (max-height: 500px)`: header compacto, controles principales en columna lateral, visual y mixer lado a lado. Tamaño de BPM legible a 1–2 m | L |
| L4 | **Tablet** (768–1024, ambas orientaciones) | Cae entre el layout de teléfono (< 900) y el de escritorio | Definir si usa 2 columnas. Evitar el estado intermedio donde el mixer scrollea con espacio libre de sobra | M |
| L5 | **Escritorio** (Safari macOS y Chrome) | Layout principal de `App.tsx` con `maxWidth` por `sx` | Contener el ancho máximo y verificar ventanas muy anchas. Evaluar `@container` en `MixerConsole` y `PatternEditor` para que se adapten al contenedor y no a la ventana | M |
| L6 | Objetivos táctiles ≥ 44 px | `darkTheme.ts` fija `minHeight/minWidth: 40` en `pointer: coarse` (el de 44 solo en un componente); `.mute-button` 40×52 px | Subir todo a 44 px (WCAG 2.5.8 pide 24, Apple recomienda 44). Auditar teclas del piano, steps del editor y sliders | M |

**Tema, movimiento y offline**

| # | Ítem | Hoy | Hacer / verificar | Esfuerzo |
|---|---|---|---|---|
| T1 | `prefers-reduced-motion` | Ya manejado en `App.css`, `piano.css` y `HeaderToolbar.tsx` | Verificar que también se desactiven las animaciones del canvas (`ConductorVisual`) y los parpadeos del pulso; sustituir por un indicador estático | S |
| T2 | `prefers-color-scheme` | La app es solo oscura (`color-scheme: dark`, `darkTheme`) | **Decisión:** mantener oscuro fijo (estética de estudio, mejor en escenarios con poca luz). Dejar `color-scheme: dark` y `theme-color` coherentes para que los controles nativos (scrollbars, formularios) no salgan claros. No agregar tema claro salvo que se pida | S |
| O1 | Funcionamiento offline | Workbox precachea JS, CSS, imágenes y samples; hay test del precache | Verificar con Playwright (`context.setOffline(true)` tras la primera carga) que carga, suena y guarda presets. Probar el modo avión en el iPhone | S |
| O2 | Aviso de actualización | `registerType: 'autoUpdate'`: el SW nuevo se activa solo y la pestaña abierta puede quedar con código viejo hasta recargar | Pasar a `registerType: 'prompt'` con `useRegisterSW` (`virtual:pwa-register/react`): mostrar "Nueva versión disponible, Actualizar" (Snackbar de MUI). **No recargar mientras suena**: ofrecerlo solo con el metrónomo detenido | M |

**Checklist Playwright (adaptativo)**

Hoy `playwright.config.ts` tiene un solo proyecto (`desktop-chromium`, 1440×900) y `serviceWorkers: 'block'`. Agregar:

| # | Verificación | Esfuerzo |
|---|---|---|
| P1 | Proyecto `webkit` (`devices['Desktop Safari']`) para smoke tests de UI, CSS y manifest | S |
| P2 | Proyectos de dispositivo: `iPhone 15` (portrait y landscape) y `iPad (gen 11)` con `devices[...]`, en WebKit. Chromium con `Pixel 7` | S |
| P3 | Viewports explícitos: 390×844, **844×390**, 768×1024, 1024×768, 1440×900 | S |
| P4 | Por viewport: sin scroll horizontal (`scrollWidth <= clientWidth`), controles principales visibles sin scroll en landscape, botones ≥ 44 px (`boundingBox`), sin solapes con las safe areas (emulando `env()` con un `<style>` de prueba) | M |
| P5 | Offline (O1) y aviso de actualización (O2), con un proyecto sin `serviceWorkers: 'block'` | M |
| P6 | Capturas de regresión visual por viewport (`toHaveScreenshot`) solo en layouts estables | M |
| P7 | axe (ya existe) corrido en portrait y landscape | S |

Limitación: WebKit de Playwright no es Safari iOS. No emula `env(safe-area-inset-*)` reales, wake lock ni `audioSession`. Esos puntos se validan a mano en el iPhone con el checklist de M0 y estas dos pruebas: abrir en standalone con y sin Dynamic Island, y rotar el teléfono tocando.

**Criterio de listo de la fase:** A1–A5, B1–B3 y L2/L3/L6 resueltos y P1–P4 en verde en CI; checklist manual en el iPhone pasado.

## Qué NO cambiaría y por qué

- **React 19.** El rendimiento de audio no depende del framework: el hot path ya está fuera de React. Cambiar de framework es reescribir sin ganancia audible.
- **Vite 8 (Rolldown).** Es el bundler de referencia en 2026. No hay nada mejor para un SPA.
- **Web Audio crudo + Worker + lookahead.** Es el diseño correcto para precisión, y está cubierto por tests y por la sonda E2E. Tone.js o un AudioWorklet de agendado no mejorarían el timing.
- **El store propio.** Es chico, correcto y testeado.
- **Playwright con la sonda de audio real.** Es la mejor red de seguridad del repo.
- **PWA con `vite-plugin-pwa`/Workbox.** Funciona offline con samples incluidos.
- **MUI por ahora.** Cuesta 104 kB gzip, pero la app es offline-first y el costo se paga una vez. La migración a Base UI es una opción futura, no una urgencia.
- **Imagen Docker.** Mantenerla para self-hosting y como entorno idéntico a producción para E2E, aunque el hosting principal pase a Cloudflare.
- **Una app nativa (Capacitor, Tauri, React Native).** Descartada por decisión del usuario: la PWA alcanza.

## Orden sugerido

1. **M0** (en PR): audio en iOS. Arregla un problema real hoy.
2. **Hosting en Cloudflare** (en PR): da el HTTPS que permite instalar la PWA en el iPhone con "Agregar a inicio".
3. **Oxlint y solo TS 7** (en PR).
4. **pnpm** (en PR; o `.npmrc` endurecido si se descarta).
5. **Fase Adaptativo** (pendiente), en este orden: manifest y metas de iOS (A1–A5), safe areas y viewport (B1–B4), layouts (L1–L6), tema y offline (T, O), y los proyectos de Playwright (P1–P7) a medida que se resuelve cada layout.
6. **Vitest Browser Mode** (en PR) para el motor de audio.
7. Migración de MUI: solo con demanda.

## Fuentes

- WebKit 291892, AudioContext mudo al volver del background en PWA: https://bugs.webkit.org/show_bug.cgi?id=291892
- Foro Apple, audio en PWA y pantalla bloqueada (por qué no se puede sonar con la pantalla bloqueada): https://developer.apple.com/forums/thread/762582
- `navigator.audioSession` y el switch de silencio: https://bugs.webkit.org/show_bug.cgi?id=261554
- Wake Lock en PWA de iOS (corregido en 18.4): https://bugs.webkit.org/show_bug.cgi?id=254545 · https://progressier.com/pwa-capabilities/screen-wake-lock
- Web MIDI en Safari: https://caniuse.com/midi · https://bugs.webkit.org/show_bug.cgi?id=107250
- pnpm 11: https://pnpm.io/blog/releases/11.0 · Shai-Hulud: https://www.picussecurity.com/resource/blog/shai-hulud-worm-inside-the-npm-supply-chain-attack
- npm `min-release-age` y npm 12: https://apostrophecms.com/docs/guide/npm-v12-install-scripts.html
- Bun `minimumReleaseAge`: https://bun.com/docs/pm/cli/install
- TypeScript 7: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/ · https://infoq.com/news/2026/08/typescript-7-released/
- typescript-eslint y TS 7: https://github.com/typescript-eslint/typescript-eslint/issues/12518 (y el peer `typescript <6.1.0` verificado en `node_modules`)
- Oxlint type-aware estable: https://oxc.rs/blog/2026-07-22-type-aware-linting-stable · Biome: https://biomejs.dev/blog/roadmap-2026/
- Vitest 4 Browser Mode estable: https://voidzero.dev/posts/announcing-vitest-4
- Vite 8: https://vite.dev/blog/announcing-vite8
- Cloudflare Workers `_headers`: https://developers.cloudflare.com/workers/static-assets/headers/
- React Compiler 1.0: https://react.dev/blog/2025/10/07/react-compiler-1 · soporte experimental vía oxc en `@vitejs/plugin-react` 6 (README del paquete instalado)
- Pigment CSS en pausa y Base UI: https://next.mui.com/blog/2026-and-beyond · Base UI 1.0: https://unpkg.com/@base-ui/react@1.6.0/docs/react/overview/releases.md
