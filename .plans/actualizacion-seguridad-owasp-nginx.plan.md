# Plan de Auditoría e Implementación de Cabeceras HTTP OWASP en Nginx

Este plan define las acciones para auditar e integrar todas las cabeceras de seguridad HTTP recomendadas por OWASP en la configuración de Nginx (`nginx.conf`).

---

## 1. Cabeceras HTTP OWASP Requeridas

* `Content-Security-Policy`: Política estricta que permite cargar estilos y fuentes desde Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), restringe scripts, objetos e incrustaciones.
* `X-Content-Type-Options`: Valor `nosniff` para evitar la interpretación incorrecta de tipos MIME.
* `X-Frame-Options`: Valor `DENY` para prevenir ataques de Clickjacking.
* `Referrer-Policy`: Valor `strict-origin-when-cross-origin` para limitar el envío de información del referente.
* `Permissions-Policy`: Restricción explícita de características sensibles del navegador (`camera=()`, `microphone=()`, `geolocation=()`, `payment=()`, `usb=()`, `display-capture=()`).
* Cabeceras defensivas adicionales: `X-XSS-Protection`, `Cross-Origin-Opener-Policy`.

---

## 2. Puntos Críticos de Configuración Nginx

* Aplicar el parámetro `always` en cada directiva `add_header` para asegurar la transmisión de cabeceras en todas las respuestas HTTP (incluyendo códigos 4xx y 5xx).
* Replicar/mantener la inclusión de cabeceras en el bloque de assets estáticos `location ~* \.(?:...)$` debido a las reglas de herencia de directivas `add_header` en Nginx.
* **Exclusión de Workflows**: Garantizar expresamente que NO se creen archivos ni modificaciones relacionadas con pipelines o workflows de CI/CD.

---

## 3. Plan de Verificación

* Lectura completa de `nginx.conf` post-modificación para confirmar sintaxis y exhaustividad de cabeceras.
* Ejecución de prueba sintáctica o build si aplica (`npm run build`).
