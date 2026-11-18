// news-image-20261117 v3 — "The World in One Day"
// A newspaper front page for Tuesday 17 November 2026, drawn entirely in
// code: 35 stories, 3 big leads, 12 featured, a dot-matrix world map and an
// ALSO list. Rendered at 2x supersampling (2048x2048) and downsampled to
// 1024x1024 so type and shapes come out smooth, not blocky.
// Node 22, standard library only, no network, fully deterministic.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------------------
// Canvas: draw in 1024-space coordinates into a 2048x2048 RGB buffer,
// then average each 2x2 block down to 1024x1024.
// ---------------------------------------------------------------------------
const SS = 2; // supersample factor
const BW = 2048;
const BH = 2048;
const OW = 1024;
const OH = 1024;
const buf = new Uint8Array(BW * BH * 3);

type RGB = [number, number, number];
const NAVY: RGB = [31, 42, 68];
const CREAM: RGB = [244, 239, 228];
const INK: RGB = [20, 20, 20];
const RED: RGB = [179, 35, 42];
const SEA: RGB = [188, 211, 224];
const TAN: RGB = [201, 168, 106];
const TANDARK: RGB = [186, 152, 88];
const PANEL: RGB = [233, 226, 208];
const GREY: RGB = [107, 111, 118];
const SKY: RGB = [207, 224, 232];
const DEEPSEA: RGB = [46, 90, 136];
const GOLD: RGB = [201, 162, 39];
const WHITE: RGB = [255, 255, 255];
const DARKGREY: RGB = [58, 63, 70];
const GREEN: RGB = [74, 124, 89];
const BROWN: RGB = [122, 90, 58];
const SKIN: RGB = [232, 195, 154];
const ORANGE: RGB = [214, 110, 44];
const LIGHTBLUE: RGB = [223, 233, 238];

function setPx(bx: number, by: number, c: RGB): void {
  if (bx < 0 || by < 0 || bx >= BW || by >= BH) return;
  const i = (by * BW + bx) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillAll(c: RGB): void {
  for (let i = 0; i < BW * BH; i++) {
    buf[i * 3] = c[0];
    buf[i * 3 + 1] = c[1];
    buf[i * 3 + 2] = c[2];
  }
}

// All shape helpers take 1024-space coordinates and scale by SS internally.
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x * SS));
  const y0 = Math.max(0, Math.round(y * SS));
  const x1 = Math.min(BW, Math.round((x + w) * SS));
  const y1 = Math.min(BH, Math.round((y + h) * SS));
  for (let by = y0; by < y1; by++) {
    let i = (by * BW + x0) * 3;
    for (let bx = x0; bx < x1; bx++) {
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      i += 3;
    }
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  const bx0 = Math.floor((cx - r) * SS);
  const bx1 = Math.ceil((cx + r) * SS);
  const by0 = Math.floor((cy - r) * SS);
  const by1 = Math.ceil((cy + r) * SS);
  const ccx = cx * SS;
  const ccy = cy * SS;
  const rr = r * SS;
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      const dx = bx + 0.5 - ccx;
      const dy = by + 0.5 - ccy;
      if (dx * dx + dy * dy <= rr * rr) setPx(bx, by, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, thick: number, c: RGB): void {
  const bx0 = Math.floor((cx - r - thick) * SS);
  const bx1 = Math.ceil((cx + r + thick) * SS);
  const by0 = Math.floor((cy - r - thick) * SS);
  const by1 = Math.ceil((cy + r + thick) * SS);
  const ccx = cx * SS;
  const ccy = cy * SS;
  const rOut = (r + thick / 2) * SS;
  const rIn = (r - thick / 2) * SS;
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      const dx = bx + 0.5 - ccx;
      const dy = by + 0.5 - ccy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rOut * rOut && d2 >= rIn * rIn) setPx(bx, by, c);
    }
  }
}

function hline(x: number, y: number, w: number, c: RGB, thick = 1): void {
  rect(x, y - thick / 2, w, thick, c);
}

function vline(x: number, y: number, h: number, c: RGB, thick = 1): void {
  rect(x - thick / 2, y, thick, h, c);
}

// Thick line between two 1024-space points, drawn as stamped discs.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, thick = 1): void {
  const ax = x0 * SS;
  const ay = y0 * SS;
  const bx = x1 * SS;
  const by = y1 * SS;
  const dx = bx - ax;
  const dy = by - ay;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  const r = Math.max(0.75, (thick * SS) / 2);
  for (let s = 0; s <= steps; s++) {
    const px = ax + (dx * s) / steps;
    const py = ay + (dy * s) / steps;
    const x0b = Math.floor(px - r);
    const x1b = Math.ceil(px + r);
    const y0b = Math.floor(py - r);
    const y1b = Math.ceil(py + r);
    for (let byy = y0b; byy <= y1b; byy++) {
      for (let bxx = x0b; bxx <= x1b; bxx++) {
        const ddx = bxx + 0.5 - px;
        const ddy = byy + 0.5 - py;
        if (ddx * ddx + ddy * ddy <= r * r) setPx(bxx, byy, c);
      }
    }
  }
}

// Filled polygon, points in 1024-space [x, y] pairs.
function poly(pts: number[][], c: RGB): void {
  const sp = pts.map(([x, y]) => [x * SS, y * SS]);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of sp) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let by = Math.max(0, Math.floor(minY)); by <= Math.min(BH - 1, Math.ceil(maxY)); by++) {
    const xs: number[] = [];
    for (let i = 0; i < sp.length; i++) {
      const [x1, y1] = sp[i];
      const [x2, y2] = sp[(i + 1) % sp.length];
      if ((y1 <= by + 0.5 && y2 > by + 0.5) || (y2 <= by + 0.5 && y1 > by + 0.5)) {
        xs.push(x1 + ((by + 0.5 - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0b = Math.max(0, Math.ceil(xs[k]));
      const x1b = Math.min(BW - 1, Math.floor(xs[k + 1]));
      for (let bx = x0b; bx <= x1b; bx++) setPx(bx, by, c);
    }
  }
}

// Checkerboard stipple: darker shade dots, for shading texture.
function stipple(x: number, y: number, w: number, h: number, c: RGB, step = 2): void {
  const x0 = Math.round(x * SS);
  const y0 = Math.round(y * SS);
  const x1 = Math.round((x + w) * SS);
  const y1 = Math.round((y + h) * SS);
  const st = Math.max(2, Math.round(step * SS));
  for (let by = y0; by < y1; by += st) {
    for (let bx = x0 + ((by / st) % 2 === 0 ? 0 : st / 2); bx < x1; bx += st) {
      setPx(bx, by, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Bitmap font: 5x7 glyphs, written from scratch. Uppercase A-Z, digits,
// and . , : ; ' - ( ) ! ? / & % $ plus space.
// Sizes are buffer scales: each grid cell is s x s buffer pixels, so the
// advance in 1024-space is 3*s (6*s/2) and height is 3.5*s.
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "01100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "01100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function textW1024(t: string, s: number, tight = false): number {
  if (t.length === 0) return 0;
  return (t.length * (tight ? 5 : 6) - 1) * (s / SS);
}

function drawText(t: string, x: number, y: number, s: number, c: RGB, tight = false): void {
  const up = t.toUpperCase();
  const step = (tight ? 5 : 6) * s; // buffer px per char
  const bx0 = Math.round(x * SS);
  const by0 = Math.round(y * SS);
  for (let i = 0; i < up.length; i++) {
    const g = GLYPHS[up[i]] || GLYPHS[" "];
    const gx = bx0 + i * step;
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") {
          const px = gx + col * s;
          const py = by0 + r * s;
          for (let yy = 0; yy < s; yy++) {
            for (let xx = 0; xx < s; xx++) setPx(px + xx, py + yy, c);
          }
        }
      }
    }
  }
}

function drawTextCentered(t: string, cx: number, y: number, s: number, c: RGB, tight = false): void {
  drawText(t, cx - textW1024(t, s, tight) / 2, y, s, c, tight);
}

function drawTextRight(t: string, rightX: number, y: number, s: number, c: RGB, tight = false): void {
  drawText(t, rightX - textW1024(t, s, tight), y, s, c, tight);
}

// Greedy word wrap on word boundaries. Never leaves a lone short word on
// the last line: if the last line is a single word, pull the previous
// line's last word down onto it (once, when it fits).
function wrapText(text: string, maxW: number, s: number, tight = false): string[] {
  const words = text.split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textW1024(trial, s, tight) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  // Orphan fix.
  if (lines.length >= 2) {
    const last = lines[lines.length - 1];
    if (!last.includes(" ")) {
      const prev = lines[lines.length - 2];
      const pi = prev.lastIndexOf(" ");
      if (pi > 0) {
        const moved = prev.slice(pi + 1);
        const newLast = moved + " " + last;
        const newPrev = prev.slice(0, pi);
        if (textW1024(newLast, s, tight) <= maxW && newPrev !== "") {
          lines[lines.length - 2] = newPrev;
          lines[lines.length - 1] = newLast;
        }
      }
    }
  }
  return lines;
}

function drawWrapped(
  text: string,
  x: number,
  y: number,
  maxW: number,
  s: number,
  lineH: number,
  c: RGB,
  tight = false,
  maxLines = 4
): number {
  const lines = wrapText(text, maxW, s, tight).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, y + i * lineH, s, c, tight);
  }
  return lines.length;
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder: zlib deflate, own CRC32, filter 0, IHDR/IDAT/IEND.
// No text chunks, no timestamps.
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgb: Uint8Array, w: number, h: number): Buffer {
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
    raw[y * (1 + w * 3)] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function downsample(): Uint8Array {
  const out = new Uint8Array(OW * OH * 3);
  for (let y = 0; y < OH; y++) {
    for (let x = 0; x < OW; x++) {
      const oi = (y * OW + x) * 3;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const bi = (y * SS + dy) * BW * 3 + (x * SS + dx) * 3;
          r += buf[bi];
          g += buf[bi + 1];
          b += buf[bi + 2];
        }
      }
      out[oi] = Math.round(r / (SS * SS));
      out[oi + 1] = Math.round(g / (SS * SS));
      out[oi + 2] = Math.round(b / (SS * SS));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
const S_GIANT = 12; // masthead date
const S_HEAD = 5; // lead headlines
const S_HEADSM = 4; // featured headlines, kickers, section titles
const S_SMALL = 3; // decks, also-list, captions

function masthead(): void {
  rect(0, 0, 1024, 110, NAVY);
  drawText("THE WORLD IN ONE DAY", 16, 13, S_HEADSM, WHITE);
  drawTextRight("35 STORIES - 6 CONTINENTS - ONE DAY", 1008, 13, S_HEADSM, WHITE);
  hline(16, 36, 992, GOLD, 2);
  drawTextCentered("TUESDAY 17 NOVEMBER 2026", 512, 46, S_GIANT, WHITE);
  rect(0, 106, 1024, 4, RED);
}

// --- Lead 1: Crimean Bridge, span down in the sea, smoke, rescue boat. ---
function lead1(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 54, SKY);
  circle(x + 28, y + 15, 9, GOLD);
  ring(x + 28, y + 15, 12, 1, GOLD);
  // clouds
  circle(x + 90, y + 12, 7, WHITE);
  circle(x + 100, y + 14, 6, WHITE);
  circle(x + 250, y + 10, 6, WHITE);
  circle(x + 258, y + 12, 5, WHITE);
  stipple(x + 4, y + 40, 120, 10, [190, 208, 218], 3);
  // sea
  rect(x, y + 54, w, h - 54, DEEPSEA);
  stipple(x, y + 56, w, h - 58, [70, 118, 160], 4);
  // whitecaps
  for (let i = 0; i < 8; i++) {
    const wx = x + 12 + i * 38;
    const wy = y + 62 + (i % 3) * 9;
    hline(wx, wy, 16, WHITE, 1);
    hline(wx + 4, wy + 3, 9, WHITE, 1);
  }
  // bridge deck, two towers, cables
  rect(x, y + 46, w, 5, DARKGREY);
  rect(x + 78, y + 14, 8, 36, DARKGREY);
  rect(x + 82, y + 10, 2, 4, DARKGREY);
  rect(x + 218, y + 14, 8, 36, DARKGREY);
  rect(x + 222, y + 10, 2, 4, DARKGREY);
  line(x + 82, y + 14, x + 20, y + 46, DARKGREY, 1);
  line(x + 82, y + 14, x + 150, y + 46, DARKGREY, 1);
  line(x + 222, y + 14, x + 160, y + 46, DARKGREY, 1);
  line(x + 222, y + 14, x + 290, y + 46, DARKGREY, 1);
  // collapsed span plunging into the sea
  line(x + 226, y + 48, x + 292, y + 84, DARKGREY, 5);
  line(x + 226, y + 48, x + 292, y + 84, [90, 96, 104], 2);
  rect(x + 288, y + 80, 10, 4, DARKGREY);
  // smoke plumes over the break
  circle(x + 252, y + 30, 10, [138, 143, 150]);
  circle(x + 268, y + 22, 8, [160, 165, 172]);
  circle(x + 240, y + 36, 7, [160, 165, 172]);
  circle(x + 258, y + 40, 5, [120, 125, 132]);
  // rescue boat with wake
  poly([[x + 138, y + 70], [x + 172, y + 70], [x + 166, y + 78], [x + 144, y + 78]], WHITE);
  rect(x + 148, y + 64, 14, 6, RED);
  rect(x + 152, y + 60, 6, 4, DARKGREY);
  hline(x + 128, y + 80, 14, WHITE, 1);
  hline(x + 174, y + 80, 14, WHITE, 1);
  hline(x + 132, y + 83, 10, WHITE, 1);
  // gulls
  line(x + 40, y + 30, x + 46, y + 26, INK, 1);
  line(x + 46, y + 26, x + 52, y + 30, INK, 1);
  line(x + 120, y + 24, x + 125, y + 21, INK, 1);
  line(x + 125, y + 21, x + 130, y + 24, INK, 1);
  line(x + 300, y + 32, x + 305, y + 29, INK, 1);
  line(x + 305, y + 29, x + 310, y + 32, INK, 1);
  // debris near the break
  rect(x + 276, y + 74, 5, 3, DARKGREY);
  rect(x + 296, y + 70, 4, 3, DARKGREY);
  // frame
  rect(x, y, w, 2, NAVY);
  rect(x, y + h - 2, w, 2, NAVY);
}

// --- Lead 2: Gulf map — Iran, Bahrain, Qeshm, Kuwait, Saudi; drone arrows. ---
function lead2(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SEA);
  stipple(x, y, w, h, [168, 196, 212], 4);
  // Iran (top)
  poly(
    [
      [x + 36, y + 2],
      [x + 310, y + 2],
      [x + 306, y + 26],
      [x + 252, y + 38],
      [x + 186, y + 32],
      [x + 122, y + 40],
      [x + 62, y + 34],
      [x + 30, y + 18],
    ],
    TAN
  );
  stipple(x + 60, y + 8, 200, 18, TANDARK, 5);
  // Arabia (bottom)
  poly(
    [
      [x + 14, y + 68],
      [x + 118, y + 60],
      [x + 205, y + 66],
      [x + 282, y + 76],
      [x + 306, y + 92],
      [x + 8, y + 92],
    ],
    TANDARK
  );
  // Kuwait blob
  circle(x + 96, y + 50, 6, TAN);
  // Bahrain island + radar dome
  circle(x + 152, y + 52, 8, TAN);
  circle(x + 152, y + 48, 7, WHITE);
  rect(x + 145, y + 52, 14, 3, DARKGREY);
  vline(x + 152, y + 36, 8, DARKGREY, 1);
  circle(x + 152, y + 35, 2, RED);
  // Qeshm Island
  poly([[x + 196, y + 56], [x + 252, y + 54], [x + 258, y + 62], [x + 200, y + 64]], TAN);
  // drone flight arrows from Iran toward Bahrain
  for (let i = 0; i < 3; i++) {
    const sx = x + 132 + i * 22;
    const sy = y + 34 - i * 2;
    line(sx, sy, x + 148, y + 46, RED, 2);
    poly(
      [
        [x + 148, y + 46],
        [x + 142, y + 42],
        [x + 154, y + 43],
      ],
      RED
    );
  }
  // dashed flight path dots
  for (let i = 0; i < 5; i++) circle(x + 176 + i * 12, y + 30 + i, 1, RED);
  // labels
  drawText("IRAN", x + 128, y + 8, S_SMALL, INK);
  drawText("BAHRAIN", x + 166, y + 44, S_SMALL, INK);
  drawText("QESHM", x + 208, y + 66, S_SMALL, INK);
  drawText("SAUDI", x + 92, y + 76, S_SMALL, WHITE);
  drawText("KUWAIT", x + 66, y + 40, S_SMALL, INK);
  // frame
  rect(x, y, w, 2, NAVY);
  rect(x, y + h - 2, w, 2, NAVY);
}

// --- Lead 3: ASEAN summit table, four Quad flags, three seated leaders. ---
function lead3(x: number, y: number, w: number, h: number): void {
  // backdrop
  rect(x, y, w, 58, NAVY);
  rect(x, y + 58, w, h - 58, [216, 207, 186]);
  // flag poles (four Quad members, evenly spaced)
  vline(x + 37, y + 8, 34, [200, 200, 200], 1);
  vline(x + 108, y + 8, 34, [200, 200, 200], 1);
  vline(x + 178, y + 8, 34, [200, 200, 200], 1);
  vline(x + 249, y + 8, 34, [200, 200, 200], 1);
  // USA flag: stripes + canton
  for (let i = 0; i < 4; i++) rect(x + 39, y + 8 + i * 5, 34, 2, i % 2 === 0 ? RED : WHITE);
  rect(x + 39, y + 8, 14, 10, [46, 68, 130]);
  circle(x + 43, y + 11, 1, WHITE);
  circle(x + 49, y + 15, 1, WHITE);
  // India flag: saffron / white / green bands + navy chakra wheel
  rect(x + 110, y + 8, 34, 7, [255, 153, 51]);
  rect(x + 110, y + 15, 34, 6, WHITE);
  rect(x + 110, y + 21, 34, 7, [19, 136, 8]);
  ring(x + 127, y + 18, 3, 1, [0, 0, 128]);
  // Japan flag: white field + red disc
  rect(x + 180, y + 8, 34, 20, WHITE);
  circle(x + 197, y + 18, 5, RED);
  // Australia flag: blue field, Union Jack canton, big star + Southern Cross
  rect(x + 251, y + 8, 34, 20, [0, 32, 91]);
  rect(x + 251, y + 8, 17, 10, [0, 32, 91]);
  rect(x + 251, y + 11, 17, 3, WHITE);
  rect(x + 258, y + 8, 3, 10, WHITE);
  rect(x + 251, y + 12, 17, 1, RED);
  rect(x + 259, y + 8, 1, 10, RED);
  circle(x + 258, y + 23, 2, WHITE);
  circle(x + 275, y + 12, 1, WHITE);
  circle(x + 281, y + 17, 1, WHITE);
  circle(x + 275, y + 22, 1, WHITE);
  circle(x + 269, y + 17, 1, WHITE);
  // seated leaders: heads, suits, ties
  const figs: [number, RGB][] = [
    [70, [31, 42, 68]],
    [160, [90, 90, 96]],
    [250, [20, 20, 20]],
  ];
  for (const [fx, suit] of figs) {
    circle(x + fx, y + 50, 7, SKIN);
    rect(x + fx - 5, y + 44, 10, 3, [60, 60, 60]); // hair
    poly(
      [
        [x + fx - 13, y + 72],
        [x + fx - 9, y + 56],
        [x + fx + 9, y + 56],
        [x + fx + 13, y + 72],
      ],
      suit
    );
    poly([[x + fx - 2, y + 57], [x + fx + 2, y + 57], [x + fx, y + 68]], RED);
  }
  // table with cloth
  rect(x + 16, y + 72, 288, 5, BROWN);
  rect(x + 16, y + 72, 288, 3, CREAM);
  rect(x + 22, y + 77, 4, 13, BROWN);
  rect(x + 294, y + 77, 4, 13, BROWN);
  // nameplates + microphones
  for (const fx of [70, 160, 250]) {
    rect(x + fx - 15, y + 79, 30, 6, WHITE);
    hline(x + fx - 11, y + 82, 22, GREY, 1);
    line(x + fx + 14, y + 72, x + fx + 20, y + 60, INK, 1);
    circle(x + fx + 20, y + 59, 2, INK);
  }
  // frame
  rect(x, y, w, 2, NAVY);
  rect(x, y + h - 2, w, 2, NAVY);
}

interface Lead {
  kicker: string;
  headline: string;
  deck: string;
  scene: (x: number, y: number, w: number, h: number) => void;
}

const LEADS: Lead[] = [
  {
    kicker: "EUROPE - UKRAINE WAR",
    headline: "Ukrainian drones hit Crimean Bridge for a second day",
    deck: "Road span falls into the Kerch Strait; Russia hits Kyiv bridges in reply",
    scene: lead1,
  },
  {
    kicker: "MIDDLE EAST - IRAN WAR",
    headline: "Iran's Guards fire drones at US radar in Bahrain",
    deck: "Bahrain says it intercepted them; US jets strike Iran's Qeshm Island",
    scene: lead2,
  },
  {
    kicker: "ASIA - DIPLOMACY",
    headline: "TRUMP IN MANILA FOR FIRST QUAD IN TWO YEARS",
    deck: "HE MEETS MODI, TAKAICHI AND ALBANESE AT ASEAN, THEN FLIES TO SHENZHEN FOR APEC",
    scene: lead3,
  },
];

function drawLeads(): void {
  const xs = [12, 352, 692];
  for (let i = 0; i < 3; i++) {
    const x = xs[i];
    const L = LEADS[i];
    L.scene(x, 118, 320, 92);
    drawText(L.kicker, x, 216, S_HEADSM, RED);
    const hl = drawWrapped(L.headline, x, 234, 320, S_HEAD, 20, INK, false, 3);
    drawWrapped(L.deck, x, 234 + hl * 20 + 5, 320, S_SMALL, 12, INK, true, 3);
  }
  vline(344, 118, 204, GREY, 1);
  vline(684, 118, 204, GREY, 1);
  hline(12, 328, 1000, GREY, 1);
}

// --- Featured icons (panel 242 x 30, icon cluster on the left) ---
function iconBank(px: number, py: number): void {
  rect(px + 18, py + 24, 56, 3, DARKGREY);
  rect(px + 22, py + 21, 48, 3, DARKGREY);
  poly([[px + 16, py + 12], [px + 46, py + 2], [px + 76, py + 12]], NAVY);
  circle(px + 46, py + 8, 2, GOLD);
  for (const cx of [26, 42, 58]) rect(px + cx, py + 12, 4, 9, NAVY);
  rect(px + 42, py + 16, 8, 5, INK);
  // bug: oval body, legs, antennae
  circle(px + 92, py + 18, 5, INK);
  circle(px + 92, py + 18, 2, RED);
  line(px + 87, py + 14, px + 82, py + 10, INK, 1);
  line(px + 97, py + 14, px + 102, py + 10, INK, 1);
  line(px + 87, py + 22, px + 82, py + 26, INK, 1);
  line(px + 97, py + 22, px + 102, py + 26, INK, 1);
  line(px + 90, py + 13, px + 88, py + 8, INK, 1);
  line(px + 94, py + 13, px + 96, py + 8, INK, 1);
}

function iconRocket(px: number, py: number): void {
  // stars
  circle(px + 12, py + 6, 1, GOLD);
  circle(px + 84, py + 8, 1, GOLD);
  circle(px + 96, py + 20, 1, GOLD);
  // smoke trail
  circle(px + 66, py + 22, 5, [180, 184, 190]);
  circle(px + 74, py + 25, 4, [200, 204, 210]);
  // flame
  poly([[px + 34, py + 20], [px + 44, py + 20], [px + 39, py + 29]], ORANGE);
  poly([[px + 36, py + 20], [px + 42, py + 20], [px + 39, py + 26]], GOLD);
  // body breaking apart
  poly([[px + 32, py + 4], [px + 46, py + 4], [px + 44, py + 20], [px + 34, py + 20]], WHITE);
  poly([[px + 34, py + 4], [px + 44, py + 4], [px + 39, py + 0]], RED);
  circle(px + 39, py + 11, 2, DEEPSEA);
  poly([[px + 32, py + 16], [px + 26, py + 22], [px + 32, py + 20]], RED);
  poly([[px + 46, py + 16], [px + 52, py + 22], [px + 46, py + 20]], RED);
  // falling fragment
  poly([[px + 58, py + 6], [px + 64, py + 8], [px + 60, py + 14]], DARKGREY);
}

function iconHouseEU(px: number, py: number): void {
  // house
  rect(px + 14, py + 12, 34, 14, [216, 200, 170]);
  poly([[px + 10, py + 13], [px + 31, py + 2], [px + 52, py + 13]], BROWN);
  rect(px + 28, py + 18, 7, 8, INK);
  rect(px + 18, py + 16, 5, 5, DEEPSEA);
  // EU flag
  rect(px + 66, py + 6, 30, 18, [30, 60, 130]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    circle(px + 81 + Math.cos(a) * 6, py + 15 + Math.sin(a) * 6, 1, GOLD);
  }
}

function iconVirus(px: number, py: number): void {
  const cx = px + 30;
  const cy = py + 15;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    line(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, [163, 52, 58], 2);
    circle(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 1, [163, 52, 58]);
  }
  circle(cx, cy, 8, [163, 52, 58]);
  circle(cx - 2, cy - 2, 2, WHITE);
  circle(cx + 3, cy + 2, 1, WHITE);
  // second small virus
  circle(px + 78, py + 20, 5, [163, 52, 58]);
  line(px + 78, py + 13, px + 78, py + 10, [163, 52, 58], 1);
  line(px + 71, py + 20, px + 68, py + 20, [163, 52, 58], 1);
  line(px + 85, py + 20, px + 88, py + 20, [163, 52, 58], 1);
}

function iconChip(px: number, py: number): void {
  // chip with pins
  rect(px + 22, py + 7, 18, 16, INK);
  rect(px + 27, py + 12, 8, 6, GREEN);
  for (let i = 0; i < 3; i++) {
    hline(px + 16, py + 10 + i * 5, 6, INK, 1);
    hline(px + 40, py + 10 + i * 5, 6, INK, 1);
    vline(px + 26 + i * 5, py + 2, 5, INK, 1);
    vline(px + 26 + i * 5, py + 23, 5, INK, 1);
  }
  // circuit traces
  line(px + 46, py + 12, px + 58, py + 12, GREEN, 1);
  line(px + 58, py + 12, px + 58, py + 6, GREEN, 1);
  circle(px + 58, py + 5, 1, GREEN);
  line(px + 46, py + 18, px + 56, py + 18, GREEN, 1);
  // rising chart
  line(px + 64, py + 24, px + 74, py + 18, RED, 2);
  line(px + 74, py + 18, px + 84, py + 20, RED, 2);
  line(px + 84, py + 20, px + 96, py + 8, RED, 2);
  poly([[px + 96, py + 8], [px + 90, py + 8], [px + 96, py + 14]], RED);
  circle(px + 64, py + 24, 1, RED);
  circle(px + 74, py + 18, 1, RED);
  circle(px + 84, py + 20, 1, RED);
}

function iconGov(px: number, py: number): void {
  // dome + columns + door
  circle(px + 30, py + 10, 7, NAVY);
  rect(px + 22, py + 10, 16, 3, NAVY);
  rect(px + 16, py + 13, 28, 3, NAVY);
  for (const cx of [19, 28, 37]) rect(px + cx, py + 16, 3, 8, NAVY);
  rect(px + 27, py + 19, 6, 5, INK);
  rect(px + 14, py + 24, 32, 2, DARKGREY);
  rect(px + 12, py + 26, 36, 2, DARKGREY);
  // flag
  vline(px + 62, py + 4, 16, INK, 1);
  rect(px + 63, py + 4, 12, 7, RED);
}

function iconGlobe(px: number, py: number): void {
  const cx = px + 32;
  const cy = py + 15;
  circle(cx, cy, 12, DEEPSEA);
  poly(
    [
      [cx, cy - 12],
      [cx + 11, cy - 5],
      [cx + 8, cy + 4],
      [cx + 12, cy + 10],
      [cx, cy + 12],
    ],
    GREEN
  );
  poly(
    [
      [cx - 10, cy - 6],
      [cx - 4, cy - 10],
      [cx - 2, cy - 2],
      [cx - 9, cy + 3],
    ],
    GREEN
  );
  // crack
  line(cx - 2, cy - 12, cx + 2, cy - 5, WHITE, 1);
  line(cx + 2, cy - 5, cx - 3, cy + 1, WHITE, 1);
  line(cx - 3, cy + 1, cx + 3, cy + 8, WHITE, 1);
  // sun + talks table hint
  circle(px + 62, py + 7, 4, GOLD);
  rect(px + 56, py + 20, 26, 3, BROWN);
  rect(px + 58, py + 23, 3, 5, BROWN);
  rect(px + 77, py + 23, 3, 5, BROWN);
}

function iconLedger(px: number, py: number): void {
  // ledger book
  rect(px + 14, py + 5, 34, 20, [250, 246, 232]);
  rect(px + 14, py + 5, 4, 20, BROWN);
  hline(px + 22, py + 10, 20, GREY, 1);
  hline(px + 22, py + 14, 20, GREY, 1);
  hline(px + 22, py + 18, 14, GREY, 1);
  // red cross stamp
  line(px + 52, py + 6, px + 66, py + 20, RED, 3);
  line(px + 66, py + 6, px + 52, py + 20, RED, 3);
  // seal
  ring(px + 84, py + 21, 5, 1, RED);
  circle(px + 84, py + 21, 2, RED);
}

function iconJets(px: number, py: number): void {
  circle(px + 92, py + 6, 4, GOLD);
  // jet 1
  poly([[px + 14, py + 10], [px + 40, py + 13], [px + 14, py + 16]], DARKGREY);
  poly([[px + 22, py + 13], [px + 28, py + 6], [px + 32, py + 13]], DARKGREY);
  poly([[px + 22, py + 13], [px + 28, py + 20], [px + 32, py + 13]], DARKGREY);
  // jet 2
  poly([[px + 48, py + 18], [px + 70, py + 21], [px + 48, py + 24]], [90, 96, 104]);
  poly([[px + 54, py + 21], [px + 59, py + 15], [px + 62, py + 21]], [90, 96, 104]);
  // contrails
  hline(px + 2, py + 13, 12, WHITE, 1);
  hline(px + 36, py + 21, 12, WHITE, 1);
  hline(px + 4, py + 26, 40, [200, 204, 210], 1);
}

function iconKnesset(px: number, py: number): void {
  rect(px + 12, py + 12, 40, 13, [222, 210, 182]);
  circle(px + 32, py + 12, 8, NAVY);
  rect(px + 24, py + 12, 16, 2, NAVY);
  for (const cx of [16, 25, 34, 43]) rect(px + cx, py + 15, 3, 10, NAVY);
  rect(px + 29, py + 19, 6, 6, INK);
  rect(px + 10, py + 25, 44, 2, DARKGREY);
  // flag
  vline(px + 62, py + 4, 18, INK, 1);
  rect(px + 63, py + 4, 13, 8, WHITE);
  hline(px + 63, py + 6, 13, [30, 60, 130], 1);
  hline(px + 63, py + 10, 13, [30, 60, 130], 1);
}

function iconPinConvoy(px: number, py: number): void {
  // sea strip
  rect(px + 8, py + 22, 90, 6, SEA);
  // road
  line(px + 8, py + 20, px + 96, py + 14, DARKGREY, 2);
  // retreating convoy: three trucks
  for (let i = 0; i < 3; i++) {
    const tx = px + 58 + i * 12;
    const ty = py + 8 + i * 2;
    rect(tx, ty, 9, 5, [90, 96, 104]);
    rect(tx + 7, ty + 1, 4, 4, INK);
    circle(tx + 2, ty + 6, 1, INK);
    circle(tx + 8, ty + 6, 1, INK);
  }
  // map pin at Aden
  circle(px + 20, py + 9, 6, RED);
  poly([[px + 15, py + 12], [px + 25, py + 12], [px + 20, py + 21]], RED);
  circle(px + 20, py + 9, 2, WHITE);
}

function iconCyclone(px: number, py: number): void {
  // coast
  poly([[px + 8, py + 30], [px + 40, py + 18], [px + 70, py + 22], [px + 96, py + 30]], TAN);
  rect(px + 8, py + 28, 88, 2, TANDARK);
  // spiral: concentric arcs
  ring(px + 46, py + 13, 11, 2, DEEPSEA);
  ring(px + 46, py + 13, 7, 2, DEEPSEA);
  circle(px + 46, py + 13, 3, DEEPSEA);
  // rain
  for (let i = 0; i < 6; i++) {
    line(px + 6 + i * 14, py + 4 + (i % 2) * 4, px + 3 + i * 14, py + 9 + (i % 2) * 4, DEEPSEA, 1);
  }
}

interface Featured {
  num: number;
  kicker: string;
  headline: string;
  deck: string;
  tint: RGB;
  icon: (px: number, py: number) => void;
}

const FEATURED: Featured[] = [
  {
    num: 4,
    kicker: "US - BANKING",
    headline: "JPMorgan blames software bug for outage",
    deck: "Online banking, branches and Zelle slowed; not a cyberattack",
    tint: [230, 222, 196],
    icon: iconBank,
  },
  {
    num: 5,
    kicker: "SCIENCE - SPACE",
    headline: "Vulcan fails, destroying 40 Amazon satellites",
    deck: "ULA rocket breaks up ten minutes after lift-off",
    tint: [214, 226, 232],
    icon: iconRocket,
  },
  {
    num: 6,
    kicker: "EUROPE - MIGRATION",
    headline: "Five EU states plan Rwanda return hub",
    deck: "Germany, Denmark, Austria, Greece, Netherlands; first transfers aimed for 2027",
    tint: [222, 228, 214],
    icon: iconHouseEU,
  },
  {
    num: 7,
    kicker: "AFRICA - HEALTH",
    headline: "Ebola outbreak in DR Congo more than doubles",
    deck: "WHO counts 11,000+ cases and 5,400 deaths",
    tint: [236, 214, 214],
    icon: iconVirus,
  },
  {
    num: 8,
    kicker: "MARKETS - TECHNOLOGY",
    headline: "Nvidia reports first earnings since Huang's exit",
    deck: "Revenue above $115bn, about double a year earlier; board will not reinstate him",
    tint: [214, 228, 214],
    icon: iconChip,
  },
  {
    num: 9,
    kicker: "ASIA - POLITICS",
    headline: "Mongolia's president says he will resign",
    deck: "Denies $25m rail bribe claim; parliament must approve",
    tint: [226, 220, 234],
    icon: iconGov,
  },
  {
    num: 10,
    kicker: "GLOBAL - CLIMATE",
    headline: "COP31 enters final days split on fossil fuels",
    deck: "Antalya talks split on finance; Robinson urges 'vital' budget",
    tint: [214, 232, 226],
    icon: iconGlobe,
  },
  {
    num: 11,
    kicker: "US - DEFENCE",
    headline: "Pentagon fails its audit for the ninth year",
    deck: "Auditors cannot verify $4.8 trillion in assets",
    tint: [228, 222, 210],
    icon: iconLedger,
  },
  {
    num: 12,
    kicker: "ASIA - DEFENCE",
    headline: "Japan scrambles jets at Russian incursion",
    deck: "Two planes entered airspace near Okinoshima; Tokyo protests",
    tint: [214, 224, 234],
    icon: iconJets,
  },
  {
    num: 13,
    kicker: "MIDDLE EAST - POLITICS",
    headline: "Knesset elects Eisenkot ally as speaker",
    deck: "Kahana wins 66-52 after Netanyahu bloc's six-hour filibuster",
    tint: [232, 226, 214],
    icon: iconKnesset,
  },
  {
    num: 14,
    kicker: "MIDDLE EAST - YEMEN",
    headline: "Houthis close in on Aden as forces retreat",
    deck: "Saudi-backed army pulls back from the Red Sea coast",
    tint: [236, 222, 206],
    icon: iconPinConvoy,
  },
  {
    num: 15,
    kicker: "ASIA - WEATHER",
    headline: "Cyclone Akvan takes aim at India's east coast",
    deck: "Third Bay of Bengal storm in weeks; landfall due 20 Nov",
    tint: [214, 228, 232],
    icon: iconCyclone,
  },
];

function drawFeatured(): void {
  const colX = [12, 262, 512, 762];
  const rowY = [330, 456, 582];
  for (let i = 0; i < 12; i++) {
    const f = FEATURED[i];
    const x = colX[i % 4];
    const y = rowY[Math.floor(i / 4)];
    // tinted icon panel with border
    rect(x, y, 242, 30, f.tint);
    rect(x, y, 242, 1, GREY);
    rect(x, y + 29, 242, 1, GREY);
    // number badge
    circle(x + 11, y + 15, 8, RED);
    drawTextCentered(String(f.num), x + 11, y + 10, S_SMALL, WHITE);
    f.icon(x + 24, y);
    // dotted texture on the right of the panel
    stipple(x + 150, y + 4, 86, 22, [255, 255, 255], 6);
    drawText(f.kicker, x, y + 33, S_SMALL, RED);
    const hl = drawWrapped(f.headline, x, y + 45, 242, S_HEADSM, 15, INK, false, 3);
    drawWrapped(f.deck, x, y + 45 + hl * 15 + 2, 242, S_SMALL, 11, INK, true, 3);
  }
  hline(12, 708, 1000, GREY, 1);
}

// ---------------------------------------------------------------------------
// Dot-matrix world map: land mask written as row ranges (columns 0-95,
// equirectangular, lon -180..180). A tan dot is drawn at every land cell.
// ---------------------------------------------------------------------------
const LAND: number[][][] = [
  [], // 0
  [], // 1
  [[33, 38]], // 2 Greenland north
  [[5, 18], [31, 40]], // 3
  [[4, 24], [30, 40]], // 4
  [[2, 26], [30, 40], [58, 90]], // 5 Siberia
  [[1, 27], [31, 39], [57, 92]], // 6
  [[2, 28], [32, 38], [42, 44], [48, 52], [56, 94]], // 7 Iceland, Scandinavia
  [[2, 29], [33, 37], [44, 45], [47, 53], [55, 95]], // 8 UK
  [[3, 20], [26, 30], [34, 36], [44, 55], [54, 94]], // 9 Hudson Bay gap
  [[3, 31], [44, 56], [53, 94]], // 10
  [[4, 31], [45, 57], [53, 93]], // 11
  [[5, 30], [46, 58], [53, 92], [82, 85]], // 12 Japan
  [[6, 29], [44, 56], [53, 90], [82, 86]], // 13
  [[7, 28], [44, 59], [54, 90], [83, 86]], // 14
  [[8, 28], [44, 59], [54, 65], [66, 72], [74, 88], [83, 86]], // 15
  [[8, 28], [43, 60], [66, 71], [76, 86]], // 16
  [[10, 23], [43, 60], [66, 70], [76, 85]], // 17
  [[11, 22], [43, 60], [66, 69], [76, 85]], // 18
  [[13, 21], [43, 60], [67, 69], [77, 81], [83, 86]], // 19
  [[16, 21], [27, 33], [44, 60], [77, 79], [84, 86]], // 20
  [[20, 23], [27, 33], [44, 61], [77, 83]], // 21
  [[27, 35], [45, 60], [76, 79], [80, 84], [87, 93]], // 22
  [[27, 36], [46, 59], [80, 85], [87, 94]], // 23
  [[28, 37], [47, 58], [88, 94]], // 24 New Guinea
  [[28, 37], [48, 58], [80, 84], [89, 93]], // 25
  [[29, 37], [48, 57], [78, 84], [90, 92]], // 26 Java
  [[29, 36], [49, 57], [59, 60], [78, 85]], // 27 Madagascar, Australia north
  [[30, 36], [49, 56], [59, 60], [78, 86]], // 28
  [[30, 35], [50, 55], [59, 60], [77, 87]], // 29
  [[31, 34], [50, 55], [60, 60], [77, 87]], // 30
  [[31, 34], [51, 54], [77, 87]], // 31
  [[32, 34], [51, 54], [78, 86]], // 32
  [[32, 33], [52, 53], [79, 85], [93, 94]], // 33 New Zealand
  [[32, 33], [82, 83], [92, 94]], // 34 Tasmania
  [[32, 33], [92, 93]], // 35
  [[32, 33]], // 36
  [[32, 32]], // 37
  [], [], [], [], [], [], [], [], [], [], // 38-47
];

// [x, y, labelDx, labelDy] in 1024-space, inside the map frame.
const DOTS: [number, number, number, number][] = [
  [292, 783, 8, -6], // 1 Crimean Bridge
  [308, 805, 8, 2], // 2 Bahrain
  [396, 820, 8, -6], // 3 Manila
  [150, 782, 8, -6], // 4 New York
  [136, 806, -26, 2], // 5 Cape Canaveral
  [284, 838, -4, -14], // 6 Rwanda
  [266, 844, -4, 8], // 7 DR Congo
  [90, 790, 8, -6], // 8 California
  [378, 776, 8, -6], // 9 Mongolia
  [280, 792, -26, -6], // 10 Antalya
  [144, 794, -26, -6], // 11 Washington DC
  [410, 794, 8, -6], // 12 Okinoshima
  [286, 800, -4, 8], // 13 Jerusalem
  [300, 822, 8, -6], // 14 Aden
  [344, 818, 8, -6], // 15 India's east coast
];

const MAP_X = 12;
const MAP_Y = 728;
const MAP_W = 456;
const MAP_H = 216;

function drawMap(): void {
  drawText("WHERE IT HAPPENED", MAP_X, 712, S_HEADSM, RED);
  rect(MAP_X, MAP_Y, MAP_W, MAP_H, SEA);
  const cw = MAP_W / 96;
  const ch = MAP_H / 48;
  for (let r = 0; r < 48; r++) {
    for (const [a, b] of LAND[r]) {
      for (let c = a; c <= b; c++) {
        circle(MAP_X + (c + 0.5) * cw, MAP_Y + (r + 0.5) * ch, 1.7, TAN);
      }
    }
  }
  // numbered story dots + labels
  for (let i = 0; i < 15; i++) {
    const [dx, dy, lx, ly] = DOTS[i];
    circle(dx, dy, 5, RED);
    ring(dx, dy, 5, 1, WHITE);
    drawText(String(i + 1), dx + lx, dy + ly, S_SMALL, RED);
  }
  // frame
  rect(MAP_X, MAP_Y, MAP_W, 2, NAVY);
  rect(MAP_X, MAP_Y + MAP_H - 2, MAP_W, 2, NAVY);
  rect(MAP_X, MAP_Y, 2, MAP_H, NAVY);
  rect(MAP_X + MAP_W - 2, MAP_Y, 2, MAP_H, NAVY);
  // legend
  circle(18, 954, 4, TAN);
  drawText("LAND", 28, 949, S_SMALL, INK);
  rect(84, 950, 14, 8, SEA);
  rect(84, 950, 14, 1, NAVY);
  rect(84, 957, 14, 1, NAVY);
  drawText("SEA", 102, 949, S_SMALL, INK);
  circle(152, 954, 4, RED);
  drawText("STORY 1-15", 162, 949, S_SMALL, INK);
  drawText("Numbered dots mark stories 1-15.", MAP_X, 966, S_SMALL, INK);
}

// --- ALSO list, stories 16-35 ---
const ALSO: string[] = [
  "16. US: measles cases hit highest since 1991",
  "17. US: Wall Street slides - Dow falls 849 points",
  "18. France: public-sector workers strike over pay",
  "19. Bangladesh: police tear-gas garment workers",
  "20. China-Canada: Xi and Carney agree tariff cuts",
  "21. Turkey: police seize Sozcu TV broadcaster",
  "22. Space: Voyager 1 reaches one light-day from Earth",
  "23. Gaza: allies urge Israel to open crossings",
  "24. Iran: US alleges dirty-bomb plot; Tehran denies",
  "25. West Bank: settler attack kills woman, 72",
  "26. Geneva: 128 states open killer-robot talks",
  "27. Serbia: students lead new parliament",
  "28. Bahrain: 64 Shia given life over Iran links",
  "29. Football: Germany thrash Netherlands 5-0",
  "30. Brazil secures Amazon land for Indigenous peoples",
  "31. US: House Democrats outline opening agenda",
  "32. Washington faces projected $4bn budget gap",
  "33. Guinea: 1,263 illegal gold miners arrested",
  "34. Egypt: Trump hails Brotherhood terror listing",
  "35. India: bus plunges into ravine, six dead",
];

function drawAlso(): void {
  drawText("ALSO ON TUESDAY 17 NOVEMBER", 492, 712, S_HEADSM, RED);
  const cols = [492, 760];
  for (let c = 0; c < 2; c++) {
    let y = 728;
    for (let i = 0; i < 10; i++) {
      const item = ALSO[c * 10 + i];
      const n = drawWrapped(item, cols[c], y, 250, S_SMALL, 11.5, INK, true, 2);
      y += n * 11.5 + 2;
    }
  }
}

function footer(): void {
  drawWrapped(
    "Every story happened or was first reported on Tuesday 17 November 2026. Disputed claims are attributed. Sources: AP, Reuters, AFP, BBC, Al Jazeera, UN News. Original drawings.",
    12,
    984,
    1000,
    S_SMALL,
    11,
    INK,
    true,
    2
  );
}

function main(): void {
  fillAll(CREAM);
  masthead();
  drawLeads();
  drawFeatured();
  drawMap();
  drawAlso();
  footer();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG(downsample(), OW, OH);
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
