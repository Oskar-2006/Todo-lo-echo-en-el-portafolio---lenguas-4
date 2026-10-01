# Todo-lo-echo-en-el-portafolio---lenguas-4

Este repositorio servirá para guardar todo lo hecho para la actividad en clase sobre el portafolio.

Portafolio de Oskar Bohorquez (Creación Digital, Universidad El Bosque).

**Sitio publicado:** https://oskar-2006.github.io/Todo-lo-echo-en-el-portafolio---lenguas-4/

## Cómo está armado

| Archivo / carpeta | Para qué sirve |
|---|---|
| `info.json` | Todo el contenido de la página. Se edita aquí y la página se actualiza. |
| `render.js` | Construye la página a partir de `info.json`. |
| `main.js` | Scroll suave, proyectos en horizontal, zoom de habilidades y cursor. |
| `style.css` | Estilos. |
| `objects/` | Imágenes, videos y modelos que se enlazan desde `info.json`. |
| `vendor/` | Librerías (GSAP, ScrollTrigger y Lenis) incluidas en local, sin CDN. |
| `perfil.md` | Información original del perfil, como respaldo. |

## Verlo en tu computador

La página lee `info.json` con `fetch`, así que no funciona abriendo `index.html` con doble clic. Ábrela con un servidor local, por ejemplo la extensión **Live Server** de VS Code, o en una terminal:

```
npx serve .
```

## Publicación (GitHub Pages)

Es un sitio estático, sin paso de compilación. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / carpeta `/ (root)`**.
