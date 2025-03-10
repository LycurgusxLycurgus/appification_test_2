import gameState from '../game/gameState';
import logger from './logger';

// Module name for logging
const MODULE = 'StateDiagnostics';

/**
 * Creates a snapshot of the current game state for diagnostic purposes
 * @param {Object} state - The game state object
 * @returns {Object} A snapshot of the current state
 */
export const createStateSnapshot = (state) => {
  return {
    timestamp: Date.now(),
    mode: state.mode,
    keys: {...state.keys},
    playerPosition: state.playerPosition ? {...state.playerPosition} : null,
    taskGamePosition: state.taskGamePosition ? {...state.taskGamePosition} : null,
    velocity: state.velocity ? {...state.velocity} : null,
    bullets: state.bullets ? state.bullets.map(b => ({...b})) : [],
    isJumping: state.isJumping
  };
};

/**
 * Compares two state snapshots and returns the differences
 * @param {Object} before - The state snapshot before
 * @param {Object} after - The state snapshot after
 * @returns {Object} An object containing the changes between snapshots
 */
export const compareSnapshots = (before, after) => {
  const changes = {};
  
  // Guard against null or undefined parameters
  if (!before || !after) {
    return changes;
  }
  
  // Compare all properties and log changes
  Object.keys(before).forEach(key => {
    if (key === 'timestamp') return;
    
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = {
        before: before[key],
        after: after[key]
      };
    }
  });
  
  return changes;
};

// Track state history for debugging
const stateHistory = [];

// Flag to enable/disable diagnostics
const DIAGNOSTICS_ENABLED = false;

/**
 * Records the current state in the history
 * @param {Object} state - The game state to record
 * @returns {Object} The snapshot that was recorded
 */
export const recordState = (state) => {
  if (!DIAGNOSTICS_ENABLED) return null;
  
  const snapshot = createStateSnapshot(state);
  stateHistory.push(snapshot);
  
  // Keep only last 100 snapshots to avoid memory issues
  if (stateHistory.length > 100) {
    stateHistory.shift();
  }
  
  logger.verbose(MODULE, `State recorded at ${new Date(snapshot.timestamp).toISOString()}`);
  return snapshot;
};

/**
 * Returns the recorded state history
 * @returns {Array} The state history
 */
export const getStateHistory = () => stateHistory;

/**
 * Tests player movement in task game mode
 * @param {Function} updateTaskGame - The update function for task game mode
 */
export function testTaskGameMovement(updateTaskGame) {
  if (!DIAGNOSTICS_ENABLED) return;
  
  logger.info(MODULE, "=== MOVEMENT TEST START ===");
  const beforeState = createStateSnapshot(gameState);
  
  // Simulate key press
  gameState.keys['d'] = true;
  
  // Manually call update
  updateTaskGame(16, gameState, gameState.canvas);
  
  // Check if position changed
  const afterState = createStateSnapshot(gameState);
  const changes = compareSnapshots(beforeState, afterState);
  
  logger.debug(MODULE, `Changes after right movement: ${JSON.stringify(changes)}`);
  logger.info(MODULE, "=== MOVEMENT TEST END ===");
  
  // Reset key state
  gameState.keys['d'] = false;
}

/**
 * Logs the current state of a specific property
 * @param {string} label - A label for the log
 * @param {Object} state - The game state
 * @param {string} property - The property to log
 */
export const logStateProperty = (label, state, property) => {
  if (!DIAGNOSTICS_ENABLED) return;
  logger.debug(MODULE, `${label} - ${property}: ${JSON.stringify(state[property])}`);
};

/**
 * Verifies that key game state properties are consistent
 * @param {Object} state - The game state to verify
 * @returns {Object} An object containing any inconsistencies found
 */
export const verifyStateConsistency = (state) => {
  if (!DIAGNOSTICS_ENABLED) return {};
  
  const issues = {};
  
  // Check for null or undefined properties that should exist
  const requiredProperties = ['mode', 'playerPosition', 'taskGamePosition', 'velocity', 'keys'];
  requiredProperties.forEach(prop => {
    if (state[prop] === undefined || state[prop] === null) {
      issues[prop] = `Missing required property: ${prop}`;
    }
  });
  
  // Check for position inconsistencies
  if (state.mode === 'TASK_GAME' && state.playerPosition && state.taskGamePosition) {
    // In task game mode, playerPosition should match taskGamePosition for consistency
    if (state.playerPosition.x !== state.taskGamePosition.x || 
        state.playerPosition.y !== state.taskGamePosition.y) {
      issues.positionMismatch = {
        playerPosition: {...state.playerPosition},
        taskGamePosition: {...state.taskGamePosition}
      };
    }
  }
  
  return issues;
};

/**
 * Creates a diagnostic UI button that can be added to the game
 * @param {Function} testFunction - The function to call when the button is clicked
 * @returns {HTMLElement} The created button
 */
export const createDiagnosticButton = (testFunction) => {
  if (!DIAGNOSTICS_ENABLED) return null;
  
  const button = document.createElement('button');
  button.textContent = 'Run Diagnostic';
  button.style.position = 'absolute';
  button.style.top = '10px';
  button.style.right = '10px';
  button.style.zIndex = '1000';
  button.style.padding = '8px 16px';
  button.style.backgroundColor = '#f44336';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  
  button.addEventListener('click', testFunction);
  
  document.body.appendChild(button);
  logger.info(MODULE, "Diagnostic button created");
  return button;
}; 