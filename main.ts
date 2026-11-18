// The World in One Day — news-image-20261117, v4.
// A newspaper front page summing up Tuesday 17 November 2026 in one image.
// Drawn entirely in code: own bitmap font (with lowercase), own PNG encoder,
// 2048x2048 supersampled buffer downsampled 2x2 to 1024x1024.
// Node 22+, standard library only. No network, no file reads, no Date,
// no randomness. Fully deterministic: same bytes on every run.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const NAVY: RGB = [0x1f, 0x2a, 0x44];
const NAVY_DARK: RGB = [0x16, 0x1e, 0x33];
const CREAM: RGB = [0xf4, 0xef, 0xe4];
const PAPER2: RGB = [0xea, 0xe3, 0xd0];
const INK: RGB = [0x14, 0x14, 0x14];
const GREY: RGB = [0x5a, 0x5a, 0x58];
const RED: RGB = [0xb3, 0x23, 0x2a];
const WHITE: RGB = [0xff, 0xff, 0xff];
const SEA: RGB = [0xc7, 0xda, 0xe6];
const LANDDOT: RGB = [0xb3, 0x92, 0x5c];
const TAN: RGB = [0xd8, 0xc9, 0xa3];
const SKY: RGB = [0xb9, 0xd4, 0xe6];
const SEA2: RGB = [0x3f, 0x6d, 0x8e];
const GOLD: RGB = [0xc8, 0x9a, 0x2e];

// Region colours for the map dots.
const REG_EUROPE: RGB = [0x2b, 0x6c, 0xb0];
const REG_MIDEAST: RGB = [0xdd, 0x6b, 0x20];
const REG_ASIA: RGB = [0xc5, 0x30, 0x30];
const REG_AFRICA: RGB = [0x2f, 0x85, 0x5a];
const REG_AMERICAS: RGB = [0x6b, 0x46, 0xc1];
const REG_OCEANIA: RGB = [0x0d, 0x94, 0x88];
const REG_GLOBAL: RGB = [0x71, 0x80, 0x96];

// ---------------------------------------------------------------- canvas
const W2 = 2048;
const H2 = 2048;
const OUT = 1024;
const img: Buffer = Buffer.alloc(W2 * H2 * 3);
for (let i = 0; i < W2 * H2; i++) {
  img[i * 3] = CREAM[0];
  img[i * 3 + 1] = CREAM[1];
  img[i * 3 + 2] = CREAM[2];
}
function px(x: number, y: number, c: RGB): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W2 || yi >= H2) return;
  const o = (yi * W2 + xi) * 3;
  img[o] = c[0];
  img[o + 1] = c[1];
  img[o + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W2, Math.ceil(x + w));
  const y1 = Math.min(H2, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W2 + xx) * 3;
      img[o] = c[0];
      img[o + 1] = c[1];
      img[o + 2] = c[2];
    }
  }
}
// Checker-dithered rectangle: two colours alternating like a chessboard.
function ditherRect(x: number, y: number, w: number, h: number, a: RGB, b: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W2, Math.ceil(x + w));
  const y1 = Math.min(H2, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const c = (xx + yy) % 2 === 0 ? a : b;
      const o = (yy * W2 + xx) * 3;
      img[o] = c[0];
      img[o + 1] = c[1];
      img[o + 2] = c[2];
    }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  const rr = Math.max(0, Math.floor(r));
  for (let dy = -rr; dy <= rr; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
    for (let xx = -dx; xx <= dx; xx++) px(cx + xx, cy + dy, c);
  }
}
function ring(cx: number, cy: number, r: number, c: RGB, thick = 2): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(rad) * r);
    const y = Math.round(cy + Math.sin(rad) * r);
    for (let dy = 0; dy < thick; dy++)
      for (let dx = 0; dx < thick; dx++) px(x + dx, y + dy, c);
  }
}
function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, t, c);
}
function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  rect(x, Math.min(y0, y1), t, Math.abs(y1 - y0) + 1, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    for (let oy = 0; oy < t; oy++)
      for (let ox = 0; ox < t; ox++) px(x + ox, y + oy, c);
  }
}
// Scanline-filled polygon. pts: flat [x0,y0,x1,y1,...].
function poly(pts: number[], c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < pts.length; i += 2) {
    minY = Math.min(minY, pts[i]);
    maxY = Math.max(maxY, pts[i]);
  }
  const n = pts.length / 2;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[((i + 1) % n) * 2];
      const y1 = pts[((i + 1) % n) * 2 + 1];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      hline(Math.round(xs[k]), Math.round(xs[k + 1]), y, c);
    }
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    px(cx + Math.cos(rad) * rx, cy + Math.sin(rad) * ry, c);
  }
}
function ellipseFill(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const dx = Math.floor(rx * Math.sqrt(t));
    for (let xx = -dx; xx <= dx; xx++) px(cx + xx, cy + dy, c);
  }
}

// ---------------------------------------------------------------- font
// Bitmap font: every glyph is 9 rows of 5 cells. Capitals and digits use
// rows 0-6 (baseline row 6). Lowercase x-height letters sit on rows 2-6;
// ascenders reach row 0; descenders (g j p q y) reach rows 7-8.
const GLYPHS: Record<string, string[]> = {};
function g(ch: string, rows: string[]): void {
  GLYPHS[ch] = rows;
}
const BLANK = ".....";
function cap(ch: string, r0: string, r1: string, r2: string, r3: string, r4: string, r5: string, r6: string): void {
  g(ch, [r0, r1, r2, r3, r4, r5, r6, BLANK, BLANK]);
}
cap("A", "01110", "10001", "10001", "11111", "10001", "10001", "10001");
cap("B", "11110", "10001", "10001", "11110", "10001", "10001", "11110");
cap("C", "01110", "10001", "10000", "10000", "10000", "10001", "01110");
cap("D", "11110", "10001", "10001", "10001", "10001", "10001", "11110");
cap("E", "11111", "10000", "10000", "11110", "10000", "10000", "11111");
cap("F", "11111", "10000", "10000", "11110", "10000", "10000", "10000");
cap("G", "01110", "10001", "10000", "10111", "10001", "10001", "01111");
cap("H", "10001", "10001", "10001", "11111", "10001", "10001", "10001");
cap("I", "01110", "00100", "00100", "00100", "00100", "00100", "01110");
cap("J", "00111", "00010", "00010", "00010", "00010", "10010", "01100");
cap("K", "10001", "10010", "10100", "11000", "10100", "10010", "10001");
cap("L", "10000", "10000", "10000", "10000", "10000", "10000", "11111");
cap("M", "10001", "11011", "10101", "10101", "10001", "10001", "10001");
cap("N", "10001", "11001", "10101", "10011", "10001", "10001", "10001");
cap("O", "01110", "10001", "10001", "10001", "10001", "10001", "01110");
cap("P", "11110", "10001", "10001", "11110", "10000", "10000", "10000");
cap("Q", "01110", "10001", "10001", "10001", "10101", "10010", "01101");
cap("R", "11110", "10001", "10001", "11110", "10100", "10010", "10001");
cap("S", "01111", "10000", "10000", "01110", "00001", "00001", "11110");
cap("T", "11111", "00100", "00100", "00100", "00100", "00100", "00100");
cap("U", "10001", "10001", "10001", "10001", "10001", "10001", "01110");
cap("V", "10001", "10001", "10001", "10001", "10001", "01010", "00100");
cap("W", "10001", "10001", "10001", "10101", "10101", "11011", "10001");
cap("X", "10001", "10001", "01010", "00100", "01010", "10001", "10001");
cap("Y", "10001", "10001", "01010", "00100", "00100", "00100", "00100");
cap("Z", "11111", "00001", "00010", "00100", "01000", "10000", "11111");
cap("0", "01110", "10001", "10011", "10101", "11001", "10001", "01110");
cap("1", "00100", "01100", "00100", "00100", "00100", "00100", "01110");
cap("2", "01110", "10001", "00001", "00110", "01000", "10000", "11111");
cap("3", "11110", "00001", "00001", "01110", "00001", "00001", "11110");
cap("4", "00010", "00110", "01010", "10010", "11111", "00010", "00010");
cap("5", "11111", "10000", "11110", "00001", "00001", "10001", "01110");
cap("6", "01110", "10000", "10000", "11110", "10001", "10001", "01110");
cap("7", "11111", "00001", "00010", "00100", "01000", "01000", "01000");
cap("8", "01110", "10001", "10001", "01110", "10001", "10001", "01110");
cap("9", "01110", "10001", "10001", "01111", "00001", "00001", "01110");
// Lowercase a-z.
g("a", [BLANK, BLANK, "01110", "00001", "01111", "10001", "01111", BLANK, BLANK]);
g("b", ["10000", "10000", "10110", "11001", "10001", "10001", "11110", BLANK, BLANK]);
g("c", [BLANK, BLANK, "01110", "10000", "10000", "10001", "01110", BLANK, BLANK]);
g("d", ["00001", "00001", "01101", "10011", "10001", "10001", "01111", BLANK, BLANK]);
g("e", [BLANK, BLANK, "01110", "10001", "11111", "10000", "01110", BLANK, BLANK]);
g("f", ["00110", "01000", "01000", "11110", "01000", "01000", "01000", BLANK, BLANK]);
g("g", [BLANK, BLANK, "01111", "10001", "10001", "01111", "00001", "01110", BLANK]);
g("h", ["10000", "10000", "10110", "11001", "10001", "10001", "10001", BLANK, BLANK]);
g("i", [BLANK, "00100", BLANK, "01100", "00100", "00100", "00100", "01110", BLANK]);
g("j", [BLANK, "00010", BLANK, "00110", "00010", "00010", "00010", "00010", "01100"]);
g("k", ["10000", "10000", "10010", "10100", "11000", "10100", "10010", BLANK, BLANK]);
g("l", ["01100", "00100", "00100", "00100", "00100", "00100", "01110", BLANK, BLANK]);
g("m", [BLANK, BLANK, "11010", "10101", "10101", "10101", "10101", BLANK, BLANK]);
g("n", [BLANK, BLANK, "10110", "11001", "10001", "10001", "10001", BLANK, BLANK]);
g("o", [BLANK, BLANK, "01110", "10001", "10001", "10001", "01110", BLANK, BLANK]);
g("p", [BLANK, BLANK, "10110", "11001", "10001", "11110", "10000", "10000", "10000"]);
g("q", [BLANK, BLANK, "01101", "10011", "10001", "10001", "01111", "00001", "00001"]);
g("r", [BLANK, BLANK, "10110", "11001", "10000", "10000", "10000", BLANK, BLANK]);
g("s", [BLANK, BLANK, "01111", "10000", "01110", "00001", "11110", BLANK, BLANK]);
g("t", [BLANK, "01000", "01000", "11110", "01000", "01000", "00110", BLANK, BLANK]);
g("u", [BLANK, BLANK, "10001", "10001", "10001", "10011", "01101", BLANK, BLANK]);
g("v", [BLANK, BLANK, "10001", "10001", "10001", "01010", "00100", BLANK, BLANK]);
g("w", [BLANK, BLANK, "10001", "10101", "10101", "10101", "01010", BLANK, BLANK]);
g("x", [BLANK, BLANK, "10001", "01010", "00100", "01010", "10001", BLANK, BLANK]);
g("y", [BLANK, BLANK, "10001", "10001", "01011", "00110", "00010", "00100", "01000"]);
g("z", [BLANK, BLANK, "11111", "00010", "00100", "01000", "11111", BLANK, BLANK]);
// Punctuation.
g(".", [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, "01100", BLANK, BLANK]);
g(",", [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, "01100", "00100", "01000"]);
g(":", [BLANK, BLANK, "01100", BLANK, BLANK, BLANK, "01100", BLANK, BLANK]);
g(";", [BLANK, BLANK, "01100", BLANK, BLANK, BLANK, "01100", "00100", "01000"]);
g("'", ["00100", "00100", "01000", BLANK, BLANK, BLANK, BLANK, BLANK, BLANK]);
g("’", ["00100", "00100", "01000", BLANK, BLANK, BLANK, BLANK, BLANK, BLANK]);
g("-", [BLANK, BLANK, BLANK, BLANK, "01110", BLANK, BLANK, BLANK, BLANK]);
g("–", [BLANK, BLANK, BLANK, BLANK, "11111", BLANK, BLANK, BLANK, BLANK]);
g("—", [BLANK, BLANK, BLANK, BLANK, "11111", BLANK, BLANK, BLANK, BLANK]);
g("(", [BLANK, "00010", "00100", "01000", "01000", "00100", "00010", BLANK, BLANK]);
g(")", [BLANK, "01000", "00100", "00010", "00010", "00100", "01000", BLANK, BLANK]);
g("!", ["00100", "00100", "00100", "00100", "00100", BLANK, "00100", BLANK, BLANK]);
g("?", ["01110", "10001", "00001", "00010", "00100", BLANK, "00100", BLANK, BLANK]);
g("/", ["00001", "00010", "00010", "00100", "01000", "01000", "10000", BLANK, BLANK]);
g("&", ["01100", "10010", "10100", "01000", "10101", "10010", "01101", BLANK, BLANK]);
g("%", ["11001", "11010", "00010", "00100", "01000", "01011", "10011", BLANK, BLANK]);
g("$", ["00100", "01111", "10100", "01110", "00101", "11110", "00100", BLANK, BLANK]);
g("+", [BLANK, BLANK, "00100", "00100", "11111", "00100", "00100", BLANK, BLANK]);
g("·", [BLANK, BLANK, BLANK, BLANK, "01100", BLANK, BLANK, BLANK, BLANK]);
g("ö", ["01010", BLANK, "01110", "10001", "10001", "10001", "01110", BLANK, BLANK]);
g("ü", ["01010", BLANK, "10001", "10001", "10001", "10011", "01101", BLANK, BLANK]);

function drawChar(ch: string, x: number, y: number, s: number, c: RGB, bold: boolean): void {
  const rows = GLYPHS[ch] || GLYPHS["?"];
  if (!rows) return;
  const off = bold ? Math.max(1, Math.floor(s / 2)) : 0;
  for (let r = 0; r < 9; r++) {
    const row = rows[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "1") {
        rect(x + col * s, y + r * s, s, s, c);
        if (bold) rect(x + col * s + off, y + r * s, s, s, c);
      }
    }
  }
}
function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}
// Word-wrap on word boundaries. Never leaves a single short word alone on
// the last line: if the last line is one word of six letters or fewer and
// the line before it has more than one word, pull one word down.
function wrapText(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  if (lines.length >= 2) {
    const last = lines[lines.length - 1];
    const prev = lines[lines.length - 2];
    if (!last.includes(" ") && last.length <= 6 && prev.includes(" ")) {
      const pi = prev.lastIndexOf(" ");
      const moved = prev.slice(pi + 1);
      lines[lines.length - 2] = prev.slice(0, pi);
      lines[lines.length - 1] = moved + " " + last;
    }
  }
  return lines;
}
function drawText(s: string, x: number, y: number, scale: number, c: RGB, bold = false): void {
  let cx = x;
  for (const ch of s) {
    if (ch === " ") {
      cx += 6 * scale;
      continue;
    }
    drawChar(ch, cx, y, scale, c, bold);
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB, bold = false): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c, bold);
}
function drawLines(lines: string[], x: number, y: number, scale: number, lineH: number, c: RGB, bold = false): void {
  for (let i = 0; i < lines.length; i++) drawText(lines[i], x, y + i * lineH, scale, c, bold);
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function encodePNG(w: number, h: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
function downsample(): Buffer {
  const out = Buffer.alloc(OUT * OUT * 3);
  for (let y = 0; y < OUT; y++) {
    for (let x = 0; x < OUT; x++) {
      let r = 0;
      let g2 = 0;
      let b = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const o = ((y * 2 + dy) * W2 + x * 2 + dx) * 3;
          r += img[o];
          g2 += img[o + 1];
          b += img[o + 2];
        }
      }
      const o2 = (y * OUT + x) * 3;
      out[o2] = Math.round(r / 4);
      out[o2 + 1] = Math.round(g2 / 4);
      out[o2 + 2] = Math.round(b / 4);
    }
  }
  return out;
}

// ---------------------------------------------------------------- world map
// Dot-matrix land mask: 100 columns x 46 rows. Each row lists inclusive
// column ranges that are land. Drawn from the shape of the continents.
const LAND: number[][][] = [
  [], // 0
  [[60, 84]], // 1
  [[28, 32], [58, 86]], // 2
  [[10, 26], [28, 32], [56, 88]], // 3
  [[8, 27], [48, 53], [56, 88]], // 4
  [[7, 28], [47, 53], [55, 89]], // 5
  [[8, 28], [45, 46], [47, 56], [56, 89]], // 6
  [[9, 28], [45, 46], [46, 58], [57, 88]], // 7
  [[10, 28], [45, 46], [46, 58], [58, 87]], // 8
  [[11, 27], [46, 58], [58, 86], [84, 86]], // 9
  [[12, 28], [46, 58], [59, 85], [85, 87]], // 10
  [[12, 28], [47, 57], [59, 84], [85, 86]], // 11
  [[13, 28], [46, 50], [51, 57], [58, 63], [64, 82], [85, 86]], // 12
  [[13, 28], [46, 49], [52, 57], [58, 63], [65, 81]], // 13
  [[14, 24], [58, 62], [66, 70], [71, 80]], // 14
  [[14, 23], [47, 63], [66, 81]], // 15
  [[15, 22], [26, 28], [47, 60], [58, 63], [66, 70], [73, 78]], // 16
  [[15, 21], [26, 27], [47, 60], [58, 63], [66, 70], [73, 77]], // 17
  [[16, 21], [26, 27], [48, 59], [58, 62], [67, 70], [73, 76]], // 18
  [[17, 21], [48, 59], [58, 61], [67, 69], [74, 76]], // 19
  [[18, 22], [48, 59], [59, 61], [67, 69], [74, 77], [82, 84]], // 20
  [[20, 22], [48, 58], [60, 62], [74, 82], [82, 84]], // 21
  [[21, 23], [49, 58], [60, 62], [75, 81], [82, 83]], // 22
  [[23, 31], [49, 58], [76, 80]], // 23
  [[24, 32], [50, 57]], // 24
  [[24, 32], [50, 57]], // 25
  [[24, 32], [51, 57]], // 26
  [[25, 31], [51, 58]], // 27
  [[25, 31], [52, 57], [60, 61]], // 28
  [[25, 30], [52, 56], [60, 61]], // 29
  [[26, 30], [53, 55], [80, 88]], // 30
  [[26, 29], [80, 89]], // 31
  [[26, 29], [80, 89]], // 32
  [[26, 29], [81, 89]], // 33
  [[27, 29], [81, 88]], // 34
  [[27, 28], [82, 87]], // 35
  [[27, 28], [83, 86]], // 36
  [[27, 28], [90, 91]], // 37
  [[27, 28], [90, 91]], // 38
  [[28, 28], [91, 91]], // 39
  [], // 40
  [], // 41
  [], // 42
  [], // 43
  [], // 44
  [], // 45
];
// Numbered pins: story number, mask column/row, region colour.
const PINS: { n: number; col: number; row: number; c: RGB }[] = [
  { n: 1, col: 61, row: 10, c: REG_EUROPE }, // Kerch
  { n: 2, col: 62, row: 15, c: REG_MIDEAST }, // Bahrain
  { n: 3, col: 83, row: 21, c: REG_ASIA }, // Manila
  { n: 4, col: 30, row: 11, c: REG_AMERICAS }, // New York
  { n: 5, col: 27, row: 18, c: REG_AMERICAS }, // Florida
  { n: 6, col: 58, row: 27, c: REG_AFRICA }, // Rwanda
  { n: 7, col: 54, row: 29, c: REG_AFRICA }, // DR Congo
  { n: 8, col: 16, row: 13, c: REG_AMERICAS }, // California
  { n: 9, col: 79, row: 10, c: REG_ASIA }, // Mongolia
  { n: 10, col: 58, row: 14, c: REG_EUROPE }, // Antalya
  { n: 11, col: 58, row: 20, c: REG_AFRICA }, // Eritrea
  { n: 12, col: 26, row: 14, c: REG_AMERICAS }, // Washington
  { n: 13, col: 86, row: 12, c: REG_ASIA }, // Japan
  { n: 14, col: 62, row: 22, c: REG_MIDEAST }, // Aden
  { n: 15, col: 74, row: 20, c: REG_ASIA }, // India east coast
];
const LEGEND: { label: string; c: RGB }[] = [
  { label: "Europe", c: REG_EUROPE },
  { label: "Middle East", c: REG_MIDEAST },
  { label: "Asia", c: REG_ASIA },
  { label: "Africa", c: REG_AFRICA },
  { label: "Americas", c: REG_AMERICAS },
  { label: "Oceania", c: REG_OCEANIA },
  { label: "Global", c: REG_GLOBAL },
];

// ---------------------------------------------------------------- content
type Lead = { n: number; kicker: string; headline: string; deck: string; scene: string };
const LEADS: Lead[] = [
  {
    n: 1,
    kicker: "EUROPE · UKRAINE WAR",
    headline: "Ukrainian drones hit Crimean Bridge for a second day",
    deck: "Two killed, road shut; analysts say a road section fell into the Kerch Strait",
    scene: "bridge",
  },
  {
    n: 2,
    kicker: "MIDDLE EAST · IRAN WAR",
    headline: "Iran's Guards fire drones at US radar in Bahrain",
    deck: "Bahrain says it intercepted them; US jets strike Iran's Qeshm Island",
    scene: "gulf",
  },
  {
    n: 3,
    kicker: "ASIA · DIPLOMACY",
    headline: "Trump in Manila for first Quad in two years",
    deck: "He meets Modi, Takaichi and Albanese at ASEAN; Xi, Trump and Putin meet Thursday in Shenzhen.",
    scene: "summit",
  },
];
type Feat = { n: number; kicker: string; h: string; d: string; scene: string };
const FEATURED: Feat[] = [
  { n: 4, kicker: "US · BANKING", h: "JPMorgan blames software bug for outage", d: "Online banking, branches and Zelle slowed; not a cyberattack", scene: "bank" },
  { n: 5, kicker: "SCIENCE · SPACE", h: "Vulcan fails, destroying 40 Amazon satellites", d: "ULA rocket breaks up ten minutes after lift-off", scene: "rocket" },
  { n: 6, kicker: "EUROPE · MIGRATION", h: "Five EU states plan Rwanda return hub", d: "Germany, Denmark, Austria, Greece, Netherlands; first transfers aimed for 2027", scene: "rwanda" },
  { n: 7, kicker: "AFRICA · HEALTH", h: "Ebola outbreak in DR Congo more than doubles", d: "WHO counts 11,000+ cases and 5,400 deaths", scene: "virus" },
  { n: 8, kicker: "MARKETS · TECHNOLOGY", h: "Nvidia reports first earnings since Huang's exit", d: "Revenue above $115bn, about double a year earlier; board will not reinstate him", scene: "chip" },
  { n: 9, kicker: "ASIA · POLITICS", h: "Mongolia's president says he will resign", d: "Denies $25m rail bribe claim; parliament must approve", scene: "mongolia" },
  { n: 10, kicker: "GLOBAL · CLIMATE", h: "COP31 enters final days split on fossil fuels", d: "Antalya talks split on finance; Robinson urges 'vital' budget", scene: "cop" },
  { n: 11, kicker: "AFRICA · HEALTH", h: "Eritrea has eliminated trachoma", d: "The blinding eye disease is no longer a public-health problem, WHO says", scene: "eritrea" },
  { n: 12, kicker: "US · DEFENCE", h: "Pentagon fails its audit for the ninth year", d: "Auditors cannot verify $4.8 trillion in assets", scene: "pentagon" },
  { n: 13, kicker: "ASIA · DEFENCE", h: "Japan scrambles jets at Russian incursion", d: "Two planes entered airspace near Okinoshima; Tokyo protests", scene: "jets" },
  { n: 14, kicker: "MIDDLE EAST · YEMEN", h: "Houthis close in on Aden as forces retreat", d: "Saudi-backed army pulls back from the Red Sea coast", scene: "aden" },
  { n: 15, kicker: "ASIA · WEATHER", h: "Cyclone Akvan takes aim at India's east coast", d: "Third Bay of Bengal storm in weeks; landfall expected around 20 Nov", scene: "cyclone" },
];
const STATS: { num: string; label: string }[] = [
  { num: "1,441", label: "drones Russia says it downed" },
  { num: "40", label: "Amazon satellites lost" },
  { num: "$115.8bn", label: "Nvidia's quarterly revenue, a beat" },
  { num: "17", label: "killed in two South Africa shootings" },
  { num: "11,300", label: "Ebola cases in DR Congo, WHO says" },
];
type Also = { n: number; lead: string; rest: string };
const ALSO_A: Also[] = [
  { n: 16, lead: "16. US:", rest: "measles cases hit highest since 1991" },
  { n: 17, lead: "17. US:", rest: "Wall Street slides — Dow falls 849 points" },
  { n: 18, lead: "18. France:", rest: "public-sector workers strike over pay" },
  { n: 19, lead: "19. Bangladesh:", rest: "police tear-gas garment workers" },
  { n: 20, lead: "20. China–Canada:", rest: "Xi and Carney agree tariff cuts" },
  { n: 21, lead: "21. Turkey:", rest: "police seize opposition broadcaster Sözcü TV" },
  { n: 22, lead: "22. Space:", rest: "Voyager 1 reaches one light-day from Earth" },
  { n: 23, lead: "23. Gaza:", rest: "allies urge Israel to open crossings" },
  { n: 24, lead: "24. Iran:", rest: "US alleges dirty-bomb plot; Tehran denies" },
  { n: 25, lead: "25. West Bank:", rest: "settler attack kills woman, 72" },
  { n: 26, lead: "26. Geneva:", rest: "128 states open killer-robot talks" },
  { n: 27, lead: "27. Serbia:", rest: "students lead new parliament" },
  { n: 28, lead: "28. Bahrain:", rest: "64 Shia given life over Iran links" },
];
const ALSO_B: Also[] = [
  { n: 29, lead: "29. Football:", rest: "Germany thrash Netherlands 5–0" },
  { n: 30, lead: "30. Brazil", rest: "secures Amazon land for Indigenous peoples" },
  { n: 31, lead: "31. US:", rest: "House Democrats outline opening agenda" },
  { n: 32, lead: "32. Washington", rest: "faces projected $4bn budget gap" },
  { n: 33, lead: "33. Guinea:", rest: "1,263 illegal gold miners arrested" },
  { n: 34, lead: "34. Egypt:", rest: "Trump hails Brotherhood terror listing" },
  { n: 35, lead: "35. India:", rest: "bus plunges into ravine, six dead" },
  { n: 36, lead: "36. Knesset:", rest: "Kahana wins speaker 66–52 after six-hour filibuster" },
  { n: 37, lead: "37. Hormuz:", rest: "tankers hit mines; third US carrier arrives" },
  { n: 38, lead: "38. South Africa:", rest: "17 killed in two night shootings" },
  { n: 39, lead: "39. Washington:", rest: "state faces a $40bn budget gap" },
  { n: 40, lead: "40. Prague:", rest: "two trains collide, 46 injured" },
  { n: 41, lead: "41. Moldova:", rest: "shuts airspace as Russian drone flies over Chisinau" },
];
const MAP_CAPTION =
  "Dots mark stories 1–15. 1 Kerch · 2 Bahrain · 3 Manila · 4 New York · 5 Florida · 6 Rwanda · 7 DR Congo · 8 California · 9 Mongolia · 10 Antalya · 11 Eritrea · 12 Washington · 13 Japan · 14 Aden · 15 India";
const FOOTER =
  "Every story happened or was first reported on Tuesday 17 November 2026. Disputed claims are attributed. Sources: AP, Reuters, AFP, BBC, Al Jazeera, UN News. Original drawings.";

// ---------------------------------------------------------------- scenes
// Every scene is drawn from flat shapes inside the rectangle it is given.
// x, y, w, h are in 2x (2048) coordinates.
function sceneBadge(x: number, y: number, n: number, r: number): void {
  disc(x + r, y + r, r, RED);
  ring(x + r, y + r, r, WHITE, 2);
  const s = String(n);
  const sc = s.length > 1 ? 2 : 3;
  drawTextCentered(s, x + r, y + r - Math.floor((9 * sc) / 2) + 2, sc, WHITE, true);
}
function sceneBridge(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  // Sun and clouds.
  disc(x + w - 70, y + 34, 22, [0xf2, 0xd8, 0x8a]);
  ellipseFill(x + 60, y + 30, 46, 12, WHITE);
  ellipseFill(x + 110, y + 38, 34, 10, WHITE);
  ellipseFill(x + w - 200, y + 26, 40, 11, WHITE);
  // Sea.
  rect(x, y + Math.floor(h * 0.58), w, h - Math.floor(h * 0.58), SEA2);
  ditherRect(x, y + Math.floor(h * 0.58), w, 10, SEA2, [0x4d, 0x7d, 0x9c]);
  // Waves with whitecaps.
  for (let i = 0; i < 7; i++) {
    const wx = x + 20 + i * 92;
    const wy = y + h - 26 - (i % 2) * 12;
    line(wx, wy, wx + 26, wy - 8, WHITE, 3);
    line(wx + 26, wy - 8, wx + 52, wy, WHITE, 3);
  }
  // Bridge deck: two standing spans, middle span collapsed into the sea.
  const deckY = y + Math.floor(h * 0.42);
  rect(x + 8, deckY, Math.floor(w * 0.38), 10, INK);
  rect(x + Math.floor(w * 0.62), deckY, w - Math.floor(w * 0.62) - 8, 10, INK);
  // Towers.
  rect(x + Math.floor(w * 0.2), deckY - 52, 8, 62, INK);
  rect(x + Math.floor(w * 0.36), deckY - 52, 8, 62, INK);
  rect(x + Math.floor(w * 0.66), deckY - 52, 8, 62, INK);
  rect(x + Math.floor(w * 0.8), deckY - 52, 8, 62, INK);
  // Cables.
  line(x + Math.floor(w * 0.2), deckY - 52, x + Math.floor(w * 0.28), deckY, GREY, 2);
  line(x + Math.floor(w * 0.36), deckY - 52, x + Math.floor(w * 0.28), deckY, GREY, 2);
  line(x + Math.floor(w * 0.66), deckY - 52, x + Math.floor(w * 0.74), deckY, GREY, 2);
  line(x + Math.floor(w * 0.8), deckY - 52, x + Math.floor(w * 0.74), deckY, GREY, 2);
  // Collapsed span, tilted down into the water.
  line(x + Math.floor(w * 0.4), deckY + 4, x + Math.floor(w * 0.55), deckY + 52, INK, 9);
  disc(x + Math.floor(w * 0.55), deckY + 54, 10, INK);
  // Two smoke plumes.
  disc(x + Math.floor(w * 0.42), deckY - 26, 16, [0x8a, 0x8a, 0x86]);
  disc(x + Math.floor(w * 0.46), deckY - 44, 20, [0x9a, 0x9a, 0x96]);
  disc(x + Math.floor(w * 0.5), deckY - 62, 14, [0xaa, 0xaa, 0xa6]);
  disc(x + Math.floor(w * 0.6), deckY - 18, 12, [0x8a, 0x8a, 0x86]);
  disc(x + Math.floor(w * 0.63), deckY - 34, 15, [0x9a, 0x9a, 0x96]);
  // Rescue boat.
  const bx = x + Math.floor(w * 0.68);
  const by = y + h - 44;
  poly([bx, by, bx + 56, by, bx + 46, by + 14, bx + 8, by + 14], RED);
  rect(bx + 20, by - 14, 16, 14, WHITE);
  // Gulls.
  line(x + 120, y + 66, x + 130, y + 60, INK, 2);
  line(x + 130, y + 60, x + 140, y + 66, INK, 2);
  line(x + 170, y + 52, x + 180, y + 46, INK, 2);
  line(x + 180, y + 46, x + 190, y + 52, INK, 2);
}
function sceneGulf(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SEA);
  // Land: Iran top right, Arabia bottom, Kuwait, Qeshm island.
  poly([x + w * 0.42, y + 4, x + w - 6, y + 4, x + w - 6, y + h * 0.34, x + w * 0.78, y + h * 0.4, x + w * 0.62, y + h * 0.3, x + w * 0.44, y + h * 0.22], TAN);
  poly([x + 6, y + h * 0.72, x + w * 0.5, y + h * 0.66, x + w * 0.66, y + h * 0.8, x + w * 0.6, y + h - 4, x + 6, y + h - 4], TAN);
  poly([x + w * 0.52, y + h * 0.52, x + w * 0.66, y + h * 0.5, x + w * 0.68, y + h * 0.58, x + w * 0.54, y + h * 0.6], TAN);
  // Qeshm island.
  ellipseFill(x + w * 0.6, y + h * 0.44, 34, 8, [0xc0, 0xa8, 0x78]);
  // Drone flight arrows from Iran toward Bahrain (drawn before the island
  // and dome, so no arrow crosses the dome or the labels).
  const ax0 = x + w * 0.72;
  const ay0 = y + h * 0.16;
  const ax1 = x + w * 0.58;
  const ay1 = y + h * 0.32;
  line(ax0, ay0, ax1, ay1, RED, 4);
  poly([ax1, ay1, ax1 + 16, ay1 - 2, ax1 + 4, ay1 + 14], RED);
  line(x + w * 0.82, y + h * 0.24, x + w * 0.64, y + h * 0.36, RED, 3);
  poly([x + w * 0.64, y + h * 0.36, x + w * 0.64 + 14, y + h * 0.36 - 4, x + w * 0.64 + 4, y + h * 0.36 + 12], RED);
  line(x + w * 0.6, y + h * 0.1, x + w * 0.52, y + h * 0.28, RED, 3);
  // Small drone silhouettes.
  disc(ax0, ay0, 5, INK);
  disc(x + w * 0.82, y + h * 0.24, 5, INK);
  // Bahrain island + radar dome, on top of the arrows.
  ellipseFill(x + w * 0.56, y + h * 0.36, 18, 12, [0xe8, 0xdd, 0xc0]);
  disc(x + w * 0.56, y + h * 0.36, 11, WHITE);
  line(x + w * 0.56, y + h * 0.36, x + w * 0.56 - 13, y + h * 0.36 - 11, INK, 2);
  line(x + w * 0.56, y + h * 0.36, x + w * 0.56 + 13, y + h * 0.36 - 11, INK, 2);
  // Labels, kept clear of arrows and land: BAHRAIN over open sea to the
  // left of the island, QESHM below its island.
  drawText("IRAN", x + w * 0.78, y + 8, 2, INK, true);
  drawText("BAHRAIN", x + w * 0.28, y + h * 0.28, 2, INK, true);
  drawText("QESHM", x + w * 0.58, y + h * 0.52, 2, INK, true);
  drawText("GULF", x + w * 0.3, y + h * 0.48, 2, [0x2e, 0x4a, 0x5e], true);
}
function sceneSummit(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xe9, 0xe2, 0xcf]);
  // Backdrop: ASEAN-style emblem, a ring of dots.
  disc(x + w / 2, y + 52, 34, NAVY);
  for (let i = 0; i < 10; i++) {
    const a = (i * 36 * Math.PI) / 180;
    disc(x + w / 2 + Math.cos(a) * 20, y + 52 + Math.sin(a) * 20, 3, GOLD);
  }
  disc(x + w / 2, y + 52, 6, GOLD);
  // Three flags on poles.
  const flagY = y + 14;
  const fx = [x + 56, x + w / 2 - 40, x + w - 136];
  // US flag.
  rect(fx[0], flagY, 80, 44, WHITE);
  for (let s = 0; s < 4; s++) rect(fx[0], flagY + s * 11, 80, 5, RED);
  rect(fx[0], flagY, 34, 24, NAVY);
  // China flag.
  rect(fx[1], flagY, 80, 44, RED);
  disc(fx[1] + 18, flagY + 16, 7, GOLD);
  disc(fx[1] + 40, flagY + 10, 4, GOLD);
  disc(fx[1] + 50, flagY + 20, 4, GOLD);
  // Russia flag.
  rect(fx[2], flagY, 80, 44, WHITE);
  rect(fx[2], flagY + 15, 80, 14, [0x2b, 0x6c, 0xb0]);
  rect(fx[2], flagY + 29, 80, 15, RED);
  for (const px0 of fx) {
    vline(px0 - 4, flagY - 4, flagY + 66, INK, 3);
    disc(px0 - 3, flagY - 6, 4, GOLD);
  }
  // Summit table.
  const ty = y + h - 52;
  rect(x + 24, ty, w - 48, 14, [0x6b, 0x4a, 0x2e]);
  rect(x + 40, ty + 14, 10, h - (ty + 14 - y), [0x4a, 0x32, 0x1e]);
  rect(x + w - 50, ty + 14, 10, h - (ty + 14 - y), [0x4a, 0x32, 0x1e]);
  // Three seated leaders: heads + suits + nameplates + microphones.
  const lx = [x + w * 0.2, x + w * 0.5, x + w * 0.8];
  const suits: RGB[] = [NAVY, [0x3a, 0x3a, 0x3a], [0x5a, 0x2a, 0x2a]];
  for (let i = 0; i < 3; i++) {
    const cx = lx[i];
    poly([cx - 34, ty, cx + 34, ty, cx + 24, ty - 34, cx - 24, ty - 34], suits[i]);
    disc(cx, ty - 48, 15, [0xe8, 0xc4, 0xa8]);
    // Hair.
    poly([cx - 15, ty - 56, cx + 15, ty - 56, cx + 13, ty - 64, cx - 13, ty - 64], i === 1 ? [0x1a, 0x1a, 0x1a] : [0x8a, 0x8a, 0x86]);
    // Tie.
    poly([cx - 4, ty - 32, cx + 4, ty - 32, cx, ty - 6], RED);
    // Nameplate + microphone.
    rect(cx - 30, ty + 2, 60, 10, WHITE);
    line(cx + 34, ty, cx + 44, ty - 18, INK, 2);
    disc(cx + 44, ty - 20, 4, INK);
  }
}
function sceneBank(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xdd, 0xe6, 0xee]);
  // Bank building.
  const bx = x + w * 0.18;
  const bw = w * 0.56;
  poly([bx - 8, y + 18, bx + bw + 8, y + 18, bx + bw / 2, y + 4], NAVY);
  rect(bx, y + 18, bw, 6, NAVY);
  for (let i = 0; i < 4; i++) {
    rect(bx + 6 + i * (bw / 4), y + 24, 6, h - 34, NAVY);
  }
  rect(bx - 6, y + h - 10, bw + 12, 4, NAVY);
  rect(bx - 10, y + h - 6, bw + 20, 4, NAVY);
  // Sign.
  rect(bx + bw * 0.28, y + 26, bw * 0.44, 8, GOLD);
  // Bug icon: body, head, legs.
  const gx = x + w * 0.82;
  const gy = y + h * 0.5;
  ellipseFill(gx, gy, 12, 9, RED);
  disc(gx + 13, gy - 2, 5, RED);
  for (let i = -1; i <= 1; i++) {
    line(gx - 6, gy + i * 4, gx - 16, gy + i * 9, INK, 2);
    line(gx + 6, gy + i * 4, gx + 16, gy + i * 9, INK, 2);
  }
}
function sceneRocket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0x1d, 0x2b, 0x4a]);
  // Stars.
  for (let i = 0; i < 14; i++) {
    const sx = x + 8 + ((i * 37) % Math.floor(w - 16));
    const sy = y + 6 + ((i * 23) % Math.floor(h - 14));
    disc(sx, sy, 2, WHITE);
  }
  // Rocket breaking apart: two tilted pieces.
  const cx = x + w * 0.45;
  const cy = y + h * 0.45;
  poly([cx - 6, cy - 26, cx + 8, cy - 18, cx + 2, cy + 2, cx - 10, cy - 6], WHITE);
  poly([cx - 4, cy - 26, cx + 4, cy - 28, cx + 8, cy - 18], RED);
  poly([cx + 16, cy + 8, cx + 26, cy + 16, cx + 18, cy + 26, cx + 8, cy + 18], [0xcc, 0xcc, 0xcc]);
  // Flame + smoke trail.
  poly([cx - 8, cy + 4, cx + 4, cy + 6, cx - 2, cy + 22], [0xf2, 0x8c, 0x1e]);
  poly([cx - 2, cy + 6, cx + 2, cy + 6, cx, cy + 14], GOLD);
  disc(cx - 14, cy + 26, 7, [0x9a, 0x9a, 0x96]);
  disc(cx - 22, cy + 34, 9, [0xaa, 0xaa, 0xa6]);
  disc(cx + 20, cy + 34, 6, [0x9a, 0x9a, 0x96]);
  // Falling satellite dots.
  disc(x + w * 0.78, y + 14, 4, GOLD);
  disc(x + w * 0.84, y + 30, 3, GOLD);
  disc(x + w * 0.72, y + h - 12, 3, WHITE);
}
function sceneRwanda(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xe6, 0xe9, 0xdf]);
  // House.
  const hx = x + w * 0.1;
  const hy = y + h * 0.3;
  rect(hx, hy, w * 0.34, h * 0.55, [0xc8, 0x9a, 0x6a]);
  poly([hx - 6, hy, hx + w * 0.34 + 6, hy, hx + w * 0.17, hy - 16], RED);
  rect(hx + w * 0.14, hy + h * 0.28, w * 0.08, h * 0.27, NAVY);
  // EU flag.
  const fx = x + w * 0.56;
  const fy = y + 8;
  rect(fx, fy, w * 0.34, h * 0.62, [0x2b, 0x3a, 0x8c]);
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180;
    disc(fx + (w * 0.17) + Math.cos(a) * 14, fy + h * 0.31 + Math.sin(a) * 12, 2, GOLD);
  }
  // Arrow toward the house.
  line(x + w * 0.52, y + h * 0.5, hx + w * 0.36, y + h * 0.5, INK, 3);
  poly([hx + w * 0.36, y + h * 0.5, hx + w * 0.3, y + h * 0.5 - 6, hx + w * 0.3, y + h * 0.5 + 6], INK);
}
function sceneVirus(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0x2e, 0x3a, 0x2e]);
  const cx = x + w * 0.32;
  const cy = y + h * 0.52;
  // Spiky virus.
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    const x1 = cx + Math.cos(a) * 16;
    const y1 = cy + Math.sin(a) * 16;
    const x2 = cx + Math.cos(a) * 26;
    const y2 = cy + Math.sin(a) * 26;
    line(x1, y1, x2, y2, [0x8f, 0xc8, 0x6a], 3);
    disc(x2, y2, 4, [0x8f, 0xc8, 0x6a]);
  }
  disc(cx, cy, 16, [0x5a, 0xa8, 0x4a]);
  disc(cx - 5, cy - 4, 4, [0x2e, 0x3a, 0x2e]);
  disc(cx + 6, cy + 5, 3, [0x2e, 0x3a, 0x2e]);
  // Smaller virus + cells.
  disc(x + w * 0.74, y + 16, 9, [0x5a, 0xa8, 0x4a]);
  disc(x + w * 0.82, y + h - 14, 7, [0x8f, 0xc8, 0x6a]);
  disc(x + w * 0.66, y + h - 10, 5, [0x5a, 0xa8, 0x4a]);
}
function sceneChip(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0x22, 0x2a, 0x38]);
  // Circuit traces.
  line(x + 6, y + h - 10, x + w * 0.3, y + h - 10, [0x5a, 0x8a, 0xc8], 2);
  line(x + w * 0.3, y + h - 10, x + w * 0.3, y + h * 0.55, [0x5a, 0x8a, 0xc8], 2);
  line(x + w - 6, y + 10, x + w * 0.72, y + 10, [0x5a, 0x8a, 0xc8], 2);
  disc(x + 6, y + h - 10, 3, GOLD);
  disc(x + w - 6, y + 10, 3, GOLD);
  // Chip.
  const cx = x + w * 0.36;
  const cy = y + h * 0.32;
  rect(cx, cy, w * 0.28, h * 0.56, INK);
  rect(cx + 4, cy + 4, w * 0.28 - 8, h * 0.56 - 8, [0x3a, 0x4a, 0x6a]);
  for (let i = 0; i < 4; i++) {
    line(cx - 8, cy + 6 + i * 8, cx, cy + 6 + i * 8, GOLD, 2);
    line(cx + w * 0.28, cy + 6 + i * 8, cx + w * 0.28 + 8, cy + 6 + i * 8, GOLD, 2);
  }
  // Rising chart.
  const gx = x + w * 0.68;
  const gy = y + h * 0.75;
  line(gx, gy, gx + 14, gy - 10, RED, 3);
  line(gx + 14, gy - 10, gx + 26, gy - 8, RED, 3);
  line(gx + 26, gy - 8, gx + 40, gy - 22, RED, 3);
  poly([gx + 40, gy - 22, gx + 30, gy - 20, gx + 38, gy - 12], RED);
}
function sceneMongolia(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xe6, 0xdf, 0xd2]);
  // Government building with dome.
  const bx = x + w * 0.2;
  const bw = w * 0.5;
  rect(bx, y + 20, bw, h - 30, [0x8a, 0x7a, 0x5e]);
  poly([bx - 6, y + 20, bx + bw + 6, y + 20, bx + bw / 2, y + 8], NAVY);
  disc(bx + bw / 2, y + 10, 9, GOLD);
  for (let i = 0; i < 4; i++) rect(bx + 6 + i * (bw / 4), y + 26, 5, h - 40, PAPER2);
  // Door.
  rect(bx + bw / 2 - 7, y + h - 16, 14, 12, NAVY);
  // Flag.
  vline(x + w * 0.82, y + 8, y + h - 8, INK, 2);
  rect(x + w * 0.82, y + 8, 26, 16, RED);
  disc(x + w * 0.82 + 13, y + 16, 4, GOLD);
}
function sceneCop(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xdd, 0xe8, 0xe6]);
  // Split globe: half sea, half land, with a crack.
  const cx = x + w * 0.3;
  const cy = y + h * 0.52;
  disc(cx, cy, 24, [0x3f, 0x7d, 0xb0]);
  poly([cx - 24, cy - 24, cx, cy - 24, cx, cy + 24, cx - 24, cy + 24], [0x3f, 0x7d, 0xb0]);
  // Land blobs on the right half.
  ellipseFill(cx + 10, cy - 8, 9, 7, [0x5a, 0xa8, 0x4a]);
  ellipseFill(cx + 12, cy + 10, 7, 5, [0x5a, 0xa8, 0x4a]);
  // Crack line down the middle.
  line(cx, cy - 24, cx + 4, cy - 8, WHITE, 2);
  line(cx + 4, cy - 8, cx - 2, cy + 8, WHITE, 2);
  line(cx - 2, cy + 8, cx + 3, cy + 24, WHITE, 2);
  // Sun + thermometer.
  disc(x + w * 0.78, y + 14, 10, GOLD);
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180;
    line(x + w * 0.78 + Math.cos(a) * 13, y + 14 + Math.sin(a) * 13, x + w * 0.78 + Math.cos(a) * 18, y + 14 + Math.sin(a) * 18, GOLD, 2);
  }
  rect(x + w * 0.72, y + h - 26, 6, 20, WHITE);
  disc(x + w * 0.75, y + h - 6, 6, RED);
  rect(x + w * 0.72, y + h - 18, 6, 8, RED);
}
function sceneEritrea(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xe2, 0xef, 0xe4]);
  // Eye: almond outline, iris, pupil.
  const cx = x + w * 0.34;
  const cy = y + h * 0.5;
  poly([cx - 30, cy, cx - 12, cy - 16, cx + 12, cy - 16, cx + 30, cy, cx + 12, cy + 16, cx - 12, cy + 16], WHITE);
  ring(cx, cy, 13, [0x2b, 0x6c, 0xb0], 3);
  disc(cx, cy, 7, [0x1d, 0x3a, 0x5e]);
  disc(cx, cy, 3, INK);
  // Health cross above.
  rect(cx - 26, cy - 26, 8, 8, RED);
  // Big green check.
  line(x + w * 0.66, y + h * 0.62, x + w * 0.74, y + h * 0.78, [0x2f, 0x85, 0x5a], 6);
  line(x + w * 0.74, y + h * 0.78, x + w * 0.94, y + h * 0.3, [0x2f, 0x85, 0x5a], 6);
}
function scenePentagon(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xe8, 0xe4, 0xd8]);
  // Ledger with lines.
  rect(x + w * 0.08, y + 8, w * 0.42, h - 16, WHITE);
  rect(x + w * 0.08, y + 8, w * 0.42, 8, NAVY);
  for (let i = 0; i < 3; i++) hline(x + w * 0.12, x + w * 0.46, y + 26 + i * 10, GREY, 2);
  // Pentagon building.
  const cx = x + w * 0.72;
  const cy = y + h * 0.52;
  const pts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (-90 + i * 72) * (Math.PI / 180);
    pts.push(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
  }
  poly(pts, [0x8a, 0x7a, 0x5e]);
  poly([cx - 10, cy - 6, cx + 10, cy - 6, cx + 10, cy + 8, cx - 10, cy + 8], NAVY);
  // Big red X stamp.
  line(x + w * 0.56, y + 10, x + w * 0.92, y + h - 8, RED, 6);
  line(x + w * 0.92, y + 10, x + w * 0.56, y + h - 8, RED, 6);
}
function sceneJets(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  disc(x + w - 24, y + 12, 10, [0xf2, 0xd8, 0x8a]);
  // Contrails.
  line(x + 8, y + h * 0.4, x + w * 0.5, y + h * 0.3, WHITE, 3);
  line(x + 8, y + h * 0.62, x + w * 0.42, y + h * 0.55, WHITE, 3);
  // Two fighter jets (delta silhouettes).
  const jx = x + w * 0.56;
  const jy = y + h * 0.3;
  poly([jx, jy, jx + 44, jy + 8, jx + 30, jy + 12, jx + 6, jy + 12, jx + 2, jy + 20, jx - 6, jy + 10], NAVY);
  poly([jx - 20, jy + 22, jx + 20, jy + 30, jx + 8, jy + 34, jx - 14, jy + 34, jx - 18, jy + 40, jx - 24, jy + 32], [0x3a, 0x4a, 0x6a]);
  // Small flag of Japan (white + red disc) at the corner.
  rect(x + w - 34, y + h - 20, 26, 14, WHITE);
  disc(x + w - 21, y + h - 13, 5, RED);
}
function sceneAden(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xe8, 0xdd, 0xc4]);
  // Coast + sea.
  rect(x, y + h * 0.62, w, h * 0.38, SEA2);
  poly([x, y + h * 0.62, x + w * 0.4, y + h * 0.5, x + w * 0.7, y + h * 0.62, x + w, y + h * 0.55, x + w, y + h * 0.62, x, y + h * 0.62], TAN);
  // Map pin at Aden.
  const px0 = x + w * 0.72;
  const py0 = y + h * 0.3;
  disc(px0, py0, 11, RED);
  poly([px0 - 11, py0 + 4, px0 + 11, py0 + 4, px0, py0 + 24], RED);
  disc(px0, py0, 4, WHITE);
  // Retreating convoy: two trucks moving away.
  for (let i = 0; i < 2; i++) {
    const tx = x + 12 + i * 52;
    const ty = y + h * 0.66;
    rect(tx, ty, 34, 14, [0x5a, 0x6a, 0x3a]);
    rect(tx + 26, ty - 8, 12, 8, [0x5a, 0x6a, 0x3a]);
    disc(tx + 8, ty + 16, 4, INK);
    disc(tx + 28, ty + 16, 4, INK);
  }
  // Dust puffs behind the convoy.
  disc(x + 8, y + h * 0.6, 6, [0xc8, 0xb8, 0x92]);
  disc(x + 22, y + h * 0.56, 5, [0xc8, 0xb8, 0x92]);
}
function sceneCyclone(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0xd8, 0xe6, 0xee]);
  // Coast.
  poly([x, y + h - 4, x, y + h * 0.66, x + w * 0.3, y + h * 0.58, x + w * 0.55, y + h * 0.7, x + w * 0.8, y + h * 0.62, x + w, y + h * 0.72, x + w, y + h - 4], TAN);
  // Cyclone spiral: concentric broken rings.
  const cx = x + w * 0.62;
  const cy = y + h * 0.34;
  for (let r = 6; r <= 24; r += 6) {
    for (let a = 0; a < 300; a += 6) {
      const rad = (a * Math.PI) / 180;
      px(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r * 0.8, [0x2b, 0x4a, 0x6a]);
      px(cx + Math.cos(rad) * r + 1, cy + Math.sin(rad) * r * 0.8, [0x2b, 0x4a, 0x6a]);
    }
  }
  disc(cx, cy, 4, [0x2b, 0x4a, 0x6a]);
  // Rain streaks.
  for (let i = 0; i < 5; i++) {
    const rx = x + 14 + i * 22;
    line(rx, y + 10, rx - 6, y + 26, [0x5a, 0x8a, 0xa8], 2);
  }
  // Palm bent by wind.
  line(x + w * 0.16, y + h - 6, x + w * 0.2, y + h * 0.68, [0x5a, 0x4a, 0x2a], 3);
  line(x + w * 0.2, y + h * 0.68, x + w * 0.3, y + h * 0.6, [0x2f, 0x85, 0x5a], 3);
  line(x + w * 0.2, y + h * 0.68, x + w * 0.12, y + h * 0.62, [0x2f, 0x85, 0x5a], 3);
}
function drawScene(kind: string, x: number, y: number, w: number, h: number): void {
  switch (kind) {
    case "bridge": sceneBridge(x, y, w, h); break;
    case "gulf": sceneGulf(x, y, w, h); break;
    case "summit": sceneSummit(x, y, w, h); break;
    case "bank": sceneBank(x, y, w, h); break;
    case "rocket": sceneRocket(x, y, w, h); break;
    case "rwanda": sceneRwanda(x, y, w, h); break;
    case "virus": sceneVirus(x, y, w, h); break;
    case "chip": sceneChip(x, y, w, h); break;
    case "mongolia": sceneMongolia(x, y, w, h); break;
    case "cop": sceneCop(x, y, w, h); break;
    case "eritrea": sceneEritrea(x, y, w, h); break;
    case "pentagon": scenePentagon(x, y, w, h); break;
    case "jets": sceneJets(x, y, w, h); break;
    case "aden": sceneAden(x, y, w, h); break;
    case "cyclone": sceneCyclone(x, y, w, h); break;
    default: rect(x, y, w, h, PAPER2); break;
  }
  // Thin ink frame around every scene.
  rect(x, y, w, 2, INK);
  rect(x, y + h - 2, w, 2, INK);
  rect(x, y, 2, h, INK);
  rect(x + w - 2, y, 2, h, INK);
}

// ---------------------------------------------------------------- layout
function drawMasthead(): void {
  rect(0, 0, W2, 200, NAVY);
  drawText("THE WORLD IN ONE DAY", 16, 18, 3, WHITE, true);
  const right = "41 STORIES · 6 CONTINENTS · ONE DAY";
  drawText(right, 2032 - textWidth(right, 3), 18, 3, WHITE, true);
  drawTextCentered("TUESDAY 17 NOVEMBER 2026", 1024, 62, 11, WHITE, true);
  rect(0, 192, W2, 8, RED);
}
function drawLeads(): void {
  const xs = [16, 688, 1360];
  const y0 = 212;
  const w = 656;
  for (let i = 0; i < 3; i++) {
    const L = LEADS[i];
    const x = xs[i];
    drawScene(L.scene, x, y0 + 6, w, 164);
    sceneBadge(x + 8, y0 + 12, L.n, 20);
    drawText(L.kicker, x, y0 + 178, 3, RED, true);
    const hl = wrapText(L.headline, 4, w);
    drawLines(hl, x, y0 + 210, 4, 42, INK, true);
    const dl = wrapText(L.deck, 3, w);
    drawLines(dl, x, y0 + 344, 3, 33, INK);
  }
  hline(16, 2032, 680, INK, 3);
}
function drawFeatured(): void {
  const xs = [16, 523, 1030, 1537];
  const ys = [684, 884, 1084];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const F = FEATURED[r * 4 + c];
      const x = xs[c];
      const y = ys[r];
      drawScene(F.scene, x, y + 4, 495, 58);
      sceneBadge(x + 6, y + 8, F.n, 14);
      drawText(F.kicker, x, y + 68, 2, RED, true);
      const hl = wrapText(F.h, 3, 495);
      drawLines(hl, x, y + 90, 3, 33, INK, true);
      const dl = wrapText(F.d, 2, 495);
      drawLines(dl, x, y + 156, 2, 22, INK);
    }
  }
}
function drawStats(): void {
  rect(0, 1296, W2, 128, NAVY_DARK);
  drawTextCentered("BY THE NUMBERS", 1024, 1304, 3, WHITE, true);
  const colW = 403;
  for (let i = 0; i < 5; i++) {
    const cx = 16 + i * colW + Math.floor(colW / 2);
    const S = STATS[i];
    drawTextCentered(S.num, cx, 1332, 5, WHITE, true);
    const ll = wrapText(S.label, 2, 380);
    for (let j = 0; j < ll.length; j++) {
      drawTextCentered(ll[j], cx, 1382 + j * 21, 2, [0xd8, 0xdc, 0xe2]);
    }
  }
}
function drawMap(x0: number, y0: number): void {
  // Sea panel.
  rect(x0, y0, 800, 368, SEA);
  // Land dots.
  for (let row = 0; row < LAND.length; row++) {
    for (const [a, b] of LAND[row]) {
      for (let col = a; col <= b; col++) {
        disc(x0 + col * 8 + 4, y0 + row * 8 + 4, 3, LANDDOT);
      }
    }
  }
  // Numbered region-coloured pins.
  for (const p of PINS) {
    const cx = x0 + p.col * 8 + 4;
    const cy = y0 + p.row * 8 + 4;
    disc(cx, cy, 13, p.c);
    ring(cx, cy, 13, WHITE, 2);
    const s = String(p.n);
    drawTextCentered(s, cx, cy - 9, 2, WHITE, true);
  }
}
function drawLegend(x0: number, y: number): void {
  const rows: number[][] = [[0, 1, 2, 3], [4, 5, 6]];
  for (let r = 0; r < 2; r++) {
    let cx = x0;
    for (const idx of rows[r]) {
      const item = LEGEND[idx];
      rect(cx, y + r * 24, 18, 18, item.c);
      rect(cx, y + r * 24, 18, 18, INK); // outline via thin frame below
      rect(cx, y + r * 24, 18, 2, INK);
      rect(cx, y + r * 24 + 16, 18, 2, INK);
      rect(cx, y + r * 24, 2, 18, INK);
      rect(cx + 16, y + r * 24, 2, 18, INK);
      drawText(item.label, cx + 24, y + r * 24, 2, INK);
      cx += 24 + textWidth(item.label, 2) + 30;
    }
  }
}
function drawAlsoColumn(items: Also[], x: number, w: number, yStart: number): void {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const full = it.lead + " " + it.rest;
    const lines = wrapText(full, 2, w);
    const ry = yStart + i * 39;
    const baseY = lines.length === 1 ? ry + 10 : ry;
    for (let j = 0; j < lines.length; j++) {
      const ln = lines[j];
      if (j === 0 && ln.startsWith(it.lead)) {
        drawText(it.lead, x, baseY, 2, INK, true);
        const rest = ln.slice(it.lead.length);
        drawText(rest, x + textWidth(it.lead + " ", 2), baseY, 2, INK);
      } else {
        drawText(ln, x, baseY + j * 19, 2, INK);
      }
    }
  }
}
function drawBottom(): void {
  drawText("WHERE IT HAPPENED", 16, 1444, 3, INK, true);
  drawText("ALSO ON TUESDAY 17 NOVEMBER", 884, 1444, 3, INK, true);
  hline(16, 816, 1476, INK, 2);
  hline(884, 2032, 1476, INK, 2);
  drawMap(16, 1484);
  drawLegend(16, 1860);
  const cap = wrapText(MAP_CAPTION, 2, 800);
  drawLines(cap, 16, 1912, 2, 22, GREY);
  drawAlsoColumn(ALSO_A, 884, 556, 1480);
  drawAlsoColumn(ALSO_B, 1464, 568, 1480);
}
function drawFooter(): void {
  const lines = wrapText(FOOTER, 2, 2000);
  for (let i = 0; i < lines.length; i++) {
    drawTextCentered(lines[i], 1024, 1996 + i * 21, 2, GREY);
  }
}
function main(): void {
  drawMasthead();
  drawLeads();
  drawFeatured();
  drawStats();
  drawBottom();
  drawFooter();
  // Thin ink frame around the whole page.
  rect(0, 0, W2, 6, INK);
  rect(0, H2 - 6, W2, 6, INK);
  rect(0, 0, 6, H2, INK);
  rect(W2 - 6, 0, 6, H2, INK);
  const small = downsample();
  const png = encodePNG(OUT, OUT, small);
  const dir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "entry.png"), png);
}
main();
