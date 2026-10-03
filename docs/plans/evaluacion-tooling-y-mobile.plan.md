> **Estado:** Pendiente (propuesta). Investigación y plan, sin cambios de código. Base: `main` en `61e675b` (2026-10-03). Revisado el mismo día: la salida mobile es solo para uso personal, sin tiendas.

# Evaluación de tooling, librerías y uso en el celular — Metrónomo by Cucco

Fecha: 2026-10-03 · Rama: `docs/plan-tooling-and-mobile`

## Objetivo

Responder dos preguntas:

1. ¿Qué herramientas, frameworks y librerías conviene migrar, y las elecciones actuales son las mejores para esta app?
2. ¿Cómo instalar la app en el iPhone propio (y quizá en un Android) para uso personal, sin publicarla en tiendas?

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

> Nota: este plan se basa en `main`, que tiene MUI **v9.4** (no v7), samples WAV/OGG y armonía sintetizada. Hay dos PR abiertos que cambian el panorama de audio:
> - **#20** pasa todos los samples a **Opus** (−95% de audio).
> - **#26** agrega piano (armonía, teclado tocable y modo melodía).
>
> Si se mergean, las filas de audio de este plan aplican igual. La de formatos queda resuelta por #20, siempre que se verifique Opus en el iPhone.

## Resumen ejecutivo

Recomendaciones ordenadas por impacto sobre esfuerzo:

| # | Recomendación | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | **Endurecer el audio en iOS antes de cualquier wrapper.** Usar `navigator.audioSession.type = 'playback'` para que suene con el switch de silencio activado. Pedir Screen Wake Lock mientras suena. Llamar a `resume()` en `visibilitychange`/`statechange` (manejando `interrupted`). Verificar en un iPhone real el bug de WebKit 291892, en el que el `AudioContext` queda mudo al volver del background. | Alto: hoy en iPhone el click puede no sonar | Bajo (1–2 días) |
| 2 | **App nativa personal con Capacitor 8**, instalada directo en el iPhone con Developer Mode y un Apple ID gratis (Personal Team; reinstalación semanal con un comando). En Android, APK por `adb`. Sin tiendas. | Alto: háptica, keep-awake y sesión de audio nativos, y camino a sonar con la pantalla bloqueada | Medio (3–5 días) |
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
| CI | 3 jobs (quality, e2e, nginx) + publish Docker + Gemini review | **Mantener la estructura.** La deriva de la imagen nginx entre CI y Dockerfile ya se corrigió en el PR #36. Opcional: un job que genere el APK de Android como artifact (sección C, M2). | La estructura es correcta. | 0,5 día | Bajo |

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
| Formatos de audio | WAV (~1,6 MB) + OGG en `main`; el PR #20 lo pasa todo a Opus | **Mergear #20** después de verificar en el iPhone que `decodeAudioData` acepta Opus. Si no lo acepta, usar AAC (`.m4a`). | Achica fuerte el precache. En Safari, el soporte de Ogg en `decodeAudioData` llegó tarde [sin verificar la versión exacta]. Hoy, si falla la decodificación, la app cae a síntesis sin aviso: conviene un test E2E o manual que lo detecte. | 0,5 día | Bajo |
| MIDI | No hay | **No priorizar.** Si se hace, que sea una mejora progresiva solo en Chrome. | Web MIDI sigue sin soporte en Safari (macOS e iOS; WebKit bug 107250 abierto). En el target principal (iPhone) no existe. En Capacitor haría falta un plugin nativo CoreMIDI. | — | — |
| Visuales | Canvas 2D en el hilo principal | **Mantener canvas 2D.** OffscreenCanvas en Worker solo si se mide jank. | Son dibujos simples a 60 fps. WebGL no aporta. OffscreenCanvas 2D en Worker existe en Safari desde 16.4–17 [sin verificar la versión exacta], pero su beneficio es nulo mientras el hilo principal esté libre. | — | — |
| PWA | `vite-plugin-pwa` 2.0 (Workbox `generateSW`) | **Mantener** | Funciona, precachea samples y está integrado con Vite. Serwist (fork de Workbox) es la alternativa si Workbox se estanca. Hoy no hay motivo para cambiar [no hay anuncio oficial sobre el mantenimiento de Workbox]. | — | — |

## C. Mobile: uso personal en iPhone (y Android)

**Alcance.** La app es solo para uso personal en el iPhone 18 Pro del autor, y quizá en un teléfono Android. No se publica en App Store ni en Play Store. Por eso no aplican las reglas de revisión de Apple (4.2), TestFlight, los tracks de Play, la subida a tiendas con fastlane, ni los aranceles de las tiendas como requisito.

### Qué exige un metrónomo

1. **Timing estable.** Lo da el agendado sobre el reloj de audio, igual en Safari, WKWebView y Chrome.
2. **Latencia constante.** Una latencia constante no afecta a un metrónomo: el músico se sincroniza con lo que oye. El jitter sí, y el jitter ya está resuelto por el lookahead.
3. **Que suene con el switch de silencio activado.**
4. **Pantalla encendida mientras suena** (wake lock).
5. **Deseable: seguir sonando con la pantalla bloqueada.**
6. **Bluetooth.** Agrega unos 150–300 ms de latencia fija [sin verificar el rango]. Es inevitable en cualquier tecnología. Hay que advertirlo en la UI y recomendar cable o el parlante del teléfono.

### Opciones evaluadas

| Opción | Silencio (switch) | Pantalla bloqueada / background | Wake lock | Háptica | Costo | Mantenimiento | Veredicto |
|---|---|---|---|---|---|---|---|
| **0. PWA "Agregar a inicio"** (Safari → Compartir → Agregar a inicio) | Sí, con `navigator.audioSession.type = 'playback'` (iOS 17+). Sin eso, el default `ambient` se silencia con el switch. | **No.** El audio se corta al bloquear la pantalla o pasar a background [foros de Apple]. Además existe el bug WebKit 291892: en PWA de pantalla de inicio el `AudioContext` puede quedar mudo al volver [sin verificar si está corregido en iOS 26/27]. | Sí en PWA instalada desde iOS 18.4 | No (`navigator.vibrate` no existe en iOS) | $0. Necesita estar servida por HTTPS (Cloudflare, sección A). | Ninguno: se actualiza sola con el service worker | **Base obligatoria** (M0). Suficiente si no hace falta sonar con la pantalla bloqueada. |
| **1. Capacitor 8 + Xcode, instalado por cable o Wi-Fi con Developer Mode** | Sí, con `AVAudioSession` `.playback` desde `AppDelegate`, o con `audioSession` desde JS | **Limitado.** WKWebView suspende el Web Audio unos 30 s después de pasar a background, incluso con `UIBackgroundModes: audio` [reportes de foros]. El background real exige audio nativo (M3). | Sí (`@capacitor-community/keep-awake`) | Sí (`@capacitor/haptics`) | $0 con Apple ID gratis ("Personal Team"). $99/año solo como comodidad. | Con cuenta gratis hay que reinstalar cada 7 días desde la Mac (un comando, M2) | **Recomendada** |
| **2. Android: APK de Capacitor por `adb` o archivo** | No aplica (Android no tiene switch de silencio para medios) | Igual que Chrome (se suspende) salvo plugin nativo con foreground service (M3) | Sí | Sí | $0, sin Play Console | Ninguno: el APK firmado no vence | **Recomendada** si se usa Android (mismo proyecto Capacitor) |
| **3. Tauri 2 mobile** | Igual que Capacitor (también WKWebView) | Igual que Capacitor | Plugin | Plugin | $0 | Agrega Rust; su ecosistema mobile es menos maduro | No: es Capacitor con más fricción |
| **4. React Native / Expo + `react-native-audio-api`** | Sí (nativo) | **Sí** (audio nativo) | Sí | Sí | $0 | **Alto**: reescribir toda la UI (MUI, canvas → Skia) y portar el motor | No, salvo que M3 fracase y el background sea imprescindible |

### Recomendación

**Primero la PWA endurecida (M0), después Capacitor 8 instalado directo en el iPhone con la cuenta gratis.** Android usa el mismo proyecto, con APK por `adb`.

- La PWA ya funciona hoy y no cuesta nada. M0 arregla el switch de silencio, la pantalla que se apaga y el audio mudo al volver. Si eso alcanza, Capacitor es opcional.
- Capacitor agrega lo que la PWA no puede: sesión de audio nativa garantizada, háptica en el pulso, keep-awake nativo y el camino a M3 (sonar con la pantalla bloqueada).
- El motor de audio web se queda tal cual. En primer plano, WKWebView agenda igual que Safari.
- La cuenta paga ($99/año) **no hace falta**. Solo evita reinstalar cada 7 días (los perfiles duran un año) y habilita sin ambigüedad la capability Background Modes. Conviene evaluarla después de usar la cuenta gratis unas semanas.

### Límites de la firma gratuita ("Personal Team")

| Tema | Cuenta gratis (Apple ID) | Cuenta paga ($99/año, opcional) |
|---|---|---|
| Vigencia del perfil | **7 días.** Al vencer, la app no abre hasta reinstalarla desde Xcode (`npm run ios:install`). Los datos (`localStorage`) se conservan si se reinstala sobre la misma app [sin verificar en iOS 26/27]. | 1 año |
| Límites | Hasta 3 apps instaladas por dispositivo, 10 App IDs cada 7 días y 3 dispositivos [Microsoft Learn / foros de Apple] | Sin límites prácticos para uso personal |
| Capabilities | Sin Push, App Groups, iCloud ni extensiones. **Background Modes figura solo para la membresía paga** en la tabla de capabilities de Apple. Pero `UIBackgroundModes` es una clave de `Info.plist`, no un entitlement firmado, y hay reportes de que funciona con Personal Team [sin verificar: probar en M1]. Solo importa para M3. | Todas |
| Developer Mode | Obligatorio (iOS 16+) | Obligatorio para builds de desarrollo |

**Refresco automático estilo SideStore/AltStore.** SideStore (compatible con iOS 26 según guías de terceros) re-firma las apps desde el propio iPhone con un túnel VPN local, sin la Mac, y así evita el vencimiento de 7 días. Advertencias:

- Le da credenciales del Apple ID a una herramienta de terceros.
- Se rompe con cambios de iOS.
- Ocupa uno de los 3 slots de app.
- Agrega superficie de ataque.

Para una sola app propia, reinstalar desde la Mac una vez por semana (un comando) es más simple y seguro. **No lo recomiendo** salvo que la reinstalación semanal moleste mucho; en ese caso, la cuenta paga es la alternativa limpia.

### Fases

#### M0. Endurecer la PWA (sirve también dentro de Capacitor)

1. En `src/audio/AudioContextManager.ts`:
   - Antes del primer `resume()`, si existe `navigator.audioSession`, setear `navigator.audioSession.type = 'playback'`.
   - Escuchar `statechange` y `document.visibilitychange`, y reanudar con `resume()` en estado `suspended` o `interrupted`.
   - Si `resume()` no resuelve en 1 s (bug 291892), recrear el contexto y reconstruir el grafo. Hace falta un `dispose()` en `DrumSynthesizer` y `PolyphonicSynth`.
2. Wake lock: crear `src/hooks/useWakeLock.ts` con `navigator.wakeLock.request('screen')` mientras `isPlaying`, y volver a pedirlo en `visibilitychange`.
3. Agregar un aviso de Bluetooth en la UI (texto). Opcional: compensación visual con `AudioContext.outputLatency` [sin verificar que Safari reporte la latencia BT].
4. **Checklist manual en el iPhone 18 Pro (iOS actual), como PWA instalada y en Safari:**
   - Suena con el switch de silencio activado.
   - Vuelve a sonar después de bloquear y desbloquear, y después de una llamada.
   - La pantalla no se apaga mientras suena.
   - Los samples decodifican (no cae a síntesis).
   - 10 minutos a 120 BPM sin derivas audibles.
5. Tests: unit con un `audioSession` mockeado. El caso de recrear el contexto va en Vitest Browser Mode.

#### M1. Capacitor instalado en el iPhone (cuenta gratis)

Requisitos: una Mac con Xcode 26+ (Capacitor 8 lo exige), el iPhone y un Apple ID.

```bash
npm i @capacitor/core @capacitor/haptics @capacitor-community/keep-awake   # o pnpm add
npm i -D @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Metrónomo" ar.cucco.metronomo --web-dir dist   # bundle id único; cambiarlo si Xcode dice que está tomado
npx cap add ios && npx cap add android
npm run build && npx cap sync
npx cap open ios
```

**Pasos en Xcode y en el iPhone:**

1. Xcode → Settings → Accounts → `+` → Apple ID. Se crea el equipo "*Tu Nombre* (Personal Team)".
2. Target `App` → **Signing & Capabilities**: tildar *Automatically manage signing*, elegir **Team = Personal Team** y confirmar el *Bundle Identifier* (`ar.cucco.metronomo`).
3. Conectar el iPhone por USB-C y aceptar "Confiar en esta computadora".
4. En el iPhone, ir a **Ajustes → Privacidad y seguridad → Modo de desarrollador**, activarlo y reiniciar. La opción aparece después de conectar el equipo a Xcode por primera vez.
5. Elegir el iPhone como destino y ejecutar (⌘R). La primera vez iOS bloquea la app.
6. En el iPhone, ir a **Ajustes → General → VPN y gestión de dispositivos**, tocar el perfil de desarrollador con el Apple ID y elegir **Confiar**.
7. Wi-Fi (opcional): en Xcode → Window → Devices and Simulators → el iPhone → *Connect via network*. Después se puede instalar sin cable, con la Mac y el iPhone en la misma red.

Archivos y cambios:

- `capacitor.config.ts` con `webDir: 'dist'` y `ios.contentInset: 'never'`.
- `ios/App/App/AppDelegate.swift`, con `AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)` y `setActive(true)`.
- `src/platform/native.ts`, con detección `Capacitor.isNativePlatform()`, háptica en el downbeat (opcional, configurable) y keep-awake en lugar de Wake Lock web.
- `vite.config.ts`: no registrar el service worker cuando se compila para nativo (`VITE_NATIVE=1`), porque los assets ya van empaquetados.
- Las carpetas `ios/` y `android/` van versionadas. Excluir `ios/App/Pods`, `android/.gradle` y `android/app/build`.

**Android (si se usa):**

1. En el teléfono, ir a **Ajustes → Acerca del teléfono** y tocar 7 veces "Número de compilación". Después, en **Opciones de desarrollador**, activar **Depuración USB**.
2. Conectar el teléfono y compilar con `npx cap open android` (Android Studio → Run), o por consola:

   ```bash
   npx cap sync android
   cd android && ./gradlew assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

3. Sin cable: copiar el APK al teléfono y abrirlo, habilitando "Instalar apps desconocidas" para el gestor de archivos.
4. Para que no venza ni dependa de la Mac, generar un keystore propio (`keytool -genkey ...`) y un `assembleRelease` firmado. El APK debug también sirve indefinidamente.
5. La verificación de desarrolladores que Google despliega en 2026 apunta a la instalación fuera de Play. Según Google, la instalación por `adb` para desarrollo sigue permitida [sin verificar el alcance exacto en el teléfono concreto].

**Criterios para quedarse con Capacitor** (si no se cumplen, alcanza la PWA de M0):

- El checklist de M0 pasa también en WKWebView.
- El jitter medido con la sonda de audio (adaptada para ejecutarse en WebView) no es peor que en Safari.
- La háptica y el keep-awake aportan algo real en la práctica.

#### M2. Comodidad: un comando para instalar

Scripts en `package.json`:

```json
"ios:install": "VITE_NATIVE=1 npm run build && npx cap sync ios && ./scripts/ios-install.sh",
"android:install": "VITE_NATIVE=1 npm run build && npx cap sync android && cd android && ./gradlew installDebug"
```

`scripts/ios-install.sh` compila con la firma automática del Personal Team y lo instala con `devicectl` (Xcode 15+):

```bash
#!/usr/bin/env bash
set -euo pipefail
DEVICE_ID="${DEVICE_ID:-$(xcrun devicectl list devices | awk '/available/ {print $3; exit}')}"   # ajustar al formato de salida real
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -destination "id=$DEVICE_ID" -derivedDataPath build/ios -allowProvisioningUpdates build
xcrun devicectl device install app --device "$DEVICE_ID" build/ios/Build/Products/Debug-iphoneos/App.app
xcrun devicectl device process launch --device "$DEVICE_ID" ar.cucco.metronomo
```

- Con la cuenta gratis, este comando es el "refresco semanal": cuando el perfil vence a los 7 días, se corre de nuevo. Opcional: un recordatorio en el calendario.
- Si el proyecto iOS usa Swift Package Manager (default en Capacitor 8), cambiar `-workspace` por `-project ios/App/App.xcodeproj` [sin verificar la estructura generada].
- **CI opcional:** un job en `.github/workflows/ci.yml` (o un `android-apk.yml` con `workflow_dispatch`) en `ubuntu-latest` que corra `npx cap sync android && ./gradlew assembleDebug` y suba el APK con `actions/upload-artifact`. Así se puede bajar e instalar el APK desde el teléfono sin Android Studio. Para iOS **no** se arma CI: la firma con Personal Team necesita el Apple ID en una Mac con Xcode, y un runner macOS no aporta nada para uso personal.

#### M3 (opcional). Metrónomo con la pantalla bloqueada

Solo si hace falta de verdad: es lo que más trabajo cuesta.

- Crear un plugin Capacitor local `plugins/native-metronome`:
  - iOS: `AVAudioEngine` con `AVAudioPlayerNode.scheduleBuffer(at:)` y `UIBackgroundModes: [audio]`. Primero verificar que la capability funcione con Personal Team; si no, esta fase requiere la cuenta paga.
  - Android: Oboe o `AudioTrack` con un foreground service de tipo `mediaPlayback`.
- El plugin replica solo el click con acentos y subdivisiones, no los grooves completos.
- Al pasar a background, el JS hace handoff al plugin con BPM, compás y fase. Al volver, el JS retoma.
- Riesgo alto: dos motores que tienen que quedar en fase.

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
4. Hosting en Cloudflare. Es lo que permite instalar la PWA por HTTPS en el iPhone.
5. M1: Capacitor en el iPhone con la cuenta gratis.
6. M2: `npm run ios:install` / `android:install` y el APK en CI.
7. Vitest Browser Mode para el motor de audio.
8. M3 y migración de MUI: solo con demanda.

## Fuentes

- WebKit 291892, AudioContext mudo al volver del background en PWA: https://bugs.webkit.org/show_bug.cgi?id=291892
- Foro Apple, audio en PWA y pantalla bloqueada: https://developer.apple.com/forums/thread/762582
- `navigator.audioSession` y el switch de silencio: https://bugs.webkit.org/show_bug.cgi?id=261554
- Wake Lock en PWA de iOS (corregido en 18.4): https://bugs.webkit.org/show_bug.cgi?id=254545 · https://progressier.com/pwa-capabilities/screen-wake-lock
- Web MIDI en Safari: https://caniuse.com/midi · https://bugs.webkit.org/show_bug.cgi?id=107250
- Capacitor 8: https://ionic.io/blog/announcing-capacitor-8 · requisitos (Xcode 26, SPM): https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8
- Audio en background con Capacitor (requiere reproducción nativa): https://capawesome.io/blog/how-to-play-audio-in-the-background-in-capacitor/ · https://developer.apple.com/forums/thread/781787
- Capabilities por membresía (Background Modes solo ADP): https://developer.apple.com/help/account/reference/supported-capabilities-ios · comparativa de membresías: https://developer.apple.com/support/compare-memberships/
- Límites de la firma gratuita (7 días, 3 apps, 10 App IDs): https://learn.microsoft.com/previous-versions/xamarin/ios/get-started/installation/device-provisioning/free-provisioning · https://developer.apple.com/forums/thread/724896
- `devicectl`: https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference
- SideStore en iOS 26 (guías de terceros): https://iphonesoft.fr/2026/03/11/guide-ios-26-installer-sidestore-livecontainer-sideloader-apps-jailbreak
- Verificación de desarrolladores Android 2026: https://android-developers.googleblog.com/2026/06/android-developer-verification.html
- Tauri 2: https://v2.tauri.app/blog/roadmap-to-tauri-2-0/
- react-native-audio-api: https://docs.swmansion.com/react-native-audio-api/
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
