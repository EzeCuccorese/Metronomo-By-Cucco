# Plan de Auditoría de Arquitectura de Código & Cobertura de Pruebas (>= 95%)

Este plan define el alcance para auditar y refactorizar el proyecto bajo las mejores prácticas de arquitectura de software (**Domain-Driven Design**, **DRY**, **SOLID**, **Clean Code**) e **incrementar la cobertura de pruebas unitarias al 95% o superior**, excluyendo explícitamente la creación de workflows o pipelines de CI/CD.

---

## Tareas y Desglose por Agente

### Agente 1: DDD (Domain-Driven Design) & Separación de Capas
* Aislar la capa de dominio de audio (`AudioContextManager`, `Scheduler`, `DrumSynthesizer`, `PolyphonicSynth`) de la capa de presentación en React.
* Inmutabilidad en modelos de datos de ritmos.

### Agente 2: DRY (Don't Repeat Yourself) & Centralización
* Centralizar los objetos repetidos de mapeo de imágenes (`instrumentImages`, `CHANNEL_IMAGES`, `INSTRUMENT_IMAGES`) en una constante canónica `src/constants/instrumentAssets.ts`.

### Agente 3: SOLID & Clean Code (SRP, OCP, DIP)
* Refactorizar [App.tsx](file:///Users/eze/projects/Metronomo-by-cucco/src/App.tsx) (~1000 LOC) aplicando **Single Responsibility Principle (SRP)** mediante custom hooks (`useMetronomeAudio`, `usePresetManager`) y componentes modulares.

### Agente 4: Seguridad OWASP & Nginx (Sin Workflows)
* Cabeceras HTTP de seguridad en `nginx.conf` (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`).
* Cero secretos en código.
* **Sin creación de workflows ni pipelines CI/CD**.

### Agente 5: Cobertura de Tests >= 95% (Agente de Testing)
* Configurar `@vitest/coverage-v8` en Vitest con umbral exigido del **95%** en `lines`, `functions`, `branches` y `statements`.
* Agregar pruebas unitarias para `AudioContextManager`, `PolyphonicSynth`, `RhythmPatterns`, `useMetronomeAudio`, `usePresetManager`, `MixerConsole` y `PatternEditor`.

---

## Plan de Verificación

* `npm run test:coverage`: Validación de cobertura global $\ge 95\%$.
* `npm run build`: Validación del compilador TypeScript y empaquetado de producción.
