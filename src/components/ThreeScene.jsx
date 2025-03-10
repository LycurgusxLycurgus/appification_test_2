import React, { useEffect, useRef, useState } from 'react';
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
  const lastTimeRef = useRef(performance.now());
  const [fpsCounter, setFpsCounter] = useState(0);
  const [showPerformanceInfo, setShowPerformanceInfo] = useState(true);

  useEffect(() => {
    // Initialize pointerLocked state if it doesn't exist
    if (gameState.pointerLocked === undefined) {
      gameState.pointerLocked = false;
    }
    
    // Initialize player position for 3D mode
    if (!gameState.player3D) {
      gameState.player3D = { x: 0, z: 0 };
    }
    
    // Load graphics quality settings
    if (gameState.loadGraphicsQuality) {
      gameState.loadGraphicsQuality();
    }
    
    console.log(`Starting game with ${gameState.graphicsQuality} graphics quality`);
    
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
    
    // Store the renderer in gameState for access by other components
    gameState.renderer = renderer;

    lastTimeRef.current = performance.now();
    gameState.lastFpsUpdate = performance.now();
    gameState.frameCount = 0;
    
    // Create performance info display
    createPerformanceDisplay();
    
    const animate = (time) => {
      // Calculate deltaTime regardless of mode
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      // Cap deltaTime to prevent huge jumps if the game lags
      const cappedDeltaTime = Math.min(deltaTime, 100);
      
      // Check which mode we're in
      if (gameState.mode === '3D' || gameState.mode === 'TRAINING_CHALLENGE') {
        // Run the update for both 3D and TRAINING_CHALLENGE modes
        updateThreeScene(
          cappedDeltaTime, 
          sceneRef.current, 
          cameraRef.current, 
          controlsRef.current, 
          gameState, 
          gameState.setMode,
          rendererRef.current // Always pass the renderer
        );
        
        // Only render explicitly in 3D mode - TRAINING_CHALLENGE handles its own rendering
        if (gameState.mode === '3D') {
          renderThreeScene(rendererRef.current, sceneRef.current, cameraRef.current);
        }
        
        // Calculate FPS for both modes
        gameState.frameCount++;
        const now = performance.now();
        const elapsed = now - gameState.lastFpsUpdate;
        
        // Update FPS display every 500ms
        if (elapsed >= 500) {
          const fps = Math.round((gameState.frameCount * 1000) / elapsed);
          gameState.fps = fps;
          setFpsCounter(fps);
          
          // Reset counters
          gameState.lastFpsUpdate = now;
          gameState.frameCount = 0;
        }
      }
      
      // Always continue the animation loop
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle window resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Add keyboard listener for toggling performance info
    const handleKeyDown = (e) => {
      if (e.key === 'F' || e.key === 'f') {
        setShowPerformanceInfo(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Make sure to unlock pointer when component unmounts
      if (controlsRef.current && controlsRef.current.isLocked) {
        controlsRef.current.unlock();
      }
      
      gameState.pointerLocked = false;
      
      // Clean up renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      
      // Remove performance display
      const perfDisplay = document.getElementById('performance-info');
      if (perfDisplay) {
        document.body.removeChild(perfDisplay);
      }
    };
  }, []);
  
  // Create performance info display
  const createPerformanceDisplay = () => {
    const perfDisplay = document.createElement('div');
    perfDisplay.id = 'performance-info';
    perfDisplay.style.position = 'absolute';
    perfDisplay.style.bottom = '10px';
    perfDisplay.style.left = '10px';
    perfDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    perfDisplay.style.color = 'white';
    perfDisplay.style.padding = '5px 10px';
    perfDisplay.style.borderRadius = '5px';
    perfDisplay.style.fontFamily = 'monospace';
    perfDisplay.style.fontSize = '12px';
    perfDisplay.style.zIndex = '1000';
    document.body.appendChild(perfDisplay);
    
    // Update performance info
    const updatePerfInfo = () => {
      if (!perfDisplay) return;
      
      perfDisplay.style.display = showPerformanceInfo ? 'block' : 'none';
      
      if (showPerformanceInfo) {
        perfDisplay.innerHTML = `
          FPS: ${fpsCounter}<br>
          Quality: ${gameState.graphicsQuality}<br>
          Mode: ${gameState.mode}<br>
          Press F to toggle
        `;
      }
      
      requestAnimationFrame(updatePerfInfo);
    };
    
    updatePerfInfo();
  };

  // Handle mode changes
  useEffect(() => {
    // When switching to TRAINING_CHALLENGE mode, reset the lastTime to avoid large initial deltaTime
    if (gameState.mode === 'TRAINING_CHALLENGE') {
      lastTimeRef.current = performance.now();
    }
    
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

  // Update performance display when FPS changes
  useEffect(() => {
    const perfDisplay = document.getElementById('performance-info');
    if (perfDisplay && showPerformanceInfo) {
      perfDisplay.innerHTML = `
        FPS: ${fpsCounter}<br>
        Quality: ${gameState.graphicsQuality}<br>
        Mode: ${gameState.mode}<br>
        Press F to toggle
      `;
    }
  }, [fpsCounter, showPerformanceInfo, gameState.mode, gameState.graphicsQuality]);

  const style = {
    display: (gameState.mode === '3D' || gameState.mode === 'TRAINING_CHALLENGE') ? 'block' : 'none',
    position: 'absolute',
    top: 0,
    left: 0
  };

  return <div ref={threeContainerRef} style={style} />;
};

export default ThreeScene;
