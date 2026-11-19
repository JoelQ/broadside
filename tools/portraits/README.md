# Portraits

`src/portraits.js` draws every character as SVG in code, in the flat-shaded look of the ships. There are no image files.

- `portrait(id)` gives the full portrait on a 200 × 200 canvas, for a dialog.
- `portrait(id, { small: true })` crops to the head, for a bubble. It reads at 28 px.
- `CAST[id]` holds each character's name, role, side and where they appear.
- `speakerOf(text)` names who says a line from how it starts (`Manolis: “…”`, `Pilot:`, `Barbaro`, `İbrahim Reis`, `Marousa`). The in-game toasts use it to put that face beside the line.

`node tools/portraits/gallery.mjs [--png]` writes `out/portraits/index.html`, with every character at dialog size, at bubble sizes and in a mock bubble. `--png` also screenshots it to `gallery.png`.

To add a character, add an entry to `CAST` with a `draw()` built from the helpers at the top of the file (`background`, `bust`, `face`, `eyes`, `brows`, `mouth`). Give them a silhouette nobody else has, such as headgear, hair or a beard, and one signature colour. The background shows their side. If their headgear is tall, add `crop` so the small version keeps it.
