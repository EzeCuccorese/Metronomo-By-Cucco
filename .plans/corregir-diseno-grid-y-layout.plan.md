# Plan de Trabajo: Corrección de Grid y Layout Gráfico

## Causa Raíz Identificada
Durante la refactorización anterior, la importación de `Grid` en `src/App.tsx` cambió a `import Grid from '@mui/material/Grid'`, pero las propiedades de los hijos se pasaron usando la sintaxis de Grid v2 (`size={{ xs: 12, lg: 7 }}`). 
Al utilizar la versión v1 de `Grid` con la propiedad `size` de v2, la grilla ignora las proporciones de columnas (`7/12` para la columna izquierda y `5/12` para la columna derecha). Esto provoca que la disposición colapse a ancho mínimo, comprimiendo toda la interfaz en una columna estrecha y superponiendo los componentes visuales.

## Cambios Propuestos

### 1. Corrección de Grilla en `App.tsx`
- **Archivo**: `src/App.tsx`
- **Cambio**: Restablecer el uso correcto de las propiedades de grilla usando la API nativa y compatible de MUI:
  - Usar `<Grid item xs={12} lg={7}>` para la columna izquierda (Visualizador e Instrumentos + Consola de Mezcla).
  - Usar `<Grid item xs={12} lg={5}>` para la columna derecha (Editor de Patrones, Péndulo/Conductor, Constructor Armónico y Herramientas de Estudio).
  - Asegurar la importación limpia `import { Grid } from '@mui/material';` o la migración completa a `Grid2` con `container` y `size`.

### 2. Estabilización de Contenedores Flexbox
- Verificar que los contenedores `.studio-chassis` y el wrapper principal mantengan `width: 100%`, `max-width: 1440px` y `height: 100%` en escritorio sin colapsar.

## Plan de Verificación
1. **Comprobación de Tipos y Linter**: `npx tsc --noEmit && npm run lint`
2. **Pruebas Unitarias**: `npm test`
3. **Verificación de Build**: `npm run build`
4. **Verificación Visual**: Confirmar que la distribución de 2 columnas (7/12 izquierda, 5/12 derecha) se renderiza horizontalmente en pantallas grandes y se apila responsivamente en pantallas pequeñas sin superposiciones.
