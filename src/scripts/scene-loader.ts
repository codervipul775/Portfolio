// Loads the WebGL scene after the page is up, so it never delays the first paint.
// Without WebGL, with reduced motion or Save-Data, the CSS poster stays instead.

const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

if (canvas && !reduceMotion && !saveData) {
  const start = () => import('../scene/neural-scene').then(({ startScene }) => startScene(canvas));
  const whenIdle = () =>
    'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200);
  if (document.readyState === 'complete') whenIdle();
  else addEventListener('load', whenIdle, { once: true });
}

export {};
