(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var deskMq = window.matchMedia('(min-width: 1180px)');

  var ctrl = null;
  var alive = false;
  var observers = [];
  var timers = [];

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function on(target, type, fn, opts) {
    var options = Object.assign({ signal: ctrl.signal }, opts || {});
    target.addEventListener(type, fn, options);
  }
  function loop(fn) {
    var id;
    function tick(t) {
      if (!alive) return;
      fn(t);
      id = window.requestAnimationFrame(tick);
    }
    id = window.requestAnimationFrame(tick);
    return function () { window.cancelAnimationFrame(id); };
  }
  function observe(targets, cb, options) {
    var io = new IntersectionObserver(cb, options);
    targets.forEach(function (t) { io.observe(t); });
    observers.push(io);
    return io;
  }
  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function initLang() {
    var site = $('.site');
    var pageLang = (site && site.getAttribute('data-page-lang')) || root.getAttribute('lang') || 'ru';
    root.setAttribute('lang', pageLang);
    if (site && site.getAttribute('data-page-title')) {
      document.title = site.getAttribute('data-page-title');
    }

    try {
      var savedScroll = window.sessionStorage.getItem('ap-lang-scroll');
      if (savedScroll !== null) {
        window.sessionStorage.removeItem('ap-lang-scroll');
        window.scrollTo(0, parseInt(savedScroll, 10) || 0);
      }
    } catch (e) {}

    $$('[data-lang]').forEach(function (el) {
      var l = el.getAttribute('data-lang');
      el.setAttribute('aria-current', l === pageLang ? 'true' : 'false');
      on(el, 'click', function () {
        try {
          window.localStorage.setItem('ap-lang', l);
          window.sessionStorage.setItem('ap-lang-scroll', String(Math.round(window.scrollY)));
        } catch (e) {}
      });
    });
  }

  function initHeader() {
    var hdr = $('.hdr');
    if (!hdr) return;
    function update() { hdr.classList.toggle('is-scrolled', window.scrollY > 24); }
    on(window, 'scroll', update, { passive: true });
    update();
  }

  function initMenu() {
    var menu = $('.menu');
    var burger = $('.burger');
    if (!menu || !burger) return;

    var links = $$('.menu__list a', menu);
    links.forEach(function (a, i) { a.style.setProperty('--i', i); });

    var isOpen = false;
    var lastFocus = null;

    function focusables() {
      return $$('a[href], button:not([disabled])', menu).filter(function (el) { return el.offsetParent !== null; });
    }

    var focusTimer = null;

    function open(viaKeyboard) {
      isOpen = true;
      lastFocus = document.activeElement;
      window.clearTimeout(focusTimer);
      root.classList.add('menu-open');
      burger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      if (viaKeyboard) {
        focusTimer = later(function () {
          if (isOpen && links[0]) links[0].focus({ preventScroll: true });
        }, 380);
      }
    }

    function close(viaKeyboard) {
      if (!isOpen) return;
      isOpen = false;
      window.clearTimeout(focusTimer);
      root.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      if (viaKeyboard && lastFocus && lastFocus.focus) {
        lastFocus.focus({ preventScroll: true });
      }
    }

    on(burger, 'click', function (e) {
      var viaKb = e.detail === 0;
      isOpen ? close(viaKb) : open(viaKb);
    });

    on(window, 'wheel', function (e) {
      if (isOpen) e.preventDefault();
    }, { passive: false });
    on(window, 'touchmove', function (e) {
      if (isOpen) e.preventDefault();
    }, { passive: false });

    on(document, 'keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(true); return; }
      if ([' ', 'PageUp', 'PageDown', 'End', 'Home', 'ArrowUp', 'ArrowDown'].indexOf(e.key) !== -1) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab') {
        var list = focusables();
        list.unshift(burger);
        var first = list[0];
        var last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    $$('a', menu).forEach(function (a) {
      on(a, 'click', function () { if (!a.hasAttribute('data-stub')) close(); });
    });

    menu.setAttribute('aria-hidden', 'true');
  }

  function initStubs() {
    var toast = $('.toast');
    var isEn = root.getAttribute('lang') === 'en';
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    var fallback = isEn
      ? 'The contact form is coming here very soon'
      : 'Форма связи появится здесь совсем скоро';
    toast.textContent = fallback;

    var hideTimer = null;

    on(document, 'click', function (e) {
      var stub = e.target.closest('[data-stub]');
      if (!stub) return;
      e.preventDefault();
      toast.textContent = stub.getAttribute('data-stub') || fallback;
      toast.classList.add('is-visible');
      window.clearTimeout(hideTimer);
      hideTimer = later(function () { toast.classList.remove('is-visible'); }, 2600);
    });
  }

  function splitNode(node, counter) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var parts = child.textContent.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var outer = document.createElement('span');
          outer.className = 'w';
          var inner = document.createElement('span');
          inner.className = 'w__i';
          inner.style.setProperty('--i', counter.i++);
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        splitNode(child, counter);
      }
    });
  }

  function splitWords(el) {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    splitNode(el, { i: 0 });
  }

  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;
    items.forEach(function (el) {
      if (el.dataset.reveal === 'words') splitWords(el);
    });
    if (reduceMotion.matches) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    observe(items, function (entries, io) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  }

  function initCounters() {
    var nums = $$('[data-count]');
    if (!nums.length) return;
    observe(nums, function (entries, io) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        var el = entry.target;
        var numEl = $('.num', el) || el.firstChild;
        var target = parseFloat(el.getAttribute('data-count')) || 0;
        if (reduceMotion.matches) { numEl.textContent = String(target); return; }
        numEl.textContent = '0';
        var start = null;
        var dur = 1400;
        function step(t) {
          if (!start) start = t;
          var p = clamp((t - start) / dur, 0, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          numEl.textContent = String(Math.round(target * eased));
          if (p < 1 && alive) window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.2 });
  }

  function initHeroTitle() {
    var title = $('.hero__title[data-fit]');
    if (!title) return;
    var phrase = title.getAttribute('data-fit');
    var small = window.matchMedia('(max-width: 479px)');

    function apply() {
      title.style.fontSize = '';
      if (!small.matches || !phrase) return;
      var fs = parseFloat(window.getComputedStyle(title).fontSize);
      var probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.textContent = phrase;
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;';
      title.appendChild(probe);
      var w = probe.getBoundingClientRect().width;
      title.removeChild(probe);
      var box = title.closest('.hero__copy') || title.parentElement;
      var avail = box ? box.clientWidth : title.clientWidth;
      if (w > 0 && avail > 0 && fs > 0) {
        var size = Math.max(32, Math.floor(fs * avail / w * 0.99));
        title.style.fontSize = size + 'px';
      }
    }

    apply();
    on(window, 'resize', apply);
    on(small, 'change', apply);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (alive) apply(); });
  }

  function initCursor() {
    if (!finePointer.matches || reduceMotion.matches) return;
    var isEn = root.getAttribute('lang') === 'en';
    var cursor = $('.cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.className = 'cursor';
      cursor.setAttribute('aria-hidden', 'true');
      cursor.innerHTML =
        '<canvas class="cursor__air"></canvas>' +
        '<div class="cursor__halo"><span>' + (isEn ? 'View' : 'Смотреть') + '</span></div>' +
        '<div class="cursor__dot"></div>';
      document.body.appendChild(cursor);
    }
    root.classList.toggle('has-cursor', deskMq.matches);

    var canvas = $('.cursor__air', cursor);
    var ctx = canvas ? canvas.getContext('2d') : null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resizeCanvas() {
      if (!canvas) return;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    on(window, 'resize', resizeCanvas);

    var dot = $('.cursor__dot', cursor);
    var halo = $('.cursor__halo', cursor);
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var pmx = mx, pmy = my;
    var dx = mx, dy = my, hx = mx, hy = my;
    var angle = 0;

    var gusts = [];
    var rings = [];

    function syncCursor() {
      var desk = deskMq.matches;
      root.classList.toggle('has-cursor', desk);
      if (!desk) {
        cursor.classList.remove('is-on', 'is-hover', 'is-view', 'is-down');
        gusts.length = 0;
        rings.length = 0;
        if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }
    on(deskMq, 'change', syncCursor);
    syncCursor();

    function hideCursor() { cursor.classList.remove('is-on', 'is-down'); }

    function spawnGust(x, y, vx, vy, speed) {
      if (gusts.length > 70) return;
      var nx = -vy / (speed || 1);
      var ny = vx / (speed || 1);
      var side = Math.random() > 0.5 ? 1 : -1;
      var spread = (8 + Math.random() * 18) * side;
      gusts.push({
        x: x + nx * spread * 0.35,
        y: y + ny * spread * 0.35,
        vx: nx * side * (1.2 + speed * 0.09) - vx * 0.08 + (Math.random() - 0.5) * 0.8,
        vy: ny * side * (1.2 + speed * 0.09) - vy * 0.08 + (Math.random() - 0.5) * 0.8,
        len: clamp(10 + speed * 0.55, 12, 38),
        life: 1,
        decay: 0.032 + Math.random() * 0.02,
        hue: '242,107,78'
      });
    }

    function spawnRing(x, y, maxR, alpha) {
      if (rings.length > 8) return;
      rings.push({ x: x, y: y, r: 10, maxR: maxR || 76, alpha: alpha || 0.45 });
    }

    on(window, 'mousemove', function (e) {
      if (!deskMq.matches) return;
      mx = e.clientX;
      my = e.clientY;
      cursor.classList.add('is-on');
      var vx = mx - pmx;
      var vy = my - pmy;
      var speed = Math.hypot(vx, vy);
      pmx = mx;
      pmy = my;
      if (speed > 3) {
        var count = speed > 28 ? 3 : speed > 12 ? 2 : 1;
        for (var i = 0; i < count; i++) spawnGust(mx, my, vx, vy, speed);
      }
      if (speed > 42) {
        spawnRing(mx, my, clamp(speed * 1.35, 54, 110), 0.32);
      }
    }, { passive: true });

    on(document, 'mouseleave', hideCursor);
    on(root, 'mouseleave', hideCursor);
    on(document, 'mouseout', function (e) { if (!e.relatedTarget) hideCursor(); });
    on(window, 'blur', hideCursor);
    on(window, 'mousedown', function () {
      if (!deskMq.matches) return;
      cursor.classList.add('is-down');
      spawnRing(mx, my, 84, 0.55);
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 * i) / 8;
        spawnGust(mx, my, Math.cos(a) * 18, Math.sin(a) * 18, 22);
      }
    });
    on(window, 'mouseup', function () { cursor.classList.remove('is-down'); });

    on(document, 'mouseover', function (e) {
      if (!deskMq.matches) return;
      var view = e.target.closest('.case');
      var hover = e.target.closest('a, button, [data-cursor], .lang, .faq__q, .step, .rev-nav');
      if (hover && !cursor.classList.contains('is-hover')) {
        spawnRing(mx, my, 64, 0.36);
      }
      cursor.classList.toggle('is-view', !!view);
      cursor.classList.toggle('is-hover', !!hover && !view);
    });

    loop(function () {
      if (!deskMq.matches) return;
      dx = lerp(dx, mx, 0.82);
      dy = lerp(dy, my, 0.82);
      var prevHx = hx, prevHy = hy;
      hx = lerp(hx, mx, 0.42);
      hy = lerp(hy, my, 0.42);

      var vx = hx - prevHx;
      var vy = hy - prevHy;
      var speed = Math.hypot(vx, vy);
      if (speed > 0.4) {
        angle = Math.atan2(vy, vx) * (180 / Math.PI);
      }
      var isView = cursor.classList.contains('is-view');
      var isHover = cursor.classList.contains('is-hover');
      var stretch = isView ? 1 : clamp(1 + speed * 0.022, 1, 1.48);
      var squeeze = isView ? 1 : clamp(1 - speed * 0.01, 0.76, 1);

      dot.style.transform =
        'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)' +
        (isHover ? ' scale(1.15)' : isView ? ' scale(0)' : '');

      halo.style.transform =
        'translate3d(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px,0) ' +
        'rotate(' + angle.toFixed(1) + 'deg) ' +
        'scale(' + stretch.toFixed(3) + ',' + squeeze.toFixed(3) + ') ' +
        'rotate(' + (-angle).toFixed(1) + 'deg)';

      if (!ctx) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (var i = gusts.length - 1; i >= 0; i--) {
        var g = gusts[i];
        g.x += g.vx;
        g.y += g.vy;
        g.vx *= 0.94;
        g.vy *= 0.94;
        g.life -= g.decay;
        if (g.life <= 0) {
          gusts.splice(i, 1);
          continue;
        }
        var sp = Math.hypot(g.vx, g.vy) || 1;
        var tx = g.x - (g.vx / sp) * g.len * g.life;
        var ty = g.y - (g.vy / sp) * g.len * g.life;
        var grad = ctx.createLinearGradient(tx, ty, g.x, g.y);
        grad.addColorStop(0, 'rgba(' + g.hue + ',0)');
        grad.addColorStop(1, 'rgba(' + g.hue + ',' + (g.life * 0.42).toFixed(3) + ')');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6 * g.life;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(g.x, g.y);
        ctx.stroke();
      }

      for (var j = rings.length - 1; j >= 0; j--) {
        var rg = rings[j];
        rg.r = lerp(rg.r, rg.maxR, 0.16);
        rg.alpha *= 0.9;
        if (rg.alpha < 0.015) {
          rings.splice(j, 1);
          continue;
        }
        ctx.strokeStyle = 'rgba(242,107,78,' + rg.alpha.toFixed(3) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  function initMagnetic() {
    if (!finePointer.matches || reduceMotion.matches) return;
    $$('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 0.25;
      on(el, 'mousemove', function (e) {
        if (!deskMq.matches) return;
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength;
        var y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transition = 'transform .25s ease-out';
        el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      on(el, 'mouseleave', function () {
        el.style.transition = 'transform .7s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
      });
    });
  }

  function initHero() {
    var hero = $('.hero');
    if (!hero || reduceMotion.matches) return;
    var layers = $$('[data-parallax]', hero);
    var tilt = $('[data-tilt]', hero);
    var tx = 0, ty = 0, cx = 0, cy = 0;

    on(window, 'mousemove', function (e) {
      if (!deskMq.matches) { tx = 0; ty = 0; return; }
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    loop(function () {
      cx = lerp(cx, tx, 0.06);
      cy = lerp(cy, ty, 0.06);
      layers.forEach(function (layer) {
        var k = parseFloat(layer.getAttribute('data-parallax')) || 0.04;
        layer.style.transform = 'translate3d(' + (cx * k * 100) + 'px,' + (cy * k * 100) + 'px,0)';
      });
      if (tilt) {
        tilt.style.setProperty('--ry', (cx * 5).toFixed(2) + 'deg');
        tilt.style.setProperty('--rx', (-cy * 4).toFixed(2) + 'deg');
        tilt.style.setProperty('--px', cx.toFixed(3));
        tilt.style.setProperty('--py', cy.toFixed(3));
      }
    });
  }

  function initTiltBlocks() {
    if (!finePointer.matches || reduceMotion.matches) return;
    $$('[data-tilt-local]').forEach(function (el) {
      on(el, 'mousemove', function (e) {
        if (!deskMq.matches) return;
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', (px * 8).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
        el.style.setProperty('--px', px.toFixed(3));
        el.style.setProperty('--py', py.toFixed(3));
      });
      on(el, 'mouseleave', function () {
        ['--rx', '--ry', '--px', '--py'].forEach(function (v) { el.style.removeProperty(v); });
      });
    });
  }

  function initMarquee() {
    var marquee = $('.marquee');
    if (!marquee) return;
    var track = $('.marquee__track', marquee);
    var set = $('.marquee__set', track);
    if (!track || !set) return;

    for (var i = 0; i < 3; i++) track.appendChild(set.cloneNode(true));
    $$('.marquee__set', track).forEach(function (s, idx) { if (idx > 0) s.setAttribute('aria-hidden', 'true'); });

    var DIRECTION = -1;
    var SPEED = reduceMotion.matches ? 0 : 0.9;

    var setWidth = 0;
    var x = 0;
    var started = false;

    function wrap() {
      if (setWidth <= 0) return;
      while (x >= 0) x -= setWidth;
      while (x < -setWidth) x += setWidth;
    }

    function measure() {
      var w = set.getBoundingClientRect().width;
      if (!w) return;
      setWidth = w;
      if (!started) { x = -setWidth; started = true; }
      wrap();
    }

    measure();
    on(window, 'resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (alive) measure(); });

    var hovered = false;
    var velocity = SPEED;
    on(marquee, 'mouseenter', function () { hovered = true; });
    on(marquee, 'mouseleave', function () { hovered = false; });

    var lastT = 0;
    loop(function (t) {
      var dt = lastT ? Math.min((t - lastT) / 16.67, 3) : 1;
      lastT = t;
      if (!started) { measure(); if (!started) return; }
      velocity = lerp(velocity, hovered ? SPEED * 0.25 : SPEED, 0.06);
      x += DIRECTION * velocity * dt;
      wrap();
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    });
  }

  function initPath() {
    var sec = $('.path');
    if (!sec) return;
    var list = $('.path__list', sec);
    var items = $$('.path__item', sec);
    var photos = $$('[data-photo]', sec);
    var fill = $('.path__fill', sec);
    var yearOuts = $$('[data-current-year]', sec);
    var bars = $$('.path__sticky-bar i', sec);
    var media = $('.path__media', sec);
    var wrap = $('.path__wrap', sec);
    var card = $('.path__card', sec);
    var dots = $$('.path__dot', sec);
    var compact = window.matchMedia('(max-width: 1179px)');
    var active = -1;

    function setActive(i) {
      if (i === active || !items[i]) return;
      active = i;
      var year = items[i].getAttribute('data-year');
      items.forEach(function (it, k) { it.classList.toggle('is-active', k === i); });
      photos.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-photo') === year); });
      yearOuts.forEach(function (el) { el.textContent = year; });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
      sec.setAttribute('data-state', items[i].getAttribute('data-state') || '');
    }

    function updateCompact() {
      var stick = parseFloat(window.getComputedStyle(card).top) || 0;
      var dist = wrap.offsetHeight - card.offsetHeight;
      var prog = clamp((stick - wrap.getBoundingClientRect().top) / ((dist * 0.92) || 1), 0, 1);
      if (fill) fill.style.transform = '';
      if (lineEl) lineEl.style.setProperty('--p', prog.toFixed(4));
      var pos = prog * ((items.length - 1) || 1);
      var idx = 0;
      items.forEach(function (it, i) {
        var passed = pos >= i - 0.001;
        it.classList.toggle('is-passed', passed);
        if (dots[i]) dots[i].classList.toggle('is-passed', passed);
        if (passed) idx = i;
      });
      setActive(idx);
    }

    var lineEl = $('.path__line', sec);
    var ticking = false;
    function update() {
      ticking = false;
      if (compact.matches && wrap && card) { updateCompact(); return; }
      var r = (lineEl || list).getBoundingClientRect();
      var focus = window.innerHeight * 0.5;
      var progress = clamp((focus - r.top) / (r.height || 1), 0, 1);
      if (fill) fill.style.transform = 'scaleY(' + progress.toFixed(4) + ')';
      bars.forEach(function (b) { b.style.setProperty('--p', progress.toFixed(4)); });

      var lineTipY = r.top + r.height * progress;

      var idx = 0;
      for (var i = 0; i < items.length; i++) {
        var yearEl = $('.path__year', items[i]);
        var yr = (yearEl || items[i]).getBoundingClientRect();
        var dotCenterY = yr.top + yr.height * 0.5;
        var passed = lineTipY >= dotCenterY - 2;
        items[i].classList.toggle('is-passed', passed);
        if (passed) idx = i;
      }
      setActive(idx);
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    on(window, 'scroll', onScroll, { passive: true });
    on(window, 'resize', onScroll);
    update();

    if (media && finePointer.matches && !reduceMotion.matches) {
      var tx = 0, ty = 0, cx = 0, cy = 0;
      on(media, 'mousemove', function (e) {
        if (!deskMq.matches) { tx = 0; ty = 0; return; }
        var mr = media.getBoundingClientRect();
        tx = ((e.clientX - mr.left) / mr.width - 0.5) * 2;
        ty = ((e.clientY - mr.top) / mr.height - 0.5) * 2;
      }, { passive: true });
      on(media, 'mouseleave', function () {
        tx = 0;
        ty = 0;
      });
      loop(function () {
        cx = lerp(cx, tx, 0.06);
        cy = lerp(cy, ty, 0.06);
        media.style.setProperty('--ry', (cx * 5).toFixed(2) + 'deg');
        media.style.setProperty('--rx', (-cy * 4).toFixed(2) + 'deg');
        media.style.setProperty('--px', cx.toFixed(3));
        media.style.setProperty('--py', cy.toFixed(3));
      });
    }
  }

  function initServices() {
  }

  function initCases() {
    var grid = $('.cases__grid');
    if (!grid) return;
    var cards = $$('.case', grid);
    var cols = $$('.cases__col', grid);

    cards.forEach(function (card, i) {
      var rot = [-2.2, 1.6, -1.2, 2.4, -1.8, 1.2, -2.6, 1.9, -1.4][i % 9];
      card.style.setProperty('--rot', rot + 'deg');
      card.setAttribute('tabindex', '0');
    });

    if (finePointer.matches && !reduceMotion.matches) {
      cards.forEach(function (card) {
        on(card, 'mousemove', function (e) {
          if (!deskMq.matches) return;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          card.classList.add('is-tilting');
          card.style.setProperty('--rot', '0deg');
          card.style.setProperty('--ry', (px * 12).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (-py * 12).toFixed(2) + 'deg');
          card.style.setProperty('--px', px.toFixed(3));
          card.style.setProperty('--py', py.toFixed(3));
        });
        on(card, 'mouseleave', function () {
          card.classList.remove('is-tilting');
          var i = cards.indexOf(card);
          var rot = [-2.2, 1.6, -1.2, 2.4, -1.8, 1.2, -2.6, 1.9, -1.4][i % 9];
          card.style.setProperty('--rot', rot + 'deg');
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
          card.style.setProperty('--px', '0');
          card.style.setProperty('--py', '0');
        });
      });
    }

    var wide = window.matchMedia('(min-width: 1180px)');
    function alignBottoms() {
      var lasts = cols.map(function (col) { return col.lastElementChild; });
      lasts.forEach(function (card) { card.style.height = ''; card.style.aspectRatio = ''; });
      if (!wide.matches) return;
      var bottoms = cols.map(function (col) { return col.offsetTop + col.offsetHeight; });
      var target = Math.max.apply(null, bottoms);
      cols.forEach(function (col, i) {
        var extra = target - bottoms[i];
        if (extra < 0.5) return;
        var h = lasts[i].offsetHeight + extra;
        lasts[i].style.aspectRatio = 'auto';
        lasts[i].style.height = h + 'px';
      });
    }
    alignBottoms();
    on(window, 'resize', alignBottoms);
    on(window, 'load', alignBottoms);

    if (reduceMotion.matches) return;
    var speeds = [0.05, -0.07, 0.03];
    var current = [0, 0, 0];
    loop(function () {
      if (window.innerWidth < 1180) {
        cols.forEach(function (c) { c.style.transform = ''; });
        return;
      }
      var r = grid.getBoundingClientRect();
      var offset = (r.top + r.height / 2) - window.innerHeight / 2;
      var rest = window.innerHeight * 0.3 - r.height / 2;
      offset = Math.max(offset - rest, 0);
      cols.forEach(function (col, i) {
        var target = offset * speeds[i % speeds.length];
        current[i] = lerp(current[i], target, 0.08);
        col.style.transform = 'translate3d(0,' + current[i].toFixed(2) + 'px,0)';
      });
    });
  }

  function initFaq() {
    var items = $$('.faq__item');
    if (!items.length) return;
    var buttons = items.map(function (item) { return $('.faq__q', item); });

    function setOpen(index, open) {
      var item = items[index];
      var btn = buttons[index];
      var panel = $('.faq__a', item);
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (panel) panel.setAttribute('aria-hidden', String(!open));
    }

    items.forEach(function (item, i) {
      var btn = buttons[i];
      var panel = $('.faq__a', item);
      var id = 'faq-panel-' + (i + 1);
      if (panel) {
        panel.id = id;
        btn.setAttribute('aria-controls', id);
      }
      setOpen(i, item.classList.contains('is-open'));

      on(btn, 'click', function () {
        var willOpen = !item.classList.contains('is-open');
        items.forEach(function (_, k) { setOpen(k, false); });
        if (willOpen) setOpen(i, true);
      });

      on(btn, 'keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowDown') next = buttons[(i + 1) % buttons.length];
        if (e.key === 'ArrowUp') next = buttons[(i - 1 + buttons.length) % buttons.length];
        if (e.key === 'Home') next = buttons[0];
        if (e.key === 'End') next = buttons[buttons.length - 1];
        if (next) { e.preventDefault(); next.focus(); }
      });
    });
  }

  function initReviews() {
    var track = $('.reviews__grid');
    var prev = $('.rev-nav--prev');
    var next = $('.rev-nav--next');
    if (!track || !prev || !next) return;
    var cards = $$('.rev-card', track);
    if (!cards.length) return;

    function step() {
      return cards.length > 1
        ? cards[1].offsetLeft - cards[0].offsetLeft
        : cards[0].offsetWidth;
    }

    function update() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    }

    function go(dir) {
      track.scrollBy({ left: dir * step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    var ticking = false;
    on(track, 'scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    on(window, 'resize', update);
    on(prev, 'click', function () { go(-1); });
    on(next, 'click', function () { go(1); });
    on(track, 'keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });

    update();
  }

  function initFooterName() {
    var name = $('.foot__name');
    if (!name) return;

    if (!name.dataset.split) {
      name.dataset.split = '1';
      var text = name.textContent.trim();
      name.textContent = '';
      var index = 0;
      text.split(/\s+/).forEach(function (word, w, arr) {
        var wordEl = document.createElement('span');
        wordEl.className = 'word';
        wordEl.setAttribute('aria-hidden', 'true');
        word.split('').forEach(function (ch) {
          var outer = document.createElement('span');
          outer.className = 'ch';
          var glyph = document.createElement('span');
          glyph.className = 'ch__g';
          glyph.textContent = ch;
          outer.style.setProperty('--rot', ((index % 2 ? -1 : 1) * (4 + (index % 3) * 2)) + 'deg');
          index++;
          outer.appendChild(glyph);
          wordEl.appendChild(outer);
        });
        name.appendChild(wordEl);
        if (w < arr.length - 1) name.appendChild(document.createTextNode(' '));
      });
    }

    function fit() {
      name.style.fontSize = '';
      var words = $$('.word', name);
      if (!words.length) return;
      var avail = name.clientWidth;
      var need = words[words.length - 1].getBoundingClientRect().right - words[0].getBoundingClientRect().left;
      if (need > avail) {
        var fs = parseFloat(window.getComputedStyle(name).fontSize);
        name.style.fontSize = (fs * avail / need * 0.99).toFixed(2) + 'px';
      }
    }

    var canvas = null;
    function measureInk() {
      var cs = window.getComputedStyle(name);
      canvas = canvas || document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var m = ctx.measureText(name.getAttribute('aria-label') || 'Artem Punin');
      if (m.fontBoundingBoxAscent === undefined) return;
      var fs = parseFloat(cs.fontSize);
      var line = parseFloat(cs.lineHeight);
      if (isNaN(line)) line = fs * 1.2;
      var baseline = (line - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      name.style.setProperty('--ink-top', (baseline - m.actualBoundingBoxAscent).toFixed(2) + 'px');
      name.style.setProperty('--ink-bot', (line - baseline - m.actualBoundingBoxDescent).toFixed(2) + 'px');
    }

    function refresh() { fit(); measureInk(); }
    refresh();
    on(window, 'resize', refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (alive) refresh(); });

    on(name, 'mouseover', function (e) {
      var ch = e.target.closest('.ch');
      if (!ch || ch.contains(e.relatedTarget)) return;
      var sign = Math.random() < 0.5 ? -1 : 1;
      ch.style.setProperty('--rot', (sign * (4 + Math.random() * 6)).toFixed(1) + 'deg');
    });
  }

  function initFooterCta() {
    var text = $('.foot__text');
    var circle = $('.foot__circle');
    if (!text || !circle) return;
    var wide = window.matchMedia('(min-width: 768px)');

    function sync() {
      if (!wide.matches) { circle.style.removeProperty('--foot-circle'); return; }
      var h = text.getBoundingClientRect().height;
      if (h > 0) circle.style.setProperty('--foot-circle', h.toFixed(2) + 'px');
    }

    sync();
    on(window, 'resize', sync);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(sync);
      ro.observe(text);
      observers.push(ro);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (alive) sync(); });
  }

  function initPolicy() {
    var modal = $('.policy');
    if (!modal) return;
    var panel = $('.policy__panel', modal);
    var closeBtn = $('.policy__close', modal);
    var opener = null;

    function open(from) {
      opener = from || null;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      root.classList.add('modal-open');
      later(function () { if (closeBtn) closeBtn.focus(); }, 30);
    }

    function close() {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      root.classList.remove('modal-open');
      if (opener && opener.focus) opener.focus();
    }

    on(document, 'click', function (e) {
      var o = e.target.closest('[data-policy-open]');
      if (o) { e.preventDefault(); open(o); return; }
      if (e.target.closest('[data-policy-close]')) close();
    });

    on(document, 'keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var items = $$('a[href], button:not([disabled])', panel);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function initAnchors() {
    on(document, 'click', function (e) {
      var a = e.target.closest('a[href="#top"]');
      if (!a) return;
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });
  }

  function initCopyright() {
    var next = new Date().getFullYear() + 1;
    $$('[data-copy-years]').forEach(function (el) {
      var start = parseInt(el.getAttribute('data-copy-years'), 10);
      if (!start) return;
      el.textContent = next > start ? start + '–' + next : String(start);
    });
  }

  function initIcons() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    var iconLink = $('link[rel="icon"]');
    var base = iconLink ? (iconLink.getAttribute('href') || '').replace(/icon\.svg.*$/, '') : '';
    [
      { rel: 'manifest', file: 'site.webmanifest' },
      { rel: 'apple-touch-icon', file: 'apple-touch-icon.png' }
    ].forEach(function (item) {
      if (document.querySelector('link[rel="' + item.rel + '"]')) return;
      var link = document.createElement('link');
      link.rel = item.rel;
      link.href = base + item.file;
      document.head.appendChild(link);
    });
  }

  function init() {
    if (alive) destroy();
    ctrl = new AbortController();
    alive = true;

    initLang();
    initHeader();
    initMenu();
    initStubs();
    initReveal();
    initCounters();
    initHeroTitle();
    initCursor();
    initMagnetic();
    initHero();
    initTiltBlocks();
    initMarquee();
    initPath();
    initServices();
    initCases();
    initFaq();
    initReviews();
    initFooterName();
    initFooterCta();
    initPolicy();
    initAnchors();
    initCopyright();
    initIcons();
  }

  function destroy() {
    alive = false;
    if (ctrl) ctrl.abort();
    observers.forEach(function (io) { io.disconnect(); });
    observers = [];
    timers.forEach(function (id) { window.clearTimeout(id); });
    timers = [];
    root.classList.remove('menu-open');
    root.classList.remove('modal-open');
    var cursor = $('.cursor');
    if (cursor) cursor.remove();
    var toast = $('.toast');
    if (toast) toast.remove();
    root.classList.remove('has-cursor');
  }

  window.ArtemSite = { init: init, destroy: destroy };

  if (document.currentScript) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
