// src/game/taskGameSetup.js
import gameState from './gameState';
import TaskStorageService from '../services/TaskStorageService';

// Initialize the storage service
const taskStorage = new TaskStorageService();

/**
 * Enters the task game mode from another mode.
 */
export function enterTaskGame() {
  // Set the mode to TASK_GAME
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
      { id: 'sample1', text: 'Example Task 1', completed: false }
    ];
  }
  
  // Initialize taskTokens if not set
  if (gameState.taskTokens === undefined) {
    gameState.taskTokens = 0;
  }
  
  // Clear any existing bullets
  gameState.bullets = [];
  
  // Set player facing direction
  gameState.playerFacingDirection = 1;
}

/**
 * Sets up the task game environment by creating platforms,
 * task objects, and UI buttons. This mirrors the original HTML code.
 */
export function setupTaskGameEnvironment(state, canvas) {
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
      color: task.completed ? '#8BC34A' : '#FF9800',
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
}

/**
 * Updates the task game mode:
 * – Applies horizontal movement, jumping, and gravity.
 * – Checks collisions with task platforms.
 * – Processes bullet collisions with task boxes and UI buttons.
 */
export function updateTaskGame(deltaTime, state, canvas) {
  if (state.isPaused) return;

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
    }
  }

  // Enforce boundaries.
  if (state.taskGamePosition.x < 0) state.taskGamePosition.x = 0;
  if (state.taskGamePosition.x > canvas.width - 40) state.taskGamePosition.x = canvas.width - 40;
  if (state.taskGamePosition.y > canvas.height) {
    state.taskGamePosition.x = canvas.width / 2;
    state.taskGamePosition.y = canvas.height - 100;
    state.velocity.y = 0;
  }

  let tasksChanged = false; // Flag to indicate tasks were modified.

  // Process bullet updates.
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy || 0;

    // Remove bullet if offscreen.
    if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
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
          if (!correspondingTask.completed) {
            // Mark task as completed.
            correspondingTask.completed = true;
            taskObj.completed = true;
            taskObj.color = '#8BC34A';
            state.taskTokens++;
            createTokenEffect();
            
            // Save tasks after marking as completed
            taskStorage.saveTasks(state.tasks);
          } else {
            // Archive (remove) the task.
            state.tasks.splice(taskObj.index, 1);
            state.taskObjects.splice(j, 1);
            tasksChanged = true;
            // Update indices for remaining task objects.
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

  // If tasks were modified (e.g. a task was archived), recalculate the environment.
  if (tasksChanged) {
    setupTaskGameEnvironment(state, canvas);
  }
  
  // Handle shooting with L key
  if (state.keys['l']) {
    const currentTime = Date.now();
    if (currentTime - state.lastShootTime > state.shootCooldown) {
      state.lastShootTime = currentTime;
      shootTaskGame(state);
    }
  }
}

/**
 * Shoots a bullet in TASK_GAME mode.
 */
export function shootTaskGame(state) {
  const direction = state.playerFacingDirection || 1;
  const bullet = {
    x: state.taskGamePosition.x + (direction > 0 ? 40 : 0),
    y: state.taskGamePosition.y + 25,
    vx: direction * 10,
    vy: -5, // Upward velocity for task game bullets
    size: 5,
    color: '#FFFF00'
  };
  state.bullets.push(bullet);
  
  // After the task is marked as completed or removed, add:
  taskStorage.saveTasks(state.tasks);
  
  // If tokens are updated, add:
  if (state.taskTokens !== undefined) {
    taskStorage.saveTokens(state.taskTokens);
  }
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
      ctx.fillText(taskObj.completed ? '✓' : 'T', taskObj.x + taskObj.width / 2, taskObj.y + taskObj.height / 2 + 10);

      ctx.font = '12px Arial';
      let taskText = taskObj.text;
      if (taskText.length > 20) {
        taskText = taskText.substring(0, 17) + '...';
      }
      if (taskObj.completed) taskText += " (Done)";
      ctx.fillText(taskText, taskObj.x + taskObj.width / 2, taskObj.y + taskObj.height + 15);
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
  // Set the mode back to 2D
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
 * (Optional) Creates a floating input for adding a new task.
 * Pressing Enter will add the task; pressing Escape cancels the input.
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
          completed: false 
        };
        gameState.tasks.push(newTask);
        setupTaskGameEnvironment(gameState, document.querySelector('canvas'));
        document.body.removeChild(inputContainer);
        gameState.isPaused = false;
        
        // Save tasks after adding a new one
        taskStorage.saveTasks(gameState.tasks);
      }
    } else if (e.key === 'Escape') {
      document.body.removeChild(inputContainer);
      gameState.isPaused = false;
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
        completed: false 
      };
      gameState.tasks.push(newTask);
      setupTaskGameEnvironment(gameState, document.querySelector('canvas'));
      document.body.removeChild(inputContainer);
      gameState.isPaused = false;
      
      // Save tasks after adding a new one
      taskStorage.saveTasks(gameState.tasks);
    }
  });

  cancelButton.addEventListener('click', () => {
    document.body.removeChild(inputContainer);
    gameState.isPaused = false;
  });

  inputContainer.appendChild(input);
  inputContainer.appendChild(document.createElement('br'));
  inputContainer.appendChild(addButton);
  inputContainer.appendChild(cancelButton);
  document.body.appendChild(inputContainer);
  
  // Delay focus to ensure the DOM has updated
  setTimeout(() => {
    input.focus();
  }, 10);
}

/**
 * Creates a visual effect for earning a token.
 */
function createTokenEffect() {
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
