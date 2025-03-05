import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { initThreeScene, updateThreeScene, renderThreeScene } from '../game/threeSetup';
import gameState from '../game/gameState';

const ThreeScene = () => {
  const threeContainerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    // Initialize pointerLocked state if it doesn't exist
    if (gameState.pointerLocked === undefined) {
      gameState.pointerLocked = false;
    }
    
    // Pass gameState.setMode to the Three.js setup so that when the portal is reached, it will update mode
    const { scene, camera, renderer, controls } = initThreeScene(
      threeContainerRef.current,
      gameState,
      gameState.setMode
    );
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    let lastTime = performance.now();
    gameState.lastFpsUpdate = performance.now();
    gameState.frameCount = 0;
    
    const animate = (time) => {
      // Only run animation when in 3D mode
      if (gameState.mode === '3D') {
        const deltaTime = time - lastTime;
        lastTime = time;
        
        // Update scene
        updateThreeScene(deltaTime, scene, camera, controls, gameState, gameState.setMode);
        renderThreeScene(renderer, scene, camera);
        
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
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle window resize
    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Make sure to unlock pointer when component unmounts
      if (controls && controls.isLocked) {
        controls.unlock();
      }
      
      gameState.pointerLocked = false;
      
      // Clean up renderer
      if (renderer) {
        renderer.dispose();
      }
      
      // Remove resize listener
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle mode changes
  useEffect(() => {
    // When switching back to 3D mode, make sure pointer lock state is reset
    if (gameState.mode === '3D') {
      // Reset pointer lock state
      gameState.pointerLocked = false;
      
      // Reset FPS counters when switching to 3D mode
      gameState.lastFpsUpdate = performance.now();
      gameState.frameCount = 0;
      
      // Show a message to the user
      const message = document.createElement('div');
      message.style.position = 'absolute';
      message.style.top = '50%';
      message.style.left = '50%';
      message.style.transform = 'translate(-50%, -50%)';
      message.style.color = 'white';
      message.style.backgroundColor = 'rgba(0,0,0,0.7)';
      message.style.padding = '20px';
      message.style.borderRadius = '5px';
      message.style.zIndex = '1000';
      message.style.textAlign = 'center';
      message.innerHTML = 'Click to enable controls';
      message.id = 'pointer-lock-message';
      
      // Remove any existing message
      const existingMessage = document.getElementById('pointer-lock-message');
      if (existingMessage) {
        existingMessage.remove();
      }
      
      document.body.appendChild(message);
      
      // Remove the message when pointer is locked
      const handleLock = () => {
        if (message.parentNode) {
          message.remove();
        }
      };
      
      // Add event listener for lock event
      if (controlsRef.current) {
        controlsRef.current.addEventListener('lock', handleLock);
      }
      
      // Clean up
      return () => {
        if (message.parentNode) {
          message.remove();
        }
        if (controlsRef.current) {
          controlsRef.current.removeEventListener('lock', handleLock);
        }
      };
    }
  }, [gameState.mode]);

  const style = {
    display: gameState.mode === '3D' ? 'block' : 'none',
    position: 'absolute',
    top: 0,
    left: 0
  };

  return <div ref={threeContainerRef} style={style} />;
};

export default ThreeScene;
