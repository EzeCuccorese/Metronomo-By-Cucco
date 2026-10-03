# Planes de trabajo (archivo histórico)

Planes de trabajo que guiaron el desarrollo. Cada archivo lleva al inicio un bloque de estado verificado contra el código y el historial de git. Los planes se conservan tal como se escribieron; solo se agregó el encabezado de estado.

| Plan | Estado | Resumen |
|------|--------|---------|
| [auditoria-critica-y-plan-de-mejoras](auditoria-critica-y-plan-de-mejoras.plan.md) | Completado | Auditoría de bugs, arquitectura, PWA y despliegue, con plan en cuatro fases ya implementado. |
| [actualizacion-seguridad-owasp-nginx](actualizacion-seguridad-owasp-nginx.plan.md) | Completado | Cabeceras HTTP de seguridad OWASP en nginx (hoy en `deploy/security-headers.conf`). |
| [buscar-imagenes-instrumentos](buscar-imagenes-instrumentos.plan.md) | Completado | Imágenes reales de instrumentos y portadas de géneros (rutas finales distintas a las del plan). |
| [corregir-diseno-grid-y-layout](corregir-diseno-grid-y-layout.plan.md) | Completado | Corrección del colapso del Grid de MUI en `App.tsx`. |
| [plan-optimizacion-multiagente](plan-optimizacion-multiagente.plan.md) | Completado | WebP, canvas, docker-compose y precaché PWA offline. |
| [actualizar-codigo-y-frameworks-deprecados](actualizar-codigo-y-frameworks-deprecados.plan.md) | Parcial | Se migró Grid y se quitó `webkitAudioContext`; quedan `?worker` y `createStereoPanner`; `useMetronomeAudio` es obsoleto. |
| [auditoria-buenas-practicas-reglas](auditoria-buenas-practicas-reglas.plan.md) | Parcial | DDD/DRY/SOLID y cobertura 95%; los hooks `useMetronomeAudio` y `usePresetManager` ya no existen. |
| [unit-test-coverage-95](unit-test-coverage-95.plan.md) | Parcial | Umbral de cobertura 95% y tests de audio; `usePresetManager` es obsoleto. |
