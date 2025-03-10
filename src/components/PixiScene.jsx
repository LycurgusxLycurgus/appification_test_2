import React, { useEffect, useRef, useState } from 'react';
import gameState from '../game/gameState';
import { init2DEnvironment, update2D, render2D } from '../game/twoDSetup';
import { updateTrainingArena2D, renderTrainingArena2D } from '../game/trainingArena2DSetup';
import { updateTaskArena2D, renderTaskArena2D } from '../game/taskArena2DSetup';
import { updateTaskGame, renderTaskGame } from '../game/taskGameSetup';
import { isInModeTransition, addModeTransitionListener } from '../game/modeTransitionManager';
import { recordState, compareSnapshots, createDiagnosticButton } from '../utils/stateDiagnostics';

const PixiScene = () => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const animationFrameId = useRef(null);
  const [lastMode, setLastMode] = useState(null);
  const isInitializedRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const currentModeRef = useRef(null);
  
  // Create stable function references for update and render functions
  const updateFunctionsRef = useRef({
    '2D': (deltaTime) => {
      if (canvasRef.current) {
        update2D(deltaTime, gameState);
      }
    },
    '2D_TRAINING': (deltaTime) => {
      updateTrainingArena2D(deltaTime);
    },
    '2D_TASK_ARENA': (deltaTime) => {
      return updateTaskArena2D(deltaTime);
    },
    'TASK_GAME': (deltaTime) => {
      if (canvasRef.current) {
        updateTaskGame(deltaTime, gameState, canvasRef.current);
      }
    }
  });
  
  const renderFunctionsRef = useRef({
    '2D': () => {
      if (canvasRef.current && ctxRef.current) {
        render2D(ctxRef.current, gameState, canvasRef.current);
      }
    },
    '2D_TRAINING': () => {
      renderTrainingArena2D();
    },
    '2D_TASK_ARENA': () => {
      return renderTaskArena2D();
    },
    'TASK_GAME': () => {
      if (canvasRef.current && ctxRef.current) {
        renderTaskGame(ctxRef.current, gameState, canvasRef.current);
      }
    }
  });
  
  // Add a ref to track the last update time for each mode
  const lastUpdateTimeRef = useRef({});
  
  // Initialize the canvas and context only once
  useEffect(() => {
    console.log("PixiScene initializing");
    
    // Prevent double initialization
    if (isInitializedRef.current) {
      console.log("PixiScene already initialized, skipping");
      return;
    }
    
    isInitializedRef.current = true;
    
    // Initialize 2D environment
    const { canvas, ctx } = init2DEnvironment(containerRef.current, gameState);
    
    // Store canvas and context in refs
    canvasRef.current = canvas;
    ctxRef.current = ctx;
    
    // Also store in gameState for access from other components
    gameState.canvas = canvas;
    gameState.ctx = ctx;
    
    console.log("Canvas initialized:", canvas.width, "x", canvas.height);
    
    // Initialize FPS tracking
    gameState.lastFpsUpdate = performance.now();
    gameState.frameCount = 0;
    
    // Set initial mode
    currentModeRef.current = gameState.mode;
    setLastMode(gameState.mode);
    
    // Start the animation loop
    startAnimationLoop();
    
    // Set up transition event listeners
    const removePreListener = addModeTransitionListener('pre', (event) => {
      console.log("PixiScene: Pre-transition event received", event.detail);
      isTransitioningRef.current = true;
      
      // DIAGNOSTIC: Record state before transition
      recordState(gameState);
    });
    
    const removePostListener = addModeTransitionListener('post', (event) => {
      console.log("PixiScene: Post-transition event received", event.detail);
      isTransitioningRef.current = false;
      
      // Update the current mode ref
      currentModeRef.current = gameState.mode;
      
      // DIAGNOSTIC: Record state after transition
      recordState(gameState);
      
      // Force a re-render to update the display style
      setLastMode(gameState.mode);
    });
    
    // DIAGNOSTIC: Add diagnostic button after a short delay
    setTimeout(() => {
      createDiagnosticButton(() => {
        console.log("Diagnostic button clicked");
        
        // Import the task game setup to run the diagnostic test
        import('../game/taskGameSetup').then(module => {
          if (typeof module.runDiagnosticTest === 'function') {
            module.runDiagnosticTest(gameState, canvasRef.current);
          } else {
            console.log("Running manual diagnostic");
            
            // Record current state
            const currentState = recordState(gameState);
            console.log("Current game state:", currentState);
            
            // Test key handling
            console.log("Testing key handling:");
            gameState.keys['d'] = true;
            
            // Manually call update for task game
            if (gameState.mode === 'TASK_GAME') {
              module.updateTaskGame(16, gameState, canvasRef.current);
              
              // Record state after update
              const afterState = recordState(gameState);
              const changes = compareSnapshots(currentState, afterState);
              console.log("Changes after update:", changes);
            }
            
            // Reset key
            gameState.keys['d'] = false;
          }
        });
      });
    }, 2000);
    
    // Cleanup function - but we'll make sure it only runs when the component is truly unmounting
    // and not during a mode transition
    return () => {
      // Check if we're in a transition before unmounting
      if (isInModeTransition() || isTransitioningRef.current) {
        console.log("PixiScene: Prevented unmounting during mode transition");
        return; // Don't clean up during transitions
      }
      
      // Only clean up if we're not in a 2D-based mode
      const is2DBasedMode = ['2D', '2D_TRAINING', '2D_TASK_ARENA', 'TASK_GAME'].includes(gameState.mode);
      if (is2DBasedMode) {
        console.log("PixiScene: Prevented unmounting during 2D-based mode:", gameState.mode);
        return; // Don't clean up during 2D-based modes
      }
      
      console.log("PixiScene TRULY unmounting, cleaning up animation frame");
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      
      // Remove transition listeners
      removePreListener();
      removePostListener();
    };
  }, []);
  
  // Function to start the animation loop
  const startAnimationLoop = () => {
    console.log("🎬 Starting animation loop");
    
    let lastTime = performance.now();
    let frameCounter = 0;
    
    const animate = (time) => {
      // Calculate delta time
      const deltaTime = time - lastTime;
      lastTime = time;
      
      // Get current canvas and context
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      
      // Skip if canvas or context is not available
      if (!canvas || !ctx) {
        console.warn("⚠️ Canvas or context not available, skipping animation frame");
        animationFrameId.current = requestAnimationFrame(animate);
        return;
      }
      
      // Check if mode changed
      if (currentModeRef.current !== gameState.mode) {
        console.log(`🔄 PixiScene animation loop: Mode changed from ${currentModeRef.current} to ${gameState.mode}`);
        currentModeRef.current = gameState.mode;
        setLastMode(gameState.mode);
      }
      
      // Only log every 60 frames to avoid console spam
      const shouldLog = frameCounter % 60 === 0;
      frameCounter++;
      
      // Handle all 2D-based modes
      if (gameState.mode === '2D' || 
          gameState.mode === '2D_TRAINING' || 
          gameState.mode === '2D_TASK_ARENA' ||
          gameState.mode === 'TASK_GAME') {
        
        try {
          // Use the stable function references for update and render
          const updateFunction = updateFunctionsRef.current[gameState.mode];
          const renderFunction = renderFunctionsRef.current[gameState.mode];
          
          if (updateFunction && renderFunction) {
            // Log state before update for TASK_GAME mode
            if (gameState.mode === 'TASK_GAME' && shouldLog) {
              console.log("🔍 Pre-update state:", {
                mode: gameState.mode,
                isPaused: gameState.isPaused,
                currentTaskChallenge: gameState.currentTaskChallenge,
                position: gameState.taskGamePosition,
                velocity: gameState.velocity,
                frameCount: frameCounter
              });
            }
            
            // Update and render based on current mode
            let updated = true;
            let rendered = true;
            
            // Call the update function
            if (gameState.mode === '2D_TASK_ARENA') {
              updated = updateFunction(deltaTime);
            } else {
              updateFunction(deltaTime);
            }
            
            // Call the render function
            if (gameState.mode === '2D_TASK_ARENA') {
              rendered = renderFunction();
            } else {
              renderFunction();
            }
            
            // Log for task arena modes
            if (gameState.mode === '2D_TASK_ARENA') {
              if (shouldLog) {
                console.log("🎮 Task arena updated:", updated, "rendered:", rendered);
              }
              
              // If either update or render failed, log detailed error
              if (!updated || !rendered) {
                console.warn(`⚠️ Task arena cycle incomplete: updated=${updated}, rendered=${rendered}`);
              }
            }
            
            // Log for task game mode
            if (gameState.mode === 'TASK_GAME') {
              if (shouldLog) {
                console.log("🎮 Task game updated and rendered");
                
                // Log state after update
                console.log("🔍 Post-update state:", {
                  mode: gameState.mode,
                  isPaused: gameState.isPaused,
                  currentTaskChallenge: gameState.currentTaskChallenge,
                  position: gameState.taskGamePosition,
                  velocity: gameState.velocity
                });
                
                // Verify bullet movement
                if (gameState.bullets && gameState.bullets.length > 0) {
                  console.log("🔫 Bullets in TASK_GAME:", gameState.bullets.length);
                  console.log("🔫 First bullet position:", gameState.bullets[0]);
                }
              }
            }
          } else {
            console.warn(`⚠️ No update/render functions found for mode: ${gameState.mode}`);
          }
        } catch (error) {
          console.error("❌ Error in animation loop:", error);
        }
        
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
      } else {
        // For 3D mode, just keep the animation loop running but don't render anything
        if (shouldLog) {
          console.log("🎮 PixiScene: Not rendering because mode is", gameState.mode);
        }
      }
      
      // Always schedule next frame, even in 3D mode
      animationFrameId.current = requestAnimationFrame(animate);
    };
    
    // Start the animation loop
    animationFrameId.current = requestAnimationFrame(animate);
  };
  
  // Add a recovery function for animation loop
  const ensureAnimationLoopRunning = () => {
    if (!animationFrameId.current) {
      console.log("PixiScene: Detected animation loop stopped, restarting");
      startAnimationLoop();
    }
  };
  
  // Add effect to monitor and recover animation loop if needed
  useEffect(() => {
    // Check animation loop every second
    const intervalId = setInterval(() => {
      ensureAnimationLoopRunning();
    }, 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Style for the container - visible for 2D modes, hidden for 3D
  // Use a more inclusive approach to ensure visibility during transitions
  const is2DMode = gameState.mode === '2D' || 
                   gameState.mode === '2D_TRAINING' || 
                   gameState.mode === '2D_TASK_ARENA' ||
                   gameState.mode === 'TASK_GAME' ||
                   isInModeTransition() || 
                   isTransitioningRef.current;
  
  const style = {
    display: is2DMode ? 'block' : 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 10
  };
  
  // Add debug info to help diagnose visibility issues
  console.log("PixiScene rendering:", {
    mode: gameState.mode,
    lastMode: lastMode,
    currentModeRef: currentModeRef.current,
    is2DMode: is2DMode,
    display: style.display,
    transitioning: isInModeTransition() || isTransitioningRef.current,
    containerRef: containerRef.current ? 'exists' : 'null',
    canvasRef: canvasRef.current ? `${canvasRef.current.width}x${canvasRef.current.height}` : 'null'
  });
  
  // Use a stable key to prevent React from unmounting during mode changes
  return <div key="pixiSceneContainer" ref={containerRef} style={style} />;
};

export default PixiScene;