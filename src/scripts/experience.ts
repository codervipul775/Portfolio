// Experience section: stacking project cards, and a terminal that types its lines out.

// Where each project card sticks. Later cards stick a little lower, so the edge of the one
// beneath peeks out. A card taller than the screen first scrolls until its bottom is visible,
// so nothing on it is covered before it's been seen.
const STACK_TOP = 96;
const STACK_STEP = 22;
for (const rail of document.querySelectorAll<HTMLElement>('[data-exp-rail]')) {
  const entries = [...rail.querySelectorAll<HTMLElement>('[data-exp-entry]')];
  const layout = () => {
    const stuck = entries.map((entry, i) => {
      const top = Math.min(STACK_TOP + i * STACK_STEP, innerHeight - entry.offsetHeight - 24);
      entry.style.setProperty('--stack-top', `${top}px`);
      return { top, bottom: top + entry.offsetHeight };
    });
    // Cards only stick while the list is on screen. Room after the last card keeps every
    // card stuck until the last one has settled on top, then holds the stack for a moment.
    const last = stuck.at(-1);
    const tail = last ? Math.max(0, ...stuck.map((card) => card.bottom - last.bottom)) + innerHeight * 0.25 : 0;
    rail.style.setProperty('--stack-tail', `${Math.round(tail)}px`);
  };
  layout();
  // Card heights change with the viewport, fonts and images.
  new ResizeObserver(layout).observe(rail);
  addEventListener('resize', layout);
}

// The terminal types its lines out each time it scrolls into view.
// Without this script (or with reduced motion) every line is simply visible.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const consoles = document.querySelectorAll<HTMLElement>('[data-exp-console]');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) el.classList.add('is-playing');
        // Reset once it's fully off screen, so it plays again next time.
        else if (entry.intersectionRatio === 0) el.classList.remove('is-playing');
      }
    },
    { threshold: [0, 0.5] },
  );
  for (const el of consoles) {
    el.classList.add('is-armed');
    observer.observe(el);
  }
}

export {};
