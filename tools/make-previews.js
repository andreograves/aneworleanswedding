// Renders the link-preview image and home-screen icons from the site's own artwork.
// Usage (from the repo root): node tools/make-previews.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const defs = index.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/)[0];
const tplCards = fs.readFileSync(path.join(__dirname, "preview.html"), "utf8").replace("<!--DEFS-->", defs);
const tplCard = fs.readFileSync(path.join(__dirname, "preview-card.html"), "utf8").replace("<!--DEFS-->", defs);
const tplPhoto = fs.readFileSync(path.join(__dirname, "preview-photo.html"), "utf8").replace("<!--DEFS-->", defs);

const icon = (size) => `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;overflow:hidden;background:#5c1a24}
svg{width:100%;height:100%;display:block}</style></head><body>${defs}
<svg viewBox="52 99 146 146"><use href="#cardback" x="0" y="0" width="250" height="350"/></svg></body></html>`;

const grain = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
// Card-shaped (5:7) preview: the card back edge to edge.
const portrait = `<!doctype html><html><head><style>*{margin:0}body{width:1000px;height:1400px;overflow:hidden;position:relative;background:#efe9dd}
svg.art{width:100%;height:100%;display:block}
body::after{content:"";position:absolute;inset:0;opacity:.3;mix-blend-mode:multiply;background-image:${grain}}</style></head>
<body>${defs}<svg class="art" viewBox="0 0 250 350"><use href="#cardback"/></svg></body></html>`;
// Square preview: the card on the cream background.
const square = `<!doctype html><html><head><style>*{margin:0;box-sizing:border-box}
body{width:1200px;height:1200px;overflow:hidden;position:relative;background:radial-gradient(ellipse at center,#fbf8f2 0%,#f8f4ec 55%,#efe6d6 100%)}
.frame{position:absolute;inset:34px;border:1px solid rgba(168,133,74,.5);outline:1px solid rgba(168,133,74,.5);outline-offset:-11px}
.card{position:absolute;left:50%;top:50%;width:640px;height:896px;margin:-448px 0 0 -320px;border-radius:36px;overflow:hidden;transform:rotate(-4deg);
box-shadow:inset 0 0 0 1px rgba(60,30,20,.2),0 3px 4px rgba(0,0,0,.2),0 34px 70px rgba(60,18,24,.26)}
.card svg{width:100%;height:100%;display:block}
.card::after{content:"";position:absolute;inset:0;opacity:.3;mix-blend-mode:multiply;background-image:${grain}}</style></head>
<body>${defs}<div class="frame"></div><div class="card"><svg viewBox="0 0 250 350"><use href="#cardback"/></svg></div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const jobs = [
    { html: tplPhoto, w: 1200, h: 630, out: "assets/og-image.jpg", type: "jpeg", file: "preview-photo.html" },
    { html: tplCards, w: 1200, h: 630, out: "assets/og-image-cards.jpg", type: "jpeg", file: "preview.html" },
    { html: tplCard.replace("<body>", '<body class="side-front">'), w: 1200, h: 630, out: "assets/og-card-front.jpg", type: "jpeg", file: "preview-card.html" },
    { html: tplCard.replace("<body>", '<body class="side-back">'), w: 1200, h: 630, out: "assets/og-card-back.jpg", type: "jpeg", file: "preview-card.html" },
    { html: portrait, w: 1000, h: 1400, out: "assets/og-card-portrait.jpg", type: "jpeg" },
    { html: square, w: 1200, h: 1200, out: "assets/og-card-square.jpg", type: "jpeg" },
    { html: icon(180), w: 180, h: 180, out: "apple-touch-icon.png", type: "png" },
    { html: icon(512), w: 512, h: 512, out: "assets/icon-512.png", type: "png" },
  ];
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
    if (j.file) {
      const tmp = path.join(__dirname, ".render-" + j.file);
      fs.writeFileSync(tmp, j.html);
      await page.goto("file://" + tmp, { waitUntil: "networkidle" });
      fs.unlinkSync(tmp);
    } else {
      await page.setContent(j.html, { waitUntil: "networkidle" });
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(root, j.out), type: j.type, ...(j.type === "jpeg" ? { quality: 88 } : {}) });
    await page.close();
    console.log("wrote", j.out);
  }
  await browser.close();
})();
