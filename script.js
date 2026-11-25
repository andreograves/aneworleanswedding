// Countdown to the wedding (New Orleans is UTC-6 in January)
(function () {
  var target = new Date("2028-01-08T16:00:00-06:00").getTime();
  var d = document.getElementById("cd-days"),
      h = document.getElementById("cd-hours"),
      m = document.getElementById("cd-mins");
  function tick() {
    var diff = Math.max(0, target - Date.now());
    d.textContent = Math.floor(diff / 864e5);
    h.textContent = Math.floor((diff % 864e5) / 36e5);
    m.textContent = Math.floor((diff % 36e5) / 6e4);
  }
  tick();
  setInterval(tick, 30000);
})();

// Mobile menu
(function () {
  var btn = document.querySelector(".nav-toggle"),
      nav = document.getElementById("nav");
  btn.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
})();
