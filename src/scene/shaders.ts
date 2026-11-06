// GLSL for the neural-core scene. All motion happens here on the GPU; the CPU only
// updates a handful of uniforms per frame.

/** Shared by nodes and links so link endpoints stay glued to their nodes. */
const shape = /* glsl */ `
  uniform float uTime;
  uniform float uMorph;   // 0 = sphere core, 1 = spiral galaxy
  uniform float uBreath;
  uniform float uBurst;

  vec3 shape(vec3 core, vec3 galaxy, float seed) {
    vec3 p = mix(core, galaxy, uMorph);
    float wobble = sin(uTime * 0.9 + seed * 6.2831 + p.y * 2.2) * 0.05
                 + sin(uTime * 0.6 + p.x * 1.7 + seed * 3.0) * 0.04;
    p += normalize(p + 1e-4) * (wobble * uBreath + uBurst * (0.35 + seed * 0.6));
    return p;
  }
`;

export const nodeVertex = /* glsl */ `
  ${shape}
  attribute vec3 aGalaxy;
  attribute float aSeed;
  attribute float aSize;
  uniform float uPixelRatio;
  uniform float uSize;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec3 p = shape(position, aGalaxy, aSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 40.0);
    gl_PointSize = uSize * aSize * twinkle * uPixelRatio * (8.0 / -mv.z);
    vSeed = aSeed;
    vDepth = -mv.z;
  }
`;

export const nodeFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uIntensity;
  uniform float uHot;
  varying float vSeed;
  varying float vDepth;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.6);
    vec3 col = vSeed < 0.6 ? mix(uColorA, uColorB, vSeed / 0.6) : mix(uColorB, uColorC, (vSeed - 0.6) / 0.4);
    col += smoothstep(0.16, 0.0, d) * 0.7 * uHot;
    float fog = smoothstep(16.0, 5.0, vDepth);
    float alpha = a * uIntensity * fog;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export const linkVertex = /* glsl */ `
  ${shape}
  attribute vec3 aGalaxy;
  attribute float aNodeSeed;
  attribute float aT;
  attribute float aSeed;
  varying float vT;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec3 p = shape(position, aGalaxy, aNodeSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vT = aT;
    vSeed = aSeed;
    vDepth = -mv.z;
  }
`;

export const linkFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMorph;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uLineAlpha;
  uniform float uHot;
  varying float vT;
  varying float vSeed;
  varying float vDepth;

  void main() {
    // A "signal" travels along roughly half of the links, in a random direction.
    float head = fract(uTime * (0.25 + vSeed * 0.35) + vSeed * 7.0);
    float t = mix(vT, 1.0 - vT, step(0.5, fract(vSeed * 13.0)));
    float pulse = smoothstep(0.12, 0.0, abs(t - head)) * step(0.45, fract(vSeed * 5.3));
    vec3 col = mix(uColorA, uColorB, vT) + pulse * 0.6 * uHot;
    float alpha = (uLineAlpha + pulse * 0.85) * uIntensity * (1.0 - uMorph * 0.85) * smoothstep(16.0, 5.0, vDepth);
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export const dustVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uScroll;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float depth = clamp((p.z + 10.0) / 12.0, 0.0, 1.0); // 0 far, 1 near
    // Wrap vertically so the field is endless; nearer dust scrolls faster (parallax).
    p.y = mod(p.y + uScroll * (0.4 + depth * 1.6) + uTime * 0.05 * (0.5 + aSeed) + 9.0, 18.0) - 9.0;
    p.x += sin(uTime * 0.1 + aSeed * 30.0) * 0.3;
    p.xy += uPointer * depth * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (6.0 / -mv.z);
    vAlpha = (0.2 + 0.8 * depth) * (0.55 + 0.45 * sin(uTime * 1.3 + aSeed * 50.0));
  }
`;

export const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    float alpha = a * vAlpha * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;
