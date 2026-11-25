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
  var MUSIC_VOL = 0.38;

  function initAudio() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
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
      burst(t, { f0: 2600 + Math.random() * 2200, q: 1.4, vol: 0.32 * (v || 1), dur: 0.028 });
      burst(t, { type: "lowpass", f0: 900, vol: 0.12 * (v || 1), dur: 0.02 });
    },
    // cards sliding across each other / the table
    slide: function (t, dur, v) {
      burst(t, { f0: 900, f1: 2800, q: 0.8, vol: 0.14 * (v || 1), dur: dur, attack: dur * 0.4 });
    },
    // the deck squaring up
    thump: function (t, v) {
      burst(t, { type: "lowpass", f0: 520, q: 0.7, vol: 0.5 * (v || 1), dur: 0.09 });
      burst(t, { f0: 1800, q: 1, vol: 0.1 * (v || 1), dur: 0.03 });
    },
    // cards flying away
    whoosh: function (t, dur) {
      burst(t, { f0: 350, f1: 2400, q: 0.6, vol: 0.22, dur: dur, attack: dur * 0.3 });
    },
    // the ace turning over
    snap: function (t) {
      burst(t, { f0: 3200, q: 2, vol: 0.45, dur: 0.035 });
      burst(t, { type: "lowpass", f0: 700, vol: 0.3, dur: 0.06 });
    }
  };

  function startMusic() {
    if (!music) return;
    music.volume = 0;
    var p = music.play();
    if (p && p.catch) p.catch(function () {});
    fadeMusic(muted ? 0 : MUSIC_VOL, 1800);
  }
  var fadeTimer = null;
  function fadeMusic(to, ms, done) {
    clearInterval(fadeTimer);
    var from = music.volume, steps = Math.max(1, Math.round(ms / 40)), i = 0;
    fadeTimer = setInterval(function () {
      i++;
      music.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
      if (i >= steps) { clearInterval(fadeTimer); if (done) done(); }
    }, 40);
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem("aa-muted", m ? "1" : "0"); } catch (e) {}
    soundBtn.setAttribute("aria-pressed", m ? "false" : "true");
    soundBtn.classList.toggle("off", m);
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
    if (music) {
      if (!m && music.paused) startMusic();
      else fadeMusic(m ? 0 : MUSIC_VOL, 400);
    }
  }
  soundBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    initAudio();
    setMuted(!muted);
  });
  setMuted(muted);

  // Fade the music out before leaving the page.
  enter.addEventListener("click", function (e) {
    if (!music || music.paused || muted) return;
    e.preventDefault();
    fadeMusic(0, 700, function () { location.href = enter.href; });
  });

  // ---------------- Cards ----------------
  var cards = [];
  for (var i = 0; i < COUNT; i++) {
    var el = tpl.content.firstElementChild.cloneNode(true);
    table.appendChild(el);
    var c = { el: el, inner: el.querySelector(".card-inner"), x: 0, y: -i * 0.6, r: (Math.random() - 0.5) * 2, s: 1 };
    el.style.zIndex = i;
    setT(c);
    cards.push(c);
  }
  var ace = cards[Math.floor(COUNT / 2)];
  ace.inner.appendChild(document.getElementById("ace-front").content.firstElementChild.cloneNode(true));

  function tf(c) { return "translate(" + c.x + "px," + c.y + "px) rotate(" + c.r + "deg) scale(" + c.s + ")"; }
  function setT(c) { c.el.style.transform = tf(c); }
  function move(c, to, opts) {
    var from = tf(c);
    Object.assign(c, to);
    var a = c.el.animate([{ transform: from }, { transform: tf(c) }],
      Object.assign({ duration: 500, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }, opts));
    return a.finished.then(function () { setT(c); a.cancel(); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function cardW() { return cards[0].el.offsetWidth; }

  function riffle(order) {
    var half = Math.ceil(order.length / 2);
    var left = order.slice(0, half), right = order.slice(half);
    var gap = cardW() * 0.62;
    if (ctx) sfx.slide(at(0), 0.4, 0.9);

    var split = [];
    left.forEach(function (c, i) { split.push(move(c, { x: -gap, y: -i * 0.6, r: -6 }, { duration: 420 })); });
    right.forEach(function (c, i) { split.push(move(c, { x: gap, y: -i * 0.6, r: 6 }, { duration: 420 })); });

    return Promise.all(split).then(function () { return wait(120); }).then(function () {
      var merged = [], li = 0, ri = 0;
      while (li < left.length || ri < right.length) {
        var takeLeft = ri >= right.length || (li < left.length && (Math.random() < 0.5 || merged.length % 2 === 0));
        merged.push(takeLeft ? left[li++] : right[ri++]);
      }
      if (ctx) {  // the "brrrrt" of a riffle, one flick per card plus in-betweens
        merged.forEach(function (_, k) {
          sfx.flick(at(k * 45 + 280), 1);
          sfx.flick(at(k * 45 + 302), 0.6);
        });
        sfx.thump(at(merged.length * 45 + 300), 0.9);
      }
      var drops = merged.map(function (c, k) {
        c.el.style.zIndex = 100 + k;
        return move(c, { x: (Math.random() - 0.5) * 3, y: -k * 0.6, r: (Math.random() - 0.5) * 3 },
          { duration: 300, delay: k * 45, easing: "cubic-bezier(.3,.7,.4,1)" });
      });
      return Promise.all(drops).then(function () { return merged; });
    });
  }

  function cut(order) {
    var half = Math.floor(order.length / 2);
    var top = order.slice(half), bottom = order.slice(0, half);
    var h = cards[0].el.offsetHeight;
    if (ctx) { sfx.slide(at(0), 0.35, 0.8); sfx.slide(at(380), 0.3, 0.7); sfx.thump(at(740), 1); }
    return Promise.all(top.map(function (c) { return move(c, { y: c.y - h * 0.75, r: 2 }, { duration: 380 }); }))
      .then(function () {
        var merged = top.concat(bottom);
        return Promise.all(merged.map(function (c, k) {
          c.el.style.zIndex = 100 + k;
          return move(c, { x: 0, y: -k * 0.6, r: (Math.random() - 0.5) * 2 }, { duration: 380 });
        })).then(function () { return merged; });
      });
  }

  function scatter(order) {
    var reach = Math.hypot(innerWidth, innerHeight) * 0.75;
    ace.el.style.zIndex = 500;
    var rest = order.filter(function (c) { return c !== ace; });
    if (ctx) {
      sfx.whoosh(at(0), 1.3);
      rest.forEach(function (_, k) { sfx.flick(at(k * 35 + 20), 0.7); });
    }
    var flights = rest.map(function (c, k) {
      var ang = (k / (order.length - 1)) * Math.PI * 2 + Math.random() * 0.5;
      return move(c, {
        x: Math.cos(ang) * reach, y: Math.sin(ang) * reach,
        r: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360)
      }, { duration: 1100, delay: k * 35, easing: "cubic-bezier(.5,0,.75,.4)" })
        .then(function () { c.el.remove(); });
    });
    return Promise.all(flights);
  }

  function aceTarget() {
    var cs = getComputedStyle(document.documentElement);
    return {
      y: innerHeight * parseFloat(cs.getPropertyValue("--lift")) / 100,
      s: parseFloat(cs.getPropertyValue("--grow"))
    };
  }
  function reveal() {
    var t = aceTarget();
    if (ctx) { sfx.slide(at(0), 0.6, 0.6); sfx.snap(at(850)); }
    var centering = move(ace, { x: 0, y: t.y, r: 0, s: t.s }, { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" });
    var flip = ace.inner.animate(
      [{ transform: "rotateY(0deg)" }, { transform: "rotateY(90deg) scale(1.06)", offset: 0.5 }, { transform: "rotateY(180deg)" }],
      { duration: 1000, delay: 350, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }
    ).finished;
    return Promise.all([centering, flip]);
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
    var t = aceTarget();
    ace.y = t.y; ace.r = 0; ace.s = t.s;
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
    wait(500)
      .then(function () { return riffle(order); })
      .then(function (o) { return wait(150).then(function () { return riffle(o); }); })
      .then(function (o) { return wait(150).then(function () { return cut(o); }); })
      .then(function (o) { return wait(150).then(function () { return riffle(o); }); })
      .then(function (o) { return wait(450).then(function () { return scatter(o); }); })
      .then(reveal)
      .then(function () { return wait(150); })
      .then(finish);
  }
  document.addEventListener("pointerdown", start);
  document.addEventListener("keydown", start);
})();
