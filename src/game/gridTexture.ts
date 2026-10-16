import * as THREE from 'three';

/**
 * A neon grid texture drawn on a canvas, so the game ships no external image and start.ng
 * has nothing to fetch or check.
 *
 * The texture is tiled along z and its offset is scrolled every frame to convey speed.
 */
export function createGridTexture(
  cell = 64,
  lines = 2,
  color = '#39ff88',
  background = '#07030f',
): THREE.Texture {
  const size = cell;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = lines;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, size);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(size, 0.5);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 24);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
