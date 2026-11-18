import './style.css';
import { Game } from './engine/Game';
import { initPwa } from './pwa';

initPwa();
new Game(document.getElementById('game')!);
