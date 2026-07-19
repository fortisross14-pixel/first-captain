import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { TownScene } from './scenes/TownScene';
import { InteriorScene } from './scenes/InteriorScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#10150e',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TownScene, InteriorScene],
};

new Phaser.Game(config);
