/* =========================================================
   Orbit Analytics — vanilla JS interactions
   Chart engine (canvas), counters, ranges, nav, toast.
   No libraries, no CDN, no build step.
   ========================================================= */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COL = {
    vio: "#a78bfa",
    cyan: "#22d3ee",
    pink: "#f472b6",
    lime: "#a3e635",
    grid: "rgba(255,255,255,0.07)",
    axis: "rgba(164,158,199,0.85)"
  };

  /* ---------- helpers ---------- */
  function fitCanvas(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = cv.getBoundingClientRect();
    var h = Number(cv.getAttribute("height")) || 240;
    var w = Math.max(rect.width, 240);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.height = h + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function rnd(seed) { // tiny deterministic PRNG so charts look stable
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function series(points, base, swing, seed, drift) {
    var r = rnd(seed), out = [], v = base;
    for (var i = 0; i < points; i++) {
      v = v + (r() - 0.48) * swing + (drift || 0);
      v = Math.max(base * 0.34, Math.min(base * 1.75, v));
      out.push(v);
    }
    return out;
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  /* ---------- state ---------- */
  var range = 7;
  var data = build();

  function build() {
    var n = range === 7 ? 12 : range === 30 ? 15 : 18;
    var s1 = series(n, 62, 17, range * 977 + 13, range === 7 ? 2.1 : 3.4);
    var s2 = s1.map(function (v, i) { return v * (0.34 + (i / n) * 0.17) + (i % 3) * 1.6; });
    return { a: s1, b: s2, n: n };
  }

  /* ---------- line chart ---------- */
  var lineCv = document.getElementById("lineChart");
  var lineProg = reduce ? 1 : 0;

  function drawLine() {
    if (!lineCv) return;
    var c = fitCanvas(lineCv), ctx = c.ctx, w = c.w, h = c.h;
    var pad = { t: 18, r: 10, b: 26, l: 34 };
    var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    var all = data.a.concat(data.b);
    var max = Math.max.apply(null, all) * 1.12;
    var min = 0;

    ctx.clearRect(0, 0, w, h);

    // grid + y labels
    ctx.font = "11px " + "Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = COL.axis;
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) {
      var y = pad.t + (ih / 4) * g;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(Math.round(max - ((max - min) / 4) * g) + "", 6, y + 4);
    }

    function px(i) { return pad.l + (iw * i) / (data.n - 1 || 1); }
    function py(v) { return pad.t + ih - ((v - min) / (max - min)) * ih; }

    function stroke(arr, color, glow, withFill) {
      var upto = Math.max(1, Math.round((data.n - 1) * lineProg));
      ctx.beginPath();
      arr.forEach(function (v, i) {
        if (i > upto) return;
        var x = px(i), y = py(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = color;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = glow;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (withFill) {
        var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ih);
        grad.addColorStop(0, "rgba(167,139,250,0.34)");
        grad.addColorStop(1, "rgba(167,139,250,0)");
        ctx.lineTo(px(upto), pad.t + ih);
        ctx.lineTo(pad.l, pad.t + ih);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // head dot
      var hx = px(upto), hy = py(arr[upto]);
      ctx.beginPath(); ctx.arc(hx, hy, 4.4, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.shadowColor = glow; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
    }

    stroke(data.a, COL.vio, "rgba(167,139,250,0.9)", true);
    stroke(data.b, COL.cyan, "rgba(34,211,238,0.9)", false);

    // x labels
    ctx.fillStyle = COL.axis;
    var step = Math.ceil(data.n / 6);
    for (var i = 0; i < data.n; i += step) {
      var label = range === 7 ? "D" + (i + 1) : range === 30 ? "W" + (i + 1) : "M" + (i + 1);
      ctx.fillText(label, px(i) - 8, h - 8);
    }
  }

  function animateLine() {
    if (reduce) { lineProg = 1; drawLine(); return; }
    lineProg = 0;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / 1100, 1);
      lineProg = ease(t);
      drawLine();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- donut chart ---------- */
  var donutCv = document.getElementById("donutChart");
  var donutProg = reduce ? 1 : 0;
  var slices = [
    { v: 38, c: COL.vio },
    { v: 27, c: COL.cyan },
    { v: 21, c: COL.pink },
    { v: 14, c: COL.lime }
  ];

  function drawDonut() {
    if (!donutCv) return;
    var c = fitCanvas(donutCv), ctx = c.ctx, w = c.w, h = c.h;
    var cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 14, thick = Math.max(14, r * 0.3);
    var total = slices.reduce(function (a, s) { return a + s.v; }, 0);
    ctx.clearRect(0, 0, w, h);
    var start = -Math.PI / 2;

    slices.forEach(function (s) {
      var span = (s.v / total) * Math.PI * 2 * donutProg;
      ctx.beginPath();
      ctx.arc(cx, cy, r - thick / 2, start, start + span);
      ctx.lineWidth = thick;
      ctx.lineCap = "butt";
      ctx.strokeStyle = s.c;
      ctx.shadowColor = s.c;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
      start += span;
      // gap between slices
      if (!reduce) start += 0.03;
    });

    // soft core
    var core = ctx.createRadialGradient(cx, cy, 4, cx, cy, r - thick);
    core.addColorStop(0, "rgba(167,139,250,0.18)");
    core.addColorStop(1, "rgba(7,5,18,0)");
    ctx.beginPath(); ctx.arc(cx, cy, r - thick, 0, Math.PI * 2);
    ctx.fillStyle = core; ctx.fill();
  }

  function animateDonut() {
    if (reduce) { donutProg = 1; drawDonut(); return; }
    donutProg = 0;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / 1200, 1);
      donutProg = ease(t);
      drawDonut();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- animated counters ---------- */
  function counters() {
    var nodes = document.querySelectorAll("[data-count]");
    Array.prototype.forEach.call(nodes, function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduce) { el.textContent = target.toFixed(dec) + suffix; return; }
      var start = null, dur = 1300;
      function step(ts) {
        if (start === null) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        el.textContent = (target * ease(t)).toFixed(dec) + suffix;
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------- interactions ---------- */
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  var sidebar = document.getElementById("sidebar");
  var scrim = document.getElementById("scrim");
  var openBtn = document.getElementById("openNav");

  function setNav(open) {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    if (scrim) scrim.hidden = !open;
    if (openBtn) openBtn.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (openBtn) openBtn.addEventListener("click", function () { setNav(true); });
  var closeBtn = document.getElementById("closeNav");
  if (closeBtn) closeBtn.addEventListener("click", function () { setNav(false); });
  if (scrim) scrim.addEventListener("click", function () { setNav(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });

  Array.prototype.forEach.call(document.querySelectorAll(".nav-item"), function (a) {
    a.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".nav-item"), function (x) {
        x.classList.remove("is-active"); x.removeAttribute("aria-current");
      });
      a.classList.add("is-active");
      a.setAttribute("aria-current", "page");
      setNav(false);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".seg-btn"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".seg-btn"), function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active");
      range = parseInt(b.getAttribute("data-range"), 10);
      data = build();
      animateLine();
      toast("Window switched to " + range + " days");
    });
  });

  var replay = document.getElementById("replayBtn");
  if (replay) replay.addEventListener("click", function () {
    animateLine(); animateDonut(); counters();
    toast("Animation replayed");
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-demo]"), function (el) {
    el.addEventListener("click", function () { toast("Demo mode — wire this to your real data source."); });
  });

  var themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    toast("Dark is the only premium mode here.");
  });

  var search = document.getElementById("search");
  if (search) search.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && search.value.trim()) {
      toast('No results for "' + search.value.trim() + '" — demo dataset');
    }
  });

  /* ---------- reveal + boot ---------- */
  var revealTargets = document.querySelectorAll(".hero, .kpi, .panel, .mini");
  Array.prototype.forEach.call(revealTargets, function (el, i) {
    el.classList.add("reveal");
    el.style.animationDelay = Math.min(i * 70, 520) + "ms";
  });

  function boot() {
    counters(); animateLine(); animateDonut();
    var live = document.getElementById("livePill");
    if (live && !reduce) setInterval(function () {
      live.style.opacity = live.style.opacity === "0.55" ? "1" : "0.55";
    }, 2600);
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { drawLine(); drawDonut(); }, 140);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
