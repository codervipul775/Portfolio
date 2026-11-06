// Interactive 3D sphere of skills: drag to spin, it keeps drifting when left alone.
// Plain DOM elements projected by hand, so the labels stay crisp and selectable.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

for (const root of document.querySelectorAll<HTMLElement>('[data-skill-sphere]')) {
  const items = [...root.querySelectorAll<HTMLElement>('[data-sphere-item]')];
  const n = items.length;
  if (!n) continue;

  const golden = Math.PI * (3 - Math.sqrt(5));
  const points = items.map((_, i) => {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    return [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r];
  });

  let radius = 0;
  const measure = () => (radius = Math.min(root.clientWidth, root.clientHeight) * 0.44);
  new ResizeObserver(measure).observe(root);
  measure();

  let angleX = -0.25;
  let angleY = 0;
  const idleSpeed = reduceMotion ? 0 : 0.25; // radians per second
  let velocityX = 0;
  let velocityY = idleSpeed;
  let dragging: { x: number; y: number; t: number } | null = null;

  root.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, y: e.clientY, t: performance.now() };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dt = Math.max((now - dragging.t) / 1000, 1 / 120);
    const dx = (e.clientX - dragging.x) / radius;
    const dy = (e.clientY - dragging.y) / radius;
    angleY += dx;
    angleX -= dy;
    velocityY = dx / dt;
    velocityX = -dy / dt;
    dragging = { x: e.clientX, y: e.clientY, t: now };
  });
  const release = () => (dragging = null);
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  const render = () => {
    const cx = Math.cos(angleX);
    const sx = Math.sin(angleX);
    const cy = Math.cos(angleY);
    const sy = Math.sin(angleY);
    items.forEach((el, i) => {
      const [x, y, z] = points[i];
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const y1 = y * cx - z1 * sx;
      const z2 = y * sx + z1 * cx;
      const depth = (z2 + 1) / 2; // 0 = back, 1 = front
      el.style.transform = `translate3d(${x1 * radius}px, ${y1 * radius}px, 0) translate(-50%, -50%) scale(${0.5 + depth * 0.62})`;
      el.style.opacity = String(0.12 + depth * 0.88);
      el.style.zIndex = String(Math.round(depth * 100));
    });
  };

  let last = performance.now();
  let running = false;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!dragging) {
      // Ease back to a gentle drift after a flick.
      velocityY += (idleSpeed - velocityY) * (1 - Math.exp(-dt * 1.5));
      velocityX += (0 - velocityX) * (1 - Math.exp(-dt * 1.5));
      angleY += velocityY * dt;
      angleX += velocityX * dt;
    }
    angleX = Math.max(-1.2, Math.min(1.2, angleX));
    render();
    requestAnimationFrame(frame);
  };

  // Only animate while the sphere is on screen.
  new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }).observe(root);
  render();

  // Hovering a skill (in the list) or a category (in the legend) highlights it on the sphere.
  const section = root.closest('section') ?? document;
  section.querySelectorAll<HTMLElement>('[data-skill-id]').forEach((tile) => {
    const match = items.find((item) => item.dataset.skillId === tile.dataset.skillId);
    tile.addEventListener('pointerenter', () => match?.classList.add('is-highlighted'));
    tile.addEventListener('pointerleave', () => match?.classList.remove('is-highlighted'));
  });
  section.querySelectorAll<HTMLElement>('[data-category-id]').forEach((group) => {
    const focus = (on: boolean) =>
      items.forEach((item) => item.classList.toggle('is-dimmed', on && item.dataset.categoryId !== group.dataset.categoryId));
    group.addEventListener('pointerenter', () => focus(true));
    group.addEventListener('pointerleave', () => focus(false));
  });
}

export {};
