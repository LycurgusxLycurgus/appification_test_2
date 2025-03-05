// src/game/inputManager.js
import gameState from './gameState';
import { closeTaskGame, shootTaskGame } from './taskGameSetup';

/**
 * Shoots a bullet in 2D mode.
 */
function shoot2D() {
  const direction = gameState.playerFacingDirection || 1;
  const bullet = {
    x: gameState.playerPosition.x + (direction > 0 ? 40 : 0),
    y: gameState.playerPosition.y + 25,
    vx: direction * 10,
    vy: 0,
    size: 5,
    color: '#FFFF00'
  };
  gameState.bullets.push(bullet);
}

export const setupInputListeners = () => {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // If game is paused (e.g. when an input is open), only allow Escape
    // and don't process any other game inputs
    if (gameState.isPaused) {
      if (key === 'escape') {
        const inputEl = document.getElementById('taskGameInput');
        if (inputEl) {
          document.body.removeChild(inputEl);
          gameState.isPaused = false;
        }
      }
      return;
    }

    gameState.keys[key] = true;

    // In TASK_GAME mode, Tab or Escape exits the mini-game.
    if (gameState.mode === 'TASK_GAME' && (key === 'tab' || key === 'escape')) {
      e.preventDefault();
      closeTaskGame();
      return;
    }

    // Shoot with L key in 2D or TASK_GAME modes.
    if (key === 'l') {
      const currentTime = Date.now();
      if (currentTime - gameState.lastShootTime > gameState.shootCooldown) {
        gameState.lastShootTime = currentTime;
        if (gameState.mode === '2D') {
          shoot2D();
        } else if (gameState.mode === 'TASK_GAME') {
          shootTaskGame(gameState);
        }
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    // Don't process key up events when paused
    if (gameState.isPaused) return;
    
    const key = e.key.toLowerCase();
    gameState.keys[key] = false;
  });

  // Mousemove (for 3D aiming) remains unchanged.
  window.addEventListener('mousemove', (e) => {
    if (!gameState.isPaused) {
      gameState.mousePosition.x = e.clientX;
      gameState.mousePosition.y = e.clientY;
    }
  });
};
