import React, { useEffect } from 'react';
import gameState from '../game/gameState';
import { setupTaskGameEnvironment } from '../game/taskGameSetup';

const TaskGame = () => {
  // Initialization on mount
  useEffect(() => {
    console.log("TaskGame component mounted");
    
    // Wait for the next frame to ensure gameState.canvas is available
    const timeoutId = setTimeout(() => {
      // Check if canvas is available from PixiScene
      if (gameState.canvas) {
        console.log("Using canvas from PixiScene:", gameState.canvas.width, "x", gameState.canvas.height);
        
        // Initialize the task game environment with the existing canvas
        setupTaskGameEnvironment(gameState, gameState.canvas);
      } else {
        console.error("Canvas not available in gameState - PixiScene may not be mounted correctly");
      }
    }, 50);
    
    // Clean up timeout on unmount
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // TaskGame component doesn't render anything visible
  // It just initializes the task game environment
  return null;
};

export default TaskGame; 