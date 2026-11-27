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

(async () => {
  const browser = await chromium.launch();
  const jobs = [
    { html: tplPhoto, w: 1200, h: 630, out: "assets/og-image.jpg", type: "jpeg", file: "preview-photo.html" },
    { html: tplCards, w: 1200, h: 630, out: "assets/og-image-cards.jpg", type: "jpeg", file: "preview.html" },
    { html: tplCard.replace("<body>", '<body class="side-front">'), w: 1200, h: 630, out: "assets/og-card-front.jpg", type: "jpeg", file: "preview-card.html" },
    { html: tplCard.replace("<body>", '<body class="side-back">'), w: 1200, h: 630, out: "assets/og-card-back.jpg", type: "jpeg", file: "preview-card.html" },
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
