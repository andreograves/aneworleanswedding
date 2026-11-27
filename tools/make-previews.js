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

// Reuse the splash page's parasol drawing so the preview matches the site.
const splashSrc = fs.readFileSync(path.join(root, "splash.js"), "utf8");
const parasolSrc = splashSrc.slice(splashSrc.indexOf("function parasolSVG("), splashSrc.indexOf("  function parasolShower"));
const parasolSVG = new Function(parasolSrc + "; return parasolSVG;")();
// Title-card previews: the card under a deep maroon wash, with the words over it.
// k = font scale; pos = vertical centers (px) for each line, chosen to clear the oval medallion.
const SUP = {
  family: process.env.SUP_FAMILY || '"Cormorant Garamond", Georgia, serif',
  style: process.env.SUP_STYLE || "italic",
  weight: process.env.SUP_WEIGHT || "400",
  ls: process.env.SUP_LS || ".01em",
  scale: parseFloat(process.env.SUP_SCALE || "1"),
  gf: process.env.SUP_GF || "",
};
const CAPS = (process.env.SUP_CASE || "sentence") === "caps";
const titleCSS = (k, pos) => {
const SUPCASE = CAPS
  ? `text-transform:uppercase;letter-spacing:.14em;padding-left:.14em;font-size:${86*k}px`
  : `font-style:italic;letter-spacing:.02em;font-size:${132*k}px`;
return `
.wash{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(58,14,22,.66) 0%,rgba(40,9,15,.8) 100%)}
.title{position:absolute;inset:0;text-shadow:0 2px 12px rgba(0,0,0,.35)}
.title > *{position:absolute;left:0;right:0;transform:translateY(-50%);display:flex;justify-content:center;align-items:center;text-align:center}
.title .a{top:${pos.a}px;font-family:"Cormorant Garamond",Georgia,serif;font-weight:300;color:#f6f0e4;line-height:1;white-space:nowrap;${SUPCASE}}
.title .no{top:${pos.no}px;font-family:"Pinyon Script",cursive;color:#e6c887;font-size:${156*k}px;-webkit-text-stroke:${3.2*k}px #e6c887;paint-order:stroke fill;line-height:1.15;white-space:nowrap}
.title .wed{top:${pos.wed}px}
.title .oi{top:${pos.oi || 0}px}
${pos.oi ? `.title div.a,.title div.wed span{font-size:${112*k}px}
.title div.wed .w{display:inline-flex;align-items:center}
.title div.wed .p{position:static;flex:none;margin-left:${30*k}px;width:${104*k}px;transform:translateY(-14%) rotate(16deg)}
.title .a.oi{font-family:"Pinyon Script",cursive;font-style:normal;color:#e6c887;font-size:${132*k}px;-webkit-text-stroke:${2.4*k}px #e6c887;paint-order:stroke fill;letter-spacing:0}` : ""}
.title .wed.w1{top:${pos.w1 || 0}px}
.title .wed .w{position:relative;display:inline-block}
.title .wed span{font-family:"Cormorant Garamond",Georgia,serif;font-weight:300;color:#f6f0e4;line-height:1;${SUPCASE}}
.title .wed .p{position:absolute;left:100%;top:50%;margin-left:${40*k}px;width:${118*k}px;transform:translateY(-62%) rotate(16deg);filter:drop-shadow(0 8px 10px rgba(0,0,0,.35))}
.title .wed .p svg{display:block;width:100%;height:auto}
.title .wed .p path[stroke="#3a2a22"]{stroke:#e6c887}`;
};
// Live preview copy: "Oi! / How about a / New Orleans / wedding?" (COPY=short renders the earlier version)
const OI = process.env.COPY !== "short";
const parasolHTML = `<div class="p">${parasolSVG(["#f3ece0", "#c9a45f", "#e6c887"])}</div>`;
const titleHTML = OI
  ? `<div class="wash"></div><div class="title"><div class="a oi">Oi!</div><div class="a">How about a</div><div class="no">New Orleans</div>
<div class="wed"><div class="w"><span>wedding?</span>${parasolHTML}</div></div></div>`
  : `<div class="wash"></div><div class="title"><div class="a">How about a</div><div class="no">New Orleans</div>
<div class="wed"><div class="w"><span>wedding?</span>${parasolHTML}</div></div></div>`;
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500${SUP.gf ? "&family=" + SUP.gf : ""}&display=swap" rel="stylesheet">`;
// Card-shaped (5:7) preview: the card back edge to edge.
const portrait = `<!doctype html><html><head>${FONTS}<style>*{margin:0}body{width:1000px;height:1400px;overflow:hidden;position:relative;background:#efe9dd}
svg.art{width:100%;height:100%;display:block}${OI ? titleCSS(1, {oi: 170, a: 305, no: 700, wed: 1135}) : titleCSS(1, {a: 285, no: 700, wed: 1125})}</style></head>
<body>${defs}<svg class="art" viewBox="0 0 250 350"><use href="#cardback"/></svg>${titleHTML}</body></html>`;
(async () => {
  const browser = await chromium.launch();
  const jobs = [
    { html: tplPhoto, w: 1200, h: 630, out: "assets/og-image.jpg", type: "jpeg", file: "preview-photo.html" },
    { html: tplCards, w: 1200, h: 630, out: "assets/og-image-cards.jpg", type: "jpeg", file: "preview.html" },
    { html: tplCard.replace("<body>", '<body class="side-front">'), w: 1200, h: 630, out: "assets/og-card-front.jpg", type: "jpeg", file: "preview-card.html" },
    { html: tplCard.replace("<body>", '<body class="side-back">'), w: 1200, h: 630, out: "assets/og-card-back.jpg", type: "jpeg", file: "preview-card.html" },
    { html: portrait, w: 1000, h: 1400, out: "assets/og-card-portrait.jpg", type: "jpeg" },
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
