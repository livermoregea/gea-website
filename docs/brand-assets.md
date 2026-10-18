# Portable GEA logos

Copy these files from `public/images` to any website:

| File | Contents |
| --- | --- |
| `gea-one.svg` | GEA One badge, including the icon and wordmark |
| `gea-one-animated.svg` | Soft diagonal shine sweeps across the badge once on load |
| `geai.svg` | Static GEAI pinwheel, wordmark, and Summary caption |
| `geai-animated.svg` | Full GEAI logo with the spinning, breathing pinwheel |
| `geai-mark.svg` | Static pinwheel alone |
| `geai-mark-animated.svg` | Animated pinwheel alone |

The full logos have outlined lettering, so they need no installed fonts or font downloads. All assets are vector, have transparent surroundings, and require no React, JavaScript, external styles, or network requests. GEA One retains its green badge background.

Visit `/brand-preview.html` to replay the GEA One animation and download either version. The site's badge shows a single soft shine on hover, keyboard focus, or tap. The standalone animated SVG plays a single shine on load. Use the static SVG when idle. Both respect reduced-motion preferences.

## Use on another website

```html
<img src="/images/gea-one.svg" alt="GEA One" width="154" />
<img src="/images/geai-animated.svg" alt="GEAI Summary" width="164" height="56" />
```

Use `geai.svg` when idle and `geai-animated.svg` while loading to match GEA One's existing behavior. The animated files contain their own CSS keyframes: a 3.2-second rotation and a 1.6-second petal expansion/contraction. They respect the viewer's reduced-motion setting.

Keep the SVG format when exporting. PNGs, screenshots, and some design-tool imports flatten animations; an SVG-aware browser preserves the embedded animation when used directly, through an image element, or as inline SVG. Some website upload services sanitize SVG styles, so host the original file when possible.
