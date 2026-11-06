// Renders an image as halftone dots with WebGL. Hovering reveals the original photo
// in a circle that grows from the cursor; leaving turns it back into dots (tap on
// touch screens). The real <img> stays underneath, so without WebGL nothing changes.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Distance between dots in CSS pixels; the largest dots are about this wide. */
const DOT_SPACING = 4;

const VERTEX = /* glsl */ `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const COVER = /* glsl */ `
  uniform vec2 uCover; // object-fit: cover (top-aligned)
  vec2 cover(vec2 uv) {
    return vec2(0.5 + (uv.x - 0.5) * uCover.x, 1.0 - (1.0 - uv.y) * uCover.y);
  }
`;

/** Halftone version of the photo: a grid of dots sized by brightness. Drawn once into a texture. */
const DOTS_FRAGMENT = /* glsl */ `
  precision highp float;
  ${COVER}
  uniform sampler2D uImage;
  uniform vec2 uSize;      // canvas pixels
  uniform float uCell;     // dot grid spacing in pixels
  uniform float uPx;       // device pixel ratio, for anti-aliasing
  uniform float uInvert;   // light theme: dark dots for dark areas, like print
  uniform vec3 uDot;
  uniform vec3 uBg;
  varying vec2 vUv;

  void main() {
    vec2 frag = vUv * uSize;
    vec2 center = (floor(frag / uCell) + 0.5) * uCell;
    float lum = dot(texture2D(uImage, cover(center / uSize)).rgb, vec3(0.299, 0.587, 0.114));
    lum = smoothstep(0.06, 0.9, mix(lum, 1.0 - lum, uInvert));
    // Dot area follows brightness.
    float radius = 0.52 * uCell * sqrt(lum);
    float dotMask = 1.0 - smoothstep(radius - 0.75 * uPx, radius + 0.25 * uPx, length(frag - center));
    gl_FragColor = vec4(mix(uBg, uDot, dotMask * step(0.03, lum)), 1.0);
  }
`;

/** Blends dots and photo inside a circle around the pointer. Cheap enough for every frame. */
const REVEAL_FRAGMENT = /* glsl */ `
  precision highp float;
  ${COVER}
  uniform sampler2D uImage;
  uniform sampler2D uDots;
  uniform vec2 uSize;
  uniform float uReveal;   // 0 = dots, 1 = photo
  uniform vec2 uPointer;
  uniform vec3 uRing;
  varying vec2 vUv;

  void main() {
    vec2 frag = vUv * uSize;
    float diagonal = length(uSize);
    float soft = 0.15 * diagonal;
    float reach = uReveal * (diagonal + soft);
    float dist = length(frag - uPointer);
    float show = 1.0 - smoothstep(reach - soft, reach, dist);
    float ring = smoothstep(soft * 0.35, 0.0, abs(dist - (reach - soft * 0.5))) * uReveal * (1.0 - uReveal) * 4.0;
    vec3 color = mix(texture2D(uDots, vUv).rgb, texture2D(uImage, cover(vUv)).rgb, show);
    gl_FragColor = vec4(color + uRing * ring * 0.35, 1.0);
  }
`;

type RGB = [number, number, number];

const hexToRgb = (value: string): RGB => {
  let hex = value.trim().replace('#', '');
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const token = (name: string) => hexToRgb(getComputedStyle(document.documentElement).getPropertyValue(name));

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function createProgram(gl: WebGLRenderingContext, fragment: string) {
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed to compile');
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
    return uniforms.get(name)!;
  };
  return { program, u };
}

function createTexture(gl: WebGLRenderingContext, unit: number) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function dotImage(container: HTMLElement, img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dotted-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;

  // One full-screen quad shared by both passes.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const dots = createProgram(gl, DOTS_FRAGMENT);
  const reveal = createProgram(gl, REVEAL_FRAGMENT);

  // Texture unit 0: the photo. Unit 1: the stippled render, via a framebuffer.
  createTexture(gl, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  const dotsTexture = createTexture(gl, 1);
  const framebuffer = gl.createFramebuffer();

  let width = 0;
  let height = 0;
  let dpr = 1;
  const pointer = { x: 0, y: 0 };
  const tween = { value: 0, from: 0, to: 0, start: 0, running: false };

  const coverScale = () => {
    const imageAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = width / height;
    return imageAspect > boxAspect ? [boxAspect / imageAspect, 1] : [1, imageAspect / boxAspect];
  };

  /** Re-stipple (on resize and theme change), then show it. */
  const renderDots = () => {
    if (!width || !height) return;
    const light = document.documentElement.dataset.theme === 'light';
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dotsTexture, 0);
    gl.viewport(0, 0, width, height);
    gl.useProgram(dots.program);
    gl.uniform1i(dots.u('uImage'), 0);
    gl.uniform2f(dots.u('uSize'), width, height);
    gl.uniform2f(dots.u('uCover'), ...(coverScale() as [number, number]));
    gl.uniform1f(dots.u('uCell'), DOT_SPACING * dpr);
    gl.uniform1f(dots.u('uPx'), dpr);
    gl.uniform1f(dots.u('uInvert'), light ? 1 : 0);
    gl.uniform3f(dots.u('uDot'), ...token('--fg'));
    gl.uniform3f(dots.u('uBg'), ...token('--surface-strong'));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    draw();
  };

  const draw = () => {
    if (!width || !height) return;
    gl.viewport(0, 0, width, height);
    gl.useProgram(reveal.program);
    gl.uniform1i(reveal.u('uImage'), 0);
    gl.uniform1i(reveal.u('uDots'), 1);
    gl.uniform2f(reveal.u('uSize'), width, height);
    gl.uniform2f(reveal.u('uCover'), ...(coverScale() as [number, number]));
    gl.uniform1f(reveal.u('uReveal'), tween.value);
    gl.uniform2f(reveal.u('uPointer'), pointer.x, pointer.y);
    gl.uniform3f(reveal.u('uRing'), ...token('--brand'));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio, 2);
    width = canvas.width = Math.round(rect.width * dpr);
    height = canvas.height = Math.round(rect.height * dpr);
    renderDots();
  };

  // Only draws while the reveal is animating; otherwise the last frame just stays.
  const tick = (now: number) => {
    const duration = reduceMotion ? 1 : tween.to > tween.from ? 900 : 700;
    const t = Math.min((now - tween.start) / duration, 1);
    tween.value = tween.from + (tween.to - tween.from) * easeInOutCubic(t);
    draw();
    if (t < 1) requestAnimationFrame(tick);
    else tween.running = false;
  };
  const revealTo = (target: number) => {
    Object.assign(tween, { from: tween.value, to: target, start: performance.now() });
    container.classList.toggle('is-revealed', target === 1);
    if (!tween.running) {
      tween.running = true;
      requestAnimationFrame(tick);
    }
  };

  const track = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * width;
    pointer.y = (1 - (e.clientY - rect.top) / rect.height) * height;
  };
  container.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') {
      track(e);
      revealTo(1);
    }
  });
  container.addEventListener('pointermove', track);
  container.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') {
      track(e);
      revealTo(0);
    }
  });
  container.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    track(e);
    revealTo(tween.to === 1 ? 0 : 1);
  });

  addEventListener('themechange', renderDots);

  img.closest('picture')?.after(canvas);
  new ResizeObserver(resize).observe(container);
  resize();
  requestAnimationFrame(() => canvas.classList.add('is-ready'));
}

// Set up each [data-dotted] image as it approaches the screen.
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const container = entry.target as HTMLElement;
      const img = container.querySelector('img');
      if (!img) continue;
      const start = () => img.decode().then(() => dotImage(container, img)).catch(() => {});
      if (img.complete && img.naturalWidth) start();
      else img.addEventListener('load', start, { once: true });
    }
  },
  { rootMargin: '300px' },
);
document.querySelectorAll('[data-dotted]').forEach((el) => observer.observe(el));

export {};
