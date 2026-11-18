import * as THREE from 'three';

/**
 * A small gilt hexagon that floats over a way in or out: a door with an arrow for
 * leaving, a little house for home. Always faces the camera and draws over the scene.
 */
export function makeDoorIcon(kind: 'exit' | 'home'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const hex = (r: number) => {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
  };
  const gold = g.createLinearGradient(0, 0, 0, 128);
  gold.addColorStop(0, '#f6e3a6');
  gold.addColorStop(0.5, '#c9a24a');
  gold.addColorStop(1, '#7a5a1e');
  hex(60);
  g.fillStyle = gold;
  g.fill();
  hex(50);
  g.fillStyle = '#0f1a33';
  g.fill();
  g.strokeStyle = '#f0d78a';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (kind === 'exit') {
    // A door frame, open, with an arrow walking out of it.
    g.strokeRect(36, 34, 30, 60);
    g.beginPath();
    g.moveTo(58, 64);
    g.lineTo(96, 64);
    g.moveTo(84, 52);
    g.lineTo(96, 64);
    g.lineTo(84, 76);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(38, 62);
    g.lineTo(64, 38);
    g.lineTo(90, 62);
    g.moveTo(44, 58);
    g.lineTo(44, 92);
    g.lineTo(84, 92);
    g.lineTo(84, 58);
    g.moveTo(58, 92);
    g.lineTo(58, 74);
    g.lineTo(70, 74);
    g.lineTo(70, 92);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.renderOrder = 10;
  sprite.scale.setScalar(0.62);
  return sprite;
}
