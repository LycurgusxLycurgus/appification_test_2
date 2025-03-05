import React from 'react';

const Overlay = ({ mode }) => {
  return (
    <div
      id="overlay"
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px'
      }}
    >
      <div id="stats">
        FPS: <span id="fps">0</span> | Mode: <span id="mode">{mode}</span>
      </div>
      <div id="controls">
        {mode === '3D' && (
          <>
            [WASD] Move | [Mouse] Look/Aim | [Click] Shoot | [E] Interact
          </>
        )}
        {mode === '2D' && (
          <>
            [A/D] Move &amp; Face | [W/Space] Jump | [L] Shoot
          </>
        )}
        {mode === 'TASK_GAME' && (
          <>
            [A/D] Move &amp; Face | [W/Space] Jump | [L] Shoot | [Tab/Esc] Exit
          </>
        )}
      </div>
    </div>
  );
};

export default Overlay;
