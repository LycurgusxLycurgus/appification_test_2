import React, { useRef, useEffect } from 'react';
import gameState from '../game/gameState';
import { setupTaskGameEnvironment, updateTaskGame, renderTaskGame, closeTaskGame } from '../game/taskGameSetup';

const TaskGame = () => {
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);

  // Initialization on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set canvas dimensions to match window
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Initialize the task game environment
      setupTaskGameEnvironment(gameState, canvas);
      
      // Initialize FPS tracking
      gameState.lastFpsUpdate = performance.now();
      gameState.frameCount = 0;
      
      // Set up the game loop
      let lastTime = performance.now();
      const loop = (time) => {
        const deltaTime = time - lastTime;
        lastTime = time;
        
        // Only update and render if we're still in TASK_GAME mode
        if (gameState.mode === 'TASK_GAME') {
          updateTaskGame(deltaTime, gameState, canvas);
          renderTaskGame(canvas.getContext('2d'), gameState, canvas);
          
          // Calculate FPS
          gameState.frameCount++;
          const now = performance.now();
          const elapsed = now - gameState.lastFpsUpdate;
          
          // Update FPS display every 500ms
          if (elapsed >= 500) {
            gameState.fps = Math.round((gameState.frameCount * 1000) / elapsed);
            
            // Update the FPS display
            const fpsElement = document.getElementById('fps');
            if (fpsElement) {
              fpsElement.textContent = gameState.fps;
            }
            
            // Reset counters
            gameState.lastFpsUpdate = now;
            gameState.frameCount = 0;
          }
          
          animationFrameId.current = requestAnimationFrame(loop);
        }
      };
      
      // Start the game loop
      animationFrameId.current = requestAnimationFrame(loop);
    }
    
    // Clean up on unmount
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Recalculate task game environment when window is resized
        setupTaskGameEnvironment(gameState, canvas);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      width={window.innerWidth} 
      height={window.innerHeight} 
      style={{ display: 'block' }} 
    />
  );
};

export default TaskGame; 