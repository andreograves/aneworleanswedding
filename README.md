# Ailsa & André — January 8, 2028 · New Orleans

Static wedding website (plain HTML/CSS/JS, no build step).

- `index.html` — all page content (edit text here)
- `styles.css` — colors, fonts, layout (palette variables at the top)
- `script.js` — countdown + mobile menu
- `assets/fleur-de-lis.svg` — the minimalist fleur-de-lis emblem
- `CNAME` — custom domain for GitHub Pages

## Preview locally
Open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.

## Publish with GitHub Pages + your domain
1. GitHub repo → Settings → Pages → Source: "Deploy from a branch", pick `main` / root.
2. Make sure `CNAME` contains your exact domain (currently `aneworleanswedding.com`).
3. At your domain registrar, add DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `andreograves.github.io`
4. Back in Settings → Pages, tick "Enforce HTTPS" once the certificate is issued.
