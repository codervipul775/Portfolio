import { gsap } from 'gsap';

/**
 * The opening: the giant name (components/Intro.astro) flies into the nav and
 * becomes the logo. Classes on <html> drive the rest of the page:
 * `intro-landing` (flight starts: nav and hero animate in) and `intro-done`.
 */
export function playIntro(onDone: () => void) {
  const root = document.documentElement;
  const name = document.querySelector<HTMLElement>('[data-intro-name]');
  const logo = document.querySelector<HTMLElement>('[data-nav-logo]');
  const inputs = new AbortController();
  const finish = () => {
    inputs.abort();
    root.classList.add('intro-landing', 'intro-done');
    onDone();
  };

  if (!root.classList.contains('has-intro') || root.classList.contains('intro-done') || !name || !logo) return finish();

  // Measure with the real font, or the landing spot is off.
  document.fonts.ready.then(() => {
    if (root.classList.contains('intro-done')) return finish(); // the safety timer already showed the page

    const from = name.getBoundingClientRect();
    const to = logo.getBoundingClientRect();
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const shrink = Math.log(to.width / from.width);
    const flight = { t: 0 };
    name.style.transformOrigin = '0 0';

    const timeline = gsap.timeline({
      // Hold the full-screen name until the letters have risen (~1.6s after navigation).
      delay: Math.max(0, 1.6 - performance.now() / 1000),
      onComplete: finish,
    });
    timeline
      .to(flight, {
        t: 1,
        duration: 2,
        ease: 'sine.inOut',
        onUpdate: () => {
          // Shrink on a log scale: the size drops at a steady visible rate
          // instead of collapsing in the last moments.
          const { t } = flight;
          name.style.transform = `translate(${dx * t}px, ${dy * t}px) scale(${Math.exp(shrink * t)})`;
        },
      })
      // Bring in the nav and hero once the name has cleared the middle of the screen.
      .call(() => root.classList.add('intro-landing'), [], 0.75);

    // Any input skips to the end.
    for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart']) {
      addEventListener(type, () => timeline.progress(1), { once: true, passive: true, signal: inputs.signal });
    }
  });
}
