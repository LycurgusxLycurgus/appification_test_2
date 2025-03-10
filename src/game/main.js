import { updateTrainingArena2D, renderTrainingArena2D } from './trainingArena2DSetup';

// Main game loop
function gameLoop(timestamp) {
  // Calculate delta time
  const deltaTime = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  
  // Update and render based on current mode
  if (gameState.mode === '3D') {
    // ... existing 3D mode code ...
  } else if (gameState.mode === '2D') {
    // ... existing 2D mode code ...
  } else if (gameState.mode === 'TASK_GAME') {
    // ... existing task game mode code ...
  } else if (gameState.mode === '2D_TRAINING') {
    // Update and render 2D training arena
    updateTrainingArena2D(deltaTime);
    renderTrainingArena2D();
  }
  
  // Request next frame
  requestAnimationFrame(gameLoop);
} 