// news-image-20261117 — "The World in One Day"
// A newspaper front page summing up Tuesday 17 November 2026, drawn entirely
// in code: raw RGB buffer, hand-written bitmap font, hand-written PNG encoder.
// Node 22+ standard library only. No network, no randomness, no Date calls.
// Deterministic: two runs produce byte-identical output.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [246, 239, 222]; // cream newsprint
const INK: RGB = [22, 22, 22]; // near-black ink
const RED: RGB = [178, 34, 34]; // single red accent
const BLUE: RGB = [46, 110, 142]; // sea / sky blue
const SKY: RGB = [205, 226, 236]; // pale sky
const ORANGE: RGB = [226, 122, 31]; // flame
const SMOKE: RGB = [148, 148, 146]; // smoke grey
const GREEN: RGB = [58, 118, 70]; // land green
const BROWN: RGB = [138, 98, 58]; // table wood
const DARKBLUE: RGB = [38, 58, 92]; // ledger / suit
const GOLD: RGB = [212, 175, 55]; // stars, pin
const WHITE: RGB = [250, 250, 248];
const SKIN: RGB = [224, 180, 140];

// ---------------------------------------------------------------- buffer
const px = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}

function frame(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
    for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r2) setPixel(xx, yy, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      setPixel(
        Math.round(cx + (r - k) * Math.cos(rad)),
        Math.round(cy + (r - k) * Math.sin(rad)),
        c,
      );
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const half = Math.floor(t / 2);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    for (let a = -half; a <= half; a++) {
      for (let b = -half; b <= half; b++) setPixel(x + a, y + b, c);
    }
  }
}

function poly(points: Array<[number, number]>, c: RGB): void {
  // Scanline fill for a simple polygon.
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
        setPixel(x, y, c);
      }
    }
  }
}

function star(cx: number, cy: number, rOuter: number, rInner: number, c: RGB): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  poly(pts, c);
}

// ---------------------------------------------------------------- bitmap font
// 5x7 glyphs, written by hand. Rows are strings of 5 chars, "#" = ink.
const FONT: Record<string, string[]> = {
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
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(
  x: number,
  y: number,
  s: string,
  scale: number,
  c: RGB,
  align: "l" | "c" = "l",
): void {
  let startX = x;
  if (align === "c") startX = x - Math.floor(textWidth(s, scale) / 2);
  let cx = startX;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "1") {
          rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function wrapText(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawBlock(
  cx: number,
  y: number,
  lines: string[],
  scale: number,
  c: RGB,
  gap: number,
): void {
  for (let i = 0; i < lines.length; i++) {
    drawText(cx, y + i * (7 * scale + gap), lines[i], scale, c, "c");
  }
}

// ---------------------------------------------------------------- scenes
// Each scene draws inside the box (x, y, w, h) on the paper background.

function sceneBridge(x: number, y: number, w: number, h: number): void {
  const seaY = y + Math.floor(h * 0.62);
  rect(x, seaY, w, y + h - seaY, BLUE);
  // white wave dashes
  for (let wx = x + 14; wx < x + w - 20; wx += 46) {
    line(wx, seaY + 16, wx + 22, seaY + 16, WHITE, 2);
    line(wx + 8, seaY + 34, wx + 30, seaY + 34, WHITE, 2);
  }
  const deckY = y + Math.floor(h * 0.34);
  // left tower + intact left span
  const t1x = x + Math.floor(w * 0.22);
  const t2x = x + Math.floor(w * 0.68);
  rect(t1x - 5, deckY - 78, 10, 78, INK);
  rect(t2x - 5, deckY - 78, 10, 78, INK);
  // cables from tower tops to deck
  line(t1x, deckY - 78, x + 8, deckY, INK, 2);
  line(t1x, deckY - 78, t1x + Math.floor(w * 0.22), deckY, INK, 2);
  line(t2x, deckY - 78, t1x + Math.floor(w * 0.22) + 10, deckY, INK, 2);
  // intact deck, left of the break
  const breakX = x + Math.floor(w * 0.56);
  rect(x + 6, deckY, breakX - x - 6, 12, INK);
  // collapsed span: deck sloping down into the sea, right of the break
  poly(
    [
      [breakX, deckY + 2],
      [x + w - 10, deckY + 58],
      [x + w - 10, deckY + 70],
      [breakX, deckY + 14],
    ],
    INK,
  );
  // splash where the fallen span meets the water
  disc(x + w - 26, seaY + 2, 11, WHITE);
  disc(x + w - 44, seaY + 4, 8, WHITE);
  disc(x + w - 8, seaY + 6, 8, WHITE);
  // small boat on the water for scale
  const boatX = x + 58;
  poly(
    [
      [boatX, seaY + 46],
      [boatX + 54, seaY + 46],
      [boatX + 44, seaY + 60],
      [boatX + 10, seaY + 60],
    ],
    INK,
  );
  line(boatX + 26, seaY + 46, boatX + 26, seaY + 24, INK, 2);
  poly(
    [
      [boatX + 28, seaY + 24],
      [boatX + 28, seaY + 44],
      [boatX + 44, seaY + 44],
    ],
    WHITE,
  );
  // deck edge dashes on the intact span
  for (let dx = x + 16; dx < breakX - 12; dx += 24) {
    rect(dx, deckY + 3, 12, 3, PAPER);
  }
  // explosion burst at the break
  star(breakX + 6, deckY - 6, 30, 13, RED);
  star(breakX + 6, deckY - 6, 18, 8, ORANGE);
  disc(breakX + 6, deckY - 6, 7, WHITE);
  // smoke puffs rising
  disc(breakX - 26, deckY - 52, 16, SMOKE);
  disc(breakX + 4, deckY - 74, 20, SMOKE);
  disc(breakX + 34, deckY - 56, 14, SMOKE);
  disc(breakX + 58, deckY - 40, 10, SMOKE);
  // second, smaller smoke column over Kyiv side (far right)
  disc(x + w - 60, deckY - 44, 13, SMOKE);
  disc(x + w - 44, deckY - 62, 16, SMOKE);
  // sun, top left, clear of the smoke
  disc(x + 44, y + 28, 18, GOLD);
  ring(x + 44, y + 28, 24, 2, GOLD);
}

function sceneTanker(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  const seaY = y + Math.floor(h * 0.64);
  rect(x, seaY, w, y + h - seaY, BLUE);
  for (let wx = x + 10; wx < x + w - 16; wx += 38) {
    line(wx, seaY + 12, wx + 18, seaY + 12, WHITE, 2);
  }
  // tanker hull
  const hx = x + Math.floor(w * 0.12);
  const hy = seaY - 26;
  const hw = Math.floor(w * 0.72);
  poly(
    [
      [hx, hy],
      [hx + hw, hy],
      [hx + hw - 14, hy + 30],
      [hx + 4, hy + 30],
    ],
    INK,
  );
  rect(hx, hy + 22, hw - 8, 8, RED);
  // deck superstructure + funnel
  rect(hx + 12, hy - 26, 34, 26, WHITE);
  rect(hx + 52, hy - 34, 16, 34, INK);
  rect(hx + 52, hy - 40, 16, 6, RED);
  // flames on the mid-deck
  const fx = hx + Math.floor(hw * 0.55);
  poly(
    [
      [fx - 16, hy],
      [fx - 4, hy - 26],
      [fx + 4, hy - 10],
      [fx + 14, hy - 24],
      [fx + 22, hy],
    ],
    ORANGE,
  );
  poly(
    [
      [fx - 8, hy],
      [fx, hy - 16],
      [fx + 8, hy],
    ],
    RED,
  );
  // smoke, kept inside the scene box
  disc(fx - 4, hy - 32, 8, SMOKE);
  disc(fx + 12, hy - 40, 9, SMOKE);
  disc(fx + 24, hy - 42, 6, SMOKE);
  // distant second tanker silhouette
  const dx = x + Math.floor(w * 0.68);
  rect(dx, seaY - 12, 52, 10, INK);
  rect(dx + 30, seaY - 20, 10, 8, INK);
}

function sceneSummit(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  // three flags on poles
  const flagY = y + 8;
  const flagW = 52;
  const flagH = 34;
  const centres = [0.2, 0.5, 0.8].map((f) => x + Math.floor(w * f));
  // USA: red/white stripes + blue canton
  const ux = centres[0] - flagW / 2;
  for (let s = 0; s < 7; s++) {
    rect(ux, flagY + s * 5, flagW, 5, s % 2 === 0 ? RED : WHITE);
  }
  rect(ux, flagY, 22, 18, DARKBLUE);
  disc(ux + 11, flagY + 9, 2, WHITE);
  // China: red field, gold stars
  const cx = centres[1] - flagW / 2;
  rect(cx, flagY, flagW, flagH, RED);
  star(cx + 12, flagY + 10, 7, 3, GOLD);
  disc(cx + 26, flagY + 7, 2, GOLD);
  disc(cx + 32, flagY + 13, 2, GOLD);
  disc(cx + 30, flagY + 21, 2, GOLD);
  disc(cx + 23, flagY + 25, 2, GOLD);
  // Russia: white / blue / red bands
  const rx = centres[2] - flagW / 2;
  rect(rx, flagY, flagW, 12, WHITE);
  rect(rx, flagY + 12, flagW, 11, BLUE);
  rect(rx, flagY + 23, flagW, 11, RED);
  // poles
  for (const c of centres) line(c - flagW / 2, flagY, c - flagW / 2, y + 78, INK, 3);
  // three leaders seated behind the table
  const tableY = y + h - 26;
  for (let i = 0; i < 3; i++) {
    const px0 = centres[i];
    disc(px0, tableY - 44, 13, SKIN);
    poly(
      [
        [px0 - 20, tableY],
        [px0 - 14, tableY - 34],
        [px0 + 14, tableY - 34],
        [px0 + 20, tableY],
      ],
      i === 1 ? RED : DARKBLUE,
    );
    rect(px0 - 3, tableY - 32, 6, 14, WHITE);
  }
  // summit table
  rect(x + 8, tableY, w - 16, 22, BROWN);
  rect(x + 8, tableY, w - 16, 4, INK);
  // name plates on the table
  for (const c of centres) rect(c - 12, tableY + 7, 24, 10, WHITE);
}

function sceneBank(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  // bank building behind: pediment + columns
  const bx = x + 10;
  const bw = w - 20;
  const by = y + h - 12;
  rect(bx, by - 52, bw, 52, WHITE);
  frame(bx, by - 52, bw, 52, INK, 2);
  poly(
    [
      [bx - 4, by - 52],
      [bx + bw / 2, by - 70],
      [bx + bw + 4, by - 52],
    ],
    INK,
  );
  for (let i = 0; i < 5; i++) {
    const cx0 = bx + 10 + i * Math.floor((bw - 20) / 4);
    rect(cx0, by - 46, 8, 46, INK);
  }
  // phone in front, screen showing the failed payment
  const phw = 92;
  const phx = x + Math.floor(w / 2) - Math.floor(phw / 2);
  const phy = y + 4;
  const phh = h - 12;
  rect(phx, phy, phw, phh, INK);
  rect(phx + 5, phy + 10, phw - 10, phh - 26, WHITE);
  const ccx = phx + Math.floor(phw / 2);
  const ccy = phy + Math.floor((phh - 26) / 2) + 6;
  ring(ccx, ccy, 17, 4, RED);
  line(ccx - 9, ccy - 9, ccx + 9, ccy + 9, RED, 4);
  line(ccx + 9, ccy - 9, ccx - 9, ccy + 9, RED, 4);
  drawText(ccx, phy + phh - 32, "ZELLE", 2, RED, "c");
}

function sceneRocket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, DARKBLUE);
  // stars
  const stars: Array<[number, number]> = [
    [0.12, 0.16],
    [0.3, 0.08],
    [0.52, 0.2],
    [0.74, 0.1],
    [0.9, 0.24],
    [0.2, 0.4],
    [0.86, 0.5],
  ];
  for (const [fx, fy] of stars) {
    disc(x + Math.floor(w * fx), y + Math.floor(h * fy), 2, WHITE);
  }
  // rocket breaking apart: two pieces, nose up-right.
  // All coordinates stay inside the (x, y, w, h) box.
  const cx0 = x + Math.floor(w * 0.46);
  const cy0 = y + Math.floor(h * 0.5);
  // lower body piece
  poly(
    [
      [cx0 - 26, cy0 + 10],
      [cx0 - 4, cy0 - 2],
      [cx0 + 2, cy0 + 10],
      [cx0 - 20, cy0 + 22],
    ],
    WHITE,
  );
  // upper piece with nose cone
  poly(
    [
      [cx0 + 4, cy0 - 4],
      [cx0 + 12, cy0 - 26],
      [cx0 + 24, cy0 - 8],
      [cx0 + 14, cy0 + 4],
    ],
    WHITE,
  );
  poly(
    [
      [cx0 + 12, cy0 - 26],
      [cx0 + 24, cy0 - 8],
      [cx0 + 18, cy0 - 6],
    ],
    RED,
  );
  // fin
  poly(
    [
      [cx0 - 26, cy0 + 10],
      [cx0 - 34, cy0 + 20],
      [cx0 - 20, cy0 + 20],
    ],
    RED,
  );
  // debris
  disc(cx0 + 32, cy0 - 28, 3, ORANGE);
  disc(cx0 - 38, cy0 - 4, 3, WHITE);
  disc(cx0 + 38, cy0 + 8, 2, WHITE);
  rect(cx0 - 42, cy0 + 16, 7, 3, ORANGE);
  // flame + smoke trail, kept inside the box
  poly(
    [
      [cx0 - 24, cy0 + 18],
      [cx0 - 38, cy0 + 30],
      [cx0 - 12, cy0 + 26],
    ],
    ORANGE,
  );
  disc(cx0 - 40, cy0 + 32, 5, SMOKE);
  disc(cx0 - 48, cy0 + 34, 4, SMOKE);
}

function sceneLedger(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  // ledger book
  const bx = x + Math.floor(w * 0.5) - 52;
  const by = y + 10;
  rect(bx, by, 104, h - 20, DARKBLUE);
  rect(bx + 6, by + 6, 92, h - 32, WHITE);
  // ruled lines
  for (let i = 0; i < 5; i++) {
    const ly = by + 18 + i * 11;
    rect(bx + 14, ly, 76, 3, SMOKE);
  }
  // red FAILED stamp: circle + cross
  const sx = x + Math.floor(w * 0.5);
  const sy = y + Math.floor(h * 0.52);
  ring(sx, sy, 30, 5, RED);
  line(sx - 16, sy - 16, sx + 16, sy + 16, RED, 5);
  line(sx + 16, sy - 16, sx - 16, sy + 16, RED, 5);
  // torn corner
  poly(
    [
      [bx + 104, by],
      [bx + 104, by + 16],
      [bx + 88, by],
    ],
    PAPER,
  );
}

function sceneRwanda(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  // simplified landmass (Africa-ish blob)
  poly(
    [
      [x + 40, y + 8],
      [x + w - 40, y + 6],
      [x + w - 16, y + 26],
      [x + w - 30, y + 56],
      [x + w - 52, y + h - 10],
      [x + w - 90, y + h - 14],
      [x + 58, y + h - 8],
      [x + 26, y + 52],
      [x + 16, y + 22],
    ],
    GREEN,
  );
  // dashed flight route from a small plane to the pin
  const px0 = x + 34;
  const py0 = y + 22;
  const tx = x + Math.floor(w * 0.62);
  const ty = y + Math.floor(h * 0.62);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const qx = px0 + (tx - px0) * t;
    const qy = py0 + (ty - py0) * t + 14 * Math.sin(t * Math.PI) * -1;
    disc(qx, qy, 2, INK);
  }
  // little plane
  poly(
    [
      [px0 - 4, py0],
      [px0 + 16, py0 - 5],
      [px0 + 22, py0],
      [px0 + 16, py0 + 5],
    ],
    WHITE,
  );
  poly(
    [
      [px0 + 2, py0 - 2],
      [px0 + 8, py0 - 12],
      [px0 + 12, py0 - 2],
    ],
    WHITE,
  );
  // map pin
  disc(tx, ty - 12, 14, RED);
  poly(
    [
      [tx - 13, ty - 6],
      [tx + 13, ty - 6],
      [tx, ty + 16],
    ],
    RED,
  );
  disc(tx, ty - 12, 5, WHITE);
}

// ---------------------------------------------------------------- layout
const M = 24; // outer margin
frame(12, 12, W - 24, H - 24, INK, 3);
frame(18, 18, W - 36, H - 36, INK, 1);

// Masthead
drawText(512, 30, "THE WORLD IN ONE DAY", 6, INK, "c");
line(60, 84, 964, 84, INK, 3);
// Date line, red rules flanking
line(60, 102, 250, 102, RED, 3);
line(774, 102, 964, 102, RED, 3);
drawText(512, 92, "TUESDAY, 17 NOVEMBER 2026", 3, RED, "c");
line(60, 124, 964, 124, INK, 2);

// Lead panel
const leadX = M;
const leadY = 134;
const leadW = W - 2 * M;
const leadH = 336;
frame(leadX, leadY, leadW, leadH, INK, 2);
drawText(512, leadY + 10, "KERCH BRIDGE FALLS", 4, INK, "c");
sceneBridge(leadX + 10, leadY + 48, leadW - 20, 218);
drawText(
  512,
  leadY + 282,
  "UKRAINE STRIKE COLLAPSES ROAD SPAN, KYIV BRIDGES HIT IN REPLY",
  2,
  INK,
  "c",
);
drawText(512, leadY + 306, "SECOND STRIKE IN UNDER 24 HOURS", 2, RED, "c");

// Middle row: three panels
const rowY = 486;
const rowH = 256;
const colW = 314;
const gap = 16;
const colX = [M, M + colW + gap, M + 2 * (colW + gap)];

interface Panel {
  scene: (x: number, y: number, w: number, h: number) => void;
  head: string;
  deck: string;
}

const middle: Panel[] = [
  {
    scene: sceneTanker,
    head: "TANKERS BURN OFF HORMUZ",
    deck: "MINES HIT SHIPS, THIRD US CARRIER ARRIVES",
  },
  {
    scene: sceneSummit,
    head: "TRUMP IN MANILA",
    deck: "XI, TRUMP, PUTIN TO MEET THURSDAY IN SHENZHEN",
  },
  {
    scene: sceneBank,
    head: "BANKING HALTS",
    deck: "JPMORGAN BLAMES SOFTWARE BUG, ZELLE SLOWS",
  },
];

for (let i = 0; i < 3; i++) {
  const x = colX[i];
  frame(x, rowY, colW, rowH, INK, 2);
  middle[i].scene(x + 8, rowY + 8, colW - 16, 118);
  const headLines = wrapText(middle[i].head, 17);
  drawBlock(x + colW / 2, rowY + 134, headLines, 3, INK, 4);
  const deckLines = wrapText(middle[i].deck, 26);
  drawBlock(x + colW / 2, rowY + 134 + headLines.length * 25 + 12, deckLines, 2, INK, 4);
}

// Bottom row: three small panels
const botY = 758;
const botH = 198;
const bottom: Panel[] = [
  {
    scene: sceneRocket,
    head: "VULCAN FAILS",
    deck: "40 AMAZON SATELLITES LOST",
  },
  {
    scene: sceneLedger,
    head: "PENTAGON FAILS AUDIT",
    deck: "NINTH YEAR RUNNING, 4.8 TRILLION UNVERIFIED",
  },
  {
    scene: sceneRwanda,
    head: "EUROPE PLANS RWANDA HUB",
    deck: "FIVE NATIONS BACK A RWANDA RETURN HUB",
  },
];

for (let i = 0; i < 3; i++) {
  const x = colX[i];
  frame(x, botY, colW, botH, INK, 2);
  bottom[i].scene(x + 8, botY + 8, colW - 16, 82);
  const headLines = wrapText(bottom[i].head, 17);
  drawBlock(x + colW / 2, botY + 98, headLines, 3, INK, 4);
  const deckLines = wrapText(bottom[i].deck, 26);
  drawBlock(x + colW / 2, botY + 98 + headLines.length * 25 + 8, deckLines, 2, INK, 4);
}

// Footer
drawText(512, 972, "17 NOVEMBER 2026 - THE WORLD'S NEWS IN ONE IMAGE", 2, INK, "c");

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w: number, h: number, rgb: Buffer): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, encodePNG(W, H, px));
