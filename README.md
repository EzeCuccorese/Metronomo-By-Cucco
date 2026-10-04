# Metrónomo by Cucco 🇦🇷

Metrónomo profesional y entrenador rítmico para músicos, con foco en ritmos folclóricos argentinos y latinoamericanos. Es una PWA: se instala en el celular o la PC desde el navegador y funciona sin conexión.

## Funciones

- **Metrónomo de precisión.** Usa un reloj en un Web Worker con agendado *lookahead* sobre el reloj de Web Audio. El click cae exacto sobre la grilla, sin jitter.
- **Biblioteca de ritmos.** Rock, blues, samba, bossa, salsa, cumbia, candombe, chacarera, zamba, gato, chamamé, malambo, vidala, chaya, huayno y más. Cada uno tiene su *groove* (microtiming) propio.
- **Editor de patrones.** Grilla con intensidades (pp…ff), articulaciones (parche/aro, abierto/cerrado), compases 2/4, 3/4, 4/4, 6/8 y 12/8, y subdivisiones por pulso.
  - Los cambios se escuchan en el paso siguiente, incluso mientras suena.
  - Los ritmos editados se pueden restaurar al original.
- **Compases compuestos.** El BPM siempre se refiere a la negra (♩). En 6/8 y 12/8 se muestra además el pulso con puntillo (♩.) y el click acentúa los grupos.
- **Mixer.** Volumen, paneo (mouse, touch o teclado), mute por canal y vúmetros.
- **Constructor armónico.** Progresiones por grados con acompañamiento (pad, negras, contratiempos, arpegio, base de zamba, **piano**: bajo + acordes o arpegio, con conducción de voces).
- **Piano.** Piano de cola sampleado (Salamander Grand Piano) con canal propio en el mixer.
  - Teclado en pantalla de 2 octavas (mouse, touch multitáctil y glissando), con los nombres de las notas en español.
  - Resalta en vivo las notas del acorde que está sonando y, si querés, la escala del tono.
  - *Modo melodía*: grabás de 1 a 4 compases sobre el metrónomo (con precuenta), quedan cuantizados a la subdivisión y suenan en loop sincronizados con el compás. Se pueden deshacer y borrar, y se guardan.
- **Modos de práctica.**
  - *Entrenador de velocidad*: sube (o baja) el BPM cada N compases. Tiene modo lineal y modo resistencia.
  - *Compases en silencio*: silencia compases al azar para que sostengas el tempo solo.
  - *Formas folclóricas*: guía la forma completa de chacarera simple/doble, zamba, cueca o gato, con precuenta, partes y fin automático.
- **Herramientas de estudio.** Temporizador Pomodoro, lista de tareas y contador de compases practicados.
- **Todo se guarda.** BPM, ritmo, ediciones, mixer, armonía, modos de práctica y tareas persisten entre sesiones.

### Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `Espacio` | Iniciar / detener |
| `T` | Tap tempo |
| `↑` / `↓` | ±1 BPM (`Shift`: ±5) |

**Piano** (con el foco en el piano, o en toda la página si activás *Teclado PC*):

| Tecla | Acción |
| --- | --- |
| `A` `W` `S` `E` `D` `F` `T` `G` `Y` `H` `U` `J` `K` | Do, Do♯, Re, Re♯, Mi, Fa, Fa♯, Sol, Sol♯, La, La♯, Si, Do |
| `O` `L` `P` `Ñ` | Do♯, Re, Re♯, Mi de la octava siguiente |
| `Z` / `X` | Bajar / subir octava |
| `Enter` | Toca la tecla del piano que tiene el foco (`←` / `→` cambian de tecla) |

Mientras el piano toca, `T` es Fa♯ y no tap tempo. `Espacio` y las flechas `↑` / `↓` siguen siendo del metrónomo.

## Arquitectura

```
src/
├── audio/            Motor de audio (sin React)
│   ├── Scheduler.ts         Agendado lookahead, cola visual, trainer, silencios, formas
│   ├── DrumSynthesizer.ts   Samples (Opus/OGG) + síntesis de respaldo, mixer por canales
│   ├── PolyphonicSynth.ts   Acompañamiento armónico
│   ├── piano/               Piano sampleado, patrones de acompañamiento, grabación y loop de melodías
│   ├── VoiceTracker.ts      Corte inmediato de voces agendadas al detener
│   └── instrumentChannels.ts  Ruteo instrumento → canal (fuente única de verdad)
├── hooks/
│   ├── useMetronomeEngine.ts  Ciclo de vida del Scheduler y API para React
│   ├── usePersistentState.ts  Estado persistido y validado en localStorage
│   ├── useTapTempo.ts / useKeyboardShortcuts.ts
├── state/            Store de reproducción de alta frecuencia (useSyncExternalStore)
├── rhythms/          Presets, compases, edición y validación de patrones
└── components/       UI (MUI + canvas)
```

**Decisiones clave**

- El paso actual cambia hasta 16 veces por segundo. Por eso no vive en el estado de React: va a un store externo y solo se suscriben los componentes que lo necesitan. La grilla del editor y los vúmetros se actualizan de forma imperativa.
- Detener corta en unos 12 ms todas las voces ya agendadas y la armonía sostenida.
- El click guía va por un bus limpio, sin saturación ni EQ.
- Los datos guardados en `localStorage` se validan estructuralmente antes de usarse. Un valor corrupto nunca rompe la app.
- Las notas de la melodía grabada se agendan en el mismo *lookahead* que la batería (nada de `setTimeout`), así el loop no se corre del compás.
- El piano se descarga recién cuando lo usás. Cada nota está en Ogg Opus (los navegadores actuales lo decodifican todos). Si no carga ninguna, suena con el sintetizador.

## Compatibilidad

Solo se soportan los navegadores más recientes: Safari (iOS y macOS) y Chrome en su última versión. No hay transpilación ni polyfills para navegadores antiguos (`build.target: esnext`).

Requiere Node 26 (CI y Docker usan Node 26; ver `.nvmrc`) y pnpm 11. Node 25+ ya no trae corepack, así que pnpm se instala con `npm i -g pnpm@11` (o mise/fnm). Todo el tooling usa una sola versión de TypeScript (7.x): el typecheck es `tsc -b` y el lint es Oxlint con reglas que usan tipos (`oxlint-tsgolint`).

## Desarrollo

El gestor es **pnpm 11** (`packageManager` y `devEngines` en `package.json`). Por defecto pnpm 11 espera 24 h antes de instalar una versión recién publicada (`minimumReleaseAge`) y no corre los scripts de instalación de las dependencias: `pnpm-workspace.yaml` tiene `allowBuilds` vacío porque hoy ninguna los necesita. Si alguna dependencia futura lo requiere, se agrega ahí de forma explícita y con su motivo.

```bash
pnpm install
pnpm dev               # servidor de desarrollo
pnpm build             # build de producción (typecheck + vite)
pnpm lint              # Oxlint (type-aware)
pnpm typecheck
pnpm test              # Vitest: proyectos unit (jsdom) y browser (Chromium real)
pnpm test:unit         # solo el proyecto unit
pnpm test:browser      # solo el proyecto browser (audio real con OfflineAudioContext)
pnpm test:coverage     # con umbrales de cobertura
pnpm test:e2e          # Playwright contra el build de producción
pnpm check             # todo lo anterior
```

La app requiere un contexto seguro (`crypto.randomUUID`, Web Audio, service worker): funciona en HTTPS, en Capacitor (`capacitor://localhost`) y en `localhost`. Para probar en un teléfono por LAN, `http://192.168.x.x` no es un contexto seguro; usá la app dentro de Capacitor, un túnel HTTPS o el hosting HTTPS de la PWA.

### Tests

- **Unitarios e integración (Vitest, proyecto `unit`, jsdom).** Cubren el Scheduler (timing, cambios de patrón, trainer, silencios y formas), los sintetizadores (ruteo, corte de voces), los hooks, la persistencia y la app completa con un motor simulado. Web Audio está simulado con mocks.
- **Audio real (Vitest Browser Mode, proyecto `browser`, Chromium vía `@vitest/browser-playwright`).** Los archivos `*.browser.test.ts` corren el motor de verdad (Scheduler, DrumSynthesizer, PolyphonicSynth, PianoSampler) sobre un `OfflineAudioContext`: renderizan audio y miden las muestras. Por ejemplo, que el click caiga cada 0,5 s a 120 BPM con diferencia de pocas muestras, que el acento sea más fuerte, que un canal silenciado no suene y que stop() corte el sonido. Los helpers están en `src/test/browser/audioHarness.ts`. Hace falta Chromium de Playwright (`pnpm exec playwright install chromium`). La cobertura v8 funciona en Chromium y se combina con la del proyecto `unit`: los umbrales se evalúan sobre el total, así que `pnpm test:browser` solo (sin los tests unit) no los alcanza; usar `pnpm test:coverage`.
- **End-to-end (Playwright, proyectos `desktop-chromium` y `desktop-webkit`).** Corren sobre el bundle de producción servido con los mismos headers de seguridad que nginx. Una sonda intercepta la salida del `AudioContext` y mide el audio que realmente se escucha. Así se verifica, por ejemplo, que el preset Metrónomo marca cada tiempo, que una edición de la grilla suena en el compás siguiente y que detener deja el audio en silencio. También se prueban el teclado, la persistencia, la PWA y la accesibilidad (axe). El proyecto WebKit (el motor de Safari) corre solo los tests de UI y PWA (`controls` y `pwa-a11y`, sin los dos que avanzan por tiempo de audio: formas folklóricas y speed trainer): el WebKit de Playwright no es Safari de iOS y no permite medir el audio como Chromium, así que las pruebas de audio real son solo de Chromium y el audio en iPhone se verifica a mano. Para correrlo localmente: `pnpm exec playwright install webkit`.

## Créditos

Piano: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) de Alexander Holm, licencia [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). Se usan 17 notas (Do2 a Do6, cada tercera menor), recortadas a 2,8 s y recodificadas. Detalle en [`public/audio/piano/LICENSE.txt`](public/audio/piano/LICENSE.txt).

## Despliegue

```bash
docker compose up --build   # http://localhost:8085
```

La imagen sirve el build con nginx:

- **Headers de seguridad OWASP** en `deploy/security-headers.conf`, incluido en cada `location`.
- **Caché:** `/assets/*` con hash es inmutable por un año. `index.html`, `sw.js` y el manifest van con `no-cache` para que las actualizaciones lleguen.
- **Content-Types correctos** para los samples de audio.

La CI de GitHub Actions corre lint, typecheck, tests con cobertura, build, E2E y valida la configuración de nginx.

La review automática de Gemini corre una sola vez al abrir el PR (o al marcarlo como listo). Para pedir otra, agregá el label `gemini-review`; el workflow lo quita solo al terminar.
