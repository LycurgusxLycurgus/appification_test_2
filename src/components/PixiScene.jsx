import React, { useEffect, useRef, useState } from 'react';
import { init2DEnvironment, update2D, render2D } from '../game/twoDSetup';
import gameState from '../game/gameState';

const PixiScene = ({ mode }) => {
  const containerRef = useRef(null);
  const [canvas2D, setCanvas2D] = useState(null);
  const [ctx, setCtx] = useState(null);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const { canvas, ctx } = init2DEnvironment(containerRef.current, gameState);
    setCanvas2D(canvas);
    setCtx(ctx);

    // Initialize FPS tracking
    gameState.lastFpsUpdate = performance.now();
    gameState.frameCount = 0;
    
    let lastTime = performance.now();
    const animate = (time) => {
      if (gameState.mode === '2D') {
        const deltaTime = time - lastTime;
        lastTime = time;
        
        // Update and render 2D scene
        update2D(deltaTime, gameState);
        render2D(ctx, gameState, canvas);
        
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
        
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };
    
    // Start the animation loop
    animationFrameId.current = requestAnimationFrame(animate);
    
    // Clean up animation frame on unmount
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Reset animation loop when returning to 2D mode
  useEffect(() => {
    if (gameState.mode === '2D' && ctx && canvas2D) {
      // Cancel any existing animation frame
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      // Reset the animation loop
      let lastTime = performance.now();
      const animate = (time) => {
        if (gameState.mode === '2D') {
          const deltaTime = time - lastTime;
          lastTime = time;
          
          // Update and render 2D scene
          update2D(deltaTime, gameState);
          render2D(ctx, gameState, canvas2D);
          
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
          
          animationFrameId.current = requestAnimationFrame(animate);
        }
      };
      
      // Start the animation loop
      animationFrameId.current = requestAnimationFrame(animate);
    }
  }, [gameState.mode, ctx, canvas2D]);

  const style = {
    display: gameState.mode === '2D' ? 'block' : 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh'
  };

  return <div ref={containerRef} style={style} />;
};

export default PixiScene;
