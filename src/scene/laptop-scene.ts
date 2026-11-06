import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createScreen, type SceneData } from './screen';
import { dustFragment, dustVertex } from './shaders';

// Laptop dimensions in scene units.
const WIDTH = 3.2;
const DEPTH = 2.2;
const BASE_HEIGHT = 0.09;
const LID_HEIGHT = 2.1;
const LID_THICKNESS = 0.05;
// Lid rotation around the hinge: closed lies flat on the keyboard, open leans back a little.
const LID_CLOSED = Math.PI / 2 - 0.02;
const LID_OPEN = -0.28;

// Key grid: 5 rows of 13 slots. Rows 0–3 follow QWERTY ("\0" marks a modifier key);
// row 4 is the space row. Slot index = row * 13 + column for rows 0–3.
const KEY_ROWS = ['`1234567890-=', '\tqwertyuiop[]', "\0asdfghjkl;'\n", '\0zxcvbnm,./'];
const SHIFTED: Record<string, string> = {
  '~': '`', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  _: '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/',
};
const SHIFT_KEY = 3 * 13;
const SPACE_KEY = 4 * 13 + 4;

/** Which keys a character needs: its own key, plus Shift for capitals and symbols. */
function keysFor(char: string): number[] {
  if (char === ' ') return [SPACE_KEY];
  const lower = char.toLowerCase();
  const base = SHIFTED[char] ?? lower;
  const shift = char in SHIFTED || char !== lower;
  for (let row = 0; row < KEY_ROWS.length; row++) {
    const col = KEY_ROWS[row].indexOf(base);
    if (col >= 0) return shift ? [row * 13 + col, SHIFT_KEY] : [row * 13 + col];
  }
  return [];
}

const KEY_COLOR = new Color('#15171c');
const KEY_LIT = new Color('#2bb8f2');

const THEMES = {
  dark: { body: '#4a4f58', dust: '#9fdcff', shadow: 0.55, dustBlending: AdditiveBlending },
  light: { body: '#c9ced6', dust: '#35506f', shadow: 0.22, dustBlending: NormalBlending },
};

/** Deterministic random numbers, so the scene looks the same on every visit. */
function random(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function canvasTexture(size: [number, number], paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const [w, h] = size;
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  paint(canvas.getContext('2d')!, w, h);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function readSceneData(): SceneData {
  try {
    return JSON.parse(document.getElementById('scene-data')?.textContent ?? '');
  } catch {
    return { name: '', role: '', skills: [], projects: 0 };
  }
}

/** Builds the laptop. The lid pivots on the hinge at the back of the base. */
function buildLaptop(screenTexture: CanvasTexture) {
  const body = new MeshStandardMaterial({ color: THEMES.dark.body, metalness: 0.9, roughness: 0.32 });
  const laptop = new Group();

  const base = new Mesh(new RoundedBoxGeometry(WIDTH, BASE_HEIGHT, DEPTH, 4, 0.045), body);
  base.position.y = BASE_HEIGHT / 2;
  laptop.add(base);

  // Keyboard backlight: a cyan-to-violet glow that shows between the keys.
  const backlight = new Mesh(
    new PlaneGeometry(2.86, 1.04),
    new MeshBasicMaterial({
      toneMapped: false,
      map: canvasTexture([256, 64], (ctx, w, h) => {
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0, '#0a5a7a');
        gradient.addColorStop(0.5, '#3b2a7a');
        gradient.addColorStop(1, '#0a6a7a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }),
    }),
  );
  backlight.rotation.x = -Math.PI / 2;
  backlight.position.set(0, BASE_HEIGHT + 0.0006, -0.36);
  laptop.add(backlight);

  // Keys: 5 rows of 13, with a spacebar in the bottom row.
  const keySlots: { x: number; z: number; width: number }[] = [];
  const pitch = 0.205;
  const keyWidth = 0.168;
  for (let row = 0; row < 5; row++) {
    const z = -0.76 + row * 0.19;
    for (let col = 0; col < 13; col++) {
      const x = -1.23 + col * pitch;
      if (row === 4 && col >= 4 && col <= 8) {
        if (col === 6) keySlots.push({ x, z, width: pitch * 5 - (pitch - keyWidth) });
        continue;
      }
      keySlots.push({ x, z, width: keyWidth });
    }
  }
  // White material so each key's own colour (dark, or lit while pressed) shows through.
  const keys = new InstancedMesh(
    new BoxGeometry(1, 0.022, 0.158),
    new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.1 }),
    keySlots.length,
  );
  const dummy = new Object3D();
  /** Positions a key, pushed down by `depth` (0–1) and lit to match. */
  const setKey = (i: number, depth: number) => {
    const { x, z, width } = keySlots[i];
    dummy.position.set(x, BASE_HEIGHT + 0.011 - 0.014 * depth, z);
    dummy.scale.set(width, 1, 1);
    dummy.updateMatrix();
    keys.setMatrixAt(i, dummy.matrix);
    keys.setColorAt(i, KEY_COLOR.clone().lerp(KEY_LIT, depth * 0.85));
  };
  keySlots.forEach((_, i) => setKey(i, 0));
  laptop.add(keys);

  const trackpad = new Mesh(new PlaneGeometry(1.15, 0.72), new MeshStandardMaterial({ color: '#2c3036', metalness: 0.7, roughness: 0.3 }));
  trackpad.rotation.x = -Math.PI / 2;
  trackpad.position.set(0, BASE_HEIGHT + 0.0008, 0.6);
  laptop.add(trackpad);

  // Lid: shell, black bezel, the display, and a glowing logo on the back.
  const lid = new Group();
  lid.position.set(0, BASE_HEIGHT, -DEPTH / 2 + 0.03);
  const shell = new Mesh(new RoundedBoxGeometry(WIDTH, LID_HEIGHT, LID_THICKNESS, 4, 0.024), body);
  shell.position.set(0, LID_HEIGHT / 2, -LID_THICKNESS / 2);
  const bezel = new Mesh(new PlaneGeometry(WIDTH - 0.08, LID_HEIGHT - 0.08), new MeshBasicMaterial({ color: '#050608' }));
  bezel.position.set(0, LID_HEIGHT / 2, 0.0015);
  const display = new Mesh(new PlaneGeometry(2.94, 1.8375), new MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  display.position.set(0, LID_HEIGHT / 2 + 0.04, 0.003);
  const logo = new Mesh(
    new PlaneGeometry(0.5, 0.5),
    new MeshBasicMaterial({
      transparent: true,
      toneMapped: false,
      map: canvasTexture([128, 128], (ctx, w, h) => {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, '#2bb8f2');
        gradient.addColorStop(1, '#00f3ff');
        ctx.fillStyle = gradient;
        ctx.font = '800 64px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VY', w / 2, h / 2 + 4);
      }),
    }),
  );
  logo.rotation.y = Math.PI;
  logo.position.set(0, LID_HEIGHT * 0.52, -LID_THICKNESS - 0.002);
  // The screen's own glow, lighting up the keyboard.
  const screenLight = new PointLight('#9fd8ff', 3, 3.5, 2);
  screenLight.position.set(0, LID_HEIGHT * 0.45, 0.55);
  lid.add(shell, bezel, display, logo, screenLight);
  laptop.add(lid);

  // Soft contact shadow underneath.
  const shadow = new Mesh(
    new PlaneGeometry(4.8, 3.6),
    new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      map: canvasTexture([128, 128], (ctx, w, h) => {
        const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
        gradient.addColorStop(0.55, 'rgba(0,0,0,0.35)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }),
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.02;
  laptop.add(shadow);

  return { laptop, lid, body, shadow: shadow.material, keys, setKey };
}

export function startScene(canvas: HTMLCanvasElement) {
  const root = document.documentElement;
  const narrow = () => innerWidth < 768;
  const lite = narrow() || (navigator.hardwareConcurrency ?? 8) <= 4;
  const rand = random(7);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return; // No WebGL: the CSS poster stays as the background.
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  let pixelRatio = Math.min(devicePixelRatio, 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.z = 8;

  scene.add(new HemisphereLight('#cfe8ff', '#0b0d12', 0.6));
  const key = new DirectionalLight('#ffffff', 1.6);
  key.position.set(3, 5, 4);
  const rim = new DirectionalLight('#2bb8f2', 1.4);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim);

  const screen = createScreen(readSceneData());
  screen.draw(0, true);
  const { laptop, lid, body, shadow, keys, setKey } = buildLaptop(screen.texture);

  // Human-ish typing rhythm: small random gaps between keys, a pause at each line end.
  const typeTimes: number[] = [];
  for (let i = 0, t = 0; i < screen.total; i++) {
    t += screen.chars[i] === '\n' ? 0.18 + rand() * 0.18 : 0.02 + rand() * 0.036;
    typeTimes.push(t);
  }
  // How far down each key is (1 = just pressed); keys spring back up over ~0.14s.
  const pressed = new Map<number, number>();
  lid.rotation.x = LID_CLOSED;

  // rig (scroll position) → tilt (pointer) → laptop
  const rig = new Group();
  const tilt = new Group();
  tilt.add(laptop);
  rig.add(tilt);
  scene.add(rig);

  // Ambient dust filling the whole viewport.
  const dustCount = lite ? 700 : 1800;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) dustPositions.set([(rand() - 0.5) * 28, (rand() - 0.5) * 18, -10 + rand() * 12], i * 3);
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('aSeed', new BufferAttribute(Float32Array.from({ length: dustCount }, rand), 1));
  dustGeometry.setAttribute('aSize', new BufferAttribute(Float32Array.from({ length: dustCount }, () => 2 + rand() * 3.5), 1));
  const dustMaterial = new ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uScroll: { value: 0 },
      uPointer: { value: new Vector2() },
      uColor: { value: new Color() },
      uOpacity: { value: 0.8 },
    },
    transparent: true,
    depthWrite: false,
  });
  const dust = new Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  scene.add(dust);

  // Theme ---------------------------------------------------------------------
  const target = { body: new Color(), dust: new Color(), shadow: 0.5 };
  const applyTheme = (instant = false) => {
    const theme = THEMES[root.dataset.theme === 'light' ? 'light' : 'dark'];
    target.body.set(theme.body);
    target.dust.set(theme.dust);
    target.shadow = theme.shadow;
    dustMaterial.blending = theme.dustBlending;
    dustMaterial.needsUpdate = true;
    if (instant) {
      body.color.copy(target.body);
      dustMaterial.uniforms.uColor.value.copy(target.dust);
      shadow.opacity = target.shadow;
    }
  };
  applyTheme(true);
  addEventListener('themechange', () => applyTheme());

  // Layout -------------------------------------------------------------------------
  // Where the laptop sits in the hero; as the hero scrolls away it floats up and closes.
  const pose = { x: 2.55, y: -0.6, scale: 1, turn: -0.55 };
  let heroHeight = innerHeight;
  const measure = () => {
    const width = innerWidth;
    const height = Math.max(innerHeight, document.documentElement.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Pull back on portrait screens so everything still fits.
    camera.position.z = camera.aspect < 1 ? 8 + (1 - camera.aspect) * 5 : 8;
    camera.updateProjectionMatrix();
    heroHeight = document.querySelector<HTMLElement>('[data-scene="hero"]')?.offsetHeight ?? innerHeight;
    // Phones: smaller, centred, below the hero text (smaller still on short screens).
    const short = innerHeight < 720;
    Object.assign(
      pose,
      narrow()
        ? { x: 0, y: short ? -3.45 : -3.0, scale: short ? 0.5 : 0.68, turn: -0.25 }
        : { x: 2.55, y: -0.6, scale: 1, turn: -0.55 },
    );
  };
  measure();
  let lastWidth = innerWidth;
  let lastHeight = innerHeight;
  addEventListener('resize', () => {
    // Ignore the small height changes from mobile browser bars appearing.
    if (innerWidth === lastWidth && Math.abs(innerHeight - lastHeight) < 120) return;
    lastWidth = innerWidth;
    lastHeight = innerHeight;
    measure();
  });

  // Input ------------------------------------------------------------------------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
    },
    { passive: true },
  );

  // Loop -------------------------------------------------------------------------
  let clock = 0;
  let last = performance.now();
  let ready = false;
  let openedAt = -1; // when the lid started opening
  let typedChars = -1;
  let cursorVisible = true;
  let away = 0; // 0 = hero in view, 1 = scrolled past it

  // Adaptive quality: if frames run slow, step down resolution, then the dust.
  let quality = 0;
  let slowFrames = 0;
  let sampledFrames = 0;
  const degrade = () => {
    quality++;
    if (quality === 1) {
      pixelRatio = 1;
      renderer.setPixelRatio(pixelRatio);
      dustMaterial.uniforms.uPixelRatio.value = pixelRatio;
      measure();
    } else if (quality === 2) {
      dustGeometry.setDrawRange(0, Math.floor(dustCount / 2));
    } else if (quality === 3) {
      dust.visible = false;
    }
  };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;

    if (clock > 2 && quality < 3) {
      sampledFrames++;
      if (dt > 1 / 40) slowFrames++;
      if (sampledFrames === 90) {
        if (slowFrames > 45) degrade();
        sampledFrames = slowFrames = 0;
      }
    }

    // Open the lid once the name intro has landed.
    if (openedAt < 0 && (!root.classList.contains('has-intro') || root.classList.contains('intro-done'))) openedAt = clock;
    const opening = openedAt < 0 ? 0 : easeOutCubic(Math.min((clock - openedAt) / 1.6, 1));

    away = damp(away, Math.min(Math.max(scrollY / (heroHeight * 0.9), 0), 1), 6, dt);
    laptop.visible = away < 0.995;

    pointer.x = damp(pointer.x, pointer.tx, 3, dt);
    pointer.y = damp(pointer.y, pointer.ty, 3, dt);

    if (laptop.visible) {
      // Gentle hover, then float up and turn away as the hero scrolls off.
      rig.position.set(pose.x, pose.y + Math.sin(clock * 0.8) * 0.05 + away * 6, 0);
      rig.scale.setScalar(pose.scale);
      rig.rotation.set(0.2 + away * 0.3, pose.turn - away * 0.7, 0);
      tilt.rotation.set(-pointer.y * 0.1, pointer.x * 0.22, 0);
      const openAngle = LID_CLOSED + (LID_OPEN - LID_CLOSED) * opening;
      lid.rotation.x = openAngle + (LID_CLOSED * 0.75 - openAngle) * away;

      // Type the code once the lid is mostly open, pressing the matching keys.
      let chars = Math.max(typedChars, 0);
      if (opening > 0.7) {
        const elapsed = clock - openedAt - 1.1;
        while (chars < screen.total && typeTimes[chars] <= elapsed) {
          for (const key of keysFor(screen.chars[chars])) pressed.set(key, 1);
          chars++;
        }
      }
      const blink = chars >= screen.total ? Math.floor(clock / 0.53) % 2 === 0 : true;
      if (chars !== typedChars || blink !== cursorVisible) {
        typedChars = chars;
        cursorVisible = blink;
        screen.draw(chars, blink);
      }

      if (pressed.size) {
        for (const [key, depth] of pressed) {
          const next = depth - dt / 0.14;
          setKey(key, Math.max(next, 0));
          if (next <= 0) pressed.delete(key);
          else pressed.set(key, next);
        }
        keys.instanceMatrix.needsUpdate = true;
        keys.instanceColor!.needsUpdate = true;
      }
    }

    const fade = 1 - Math.exp(-4 * dt);
    body.color.lerp(target.body, fade);
    dustMaterial.uniforms.uColor.value.lerp(target.dust, fade);
    shadow.opacity = damp(shadow.opacity, target.shadow, 4, dt);
    dustMaterial.uniforms.uTime.value = clock;
    dustMaterial.uniforms.uScroll.value = scrollY / innerHeight;
    dustMaterial.uniforms.uPointer.value.set(pointer.x, pointer.y);

    camera.position.x = pointer.x * 0.25;
    camera.position.y = pointer.y * 0.18;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      canvas.classList.add('is-ready');
    }
  };

  const play = () => {
    last = performance.now();
    renderer.setAnimationLoop(frame);
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? renderer.setAnimationLoop(null) : play()));
  play();
}
