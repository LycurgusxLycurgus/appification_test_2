// src/game/inputManager.js
import gameState from './gameState';
import { closeTaskGame, shootTaskGame } from './taskGameSetup';
import { shootInTrainingArena } from './trainingArena2DSetup';
import { shootInTaskArena, handleLKeyInTaskArena } from './taskArena2DSetup';
// Import diagnostic utilities
import { recordState, compareSnapshots } from '../utils/stateDiagnostics';

/**
 * Shoots a bullet in 2D mode.
 */
function shoot2D() {
  // Ensure playerPosition and playerFacingDirection exist
  if (!gameState.playerPosition) {
    gameState.playerPosition = { 
      x: window.innerWidth / 2, 
      y: window.innerHeight - 100 
    };
  }
  
  if (gameState.playerFacingDirection === undefined) {
    gameState.playerFacingDirection = 1; // Default to facing right
  }
  
  // Ensure bullets array exists
  if (!gameState.bullets) {
    gameState.bullets = [];
  }
  
  const direction = gameState.playerFacingDirection;
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

export function setupInputListeners() {
  // Initialize keys object if it doesn't exist
  if (!gameState.keys) {
    gameState.keys = {};
  }
  
  // Initialize last shoot time and cooldown
  gameState.lastShootTime = 0;
  gameState.shootCooldown = 300; // milliseconds between shots
  
  // Set up keydown event listener
  window.addEventListener('keydown', (e) => {
    // Store key state
    const key = e.key.toLowerCase();
    const wasPressed = gameState.keys[key];
    gameState.keys[key] = true;
    
    // Only log if key wasn't already pressed (to avoid console spam)
    if (!wasPressed) {
      console.log(`🔑 Key pressed: ${key} in mode: ${gameState.mode}`);
      
      // Log critical state variables
      console.log("🔍 State at key press:", {
        mode: gameState.mode,
        isPaused: gameState.isPaused,
        currentTaskChallenge: gameState.currentTaskChallenge,
        position: gameState.mode === 'TASK_GAME' ? gameState.taskGamePosition : gameState.playerPosition,
        velocity: gameState.velocity
      });
    }
    
    // Handle shooting with L key
    if (key === 'l') {
      const currentTime = Date.now();
      
      // Check cooldown
      if (currentTime - gameState.lastShootTime > gameState.shootCooldown) {
        gameState.lastShootTime = currentTime;
        
        // Log shooting attempt
        console.log("🔫 Shooting in mode:", gameState.mode);
        console.log("🔫 Player position:", gameState.playerPosition);
        console.log("🔫 Facing direction:", gameState.playerFacingDirection);
        console.log("🔫 Current bullets:", gameState.bullets ? gameState.bullets.length : 0);
        
        // Log full game state at shoot time
        console.log("🔍 Full game state at shoot time:", {
          mode: gameState.mode,
          isPaused: gameState.isPaused,
          currentTaskChallenge: gameState.currentTaskChallenge,
          playerPosition: gameState.playerPosition,
          taskGamePosition: gameState.taskGamePosition,
          playerFacingDirection: gameState.playerFacingDirection,
          bulletCount: gameState.bullets ? gameState.bullets.length : 0,
          lastShootTime: gameState.lastShootTime
        });
        
        // Handle shooting based on current mode with error handling
        try {
          switch(gameState.mode) {
            case '2D':
              shoot2D();
              break;
            case '2D_TRAINING':
              shootInTrainingArena();
              break;
            case '2D_TASK_ARENA':
              console.log("🔫 L key pressed in 2D_TASK_ARENA mode");
              handleLKeyInTaskArena();
              break;
            case 'TASK_GAME':
              console.log("🔫 Shooting in TASK_GAME mode");
              shootTaskGame();
              break;
            default:
              console.warn(`⚠️ No shooting mechanism defined for mode: ${gameState.mode}`);
          }
          
          // Log bullets after shooting
          console.log("🔫 Bullets after shooting:", gameState.bullets ? gameState.bullets.length : 0);
          if (gameState.bullets && gameState.bullets.length > 0) {
            const lastBullet = gameState.bullets[gameState.bullets.length - 1];
            console.log("🔫 Last bullet:", {
              position: `${lastBullet.x.toFixed(2)}, ${lastBullet.y.toFixed(2)}`,
              velocity: `${lastBullet.vx}, ${lastBullet.vy}`
            });
          }
        } catch (error) {
          console.error(`❌ Error shooting in ${gameState.mode} mode:`, error);
        }
      }
    }
    
    // Handle diagnostic test with T key
    if (key === 't') {
      console.log("🔍 T key pressed - running diagnostic");
      
      // Log critical state variables
      console.log("🔍 Current game state:", {
        mode: gameState.mode,
        isPaused: gameState.isPaused,
        currentTaskChallenge: gameState.currentTaskChallenge,
        position: gameState.mode === 'TASK_GAME' ? gameState.taskGamePosition : gameState.playerPosition,
        velocity: gameState.velocity,
        keyStates: Object.entries(gameState.keys).filter(([k, v]) => v).map(([k]) => k)
      });
    }
    
    // Handle mode switching with number keys
    if (e.key === '1' && gameState.mode !== '3D') {
      gameState.mode = '3D';
      if (gameState.setMode) {
        gameState.setMode('3D');
      }
    } else if (e.key === '2' && gameState.mode !== '2D') {
      gameState.mode = '2D';
      if (gameState.setMode) {
        gameState.setMode('2D');
      }
    } else if (e.key === '3' && gameState.mode !== 'TASK_GAME') {
      gameState.mode = 'TASK_GAME';
      if (gameState.setMode) {
        gameState.setMode('TASK_GAME');
      }
    }
  });
  
  // Set up keyup event listener
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    gameState.keys[key] = false;
    
    // Log key release
    console.log(`🔑 Key released: ${key} in mode: ${gameState.mode}`);
  });
  
  // Set up window blur event to reset all keys
  window.addEventListener('blur', () => {
    console.log("🔑 Reset all key states due to window blur");
    for (const key in gameState.keys) {
      gameState.keys[key] = false;
    }
  });
  
  console.log("🔑 Input listeners set up");
}

console.log("Displaying file contents for debugging");
