import React, { useEffect, useState } from 'react';
import ThreeScene from './ThreeScene';
import PixiScene from './PixiScene';
import TaskGame from './TaskGame';
import Overlay from './Overlay';
import TaskMenu from './TaskMenu';
import { setupInputListeners } from '../game/inputManager';
import gameState from '../game/gameState';

const App = () => {
  const [mode, setMode] = useState(gameState.mode);

  // Attach a setMode function to gameState so other modules can update the React state.
  gameState.setMode = (newMode) => {
    console.log("Setting game mode from", gameState.mode, "to", newMode);
    gameState.mode = newMode;
    setMode(newMode);
  };

  useEffect(() => {
    setupInputListeners();
  }, []);

  // Determine if we're in any 2D-based mode
  const is2DBasedMode = ['2D', '2D_TRAINING', '2D_TASK_ARENA', 'TASK_GAME'].includes(mode);
  
  return (
    <div
      id="gameContainer"
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      {mode === '3D' && <ThreeScene />}
      
      {/* Always keep PixiScene mounted for all 2D-based modes */}
      {is2DBasedMode && <PixiScene />}
      
      {/* TaskGame component is now only for UI elements specific to task game mode */}
      {mode === 'TASK_GAME' && <TaskGame />}
      
      <Overlay mode={mode} />
      <TaskMenu mode={mode} />
      
      {/* Add crosshair only in 3D mode */}
      {mode === '3D' && (
        <div
          id="crosshair"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '20px',
            color: 'white',
            zIndex: 100,
            pointerEvents: 'none'
          }}
        >
          +
        </div>
      )}
    </div>
  );
};

export default App;