// The World in One Day — newspaper front page for Tuesday 17 November 2026.
// Version 2: 35 stories, 3 illustrated leads, 12 featured, numbered world map,
// numbered ALSO list. Drawn entirely in code: own PNG encoder, own bitmap font,
// flat vector shapes only. Deterministic: no Date, no random, no file reads.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

// ---- palette ----
const CREAM = [244, 239, 228];
const INK = [18, 18, 20];
const NAVY = [31, 42, 68];
const RED = [179, 35, 42];
const WHITE = [255, 255, 255];
const SEA = [207, 227, 238];
const LAND = [217, 201, 163];
const LANDLINE = [150, 132, 96];
const SKY = [183, 214, 232];
const GREY = [120, 124, 130];
const DARKGREY = [70, 72, 76];
const TAN2 = [190, 168, 120];
const BLUE2 = [64, 96, 150];
const GREEN = [74, 130, 84];
const GOLD = [212, 175, 55];
const BROWN = [122, 84, 52];
const LIGHTBLUE = [168, 198, 224];

// ---- pixel helpers ----
function px(x: number, y: number, c: number[]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: number[]): void { rect(x, y, w, 1, c); }
function vline(x: number, y: number, h: number, c: number[]): void { rect(x, y, 1, h, c); }
function line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let n = 0; n < 4000; n++) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function circle(cx: number, cy: number, r: number, c: number[]): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
  }
}
function ring(cx: number, cy: number, r: number, c: number[]): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
  poly([[x0, y0], [x1, y1], [x2, y2]], c);
}
function poly(pts: number[][], c: number[]): void {
  let minY = 1e9, maxY = -1e9;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}
function polyOutline(pts: number[][], c: number[]): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c);
  }
}

// ---- bitmap font: 5x7 glyphs, written by hand ----
const G: Record<string, string[]> = {
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
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
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
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * (5 * scale + scale) - scale;
}
function drawText(s: string, x: number, y: number, scale: number, c: number[]): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = G[ch] || G[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 5 * scale + scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: number[]): void {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, c);
}
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur === "" ? w : cur + " " + w;
    if (textWidth(test, scale) <= maxW) cur = test;
    else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---- PNG encoder: IHDR / IDAT / IEND only, CRC32, zlib deflate ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE.push(c >>> 0);
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- data ----
type Lead = { num: number; kicker: string; head: string; deck: string };
const LEADS: Lead[] = [
  { num: 1, kicker: "EUROPE - UKRAINE WAR", head: "UKRAINIAN DRONES HIT CRIMEAN BRIDGE FOR A SECOND DAY", deck: "ROAD SPAN FALLS INTO THE KERCH STRAIT; RUSSIA HITS KYIV BRIDGES IN REPLY" },
  { num: 2, kicker: "MIDDLE EAST - IRAN WAR", head: "IRAN'S GUARDS FIRE DRONES AT US RADAR IN BAHRAIN", deck: "BAHRAIN SAYS IT INTERCEPTED THEM; US JETS STRIKE IRAN'S QESHM ISLAND" },
  { num: 3, kicker: "ASIA - DIPLOMACY", head: "TRUMP IN MANILA; XI, TRUMP, PUTIN TO MEET THURSDAY", deck: "FIRST QUAD IN TWO YEARS AT ASEAN; THREE-WAY SUMMIT SET FOR SHENZHEN" },
];
type Feat = { num: number; kicker: string; head: string; deck: string };
const FEATS: Feat[] = [
  { num: 4, kicker: "US - BANKING", head: "JPMORGAN BLAMES SOFTWARE BUG FOR OUTAGE", deck: "ONLINE BANKING, BRANCHES AND ZELLE SLOWED; NOT A CYBERATTACK" },
  { num: 5, kicker: "SCIENCE - SPACE", head: "VULCAN FAILS, DESTROYING 40 AMAZON SATELLITES", deck: "ULA ROCKET BREAKS UP TEN MINUTES AFTER LIFT-OFF" },
  { num: 6, kicker: "EUROPE - MIGRATION", head: "FIVE EU STATES PLAN RWANDA RETURN HUB", deck: "GERMANY, DENMARK, AUSTRIA, GREECE, NETHERLANDS; FIRST TRANSFERS AIMED FOR 2027" },
  { num: 7, kicker: "AFRICA - HEALTH", head: "EBOLA OUTBREAK IN DR CONGO MORE THAN DOUBLES", deck: "WHO COUNTS 11,000+ CASES AND 5,400 DEATHS" },
  { num: 8, kicker: "MARKETS - TECHNOLOGY", head: "NVIDIA REPORTS FIRST EARNINGS SINCE HUANG'S EXIT", deck: "REVENUE ABOVE $115BN, DOUBLE A YEAR EARLIER; BOARD WILL NOT REINSTATE HIM" },
  { num: 9, kicker: "ASIA - POLITICS", head: "MONGOLIA'S PRESIDENT SAYS HE WILL RESIGN", deck: "DENIES $25M RAIL BRIBE CLAIM; PARLIAMENT MUST APPROVE" },
  { num: 10, kicker: "GLOBAL - CLIMATE", head: "COP31 ENTERS FINAL DAYS SPLIT ON FOSSIL FUELS", deck: "ANTALYA TALKS SPLIT ON FINANCE; ROBINSON URGES 'VITAL' BUDGET" },
  { num: 11, kicker: "US - DEFENCE", head: "PENTAGON FAILS ITS AUDIT FOR THE NINTH YEAR", deck: "AUDITORS CANNOT VERIFY $4.8 TRILLION IN ASSETS" },
  { num: 12, kicker: "ASIA - DEFENCE", head: "JAPAN SCRAMBLES JETS AT RUSSIAN INCURSION", deck: "TWO PLANES ENTERED AIRSPACE NEAR OKINOSHIMA; TOKYO PROTESTS" },
  { num: 13, kicker: "MIDDLE EAST - POLITICS", head: "KNESSET ELECTS EISENKOT ALLY AS SPEAKER", deck: "KAHANA WINS 66-52 AFTER NETANYAHU BLOC'S SIX-HOUR FILIBUSTER" },
  { num: 14, kicker: "MIDDLE EAST - YEMEN", head: "HOUTHIS CLOSE IN ON ADEN AS FORCES RETREAT", deck: "SAUDI-BACKED ARMY PULLS BACK FROM THE RED SEA COAST" },
  { num: 15, kicker: "ASIA - WEATHER", head: "CYCLONE AKVAN TAKES AIM AT INDIA'S EAST COAST", deck: "THIRD BAY OF BENGAL STORM IN WEEKS; LANDFALL EXPECTED AROUND 20 NOV" },
];
const ALSO: string[] = [
  "16. MEASLES CASES HIGHEST SINCE 1991",
  "17. DOW FALLS 849 AS WALL ST SLIDES",
  "18. FRANCE: PUBLIC WORKERS STRIKE",
  "19. BANGLADESH: WORKERS TEAR-GASSED",
  "20. XI AND CARNEY AGREE TARIFF CUTS",
  "21. TURKEY SEIZES SOZCU TV CHANNEL",
  "22. VOYAGER 1 ONE LIGHT-DAY FROM EARTH",
  "23. ALLIES URGE ISRAEL OPEN CROSSINGS",
  "24. IRAN DENIES DIRTY-BOMB PLOT CLAIM",
  "25. SETTLER ATTACK KILLS WOMAN, 72",
  "26. 128 STATES OPEN KILLER-ROBOT TALKS",
  "27. SERBIA: STUDENTS LEAD PARLIAMENT",
  "28. BAHRAIN: 64 SHIA GIVEN LIFE TERMS",
  "29. GERMANY THRASH NETHERLANDS 5-0",
  "30. BRAZIL SECURES AMAZON INDIGENOUS LAND",
  "31. HOUSE DEMOCRATS OUTLINE AGENDA",
  "32. WASHINGTON FACES $4BN BUDGET GAP",
  "33. GUINEA ARRESTS 1,263 GOLD MINERS",
  "34. TRUMP HAILS BROTHERHOOD LISTING",
  "35. INDIA BUS CRASH KILLS SIX",
];
// map dots: [story number, lon, lat] — nudged slightly so neighbours do not overlap
const DOTS: number[][] = [
  [1, 33, 45], [2, 54, 24], [3, 121, 14.6], [4, -68, 46], [5, -85, 26],
  [6, 4, 51], [7, 23, -2.5], [8, -121, 37], [9, 106, 48], [10, 26, 40],
  [11, -80, 33], [12, 133, 34], [13, 36, 30], [14, 45, 13], [15, 86, 19],
];

// ---- lead scenes ----
function sceneBridge(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  rect(x, y + h - 26, w, 26, BLUE2);
  rect(x, y + h - 34, w, 8, TAN2);
  const deckY = y + 34;
  rect(x + 6, deckY, 92, 6, DARKGREY);
  rect(x + w - 98, deckY, 92, 6, DARKGREY);
  line(x + 100, deckY + 2, x + 150, y + h - 28, DARKGREY);
  line(x + 100, deckY + 5, x + 150, y + h - 25, DARKGREY);
  rect(x + 40, deckY + 6, 8, h - 40, DARKGREY);
  rect(x + w - 48, deckY + 6, 8, h - 40, DARKGREY);
  vline(x + 98, y + 8, 28, DARKGREY);
  vline(x + w - 104, y + 8, 28, DARKGREY);
  line(x + 98, y + 8, x + 60, deckY, GREY);
  line(x + 98, y + 8, x + 140, deckY, GREY);
  line(x + w - 104, y + 8, x + w - 60, deckY, GREY);
  circle(x + 128, y + 18, 10, GREY);
  circle(x + 146, y + 12, 12, [150, 152, 156]);
  circle(x + 164, y + 20, 9, GREY);
  circle(x + 150, y + h - 26, 7, WHITE);
}
function sceneGulf(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SEA);
  poly([[x, y], [x + w, y], [x + w, y + 26], [x + w - 60, y + 34], [x + 40, y + 30], [x, y + 24]], TAN2);
  poly([[x, y + h - 34], [x + 50, y + h - 30], [x + w - 40, y + h - 36], [x + w, y + h - 28], [x + w, y + h], [x, y + h]], TAN2);
  drawText("IRAN", x + 36, y + 8, 1, INK);
  drawText("GULF", x + 236, y + 42, 1, BLUE2);
  drawText("ARABIA", x + w - 52, y + h - 14, 1, INK);
  circle(x + 168, y + 44, 5, RED);
  drawText("BAHRAIN", x + 176, y + 40, 1, INK);
  rect(x + 128, y + 52, 26, 7, LANDLINE);
  drawText("QESHM", x + 128, y + 62, 1, INK);
  line(x + 90, y + 22, x + 164, y + 40, RED);
  line(x + 164, y + 40, x + 154, y + 38, RED);
  line(x + 164, y + 40, x + 160, y + 48, RED);
  line(x + 200, y + 20, x + 172, y + 40, RED);
  line(x + 172, y + 40, x + 182, y + 38, RED);
  line(x + 172, y + 40, x + 174, y + 50, RED);
  circle(x + 90, y + 22, 3, INK);
  circle(x + 200, y + 20, 3, INK);
}
function sceneSummit(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [232, 226, 205]);
  const flagW = 46, flagH = 26, fy = y + 8;
  const fx = [x + 22, x + w / 2 - 23, x + w - 68];
  for (let i = 0; i < 3; i++) vline(fx[i] - 4, fy, 34, DARKGREY);
  for (let s = 0; s < 7; s++) rect(fx[0], fy + s * 4, flagW, 2, s % 2 ? WHITE : RED);
  rect(fx[0], fy, 20, 12, BLUE2);
  rect(fx[1], fy, flagW, flagH, RED);
  circle(fx[1] + 10, fy + 9, 4, GOLD);
  rect(fx[2], fy, flagW, 9, WHITE);
  rect(fx[2], fy + 9, flagW, 9, BLUE2);
  rect(fx[2], fy + 18, flagW, 8, RED);
  rect(x + 14, y + h - 30, w - 28, 8, BROWN);
  rect(x + 20, y + h - 22, 6, 22, BROWN);
  rect(x + w - 26, y + h - 22, 6, 22, BROWN);
  const lx = [x + 60, x + w / 2, x + w - 60];
  const suit = [NAVY, DARKGREY, NAVY];
  for (let i = 0; i < 3; i++) {
    circle(lx[i], y + h - 46, 10, [222, 190, 160]);
    rect(lx[i] - 12, y + h - 38, 24, 10, suit[i]);
  }
}

// ---- featured icons (small scenes, 30px tall strip) ----
function iconBank(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [226, 232, 240]);
  const cx = x + w / 2;
  tri(cx - 26, y + 10, cx + 26, y + 10, cx, y + 2, NAVY);
  rect(cx - 22, y + 10, 44, 12, NAVY);
  for (let i = -1; i <= 1; i++) rect(cx + i * 14 - 2, y + 12, 4, 8, WHITE);
  rect(cx - 26, y + 22, 52, 3, NAVY);
  circle(cx + 44, y + 15, 5, RED);
  line(cx + 44, y + 10, cx + 40, y + 6, RED);
  line(cx + 44, y + 10, cx + 48, y + 6, RED);
  line(cx + 44, y + 20, cx + 40, y + 24, RED);
  line(cx + 44, y + 20, cx + 48, y + 24, RED);
}
function iconRocket(x: number, y: number, w: number): void {
  rect(x, y, w, 30, SKY);
  const cx = x + w / 2;
  tri(cx - 8, y + 13, cx + 8, y + 13, cx, y + 1, NAVY);
  rect(cx - 8, y + 13, 16, 9, WHITE);
  rect(cx - 8, y + 13, 16, 9, NAVY);
  rect(cx - 6, y + 15, 12, 5, WHITE);
  tri(cx - 13, y + 15, cx - 8, y + 13, cx - 8, y + 22, RED);
  tri(cx + 13, y + 15, cx + 8, y + 13, cx + 8, y + 22, RED);
  circle(cx - 26, y + 8, 3, DARKGREY);
  circle(cx + 28, y + 6, 3, DARKGREY);
  circle(cx + 34, y + 18, 2, DARKGREY);
  circle(cx - 34, y + 20, 2, DARKGREY);
  circle(cx, y + 24, 5, GREY);
  circle(cx + 10, y + 26, 4, GREY);
  circle(cx - 12, y + 26, 4, GREY);
}
function iconHouseFlag(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [226, 232, 240]);
  const cx = x + w / 2 - 34;
  rect(cx, y + 12, 34, 14, TAN2);
  tri(cx - 3, y + 12, cx + 37, y + 12, cx + 17, y + 3, RED);
  rect(cx + 13, y + 18, 8, 8, INK);
  const fx = x + w - 62;
  rect(fx, y + 5, 44, 22, BLUE2);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    circle(Math.round(fx + 22 + 8 * Math.cos(a)), Math.round(y + 16 + 7 * Math.sin(a)), 1, GOLD);
  }
}
function iconVirus(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [238, 226, 226]);
  const cx = x + w / 2, cy = y + 15;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(cx, cy, Math.round(cx + 13 * Math.cos(a)), Math.round(cy + 13 * Math.sin(a)), RED);
  }
  circle(cx, cy, 8, RED);
  circle(cx - 3, cy - 2, 2, WHITE);
  circle(cx + 3, cy + 2, 2, WHITE);
}
function iconChip(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [226, 232, 240]);
  const cx = x + w / 2 - 46;
  rect(cx, y + 7, 20, 16, INK);
  rect(cx + 5, y + 12, 10, 6, GREEN);
  for (let i = 0; i < 3; i++) { line(cx - 4, y + 11 + i * 5, cx, y + 11 + i * 5, INK); line(cx + 20, y + 11 + i * 5, cx + 24, y + 11 + i * 5, INK); }
  const bx = x + w / 2 + 8;
  line(bx, y + 24, bx + 14, y + 18, GREEN);
  line(bx + 14, y + 18, bx + 26, y + 20, GREEN);
  line(bx + 26, y + 20, bx + 40, y + 6, GREEN);
  line(bx + 40, y + 6, bx + 34, y + 6, GREEN);
  line(bx + 40, y + 6, bx + 40, y + 12, GREEN);
}
function iconGov(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [226, 232, 240]);
  const cx = x + w / 2;
  rect(cx - 26, y + 10, 52, 14, NAVY);
  tri(cx - 30, y + 10, cx + 30, y + 10, cx, y + 2, NAVY);
  for (let i = -2; i <= 2; i++) rect(cx + i * 10 - 2, y + 13, 4, 8, WHITE);
  rect(cx - 4, y + 19, 8, 5, GOLD);
  rect(cx + 34, y + 8, 12, 18, BROWN);
  circle(cx + 43, y + 17, 1, GOLD);
}
function iconGlobe(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [226, 232, 240]);
  const cx = x + w / 2, cy = y + 15;
  circle(cx, cy, 13, BLUE2);
  // landmass: two green blobs joined, so the globe reads as earth
  circle(cx - 4, cy - 3, 6, GREEN);
  circle(cx + 5, cy + 4, 5, GREEN);
  circle(cx + 6, cy - 5, 3, GREEN);
  // split crack between the halves
  line(cx - 10, cy - 8, cx + 2, cy + 2, WHITE);
  line(cx + 2, cy + 2, cx + 10, cy + 10, WHITE);
}
function iconLedger(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [226, 232, 240]);
  const cx = x + w / 2;
  rect(cx - 24, y + 4, 48, 22, WHITE);
  // border only: top, bottom, left, right edges in ink
  hline(cx - 24, y + 4, 48, INK);
  hline(cx - 24, y + 25, 48, INK);
  vline(cx - 24, y + 4, 22, INK);
  vline(cx + 23, y + 4, 22, INK);
  hline(cx - 20, y + 10, 40, INK);
  hline(cx - 20, y + 15, 40, INK);
  hline(cx - 20, y + 20, 24, INK);
  line(cx + 8, y + 8, cx + 20, y + 20, RED);
  line(cx + 20, y + 8, cx + 8, y + 20, RED);
}
function iconJets(x: number, y: number, w: number): void {
  rect(x, y, w, 30, SKY);
  const cx = x + w / 2;
  // two larger dark jets climbing, with white contrails
  tri(cx - 38, y + 24, cx - 10, y + 6, cx - 16, y + 24, NAVY);
  tri(cx - 10, y + 6, cx - 4, y + 14, cx - 12, y + 14, NAVY);
  tri(cx + 10, y + 24, cx + 38, y + 6, cx + 16, y + 24, NAVY);
  tri(cx + 10, y + 6, cx + 4, y + 14, cx + 12, y + 14, NAVY);
  line(cx - 34, y + 26, cx - 52, y + 28, WHITE);
  line(cx + 34, y + 26, cx + 52, y + 28, WHITE);
}
function iconKnesset(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [226, 232, 240]);
  const cx = x + w / 2;
  rect(cx - 28, y + 12, 56, 13, TAN2);
  circle(cx, y + 12, 9, TAN2);
  rect(cx - 9, y + 12, 18, 3, TAN2);
  for (let i = -2; i <= 2; i++) rect(cx + i * 11 - 2, y + 16, 4, 7, INK);
  rect(cx - 32, y + 25, 64, 2, INK);
}
function iconAden(x: number, y: number, w: number): void {
  rect(x, y, w, 30, [232, 226, 205]);
  rect(x, y + 20, w, 10, SEA);
  line(x, y + 20, x + w, y + 20, BLUE2);
  const cx = x + w / 2 - 30;
  circle(cx, y + 9, 7, RED);
  tri(cx - 7, y + 12, cx + 7, y + 12, cx, y + 23, RED);
  circle(cx, y + 9, 3, WHITE);
  const tx = x + w / 2 + 6;
  rect(tx, y + 14, 16, 7, DARKGREY);
  rect(tx + 20, y + 14, 16, 7, GREY);
  circle(tx + 4, y + 23, 2, INK);
  circle(tx + 12, y + 23, 2, INK);
  circle(tx + 24, y + 23, 2, INK);
  circle(tx + 32, y + 23, 2, INK);
  line(tx + 38, y + 16, tx + 48, y + 16, INK);
}
function iconCyclone(x: number, y: number, w: number): void {
  rect(x, y, w, 30, SKY);
  const cx = x + w / 2, cy = y + 15;
  rect(x, y + 24, w, 6, TAN2);
  ring(cx, cy, 12, WHITE);
  ring(cx, cy, 8, WHITE);
  ring(cx, cy, 4, WHITE);
  circle(cx, cy, 2, RED);
  line(cx, cy - 12, cx + 6, cy - 12, WHITE);
}
const ICONS: ((x: number, y: number, w: number) => void)[] = [
  iconBank, iconRocket, iconHouseFlag, iconVirus, iconChip, iconGov,
  iconGlobe, iconLedger, iconJets, iconKnesset, iconAden, iconCyclone,
];

// ---- world map ----
const NA = [[-168, 66], [-140, 70], [-120, 72], [-95, 80], [-80, 73], [-60, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 26], [-85, 15], [-90, 14], [-97, 16], [-105, 20], [-115, 28], [-125, 40], [-125, 49], [-140, 60], [-155, 58], [-168, 66]];
const SA = [[-80, 10], [-60, 8], [-50, 0], [-40, -5], [-35, -8], [-40, -20], [-48, -28], [-58, -35], [-65, -45], [-70, -55], [-73, -40], [-73, -20], [-80, -5], [-80, 10]];
const EU = [[-10, 36], [-9, 43], [-2, 48], [0, 50], [5, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 60], [30, 70], [40, 68], [45, 60], [40, 50], [35, 45], [28, 41], [23, 36], [19, 40], [12, 44], [3, 43], [-2, 37], [-10, 36]];
const AF = [[-6, 35], [10, 37], [20, 32], [32, 31], [35, 28], [40, 15], [43, 11], [51, 10], [48, 0], [40, -10], [36, -18], [32, -28], [26, -34], [18, -35], [12, -18], [9, 4], [4, 6], [-8, 4], [-13, 8], [-17, 15], [-16, 25], [-10, 31], [-6, 35]];
const AS = [[40, 68], [55, 72], [70, 73], [90, 75], [110, 77], [130, 72], [160, 70], [178, 66], [170, 60], [162, 56], [158, 52], [142, 50], [140, 40], [130, 33], [127, 35], [122, 38], [120, 30], [110, 20], [108, 12], [105, 9], [100, 7], [98, 15], [92, 21], [88, 22], [80, 15], [77, 8], [73, 20], [66, 25], [60, 25], [55, 27], [50, 29], [48, 30], [44, 29], [40, 32], [36, 36], [30, 36], [27, 40], [30, 45], [35, 50], [40, 55], [40, 68]];
const OC = [[113, -22], [114, -30], [120, -34], [130, -32], [140, -38], [150, -37], [153, -27], [146, -19], [142, -11], [136, -12], [132, -11], [126, -14], [122, -17], [113, -22]];
const NZ = [[167, -45], [172, -41], [175, -37], [178, -38], [174, -41], [167, -45]];
const CONTINENTS = [NA, SA, EU, AF, AS, OC, NZ];

// ---- draw the page ----
function drawPage(): void {
  rect(0, 0, W, H, CREAM);

  // masthead
  rect(0, 0, W, 112, NAVY);
  drawText("THE WORLD IN ONE DAY", 16, 14, 1, WHITE);
  const rightTop = "35 STORIES - 6 CONTINENTS - ONE DAY";
  drawText(rightTop, W - 16 - textWidth(rightTop, 1), 14, 1, WHITE);
  drawTextCentered("TUESDAY 17 NOVEMBER 2026", W / 2, 46, 6, WHITE);
  rect(0, 108, W, 4, RED);

  // leads
  const leadW = 324, leadGap = 12, leadX0 = 14;
  const leadScenes = [sceneBridge, sceneGulf, sceneSummit];
  for (let i = 0; i < 3; i++) {
    const x = leadX0 + i * (leadW + leadGap);
    const y = 122;
    leadScenes[i](x, y, leadW, 92);
    circle(x + 14, y + 12, 11, RED);
    drawTextCentered(String(LEADS[i].num), x + 14, y + 9, 1, WHITE);
    let ty = y + 100;
    drawText(LEADS[i].kicker, x, ty, 1, RED);
    ty += 12;
    const headLines = wrapText(LEADS[i].head, leadW, 2);
    for (const ln of headLines) { drawText(ln, x, ty, 2, INK); ty += 16; }
    ty += 2;
    const deckLines = wrapText(LEADS[i].deck, leadW, 1);
    for (const ln of deckLines) { drawText(ln, x, ty, 1, INK); ty += 10; }
    if (i < 2) vline(x + leadW + 6, 122, 204, [200, 192, 172]);
  }
  hline(0, 334, W, 2, INK);

  // featured grid 4 x 3
  const cellW = 241, cellH = 118, gapX = 10;
  for (let i = 0; i < 12; i++) {
    const f = FEATS[i];
    const col = i % 4, row = Math.floor(i / 4);
    const x = 14 + col * (cellW + gapX);
    const y = 342 + row * cellH;
    ICONS[i](x, y, cellW);
    circle(x + 12, y + 12, 10, RED);
    drawTextCentered(String(f.num), x + 12, y + 9, 1, WHITE);
    let ty = y + 36;
    drawText(f.kicker, x, ty, 1, RED);
    ty += 11;
    const headLines = wrapText(f.head, cellW, 2);
    for (const ln of headLines) { drawText(ln, x, ty, 2, INK); ty += 15; }
    ty += 1;
    const deckLines = wrapText(f.deck, cellW, 1);
    for (const ln of deckLines) { drawText(ln, x, ty, 1, INK); ty += 9; }
    if (col < 3) vline(x + cellW + 5, y + 4, cellH - 12, [210, 202, 182]);
  }
  hline(0, 688, W, 2, INK);

  // bottom band
  drawText("WHERE IT HAPPENED", 14, 700, 2, INK);
  drawText("ALSO ON TUESDAY 17 NOVEMBER", 510, 700, 2, INK);
  hline(14, 716, 480, 1, INK);
  hline(510, 716, 500, 1, INK);

  // world map
  const mx = 14, my = 724, mw = 480, mh = 196;
  rect(mx, my, mw, mh, SEA);
  const proj = (lon: number, lat: number): number[] => [
    mx + ((lon + 170) / 360) * mw,
    my + ((75 - lat) / 130) * mh,
  ];
  for (const cont of CONTINENTS) {
    const pts = cont.map((p) => proj(p[0], p[1]));
    poly(pts, LAND);
    polyOutline(pts, LANDLINE);
  }
  const eq = proj(0, 0);
  line(mx, Math.round(eq[1]), mx + mw, Math.round(eq[1]), [190, 205, 214]);
  for (const d of DOTS) {
    const p = proj(d[1], d[2]);
    const cx = Math.round(p[0]), cy = Math.round(p[1]);
    circle(cx, cy, 9, RED);
    ring(cx, cy, 9, WHITE);
    const lbl = String(d[0]);
    drawText(lbl, cx - Math.floor(textWidth(lbl, 1) / 2), cy - 3, 1, WHITE);
  }
  // legend + caption
  rect(14, 930, 10, 10, LAND);
  drawText("LAND", 28, 931, 1, INK);
  rect(74, 930, 10, 10, SEA);
  drawText("SEA", 88, 931, 1, INK);
  circle(138, 935, 5, RED);
  drawText("STORY", 148, 931, 1, INK);
  drawText("NUMBERED DOTS MARK STORIES 1-15.", 210, 931, 1, INK);

  // also list, two columns of ten
  const colAX = 510, colBX = 764;
  for (let i = 0; i < 20; i++) {
    const cx = i < 10 ? colAX : colBX;
    const cy = 730 + (i % 10) * 21;
    drawText(ALSO[i], cx, cy, 1, INK);
  }
  vline(502, 700, 276, [200, 192, 172]);

  // footer
  hline(0, 984, W, 2, INK);
  drawTextCentered("EVERY STORY HAPPENED OR WAS FIRST REPORTED ON TUESDAY 17 NOVEMBER 2026.", W / 2, 993, 1, INK);
  drawTextCentered("DISPUTED CLAIMS ARE ATTRIBUTED. SOURCES: AP, REUTERS, AFP, BBC, AL JAZEERA, UN NEWS. ORIGINAL DRAWINGS.", W / 2, 1006, 1, INK);
}

drawPage();
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), encodePNG());
