// GLSL for the background dust. Its motion happens on the GPU; the CPU only
// updates a few uniforms per frame.

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
