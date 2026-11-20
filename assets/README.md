# Imágenes de NEPO Café

Coloca aquí las fotos (descargadas de https://nepo.cafe/ o propias) con estos nombres exactos.
Si falta alguna, la web muestra un placeholder cálido con su nombre, así que nada se rompe.

| Archivo                  | Dónde aparece                         | Formato recomendado |
|--------------------------|---------------------------------------|---------------------|
| `cafe-especialidad.jpg`  | Bento · Pilar 1 (Cafés Especiales) + Open Graph | vertical 4:5, ≥1000px |
| `tostadas-brutales.jpg`  | Bento · foto horizontal               | 16:9, ≥1200px |
| `latte-art.jpg`          | Bento · foto vertical (latte art)     | 4:5, ≥900px |
| `rama-cafeto.jpg`        | Bento · Pilar 3 (Cultura del Café)    | vertical, ≥700px |
| `local-nepo.jpg`         | Comunidad · foto grande               | vertical 3:4, ≥1000px |
| `tueste.jpg`             | Comunidad · foto cuadrada (tueste)    | 1:1, ≥1200px |
| `espresso-barra.jpg`     | Comunidad · foto vertical (en barra)  | 4:5, ≥1000px |
| `horario-navidad.jpg`    | Aviso de Navidad en «Dónde Estamos» (visible 15/11–25/12) | 4:5 |

Consejo: exporta en JPG calidad ~80 (o WebP) y por debajo de 300 KB cada una.

## Vídeo del vertido (hero)

| Archivo               | Uso |
|-----------------------|-----|
| `vertido.mp4`         | Vídeo real del café vertiéndose en el vaso. Avanza y retrocede con el scroll. |

Vídeo actual: «A Person Pouring Coffee in a Glass», de Mikhail Nilov en Pexels (https://www.pexels.com/video/6933519/), licencia Pexels (uso comercial gratuito, sin atribución obligatoria). Si lo cambias, ajusta `data-label` y `data-ml` del `<video>` en `index.html`.

Mientras `vertido.mp4` no exista, la web muestra la animación dibujada como respaldo.

**Cómo grabarlo**
- Trípode fijo, sin mover la cámara. Fondo liso y claro (crema / madera clara).
- Vertical **4:5** (p. ej. 1080×1350), 6–10 segundos.
- Empieza con el vaso vacío y termina con el vaso lleno y quieto.

**Prepararlo para que el scroll vaya fluido** (imprescindible: todos los fotogramas clave y sin audio):

```bash
ffmpeg -i original.mov -vf "scale=1080:-2,fps=30" -an -c:v libx264 -preset slow -crf 22 -g 1 -pix_fmt yuv420p -movflags +faststart vertido.mp4
```

(Instala ffmpeg con `brew install ffmpeg`.) Intenta que el `.mp4` final pese menos de 8–10 MB.
