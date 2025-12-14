# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

# Antigravity Metronome (PWA) 🇦🇷

Una aplicación de metrónomo profesional, multiplataforma y gratuita, diseñada con tecnologías web modernas pero capaz de ejecutarse como una aplicación nativa en Windows, Android y Linux.

## Características Principales
- **Motor de Audio Sintetizado**: Generación de sonido mediante Web Audio API (sin samples grabados) para una latencia mínima y descarga instantánea.
- **Bombo Legüero Realista**: Algoritmo de síntesis específico para emular el golpe de parche y aro de madera.
- **Entrenador de Velocidad**: Aumenta automáticamente el BPM por compás para practicar resistencia y escalas.
- **Editor de Ritmos**: Crea tus propios patrones usando una grilla de pasos (Kick, Snare, HiHats, Bombo).
- **Subdivisiones Musicales**: Soporte para negras, corcheas, tresillos y semicorcheas visualizadas musicalmente.
- **Tap Tempo**: Calcula el BPM de una canción tocando un botón ritmicamente.
- **Multi-Plataforma**: Instálala en tu celular o PC sin tiendas de aplicaciones (PWA).

## Tecnologías Utilizadas
- **React + Vite**: Framework principal para una interfaz rápida y modular.
- **TypeScript**: Para un código robusto y tipado.
- **Web Audio API**: El corazón de la aplicación.
  - `OscillatorNode`: Para generar tonos puros (bombo, clicks).
  - `AudioBufferSourceNode` + `BiquadFilterNode`: Para generar ruido blanco filtrado (redoblante, hihats, texturas de madera).
  - `GainNode`: Para envelopes (ataque, decaimiento, sustain) precisos.
- **Web Worker / Lookahead Scheduler**: Sistema de cronometraje preciso que programa el audio *antes* de que ocurra para evitar problemas de latencia del hilo principal de JavaScript.
- **Material UI (MUI)**: Librería de componentes visuales modernos y responsivos.

## Guía de Uso

1.  **Instalación**:
    *   Si estás en Chrome/Edge, busca el ícono de "Instalar" en la barra de direcciones.
    *   En Android, toca "Agregar a la pantalla de inicio".

2.  **Controles**:
    *   **BPM**: Desliza o escribe el tempo deseado.
    *   **TAP**: Toca repetidamente el botón "TAP" al ritmo de una canción para detectar su velocidad.
    *   **Ritmos**: Elige entre presets (Rock, Chacarera, Jazz, Blues) o crea el tuyo ("Custom").

3.  **Editor de Patrones (Custom)**:
    *   Selecciona "Create Custom Pattern".
    *   Elige el compás (4/4, 6/8, etc.).
    *   Haz clic en las celdas para activar instrumentos.
    *   **Niveles de Acento**: Haz clic varias veces en una celda para cambiar la intensidad (Suave -> Medio -> Fuerte -> Silencio).

## Detalles de Síntesis de Audio (Cómo funciona)

Esta aplicación no utiliza archivos grabados (`.mp3` o `.wav`). Todo el sonido se sintetiza en tiempo real utilizando la **Web Audio API**. Esto permite un control total sobre la dinámica y el timbre.

### Bombo Legüero
*   **Parche (Golpe Grave)**:
    *   **Cuerpo**: Un oscilador sinusoidal (`Sine Wave`) que barre rápidamente desde ~80Hz hacia ~35Hz. Esto simula la tensión del cuero relajándose después del golpe.
    *   **Resonancia**: Un oscilador secundario (cuadrada suave) filtrado severamente (`LowPass`) para darle "cuerpo" y sensación de caja hueca.
    *   **Ataque**: Una ráfaga muy corta de ruido filtrado para simular el contacto de la maza con el cuero.
*   **Aro (Golpe de Madera)**:
    *   **Madera**: Ruido blanco pasado por múltiples filtros paso banda (`Bandpass`) con alta resonancia (Q) en frecuencias maderosas (1600Hz y 2400Hz). Esto emula cómo la madera resuena en tonos específicos al ser golpeada.
    *   **Transitorio**: Un ataque extremadamente rápido para lograr el "Thock" seco característico de las baquetas en el aro.

### Batería Rock
*   **Kick**: Onda sinusoidal con caída de tono extrema (150Hz -> 50Hz) y un "click" agudo al inicio.
*   **Snare**: Ruido blanco con decaimiento rápido para la bordonera, mezclado con un tono fundamental (triángulo) para el cuerpo del tambor.
*   **Hi-Hats**: Onda cuadrada disonante (banco de osciladores desafinados) + Filtro paso alto (`HighPass`) para lograr el sonido metálico y brillante.

### Metrónomo
*   **Click**: Un tono puro sintetizado (onda senoidal o cuadrada filtrada) con un ataque instantáneo y decaimiento exponencial ultracorto para máxima precisión auditiva.

## Comandos de Desarrollo
```bash
# Instalar dependencias
npm install

# Correr servidor local
npm run dev

# Construir para producción
npm run build
```
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
