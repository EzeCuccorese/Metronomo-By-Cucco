# Plan: Imágenes Reales para el Metrónomo y Biblioteca Visual de Ritmos

Este plan propone enriquecer visualmente el metrónomo interactivo reemplazando los gráficos vectoriales actuales por imágenes reales de alta calidad de los instrumentos musicales, y mejorando la interfaz general con portadas temáticas para los distintos géneros rítmicos.

---

## Cambios Propuestos

### 1. Generación de Recursos Visuales

Generaremos las siguientes imágenes en `/public/assets/instruments/` y `/public/assets/genres/`:

*   **Instrumentos (Fondo Transparente/Recortado):**
    *   `bombo_leguero.webp`
    *   `clave.webp`
    *   `snare.webp`
    *   `kick.webp`
    *   `hihat.webp`
    *   `tom.webp`
    *   `shaker.webp`
    *   `click.webp`
    *   `keyboard.webp`
*   **Portadas de Ritmos / Géneros (Estética Premium Cálida/Oscura):**
    *   `genre_rock.webp`
    *   `genre_blues.webp`
    *   `genre_samba.webp`
    *   `genre_chacarera.webp`
    *   `genre_salsa.webp`
    *   `genre_cumbia.webp`
    *   `genre_milonga.webp`
    *   `genre_bossa.webp`
    *   `genre_chamame.webp`
    *   `genre_malambo.webp`

### 2. Modificaciones de Código

*   **`InteractiveInstrumentVisual.tsx`**: Carga y renderizado de imágenes de instrumentos en el canvas.
*   **`MixerConsole.tsx`**: Miniaturas en la cabecera de los canales.
*   **`PatternEditor.tsx`**: Avatares de instrumentos al lado del nombre de fila del secuenciador.
*   **`App.tsx`**: Selector visual de ritmos con tarjetas que muestren las portadas de los géneros.

---

## Plan de Verificación

*   **Pruebas Automatizadas:** `npm run build`
*   **Verificación Manual:** Carga de imágenes en el navegador, físicas interactivas en canvas, visualización en mezclador/secuenciador, carga de presets en el nuevo selector.
