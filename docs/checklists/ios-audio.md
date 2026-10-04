# Checklist manual: audio en iPhone (fase M0)

El audio real en iOS no se puede validar en CI (Playwright WebKit no es Safari de iOS).
Esta lista se recorre a mano en el iPhone 18 Pro con el iOS actual, **dos veces**:

- **PWA instalada:** Safari → Compartir → Agregar a inicio, y abrirla desde el ícono.
- **Safari:** la misma URL en una pestaña común.

Antes de empezar: volumen al medio, sin auriculares Bluetooth (suman retraso), con el
ritmo por defecto. Si algo falla, anotar versión de iOS, modo (PWA o Safari) y qué se
hizo justo antes.

## PWA instalada

- [ ] Suena con el switch de silencio activado (sesión de audio `playback`).
- [ ] Bloquear y desbloquear la pantalla mientras suena: al volver a la app vuelve a sonar
      (si no, sonar al primer toque en la pantalla).
- [ ] Después de una llamada (recibir una y cortar) vuelve a sonar al volver a la app.
- [ ] Mandar la app a segundo plano 1 minuto y volver: suena, sin quedar muda.
- [ ] La pantalla no se apaga mientras suena (wake lock), y sí se apaga normalmente
      después de detener.
- [ ] Los samples decodifican: el bombo, la caja y el piano suenan a instrumento real,
      no a la síntesis de respaldo.
- [ ] 10 minutos a 120 BPM sin derivas audibles (comparar contra un metrónomo de
      referencia o grabar y medir).
- [ ] El aviso de Bluetooth se ve, se cierra con la X y no vuelve a aparecer al reabrir.

## Safari

- [ ] Suena con el switch de silencio activado (sesión de audio `playback`).
- [ ] Bloquear y desbloquear la pantalla mientras suena: al volver a la pestaña vuelve a
      sonar (si no, sonar al primer toque en la pantalla).
- [ ] Después de una llamada (recibir una y cortar) vuelve a sonar al volver a la pestaña.
- [ ] Cambiar a otra app 1 minuto y volver: suena, sin quedar muda.
- [ ] La pantalla no se apaga mientras suena (wake lock), y sí se apaga normalmente
      después de detener.
- [ ] Los samples decodifican: el bombo, la caja y el piano suenan a instrumento real,
      no a la síntesis de respaldo.
- [ ] 10 minutos a 120 BPM sin derivas audibles.
- [ ] El aviso de Bluetooth se ve, se cierra con la X y no vuelve a aparecer al recargar.

## Notas

- Si el contexto de audio queda colgado o mudo, la app lo recrea sola y sigue sonando
  con la misma configuración (BPM, ritmo, mixer). El compás vuelve a empezar desde el
  tiempo 1; eso es esperado.
- Con auriculares Bluetooth, el aviso muestra la latencia de salida cuando el navegador
  la informa y supera 50 ms.
