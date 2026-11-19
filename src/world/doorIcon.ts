import * as THREE from 'three';

export type DoorIconKind = 'exit' | 'home' | 'enter' | 'up' | 'down';

/**
 * A small medallion that floats over every way in or out: a door with an arrow going in or out,
 * a little house for home, a stair for going up or down. Silver-rimmed and lit blue, like the HUD.
 * Always faces the camera and draws over the scene.
 */
export function makeDoorIcon(kind: DoorIconKind): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const halo = g.createRadialGradient(64, 64, 40, 64, 64, 64);
  halo.addColorStop(0, 'rgba(79,159,224,.55)');
  halo.addColorStop(1, 'rgba(79,159,224,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 128, 128);
  const rim = g.createLinearGradient(0, 8, 0, 120);
  rim.addColorStop(0, '#f4f0e6');
  rim.addColorStop(0.42, '#9aa0ae');
  rim.addColorStop(0.56, '#3a3f4c');
  rim.addColorStop(1, '#b8bcc6');
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fillStyle = rim;
  g.fill();
  const disc = g.createRadialGradient(64, 50, 4, 64, 64, 48);
  disc.addColorStop(0, '#2a3a60');
  disc.addColorStop(0.7, '#0c1222');
  disc.addColorStop(1, '#060a14');
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.fillStyle = disc;
  g.fill();
  g.strokeStyle = '#d6ecff';
  g.shadowColor = '#4f9fe0';
  g.shadowBlur = 10;
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  if (kind === 'exit' || kind === 'enter') {
    // A door frame, and an arrow walking out of it (or into it).
    g.strokeRect(kind === 'exit' ? 40 : 58, 38, 28, 52);
    if (kind === 'exit') {
      g.moveTo(60, 64); g.lineTo(94, 64); g.moveTo(83, 53); g.lineTo(94, 64); g.lineTo(83, 75);
    } else {
      g.moveTo(32, 64); g.lineTo(66, 64); g.moveTo(55, 53); g.lineTo(66, 64); g.lineTo(55, 75);
    }
  } else if (kind === 'home') {
    g.moveTo(38, 62); g.lineTo(64, 38); g.lineTo(90, 62);
    g.moveTo(44, 58); g.lineTo(44, 90); g.lineTo(84, 90); g.lineTo(84, 58);
    g.moveTo(58, 90); g.lineTo(58, 73); g.lineTo(70, 73); g.lineTo(70, 90);
  } else {
    // Stairs, with an arrow up or down.
    g.moveTo(34, 90); g.lineTo(34, 78); g.lineTo(50, 78); g.lineTo(50, 64); g.lineTo(66, 64); g.lineTo(66, 50); g.lineTo(82, 50); g.lineTo(82, 90); g.closePath();
    if (kind === 'up') { g.moveTo(88, 44); g.lineTo(96, 34); g.lineTo(104, 44); g.moveTo(96, 34); g.lineTo(96, 58); }
    else { g.moveTo(88, 48); g.lineTo(96, 58); g.lineTo(104, 48); g.moveTo(96, 34); g.lineTo(96, 58); }
  }
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.renderOrder = 10;
  sprite.scale.setScalar(0.66);
  return sprite;
}
