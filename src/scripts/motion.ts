// Scroll and pointer animations (GSAP + Lenis). The page is fully readable
// without this file; it only adds motion on top.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { playIntro } from './intro';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * Runs set-up for things below the first screen in its own idle moment, so start-up is a
 * series of short tasks instead of one long one. (It all finishes during the intro.)
 */
const later = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(() => fn(), { timeout: 1500 }) : setTimeout(fn, 50));
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  [...root.querySelectorAll<T>(selector)];

// Cursor-following light on cards. Works without motion too.
for (const el of $$('.spotlight')) {
  el.addEventListener('pointermove', (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
}

if (!reduceMotion) {
  // Smooth scrolling, driven by GSAP's ticker so scroll animations stay in sync.
  const lenis = new Lenis({ autoRaf: false, anchors: { offset: -88 }, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // No scrolling while the name flies in. (No re-measure needed after: scrollbar-gutter keeps
  // the width steady, and ScrollTrigger already re-measures on load and resize.)
  lenis.stop();
  playIntro(() => lenis.start());

  later(() => {
    // Headings rise word by word out of a mask (words are split at build time).
    for (const heading of $$('[data-split]')) {
      const words = $$('.split-inner', heading);
      gsap.set(words, { yPercent: 115, rotate: 4 });
      ScrollTrigger.create({
        trigger: heading,
        start: 'top 88%',
        once: true,
        onEnter: () => gsap.to(words, { yPercent: 0, rotate: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07 }),
      });
    }
  });

  later(() => {
    // Everything else fades up in batches as it scrolls into view.
    gsap.set('[data-reveal]', { autoAlpha: 0, y: 48 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09, overwrite: 'auto' }),
    });
  });

  // Hero drifts up and fades as you leave it.
  const hero = document.querySelector('[data-scene="hero"]');
  const heroContent = hero?.querySelector('[data-hero-content]');
  if (hero && heroContent) {
    gsap.to(heroContent, {
      yPercent: -22,
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  later(() => {
    // Project screenshots swing from tilted to flat as they scroll in.
    $$('[data-frame]').forEach((frame, i) => {
      const dir = i % 2 ? -1 : 1;
      gsap.fromTo(
        frame,
        { rotationX: 26, rotationY: -14 * dir, scale: 0.86, transformPerspective: 1400, transformOrigin: '50% 100%' },
        {
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: frame, start: 'top 98%', end: 'top 30%', scrub: 0.8 },
        },
      );
      const img = frame.querySelector('img');
      if (img) {
        gsap.fromTo(
          img,
          { yPercent: -5, scale: 1.12 },
          { yPercent: 5, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } },
        );
      }
    });
  });

  // Reading progress bar.
  gsap.to('[data-scroll-progress]', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  });

  later(() => {
    // Experience: the rail fills as you scroll through the projects, lighting each one's node;
    // the timeline bar on the company card fills once as it comes into view.
    for (const rail of $$('[data-exp-rail]')) {
      const fill = rail.querySelector('[data-exp-rail-fill]');
      if (fill) {
        gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: rail, start: 'top 65%', end: 'bottom 65%', scrub: 0.6 } });
      }
      const entries = $$('[data-exp-entry]', rail);
      entries.forEach((entry, i) => {
        ScrollTrigger.create({ trigger: entry, start: 'top 65%', toggleClass: 'is-lit' });
        // Stacking: while the next card slides over this one, this one shrinks a little, dims,
        // and is trimmed to end just below the next card, so none of its content shows beneath
        // a shorter card (only a thin edge, like a deck).
        const next = entries[i + 1];
        const card = entry.querySelector<HTMLElement>('.exp-card');
        const nextCard = next?.querySelector<HTMLElement>('.exp-card');
        if (!next || !card || !nextCard) return;
        const scale = 0.92;
        const edge = 14; // px of this card left showing below the next one
        const trimmed = () => {
          const top = parseFloat(getComputedStyle(entry).top);
          const nextBottom = parseFloat(getComputedStyle(next).top) + nextCard.offsetHeight;
          const keep = (nextBottom + edge - top) / scale;
          return `inset(0px 0px ${Math.max(0, card.offsetHeight - keep)}px 0px round 24px)`;
        };
        gsap
          .timeline({
            scrollTrigger: {
              trigger: next,
              start: 'top bottom',
              end: () => `top ${parseFloat(getComputedStyle(next).top) || 96}px`,
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
          .to(card, { scale, ease: 'none' }, 0)
          .fromTo(card, { clipPath: 'inset(0px 0px 0px 0px round 24px)' }, { clipPath: trimmed, ease: 'none' }, 0)
          .to(entry.querySelector('.exp-dim'), { opacity: 1, ease: 'none' }, 0);
      });
    }
    for (const fill of $$('[data-exp-fill]')) {
      gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: fill, start: 'top 90%', once: true } });
    }
  });

  later(() => {
    // Marquee rows lean with scroll speed.
    const rows = $$('[data-marquee]');
    if (rows.length) {
      const skew = gsap.quickTo(rows, 'skewX', { duration: 0.5, ease: 'power3' });
      ScrollTrigger.create({ onUpdate: (self) => skew(gsap.utils.clamp(-10, 10, self.getVelocity() / -250)) });
    }
  });

  later(() => {
    // Giant name in the footer rises letter by letter.
    for (const name of $$('[data-giant-name]')) {
      gsap.from($$('span', name), {
        yPercent: 105,
        ease: 'none',
        stagger: 0.04,
        scrollTrigger: { trigger: name, start: 'top bottom', end: 'bottom bottom', scrub: 1 },
      });
    }
  });
}

if (!reduceMotion && finePointer) {
  later(() => {
    // Buttons lean towards the cursor.
    for (const el of $$('[data-magnetic]')) {
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const rect = el.getBoundingClientRect();
        x((e.clientX - rect.left - rect.width / 2) * 0.3);
        y((e.clientY - rect.top - rect.height / 2) * 0.3);
      });
      el.addEventListener('pointerleave', () => {
        x(0);
        y(0);
      });
    }
  });

  later(() => {
    // Cards tilt in 3D towards the cursor.
    for (const el of $$('[data-tilt]')) {
      const max = Number(el.dataset.tilt) || 8;
      gsap.set(el, { transformPerspective: 1000 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        ry((px - 0.5) * max * 2);
        rx((0.5 - py) * max * 2);
        el.style.setProperty('--gx', `${px * 100}%`);
        el.style.setProperty('--gy', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
      });
    }
  });

  later(() => {
    // Cursor ring that trails the pointer and grows over interactive things.
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);
    const cx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
    const cy = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener(
      'pointermove',
      (e) => {
        cx(e.clientX);
        cy(e.clientY);
        ring.classList.add('is-visible');
      },
      { passive: true },
    );
    document.addEventListener('pointerover', (e) => {
      const target = e.target as Element;
      ring.classList.toggle('is-active', !!target.closest('a, button, [data-tilt]'));
      ring.classList.toggle('is-grab', !!target.closest('[data-skill-sphere]'));
    });
    document.documentElement.addEventListener('pointerleave', () => ring.classList.remove('is-visible'));
  });
}
