import gameState from './gameState';
// Import the diagnostic utilities
import { recordState, compareSnapshots, logStateProperty, verifyStateConsistency } from '../utils/stateDiagnostics';

// Track the current transition state
let isTransitioning = false;
let transitionCallback = null;

/**
 * Reset all key states to prevent stuck keys after mode transitions
 */
export function resetAllKeyStates() {
  console.log("🔑 Resetting all key states");
  if (gameState.keys) {
    for (const key in gameState.keys) {
      gameState.keys[key] = false;
    }
  }
}

/**
 * Preserve player state during transitions
 * @param {string} fromMode - The mode transitioning from
 * @param {string} toMode - The mode transitioning to
 */
export function preservePlayerState(fromMode, toMode) {
  console.log(`🔄 Preserving player state during transition from ${fromMode} to ${toMode}`);
  
  try {
    // Log state before preservation
    console.log("🔍 State before preservation:", {
      mode: gameState.mode,
      isPaused: gameState.isPaused,
      currentTaskChallenge: gameState.currentTaskChallenge,
      playerPosition: gameState.playerPosition,
      taskGamePosition: gameState.taskGamePosition,
      velocity: gameState.velocity,
      isJumping: gameState.isJumping
    });
    
    // Preserve task game position when transitioning between task game and task arena
    if (fromMode === '2D_TASK_ARENA' && toMode === 'TASK_GAME') {
      // CRITICAL FIX: Explicitly reset these state variables during transition
      gameState.isPaused = false;
      gameState.currentTaskChallenge = undefined;
      
      // Ensure we have a saved position to restore
      if (gameState.savedTaskGamePosition) {
        console.log("🔄 Restoring saved task game position:", gameState.savedTaskGamePosition);
        gameState.taskGamePosition = {
          x: gameState.savedTaskGamePosition.x,
          y: gameState.savedTaskGamePosition.y
        };
        
        // Also update playerPosition for consistency
        gameState.playerPosition = {
          x: gameState.savedTaskGamePosition.x,
          y: gameState.savedTaskGamePosition.y
        };
      } else {
        console.warn("⚠️ No saved task game position found, using default");
        gameState.taskGamePosition = {
          x: window.innerWidth / 2,
          y: window.innerHeight - 100
        };
        
        // Also update playerPosition for consistency
        gameState.playerPosition = {
          x: window.innerWidth / 2,
          y: window.innerHeight - 100
        };
      }
      
      // Reset velocity and jumping state
      gameState.velocity = { x: 0, y: 0 };
      gameState.isJumping = false;
      
      // Ensure bullets array is initialized but not cleared
      if (!gameState.bullets) {
        gameState.bullets = [];
      }
    }
    
    // Log state after preservation
    console.log("🔍 State after preservation:", {
      mode: gameState.mode,
      isPaused: gameState.isPaused,
      currentTaskChallenge: gameState.currentTaskChallenge,
      playerPosition: gameState.playerPosition,
      taskGamePosition: gameState.taskGamePosition,
      velocity: gameState.velocity,
      isJumping: gameState.isJumping
    });
  } catch (error) {
    console.error("❌ Error in preservePlayerState:", error);
  }
}

/**
 * Safely transition between game modes without unmounting PixiScene
 * @param {string} targetMode - The mode to transition to
 * @param {Object} options - Additional transition options
 * @param {Function} callback - Optional callback after transition completes
 */
export function transitionGameMode(targetMode, options = {}, callback = null) {
  console.log(`🔄 Mode transition requested: ${gameState.mode} -> ${targetMode}`);
  
  // Set transitioning flag to prevent component unmounting
  isTransitioning = true;
  transitionCallback = callback;
  
  // Store previous mode for potential rollback
  const previousMode = gameState.mode;
  gameState.previousMode = previousMode;
  
  // Reset all key states to prevent stuck keys
  resetAllKeyStates();
  
  // Log state before transition
  console.log("🔍 State before transition:", {
    mode: gameState.mode,
    isPaused: gameState.isPaused,
    currentTaskChallenge: gameState.currentTaskChallenge
  });
  
  // Dispatch a pre-transition event for components to prepare
  const preTransitionEvent = new CustomEvent('gamePreModeTransition', {
    detail: { from: previousMode, to: targetMode, options }
  });
  window.dispatchEvent(preTransitionEvent);
  
  // Preserve player state before changing modes
  preservePlayerState(previousMode, targetMode);
  
  // Update the game state mode
  gameState.mode = targetMode;
  if (gameState.setMode) {
    gameState.setMode(targetMode);
  }
  
  // CRITICAL FIX: Explicitly reset these state variables during transition
  if (targetMode === 'TASK_GAME') {
    gameState.isPaused = false;
    gameState.currentTaskChallenge = undefined;
    
    console.log("🔍 Critical state variables reset during transition:", {
      isPaused: gameState.isPaused,
      currentTaskChallenge: gameState.currentTaskChallenge
    });
  }
  
  // Allow a small delay for React to process the state change
  // without unmounting components
  setTimeout(() => {
    // Reset key states again after the transition
    resetAllKeyStates();
    
    // Dispatch post-transition event
    const postTransitionEvent = new CustomEvent('gamePostModeTransition', {
      detail: { from: previousMode, to: targetMode, options }
    });
    window.dispatchEvent(postTransitionEvent);
    
    // Reset transition state
    isTransitioning = false;
    
    // Execute callback if provided
    if (transitionCallback) {
      transitionCallback();
      transitionCallback = null;
    }
    
    // Double-check key states after a short delay
    setTimeout(() => {
      resetAllKeyStates();
      
      // Log state after transition
      console.log("🔍 State after transition:", {
        mode: gameState.mode,
        isPaused: gameState.isPaused,
        currentTaskChallenge: gameState.currentTaskChallenge
      });
      
      // CRITICAL FIX: For TASK_GAME mode, ensure the task game environment is set up
      if (targetMode === 'TASK_GAME' && gameState.canvas) {
        import('./taskGameSetup').then(module => {
          module.setupTaskGameEnvironment(gameState, gameState.canvas);
          
          // Triple-check state variables
          console.log("🔍 Final state check after setup:", {
            mode: gameState.mode,
            isPaused: gameState.isPaused,
            currentTaskChallenge: gameState.currentTaskChallenge
          });
        }).catch(error => {
          console.error("❌ Error importing taskGameSetup:", error);
        });
      }
    }, 100);
  }, 50);
}

/**
 * Check if a mode transition is currently in progress
 * @returns {boolean} True if transitioning between modes
 */
export function isInModeTransition() {
  return isTransitioning;
}

/**
 * Register a listener for mode transitions
 * @param {string} eventType - Either 'pre' or 'post'
 * @param {Function} listener - Callback function
 */
export function addModeTransitionListener(eventType, listener) {
  const eventName = eventType === 'pre' ? 'gamePreModeTransition' : 'gamePostModeTransition';
  window.addEventListener(eventName, listener);
  
  // Return a function to remove the listener
  return () => {
    window.removeEventListener(eventName, listener);
  };
}
