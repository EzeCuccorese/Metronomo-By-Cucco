# Plan de Trabajo: Actualización de Código y Frameworks Deprecados

## Resumen
Actualización del código base para eliminar patrones y sintaxis deprecadas u obsoletas en Vite, Web Audio API, Material UI (MUI v7), React y TypeScript/ESLint.

## Cambios Propuestos

### 1. Web Worker & Vite 5/6/7
- **Archivo**: `src/audio/Scheduler.ts`
- **Cambio**: Reemplazar la sintaxis deprecada `import ClockWorker from './clock.worker?worker&inline'` por la sintaxis estándar moderna de Vite `new Worker(new URL('./clock.worker.ts', import.meta.url), { type: 'module' })` o el bundle de worker compatible sin flags obsoletos.

### 2. Web Audio API
- **Archivo**: `src/audio/AudioContextManager.ts`
- **Cambio**: Remover el fallback obsoleto `webkitAudioContext` y utilizar el estándar nativo `window.AudioContext`.
- **Archivo**: `src/audio/DrumSynthesizer.ts`
- **Cambio**: Remover verificaciones ternarias obsoletas como `this.context.createStereoPanner ? ...` (compatibilidad estándar nativa en todos los navegadores modernos).

### 3. Material UI (MUI v7 Grid)
- **Archivo**: `src/App.tsx`
- **Cambio**: Migrar la importación y propiedades del componente `Grid` de `@mui/material` a la sintaxis moderna de `Grid2` / Grid v7.

### 4. Carga de Assets Audio en Entorno de Pruebas (Vitest)
- **Archivo**: `src/audio/DrumSynthesizer.ts`
- **Cambio**: Asegurar resolución robusta de URLs al ejecutar `fetch` en `loadAsset` para evitar fallos de parseo de URL en entornos Node/Vitest.

### 5. Calidad de Código, React Hooks y ESLint
- **Archivo**: `src/hooks/useMetronomeAudio.ts`
- **Cambio**: Corregir las dependencias faltantes en `useEffect` y limpiar o renombrar parámetros no utilizados (`_channel`, `_solo`, `_semitones`).
- **Archivos**: `src/audio/DrumSynthesizer.test.ts` y `src/audio/Scheduler.test.ts`
- **Cambio**: Eliminar o reemplazar los argumentos sin uso en funciones mock para cumplir estrictamente con `@typescript-eslint/no-unused-vars`.

## Plan de Verificación
1. **Comprobación de Tipos**: `npx tsc --noEmit` (debe pasar con 0 errores).
2. **Linter**: `npm run lint` (debe pasar con 0 errores y 0 advertencias).
3. **Pruebas Unitarias**: `npm test` (56+ pruebas pasando sin warnings de depuración ni errores de URL).
4. **Verificación de Build**: `npm run build` para garantizar compatibilidad completa de empaquetado en producción.
