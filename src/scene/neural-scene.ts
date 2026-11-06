import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  type Blending,
} from 'three';
import { dustFragment, dustVertex, linkFragment, linkVertex, nodeFragment, nodeVertex } from './shaders';

// Where the core sits for each section type. The scene eases between these as you scroll.
type Pose = { x: number; y: number; z: number; scale: number; morph: number; intensity: number; spin: number };

const POSES: Record<string, Pose> = {
  hero: { x: 2.5, y: 0.05, z: 0, scale: 1.12, morph: 0, intensity: 1, spin: 1 },
  about: { x: -3.1, y: 0.3, z: -1.4, scale: 0.72, morph: 0, intensity: 0.45, spin: 0.7 },
  status: { x: -2.4, y: -0.3, z: -1.6, scale: 0.68, morph: 0.1, intensity: 0.5, spin: 0.7 },
  skills: { x: 0, y: 0, z: -3.5, scale: 1.6, morph: 0.3, intensity: 0.3, spin: 0.4 },
  projects: { x: 0, y: -0.2, z: -2.2, scale: 1.3, morph: 1, intensity: 0.5, spin: 0.5 },
  contact: { x: 0, y: 0.1, z: -0.4, scale: 1.05, morph: 0, intensity: 1, spin: 1.3 },
  custom: { x: 2.6, y: 0, z: -1.2, scale: 0.72, morph: 0, intensity: 0.6, spin: 0.7 },
};

const THEMES = {
  dark: { a: '#2bb8f2', b: '#00f3ff', c: '#8b5cf6', dust: '#9fdcff', hot: 1, line: 0.13, blending: AdditiveBlending },
  light: { a: '#0272b0', b: '#0e7490', c: '#7c3aed', dust: '#35506f', hot: 0, line: 0.2, blending: NormalBlending },
} satisfies Record<string, { a: string; b: string; c: string; dust: string; hot: number; line: number; blending: Blending }>;

/** Deterministic random numbers, so the network looks the same on every visit. */
function random(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export function startScene(canvas: HTMLCanvasElement) {
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
  let pixelRatio = Math.min(devicePixelRatio, 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 60);
  camera.position.z = 8;

  // Uniforms shared by every material.
  const shared = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uBreath: { value: 1 },
    uBurst: { value: 0 },
    uIntensity: { value: 1 },
    uHot: { value: 1 },
    uPixelRatio: { value: pixelRatio },
    uColorA: { value: new Color() },
    uColorB: { value: new Color() },
    uColorC: { value: new Color() },
  };

  // Nodes: mostly a shell, some inside. Each also has a position in the galaxy shape.
  const nodeCount = lite ? 260 : 460;
  const core = new Float32Array(nodeCount * 3);
  const galaxy = new Float32Array(nodeCount * 3);
  const seeds = new Float32Array(nodeCount);
  const sizes = new Float32Array(nodeCount);
  const shellCount = Math.floor(nodeCount * 0.78);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < nodeCount; i++) {
    let x: number, y: number, z: number;
    if (i < shellCount) {
      y = 1 - (i / (shellCount - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      x = Math.cos(golden * i) * r;
      z = Math.sin(golden * i) * r;
      const radius = 1.55 + (rand() - 0.5) * 0.16;
      x *= radius;
      y *= radius;
      z *= radius;
    } else {
      const radius = 0.45 + rand() * 0.85;
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      x = Math.cos(theta) * s * radius;
      y = u * radius;
      z = Math.sin(theta) * s * radius;
    }
    core.set([x, y, z], i * 3);

    const arm = i % 3;
    const r = 0.35 + 2.9 * Math.pow(rand(), 0.8);
    const angle = (arm * Math.PI * 2) / 3 + r * 1.35 + (rand() - 0.5) * 0.55;
    galaxy.set([Math.cos(angle) * r, (rand() - 0.5) * 0.18 * (1.6 - r * 0.3), Math.sin(angle) * r], i * 3);

    seeds[i] = rand();
    sizes[i] = rand() < 0.06 ? 2.4 : 0.6 + rand() * 0.9;
  }

  const nodeGeometry = new BufferGeometry();
  nodeGeometry.setAttribute('position', new BufferAttribute(core, 3));
  nodeGeometry.setAttribute('aGalaxy', new BufferAttribute(galaxy, 3));
  nodeGeometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  nodeGeometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  const nodeMaterial = new ShaderMaterial({
    vertexShader: nodeVertex,
    fragmentShader: nodeFragment,
    uniforms: { ...shared, uSize: { value: lite ? 9 : 11 } },
    transparent: true,
    depthWrite: false,
  });
  const nodes = new Points(nodeGeometry, nodeMaterial);

  // Links: connect each node to its nearest neighbours.
  const pairs: [number, number][] = [];
  const maxLinks = lite ? 2 : 3;
  for (let i = 0; i < nodeCount; i++) {
    const nearest: { j: number; d: number }[] = [];
    for (let j = 0; j < nodeCount; j++) {
      if (j === i) continue;
      const dx = core[i * 3] - core[j * 3];
      const dy = core[i * 3 + 1] - core[j * 3 + 1];
      const dz = core[i * 3 + 2] - core[j * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < 0.36) nearest.push({ j, d });
    }
    nearest.sort((a, b) => a.d - b.d);
    for (const { j } of nearest.slice(0, maxLinks)) if (i < j) pairs.push([i, j]);
  }

  const linkPositions = new Float32Array(pairs.length * 6);
  const linkGalaxy = new Float32Array(pairs.length * 6);
  const linkNodeSeeds = new Float32Array(pairs.length * 2);
  const linkT = new Float32Array(pairs.length * 2);
  const linkSeeds = new Float32Array(pairs.length * 2);
  pairs.forEach(([a, b], k) => {
    const seed = rand();
    [a, b].forEach((node, end) => {
      const v = k * 2 + end;
      linkPositions.set(core.subarray(node * 3, node * 3 + 3), v * 3);
      linkGalaxy.set(galaxy.subarray(node * 3, node * 3 + 3), v * 3);
      linkNodeSeeds[v] = seeds[node];
      linkT[v] = end;
      linkSeeds[v] = seed;
    });
  });

  const linkGeometry = new BufferGeometry();
  linkGeometry.setAttribute('position', new BufferAttribute(linkPositions, 3));
  linkGeometry.setAttribute('aGalaxy', new BufferAttribute(linkGalaxy, 3));
  linkGeometry.setAttribute('aNodeSeed', new BufferAttribute(linkNodeSeeds, 1));
  linkGeometry.setAttribute('aT', new BufferAttribute(linkT, 1));
  linkGeometry.setAttribute('aSeed', new BufferAttribute(linkSeeds, 1));
  const linkMaterial = new ShaderMaterial({
    vertexShader: linkVertex,
    fragmentShader: linkFragment,
    uniforms: { ...shared, uLineAlpha: { value: 0.13 } },
    transparent: true,
    depthWrite: false,
  });
  const links = new LineSegments(linkGeometry, linkMaterial);

  // Ambient dust filling the whole viewport.
  const dustCount = lite ? 700 : 1800;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount);
  const dustSizes = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPositions.set([(rand() - 0.5) * 28, (rand() - 0.5) * 18, -10 + rand() * 12], i * 3);
    dustSeeds[i] = rand();
    dustSizes[i] = 2 + rand() * 3.5;
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('aSeed', new BufferAttribute(dustSeeds, 1));
  dustGeometry.setAttribute('aSize', new BufferAttribute(dustSizes, 1));
  const dustMaterial = new ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    uniforms: {
      uTime: shared.uTime,
      uPixelRatio: shared.uPixelRatio,
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

  // rig (scroll pose) → tilt (pointer) → spin (idle rotation) → network
  const rig = new Group();
  const tilt = new Group();
  const spin = new Group();
  spin.add(links, nodes);
  tilt.add(spin);
  rig.add(tilt);
  scene.add(dust, rig);

  // Theme ---------------------------------------------------------------------
  const target = { a: new Color(), b: new Color(), c: new Color(), dust: new Color(), hot: 1, line: 0.13 };
  const applyTheme = (name: 'dark' | 'light', instant = false) => {
    const theme = THEMES[name];
    target.a.set(theme.a);
    target.b.set(theme.b);
    target.c.set(theme.c);
    target.dust.set(theme.dust);
    target.hot = theme.hot;
    target.line = theme.line;
    for (const material of [nodeMaterial, linkMaterial, dustMaterial]) {
      material.blending = theme.blending;
      material.needsUpdate = true;
    }
    if (instant) {
      shared.uColorA.value.copy(target.a);
      shared.uColorB.value.copy(target.b);
      shared.uColorC.value.copy(target.c);
      dustMaterial.uniforms.uColor.value.copy(target.dust);
      shared.uHot.value = target.hot;
      linkMaterial.uniforms.uLineAlpha.value = target.line;
    }
  };
  const currentTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  applyTheme(currentTheme(), true);
  addEventListener('themechange', () => applyTheme(currentTheme()));

  // Layout: cache section positions so the frame loop never touches the DOM. --
  let sections: { top: number; height: number; pose: Pose }[] = [];
  const measure = () => {
    const width = innerWidth;
    const height = Math.max(innerHeight, document.documentElement.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Pull back on portrait screens so the core still fits.
    camera.position.z = camera.aspect < 1 ? 8 + (1 - camera.aspect) * 5 : 8;
    camera.updateProjectionMatrix();

    sections = [...document.querySelectorAll<HTMLElement>('main > section[data-scene]')].map((el) => {
      const rect = el.getBoundingClientRect();
      const pose = { ...(POSES[el.dataset.scene!] ?? POSES.custom) };
      if (narrow()) {
        // Phones: keep the core centred behind the text, smaller and dimmer.
        pose.x = 0;
        pose.y = el.dataset.scene === 'hero' ? 0.9 : pose.y;
        pose.scale *= 0.85;
        pose.intensity *= el.dataset.scene === 'hero' ? 0.7 : 0.6;
      }
      return { top: rect.top + scrollY, height: rect.height, pose };
    });
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
  new ResizeObserver(() => measure()).observe(document.querySelector('main')!);

  const poseAt = (): Pose => {
    if (!sections.length) return POSES.hero;
    const probe = scrollY + innerHeight * 0.5;
    let i = sections.findIndex((s) => probe < s.top + s.height);
    if (i === -1) i = sections.length - 1;
    const current = sections[i];
    const next = sections[i + 1];
    if (!next) return current.pose;
    // Hold each pose for most of its section, then blend into the next one.
    const local = (probe - current.top) / current.height;
    const t = Math.min(Math.max((local - 0.55) / 0.45, 0), 1);
    const k = t * t * (3 - 2 * t);
    const pose = {} as Pose;
    for (const key of Object.keys(current.pose) as (keyof Pose)[]) {
      pose[key] = current.pose[key] + (next.pose[key] - current.pose[key]) * k;
    }
    return pose;
  };

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

  // Clicking empty space sends a pulse through the network.
  let burstAt = -10;
  addEventListener('pointerdown', (e) => {
    if (!(e.target as Element).closest('a, button, input, textarea, [data-skill-sphere]')) burstAt = clock;
  });

  // Loop -------------------------------------------------------------------------
  const state = { ...POSES.hero, rotation: 0 };
  let clock = 0;
  let last = performance.now();
  let ready = false;

  // Adaptive quality: if frames run slow, step down resolution, then detail.
  let quality = 0;
  let slowFrames = 0;
  let sampledFrames = 0;
  const degrade = () => {
    quality++;
    if (quality === 1) {
      pixelRatio = 1;
      renderer.setPixelRatio(pixelRatio);
      shared.uPixelRatio.value = pixelRatio;
      measure();
    } else if (quality === 2) {
      dustGeometry.setDrawRange(0, Math.floor(dustCount / 2));
    } else if (quality === 3) {
      links.visible = false;
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

    const pose = poseAt();
    for (const key of Object.keys(pose) as (keyof Pose)[]) state[key] = damp(state[key], pose[key], 2.4, dt);

    pointer.x = damp(pointer.x, pointer.tx, 3, dt);
    pointer.y = damp(pointer.y, pointer.ty, 3, dt);

    rig.position.set(state.x, state.y, state.z);
    rig.scale.setScalar(state.scale);
    tilt.rotation.set(-pointer.y * 0.35, pointer.x * 0.5, 0);
    state.rotation += dt * 0.12 * state.spin;
    spin.rotation.set(0.35 + state.morph * 0.55, state.rotation, state.morph * -0.25);

    const sinceBurst = clock - burstAt;
    shared.uBurst.value = sinceBurst < 3 ? Math.exp(-sinceBurst * 3.2) * (1 - Math.exp(-sinceBurst * 22)) : 0;
    shared.uTime.value = clock;
    shared.uMorph.value = state.morph;
    shared.uIntensity.value = state.intensity;

    const fade = 1 - Math.exp(-4 * dt);
    shared.uColorA.value.lerp(target.a, fade);
    shared.uColorB.value.lerp(target.b, fade);
    shared.uColorC.value.lerp(target.c, fade);
    dustMaterial.uniforms.uColor.value.lerp(target.dust, fade);
    shared.uHot.value = damp(shared.uHot.value, target.hot, 4, dt);
    linkMaterial.uniforms.uLineAlpha.value = damp(linkMaterial.uniforms.uLineAlpha.value, target.line, 4, dt);

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
