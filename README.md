# Ailsa & André — January 8, 2028 · New Orleans

Static wedding website (plain HTML/CSS/JS, no build step).

- `index.html` — splash page (tap → shuffling cards → ace of hearts → "Geaux")
- `splash.css`, `splash.js` — splash styling and card animation
- `home.html` — main site content (edit text here)
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

## Music
`assets/audio/saints-brass.mp3`: "When the Saints Go Marching In" (traditional), performed by the
Gateway Brass of the United States Air Force Band of the West (from *Facets!*, 1992). As a work of the
U.S. federal government it is in the public domain
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:When_the_Saints_Go_Marching_In_-_Gateway_Brass_-_United_States_Air_Force_Band_of_the_West.mp3),
[USAF public domain music](https://www.music.af.mil/Multimedia/Music/Public-Domain-Music/)).

Prepared from the original with:
```
ffmpeg -ss 34.5 -to 174.8 -i original.mp3 \
  -af "afade=t=in:d=0.03,rubberband=tempo=1.2:pitchq=quality:transients=crisp:detector=compound,afade=t=out:st=116.2:d=0.6,loudnorm=I=-17:TP=-1.5:LRA=11" \
  -ar 44100 -ac 2 -b:a 128k assets/audio/saints-brass.mp3
```
(starts at the full-band entry, 20% faster with pitch unchanged, volume normalized).

Card sounds are synthesized live in the browser (`splash.js`).
