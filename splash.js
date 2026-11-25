(function () {
  var table = document.getElementById("table");
  var tpl = document.getElementById("card-tpl");
  var enter = document.getElementById("enter");
  var COUNT = 16;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Build the deck ----
  var cards = [];
  for (var i = 0; i < COUNT; i++) {
    var el = tpl.content.firstElementChild.cloneNode(true);
    table.appendChild(el);
    var c = { el: el, inner: el.querySelector(".card-inner"), x: 0, y: -i * 0.6, r: (Math.random() - 0.5) * 2, s: 1 };
    el.style.zIndex = i;
    setT(c);
    cards.push(c);
  }
  // The ace of hearts is hidden in the deck; give it a face.
  var ace = cards[Math.floor(COUNT / 2)];
  ace.inner.appendChild(document.getElementById("ace-front").content.firstElementChild.cloneNode(true));

  function tf(c) { return "translate(" + c.x + "px," + c.y + "px) rotate(" + c.r + "deg) scale(" + c.s + ")"; }
  function setT(c) { c.el.style.transform = tf(c); }

  // Animate a card from its current state to a new one.
  function move(c, to, opts) {
    var from = tf(c);
    Object.assign(c, to);
    var a = c.el.animate([{ transform: from }, { transform: tf(c) }],
      Object.assign({ duration: 500, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }, opts));
    return a.finished.then(function () { setT(c); a.cancel(); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function cardW() { return cards[0].el.offsetWidth; }

  // ---- Riffle shuffle: split, then interleave back into one pile ----
  function riffle(order) {
    var half = Math.ceil(order.length / 2);
    var left = order.slice(0, half), right = order.slice(half);
    var gap = cardW() * 0.62;

    var split = [];
    left.forEach(function (c, i) { split.push(move(c, { x: -gap, y: -i * 0.6, r: -6 }, { duration: 420 })); });
    right.forEach(function (c, i) { split.push(move(c, { x: gap, y: -i * 0.6, r: 6 }, { duration: 420 })); });

    return Promise.all(split).then(function () { return wait(120); }).then(function () {
      // Interleave from the bottom of each half, alternating sides.
      var merged = [], li = 0, ri = 0;
      while (li < left.length || ri < right.length) {
        var takeLeft = ri >= right.length || (li < left.length && (Math.random() < 0.5 || merged.length % 2 === 0));
        merged.push(takeLeft ? left[li++] : right[ri++]);
      }
      var drops = merged.map(function (c, k) {
        c.el.style.zIndex = 100 + k;
        return move(c, { x: (Math.random() - 0.5) * 3, y: -k * 0.6, r: (Math.random() - 0.5) * 3 },
          { duration: 300, delay: k * 45, easing: "cubic-bezier(.3,.7,.4,1)" });
      });
      return Promise.all(drops).then(function () { return merged; });
    });
  }

  // ---- Overhand cut: lift the top half, swing it under ----
  function cut(order) {
    var half = Math.floor(order.length / 2);
    var top = order.slice(half), bottom = order.slice(0, half);
    var h = cards[0].el.offsetHeight;
    return Promise.all(top.map(function (c) { return move(c, { y: c.y - h * 0.75, r: 2 }, { duration: 380 }); }))
      .then(function () {
        var merged = top.concat(bottom);
        return Promise.all(merged.map(function (c, k) {
          c.el.style.zIndex = 100 + k;
          return move(c, { x: 0, y: -k * 0.6, r: (Math.random() - 0.5) * 2 }, { duration: 380 });
        })).then(function () { return merged; });
      });
  }

  // ---- Scatter everything except the ace ----
  function scatter(order) {
    var reach = Math.hypot(innerWidth, innerHeight) * 0.75;
    ace.el.style.zIndex = 500;
    var flights = order.filter(function (c) { return c !== ace; }).map(function (c, k) {
      var ang = (k / (order.length - 1)) * Math.PI * 2 + Math.random() * 0.5;
      return move(c, {
        x: Math.cos(ang) * reach, y: Math.sin(ang) * reach,
        r: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360)
      }, { duration: 1100, delay: k * 35, easing: "cubic-bezier(.5,0,.75,.4)" })
        .then(function () { c.el.remove(); });
    });
    return Promise.all(flights);
  }

  // ---- Reveal: center, lift, flip ----
  function reveal() {
    var cs = getComputedStyle(document.documentElement);
    var lift = innerHeight * parseFloat(cs.getPropertyValue("--lift")) / 100;
    var grow = parseFloat(cs.getPropertyValue("--grow"));
    var centering = move(ace, { x: 0, y: lift, r: 0, s: grow }, { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" });
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

  // ---- Run ----
  if (reduced) {
    cards.forEach(function (c) { if (c !== ace) c.el.remove(); });
    var cs = getComputedStyle(document.documentElement);
    ace.y = innerHeight * parseFloat(cs.getPropertyValue("--lift")) / 100;
    ace.r = 0; ace.s = parseFloat(cs.getPropertyValue("--grow"));
    setT(ace); finish();
    return;
  }

  var order = cards.slice();
  wait(700)
    .then(function () { return riffle(order); })
    .then(function (o) { return wait(150).then(function () { return riffle(o); }); })
    .then(function (o) { return wait(150).then(function () { return cut(o); }); })
    .then(function (o) { return wait(150).then(function () { return riffle(o); }); })
    .then(function (o) { return wait(450).then(function () { return scatter(o); }); })
    .then(reveal)
    .then(function () { return wait(150); })
    .then(finish);
})();
