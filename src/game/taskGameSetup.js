      // src/game/taskGameSetup.js
      import gameState from './gameState';
      import TaskStorageService from '../services/TaskStorageService';
      // Import the task arena module
      import { enterTaskArena2D } from './taskArena2DSetup';
      // Import the diagnostic utilities
      import { recordState, compareSnapshots, logStateProperty, verifyStateConsistency } from '../utils/stateDiagnostics';
      // Import the logger utility
      import logger from '../utils/logger';
      
      // Initialize the storage service
      const taskStorage = new TaskStorageService();
      
      // Module name for logging
      const MODULE = 'TaskGame';
      
      /**
       * Enters the task game mode from another mode.
       */
      export function enterTaskGame() {
        // CRITICAL: Set mode directly to TASK_GAME instead of transitioning through 2D first
        gameState.mode = 'TASK_GAME';
        if (gameState.setMode) {
          gameState.setMode('TASK_GAME');
        }
        
        // Initialize task game position if not already set
        gameState.taskGamePosition = { 
          x: window.innerWidth / 2, 
          y: window.innerHeight - 100 
        };
        
        // Reset velocity and jumping state
        gameState.velocity = { x: 0, y: 0 };
        gameState.isJumping = false;
        
        // Load saved tasks and tokens from storage
        loadSavedTasksAndTokens();
        
        // Ensure we have some sample tasks if none exist
        if (!gameState.tasks || gameState.tasks.length === 0) {
          gameState.tasks = [
            { 
              id: 'sample1', 
              text: 'Example Task 1', 
              completed: false,
              requiredScore: 300 // Add required score for the task challenge
            }
          ];
        }
        
        // Ensure all tasks have a requiredScore property
        gameState.tasks.forEach(task => {
          if (task.requiredScore === undefined) {
            task.requiredScore = 300; // Default score requirement
          }
        });
        
        // Initialize taskTokens if not set
        if (gameState.taskTokens === undefined) {
          gameState.taskTokens = 0;
        }
        
        // Clear any existing bullets
        gameState.bullets = [];
        
        // Set player facing direction
        gameState.playerFacingDirection = 1;
        
        // Reset current task challenge
        gameState.currentTaskChallenge = undefined;
        
        logger.info(MODULE, `Entered task game mode: ${gameState.mode}`);
      }
      
      /**
       * Sets up the task game environment by creating platforms,
       * task objects, and UI buttons.
       */
      export function setupTaskGameEnvironment(state, canvas) {
        logger.info(MODULE, "Setting up task game environment");
        
        // DIAGNOSTIC: Record state before setup
        const beforeSetupState = recordState(state);
        
        // Safety check for canvas
        if (!canvas) {
          logger.error(MODULE, "No canvas provided to setupTaskGameEnvironment");
          if (state.canvas) {
            logger.info(MODULE, "Using canvas from gameState");
            canvas = state.canvas;
          } else {
            logger.error(MODULE, "No canvas available in gameState either");
            return;
          }
        }
        
        // Create platforms: a ground platform plus one platform for each task.
        state.taskGamePlatforms = [
          { x: 0, y: canvas.height - 50, width: canvas.width, height: 50 },
          ...state.tasks.map((task, index) => ({
            x: 100 + (index % 3) * 300,
            y: canvas.height - 150 - Math.floor(index / 3) * 100,
            width: 250,
            height: 20,
            index: index,
            task: task
          }))
        ];
      
        // Create task objects that float above each platform.
        state.taskObjects = state.tasks.map((task, index) => {
          const platform = state.taskGamePlatforms[index + 1]; // skip ground
          return {
            x: platform.x + platform.width / 2 - 30,
            y: platform.y - 60,
            width: 60,
            height: 60,
            text: task.text,
            completed: task.completed,
            locked: !task.completed, // Add locked state for uncompleted tasks
            color: task.completed ? '#8BC34A' : '#FF9800',
            requiredScore: task.requiredScore || 300, // Use task's required score or default
            index: index
          };
        });
      
        // Create UI buttons: one for "New Task" and one for "Exit".
        state.taskGameButtons = [
          {
            x: 50,
            y: 50,
            width: 120,
            height: 50,
            text: 'New Task',
            color: '#2196F3',
            action: 'new_task'
          },
          {
            x: canvas.width - 150,
            y: 50,
            width: 120,
            height: 50,
            text: 'Exit',
            color: '#F44336',
            action: 'exit'
          }
        ];
        
        // Initialize player position if not already set
        if (!state.taskGamePosition) {
          logger.debug(MODULE, "Initializing default task game position");
          state.taskGamePosition = { 
            x: canvas.width / 2, 
            y: canvas.height - 100 
          };
        }
        
        // Ensure player is within bounds after recalculation
        if (state.taskGamePosition.x < 0) state.taskGamePosition.x = 0;
        if (state.taskGamePosition.x > canvas.width - 40) state.taskGamePosition.x = canvas.width - 40;
        if (state.taskGamePosition.y > canvas.height - 50) {
          state.taskGamePosition.y = canvas.height - 100;
        }
        
        // DIAGNOSTIC: Ensure playerPosition is synchronized with taskGamePosition
        // This is a potential fix - ensure both position references are in sync
        state.playerPosition = {
          x: state.taskGamePosition.x,
          y: state.taskGamePosition.y
        };
        
        // Reset velocity and jumping state to ensure player can move
        state.velocity = { x: 0, y: 0 };
        state.isJumping = false;
        
        // Reset all key states to prevent stuck keys
        for (const key in state.keys) {
          state.keys[key] = false;
        }
        
        // Initialize last shoot time if not set
        if (!state.lastShootTime) {
          state.lastShootTime = 0;
        }
        
        // Set shoot cooldown if not set
        if (!state.shootCooldown) {
          state.shootCooldown = 300; // milliseconds between shots
        }
        
        // DIAGNOSTIC: Record state after setup and log changes
        const afterSetupState = recordState(state);
        const changes = compareSnapshots(beforeSetupState, afterSetupState);
        logger.debug(MODULE, `State changes during setupTaskGameEnvironment: ${JSON.stringify(changes)}`);
        
        // DIAGNOSTIC: Verify state consistency
        const issues = verifyStateConsistency(state);
        if (Object.keys(issues).length > 0) {
          logger.warn(MODULE, `State consistency issues after setup: ${JSON.stringify(issues)}`);
        }
        
        logger.info(MODULE, "Task game environment setup complete");
      }
      
      /**
       * Updates the task game mode:
       * – Applies horizontal movement, jumping, and gravity.
       * – Checks collisions with task platforms.
       * – Processes bullet collisions with task boxes and UI buttons.
       */
      export function updateTaskGame(deltaTime, state, canvas) {
        // Don't update if game is paused or in a task challenge
        if (state.isPaused || state.currentTaskChallenge !== undefined) {
          return;
        }
      
        // DIAGNOSTIC: Record state before update
        const beforeUpdateState = recordState(state);
      
        // Log update at verbose level only
        logger.verbose(MODULE, `Updating task game with deltaTime: ${deltaTime}`);
      
        const moveSpeed = 5;
        const jumpPower = 15;
        const gravity = state.gravity || 0.5;
      
        // Reset horizontal velocity.
        state.velocity.x = 0;
      
        // Handle horizontal movement.
        if (state.keys['a'] || state.keys['arrowleft']) {
          state.velocity.x = -moveSpeed;
          state.playerFacingDirection = -1;
        }
        if (state.keys['d'] || state.keys['arrowright']) {
          state.velocity.x = moveSpeed;
          state.playerFacingDirection = 1;
        }
      
        // Handle jumping.
        if ((state.keys['w'] || state.keys['arrowup'] || state.keys[' ']) && !state.isJumping) {
          state.velocity.y = -jumpPower;
          state.isJumping = true;
        }
        state.velocity.y += gravity;
      
        // Update player position in the task game.
        state.taskGamePosition.x += state.velocity.x;
        state.taskGamePosition.y += state.velocity.y;
        
        // Log position at verbose level only
        logger.verbose(MODULE, `Position updated: {x: ${state.taskGamePosition.x}, y: ${state.taskGamePosition.y}, vx: ${state.velocity.x}, vy: ${state.velocity.y}}`);
        
        // Ensure playerPosition is synchronized with taskGamePosition
        state.playerPosition.x = state.taskGamePosition.x;
        state.playerPosition.y = state.taskGamePosition.y;
      
        // Check for platform collisions.
        for (const platform of state.taskGamePlatforms || []) {
          if (
            state.taskGamePosition.y + 50 >= platform.y &&
            state.taskGamePosition.y + 40 < platform.y &&
            state.taskGamePosition.x + 30 > platform.x &&
            state.taskGamePosition.x < platform.x + platform.width
          ) {
            state.taskGamePosition.y = platform.y - 50;
            state.velocity.y = 0;
            state.isJumping = false;
            
            // DIAGNOSTIC: Ensure playerPosition is synchronized with taskGamePosition
            state.playerPosition.y = state.taskGamePosition.y;
          }
        }
      
        // Enforce boundaries.
        if (state.taskGamePosition.x < 0) state.taskGamePosition.x = 0;
        if (state.taskGamePosition.x > canvas.width - 40) state.taskGamePosition.x = canvas.width - 40;
        if (state.taskGamePosition.y > canvas.height) {
          state.taskGamePosition.x = canvas.width / 2;
          state.taskGamePosition.y = canvas.height - 100;
          state.velocity.y = 0;
          
          // DIAGNOSTIC: Ensure playerPosition is synchronized with taskGamePosition
          state.playerPosition.x = state.taskGamePosition.x;
          state.playerPosition.y = state.taskGamePosition.y;
        }
      
        let tasksChanged = false; // Flag to indicate tasks were modified.
      
        // Process bullet updates - CRITICAL FIX
        if (state.bullets && state.bullets.length > 0) {
          logger.debug(MODULE, `Updating ${state.bullets.length} bullets in task game`);
          
          for (let i = state.bullets.length - 1; i >= 0; i--) {
            const bullet = state.bullets[i];
            
            // Skip if bullet is undefined (safety check)
            if (!bullet) {
              state.bullets.splice(i, 1);
              continue;
            }
            
            // Update bullet position with velocity
            bullet.x += bullet.vx;
            bullet.y += (bullet.vy || 0);

            // Remove bullet if offscreen.
            if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
              logger.verbose(MODULE, `Bullet ${i} removed - out of bounds`);
              state.bullets.splice(i, 1);
              continue;
            }

            // Check collision with task objects.
            if (state.taskObjects) {
              for (let j = 0; j < state.taskObjects.length; j++) {
                const taskObj = state.taskObjects[j];
                if (
                  bullet.x > taskObj.x &&
                  bullet.x < taskObj.x + taskObj.width &&
                  bullet.y > taskObj.y &&
                  bullet.y < taskObj.y + taskObj.height
                ) {
                  const correspondingTask = state.tasks[taskObj.index];
                  
                  if (taskObj.locked) {
                    // Task is locked, start the challenge
                    state.bullets.splice(i, 1);
                    
                    // Store task info for the challenge
                    state.currentTaskChallenge = {
                      task: correspondingTask,
                      taskObj: taskObj,
                      requiredScore: taskObj.requiredScore || 300
                    };
                    
                    // Save current player position to restore later
                    state.savedTaskGamePosition = {
                      x: state.taskGamePosition.x,
                      y: state.taskGamePosition.y
                    };
                    
                    // Activate task arena challenge using similar pattern to training arena
                    activateTaskArenaChallenge();
                    
                    break;
                  } else if (correspondingTask.completed) {
                    // Task is already completed, archive it
                    state.tasks.splice(taskObj.index, 1);
                    state.taskObjects.splice(j, 1);
                    tasksChanged = true;
                    
                    // Update indices for remaining task objects
                    for (let k = j; k < state.taskObjects.length; k++) {
                      state.taskObjects[k].index--;
                    }
                    
                    createArchiveEffect(taskObj.x + taskObj.width / 2, taskObj.y + taskObj.height / 2);
                    
                    // Save tasks after archiving
                    taskStorage.saveTasks(state.tasks);
                  }
                  
                  state.bullets.splice(i, 1);
                  break;
                }
              }
            }

            // Check collision with UI buttons.
            if (state.taskGameButtons) {
              for (const button of state.taskGameButtons) {
                if (
                  bullet.x > button.x &&
                  bullet.x < button.x + button.width &&
                  bullet.y > button.y &&
                  bullet.y < button.y + button.height
                ) {
                  if (button.action === 'new_task') {
                    createNewTaskInput();
                  } else if (button.action === 'exit') {
                    closeTaskGame();
                  }
                  state.bullets.splice(i, 1);
                  break;
                }
              }
            }
          }
        }
      
        // If tasks were modified (e.g. a task was archived), recalculate the environment.
        if (tasksChanged) {
          setupTaskGameEnvironment(state, canvas);
        }
        
        // Handle shooting with L key
        if (state.keys['l']) {
          const currentTime = Date.now();
          if (currentTime - state.lastShootTime > state.shootCooldown) {
            state.lastShootTime = currentTime;
            shootTaskGame();
            
            // Reset the L key state to prevent continuous shooting
            state.keys['l'] = false;
          }
        }
        
        // DIAGNOSTIC: Record state after update and log changes
        const afterUpdateState = recordState(state);
        const changes = compareSnapshots(beforeUpdateState, afterUpdateState);
        
        // Only log changes if there are any (to reduce console spam)
        if (Object.keys(changes).length > 0) {
          logger.debug(MODULE, `State changes during updateTaskGame: ${JSON.stringify(changes)}`);
        }
        
        // DIAGNOSTIC: Handle diagnostic button click
        if (state.keys['t']) {
          logger.info(MODULE, "Diagnostic test triggered by T key");
          runDiagnosticTest(state, canvas);
          state.keys['t'] = false; // Reset key to prevent multiple triggers
        }
      }
      
      /**
       * Shoots a bullet in TASK_GAME mode.
       */
      export function shootTaskGame() {
        // DIAGNOSTIC: Record state before shooting
        const beforeShootState = recordState(gameState);
        
        // Ensure taskGamePosition exists
        if (!gameState.taskGamePosition) {
          logger.warn(MODULE, "taskGamePosition not found, initializing default position");
          gameState.taskGamePosition = { 
            x: window.innerWidth / 2, 
            y: window.innerHeight - 100 
          };
        }
        
        // Initialize playerFacingDirection if not set
        if (gameState.playerFacingDirection === undefined) {
          logger.warn(MODULE, "playerFacingDirection not found, defaulting to right");
          gameState.playerFacingDirection = 1; // Default to facing right
        }
        
        // Ensure bullets array exists
        if (!gameState.bullets) {
          logger.warn(MODULE, "bullets array not found, initializing empty array");
          gameState.bullets = [];
        }
        
        // DIAGNOSTIC: Log player position and facing direction
        logger.info(MODULE, `Player position at shoot time: ${JSON.stringify(gameState.taskGamePosition)}`);
        logger.info(MODULE, `Player facing direction: ${gameState.playerFacingDirection}`);
        
        // Create a bullet
        const direction = gameState.playerFacingDirection;
        const bullet = {
          x: gameState.taskGamePosition.x + (direction > 0 ? 40 : 0),
          y: gameState.taskGamePosition.y + 25,
          vx: direction * 10,
          vy: -5, // Upward velocity for task game bullets
          size: 5,
          color: '#FFFF00'
        };
        
        // Add bullet to game state
        gameState.bullets.push(bullet);
        
        // DIAGNOSTIC: Record state after shooting and log changes
        const afterShootState = recordState(gameState);
        const changes = compareSnapshots(beforeShootState, afterShootState);
        logger.debug(MODULE, `State changes during shootTaskGame: ${JSON.stringify(changes)}`);
        
        // Optional: Add a muzzle flash effect or sound
        logger.info(MODULE, `Bullet shot in Task Game mode: ${JSON.stringify(bullet)}`);
      }
      
      /**
       * Renders the task game on the 2D canvas.
       */
      export function renderTaskGame(ctx, state, canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      
        // Draw background gradient.
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#263238');
        gradient.addColorStop(1, '#37474F');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      
        // Draw title.
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TASK GAME', canvas.width / 2, 30);
      
        // Draw platforms.
        if (state.taskGamePlatforms) {
          ctx.fillStyle = '#546E7A';
          for (const platform of state.taskGamePlatforms) {
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            ctx.fillStyle = '#455A64';
            ctx.fillRect(platform.x, platform.y, platform.width, 5);
            ctx.fillStyle = '#546E7A';
          }
        }
      
        // Draw task objects.
        if (state.taskObjects) {
          for (const taskObj of state.taskObjects) {
            ctx.fillStyle = taskObj.color;
            ctx.fillRect(taskObj.x, taskObj.y, taskObj.width, taskObj.height);
      
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.font = 'bold 30px Arial';
            
            // Display a check mark if completed, otherwise a lock emoji
            ctx.fillText(taskObj.completed ? '✓' : '🔒', taskObj.x + taskObj.width / 2, taskObj.y + taskObj.height / 2 + 10);
      
            ctx.font = '12px Arial';
            let taskText = taskObj.text;
            if (taskText.length > 20) {
              taskText = taskText.substring(0, 17) + '...';
            }
            
            // Show completion status and required score
            let statusText = '';
            if (taskObj.completed) {
              statusText = " (Done)";
            } else {
              statusText = ` (${taskObj.requiredScore} pts)`;
            }
            
            ctx.fillText(taskText + statusText, taskObj.x + taskObj.width / 2, taskObj.y + taskObj.height + 15);
          }
        }
      
        // Draw UI buttons.
        if (state.taskGameButtons) {
          for (const button of state.taskGameButtons) {
            ctx.fillStyle = button.color;
            ctx.fillRect(button.x, button.y, button.width, button.height);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2 + 6);
          }
        }
      
        // Draw player character.
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(state.taskGamePosition.x, state.taskGamePosition.y, 40, 50);
      
        // Draw player face.
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        const faceDirection = state.playerFacingDirection || 1;
        const eyeOffset = faceDirection * 5;
        ctx.arc(state.taskGamePosition.x + 15 + eyeOffset, state.taskGamePosition.y + 15, 3, 0, Math.PI * 2);
        ctx.arc(state.taskGamePosition.x + 25 + eyeOffset, state.taskGamePosition.y + 15, 3, 0, Math.PI * 2);
        ctx.fill();
      
        // Draw gun.
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (faceDirection > 0) {
          ctx.moveTo(state.taskGamePosition.x + 30, state.taskGamePosition.y + 25);
          ctx.lineTo(state.taskGamePosition.x + 45, state.taskGamePosition.y + 25);
        } else {
          ctx.moveTo(state.taskGamePosition.x + 10, state.taskGamePosition.y + 25);
          ctx.lineTo(state.taskGamePosition.x - 5, state.taskGamePosition.y + 25);
        }
        ctx.stroke();
      
        // Draw bullets.
        ctx.fillStyle = '#FFFF00';
        for (const bullet of state.bullets) {
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
          ctx.fill();
        }
      
        // Draw token count UI.
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(10, canvas.height - 60, 200, 50);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Tokens: ${state.taskTokens}`, 20, canvas.height - 30);
      }
      
      /**
       * Exits the task game mode, returning to 2D mode.
       */
      export function closeTaskGame() {
        // CRITICAL: First transition to 2D mode directly
        gameState.mode = '2D';
        if (gameState.setMode) {
          gameState.setMode('2D');
        }
        
        // Clear any existing bullets
        gameState.bullets = [];
        
        // Remove any task game input elements that might be open
        const inputEl = document.getElementById('taskGameInput');
        if (inputEl) {
          document.body.removeChild(inputEl);
        }
        
        // Ensure game is not paused
        gameState.isPaused = false;
        
        // Reset velocity to prevent carrying over momentum
        gameState.velocity = { x: 0, y: 0 };
        
        // Reset animation timing to prevent speed issues
        gameState.lastTime = performance.now();
      }
      
      /**
       * Creates a floating input for adding a new task.
       */
      export function createNewTaskInput() {
        gameState.isPaused = true;
        
        // Remove any existing input container first
        const existingInput = document.getElementById('taskGameInput');
        if (existingInput) {
          document.body.removeChild(existingInput);
        }
        
        const inputContainer = document.createElement('div');
        inputContainer.id = 'taskGameInput';
        inputContainer.style.position = 'absolute';
        inputContainer.style.top = '100px';
        inputContainer.style.left = '50%';
        inputContainer.style.transform = 'translateX(-50%)';
        inputContainer.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
        inputContainer.style.padding = '15px';
        inputContainer.style.borderRadius = '10px';
        inputContainer.style.zIndex = '1000';
      
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter task description...';
        input.style.width = '300px';
        input.style.padding = '8px';
        
        // Prevent game keys from affecting the game while typing
        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          
          if (e.key === 'Enter') {
            if (input.value.trim()) {
              const newTask = { 
                id: 'task_' + Date.now(), 
                text: input.value.trim(), 
                completed: false,
                requiredScore: 300 // Default score requirement
              };
              gameState.tasks.push(newTask);
              setupTaskGameEnvironment(gameState, document.querySelector('canvas'));
              document.body.removeChild(inputContainer);
              gameState.isPaused = false;
              
              // Reset all key states to prevent auto-jumping
              for (const key in gameState.keys) {
                gameState.keys[key] = false;
              }
              
              // Save tasks after adding a new one
              taskStorage.saveTasks(gameState.tasks);
            }
          } else if (e.key === 'Escape') {
            document.body.removeChild(inputContainer);
            gameState.isPaused = false;
            
            // Reset all key states to prevent auto-jumping
            for (const key in gameState.keys) {
              gameState.keys[key] = false;
            }
          }
        });
      
        const addButton = document.createElement('button');
        addButton.textContent = 'Add Task';
        addButton.style.marginTop = '10px';
        addButton.style.marginRight = '10px';
      
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
      
        addButton.addEventListener('click', () => {
          if (input.value.trim()) {
            const newTask = { 
              id: 'task_' + Date.now(), 
              text: input.value.trim(), 
              completed: false,
              requiredScore: 300 // Default score requirement
            };
            gameState.tasks.push(newTask);
            setupTaskGameEnvironment(gameState, document.querySelector('canvas'));
            document.body.removeChild(inputContainer);
            gameState.isPaused = false;
            
            // Reset all key states to prevent auto-jumping
            for (const key in gameState.keys) {
              gameState.keys[key] = false;
            }
            
            // Save tasks after adding a new one
            taskStorage.saveTasks(gameState.tasks);
          }
        });
      
        cancelButton.addEventListener('click', () => {
          document.body.removeChild(inputContainer);
          gameState.isPaused = false;
          
          // Reset all key states to prevent auto-jumping
          for (const key in gameState.keys) {
            gameState.keys[key] = false;
          }
        });
      
        inputContainer.appendChild(input);
        inputContainer.appendChild(document.createElement('br'));
        inputContainer.appendChild(addButton);
        inputContainer.appendChild(cancelButton);
        document.body.appendChild(inputContainer);
      
        setTimeout(() => {
          try {
            if (document.activeElement) {
              document.activeElement.blur();
            }
            input.focus();
            input.setSelectionRange(0, 0);
          } catch (e) {
            logger.error(MODULE, 'Error focusing input:', e);
          }
        }, 100);
      
        inputContainer.addEventListener('click', (e) => {
          e.stopPropagation();
          if (document.activeElement !== input) {
            input.focus();
          }
        });
      
        const handleOutsideClick = (e) => {
          if (!inputContainer.contains(e.target)) {
            input.focus();
          }
        };
      
        document.addEventListener('click', handleOutsideClick);
      
        const originalRemoveChild = document.body.removeChild;
        document.body.removeChild = function(child) {
          if (child === inputContainer) {
            document.removeEventListener('click', handleOutsideClick);
            document.body.removeChild = originalRemoveChild;
          }
          return originalRemoveChild.call(this, child);
        };
      }
      
      /**
       * Creates a visual effect for earning a token.
       * Exported so it can be used by other modules.
       */
      export function createTokenEffect() {
        const tokenEffect = document.createElement('div');
        tokenEffect.textContent = '+1 TOKEN';
        tokenEffect.style.position = 'absolute';
        tokenEffect.style.color = '#FFD700';
        tokenEffect.style.fontSize = '24px';
        tokenEffect.style.fontWeight = 'bold';
        tokenEffect.style.top = '50%';
        tokenEffect.style.left = '50%';
        tokenEffect.style.transform = 'translate(-50%, -50%)';
        tokenEffect.style.zIndex = '1000';
        tokenEffect.style.textShadow = '0 0 10px #FFD700';
        document.body.appendChild(tokenEffect);
      
        let opacity = 1;
        let y = 0;
        function animateToken() {
          opacity -= 0.02;
          y -= 2;
          tokenEffect.style.opacity = String(opacity);
          tokenEffect.style.transform = `translate(-50%, calc(-50% + ${y}px))`;
          if (opacity <= 0) {
            document.body.removeChild(tokenEffect);
            return;
          }
          requestAnimationFrame(animateToken);
        }
        animateToken();
        
        // Save tokens after incrementing
        taskStorage.saveTokens(gameState.taskTokens);
      }
      
      /**
       * Creates a visual effect for archiving a completed task.
       */
      function createArchiveEffect(x, y) {
        const archiveEffect = document.createElement('div');
        archiveEffect.textContent = 'ARCHIVED';
        archiveEffect.style.position = 'absolute';
        archiveEffect.style.color = '#4CAF50';
        archiveEffect.style.fontSize = '24px';
        archiveEffect.style.fontWeight = 'bold';
        archiveEffect.style.top = `${y}px`;
        archiveEffect.style.left = `${x}px`;
        archiveEffect.style.transform = 'translate(-50%, -50%)';
        archiveEffect.style.zIndex = '1000';
        archiveEffect.style.textShadow = '0 0 10px #4CAF50';
        document.body.appendChild(archiveEffect);
      
        let opacity = 1;
        let yOffset = 0;
        function animateArchive() {
          opacity -= 0.02;
          yOffset -= 2;
          archiveEffect.style.opacity = String(opacity);
          archiveEffect.style.transform = `translate(-50%, calc(-50% + ${yOffset}px))`;
          if (opacity <= 0) {
            document.body.removeChild(archiveEffect);
            return;
          }
          requestAnimationFrame(animateArchive);
        }
        animateArchive();
        
        // After the task is archived, add:
        taskStorage.saveTasks(gameState.tasks);
      }
      
      /**
       * Creates a visual notification for challenge failure.
       * Exported so it can be used by other modules.
       */
      export function createFailureNotification(requiredScore) {
        const notification = document.createElement('div');
        notification.textContent = `Challenge Failed! You need ${requiredScore} points to complete this task.`;
        notification.style.position = 'absolute';
        notification.style.top = '50%';
        notification.style.left = '50%';
        notification.style.transform = 'translate(-50%, -50%)';
        notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        notification.style.color = 'white';
        notification.style.padding = '20px';
        notification.style.borderRadius = '10px';
        notification.style.fontWeight = 'bold';
        notification.style.zIndex = '1000';
        document.body.appendChild(notification);
        
        // Fade out and remove after 3 seconds
        setTimeout(() => {
          let opacity = 1;
          const fadeInterval = setInterval(() => {
            opacity -= 0.05;
            notification.style.opacity = opacity;
            if (opacity <= 0) {
              clearInterval(fadeInterval);
              document.body.removeChild(notification);
            }
          }, 50);
        }, 3000);
      }
      
      /**
       * Load saved tasks and tokens from storage
       */
      function loadSavedTasksAndTokens() {
        // Load tasks
        const savedTasks = taskStorage.getTasks();
        if (savedTasks && savedTasks.length > 0) {
          // Only initialize if tasks array doesn't exist yet
          if (!gameState.tasks) {
            gameState.tasks = [];
          }
          
          // Merge saved tasks with existing tasks, avoiding duplicates
          savedTasks.forEach(savedTask => {
            const exists = gameState.tasks.some(task => task.id === savedTask.id);
            if (!exists) {
              // Ensure required score is set
              if (savedTask.requiredScore === undefined) {
                savedTask.requiredScore = 300;
              }
              gameState.tasks.push(savedTask);
            }
          });
        }
        
        // Load tokens
        const savedTokens = taskStorage.getTokens();
        if (typeof savedTokens === 'number') {
          gameState.taskTokens = savedTokens;
        } else if (savedTokens !== null) {
          gameState.taskTokens = parseInt(savedTokens, 10) || 0;
        } else {
          gameState.taskTokens = 0;
        }
      }

      function startTaskChallenge(task) {
        logger.info(MODULE, `Starting task challenge for task: ${task.title}`);
        
        // Store the current task being challenged
        gameState.currentTaskChallenge = task;
        
        // Save current position to return to after challenge
        gameState.savedPosition = {
          x: gameState.playerPosition.x,
          y: gameState.playerPosition.y
        };
        
        // Determine required score based on task priority/difficulty
        const requiredScore = task.priority * 100 || 300;
        
        // IMPORTANT: Must set mode BEFORE creating the arena
        logger.info(MODULE, "Setting game mode to 2D_TASK_ARENA");
        if (gameState.setMode) {
          gameState.setMode('2D_TASK_ARENA');
        } else {
          gameState.mode = '2D_TASK_ARENA';
        }
        logger.info(MODULE, `Set game mode to: ${gameState.mode}`);
        
        // Create a timeout to ensure the mode change has propagated
        setTimeout(() => {
          try {
            logger.info(MODULE, "Creating task arena after timeout");
            logger.info(MODULE, `Current game mode: ${gameState.mode}`);
            logger.info(MODULE, `Canvas available: ${!!gameState.canvas}`);
            logger.info(MODULE, `Context available: ${!!gameState.ctx}`);
            
            if (!gameState.canvas || !gameState.ctx) {
              logger.error(MODULE, "Canvas or context not available!");
              return;
            }
            
            // Enter task arena with required score
            enterTaskArena2D(
              gameState.canvas,
              gameState.ctx,
              gameState,
              requiredScore,
              (score) => {
                logger.info(MODULE, `Task challenge completed with score: ${score}`);
                
                // Determine if challenge was successful
                const isSuccess = score >= requiredScore;
                
                // Mark task as completed if successful
                if (isSuccess) {
                  logger.info(MODULE, "Challenge successful! Marking task as completed");
                  completeTask(task);
                } else {
                  logger.info(MODULE, "Challenge failed. Task remains incomplete");
                }
                
                // Clear task challenge reference
                gameState.currentTaskChallenge = null;
                
                // Return to task game
                logger.info(MODULE, "Returning to task game mode");
                if (gameState.setMode) {
                  gameState.setMode('TASK_GAME');
                } else {
                  gameState.mode = 'TASK_GAME';
                }
                
                // Reset key states to prevent auto-jumping after task challenge
                for (const key in gameState.keys) {
                  gameState.keys[key] = false;
                }
                
                // Return player to saved position
                if (gameState.savedPosition) {
                  gameState.playerPosition.x = gameState.savedPosition.x;
                  gameState.playerPosition.y = gameState.savedPosition.y;
                }
              }
            );
          } catch (error) {
            logger.error(MODULE, "Error starting task challenge:", error);
            
            // Reset game state in case of error
            if (gameState.setMode) {
              gameState.setMode('TASK_GAME');
            } else {
              gameState.mode = 'TASK_GAME';
            }
          }
        }, 100); // Small delay to ensure PixiScene doesn't unmount
      }

      /**
       * Activates the task arena challenge.
       * This function follows the successful pattern used in the training arena.
       */
      export function activateTaskArenaChallenge() {
        logger.info(MODULE, "Activating task arena challenge");
        
        // Ensure we have task challenge info
        if (!gameState.currentTaskChallenge) {
          logger.error(MODULE, "No current task challenge defined");
          return;
        }
        
        // Save current player position to restore later
        gameState.savedTaskGamePosition = {
          x: gameState.taskGamePosition.x,
          y: gameState.taskGamePosition.y
        };
        logger.info(MODULE, `Saved task game position: ${JSON.stringify(gameState.savedTaskGamePosition)}`);
        
        // Reset all key states before transition
        if (gameState.keys) {
          for (const key in gameState.keys) {
            gameState.keys[key] = false;
          }
        }
        
        // Use the mode transition manager to transition directly to 2D_TASK_ARENA
        import('./modeTransitionManager').then(({ transitionGameMode, resetAllKeyStates }) => {
          // Reset all key states before transition
          resetAllKeyStates();
          
          // Transition directly to 2D_TASK_ARENA mode
          transitionGameMode('2D_TASK_ARENA', {}, () => {
            logger.info(MODULE, "Successfully transitioned to 2D_TASK_ARENA mode, now entering task arena");
            
            // Reset key states again after transition
            resetAllKeyStates();
            
            // Create the arena manager directly
            import('./taskArena2DSetup').then(module => {
              const arenaManager = module.enterTaskArena2D(
                gameState.canvas,
                gameState.ctx,
                gameState,
                gameState.currentTaskChallenge.requiredScore,
                onTaskChallengeComplete
              );
              
              // Verify the arena manager was created successfully
              if (!arenaManager) {
                logger.error(MODULE, "Failed to create task arena manager");
                returnToTaskGame(0);
              }
            }).catch(error => {
              logger.error(MODULE, "Error importing taskArena2DSetup:", error);
              returnToTaskGame(0);
            });
          });
        }).catch(error => {
          logger.error(MODULE, "Error importing modeTransitionManager:", error);
          // Fallback to old method if transition manager fails
          logger.log(MODULE, "Falling back to direct mode transition");
          directlyActivateTaskArena();
        });
      }
      
      // Fallback function if the new approach doesn't work
      function directlyActivateTaskArena() {
        logger.log(MODULE, "Using fallback method to activate task arena");
        
        // Verify canvas and context are available
        if (!gameState.canvas || !gameState.ctx) {
          logger.error(MODULE, "Canvas or context not available for task arena");
          return;
        }
        
        logger.log(MODULE, "Canvas and context available, entering task arena");
        logger.log(MODULE, `Canvas dimensions: ${gameState.canvas.width} x ${gameState.canvas.height}`);
        
        // Set mode to 2D_TASK_ARENA
        gameState.mode = '2D_TASK_ARENA';
        logger.log(MODULE, `Game mode set to: ${gameState.mode}`);
        
        // Create the arena manager
        import('./taskArena2DSetup').then(module => {
          const arenaManager = module.enterTaskArena2D(
            gameState.canvas,
            gameState.ctx,
            gameState,
            gameState.currentTaskChallenge.requiredScore,
            onTaskChallengeComplete
          );
          
          // Verify the arena manager was created successfully
          if (!arenaManager) {
            logger.error(MODULE, "Failed to create task arena manager");
            returnToTaskGame(0);
          }
        }).catch(error => {
          logger.error(MODULE, "Error importing taskArena2DSetup:", error);
          returnToTaskGame(0);
        });
      }

      /**
       * Handles task challenge completion.
       * This is called when a task arena challenge is completed.
       */
      function onTaskChallengeComplete(scoreAchieved) {
        logger.info(MODULE, `Task challenge completed with score: ${scoreAchieved}`);
        
        // Get the current challenge info and store it locally before clearing it
        const challenge = gameState.currentTaskChallenge;
        
        if (!challenge) {
          logger.error(MODULE, "No challenge info available in completion callback");
          // Don't transition here - it might cause issues if we're already in a transition
          return;
        }
        
        // Make a local copy of the challenge data to prevent it from being lost
        const localChallenge = {
          task: challenge.task,
          taskObj: challenge.taskObj,
          requiredScore: challenge.requiredScore
        };
        
        // Check if the score requirement was met
        const isSuccess = scoreAchieved >= localChallenge.requiredScore;
        
        // Process challenge result
        if (isSuccess) {
          logger.info(MODULE, "Challenge successful! Marking task as completed");
          
          // Mark task as completed
          localChallenge.task.completed = true;
          localChallenge.taskObj.locked = false;
          localChallenge.taskObj.completed = true;
          localChallenge.taskObj.color = '#8BC34A';
          
          // Increase tokens
          gameState.taskTokens++;
          
          // Create token effect
          createTokenEffect();
          
          // Save tasks after marking as completed
          taskStorage.saveTasks(gameState.tasks);
        } else {
          logger.info(MODULE, "Challenge failed. Task remains incomplete");
          // In-game notification instead of alert for better UX
          createFailureNotification(localChallenge.requiredScore);
        }
        
        // Clear task challenge reference AFTER processing the result
        gameState.currentTaskChallenge = null;
        
        // Return to task game
        returnToTaskGame(scoreAchieved);
      }

      /**
       * Returns to task game mode after a challenge.
       */
      function returnToTaskGame(scoreAchieved) {
        logger.info(MODULE, "🔄 Returning to task game mode");
        
        // Use the mode transition manager to transition directly to TASK_GAME
        import('./modeTransitionManager').then(({ transitionGameMode, resetAllKeyStates }) => {
          // Reset all key states before transition
          resetAllKeyStates();
          
          // CRITICAL FIX: Ensure these state variables are reset before transition
          logger.info(MODULE, "🔄 Pre-transition state:", {
            isPaused: gameState.isPaused,
            currentTaskChallenge: gameState.currentTaskChallenge
          });
          
          // Explicitly reset critical state variables
          gameState.isPaused = false;
          gameState.currentTaskChallenge = undefined;
          
          logger.info(MODULE, "🔄 Post-reset state:", {
            isPaused: gameState.isPaused,
            currentTaskChallenge: gameState.currentTaskChallenge
          });
          
          // Transition directly to TASK_GAME mode
          transitionGameMode('TASK_GAME', {}, () => {
            logger.info(MODULE, "✅ Successfully transitioned to TASK_GAME mode");
            
            // IMPORTANT: Reset all key states to prevent stuck keys
            resetAllKeyStates();
            
            // Restore player position if saved position exists
            if (gameState.savedTaskGamePosition) {
              logger.info(MODULE, "🔄 Restoring player position:", gameState.savedTaskGamePosition);
              gameState.taskGamePosition = {
                x: gameState.savedTaskGamePosition.x,
                y: gameState.savedTaskGamePosition.y
              };
              
              // Clear saved position to prevent issues with future challenges
              gameState.savedTaskGamePosition = null;
            } else {
              logger.warn(MODULE, "⚠️ No saved position found, using default");
              // Set a default position if no saved position exists
              gameState.taskGamePosition = {
                x: window.innerWidth / 2,
                y: window.innerHeight - 100
              };
            }
            
            // Reset velocity to prevent momentum carrying over
            gameState.velocity = { x: 0, y: 0 };
            
            // Reset jumping state
            gameState.isJumping = false;
            
            // CRITICAL FIX: Double-check these state variables are still reset
            logger.info(MODULE, "🔄 Post-transition state check:", {
              isPaused: gameState.isPaused,
              currentTaskChallenge: gameState.currentTaskChallenge,
              mode: gameState.mode,
              position: gameState.taskGamePosition,
              velocity: gameState.velocity
            });
            
            // Ensure the task game environment is properly set up with the canvas
            if (gameState.canvas) {
              logger.info(MODULE, "🎮 Setting up task game environment with canvas");
              setupTaskGameEnvironment(gameState, gameState.canvas);
            } else {
              logger.error(MODULE, "❌ Canvas not available for task game setup");
            }
            
            // Force a small delay to ensure everything is initialized properly
            setTimeout(() => {
              // Double-check that keys are reset
              resetAllKeyStates();
              
              // CRITICAL FIX: Triple-check state variables
              logger.info(MODULE, "🔄 Final state check:", {
                isPaused: gameState.isPaused,
                currentTaskChallenge: gameState.currentTaskChallenge,
                mode: gameState.mode
              });
              
              logger.info(MODULE, "✅ Task game fully restored and ready");
            }, 100);
          });
        }).catch(error => {
          logger.error(MODULE, "❌ Error importing modeTransitionManager:", error);
          // Fallback to old method if transition manager fails
          logger.log(MODULE, "⚠️ Falling back to direct mode transition");
          
          // Reset all key states
          if (gameState.keys) {
            for (const key in gameState.keys) {
              gameState.keys[key] = false;
            }
          }
          
          // CRITICAL FIX: Explicitly reset these state variables in the fallback path too
          gameState.isPaused = false;
          gameState.currentTaskChallenge = undefined;
          
          // CRITICAL: First transition to 2D mode to ensure PixiScene stays mounted
          // This is the key difference - we go through 2D mode first
          gameState.mode = '2D';
          
          // Give the system a moment to process the mode change
          setTimeout(() => {
            // Then transition to task game mode
            gameState.mode = 'TASK_GAME';
            if (gameState.setMode) {
              gameState.setMode('TASK_GAME');
            }
            
            logger.info(MODULE, "🔄 Mode set back to:", gameState.mode);
            
            // Reset all key states to prevent stuck keys
            if (gameState.keys) {
              for (const key in gameState.keys) {
                gameState.keys[key] = false;
              }
            }
            
            // CRITICAL FIX: Double-check these state variables are still reset
            logger.info(MODULE, "🔄 Fallback path state check:", {
              isPaused: gameState.isPaused,
              currentTaskChallenge: gameState.currentTaskChallenge,
              mode: gameState.mode
            });
            
            // Restore player position
            if (gameState.savedTaskGamePosition) {
              gameState.taskGamePosition = {
                x: gameState.savedTaskGamePosition.x,
                y: gameState.savedTaskGamePosition.y
              };
              
              // Clear saved position
              gameState.savedTaskGamePosition = null;
            } else {
              // Set a default position if no saved position exists
              gameState.taskGamePosition = {
                x: window.innerWidth / 2,
                y: window.innerHeight - 100
              };
            }
            
            // Reset velocity and jumping state
            gameState.velocity = { x: 0, y: 0 };
            gameState.isJumping = false;
            
            // Ensure the task game environment is properly set up
            if (gameState.canvas) {
              setupTaskGameEnvironment(gameState, gameState.canvas);
            }
            
            logger.info(MODULE, "✅ Task game fully restored and ready");
          }, 100);
        });
      }

      /**
       * Runs a diagnostic test for task game movement
       */
      function runDiagnosticTest(state, canvas) {
        logger.info(MODULE, "=== TASK GAME DIAGNOSTIC TEST ===");
        
        // Test 1: Check position references
        logger.info(MODULE, "Position references:");
        logger.info(MODULE, "- taskGamePosition:", state.taskGamePosition);
        logger.info(MODULE, "- playerPosition:", state.playerPosition);
        
        // Test 2: Check key state
        logger.info(MODULE, "Key states:", state.keys);
        
        // Test 3: Test movement with simulated key press
        logger.info(MODULE, "Testing right movement:");
        const beforeState = recordState(state);
        
        // Simulate right key press
        state.keys['d'] = true;
        
        // Call update manually
        updateTaskGame(16, state, canvas);
        
        // Check if position changed
        const afterState = recordState(state);
        const changes = compareSnapshots(beforeState, afterState);
        logger.info(MODULE, "Changes after right movement:", changes);
        
        // Reset key state
        state.keys['d'] = false;
        
        // Test 4: Test bullet movement
        logger.info(MODULE, "Testing bullet movement:");
        
        // Create a test bullet
        if (!state.bullets) state.bullets = [];
        
        const testBullet = {
          x: state.taskGamePosition.x,
          y: state.taskGamePosition.y,
          vx: 10,
          vy: -5,
          size: 5,
          color: '#FF0000'
        };
        
        state.bullets.push(testBullet);
        logger.info(MODULE, "Test bullet created:", testBullet);
        
        // Update once to move the bullet
        updateTaskGame(16, state, canvas);
        
        // Check if bullet moved
        logger.info(MODULE, "Test bullet after update:", state.bullets[state.bullets.length - 1]);
        
        logger.info(MODULE, "=== DIAGNOSTIC TEST COMPLETE ===");
      }