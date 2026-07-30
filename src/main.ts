import { startGame } from './game';

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('canvas #stage is missing from the page');
}

startGame(canvas);
