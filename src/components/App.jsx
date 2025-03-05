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
    gameState.mode = newMode;
    setMode(newMode);
  };

  useEffect(() => {
    setupInputListeners();
  }, []);

  return (
    <div
      id="gameContainer"
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      {mode === '3D' && <ThreeScene />}
      {mode === '2D' && <PixiScene />}
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
