# Deepgram brand UI kit assets

Copied from [`deepgram-devs/dg-brand-ui`](https://github.com/deepgram-devs/dg-brand-ui) **v0.6.0** (`assets/`). This app has no build step, so the files are committed here and served by Flask from `/static/vdui/`.

| File | What it is |
| --- | --- |
| `brand.css` | The kit's theme as plain CSS: tokens, fonts, and the `label` utility. `../style.css` builds on it |
| `logos/deepgram.svg`, `logos/deepgram-favicon.svg` | The Deepgram logo and favicon |

The page uses the kit's paper surface only, so the textures (`textures/`, used by `stage-glow` and `landing-texture`) and the voice ring aren't copied. Copy them from the kit if a page starts using those classes.

Don't edit these files. To upgrade, copy the same files from the kit's `assets/` folder at the new tag, then update the version above.
