(function () {
  var table = document.getElementById("table");
  var tpl = document.getElementById("card-tpl");
  var enter = document.getElementById("enter");
  var prompt = document.getElementById("prompt");
  var soundBtn = document.getElementById("sound");
  var music = document.getElementById("music");
  var COUNT = 16;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------- Sound ----------------
  var muted = false;
  try { muted = localStorage.getItem("aa-muted") === "1"; } catch (e) {}
  var ctx = null, noise = null, master = null;
  var MUSIC_VOL = 0.4;
  var SFX_VOL = 2.2;   // card sounds level

  function initAudio() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : SFX_VOL;
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;
    master.connect(limiter); limiter.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function at(ms) { return ctx.currentTime + ms / 1000; }

  // Filtered noise burst — the building block of every card sound.
  function burst(t, o) {
    if (!ctx) return;
    var src = ctx.createBufferSource();
    src.buffer = noise;
    var f = ctx.createBiquadFilter();
    f.type = o.type || "bandpass";
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
  }
  var sfx = {
    // a single card edge flicking past another
    flick: function (t, v) {
      burst(t, { f0: 2600 + Math.random() * 2200, q: 1.4, vol: 0.5 * (v || 1), dur: 0.032 });
      burst(t, { type: "lowpass", f0: 900, vol: 0.22 * (v || 1), dur: 0.024 });
    },
    // cards sliding across each other / the table
    slide: function (t, dur, v) {
      burst(t, { f0: 900, f1: 2800, q: 0.8, vol: 0.26 * (v || 1), dur: dur, attack: dur * 0.4 });
    },
    // the deck squaring up
    thump: function (t, v) {
      burst(t, { type: "lowpass", f0: 520, q: 0.7, vol: 0.7 * (v || 1), dur: 0.1 });
      burst(t, { f0: 1800, q: 1, vol: 0.1 * (v || 1), dur: 0.03 });
    },
    // cards flying away
    whoosh: function (t, dur) {
      burst(t, { f0: 350, f1: 2400, q: 0.6, vol: 0.38, dur: dur, attack: dur * 0.3 });
    },
    // the ace turning over
    snap: function (t) {
      burst(t, { f0: 3200, q: 2, vol: 0.6, dur: 0.04 });
      burst(t, { type: "lowpass", f0: 700, vol: 0.3, dur: 0.06 });
    }
  };

  // ---- Music: gapless loop through Web Audio, <audio> element as fallback ----
  var LOOP_LEN = 42.216;          // exact loop length in seconds (21 bars)
  var musicData = null, musicBuf = null, musicGain = null, musicSrc = null, musicOn = false;
  if (music && window.fetch) {
    musicData = fetch(music.getAttribute("src")).then(function (r) { return r.arrayBuffer(); }).catch(function () { return null; });
  }
  function decodeMusic() {
    if (!ctx || !musicData) return Promise.resolve(null);
    return musicData.then(function (ab) {
      if (!ab) return null;
      return new Promise(function (res) { ctx.decodeAudioData(ab.slice(0), res, function () { res(null); }); });
    });
  }
  // Decoders differ in how much silent padding they add at the start, so
  // locate the first note and line the loop up against it.
  var LEAD = 0.042;               // first note's offset in a padding-free decode
  function loopStartFor(buf) {
    var d = buf.getChannelData(0), lim = Math.min(d.length, buf.sampleRate);
    for (var i = 0; i < lim; i++) if (Math.abs(d[i]) > 0.02) return Math.max(0, i / buf.sampleRate - LEAD);
    return 0;
  }
  function startMusic() {
    if (musicOn) return;
    musicOn = true;
    if (ctx && musicData) {
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(ctx.destination);
      decodeMusic().then(function (buf) {
        if (!buf) { musicGain = null; return startFallback(); }
        musicBuf = buf;
        var start = loopStartFor(buf);
        musicSrc = ctx.createBufferSource();
        musicSrc.buffer = buf;
        musicSrc.loop = true;
        musicSrc.loopStart = start;
        musicSrc.loopEnd = Math.min(buf.duration, start + LOOP_LEN);
        musicSrc.connect(musicGain);
        musicSrc.start(0, start);
        fadeMusic(muted ? 0 : MUSIC_VOL, 1.2);
      });
    } else startFallback();
  }
  function startFallback() {
    if (!music) return;
    music.volume = muted ? 0 : MUSIC_VOL;
    var p = music.play();
    if (p && p.catch) p.catch(function () {});
  }
  function fadeMusic(to, secs, done) {
    if (musicGain) {
      var g = musicGain.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + secs);
    } else if (music) {
      music.volume = to;
    }
    if (done) setTimeout(done, secs * 1000);
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem("aa-muted", m ? "1" : "0"); } catch (e) {}
    soundBtn.setAttribute("aria-pressed", m ? "false" : "true");
    soundBtn.classList.toggle("off", m);
    if (master) master.gain.setTargetAtTime(m ? 0 : SFX_VOL, ctx.currentTime, 0.05);
    if (musicOn) fadeMusic(m ? 0 : MUSIC_VOL, 0.4);
  }
  soundBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    initAudio();
    if (ctx && ctx.state === "suspended") ctx.resume();
    setMuted(!muted);
    if (!muted) startMusic();
  });
  setMuted(muted);

  // Fade the music out before leaving the page.
  enter.addEventListener("click", function (e) {
    if (!musicOn || muted) return;
    e.preventDefault();
    fadeMusic(0, 0.7, function () { location.href = enter.href; });
  });

  // ---------------- Cards ----------------
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Animate the shadow lift too, where the browser supports it.
  var LIFT = false;
  try {
    if (window.CSS && CSS.registerProperty) {
      CSS.registerProperty({ name: "--elev", syntax: "<number>", inherits: true, initialValue: "0" });
    }
    LIFT = !!(window.CSS && CSS.supports && CSS.supports("(--elev: 1)"));
  } catch (e) { LIFT = true; /* already registered by the stylesheet */ }

  var STEP = 0.55;  // deck thickness per card (px)
  var cards = [];
  for (var i = 0; i < COUNT; i++) {
    var el = tpl.content.firstElementChild.cloneNode(true);
    table.appendChild(el);
    var c = { el: el, inner: el.querySelector(".card-inner"),
      x: i * 0.12 + rand(-0.4, 0.4), y: -i * STEP, z: 0, r: rand(-0.8, 0.8), rx: 0, ry: 0, s: 1 };
    el.style.zIndex = i;
    setT(c);
    cards.push(c);
  }
  var ace = cards[Math.floor(COUNT / 2)];
  ace.inner.appendChild(document.getElementById("ace-front").content.firstElementChild.cloneNode(true));
  cards.forEach(function (c) { if (c !== ace) c.el.classList.add("plain"); });

  var KEYS = ["x", "y", "z", "r", "rx", "ry", "s"];
  function state(c) { var o = {}; KEYS.forEach(function (k) { o[k] = c[k]; }); return o; }
  function tf(st) {
    return "translate3d(" + st.x + "px," + st.y + "px," + st.z + "px) rotateZ(" + st.r + "deg) rotateX(" +
      st.rx + "deg) rotateY(" + st.ry + "deg) scale(" + st.s + ")";
  }
  function frame(st) { var f = { transform: tf(st) }; if (LIFT) f["--elev"] = String(Math.max(0, st.z)); return f; }
  function setT(c) { c.el.style.transform = tf(c); if (LIFT) c.el.style.setProperty("--elev", Math.max(0, c.z)); }

  // Animate through one or more waypoints: steps = [{x:.., z:.., offset:.., easing:..}, ...]
  function anim(c, steps, opts) {
    if (!Array.isArray(steps)) steps = [steps];
    var st = state(c), kf = [frame(st)];
    steps.forEach(function (s) {
      KEYS.forEach(function (k) { if (s[k] !== undefined) st[k] = s[k]; });
      var f = frame(st);
      if (s.offset !== undefined) f.offset = s.offset;
      if (s.easing) f.easing = s.easing;
      kf.push(f);
    });
    KEYS.forEach(function (k) { c[k] = st[k]; });
    var a = c.el.animate(kf, Object.assign({ duration: 400, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }, opts));
    return a.finished.then(function () { setT(c); a.cancel(); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function all(list) { return Promise.all(list); }
  function cardW() { return cards[0].el.offsetWidth; }
  function stackY(k) { return -k * STEP; }
  function restack(order, base) { order.forEach(function (c, k) { c.el.style.zIndex = (base || 100) + k; }); }

  // Two light taps on the sides to square the deck.
  function squareUp(order) {
    if (ctx) { sfx.thump(at(40), 0.8); sfx.thump(at(210), 0.45); }
    return all(order.map(function (c, k) {
      return anim(c, [
        { x: rand(-1.6, 1.6) + k * 0.1, r: rand(-1.2, 1.2), easing: "cubic-bezier(.3,1.5,.5,1)", offset: 0.55 },
        { x: k * 0.12 + rand(-0.4, 0.4), y: stackY(k), z: 0, rx: 0, ry: 0, r: rand(-0.6, 0.6) }
      ], { duration: 320, delay: rand(0, 25), easing: "cubic-bezier(.25,.8,.35,1)" });
    })).then(function () { return order; });
  }

  // Riffle: uneven split, thumbs bend the halves, cards fall in clumps.
  function riffle(order, bridgeFinish) {
    var w = cardW(), n = order.length;
    var cutAt = Math.round(n / 2 + rand(-2, 2));
    var left = order.slice(0, cutAt), right = order.slice(cutAt);
    var gap = w * rand(0.56, 0.64);
    if (ctx) { sfx.slide(at(0), 0.38, 0.8); sfx.slide(at(70), 0.36, 0.6); }

    function splitPacket(packet, side, delay) {
      return all(packet.map(function (c, i) {
        return anim(c, [
          { x: side * gap * 0.5, y: -18 - i * STEP, z: 22, r: side * 3, ry: side * -8, offset: 0.45 },
          { x: side * gap + rand(-1, 1), y: -6 - i * STEP, z: 16 + i * 0.5, r: side * rand(6, 9), ry: side * -16 }
        ], { duration: rand(430, 480), delay: delay + i * 3 });
      }));
    }
    return all([splitPacket(left, -1, 0), splitPacket(right, 1, rand(30, 70))])
      .then(function () {  // thumbs bend the inner edges up
        return all(order.map(function (c) {
          var side = left.indexOf(c) >= 0 ? -1 : 1;
          return anim(c, { ry: side * -27, z: c.z + 5 }, { duration: rand(160, 210), easing: "ease-in-out" });
        }));
      })
      .then(function () {
        // Build the drop order in uneven clumps, bottoms first.
        var merged = [], li = 0, ri = 0, side = Math.random() < 0.5 ? -1 : 1;
        while (li < left.length || ri < right.length) {
          var clump = pick([1, 1, 1, 2, 2, 3]);
          for (var q = 0; q < clump; q++) {
            if (side < 0 && li < left.length) merged.push({ c: left[li++], side: -1, first: q === 0 });
            else if (side > 0 && ri < right.length) merged.push({ c: right[ri++], side: 1, first: q === 0 });
          }
          side = -side;
        }
        var span = rand(520, 640), N = merged.length, tPrev = 0;
        var drops = merged.map(function (m, k) {
          var x = k / (N - 1);
          var t = span * (0.62 * (0.5 - 0.5 * Math.cos(Math.PI * x)) + 0.38 * x);  // slow–fast–slow
          if (!m.first) t = tPrev + rand(4, 10);
          tPrev = t;
          var dur = rand(170, 240);
          setTimeout(function () { m.c.el.style.zIndex = 100 + k; }, t);
          if (ctx) sfx.flick(at(t + dur * 0.8), rand(0.65, 1));
          return anim(m.c, [
            { ry: m.side * -12, z: 7, x: m.side * gap * 0.35, offset: 0.4 },
            { x: m.side * rand(1, 4) + rand(-2, 2), y: stackY(k) - 3, z: 0, r: rand(-3.5, 3.5), ry: 0 }
          ], { duration: dur, delay: t, easing: "cubic-bezier(.25,.6,.35,1)" });
        });
        var order2 = merged.map(function (m) { return m.c; });
        return all(drops).then(function () { return bridgeFinish ? bridge(order2) : squareUp(order2); });
      });
  }

  // The bridge: bow the deck up, then let it cascade flat.
  function bridge(order) {
    var n = order.length;
    return all(order.map(function (c, k) {
      return anim(c, { y: stackY(k) - 14, z: 26 + k * 0.4, rx: -20, x: rand(-1, 1) },
        { duration: 300, delay: k * 3, easing: "cubic-bezier(.3,.7,.4,1)" });
    })).then(function () { return wait(90); }).then(function () {
      return all(order.map(function (c, k) {
        var t = k * rand(12, 17);
        if (ctx) sfx.flick(at(t + 150), rand(0.4, 0.75));
        return anim(c, { y: stackY(k), z: 0, rx: 0, r: rand(-1.5, 1.5) },
          { duration: 200, delay: t, easing: "cubic-bezier(.3,.85,.4,1)" });
      }));
    }).then(function () { return squareUp(order); });
  }

  // Cut: lift the top packet to the side, put the bottom packet on it, slide back.
  function cut(order) {
    var w = cardW(), n = order.length;
    var cutAt = Math.round(n * rand(0.4, 0.6));
    var bottom = order.slice(0, cutAt), top = order.slice(cutAt);
    var dx = w * 0.95;
    if (ctx) { sfx.slide(at(0), 0.45, 0.7); sfx.thump(at(470), 0.6); }
    return all(top.map(function (c, i) {
      return anim(c, [
        { x: dx * 0.45, y: stackY(cutAt + i) - 34, z: 42, r: 4, offset: 0.45 },
        { x: dx + rand(-1, 1), y: stackY(i), z: 0, r: rand(2, 5) }
      ], { duration: 520, delay: i * 3, easing: "cubic-bezier(.45,.05,.3,1)" });
    })).then(function () {
      restack(bottom, 200);
      if (ctx) { sfx.slide(at(0), 0.45, 0.7); sfx.thump(at(480), 0.8); }
      return all(bottom.map(function (c, i) {
        return anim(c, [
          { x: dx * 0.5, y: stackY(top.length + i) - 40, z: 50, r: -2, offset: 0.5 },
          { x: dx + rand(-2, 2), y: stackY(top.length + i), z: 0, r: rand(1, 4) }
        ], { duration: 540, delay: i * 3, easing: "cubic-bezier(.45,.05,.3,1)" });
      }));
    }).then(function () {
      var merged = top.concat(bottom);
      restack(merged);
      if (ctx) sfx.slide(at(0), 0.42, 0.9);
      return all(merged.map(function (c, k) {
        return anim(c, [
          { z: 5, offset: 0.4 },
          { x: rand(-2, 2), y: stackY(k), z: 0, r: rand(-2, 2) }
        ], { duration: 440, delay: k * 2, easing: "cubic-bezier(.4,0,.2,1)" });
      })).then(function () { return squareUp(merged); });
    });
  }

  // Scatter: cards are thrown, tumbling as they slow; the ace is left behind.
  function scatter(order) {
    var diag = Math.hypot(innerWidth, innerHeight);
    var rest = order.filter(function (c) { return c !== ace; }).reverse();  // top cards go first
    var base = rand(0, Math.PI * 2);
    if (ctx) sfx.whoosh(at(0), 1.3);
    var flights = rest.map(function (c, k) {
      var ang = base + k * 2.39996 + rand(-0.35, 0.35);  // golden-angle spread, jittered
      var dist = diag * rand(0.68, 0.95);
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      var spin = (Math.random() < 0.5 ? -1 : 1) * rand(220, 620);
      var rx = rand(-200, 200), ry = rand(-260, 260);
      var delay = k * rand(16, 28) + rand(0, 40);
      if (ctx) sfx.flick(at(delay + 10), rand(0.45, 0.85));
      return anim(c, [
        { x: dx * 0.55, y: dy * 0.55, z: rand(70, 150), r: c.r + spin * 0.55, rx: rx * 0.55, ry: ry * 0.55, offset: 0.4 },
        { x: dx, y: dy, z: rand(10, 50), r: c.r + spin, rx: rx, ry: ry }
      ], { duration: rand(950, 1400), delay: delay, easing: "cubic-bezier(.12,.6,.3,1)" })
        .then(function () { c.el.remove(); });
    });
    // the ace gets nudged by the cards leaving
    var nudge = wait(140).then(function () {
      return anim(ace, [{ x: rand(-10, 10), r: rand(-7, 7), z: 4, offset: 0.4 }, { x: ace.x + rand(-6, 6), y: ace.y + rand(-4, 4), z: 0, r: rand(-5, 5) }],
        { duration: 520, easing: "cubic-bezier(.2,.7,.3,1)" });
    });
    return all(flights.concat([nudge]));
  }

  function aceTarget() {
    var cs = getComputedStyle(document.documentElement);
    return { y: innerHeight * parseFloat(cs.getPropertyValue("--lift")) / 100, s: parseFloat(cs.getPropertyValue("--grow")) };
  }

  // Reveal: pick the ace up, turn it over, set it down.
  function reveal() {
    var t = aceTarget();
    ace.el.style.zIndex = 500;
    if (ctx) { sfx.slide(at(0), 0.5, 0.5); sfx.snap(at(760)); sfx.thump(at(1080), 0.35); }
    var travel = anim(ace, [
      { x: ace.x * 0.4, y: (ace.y + t.y) / 2, z: 130, r: ace.r * 0.3, rx: -6, offset: 0.45, easing: "cubic-bezier(.3,0,.4,1)" },
      { x: 0, y: t.y, z: 0, r: 0, rx: 0, s: t.s }
    ], { duration: 1100, easing: "cubic-bezier(.25,.1,.25,1)" });
    var flip = ace.inner.animate(
      [{ transform: "rotateY(0deg)" }, { transform: "rotateY(105deg)", offset: 0.55 }, { transform: "rotateY(180deg)" }],
      { duration: 880, delay: 260, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }).finished;
    return all([travel, flip]).then(function () {
      return anim(ace, [{ s: t.s * 1.02, offset: 0.4 }, { s: t.s }], { duration: 260, easing: "ease-out" });
    });
  }
  function finish() {
    ace.inner.style.transform = "rotateY(180deg)";
    ace.el.style.willChange = "auto";
    enter.classList.add("show");
  }

  // ---------------- Run ----------------
  if (reduced) {
    prompt.remove();
    cards.forEach(function (c) { if (c !== ace) c.el.remove(); });
    var t0 = aceTarget();
    ace.x = 0; ace.y = t0.y; ace.r = 0; ace.s = t0.s;
    setT(ace); finish();
    return;
  }

  var started = false;
  function start(e) {
    if (started) return;
    if (e && e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    if (e && e.target && e.target.closest && e.target.closest(".sound")) return;
    started = true;
    document.removeEventListener("pointerdown", start);
    document.removeEventListener("keydown", start);
    initAudio();
    if (ctx && ctx.state === "suspended") ctx.resume();
    startMusic();
    prompt.classList.add("hide");

    var order = cards.slice();
    restack(order);
    wait(380)
      .then(function () { return riffle(order, false); })
      .then(function (o) { return wait(rand(120, 220)).then(function () { return cut(o); }); })
      .then(function (o) { return wait(rand(120, 200)).then(function () { return riffle(o, true); }); })
      .then(function (o) { return wait(420).then(function () { return scatter(o); }); })
      .then(function () { return wait(180); })
      .then(reveal)
      .then(function () { return wait(120); })
      .then(finish);
  }
  document.addEventListener("pointerdown", start);
  document.addEventListener("keydown", start);
})();
