> **Estado:** Pendiente (propuesta). Investigación y plan, sin cambios de código. Base: `main` en `a280b3c` (2026-10-03).

# Evaluación de tooling, librerías y salida mobile nativa — Metrónomo by Cucco

Fecha: 2026-10-03 · Rama: `docs/plan-tooling-and-mobile`

## Objetivo

Responder dos preguntas:

1. ¿Qué herramientas, frameworks y librerías conviene migrar, y las elecciones actuales son las mejores para esta app?
2. ¿Cómo publicar la app para iPhone y Android?

Dispositivos objetivo: solo el último iPhone con el último iOS, Safari de macOS y Chrome actual (desktop y Android).

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
| Audio | Web Audio crudo: reloj en Worker (`setInterval` de 25 ms) con agendado *lookahead* (`Scheduler.ts`), samples WAV/OGG con síntesis de respaldo, armonía sintetizada (`PolyphonicSynth`) |
| Estado | Store externo con `useSyncExternalStore` (`src/state/playbackStore.ts`) y `usePersistentState` validado en `localStorage` |
| Bundle (gzip) | `mui` 104 kB · `vendor` (React) 68 kB · app 39 kB · CSS 3,5 kB. El precache PWA suma 66 entradas y 6,25 MB, casi todo samples e imágenes |
| Deploy | Imagen Docker con nginx 1.31 en GHCR, con headers OWASP en `deploy/security-headers.conf` |

> Nota: el pedido original mencionaba MUI v7, samples Opus, piano sampleado y un looper de melodía. En `main` hay MUI v9, samples WAV/OGG y armonía sintetizada, y no hay looper. El plan se basa en lo que existe hoy.

## Resumen ejecutivo

Recomendaciones ordenadas por impacto sobre esfuerzo:

| # | Recomendación | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | **Endurecer el audio en iOS antes de cualquier wrapper.** Usar `navigator.audioSession.type = 'playback'` para que suene con el switch de silencio activado. Pedir Screen Wake Lock mientras suena. Llamar a `resume()` en `visibilitychange`/`statechange` (manejando `interrupted`). Verificar en un iPhone real el bug de WebKit 291892, en el que el `AudioContext` queda mudo al volver del background. | Alto: hoy en iPhone el click puede no sonar | Bajo (1–2 días) |
| 2 | **Salida mobile con Capacitor 8** sobre el mismo build de Vite, con una spike en iPhone real y criterios de go/no-go. Android con el mismo proyecto Capacitor (TWA queda como plan B). | Alto: App Store y Play Store | Medio (2–4 semanas en total) |
| 3 | **Reemplazar ESLint + typescript-eslint por Oxlint con type-aware (tsgolint, basado en TS 7).** Se elimina TypeScript 6 y el alias `typescript7`, y el lint pasa a tener reglas con tipos, que hoy no tiene. | Medio: una sola versión de TS, lint 10x+ más rápido | Bajo (1 día) |
| 4 | **Seguridad de la cadena de dependencias.** Migrar a pnpm 11 (`minimumReleaseAge` de 24 h por defecto y builds de dependencias bloqueados). Si se descarta pnpm, configurar en npm 11 `min-release-age` y `ignore-scripts`. | Medio: defensa contra gusanos tipo Shai-Hulud | Bajo (medio día) |
| 5 | **Tests de audio y canvas en Vitest Browser Mode** (Chromium real vía Playwright) para `Scheduler`, `DrumSynthesizer` y `PolyphonicSynth` con `OfflineAudioContext`. jsdom queda para hooks y lógica pura. | Medio: menos mocks y más confianza en el timing | Medio (3–5 días) |

Lo que **no** cambiaría está al final: React, Vite, Web Audio crudo, el store propio, Playwright y la PWA con Workbox. Sobre MUI: es el mayor costo de bundle, pero hoy migrarlo no se justifica (detalle abajo).

## A. Tooling

| Área | Actual | Recomendado | Por qué | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| Gestor de paquetes | npm 11 | **pnpm 11**, instalado sin corepack | Node 25+ ya no trae corepack. pnpm 11 trae `minimumReleaseAge` de 1440 min por defecto, builds de dependencias bloqueados salvo `allowBuilds`, y bloquea subdependencias git/tarball. Es exactamente la defensa contra Shai-Hulud (sep. y nov. 2025). Bun también tiene `minimumReleaseAge` y scripts apagados, pero suma un runtime más sin beneficio para un SPA. | 0,5 día | Bajo. El plan de pnpm sigue **en espera**: decide el usuario. |
| Lint | ESLint 10 + typescript-eslint 8 sobre TS 6 | **Oxlint 1.x + `oxlint-tsgolint`** (type-aware, sobre TS 7) | typescript-eslint no soporta TS 7 porque falta la API programática, prevista para TS 7.1 [sin verificar la fecha]. tsgolint ya es estable (jul. 2026) y cubre 59 de 61 reglas type-aware. Oxlint tiene reglas `react-hooks`, `react-refresh` y `typescript` nativas. Biome 2 es una alternativa válida, pero su inferencia de tipos propia es menos completa. | 1 día | Medio-bajo. Las reglas del React Compiler en `eslint-plugin-react-hooks` 7 quizá no estén todas en Oxlint [sin verificar]. Si importan, mantener ESLint solo con ese plugin, sin type-aware. |
| Formateo | Ninguno | **Opcional: oxfmt** cuando salga de beta | No hay formatter hoy y el estilo es mixto (`;` y `"` en algunos archivos). Es de bajo valor para un repo de una persona. | 0,5 día | Bajo |
| Type checker | TS 7.0 (`typescript7`) + TS 6.0 | **Solo TS 7**, como `typescript@7` sin alias, cuando se quite typescript-eslint | El alias existe solo por ESLint. Con Oxlint se borra `typescript@6` y `package.json` vuelve a `tsc -b`. | Incluido en Lint | Bajo |
| Tests unitarios | Vitest 5 + jsdom con mocks de Web Audio | **Vitest 5 con dos proyectos:** `unit` (jsdom) y `browser` (Browser Mode, provider `@vitest/browser-playwright`, Chromium) | Browser Mode es estable desde Vitest 4. En Chromium real existen `AudioContext`, `OfflineAudioContext` y canvas: se puede renderizar un compás offline y medir onsets y niveles en vez de afirmar llamadas a mocks. Los mocks hoy validan "se llamó `start(t)`", no "sonó en t". | 3–5 días | Medio. Es más lento que jsdom, y la cobertura v8 en Browser Mode necesita configurarse aparte. |
| E2E | Playwright (Chromium) + sonda de audio + axe | **Mantener.** Agregar el proyecto `webkit` para smoke tests de UI y PWA. | Playwright es el estándar. La sonda de audio real es un activo. WebKit de Playwright no es Safari iOS, pero detecta regresiones de CSS/JS en WebKit. El audio en iOS se valida a mano en el dispositivo (checklist de la fase M0). | 0,5 día | Bajo |
| Bundler | Vite 8 (Rolldown) | **Mantener** | Es lo más moderno del ecosistema. Vite+ (VoidZero) unifica Vite, Vitest, Oxlint y oxfmt bajo un CLI. Conviene mirarlo cuando sea GA [sin verificar el estado], pero no aporta nada que no se pueda lograr con las piezas sueltas. | — | — |
| Hosting | Docker + nginx en GHCR (sin destino de deploy definido en el repo) | **Cloudflare Workers Static Assets** (o Pages) con `_headers`. Docker queda para self-hosting. | Es un sitio 100% estático. Cloudflare sirve `_headers` (CSP, `Cache-Control`), da CDN global y HTTPS gratis, y deploya desde CI con `wrangler`. Pages está en modo mantenimiento y Workers es lo recomendado para proyectos nuevos [fuente secundaria]. GitHub Pages **no** sirve: no permite headers propios (CSP, `no-cache` del `sw.js`). Netlify es equivalente a Cloudflare. | 1 día | Bajo. Hay que mantener nginx y `_headers` sincronizados (se pueden generar ambos desde `deploy/security-headers.conf`, como ya hace `vite.config.ts`). |
| CI | 3 jobs (quality, e2e, nginx) + publish Docker + Gemini review | **Mantener la estructura.** Arreglar la deriva de la imagen nginx: CI valida con `1.30.5` y el Dockerfile usa `1.31.0`. Sumar los jobs mobile de la sección C. | La estructura es correcta. La deriva hace que `nginx -t` valide una versión que no es la que se publica. | 0,5 día | Bajo |

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
| Formatos de audio | WAV (~1,6 MB) + OGG | **Unificar en un formato comprimido** después de verificar en el iPhone que `decodeAudioData` acepta Ogg Vorbis/Opus. Si no lo acepta, usar AAC (`.m4a`). | Ahorra ~1,3 MB del precache. En Safari, el soporte de Ogg en `decodeAudioData` llegó tarde [sin verificar la versión exacta]. Hoy, si falla la decodificación, la app cae a síntesis sin aviso: conviene un test E2E o manual que lo detecte. | 0,5 día | Bajo |
| MIDI | No hay | **No priorizar.** Si se hace, que sea una mejora progresiva solo en Chrome. | Web MIDI sigue sin soporte en Safari (macOS e iOS; WebKit bug 107250 abierto). En el target principal (iPhone) no existe. En Capacitor haría falta un plugin nativo CoreMIDI. | — | — |
| Visuales | Canvas 2D en el hilo principal | **Mantener canvas 2D.** OffscreenCanvas en Worker solo si se mide jank. | Son dibujos simples a 60 fps. WebGL no aporta. OffscreenCanvas 2D en Worker existe en Safari desde 16.4–17 [sin verificar la versión exacta], pero su beneficio es nulo mientras el hilo principal esté libre. | — | — |
| PWA | `vite-plugin-pwa` 2.0 (Workbox `generateSW`) | **Mantener** | Funciona, precachea samples y está integrado con Vite. Serwist (fork de Workbox) es la alternativa si Workbox se estanca. Hoy no hay motivo para cambiar [no hay anuncio oficial sobre el mantenimiento de Workbox]. | — | — |

## C. Mobile nativo (iPhone y Android)

### Qué exige un metrónomo

1. **Timing estable.** Lo da el agendado sobre el reloj de audio, igual en Safari, WKWebView y Chrome.
2. **Latencia constante.** Una latencia constante no afecta a un metrónomo: el músico se sincroniza con lo que oye. El jitter sí, y el jitter ya está resuelto por el lookahead.
3. **Que suene con el switch de silencio activado.**
4. **Pantalla encendida mientras suena** (wake lock).
5. **Deseable: seguir sonando con la pantalla bloqueada.**
6. **Bluetooth.** Agrega unos 150–300 ms de latencia fija [sin verificar el rango]. Es inevitable en cualquier tecnología. Hay que advertirlo en la UI y recomendar cable o el parlante del teléfono.

### Opciones evaluadas

| Opción | Silencio (switch) | Pantalla bloqueada / background | Wake lock | Háptica | Tiendas | Costo y esfuerzo | Veredicto |
|---|---|---|---|---|---|---|---|
| **1. Solo PWA** | Sí, con `navigator.audioSession.type = 'playback'` (iOS 17+) | **No.** El audio se corta al bloquear o pasar a background. Además existe el bug WebKit 291892: en PWA de pantalla de inicio el `AudioContext` puede quedar mudo al volver [sin verificar si está corregido en iOS 26/27] | Sí en PWA instalada desde iOS 18.4 | No (`navigator.vibrate` no existe en iOS) | No | $0, bajo | **Necesaria igual** (fase M0) |
| **2. Capacitor 8** (mismo build Vite en WKWebView / Android WebView) | Sí, con `AVAudioSession` `.playback` desde nativo, o con `audioSession` desde JS | **Limitado.** WKWebView suspende el Web Audio unos 30 s después de pasar a background, incluso con `UIBackgroundModes: audio` [reportes de foros]. El background real exige audio nativo (plugin propio) | Sí (`@capacitor-community/keep-awake`) | Sí (`@capacitor/haptics`) | Sí | $99/año Apple + $25 Google [montos conocidos, confirmar], medio | **Recomendada** |
| **3. TWA / Bubblewrap** (solo Android) | No aplica: Android no tiene switch de silencio para medios | Igual que Chrome (se suspende) | Sí (Wake Lock web) | Sí (`navigator.vibrate`) | Play Store | Bajo. Requiere Digital Asset Links y target API 36 desde el 31-08-2026 | **Plan B para Android** si no hace falta nada nativo |
| **4. Tauri 2 mobile** | Igual que Capacitor (también WKWebView) | Igual que Capacitor | Plugin | Plugin | Sí | Medio-alto: agrega Rust y su ecosistema mobile es menos maduro | No: es Capacitor con más fricción |
| **5. React Native / Expo + `react-native-audio-api`** | Sí (nativo) | **Sí** (audio nativo, background real) | Sí | Sí | Sí | **Alto**: reescribir toda la UI (MUI, canvas → Skia) y portar el motor a un API "tipo Web Audio" (C++ sobre CoreAudio/Oboe) | Solo si el background bloqueado es imprescindible y el camino 2 + plugin nativo falla |

**Apple 4.2 (minimum functionality).** Un wrapper que solo carga una URL se rechaza. Esta app tiene a favor que funciona 100% offline (los assets van dentro del bundle, no se carga una URL), tiene audio con sesión nativa, háptica en el pulso y keep-awake. Los revisores prueban en modo avión. Con Capacitor el contenido se empaqueta local, así que ese caso queda cubierto.

### Recomendación

**Capacitor 8 para iOS y Android**, sobre el mismo código. Va en fases y con una spike medible antes de pagar cuentas de desarrollador:

- Un solo proyecto, un solo pipeline y los mismos plugins (háptica, keep-awake, sesión de audio) en las dos plataformas.
- El motor de audio web se queda tal cual. En primer plano, WKWebView y Android WebView agendan igual que Safari y Chrome.
- El "suena con la pantalla bloqueada" se trata como fase opcional M3. Es el único requisito que la web no resuelve. La solución es un **plugin nativo de metrónomo** (`AVAudioEngine` en Swift, Oboe/AAudio o `AudioTrack` en Kotlin) que reproduzca click y acentos en background, no reescribir toda la app en React Native.

### Fases

#### M0. Endurecer la PWA (sirve también dentro de Capacitor)

1. En `src/audio/AudioContextManager.ts`:
   - Antes del primer `resume()`, si existe `navigator.audioSession`, setear `navigator.audioSession.type = 'playback'`.
   - Escuchar `statechange` y `document.visibilitychange`, y reanudar con `resume()` en estado `suspended` o `interrupted`.
   - Si `resume()` no resuelve en 1 s (bug 291892), recrear el contexto y reconstruir el grafo. Hace falta un `dispose()` en `DrumSynthesizer` y `PolyphonicSynth`.
2. Wake lock: crear `src/hooks/useWakeLock.ts` con `navigator.wakeLock.request('screen')` mientras `isPlaying`, y volver a pedirlo en `visibilitychange`.
3. Agregar un aviso de Bluetooth en la UI (texto). Opcional: compensación visual con `AudioContext.outputLatency` [sin verificar que Safari reporte la latencia BT].
4. **Checklist manual en iPhone 18 Pro (iOS actual), como PWA instalada y en Safari:**
   - Suena con el switch de silencio activado.
   - Vuelve a sonar después de bloquear y desbloquear, y después de una llamada.
   - La pantalla no se apaga mientras suena.
   - Los samples OGG decodifican (no cae a síntesis).
   - 10 minutos a 120 BPM sin derivas audibles.
5. Tests: unit con un `audioSession` mockeado. El caso de recrear el contexto va en Vitest Browser Mode.

#### M1. Spike de Capacitor en iOS (go/no-go, sin cuenta paga)

```bash
pnpm add @capacitor/core @capacitor/haptics @capacitor-community/keep-awake   # o npm i
pnpm add -D @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Metrónomo by Cucco" ar.cucco.metronomo --web-dir dist
npx cap add ios && npx cap add android
pnpm build && npx cap sync
npx cap open ios   # correr en el iPhone con un Apple ID gratis (provisioning personal, 7 días)
```

Archivos nuevos:

- `capacitor.config.ts` con `webDir: 'dist'` y `ios.contentInset: 'never'`.
- `ios/App/App/AppDelegate.swift`, con `AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)` y `setActive(true)`.
- `ios/App/App/Info.plist`, con `UIBackgroundModes: [audio]` solo si M3 avanza.
- Carpetas `android/` e `ios/` versionadas.

Cambios en la app:

- `src/platform/native.ts`, con detección `Capacitor.isNativePlatform()`, háptica en el downbeat (opcional, configurable) y keep-awake en lugar de Wake Lock web.
- `vite.config.ts`: desactivar el registro del service worker cuando se compila para nativo (`VITE_NATIVE=1`), porque los assets ya van empaquetados.
- La CSP sigue aplicando vía `<meta>`. Revisar el esquema `capacitor://localhost`.

**Criterios de go:**

- El checklist de M0 pasa también en WKWebView.
- El jitter medido con la sonda de audio (adaptada para ejecutarse en WebView) no es peor que en Safari.
- Arranque en frío menor a 1,5 s.

#### M2. Publicación (cuentas pagas)

- Costos: Apple Developer Program, $99/año, y Google Play Console, $25 una vez [confirmar montos vigentes]. Android exige además la verificación de identidad de desarrollador que Google viene desplegando en 2026, y el target SDK 36 (Capacitor 8 ya compila contra SDK 36).
- Firma:
  - iOS: App Store Connect API key (`.p8`) en secrets y `fastlane` con `match` en un repo privado de certificados, o firma automática de Xcode con la API key.
  - Android: un upload keystore en secrets con Play App Signing.
- CI: crear `.github/workflows/mobile.yml`, que dispara en tags `v*` y `workflow_dispatch`.
  - Job `ios` en `macos-26` (Xcode 26.x): `pnpm build && npx cap sync ios`, después `fastlane ios beta` (build y subida a TestFlight).
  - Job `android` en `ubuntu-latest`: `npx cap sync android` y `./gradlew bundleRelease`, después `fastlane android internal` (track interno de Play).
  - Costo de CI: el repo es **público**, así que los runners estándar de GitHub (incluido macOS) no tienen costo [confirmar en la documentación de GitHub]. Si el repo pasa a privado, los minutos de macOS cuentan 10x.
- Archivos: `fastlane/Fastfile`, `fastlane/Appfile`, `fastlane/Matchfile`, `.github/workflows/mobile.yml`, y metadata de la tienda (capturas, textos en español, política de privacidad: sin datos recolectados).
- Actualizaciones OTA: no al principio. Con los assets empaquetados, cada cambio de web pasa por la tienda. Si molesta, usar Capgo o Capawesome Live Updates (Ionic Appflow cierra en 2027 [fuente secundaria]). El cambio debe respetar la regla de Apple de no alterar el propósito de la app.

#### M3 (opcional). Metrónomo en background con pantalla bloqueada

Solo si los usuarios lo piden: es lo que más trabajo cuesta.

- Crear un plugin Capacitor local `plugins/native-metronome`:
  - iOS: `AVAudioEngine` con `AVAudioPlayerNode.scheduleBuffer(at:)`.
  - Android: Oboe o `AudioTrack` con un foreground service de tipo `mediaPlayback`.
- El plugin replica solo el click con acentos y subdivisiones, no los grooves completos.
- Al pasar a background, el JS hace handoff al plugin con BPM, compás y fase. Al volver, el JS retoma.
- Riesgo alto: dos motores que tienen que quedar en fase. Por eso es opcional.

## Qué NO cambiaría y por qué

- **React 19.** El rendimiento de audio no depende del framework: el hot path ya está fuera de React. Cambiar de framework es reescribir sin ganancia audible.
- **Vite 8 (Rolldown).** Es el bundler de referencia en 2026. No hay nada mejor para un SPA.
- **Web Audio crudo + Worker + lookahead.** Es el diseño correcto para precisión, y está cubierto por tests y por la sonda E2E. Tone.js o un AudioWorklet de agendado no mejorarían el timing.
- **El store propio.** Es chico, correcto y testeado.
- **Playwright con la sonda de audio real.** Es la mejor red de seguridad del repo.
- **PWA con `vite-plugin-pwa`/Workbox.** Funciona offline con samples incluidos.
- **MUI por ahora.** Cuesta 104 kB gzip, pero la app es offline-first y el costo se paga una vez. La migración a Base UI es una opción futura, no una urgencia.
- **Imagen Docker.** Mantenerla para self-hosting y como entorno idéntico a producción para E2E, aunque el hosting principal pase a Cloudflare.
- **React Native.** No reescribir salvo que M3 sea imprescindible y el plugin nativo fracase.

## Orden sugerido

1. M0: audio en iOS. Arregla un problema real hoy.
2. Oxlint y solo TS 7.
3. Decisión de pnpm (en espera del usuario) o `.npmrc` endurecido.
4. M1: spike de Capacitor.
5. Vitest Browser Mode para el motor de audio.
6. Hosting en Cloudflare.
7. M2: publicación.
8. M3 y migración de MUI: solo con demanda.

## Fuentes

- WebKit 291892, AudioContext mudo al volver del background en PWA: https://bugs.webkit.org/show_bug.cgi?id=291892
- Foro Apple, audio en PWA y pantalla bloqueada: https://developer.apple.com/forums/thread/762582
- `navigator.audioSession` y el switch de silencio: https://bugs.webkit.org/show_bug.cgi?id=261554
- Wake Lock en PWA de iOS (corregido en 18.4): https://bugs.webkit.org/show_bug.cgi?id=254545 · https://progressier.com/pwa-capabilities/screen-wake-lock
- Web MIDI en Safari: https://caniuse.com/midi · https://bugs.webkit.org/show_bug.cgi?id=107250
- Capacitor 8: https://ionic.io/blog/announcing-capacitor-8 · requisitos: https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8
- Audio en background con Capacitor (requiere reproducción nativa): https://capawesome.io/blog/how-to-play-audio-in-the-background-in-capacitor/ · https://developer.apple.com/forums/thread/781787
- Cierre de Appflow (fuente secundaria): https://capgo.app/blog/appflow-shutdown-alternative
- Apple 4.2 y wrappers: https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- Play, target API 36: https://developer.android.com/google/play/requirements/target-sdk · verificación de desarrolladores: https://android-developers.googleblog.com/2026/06/android-developer-verification.html
- TWA: https://web.dev/articles/using-a-pwa-in-your-android-app
- Tauri 2: https://v2.tauri.app/blog/roadmap-to-tauri-2-0/
- react-native-audio-api: https://docs.swmansion.com/react-native-audio-api/
- Runner `macos-26`: https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/
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
