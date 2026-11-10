import { CanvasTexture, SRGBColorSpace } from 'three';

import { CODE_COLORS, codeLines, type SceneData } from './code';

const COLORS = {
  ...CODE_COLORS,
  bg: '#0d1117',
  bar: '#161b22',
  faint: '#6e7681',
  cursor: '#2bb8f2',
};

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** A code editor drawn on a canvas, used as the laptop's display texture. */
export function createScreen(data: SceneData, resolution = 1) {
  // Layout is in 1024×640 units; `resolution` scales the actual pixels (0.5 on phones,
  // where the laptop is small, so each redraw uploads 4× less to the GPU).
  const W = 1024;
  const H = 640;
  const canvas = Object.assign(document.createElement('canvas'), { width: W * resolution, height: H * resolution });
  const ctx = canvas.getContext('2d')!;
  ctx.scale(resolution, resolution);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  const lines = codeLines(data);
  /** Every character in typing order, with "\n" ending each line (so the keyboard can press them). */
  const chars = lines.flatMap((line) => [...line.map(([text]) => text).join(''), '\n']);
  const total = chars.length;

  /** Draws the editor with the first `chars` characters typed. */
  const draw = (chars: number, cursorVisible: boolean) => {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Title bar: window buttons and the file tab.
    ctx.fillStyle = COLORS.bar;
    ctx.fillRect(0, 0, W, 56);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(30 + i * 26, 28, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = COLORS.bg;
    ctx.beginPath();
    ctx.font = `500 21px ${FONT}`;
    ctx.roundRect(120, 12, Math.max(210, ctx.measureText(data.fileName).width + 52), 44, [10, 10, 0, 0]);
    ctx.fill();
    ctx.font = `500 21px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(data.fileName, 146, 41);

    // Code, line by line, cut off at the typing position.
    const lineHeight = 46;
    const top = 112;
    const left = 104;
    ctx.font = `500 26px ${FONT}`;
    let remaining = chars;
    let cursor = { x: left, y: top, line: 0 };
    for (let i = 0; i < lines.length && remaining >= 0; i++) {
      const y = top + i * lineHeight;
      ctx.fillStyle = COLORS.faint;
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), 66, y);
      ctx.textAlign = 'left';
      let x = left;
      for (const [text, color] of lines[i]) {
        const part = text.slice(0, Math.max(0, remaining));
        ctx.fillStyle = COLORS[color];
        ctx.fillText(part, x, y);
        x += ctx.measureText(part).width;
        remaining -= text.length;
        if (remaining < 0) break;
      }
      cursor = { x, y, line: i };
      remaining -= 1;
    }
    if (cursorVisible) {
      ctx.fillStyle = COLORS.cursor;
      ctx.fillRect(cursor.x + 2, cursor.y - 24, 13, 32);
    }

    // Status bar.
    ctx.fillStyle = COLORS.bar;
    ctx.fillRect(0, H - 40, W, 40);
    ctx.font = `500 18px ${FONT}`;
    ctx.fillStyle = COLORS.faint;
    ctx.fillText('main  ·  TypeScript  ·  UTF-8', 24, H - 13);
    ctx.textAlign = 'right';
    ctx.fillText(`Ln ${cursor.line + 1}, Col ${Math.max(1, Math.round((cursor.x - left) / 15.6) + 1)}`, W - 24, H - 13);
    ctx.textAlign = 'left';

    texture.needsUpdate = true;
  };

  return { texture, chars, total, draw };
}
