# Plan de Elevación de Cobertura de Pruebas Unitarias al 95%+

## Objetivos
1. Configurar `@vitest/coverage-v8` en `package.json` y `vite.config.ts` con umbral del 95% de cobertura global.
2. Desarrollar suites de prueba unitarias completas para los módulos requeridos:
   - `src/audio/AudioContextManager.test.ts`
   - `src/audio/PolyphonicSynth.test.ts`
   - `src/rhythms/RhythmPatterns.test.ts`
   - `src/hooks/usePresetManager.test.ts`
3. Expandir la cobertura en módulos de audio si es necesario para asegurar que la cobertura global de código alcance o supere el 95%.
4. Validar ejecutando `npm run test:coverage` y `npm test`.

## Pasos de Implementación
- [x] Agregar script `"test:coverage": "vitest run --coverage"` en `package.json`.
- [ ] Configurar `vite.config.ts` con el bloque `test` y umbrales de cobertura (lines, functions, branches, statements >= 95%).
- [ ] Crear `src/audio/AudioContextManager.test.ts` probando la instancia singleton, `getContext()`, `resume()` cuando está suspendido o corriendo, y el manejo de navegadores sin soporte.
- [ ] Crear `src/audio/PolyphonicSynth.test.ts` probando la inicialización, conexión a nodos de audio, `playChord` con todos los estilos (`pad`, `quarters`, `offbeats`, `arpeggio_8`), `setVolume`, y osciladores/envolventes.
- [ ] Crear `src/rhythms/RhythmPatterns.test.ts` probando la validez de los patrones predefinidos (`PRESET_PATTERNS`), los íconos de instrumentos (`InstrumentIcons`), estructuras de pasos y tipos.
- [ ] Crear `src/hooks/usePresetManager.test.ts` probando el hook reactivo con `renderHook`: selección inicial de patrón, selección al reproducir/en cola, aplicación de patrones en cola, actualización de patrones personalizados, etc.
- [ ] Ejecutar `npm run test:coverage` y ajustar tests/cobertura según sea necesario hasta alcanzar >= 95%.
