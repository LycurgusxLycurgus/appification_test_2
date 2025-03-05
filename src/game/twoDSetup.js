// src/game/twoDSetup.js
import { enterTaskGame } from './taskGameSetup';

export const init2DEnvironment = (container, state) => {
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Show canvas when in 2D or TASK_GAME mode
  canvas.style.display = state.mode !== '3D' ? 'block' : 'none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Initialize game elements:
  state.platforms = createPlatforms(canvas);
  state.enemies = createEnemies(canvas);
  state.gameApps = createGameApps(canvas);

  return { canvas, ctx };
};

const createPlatforms = (canvas) => [
  { x: 0, y: canvas.height - 50, width: canvas.width, height: 50 },
  { x: 200, y: canvas.height - 150, width: 200, height: 20 },
  { x: 500, y: canvas.height - 250, width: 200, height: 20 },
  { x: 800, y: canvas.height - 350, width: 200, height: 20 },
  { x: 300, y: canvas.height - 450, width: 400, height: 20 }
];

const createEnemies = (canvas) => [
  { x: 300, y: canvas.height - 180, width: 40, height: 40, health: 2, maxHealth: 2, type: 'basic', color: '#F44336' },
  { x: 550, y: canvas.height - 280, width: 40, height: 40, health: 2, maxHealth: 2, type: 'basic', color: '#F44336' },
  { x: 850, y: canvas.height - 380, width: 40, height: 40, health: 2, maxHealth: 2, type: 'basic', color: '#F44336' }
];

const createGameApps = (canvas) => [
  { x: 650, y: canvas.height - 480, width: 60, height: 60, type: 'portal', label: 'Portal to 3D' },
  { x: 250, y: canvas.height - 180, width: 40, height: 40, type: 'app', app: 'notes', label: 'Notes' },
  { x: 600, y: canvas.height - 280, width: 40, height: 40, type: 'app', app: 'timer', label: 'Timer' },
  { x: 400, y: canvas.height - 480, width: 50, height: 50, type: 'app', app: 'tasks', label: 'Tasks', color: '#4CAF50' }
];

export const update2D = (deltaTime, state) => {
  if (state.isPaused) return;
  const moveSpeed = 5;
  const jumpPower = 15;
  const gravity = state.gravity;
  state.velocity.x = 0;

  // Update player movement based on keyboard controls
  if (state.keys['a'] || state.keys['arrowleft']) {
    state.velocity.x = -moveSpeed;
    state.playerFacingDirection = -1;
  }
  if (state.keys['d'] || state.keys['arrowright']) {
    state.velocity.x = moveSpeed;
    state.playerFacingDirection = 1;
  }
  if ((state.keys['w'] || state.keys['arrowup'] || state.keys[' ']) && !state.isJumping) {
    state.velocity.y = -jumpPower;
    state.isJumping = true;
  }
  
  // Apply gravity
  state.velocity.y += gravity;
  
  // Cap maximum falling speed to prevent tunneling through platforms
  const maxFallSpeed = 15;
  if (state.velocity.y > maxFallSpeed) {
    state.velocity.y = maxFallSpeed;
  }
  
  // Update position
  state.playerPosition.x += state.velocity.x;
  state.playerPosition.y += state.velocity.y;

  // Platform collision (improved to handle high velocities)
  let onPlatform = false;
  state.platforms.forEach(platform => {
    // Check if player is within horizontal bounds of the platform
    if (
      state.playerPosition.x + 30 > platform.x &&
      state.playerPosition.x < platform.x + platform.width
    ) {
      // Check if player is landing on top of platform
      if (
        state.playerPosition.y + 50 >= platform.y &&
        state.playerPosition.y + 50 - state.velocity.y <= platform.y
      ) {
        state.playerPosition.y = platform.y - 50;
        state.velocity.y = 0;
        state.isJumping = false;
        onPlatform = true;
      }
    }
  });

  // Ensure player doesn't fall through the bottom of the screen
  if (state.playerPosition.y > window.innerHeight) {
    state.playerPosition.y = window.innerHeight - 50;
    state.velocity.y = 0;
    state.isJumping = false;
  }

  // Update bullets with collision detection
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy || 0;

    // Remove bullet if offscreen
    if (
      bullet.x < 0 ||
      bullet.x > window.innerWidth ||
      bullet.y < 0 ||
      bullet.y > window.innerHeight
    ) {
      state.bullets.splice(i, 1);
      continue;
    }

    // Check collisions with enemies
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const enemy = state.enemies[j];
      if (
        bullet.x > enemy.x &&
        bullet.x < enemy.x + enemy.width &&
        bullet.y > enemy.y &&
        bullet.y < enemy.y + enemy.height
      ) {
        enemy.health = (enemy.health || 2) - 1;
        state.bullets.splice(i, 1);
        if (enemy.health <= 0) {
          if (enemy.type === 'app') {
            alert(`Activating ${enemy.app} app`);
          } else {
            state.score += 10;
          }
          state.enemies.splice(j, 1);
        }
        break;
      }
    }

    // If bullet still exists, check collisions with game apps
    if (i < state.bullets.length) {
      for (let k = 0; k < state.gameApps.length; k++) {
        const app = state.gameApps[k];
        if (
          bullet.x > app.x &&
          bullet.x < app.x + app.width &&
          bullet.y > app.y &&
          bullet.y < app.y + app.height
        ) {
          if (app.type === 'portal') {
            if (state.setMode) {
              state.setMode('3D');
            } else {
              state.mode = '3D';
            }
          } else if (app.type === 'app') {
            if (app.app === 'tasks') {
              enterTaskGame();
            } else {
              alert(`Activating ${app.app} app`);
            }
          }
          state.bullets.splice(i, 1);
          break;
        }
      }
    }
  }
};

export const render2D = (ctx, state, canvas) => {
  // Clear canvas and draw background gradient
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#1a2b3c');
  gradient.addColorStop(1, '#2c3e50');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw platforms
  ctx.fillStyle = '#8b5d33';
  state.platforms.forEach(platform => {
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = '#734d26';
    ctx.fillRect(platform.x, platform.y, platform.width, 5);
    ctx.fillStyle = '#8b5d33';
  });

  // Draw game app objects
  state.gameApps.forEach(app => {
    if (app.type === 'portal') {
      ctx.fillStyle = '#00BFFF';
      ctx.beginPath();
      ctx.arc(app.x + app.width / 2, app.y + app.height / 2, app.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#00BFFF';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(app.label, app.x + app.width / 2, app.y + app.height + 15);
    } else {
      ctx.fillStyle = app.color || '#4CAF50';
      ctx.fillRect(app.x, app.y, app.width, app.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      let icon = 'A';
      if (app.app === 'tasks') icon = 'T';
      if (app.app === 'notes') icon = 'N';
      if (app.app === 'timer') icon = 'C';
      ctx.fillText(icon, app.x + app.width / 2, app.y + app.height / 2 + 6);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(app.label, app.x + app.width / 2, app.y + app.height + 15);
    }
  });

  // Draw enemies
  state.enemies.forEach(enemy => {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    if (enemy.type === 'app') {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('A', enemy.x + enemy.width / 2, enemy.y + enemy.height / 2 + 5);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(enemy.x + enemy.width * 0.3, enemy.y + enemy.height * 0.3, 4, 0, Math.PI * 2);
      ctx.arc(enemy.x + enemy.width * 0.7, enemy.y + enemy.height * 0.3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const healthPercent = enemy.health / (enemy.maxHealth || 2);
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(enemy.x, enemy.y - 10, enemy.width, 5);
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(enemy.x, enemy.y - 10, enemy.width * healthPercent, 5);
  });

  // Draw bullets
  ctx.fillStyle = '#FFFF00';
  state.bullets.forEach(bullet => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw player
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(state.playerPosition.x, state.playerPosition.y, 40, 50);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const faceDirection = state.playerFacingDirection > 0 ? 1 : -1;
  const eyeOffset = faceDirection * 5;
  ctx.arc(state.playerPosition.x + 15 + eyeOffset, state.playerPosition.y + 15, 3, 0, Math.PI * 2);
  ctx.arc(state.playerPosition.x + 25 + eyeOffset, state.playerPosition.y + 15, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (faceDirection > 0) {
    ctx.moveTo(state.playerPosition.x + 30, state.playerPosition.y + 25);
    ctx.lineTo(state.playerPosition.x + 45, state.playerPosition.y + 25);
  } else {
    ctx.moveTo(state.playerPosition.x + 10, state.playerPosition.y + 25);
    ctx.lineTo(state.playerPosition.x - 5, state.playerPosition.y + 25);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, canvas.height - 60, 200, 50);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Tokens: ${state.taskTokens}`, 20, canvas.height - 30);
};
