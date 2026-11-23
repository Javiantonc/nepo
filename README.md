# NEPO Café · Pozuelo Coffee House

Web de NEPO Café, cafetería de especialidad en Avda. Juan XXIII, 19 · Pozuelo de Alarcón (Madrid).

HTML, CSS y JavaScript sin dependencias ni paso de compilación.

## Verla en local

```bash
npx serve .
```

y abre `http://localhost:3000`. (Abrir `index.html` con doble clic no carga bien el vídeo del hero.)

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Inicio: pase de fotos y «Los favoritos de la casa» |
| `filosofia.html` | Los tres pilares y comunidad |
| `carta.html` | Carta filtrable |
| `valoraciones.html` | Valoraciones (enlace a Google) |
| `donde.html` | Mapa, horarios y contacto |
| `legal.html` | Aviso legal, privacidad y cookies |

La navbar, el pie y el banner de cookies están repetidos en cada página:
si cambias uno, cámbialo en las cinco.
| `css/styles.css` | Estilos (paleta, tipografías Neuton + Plus Jakarta Sans, responsive) |
| `js/main.js` | Vídeo del hero con scroll, estado abierto/cerrado, carta, cookies |
| `assets/` | Fotos, logo y vídeo (ver `assets/README.md`) |

## Editar contenido

- **Carta y precios:** objeto `MENU` en `js/main.js`.
- **Horario:** `HOURS` y días especiales `SPECIAL` en `js/main.js`, y la tabla en `index.html`.
- **Fotos:** sustituye los archivos de `assets/` manteniendo el nombre.
