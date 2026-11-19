// Character portraits, drawn in code like the rest of the game: no image files. portrait(id) returns an
// SVG string on a 200 x 200 canvas that scales to any size. The same picture serves a large dialog portrait
// and a small notification bubble: portrait(id, { small: true }) crops in on the face and drops fine lines.
//
// The look follows the game's flat-shaded, low-poly ships and towns: flat colours, light from the upper left,
// and the shadow side of every face and garment cut as one darker facet. Each character is told apart first by
// silhouette (headgear, hair, beard), then by one signature colour, then by background: sea blue for your own
// people (anyone who can sail as your officer, whichever flag they were born under), crimson and gold for the
// Venetians who give you orders, green for the Ottomans who do, and one shared smoke-brown for every pirate.

// ---------- colour ----------
function mix(hex, k) { // k < 0 darkens toward black, k > 0 lightens toward white
  const n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, a = Math.abs(k);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * a));
  return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
}
const dk = (c, k = 0.22) => mix(c, -k), lt = (c, k = 0.18) => mix(c, k);

export const SKIN = { pale: '#e9c9ad', fair: '#ddb08a', olive: '#c99668', tan: '#b78057', brown: '#94603e', ruddy: '#d79a7a' };
const BG = {
  venice: ['#6e1b22', '#8d2a2c', '#d7b25a'],
  ottoman: ['#1d4b3c', '#2a6650', '#c9443a'],
  crew: ['#1d4a63', '#2a6683', '#e7dcc0'],
  pirate: ['#3b322d', '#4b4039', '#8a2a22'],
};

// ---------- primitives ----------
const pts = (a) => a.map((p) => `${+p[0].toFixed(1)},${+p[1].toFixed(1)}`).join(' ');
const poly = (a, fill, x = '') => `<polygon points="${pts(a)}" fill="${fill}"${x}/>`;
const path = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
const line = (d, stroke, w = 2, x = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x}/>`;
const circ = (x, y, r, fill, e = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${e}/>`;
const ell = (x, y, rx, ry, fill, e = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${e}/>`;
const mirror = (a, cx = 100) => a.map(([x, y]) => [2 * cx - x, y]);

// a background of two or three big facets in the faction's colours
function background(kind, accent) {
  const [a, b, c] = Array.isArray(kind) ? kind : BG[kind];
  return poly([[0, 0], [200, 0], [200, 200], [0, 200]], a)
    + poly([[0, 0], [130, 0], [60, 200], [0, 200]], b)
    + poly([[130, 0], [200, 0], [200, 70]], mix(b, 0.06))
    + poly([[0, 196], [200, 196], [200, 200], [0, 200]], accent || c);
}

// The head. f: { w: half-width at the cheekbones, jaw: half-width at the jaw, chin: half-width at the chin,
// top, cheek, jawY, chinY: heights }. Returns the face with its shadow facets.
const FACE = { w: 31, jaw: 25, chin: 10, top: 50, cheek: 98, jawY: 122, chinY: 140 };
function face(skin, o = {}) {
  const f = { ...FACE, ...o }, s = dk(skin, 0.16), ss = dk(skin, 0.28);
  const L = [[100 - f.w * 0.62, f.top], [100 - f.w * 0.96, f.top + 16], [100 - f.w, f.cheek], [100 - f.jaw, f.jawY], [100 - f.chin, f.chinY]];
  const outline = [...L, ...mirror(L).reverse()];
  return {
    f,
    draw: poly(outline, skin)
      // the shadow side: right cheek and jaw
      + poly([[100 + f.w * 0.62, f.top], [100 + f.w * 0.96, f.top + 16], [100 + f.w, f.cheek], [100 + f.jaw, f.jawY], [100 + f.chin, f.chinY], [104, f.chinY], [108, f.jawY - 4], [100 + f.w * 0.55, f.cheek - 2], [100 + f.w * 0.66, f.top + 18]], s)
      // under the chin and the jaw line
      + poly([[100 - f.jaw * 0.7, f.jawY + 6], [100 - f.chin, f.chinY], [100 + f.chin, f.chinY], [100 + f.jaw * 0.8, f.jawY + 4], [100 + f.chin * 0.6, f.chinY - 5], [100 - f.chin * 0.6, f.chinY - 5]], s)
      // the lit cheek facet
      + poly([[100 - f.w * 0.92, f.cheek - 12], [100 - f.w * 0.5, f.cheek - 6], [100 - f.jaw * 0.85, f.jawY - 4]], lt(skin, 0.08)),
    ears: (y = 0) => poly([[100 - f.w - 6, f.cheek - 18 + y], [100 - f.w + 1, f.cheek - 22 + y], [100 - f.w + 1, f.cheek + 2 + y], [100 - f.w - 4, f.cheek - 2 + y]], skin)
      + poly([[100 + f.w + 6, f.cheek - 18 + y], [100 + f.w - 1, f.cheek - 22 + y], [100 + f.w - 1, f.cheek + 2 + y], [100 + f.w + 4, f.cheek - 2 + y]], ss),
    nose: (len = 1, wide = 1) => {
      const y0 = 86, y1 = 86 + 22 * len, w = 6 * wide;
      return poly([[100, y0], [100 + w * 0.5, y1 - 4], [100 + w, y1], [100, y1 + 2]], s) // the shadowed side
        + poly([[100, y0], [100 - w * 0.3, y1 - 6], [100 - w, y1], [100, y1 + 2]], lt(skin, 0.06))
        + poly([[100 - w, y1], [100 - w * 0.3, y1 + 3], [100, y1 + 2]], ss);
    },
    neck: (w = 13, y = 150) => poly([[100 - w, f.jawY], [100 + w, f.jawY], [100 + w + 2, y + 8], [100 - w - 2, y + 8]], skin)
      + poly([[100 + 2, f.chinY], [100 + w, f.jawY + 4], [100 + w + 2, y + 8], [100, y + 8]], ss),
  };
}

// eyes on a line at y. o: { gap, size, lid (0 open .. 1 shut), tilt, iris, white, lash }
function eyes(y, o = {}) {
  const g = o.gap ?? 14, r = o.size ?? 4.2, lid = o.lid ?? 0.25, tilt = o.tilt ?? 0, iris = o.iris ?? '#2b1d14';
  let out = '';
  for (const sx of [-1, 1]) {
    const x = 100 + sx * g, t = tilt * sx;
    if (o.white !== false) out += ell(x, y, r * 1.55, r * (1 - lid * 0.6), '#efe7d8');
    out += ell(x + sx * 0.4, y + 0.4, r * 0.82, r * 0.82 * (1 - lid * 0.5), iris);
    out += circ(x - 1.1, y - 1, r * 0.22, '#fff', ' opacity="0.8"');
    // upper lid
    out += line(`M${x - r * 1.7} ${y + 0.5 - t} Q${x} ${y - r * (1.2 - lid) - 1} ${x + r * 1.7} ${y + 0.5 + t}`, o.lash || '#2a1a12', o.lash ? 2.6 : 2);
    if (o.bags) out += line(`M${x - r * 1.3} ${y + r + 2} Q${x} ${y + r + 4} ${x + r * 1.4} ${y + r + 1}`, o.bags, 1.2);
  }
  return out;
}
// brows: o: { y, gap, len, thick, tilt (+ is a frown), color, arch }
function brows(o) {
  const y = o.y, g = o.gap ?? 14, len = o.len ?? 11, th = o.thick ?? 3.5, t = o.tilt ?? 0, a = o.arch ?? 1.5;
  let out = '';
  for (const sx of [-1, 1]) {
    const xi = 100 + sx * (g - len / 2 - 1), xo = 100 + sx * (g + len / 2 + 1);
    out += poly([[xi, y + t], [100 + sx * g, y - a - th / 2], [xo, y - t * 0.3], [xo, y - t * 0.3 + th * 0.6], [100 + sx * g, y - a + th / 2], [xi, y + t + th]], o.color);
  }
  return out;
}
// a mouth at y. kind: 'flat' | 'smile' | 'grin' | 'frown' | 'smirk' | 'open'
function mouth(y, kind = 'flat', o = {}) {
  const w = o.w ?? 9, c = o.color ?? '#6b3328', lip = o.lip;
  const lips = lip ? poly([[100 - w * 0.8, y + 1], [100, y + 5], [100 + w * 0.8, y + 1]], lip) : '';
  switch (kind) {
    case 'smile': return lips + line(`M${100 - w} ${y - 1} Q100 ${y + 4} ${100 + w} ${y - 1}`, c, 2.4);
    case 'grin': return path(`M${100 - w - 1} ${y - 2} Q100 ${y + 9} ${100 + w + 1} ${y - 2} Z`, '#3a1610') + poly([[100 - w + 1, y - 1.5], [100 + w - 1, y - 1.5], [100 + w - 3, y + 1.5], [100 - w + 3, y + 1.5]], '#ece2c8') + (o.gap ? poly([[100 + 2, y - 1.6], [100 + 5, y - 1.6], [100 + 5, y + 1.6], [100 + 2, y + 1.6]], '#3a1610') : '');
    case 'frown': return lips + line(`M${100 - w} ${y + 2} Q100 ${y - 2} ${100 + w} ${y + 2}`, c, 2.4);
    case 'smirk': return lips + line(`M${100 - w} ${y + 1} L${100 + w * 0.3} ${y + 0.5} Q${100 + w * 0.8} ${y} ${100 + w + 1} ${y - 3}`, c, 2.4);
    case 'open': return path(`M${100 - w} ${y - 1} Q100 ${y - 3} ${100 + w} ${y - 1} Q100 ${y + 8} ${100 - w} ${y - 1} Z`, '#3a1610');
    default: return lips + line(`M${100 - w} ${y} L${100 + w} ${y}`, c, 2.4);
  }
}

// shoulders and chest. o: { color, neckline, open }
function bust(color, o = {}) {
  const s = dk(color, 0.22), sh = o.shoulder ?? 0;
  return poly([[8, 200], [18 - sh, 172], [44, 154], [78, 146], [122, 146], [156, 154], [182 - sh * -1, 172], [192, 200]], color)
    + poly([[116, 150], [156, 154], [182, 172], [192, 200], [128, 200]], s)
    + poly([[8, 200], [18 - sh, 172], [34, 166], [30, 200]], lt(color, 0.08));
}
const scale = (svg, cx, cy, k) => `<g transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})">${svg}</g>`;

// ---------- the cast ----------
// Each entry: name, role, side ('venice' | 'ottoman' | 'island' | 'pirate'), where they appear, and draw().
// `face` on an entry is the box the small crop zooms to: [x, y, size].
export const CAST = {
  manolis: {
    name: 'Old Manolis', role: 'The pilot', side: 'crew',
    where: 'Prologue; advisor in every mission (wind, shoals, rocks)',
    draw() {
      const skin = SKIN.tan, F = face(skin, { w: 29, jaw: 22, chin: 9, top: 54 }), white = '#ece8df', wd = '#c9c3b6', scarf = '#1d1b1c';
      return background('crew')
        + bust('#22262e') // a dark vest
        + poly([[84, 146], [116, 146], [108, 200], [92, 200]], '#e6dcc7') // the shirt
        + poly([[30, 200], [40, 186], [160, 186], [170, 200]], '#7c2a22') // a red sash
        + F.neck(12) + F.ears(2) + F.draw
        // forehead lines and crow's feet
        + line('M86 72 Q100 69 114 72', dk(skin, 0.3), 1.3) + line('M76 92 L71 89 M76 95 L70 95 M124 92 L129 89 M124 95 L130 95', dk(skin, 0.3), 1.2)
        + eyes(92, { lid: 0.55, size: 3.6, gap: 13 })
        + brows({ y: 84, gap: 13, len: 13, thick: 5, tilt: -1.5, color: white, arch: 2.5 })
        + F.nose(1.15, 1.2)
        // the great white beard and moustache
        + path('M70 106 Q66 140 82 162 Q92 176 100 178 Q108 176 118 162 Q134 140 130 106 Q124 124 112 126 Q100 122 88 126 Q76 124 70 106 Z', white)
        + path('M104 124 Q112 126 124 118 Q128 112 130 106 Q134 140 118 162 Q110 172 100 178 Z', wd)
        + path('M80 118 Q90 110 100 113 Q110 110 120 118 Q112 122 100 119 Q88 122 80 118 Z', white)
        + line('M90 140 L94 154 M106 140 L104 156 M98 132 L99 150', wd, 1.4)
        // the black fringed Cretan headscarf
        + path('M66 76 Q64 44 100 40 Q136 44 134 76 Q100 66 66 76 Z', scarf)
        + path('M64 78 Q100 64 136 78 L136 70 Q100 58 64 70 Z', '#2c292a')
        + Array.from({ length: 13 }, (_, i) => { const x = 68 + i * 5.3, y = 75 - Math.sin((i / 12) * Math.PI) * 9; return poly([[x - 2, y], [x + 2, y], [x, y + 6]], scarf); }).join('')
        + path('M130 70 Q146 74 150 96 L142 98 Q140 82 128 78 Z', scarf); // the knot's tail
    },
  },
  marousa: {
    name: 'Marousa', role: 'The gunner', side: 'crew',
    where: 'Officer from mission 3 on; briefings for the calm',
    draw() {
      const skin = SKIN.olive, F = face(skin, { w: 28, jaw: 21, chin: 8, top: 54, chinY: 136 }), hair = '#2a1a14', red = '#c2362b';
      return background('crew')
        + path('M58 120 Q50 160 62 186 L80 186 Q72 150 74 116 Z', hair) // the braid behind
        + bust('#5a3a24') // a leather jerkin
        + poly([[86, 146], [114, 146], [106, 176], [94, 176]], '#e9dfc9')
        + poly([[34, 160], [48, 152], [160, 200], [140, 200]], '#3a2516') // the powder-horn strap
        + F.neck(11) + F.draw
        + eyes(93, { lid: 0.3, size: 3.8, gap: 13, lash: '#140c08' })
        + brows({ y: 84, gap: 13, len: 12, thick: 3, tilt: 1.2, color: hair, arch: 1 })
        + F.nose(0.95, 0.9)
        + mouth(120, 'smirk', { w: 8, color: '#7a3329', lip: '#a8574a' })
        // soot on the cheek
        + line('M113 106 L124 103 M115 110 L123 109', '#3b3330', 2.2, ' opacity="0.4"')
        // the hair under the scarf, and the red scarf tied at the nape
        + path('M70 80 Q70 62 100 58 Q130 62 130 80 Q122 70 100 70 Q78 70 70 80 Z', hair)
        + path('M64 82 Q60 44 100 40 Q140 44 136 82 Q132 64 100 60 Q68 64 64 82 Z', red)
        + path('M100 40 Q130 42 136 70 Q122 50 100 48 Z', dk(red, 0.2))
        + poly([[134, 76], [152, 86], [148, 100], [138, 88]], red) + poly([[136, 80], [156, 104], [146, 108], [134, 88]], dk(red, 0.2))
        + line('M70 60 Q100 50 130 60', dk(red, 0.3), 1.2, ' stroke-dasharray="3 4"')
        // gold hoops
        + `<circle cx="70" cy="110" r="5" fill="none" stroke="#e2b54a" stroke-width="2.2"/><circle cx="130" cy="110" r="5" fill="none" stroke="#b58b2e" stroke-width="2.2"/>`;
    },
  },
  barbaro: {
    name: 'Captain Zuanne Barbaro', role: 'Captain of marines (Venice)', side: 'crew',
    where: 'Briefs the Venetian powder run; rival on the Ottoman side; joins Venice after the calm',
    draw() {
      const skin = SKIN.fair, F = face(skin, { w: 29, jaw: 24, chin: 9 }), hair = '#2b1d16', steel = '#9aa3ab';
      return background('crew')
        + bust('#a3282a', { shoulder: 2 }) // red doublet
        // the breastplate
        + path('M56 200 L60 160 Q100 146 140 160 L144 200 Z', steel)
        + path('M100 152 Q120 150 140 160 L144 200 L100 200 Z', dk(steel, 0.22))
        + line('M100 152 L100 200', lt(steel, 0.3), 2)
        + poly([[44, 160], [62, 154], [156, 200], [134, 200]], '#c9a64a') // a gold sash
        + poly([[84, 146], [116, 146], [112, 156], [88, 156]], '#efe8d6') // a white collar
        + F.neck(12) + F.ears() + F.draw
        // dark hair to the jaw under the helmet
        + path('M68 74 L64 120 L72 116 L72 80 Z M132 74 L136 120 L128 116 L128 80 Z', hair)
        + eyes(92, { lid: 0.35, size: 3.8 })
        + brows({ y: 83, len: 13, thick: 4, tilt: 2.5, color: hair })
        + F.nose(1.05, 1)
        // upturned moustache and pointed beard
        + path('M80 114 Q88 108 100 111 Q112 108 120 114 Q126 108 128 104 Q126 116 114 117 Q106 116 100 115 Q94 116 86 117 Q74 116 72 104 Q74 108 80 114 Z', hair)
        + path('M92 126 Q100 124 108 126 L102 152 L100 156 L98 152 Z', hair)
        + mouth(120, 'flat', { w: 6, color: '#5a2a22' })
        // a scar through the left brow
        + line('M80 78 L88 96', '#9a5b4a', 1.6)
        // the steel morion: dome, comb and upswept brim
        + path('M66 72 Q66 44 100 40 Q134 44 134 72 Z', steel)
        + path('M100 40 Q134 44 134 72 L100 72 Z', dk(steel, 0.18))
        + path('M96 42 Q98 18 104 14 Q110 18 106 42 Z', lt(steel, 0.08)) + path('M100 14 Q110 18 106 42 L101 42 Z', dk(steel, 0.18))
        + path('M38 54 Q50 72 100 74 Q150 72 162 54 Q156 80 100 82 Q44 80 38 54 Z', lt(steel, 0.1))
        + path('M100 74 Q150 72 162 54 Q156 80 100 82 Z', dk(steel, 0.2))
        + circ(74, 74, 2, '#d7c690') + circ(126, 74, 2, '#a8996a');
    },
  },
  ibrahim: {
    name: 'İbrahim Reis', role: 'Patrol captain (the Porte)', side: 'crew',
    where: 'Briefs the Ottoman powder raid; rival on the Venetian side; joins the Porte after the calm',
    draw() {
      const skin = SKIN.tan, F = face(skin, { w: 30, jaw: 25, chin: 11, top: 58 }), beard = '#1c1512', white = '#f1ece0', wd = '#cfc6b3', coat = '#244e78';
      return background('crew')
        + bust(coat)
        + poly([[86, 146], [114, 146], [100, 200]], '#d8c9a2') // the inner robe
        + Array.from({ length: 4 }, (_, i) => line(`M${84 - i * 2} ${160 + i * 10} L${74 - i * 2} ${160 + i * 10} M${116 + i * 2} ${160 + i * 10} L${126 + i * 2} ${160 + i * 10}`, '#d7b25a', 2.4)).join('') // gold frogging
        + F.neck(13) + F.ears(2) + F.draw
        + eyes(95, { lid: 0.4, size: 3.8 })
        + brows({ y: 86, len: 13, thick: 4.5, tilt: 0.8, color: beard })
        + F.nose(1.1, 1.15)
        // a full, trimmed black beard
        + path('M70 100 Q68 134 84 150 Q100 160 116 150 Q132 134 130 100 Q126 118 114 122 Q100 118 86 122 Q74 118 70 100 Z', beard)
        + path('M78 116 Q90 108 100 111 Q110 108 122 116 Q112 120 100 118 Q88 120 78 116 Z', beard)
        + mouth(124, 'flat', { w: 6, color: '#7a3a2c' })
        // the white turban wound round a red cap
        + path('M82 46 Q84 20 100 18 Q116 20 118 46 Z', '#b3322b') + path('M100 18 Q116 20 118 46 L100 46 Z', '#8c2722')
        + path('M58 78 Q50 56 66 42 Q100 26 134 42 Q150 56 142 78 Q100 64 58 78 Z', white)
        + path('M100 32 Q120 32 134 42 Q150 56 142 78 Q122 70 100 70 Z', wd)
        + line('M60 64 Q100 46 140 62 M62 54 Q100 40 136 50 M58 72 Q100 56 142 72', dk(white, 0.18), 1.6);
    },
  },
  piero: {
    name: 'Mastro Piero', role: 'The carpenter (Venice)', side: 'crew',
    where: 'Officer on the Venetian side; grumbles about his planking between fights',
    draw() {
      const skin = SKIN.ruddy, F = face(skin, { w: 32, jaw: 27, chin: 12, top: 48, chinY: 138 }), grey = '#b9b2a6', apron = '#7a5232';
      return background('crew')
        + bust('#5f7184') // a blue-grey working shirt
        + path('M60 200 L66 164 Q100 156 134 164 L140 200 Z', apron) + path('M100 158 Q120 158 134 164 L140 200 L100 200 Z', dk(apron, 0.2))
        + line('M66 164 L56 150 M134 164 L144 150', '#4a3220', 3)
        + F.neck(14) + F.ears(-2) + F.draw
        // bald dome with a grey fringe over the ears
        + path('M100 48 Q122 48 130 70 L128 64 Q120 50 100 50 Z', lt(skin, 0.15))
        + path('M66 70 Q60 84 66 104 L72 100 L70 76 Z', grey) + path('M134 70 Q140 84 134 104 L128 100 L130 76 Z', dk(grey, 0.15))
        // stubble
        + path('M72 108 Q74 132 90 140 L110 140 Q126 132 128 108 Q122 126 100 128 Q78 126 72 108 Z', dk(skin, 0.22), ' opacity="0.45"')
        + eyes(93, { lid: 0.3, size: 3.4, gap: 14 })
        + brows({ y: 82, len: 12, thick: 4, tilt: -1.5, color: grey, arch: 3 })
        + F.nose(1.1, 1.4)
        + mouth(122, 'frown', { w: 9, color: '#6a2c22' })
        // round spectacles pushed up the nose
        + `<g fill="rgba(220,235,245,.18)" stroke="#2f2a26" stroke-width="2"><circle cx="86" cy="93" r="8"/><circle cx="114" cy="93" r="8"/></g>` + line('M94 92 Q100 89 106 92 M78 92 L68 88 M122 92 L132 88', '#2f2a26', 2)
        // a pencil behind the ear
        + poly([[128, 74], [150, 64], [152, 68], [130, 78]], '#d9a640') + poly([[150, 64], [156, 63], [152, 68]], '#3a2a1a');
    },
  },
  kemal: {
    name: 'Usta Kemal', role: 'The carpenter (the Porte)', side: 'crew',
    where: 'Officer on the Ottoman side; grumbles about his planking between fights',
    draw() {
      const skin = SKIN.ruddy, F = face(skin, { w: 32, jaw: 28, chin: 13, top: 52 }), grey = '#cfc8bb', cap = '#7a4a2a', apron = '#6e4a2e';
      return background('crew')
        + bust('#b8a07a') // undyed wool
        + path('M60 200 L64 162 Q100 154 136 162 L140 200 Z', apron) + path('M100 156 Q120 156 136 162 L140 200 L100 200 Z', dk(apron, 0.2))
        // the adze over his shoulder
        + poly([[24, 200], [32, 200], [58, 120], [52, 118]], '#8a6238') + poly([[44, 112], [66, 118], [64, 126], [48, 122]], '#8d969c')
        + F.neck(15) + F.ears(2) + F.draw
        + eyes(95, { lid: 0.45, size: 3.4, gap: 14, bags: dk(skin, 0.3) })
        + brows({ y: 85, len: 14, thick: 5, tilt: -0.5, color: grey, arch: 1 })
        + F.nose(1.2, 1.5)
        + mouth(126, 'smile', { w: 8, color: '#6a2c22' })
        // the great grey moustache
        + path('M70 126 Q74 110 100 112 Q126 110 130 126 Q132 140 124 144 Q120 126 100 122 Q80 126 76 144 Q68 140 70 126 Z', grey)
        + path('M100 112 Q126 110 130 126 Q132 140 124 144 Q120 126 100 122 Z', dk(grey, 0.15))
        // a felt cap with a wound cloth
        + path('M66 74 Q64 44 100 42 Q136 44 134 74 Z', cap) + path('M100 42 Q136 44 134 74 L100 74 Z', dk(cap, 0.2))
        + path('M62 80 Q100 66 138 80 L138 70 Q100 58 62 70 Z', '#e0d3b4') + line('M64 76 Q100 62 136 76', '#a2563a', 2.2)
        + path('M100 58 Q120 60 138 70 L138 80 Q120 72 100 70 Z', '#c4b796');
    },
  },
  recruiter: {
    name: 'Ser Alvise', role: 'Your patron at Suda (Venice)', side: 'venice',
    where: 'Brings Venice’s offer to Lychna in the prologue, then gives your orders at Suda',
    draw() {
      const skin = SKIN.fair, F = face(skin, { w: 28, jaw: 22, chin: 9, top: 52, chinY: 138 }), hair = '#5a3820', coat = '#22201f', hat = '#1f1a1a';
      return background('venice')
        // long curled hair over the shoulders
        + path('M64 70 Q50 120 58 160 Q70 170 80 158 Q74 120 76 80 Z M136 70 Q150 120 142 160 Q130 170 120 158 Q126 120 124 80 Z', hair)
        + bust(coat)
        + Array.from({ length: 5 }, (_, i) => circ(100, 164 + i * 8, 2.2, '#e2c26a')).join('')
        + poly([[30, 200], [42, 176], [70, 162], [76, 200]], '#8d2a2c') // the crimson stole of a Venetian gentleman
        // the falling lace collar
        + path('M70 148 Q100 140 130 148 L136 168 Q100 176 64 168 Z', '#f3efe4') + path('M100 144 Q120 144 130 148 L136 168 Q118 172 100 172 Z', '#d6cfbf')
        + line('M68 166 Q100 174 134 166', '#c9c1ad', 1.4, ' stroke-dasharray="2 3"')
        + F.neck(11, 144) + F.ears() + F.draw
        + eyes(93, { lid: 0.2, size: 3.8, gap: 13, iris: '#4a3524' })
        + brows({ y: 84, gap: 13, len: 12, thick: 3, tilt: -0.5, color: hair, arch: 2.5 })
        + F.nose(1, 0.9)
        // a thin moustache and a tuft under the lip
        + path('M84 116 Q92 110 100 113 Q108 110 116 116 Q108 114 100 116 Q92 114 84 116 Z', hair) + poly([[97, 124], [103, 124], [100, 132]], hair)
        + mouth(120, 'smile', { w: 7, color: '#7a3329' })
        // a broad black hat, cocked, with a white plume
        + path('M68 66 Q66 30 100 26 Q134 30 132 66 Z', hat) + path('M100 26 Q134 30 132 66 L100 66 Z', '#2c2626')
        + path('M26 74 Q40 58 100 60 Q160 58 174 66 Q164 80 100 76 Q46 78 26 74 Z', hat) + path('M100 60 Q160 58 174 66 Q164 80 100 76 Z', '#2c2626')
        + line('M68 64 Q100 56 132 62', '#c9a64a', 3)
        + path('M120 58 Q150 28 182 46 Q168 44 150 54 Q170 50 178 64 Q156 56 132 64 Z', '#f6f2ea') + path('M150 54 Q170 50 178 64 Q156 56 132 64 Z', '#d8d1c3');
    },
  },
  secretary: {
    name: 'Hüseyin Efendi', role: 'Your patron at Chania, the Kapudan Pasha’s secretary', side: 'ottoman',
    where: 'Brings the Porte’s offer to Lychna in the prologue, then gives your orders at Chania',
    crop: '38 4 124 124',
    draw() {
      const skin = SKIN.olive, F = face(skin, { w: 27, jaw: 21, chin: 9, top: 56, chinY: 140 }), beard = '#8e877c', robe = '#4a3a66', cap = '#efe9dc';
      return background('ottoman')
        + bust(robe)
        + path('M28 172 Q60 150 84 146 L92 200 L40 200 Z', '#5c4632') + path('M172 172 Q140 150 116 146 L108 200 L160 200 Z', '#4a3828') // the fur collar
        + poly([[88, 146], [112, 146], [100, 200]], '#e8dfc8')
        // a pen case in the sash
        + poly([[112, 180], [146, 168], [148, 174], [114, 186]], '#b8913e')
        + F.neck(11) + F.ears(2) + F.draw
        + eyes(95, { lid: 0.5, size: 3.4, gap: 12 })
        + brows({ y: 87, gap: 12, len: 11, thick: 2.6, tilt: 0.3, color: '#5a5048', arch: 1.5 })
        + F.nose(1.15, 0.8)
        // a short, neat grey beard
        + path('M76 110 Q76 136 90 146 Q100 150 110 146 Q124 136 124 110 Q118 124 108 124 Q100 122 92 124 Q82 124 76 110 Z', beard)
        + path('M86 118 Q100 112 114 118 Q100 118 86 118 Z', beard)
        + mouth(124, 'flat', { w: 5, color: '#6a3a2c' })
        // a tall white felt cap with a narrow wrap at the brow
        + path('M74 64 Q70 18 78 6 Q100 -2 122 6 Q130 18 126 64 Z', cap) + path('M100 0 Q116 0 122 6 Q130 18 126 64 L100 64 Z', '#d6cfc0')
        + path('M66 78 Q64 62 100 58 Q136 62 134 78 Q100 70 66 78 Z', '#2f6a5a') + line('M68 70 Q100 62 132 70', '#1f4a3e', 1.6);
    },
  },
  morosini: {
    name: 'Francesco Morosini', role: 'Captain General of Venice', side: 'venice',
    where: 'Commands Candia; sends for you at the Venetian ending',
    draw() {
      const skin = SKIN.fair, F = face(skin, { w: 30, jaw: 25, chin: 11, top: 52 }), hair = '#d8d4cc', hd = '#b3ada2', mantle = '#8f1d22';
      return background(['#5a1218', '#7a1f24', '#e2c26a'])
        // long grey hair framing the face
        + path('M60 66 Q44 110 52 150 Q66 160 80 148 Q72 110 74 80 Z', hair) + path('M140 66 Q156 110 148 150 Q134 160 120 148 Q128 110 126 80 Z', hd)
        + bust(mantle, { shoulder: 4 })
        // the steel gorget and the ermine of his office
        + path('M74 146 Q100 138 126 146 L130 162 Q100 170 70 162 Z', '#a7aeb5') + path('M100 141 Q118 141 126 146 L130 162 Q116 167 100 167 Z', '#868d94')
        + path('M10 200 L22 170 Q50 158 70 164 L78 200 Z', '#f4f0e6') + path('M190 200 L178 170 Q150 158 130 164 L122 200 Z', '#dcd6c8')
        + [[30, 178], [48, 172], [40, 192], [60, 186], [170, 178], [152, 172], [160, 192], [140, 186]].map(([x, y]) => poly([[x, y - 3], [x + 2, y + 2], [x - 2, y + 2]], '#1a1a1a')).join('')
        + poly([[96, 176], [104, 176], [102, 200], [98, 200]], '#d7b25a') // a gold chain
        + F.neck(13) + F.draw
        + line('M84 70 Q100 67 116 70 M88 76 Q100 74 112 76', dk(skin, 0.22), 1.2)
        + eyes(93, { lid: 0.4, size: 3.6, gap: 13, iris: '#3a4a5a', bags: dk(skin, 0.25) })
        + brows({ y: 84, gap: 13, len: 13, thick: 4, tilt: 1.2, color: hd, arch: 2 })
        + F.nose(1.25, 1.1)
        // white moustache and a small pointed beard
        + path('M80 116 Q90 110 100 113 Q110 110 120 116 Q124 112 126 108 Q122 120 110 119 Q100 117 90 119 Q78 120 74 108 Q76 112 80 116 Z', hair)
        + path('M93 126 Q100 124 107 126 L102 146 L100 148 L98 146 Z', hair)
        + mouth(121, 'flat', { w: 6, color: '#6a2c22' })
        // the hair over the crown
        + path('M64 82 Q60 44 100 42 Q140 44 136 82 Q130 60 100 58 Q72 58 64 82 Z', hair) + path('M100 42 Q140 44 136 82 Q130 60 100 58 Z', hd);
    },
  },
  vizier: {
    name: 'Köprülü Fazıl Ahmed', role: 'The Grand Vizier', side: 'ottoman',
    where: 'Takes command of the siege; sends a robe of honour at the Ottoman ending',
    crop: '30 0 140 140',
    draw() {
      const skin = SKIN.olive, F = face(skin, { w: 30, jaw: 25, chin: 11, top: 60 }), beard = '#1a1412', white = '#f6f2e8', wd = '#d6cfbf', robe = '#b7322a';
      return background(['#163d31', '#245a48', '#d7b25a'])
        + bust(robe, { shoulder: 4 })
        + path('M8 200 L18 172 Q50 152 82 150 L90 200 Z', '#3a2618') + path('M192 200 L182 172 Q150 152 118 150 L110 200 Z', '#2c1c12') // sable
        + poly([[88, 148], [112, 148], [106, 200], [94, 200]], '#d7b25a') + Array.from({ length: 4 }, (_, i) => circ(100, 160 + i * 10, 2.4, '#7a1a16')).join('')
        + F.neck(13) + F.ears(4) + F.draw
        + eyes(98, { lid: 0.45, size: 3.6, gap: 13 })
        + brows({ y: 89, gap: 13, len: 13, thick: 4.5, tilt: 1, color: beard, arch: 1 })
        + F.nose(1.15, 1.1)
        // a long full black beard
        + path('M70 104 Q66 146 86 166 Q100 174 114 166 Q134 146 130 104 Q126 122 114 126 Q100 122 86 126 Q74 122 70 104 Z', beard)
        + path('M78 120 Q90 112 100 115 Q110 112 122 120 Q112 124 100 122 Q88 124 78 120 Z', beard)
        + mouth(128, 'flat', { w: 5, color: '#7a3a2c' })
        // the great round turban of state, with a gold band and a jewelled plume
        + path('M54 86 Q34 40 70 14 Q100 0 130 14 Q166 40 146 86 Q100 70 54 86 Z', white)
        + path('M100 6 Q130 8 146 30 Q166 54 146 86 Q124 76 100 76 Z', wd)
        + line('M50 66 Q100 44 150 66 M48 50 Q100 26 152 50 M58 32 Q100 14 142 32', dk(white, 0.16), 1.6)
        + path('M60 84 Q100 70 140 84 L138 76 Q100 62 62 76 Z', '#d7b25a')
        + circ(100, 46, 6, '#2a6650') + circ(100, 46, 3, '#c9443a')
        + path('M100 42 Q90 14 104 -2 Q112 18 104 42 Z', '#f1ece0') + path('M102 40 Q118 10 124 4 Q118 24 106 42 Z', '#e5ddcd');
    },
  },
  mags: {
    name: 'Cutthroat Mags', role: 'Pirate, the sloop Scavenger', side: 'pirate',
    where: 'The prologue’s pirate, off Lychna',
    draw() {
      const skin = SKIN.ruddy, F = face(skin, { w: 29, jaw: 23, chin: 9, top: 56, chinY: 138 }), hair = '#c4562a', hd = '#9a3e1c', band = '#1e1a18';
      return background('pirate')
        // a mane of red hair going grey
        + path('M58 70 Q30 110 44 160 Q60 150 64 170 Q74 140 74 90 Z', hair) + path('M142 70 Q170 110 156 160 Q140 150 136 170 Q126 140 126 90 Z', hd)
        + line('M50 110 Q46 130 52 150 M150 110 Q154 130 148 150', '#d9d2c4', 2.4)
        + bust('#6a4a32')
        + poly([[84, 146], [116, 146], [108, 168], [92, 168]], '#d9cdb2')
        + poly([[56, 156], [70, 150], [128, 200], [110, 200]], '#2a1e16') // baldric
        + F.neck(11) + F.draw
        + eyes(94, { lid: 0.3, size: 3.8, gap: 13 })
        + brows({ y: 85, gap: 13, len: 12, thick: 3.5, tilt: 2.4, color: hd })
        + F.nose(1.05, 1.1)
        + mouth(120, 'grin', { w: 9, gap: true })
        // a black patch over the right eye, and the scar it hides
        + line('M60 72 L140 104', band, 2.4) + path('M104 86 L122 86 Q124 100 113 102 Q102 100 104 86 Z', band)
        + line('M118 106 L126 120', '#8e4a3a', 1.6)
        // a black bandana
        + path('M64 84 Q60 46 100 42 Q140 46 136 84 Q128 64 100 62 Q72 64 64 84 Z', band)
        + path('M100 42 Q140 46 136 84 Q128 64 100 62 Z', '#2c2622')
        + Array.from({ length: 5 }, (_, i) => circ(76 + i * 12, 54 - Math.sin((i / 4) * Math.PI) * 6, 2, '#e8e0cf')).join('')
        + poly([[64, 76], [46, 70], [50, 88]], band) + poly([[60, 78], [40, 88], [52, 94]], '#2c2622')
        + `<circle cx="71" cy="110" r="4" fill="none" stroke="#d7b25a" stroke-width="2"/>`;
    },
  },
  daughter: {
    name: 'Kate, Mags’s daughter', role: 'Pirate, the sloop Scavenger II', side: 'pirate',
    where: 'Among the islets: knows every rock, as her mother taught her',
    draw() {
      const skin = SKIN.fair, F = face(skin, { w: 27, jaw: 20, chin: 8, top: 56, chinY: 134 }), hair = '#d0662e', hd = '#a84c1e', band = '#3b7a4a';
      return background('pirate')
        // two braids
        + path('M64 96 Q56 130 62 172 L72 172 Q70 132 74 100 Z', hair) + path('M136 96 Q144 130 138 172 L128 172 Q130 132 126 100 Z', hd)
        + [0, 1, 2, 3].map((i) => line(`M61 ${112 + i * 14} L72 ${116 + i * 14} M139 ${112 + i * 14} L128 ${116 + i * 14}`, dk(hair, 0.3), 1.4)).join('')
        + bust('#7d5a3a')
        + poly([[86, 146], [114, 146], [100, 172]], '#ece2cc')
        + F.neck(10) + F.draw
        // freckles
        + [[82, 106], [86, 109], [78, 110], [118, 106], [114, 109], [122, 110], [96, 104], [104, 104]].map(([x, y]) => circ(x, y, 1, '#b8664a')).join('')
        + eyes(94, { lid: 0.15, size: 4, gap: 13, iris: '#3c6a4a', lash: '#3a1a10' })
        + brows({ y: 84, gap: 13, len: 11, thick: 2.6, tilt: -1, color: hd, arch: 2.5 })
        + F.nose(0.85, 0.8)
        + mouth(118, 'smirk', { w: 7, color: '#8a3a30' })
        // hair under a green bandana knotted on top
        + path('M68 92 Q64 64 100 60 Q136 64 132 92 Q126 74 100 72 Q74 74 68 92 Z', hair)
        + path('M66 76 Q64 44 100 42 Q136 44 134 76 Q100 64 66 76 Z', band) + path('M100 42 Q136 44 134 76 Q118 70 100 68 Z', dk(band, 0.2))
        + poly([[96, 44], [84, 30], [94, 34]], band) + poly([[104, 44], [118, 28], [108, 36]], dk(band, 0.2));
    },
  },
  varga: {
    name: 'Captain Varga', role: 'Pirate, the brig Black Tide', side: 'pirate',
    where: 'A lee shore: at sea in a gale because nobody sensible is',
    draw() {
      const skin = '#d6bcaa', F = face(skin, { w: 30, jaw: 26, chin: 12, top: 56 }), black = '#141317', coat = '#26262c';
      return background('pirate')
        + bust(coat, { shoulder: 3 })
        // the high storm collar, rain-dark
        + path('M54 200 L60 150 Q72 140 84 150 L86 200 Z', '#34343c') + path('M146 200 L140 150 Q128 140 116 150 L114 200 Z', '#1a1a1f')
        + F.neck(13) + F.ears(2) + F.draw
        + eyes(96, { lid: 0.5, size: 3.6, gap: 13, iris: '#7f8a92' })
        + brows({ y: 87, gap: 13, len: 14, thick: 5, tilt: 3, color: black })
        + F.nose(1.2, 1.1)
        // a long black beard, wet and pointed
        + path('M70 102 Q68 150 92 186 L100 196 L108 186 Q132 150 130 102 Q126 120 114 124 Q100 120 86 124 Q74 120 70 102 Z', black)
        + line('M90 140 L96 176 M110 140 L104 178 M100 132 L100 186', '#3a3a44', 1.4)
        + path('M76 118 Q90 108 100 112 Q110 108 124 118 Q112 122 100 120 Q88 122 76 118 Z', black)
        // a silver skull earring
        + circ(64, 112, 3.2, '#c9cdd2') + circ(63, 111.5, 0.8, '#222') + circ(65, 111.5, 0.8, '#222')
        // a broad black slouch hat, brim dripping down at the sides
        + path('M66 74 Q64 34 100 30 Q136 34 134 74 Z', black) + path('M100 30 Q136 34 134 74 L100 74 Z', '#1f1f25')
        + path('M22 96 Q30 70 100 66 Q170 70 178 96 Q160 82 100 80 Q40 82 22 96 Z', black) + path('M100 66 Q170 70 178 96 Q160 82 100 80 Z', '#24242b')
        + line('M66 72 Q100 64 134 72', '#55565e', 2.6)
        + line('M28 92 L28 100 M172 92 L172 102 M40 84 L40 90', '#8a8f96', 1.2, ' opacity="0.7"');
    },
  },
  yusra: {
    name: 'Yusra the Red', role: 'Corsair, the xebec Red Sirocco', side: 'pirate',
    where: 'The careenage: caught at anchor with half her crew ashore',
    draw() {
      const skin = SKIN.brown, F = face(skin, { w: 27, jaw: 21, chin: 8, top: 56, chinY: 136 }), red = '#b3372c', rd = '#87261e', gold = '#e6c069';
      return background('pirate')
        + path('M56 90 Q44 150 60 184 L140 184 Q156 150 144 90 Z', rd) // the wrap falling behind
        + bust('#2e2a30')
        + path('M36 172 Q60 150 100 148 Q140 150 164 172 L170 200 L30 200 Z', red) + path('M100 148 Q140 150 164 172 L170 200 L100 200 Z', rd) // the scarf over the shoulders
        + F.neck(10) + F.draw
        // kohl-lined eyes
        + eyes(94, { lid: 0.35, size: 3.8, gap: 13, lash: '#0c0808', tilt: 1.5 })
        + line('M78 95 L72 92 M122 95 L128 92', '#0c0808', 2)
        + brows({ y: 84, gap: 13, len: 12, thick: 3, tilt: 1.8, color: '#160e0c', arch: 2 })
        + F.nose(1, 0.9)
        + mouth(119, 'flat', { w: 7, color: '#5a1e1a', lip: '#7a3028' })
        // a crimson headwrap with a row of gold coins
        + path('M64 92 Q56 44 100 40 Q144 44 136 92 Q132 66 100 64 Q68 66 64 92 Z', red)
        + path('M100 40 Q144 44 136 92 Q132 66 100 64 Z', rd)
        + Array.from({ length: 9 }, (_, i) => { const x = 72 + i * 7, y = 66 - Math.sin((i / 8) * Math.PI) * 4; return circ(x, y, 3, i % 2 ? '#c99a3a' : gold); }).join('')
        + path('M64 92 Q60 120 72 140 L74 120 Z', red) + path('M136 92 Q140 120 128 140 L126 120 Z', rd)
        + circ(100, 74, 2, gold); // a coin on the brow
    },
  },
  thorne: {
    name: 'Silas Thorne', role: 'Pirate, the Widow’s Lament', side: 'pirate',
    where: 'The landing: his men are ashore, burning a village',
    draw() {
      const skin = SKIN.pale, F = face(skin, { w: 26, jaw: 19, chin: 8, top: 52, cheek: 96, jawY: 126, chinY: 146 }), hair = '#18141c', coat = '#4a3366';
      return background('pirate')
        // long lank black hair
        + path('M66 64 Q54 120 62 164 L76 160 Q72 120 76 76 Z', hair) + path('M134 64 Q146 120 138 164 L124 160 Q128 120 124 76 Z', hair)
        + bust(coat)
        // a high collar and a white stock
        + path('M60 200 L66 140 Q74 134 82 146 L86 200 Z', '#5d4280') + path('M140 200 L134 140 Q126 134 118 146 L114 200 Z', '#3a2852')
        + path('M90 150 L110 150 L106 178 L100 184 L94 178 Z', '#ece7df')
        + F.neck(10) + F.draw
        // hollow cheeks
        + poly([[76, 104], [84, 108], [80, 124]], dk(skin, 0.14)) + poly([[124, 104], [116, 108], [120, 124]], dk(skin, 0.24))
        + eyes(92, { lid: 0.6, size: 3.4, gap: 12, iris: '#5a6a5a', bags: dk(skin, 0.3) })
        + brows({ y: 84, gap: 12, len: 12, thick: 2.6, tilt: 2, color: hair, arch: 0.5 })
        + F.nose(1.3, 0.75)
        // a pencil moustache
        + line('M88 117 Q100 113 112 117', hair, 2)
        + mouth(124, 'smirk', { w: 6, color: '#7a4a52' })
        // hair parted in the middle, grey at the temples
        + path('M68 84 Q62 46 100 46 Q138 46 132 84 Q126 60 104 56 L100 64 L96 56 Q74 60 68 84 Z', hair)
        + line('M70 78 Q72 66 80 58 M130 78 Q128 66 120 58', '#8b8492', 2.2);
    },
  },
  korrigan: {
    name: 'Dread Admiral Korrigan', role: 'Pirate, the galleon Leviathan’s Maw', side: 'pirate',
    where: 'False colours: you come alongside under a borrowed flag',
    crop: '30 10 140 140',
    draw() {
      const skin = SKIN.ruddy, F = face(skin, { w: 36, jaw: 32, chin: 16, top: 54, cheek: 100, jawY: 126, chinY: 142 }), beard = '#3a1d16', red = '#9a1c1c', hat = '#16110f';
      return background('pirate')
        + bust(hat, { shoulder: 6 })
        + path('M26 172 L40 160 L66 166 L56 180 Z', '#d7b25a') + path('M174 172 L160 160 L134 166 L144 180 Z', '#a8893e') // epaulettes
        + line('M70 150 L80 200 M130 150 L120 200', red, 4)
        + F.neck(17) + F.ears(2) + F.draw
        // a scar through the left eye, which is milky
        + eyes(94, { lid: 0.35, size: 3.8, gap: 15 }) + circ(85, 94.4, 3, '#cfd6d8')
        + line('M78 76 L94 116', '#8e3a2e', 2.4)
        + brows({ y: 84, gap: 15, len: 15, thick: 6, tilt: 3, color: beard })
        + F.nose(1.25, 1.6)
        // a huge forked beard in braids, tied with red
        + path('M64 104 Q60 150 84 172 L92 196 L100 172 L108 196 L116 172 Q140 150 136 104 Q130 124 116 128 Q100 124 84 128 Q70 124 64 104 Z', beard)
        + path('M74 120 Q88 108 100 112 Q112 108 126 120 Q112 126 100 122 Q88 126 74 120 Z', beard)
        + poly([[86, 176], [94, 176], [94, 182], [86, 182]], red) + poly([[106, 176], [114, 176], [114, 182], [106, 182]], red)
        + mouth(128, 'grin', { w: 8 })
        // a great black hat, brim cocked up, with a red plume
        + path('M60 74 Q58 30 100 26 Q142 30 140 74 Z', hat)
        + path('M18 66 Q24 40 60 50 Q100 60 140 50 Q176 40 182 66 Q140 86 100 82 Q60 86 18 66 Z', hat) + path('M100 60 Q140 50 176 40 Q182 54 182 66 Q140 86 100 82 Z', '#241a16')
        + line('M60 74 Q100 64 140 74', '#d7b25a', 3)
        + path('M48 52 Q30 18 70 10 Q100 6 120 28 Q90 16 70 26 Q56 34 60 50 Z', red) + path('M70 26 Q90 16 120 28 Q96 24 80 36 Z', dk(red, 0.25))
        + circ(100, 70, 4, '#d7b25a');
    },
  },
};
// the twins share a drawing, mirrored, with a cap of their own colour
function twin(cap, flip) {
  const skin = SKIN.tan, F = face(skin, { w: 28, jaw: 23, chin: 10, top: 56, chinY: 136 }), hair = '#1a1310';
  const art = bust('#e6e0d0')
    + [0, 1, 2, 3, 4].map((i) => path(`M${14 + i * 2} ${178 + i * 6} L${186 - i * 2} ${178 + i * 6} L${186 - i * 2} ${181 + i * 6} L${14 + i * 2} ${181 + i * 6} Z`, cap)).join('')
    + poly([[88, 146], [112, 146], [100, 162]], skin)
    + F.neck(12) + F.ears(2) + F.draw
    + path('M70 106 Q72 132 92 140 L108 140 Q128 132 130 106 Q124 126 100 128 Q76 126 70 106 Z', dk(skin, 0.3), ' opacity="0.5"') // stubble
    + eyes(94, { lid: 0.25, size: 3.8, gap: 13 })
    + brows({ y: 85, gap: 13, len: 12, thick: 4, tilt: 1, color: hair, arch: 2 })
    + F.nose(1, 1.1)
    + mouth(120, 'smirk', { w: 8 })
    // black curls under a long knitted cap that flops to one side
    + Array.from({ length: 9 }, (_, i) => circ(66 + i * 8.5, 76 + Math.abs(4 - i) * 1.5, 6, hair)).join('')
    + path('M64 76 Q60 42 100 40 Q136 42 136 76 Q100 64 64 76 Z', cap)
    + path('M100 40 Q136 42 136 76 Q118 70 100 70 Z', dk(cap, 0.2))
    + path('M120 46 Q156 44 164 80 L152 84 Q148 60 124 58 Z', cap) + circ(160, 86, 6, '#efe7d6')
    + line('M64 74 Q100 62 136 74', dk(cap, 0.3), 3);
  return flip ? `<g transform="translate(200 0) scale(-1 1)">${art}</g>` : art;
}
Object.assign(CAST, {
  kastor: { name: 'Kastor', role: 'Pirate, the elder twin (galliot)', side: 'pirate', where: 'The brothers: two galliots hunting as a pair', draw: () => background('pirate') + twin('#2f6aa8', false) },
  polydeukes: { name: 'Polydeukes', role: 'Pirate, the younger twin (galliot)', side: 'pirate', where: 'The brothers: two galliots hunting as a pair', draw: () => background('pirate') + twin('#b8382c', true) },
});

// Every portrait as SVG. o.small crops to the head and shoulders for a notification bubble.
export function portrait(id, o = {}) {
  const c = CAST[id];
  const vb = o.small ? (c.crop || '40 18 120 120') : '0 0 200 200';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="portrait"${o.size ? ` width="${o.size}" height="${o.size}"` : ''} role="img" aria-label="${c.name}">${c.draw()}</svg>`;
}

// Who is speaking in a line of text, from the name it starts with ("Manolis: “…”"), or null. Lines that name
// an officer by job ("The carpenter has opinions…") need the side you serve, which decides who holds the post.
const SPEAKERS = [[/^(Old )?Manolis\b|^Pilot:/, 'manolis'], [/^Marousa\b|^Gunner:/, 'marousa'], [/^(Captain )?(Zuanne )?Barbaro\b/, 'barbaro'], [/^İbrahim Reis\b/, 'ibrahim'],
  [/^(Mastro )?Piero\b/, 'piero'], [/^(Usta )?Kemal\b/, 'kemal'], [/^Ser Alvise\b/, 'recruiter'], [/^Hüseyin Efendi\b/, 'secretary']];
export function speakerOf(text, side) {
  text = text.replace(/<[^>]+>/g, '');
  for (const [re, id] of SPEAKERS) if (re.test(text)) return id;
  if (side && /^The carpenter\b/.test(text)) return officerFace('carpenter', side);
  return null;
}
// the face of the officer who holds a post (OFFICERS in fleet.js), for the side you serve
export function officerFace(post, side) {
  return { pilot: 'manolis', gunner: 'marousa', carpenter: side === 'ottoman' ? 'kemal' : 'piero', marines: side === 'ottoman' ? 'ibrahim' : 'barbaro' }[post] || null;
}
// the face of a pirate captain, by the name on her ship's spec
const CAPTAINS = { 'Cutthroat Mags': 'mags', 'Captain Varga': 'varga', 'Yusra the Red': 'yusra', 'Silas Thorne': 'thorne', 'Dread Admiral Korrigan': 'korrigan', Korrigan: 'korrigan', 'Mags’s daughter': 'daughter' };
export const captainFace = (name) => CAPTAINS[name] || null;
