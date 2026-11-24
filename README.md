# NEPO Café · Pozuelo Coffee House

Web de NEPO Café, cafetería de especialidad en Avda. Juan XXIII, 19 · Pozuelo de Alarcón (Madrid).

HTML, CSS y JavaScript sin dependencias ni paso de compilación.

## Verla en local

```bash
npx serve .
```

y abre `http://localhost:3000`. (Abrir `index.html` con doble clic puede no cargar bien el mapa ni algunas funciones.)

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Inicio: pase de fotos, «Los favoritos de la casa» y Valoraciones (enlace a Google) |
| `filosofia.html` | Los tres pilares y comunidad |
| `carta.html` | Carta filtrable |
| `donde.html` | Mapa, horarios y contacto |
| `legal.html` | Aviso legal, privacidad y cookies |
| `css/styles.css` | Estilos (paleta, tipografías Fraunces + DM Sans, responsive) |
| `js/main.js` | Pase de fotos, carrusel, estado abierto/cerrado, carta, cookies |
| `assets/` | Fotos y logo (ver `assets/README.md`) |

La navbar, el pie y el banner de cookies están repetidos en cada página:
si cambias uno, cámbialo en las cuatro.

## Editar contenido

- **Carta y precios:** objeto `MENU` en `js/main.js`.
- **Horario:** `HOURS` y días especiales `SPECIAL` en `js/main.js`, y la tabla en `index.html`.
- **Fotos:** sustituye los archivos de `assets/` manteniendo el nombre.
