import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

$('.year').textContent = new Date().getFullYear();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ---------------- Smooth scroll ---------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#home' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView();
  }),
);

/* ---------------- 3D scene (lazy chunk) ---------------- */
let scene = null;
const scenePromise = import('./scene.js')
  .then(({ createScene }) => {
    try {
      scene = createScene($('#webgl'));
    } catch (err) {
      console.warn('WebGL unavailable, continuing without 3D', err);
      document.body.classList.add('no-webgl');
    }
  })
  .catch(() => document.body.classList.add('no-webgl'));

const parseCup = (str) => {
  const [x, y, s, tilt] = str.split(',').map(Number);
  return { x, y, s, tilt };
};
function applySection(sec) {
  const dark = sec.dataset.theme === 'dark';
  document.body.classList.toggle('dark', dark);
  scene?.setTheme(dark);
  if (!scene) return;
  const mobile = scene.isNarrow && sec.dataset.cupM;
  scene.setTarget(parseCup(mobile ? sec.dataset.cupM : sec.dataset.cup));
  if (sec.dataset.drink) scene.setDrink(sec.dataset.drink);
}

/* ---------------- Text splitting ---------------- */
function splitWords(el, cls = 'w', wrap = true) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '));
          const w = document.createElement('span');
          w.className = cls;
          if (wrap) {
            const inner = document.createElement('span');
            inner.textContent = part;
            w.appendChild(inner);
          } else w.textContent = part;
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return wrap ? $$(`.${cls} > span`, el) : $$(`.${cls}`, el);
}
const splits = new Map($$('.split').map((el) => [el, splitWords(el)]));
const manifestoWords = splitWords($('.manifesto-text'), 'mw', false);

/* ---------------- Live open / closed status ---------------- */
(function openStatus() {
  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const weekend = day === 0 || day === 6;
  const close = weekend ? 25 * 60 : 23 * 60 + 30; // 1 AM next day on weekends
  const lateNight = weekend && mins < 60; // still open after midnight
  const open = (mins >= 7 * 60 && mins < close) || lateNight;
  $('.open-status').textContent = open
    ? `Open now · closes ${weekend ? '1:00 AM' : '11:30 PM'}`
    : 'Closed now · opens 7:00 AM';
  $('.hero-eyebrow .dot').classList.toggle('closed', !open);
})();

/* ---------------- Loader ---------------- */
const countEl = $('.loader-count span');
const loaderState = { v: 0 };
const paintLoader = () => {
  countEl.textContent = Math.round(loaderState.v);
  $('.loader-bar span').style.transform = `scaleX(${loaderState.v / 100})`;
  $('.lg-fill').style.transform = `scaleY(${loaderState.v / 100})`;
};
gsap.to('.loader-name span', { y: 0, duration: 1, ease: 'expo.out', stagger: 0.12, delay: 0.1 });
gsap.to(loaderState, { v: 88, duration: 1.4, ease: 'power2.out', onUpdate: paintLoader });

const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
const minTime = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 1500));
Promise.all([scenePromise, fontsReady, minTime]).then(() => {
  gsap.to(loaderState, { v: 100, duration: 0.35, onUpdate: paintLoader, onComplete: start });
});

function start() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.loader-inner', { y: -40, opacity: 0, duration: 0.6, ease: 'power3.in' })
    .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
    .add(() => scene?.playIntro(), '-=0.7')
    .set('.loader', { display: 'none' })
    .from('.nav > *', { y: -30, opacity: 0, duration: 1, stagger: 0.06 }, '-=0.55')
    .from('.hero-eyebrow', { y: 20, opacity: 0, duration: 1 }, '<')
    .from(splits.get($('.hero-title')), { yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.1 }, '<0.1')
    .from('.hero-guj', { opacity: 0, x: 120, duration: 2 }, '<')
    .from('.hero .fade-in', { y: 30, opacity: 0, duration: 1.2, stagger: 0.1 }, '<0.4');
  lenis?.start();
  initScroll();
}

/* ---------------- Scroll choreography ---------------- */
function initScroll() {
  const mm = gsap.matchMedia();
  const labels = $$('.ing-label');

  // 1. Ingredients: pinned, ingredients burst out of the cup, labels appear
  mm.add({ desktop: '(min-width: 861px)', mobile: '(max-width: 860px)' }, (ctx) => {
    const { mobile } = ctx.conditions;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.ingredients',
        start: 'top top',
        end: '+=200%',
        pin: '.ing-pin',
        scrub: 0.6,
        onUpdate: (self) => scene?.setExplode(Math.min(1, self.progress / 0.3)),
        onLeave: () => scene?.setExplode(0),
        onLeaveBack: () => scene?.setExplode(0),
      },
    });
    tl.to({}, { duration: 0.6 }); // let the burst happen first
    if (mobile) {
      labels.forEach((l, i) => {
        tl.fromTo(l, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.5 });
        if (i < labels.length - 1) tl.to(l, { autoAlpha: 0, y: -30, duration: 0.5 }, '+=0.4');
      });
    } else {
      tl.fromTo(
        labels,
        { autoAlpha: 0, x: (i) => (i < 3 ? -70 : 70), filter: 'blur(8px)' },
        { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 1, stagger: 0.45, ease: 'power3.out' },
      );
    }
    tl.to({}, { duration: 0.6 });
  });

  // 2. Signature: pinned horizontal scroll
  const track = $('.sig-track');
  const cards = $$('.sig-card');
  const cur = $('.sig-cur');
  let activeCard = -1;
  const distance = () => track.scrollWidth - $('.sig-viewport').clientWidth;
  gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.signature',
      start: 'top top',
      end: () => '+=' + distance() * 1.1,
      pin: '.sig-pin',
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const idx = Math.min(cards.length - 1, Math.round(self.progress * (cards.length - 1)));
        $('.sig-progress span').style.transform = `scaleX(${self.progress})`;
        if (idx !== activeCard) {
          activeCard = idx;
          cards.forEach((c, i) => c.classList.toggle('active', i === idx));
          cur.textContent = String(idx + 1).padStart(2, '0');
          scene?.setDrink(cards[idx].dataset.drink);
        }
      },
      onToggle: (self) => self.isActive && activeCard >= 0 && scene?.setDrink(cards[activeCard].dataset.drink),
    },
  });

  // 3. Cup position + theme per section
  $$('[data-cup]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 45%',
      onToggle: (self) => self.isActive && applySection(sec),
    });
  });
  applySection($('.hero'));

  // 4. Headings: word mask reveal
  splits.forEach((words, el) => {
    if (el.classList.contains('hero-title')) return;
    gsap.from(words, {
      yPercent: 115,
      rotate: 3,
      duration: 1.2,
      ease: 'expo.out',
      stagger: 0.04,
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });

  // 5. Manifesto: words light up as you scroll + floating photos parallax
  gsap.to(manifestoWords, {
    opacity: 1,
    stagger: 0.08,
    ease: 'none',
    scrollTrigger: { trigger: '.manifesto-text', start: 'top 78%', end: 'bottom 42%', scrub: true },
  });
  $$('.float-img').forEach((el) => {
    const sp = parseFloat(el.dataset.speed);
    gsap.fromTo(el, { y: -sp * 260, rotate: sp * -12 }, {
      y: sp * 260,
      rotate: sp * 12,
      ease: 'none',
      scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // 6. Generic reveals
  gsap.set('.reveal', { y: 50, opacity: 0 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 90%',
    onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.1, overwrite: true }),
  });

  // 7. Counters
  $$('[data-count]').forEach((el) => {
    const obj = { v: 0 };
    gsap.to(obj, {
      v: +el.dataset.count,
      duration: 2,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%' },
      onUpdate: () => (el.textContent = Math.round(obj.v).toLocaleString('en-IN') + (el.dataset.suffix || '')),
    });
  });

  // 8. Hero parallax out
  gsap.to('.hero-inner', {
    yPercent: -18,
    opacity: 0.15,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero-guj', { xPercent: -25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // 9. Gallery: clip reveal + inner parallax
  $$('.g-item').forEach((item, i) => {
    gsap.to(item, {
      clipPath: 'inset(0% 0 0 0 round 24px)',
      duration: 1.5,
      ease: 'expo.inOut',
      delay: (i % 2) * 0.12,
      scrollTrigger: { trigger: item, start: 'top 88%' },
    });
    gsap.fromTo($('.g-inner', item), { yPercent: -8 }, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // 10. Events: sticky stacking — earlier cards shrink & dim as the next slides over
  const evCards = $$('.event-card');
  evCards.forEach((card, i) => {
    card.style.setProperty('--i', i);
    const next = evCards[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: 0.9 + i * 0.015,
      filter: 'brightness(0.6)',
      ease: 'none',
      scrollTrigger: { trigger: next, start: 'top 70%', end: 'top 18%', scrub: true },
    });
    gsap.from($('.ev-img img', next), {
      scale: 1.25,
      ease: 'none',
      scrollTrigger: { trigger: next, start: 'top 70%', end: 'top 18%', scrub: true },
    });
  });

  // 11. Footer giant name — letters wave in
  const bigSpans = $$('.footer-big span');
  gsap.from(bigSpans, {
    yPercent: 100,
    opacity: 0,
    rotate: 6,
    ease: 'expo.out',
    duration: 1.6,
    stagger: 0.12,
    scrollTrigger: { trigger: '.footer', start: 'top 55%' },
  });

  // 12. Progress bar, nav hide/show, active nav link
  const navLinks = $$('.nav-links a');
  const progressBar = $('.progress span');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      progressBar.style.transform = `scaleX(${self.progress})`;
      document.body.classList.toggle('nav-hidden', y > lastY && y > 200);
      document.body.classList.toggle('scrolled', y > 40);
      lastY = y;
      scene?.setScroll(y, self.getVelocity());
    },
  });
  navLinks.forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('active', self.isActive),
    });
  });

  ScrollTrigger.refresh();
}

/* ---------------- Crossing tapes: scroll-velocity marquee ---------------- */
(function initTapes() {
  const tapes = $$('.tape').map((tape) => {
    const track = $('.tape-track', tape);
    const set = $('.tape-set', track);
    return { tape, track, set, dir: +tape.dataset.dir, x: 0, w: 1 };
  });
  const fill = () =>
    tapes.forEach((t) => {
      while (t.track.children.length > 1) t.track.lastElementChild.remove();
      t.w = t.set.offsetWidth || 1;
      const copies = Math.ceil(t.tape.offsetWidth / t.w) + 1;
      for (let i = 0; i < copies; i++) t.track.appendChild(t.set.cloneNode(true));
      t.x = t.dir > 0 ? 0 : -t.w;
    });
  fill();
  document.fonts?.ready.then(fill);
  window.addEventListener('resize', fill);

  let lastY = window.scrollY, scrollDir = 1, boost = 0, skew = 0;
  gsap.ticker.add((time, dt) => {
    const y = window.scrollY;
    const d = y - lastY;
    lastY = y;
    if (d > 0.5) scrollDir = 1;
    else if (d < -0.5) scrollDir = -1;
    boost += (Math.min(Math.abs(d), 90) - boost) * 0.1;
    skew += ((reduceMotion ? 0 : gsap.utils.clamp(-14, 14, d * 0.35)) - skew) * 0.12;
    const speed = (reduceMotion ? 0.3 : 1.1 + boost * 0.55) * (dt / 16.67);
    tapes.forEach((t) => {
      t.x -= speed * scrollDir * t.dir;
      if (t.x <= -t.w) t.x += t.w;
      if (t.x > 0) t.x -= t.w;
      t.track.style.transform = `translate3d(${t.x}px,0,0)`;
      t.track.style.setProperty('--skew', `${-skew * t.dir}deg`);
    });
  });

  // Tapes swing a little as they pass through the viewport
  ScrollTrigger.create({
    trigger: '.tapes',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const r = (self.progress - 0.5) * 5;
      tapes[0].tape.style.setProperty('--r', `${-r}deg`);
      tapes[1].tape.style.setProperty('--r', `${r}deg`);
    },
  });
})();

/* ---------------- Menu tabs with sliding pill ---------------- */
const items = $$('.menu-item');
const pill = $('.tab-pill');
function movePill(tab) {
  pill.style.width = tab.offsetWidth + 'px';
  pill.style.transform = `translateX(${tab.offsetLeft}px)`;
}
function filterMenu(cat) {
  items.forEach((it) => it.classList.toggle('hidden', it.dataset.cat !== cat));
  const visible = items.filter((it) => it.dataset.cat === cat);
  gsap.fromTo(visible, { y: 30, opacity: 0, rotateX: -20 }, { y: 0, opacity: 1, rotateX: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
  ScrollTrigger.refresh();
}
$$('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab);
    });
    movePill(tab);
    filterMenu(tab.dataset.filter);
  }),
);
items.forEach((it) => it.classList.toggle('hidden', it.dataset.cat !== 'chai'));
const placePill = () => movePill($('.tab.active'));
document.fonts?.ready.then(placePill);
window.addEventListener('resize', placePill);
placePill();

/* ---------------- FAQ accordion (animated) ---------------- */
$$('.faq-item').forEach((d) => {
  const summary = $('summary', d);
  const body = $('.faq-body', d);
  summary.addEventListener('click', (e) => {
    e.preventDefault();
    if (d.open) {
      gsap.to(body, { height: 0, duration: 0.5, ease: 'expo.inOut', onComplete: () => { d.open = false; ScrollTrigger.refresh(); } });
    } else {
      d.open = true;
      gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.7, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
    }
  });
});

/* ---------------- Shop bag + toast ---------------- */
let bagCount = 0;
const toast = $('.toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
$$('.add-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    bagCount++;
    $('.bag-count').textContent = bagCount;
    gsap.fromTo('.bag', { scale: 1.35, rotate: -12 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    btn.textContent = 'Added ✓';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = 'Add +'; btn.classList.remove('added'); }, 1600);
    showToast(`${btn.dataset.item} added to your bag ☕`);
  }),
);
$('.bag').addEventListener('click', () =>
  showToast(bagCount ? `${bagCount} item${bagCount > 1 ? 's' : ''} in your bag — checkout coming soon` : 'Your bag is empty — visit the shop below'),
);

/* ---------------- Mobile menu ---------------- */
const burger = $('.burger');
function closeMenu() {
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  $('.mobile-menu').setAttribute('aria-hidden', 'true');
}
burger.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded', open);
  $('.mobile-menu').setAttribute('aria-hidden', !open);
  if (open) gsap.from('.mobile-menu a', { y: 60, opacity: 0, stagger: 0.06, duration: 0.8, ease: 'expo.out' });
});

/* ---------------- Reservation form (front-end only) ---------------- */
const form = $('.reserve');
$('#r-date').min = new Date().toISOString().split('T')[0];
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('.form-msg');
  if (!form.checkValidity()) {
    msg.textContent = 'Please fill in your name, phone, date and time.';
    msg.className = 'form-msg error';
    form.querySelector(':invalid')?.focus();
    gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  msg.textContent = `Thanks ${data.name.split(' ')[0]}! Table for ${data.guests} requested — we’ll text you a confirmation shortly.`;
  msg.className = 'form-msg success';
  form.reset();
});

/* ---------------- Pointer: cursor, magnetic, tilt ---------------- */
window.addEventListener('pointermove', (e) => {
  scene?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
});

if (finePointer && !reduceMotion) {
  document.body.classList.add('has-cursor');
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  const label = $('.cursor-label');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.1 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.1 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
  document.addEventListener('pointerover', (e) => {
    const txt = e.target.closest('[data-cursor]');
    const hit = e.target.closest('a, button, .tab, label, input, summary, .sig-card, .product');
    document.body.classList.toggle('cursor-text', !!txt);
    document.body.classList.toggle('cursor-hover', !!hit && !txt);
    label.textContent = txt ? txt.dataset.cursor : '';
  });

  $$('.magnetic').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.3);
      my((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });

  $$('.sig-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      gsap.to(card, {
        rotateY: ((e.clientX - r.left) / r.width - 0.5) * 10,
        rotateX: -((e.clientY - r.top) / r.height - 0.5) * 10,
        duration: 0.5,
        ease: 'power2.out',
      });
    });
    card.addEventListener('pointerleave', () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.8, ease: 'expo.out' }));
  });
}
