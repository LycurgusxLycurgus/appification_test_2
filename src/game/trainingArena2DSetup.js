import gameState from './gameState';
import { setupInputListeners } from './inputManager';

// Constants for the 2D training arena
const ARENA_WIDTH = window.innerWidth;
const ARENA_HEIGHT = window.innerHeight;
const TARGET_SPEED_MIN = 1;
const TARGET_SPEED_MAX = 3;
const TRAINING_TIME = 60; // seconds

// Quality-dependent constants
const QUALITY_SETTINGS = {
  low: {
    targetCount: 5,
    maxBullets: 5,
    maxEffects: 3,
    effectDuration: 300, // milliseconds
    targetSize: 30
  },
  medium: {
    targetCount: 10,
    maxBullets: 10,
    maxEffects: 5,
    effectDuration: 500,
    targetSize: 25
  },
  high: {
    targetCount: 15,
    maxBullets: 20,
    maxEffects: 10,
    effectDuration: 800,
    targetSize: 20
  }
};

// Create a class to manage the 2D training arena
class TrainingArena2DManager {
  constructor(canvas, ctx, state) {
    console.log("TrainingArena2DManager constructor");
    
    // Get quality settings
    this.quality = gameState.graphicsQuality || 'medium';
    this.qualitySettings = QUALITY_SETTINGS[this.quality];
    console.log(`Using ${this.quality} quality settings for 2D training arena`);
    
    // Store canvas and context
    this.canvas = canvas;
    this.ctx = ctx;
    
    // Store game state
    this.gameState = state;
    
    // Save original game state to restore later
    this.originalPlatforms = [...state.platforms];
    this.originalEnemies = [...state.enemies];
    this.originalGameApps = [...state.gameApps];
    this.originalPlayerPosition = { 
      x: state.playerPosition.x, 
      y: state.playerPosition.y 
    };
    
    // Training arena state
    this.targets = [];
    this.score = 0;
    this.timeRemaining = TRAINING_TIME;
    this.isActive = false;
    this.lastUpdateTime = 0;
    this.activeEffects = [];
    this.exitPortal = null;
    
    // Setup custom L key listener for bullet creation
    this.setupLKeyListener();
    
    // Bind methods to retain 'this' context
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.createBullet = this.createBullet.bind(this);
    this.createTargets = this.createTargets.bind(this);
    this.cleanup = this.cleanup.bind(this);
    
    // Make this instance globally accessible (for direct access from inputManager)
    window.trainingArena2DManager = this;
    
    console.log("TrainingArena2DManager created");
  }
  
  // Setup a direct L key listener that bypasses gameState
  setupLKeyListener() {
    this.lKeyHandler = (e) => {
      if (!this.isActive) return;
      
      if (e.key.toLowerCase() === 'l') {
        const currentTime = Date.now();
        if (currentTime - this.gameState.lastShootTime > this.gameState.shootCooldown) {
          this.gameState.lastShootTime = currentTime;
          this.createBullet();
        }
      }
    };
    
    // Add the event listener
    window.addEventListener('keydown', this.lKeyHandler);
  }
  
  // Initialize the training arena
  initialize() {
    console.log("Initializing 2D training arena");
    this.isActive = true;
    this.score = 0;
    this.timeRemaining = TRAINING_TIME;
    this.lastUpdateTime = Date.now();
    this.activeEffects = [];
    
    try {
      // Clear existing game elements
      this.gameState.platforms = [];
      this.gameState.enemies = [];
      this.gameState.gameApps = [];
      this.gameState.bullets = [];
      
      // Create floor platform
      this.gameState.platforms.push({
        x: 0,
        y: this.canvas.height - 50,
        width: this.canvas.width,
        height: 50
      });
      
      // Add some platforms for player to jump on
      this.createTrainingPlatforms();
      
      // Create exit portal
      this.createExitPortal();
      
      // Create targets
      this.createTargets();
      
      // Reset player position
      this.gameState.playerPosition.x = 100;
      this.gameState.playerPosition.y = this.canvas.height - 100;
      this.gameState.velocity.x = 0;
      this.gameState.velocity.y = 0;
      
      console.log("2D training arena initialized with time:", this.timeRemaining);
    } catch (error) {
      console.error("Error initializing 2D training arena:", error);
      this.exitArena();
    }
  }
  
  // Create platforms for the training arena
  createTrainingPlatforms() {
    // Create several platforms at different heights
    const platformCount = 5;
    const platformWidth = 200;
    const platformHeight = 20;
    
    for (let i = 0; i < platformCount; i++) {
      const x = Math.random() * (this.canvas.width - platformWidth);
      const y = this.canvas.height - 150 - (i * 100);
      
      this.gameState.platforms.push({
        x,
        y,
        width: platformWidth,
        height: platformHeight
      });
    }
  }
  
  // Create exit portal
  createExitPortal() {
    this.exitPortal = {
      x: this.canvas.width - 100,
      y: 100,
      width: 60,
      height: 60,
      type: 'portal',
      label: 'EXIT'
    };
    
    this.gameState.gameApps.push(this.exitPortal);
  }
  
  // Create targets
  createTargets() {
    const targetCount = this.qualitySettings.targetCount;
    for (let i = 0; i < targetCount; i++) {
      this.createTarget();
    }
  }
  
  // Create a single target
  createTarget() {
    // Random target type (static or moving)
    const isMoving = Math.random() > 0.3;
    const size = this.qualitySettings.targetSize;
    
    // Create target
    const target = {
      x: Math.random() * (this.canvas.width - size * 2) + size,
      y: Math.random() * (this.canvas.height - 200) + 50,
      width: size,
      height: size,
      isTarget: true,
      points: isMoving ? 20 : 10 // More points for moving targets
    };
    
    // Add movement properties for moving targets
    if (isMoving) {
      const speed = TARGET_SPEED_MIN + Math.random() * (TARGET_SPEED_MAX - TARGET_SPEED_MIN);
      target.isMoving = true;
      target.vx = (Math.random() > 0.5 ? 1 : -1) * speed;
      target.vy = (Math.random() > 0.5 ? 1 : -1) * speed;
      target.color = '#FF9500'; // Orange for moving targets
    } else {
      target.isMoving = false;
      target.color = '#00FF00'; // Green for static targets
    }
    
    this.targets.push(target);
    return target;
  }
  
  // Create a bullet - simplified and direct method
  createBullet() {
    if (!this.isActive) return;
    
    console.log("Creating bullet in 2D training arena");
    
    // Get direction based on player facing direction
    const direction = this.gameState.playerFacingDirection || 1;
    
    // Create bullet using the EXACT same formula as in inputManager.js
    const bullet = {
      x: this.gameState.playerPosition.x + (direction > 0 ? 40 : 0),
      y: this.gameState.playerPosition.y + 25,
      vx: direction * 10,
      vy: 0,
      size: 5,
      color: '#FFFF00'
    };
    
    // Add bullet to game state
    this.gameState.bullets.push(bullet);
    
    // Create muzzle flash effect
    this.createMuzzleFlash(bullet.x, bullet.y);
  }
  
  // Create muzzle flash effect
  createMuzzleFlash(x, y) {
    // Skip muzzle flash on low quality
    if (this.quality === 'low') return;
    
    // Limit number of active effects
    if (this.activeEffects.length >= this.qualitySettings.maxEffects) {
      // Remove oldest effect
      this.activeEffects.shift();
    }
    
    const effect = {
      x,
      y,
      size: 15,
      opacity: 1,
      color: '#FFFF00',
      type: 'flash',
      createdAt: Date.now()
    };
    
    this.activeEffects.push(effect);
  }
  
  // Create hit effect
  createHitEffect(x, y) {
    // Limit number of active effects
    if (this.activeEffects.length >= this.qualitySettings.maxEffects) {
      // Remove oldest effect
      this.activeEffects.shift();
    }
    
    const effect = {
      x,
      y,
      size: 10,
      opacity: 1,
      color: '#FF0000',
      type: 'hit',
      createdAt: Date.now()
    };
    
    this.activeEffects.push(effect);
  }
  
  // Update function called every frame
  update(deltaTime) {
    if (!this.isActive) return false;
    
    try {
      // If we're in the ending state, we still want to render but not update game elements
      if (this.isEnding) {
        return true; // Keep rendering but don't update game elements
      }
      
      // Update timer
      this.timeRemaining -= deltaTime / 1000;
      
      // Check if time ran out
      if (this.timeRemaining <= 0) {
        console.log("Time ran out, ending challenge");
        this.endChallenge();
        return false;
      }
      
      // Handle player movement - same as in twoDSetup.js
      this.updatePlayerMovement(deltaTime);
      
      // Update bullets
      this.updateBullets();
      
      // Update targets
      this.updateTargets(deltaTime);
      
      // Update effects
      this.updateEffects();
      
      // Check bullet collisions with targets
      this.checkBulletCollisions();
      
      // Check for exit portal proximity
      this.checkExitPortalProximity();
      
      return true;
    } catch (error) {
      console.error("Error updating 2D training arena:", error);
      return false;
    }
  }
  
  // Update player movement - similar to twoDSetup.js
  updatePlayerMovement(deltaTime) {
    const moveSpeed = 5;
    const jumpPower = 15;
    const gravity = this.gameState.gravity;
    this.gameState.velocity.x = 0;
    
    // Update player movement based on keyboard controls
    if (this.gameState.keys['a'] || this.gameState.keys['arrowleft']) {
      this.gameState.velocity.x = -moveSpeed;
      this.gameState.playerFacingDirection = -1;
    }
    if (this.gameState.keys['d'] || this.gameState.keys['arrowright']) {
      this.gameState.velocity.x = moveSpeed;
      this.gameState.playerFacingDirection = 1;
    }
    if ((this.gameState.keys['w'] || this.gameState.keys['arrowup'] || this.gameState.keys[' ']) && !this.gameState.isJumping) {
      this.gameState.velocity.y = -jumpPower;
      this.gameState.isJumping = true;
    }
    
    // Apply gravity
    this.gameState.velocity.y += gravity;
    
    // Cap maximum falling speed to prevent tunneling through platforms
    const maxFallSpeed = 15;
    if (this.gameState.velocity.y > maxFallSpeed) {
      this.gameState.velocity.y = maxFallSpeed;
    }
    
    // Update position
    this.gameState.playerPosition.x += this.gameState.velocity.x;
    this.gameState.playerPosition.y += this.gameState.velocity.y;
    
    // Platform collision (improved to handle high velocities)
    let onPlatform = false;
    this.gameState.platforms.forEach(platform => {
      // Check if player is within horizontal bounds of the platform
      if (
        this.gameState.playerPosition.x + 30 > platform.x &&
        this.gameState.playerPosition.x < platform.x + platform.width
      ) {
        // Check if player is landing on top of platform
        if (
          this.gameState.playerPosition.y + 50 >= platform.y &&
          this.gameState.playerPosition.y + 50 - this.gameState.velocity.y <= platform.y
        ) {
          this.gameState.playerPosition.y = platform.y - 50;
          this.gameState.velocity.y = 0;
          this.gameState.isJumping = false;
          onPlatform = true;
        }
      }
    });
    
    // Ensure player doesn't fall through the bottom of the screen
    if (this.gameState.playerPosition.y > this.canvas.height) {
      this.gameState.playerPosition.y = this.canvas.height - 50;
      this.gameState.velocity.y = 0;
      this.gameState.isJumping = false;
    }
  }
  
  // Update bullets - new method to properly handle bullet movement
  updateBullets() {
    for (let i = this.gameState.bullets.length - 1; i >= 0; i--) {
      const bullet = this.gameState.bullets[i];
      
      // Skip if bullet is undefined (safety check)
      if (!bullet) {
        this.gameState.bullets.splice(i, 1);
        continue;
      }
      
      // Update bullet position
      bullet.x += bullet.vx;
      bullet.y += bullet.vy || 0;
      
      // Remove bullet if offscreen
      if (
        bullet.x < 0 ||
        bullet.x > this.canvas.width ||
        bullet.y < 0 ||
        bullet.y > this.canvas.height
      ) {
        this.gameState.bullets.splice(i, 1);
      }
    }
  }
  
  // Update targets (move the moving ones)
  updateTargets(deltaTime) {
    for (const target of this.targets) {
      if (target.isMoving) {
        // Move the target
        target.x += target.vx;
        target.y += target.vy;
        
        // Bounce off walls
        if (target.x <= 0 || target.x + target.width >= this.canvas.width) {
          target.vx *= -1;
          target.x = Math.max(0, Math.min(this.canvas.width - target.width, target.x));
        }
        
        if (target.y <= 0 || target.y + target.height >= this.canvas.height - 50) {
          target.vy *= -1;
          target.y = Math.max(0, Math.min(this.canvas.height - 50 - target.height, target.y));
        }
      }
    }
  }
  
  // Update visual effects
  updateEffects() {
    const currentTime = Date.now();
    const effectsToRemove = [];
    
    for (let i = 0; i < this.activeEffects.length; i++) {
      const effect = this.activeEffects[i];
      const age = currentTime - effect.createdAt;
      
      if (age > this.qualitySettings.effectDuration) {
        effectsToRemove.push(i);
        continue;
      }
      
      // Update effect properties based on age
      const lifePercent = age / this.qualitySettings.effectDuration;
      
      if (effect.type === 'flash') {
        effect.opacity = 1 - lifePercent;
        effect.size = 15 * (1 + lifePercent);
      } else if (effect.type === 'hit') {
        effect.opacity = 1 - lifePercent;
        effect.size = 10 * (1 + lifePercent * 2);
      }
    }
    
    // Remove expired effects (in reverse order to avoid index issues)
    for (let i = effectsToRemove.length - 1; i >= 0; i--) {
      this.activeEffects.splice(effectsToRemove[i], 1);
    }
  }
  
  // Check bullet collisions with targets
  checkBulletCollisions() {
    for (let i = this.gameState.bullets.length - 1; i >= 0; i--) {
      const bullet = this.gameState.bullets[i];
      
      // Check collisions with targets
      for (let j = this.targets.length - 1; j >= 0; j--) {
        const target = this.targets[j];
        
        if (
          bullet.x > target.x &&
          bullet.x < target.x + target.width &&
          bullet.y > target.y &&
          bullet.y < target.y + target.height
        ) {
          // Hit a target
          this.score += target.points;
          this.createHitEffect(target.x + target.width / 2, target.y + target.height / 2);
          
          // Remove bullet and target
          this.gameState.bullets.splice(i, 1);
          this.targets.splice(j, 1);
          
          // Create a new target to replace it
          setTimeout(() => {
            if (this.isActive) {
              this.createTarget();
            }
          }, 1000);
          
          break;
        }
      }
    }
  }
  
  // Check if player is near exit portal
  checkExitPortalProximity() {
    if (!this.exitPortal) return;
    
    const playerCenterX = this.gameState.playerPosition.x + 20;
    const playerCenterY = this.gameState.playerPosition.y + 25;
    
    const portalCenterX = this.exitPortal.x + this.exitPortal.width / 2;
    const portalCenterY = this.exitPortal.y + this.exitPortal.height / 2;
    
    const dx = playerCenterX - portalCenterX;
    const dy = playerCenterY - portalCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If player is close to portal and presses 'E', exit the arena
    if (distance < 50 && this.gameState.keys && this.gameState.keys['e']) {
      this.exitArena();
      this.gameState.keys['e'] = false; // Reset key to prevent multiple toggles
    }
  }
  
  // Render the training arena
  render() {
    if (!this.isActive) return;
    
    try {
      // Clear canvas and draw background
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw background gradient
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, '#1a2b3c');
      gradient.addColorStop(1, '#2c3e50');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // If we're in the ending state, just show the final score overlay
      if (this.isEnding) {
        // Draw final score overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Time's Up!", this.canvas.width / 2, this.canvas.height / 2 - 40);
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '20px Arial';
        this.ctx.fillText('Exiting in 5 seconds...', this.canvas.width / 2, this.canvas.height / 2 + 40);
        return;
      }
      
      // Draw platforms
      this.ctx.fillStyle = '#8b5d33';
      this.gameState.platforms.forEach(platform => {
        this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        this.ctx.fillStyle = '#734d26';
        this.ctx.fillRect(platform.x, platform.y, platform.width, 5);
        this.ctx.fillStyle = '#8b5d33';
      });
      
      // Draw exit portal with pulsing effect
      if (this.exitPortal) {
        const pulseScale = 1 + 0.1 * Math.sin(Date.now() * 0.005);
        const centerX = this.exitPortal.x + this.exitPortal.width / 2;
        const centerY = this.exitPortal.y + this.exitPortal.height / 2;
        const radius = (this.exitPortal.width / 2) * pulseScale;
        
        // Draw portal glow
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw portal
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw portal label
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.exitPortal.label, centerX, centerY + this.exitPortal.height);
      }
      
      // Draw targets
      this.targets.forEach(target => {
        this.ctx.fillStyle = target.color;
        this.ctx.fillRect(target.x, target.y, target.width, target.height);
        
        // Add a pattern to distinguish moving vs static targets
        this.ctx.fillStyle = '#FFFFFF';
        if (target.isMoving) {
          // Draw a circle for moving targets
          this.ctx.beginPath();
          this.ctx.arc(
            target.x + target.width / 2,
            target.y + target.height / 2,
            target.width / 4,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        } else {
          // Draw a cross for static targets
          const padding = target.width / 4;
          this.ctx.beginPath();
          this.ctx.moveTo(target.x + padding, target.y + padding);
          this.ctx.lineTo(target.x + target.width - padding, target.y + target.height - padding);
          this.ctx.moveTo(target.x + target.width - padding, target.y + padding);
          this.ctx.lineTo(target.x + padding, target.y + target.height - padding);
          this.ctx.lineWidth = 2;
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.stroke();
        }
      });
      
      // Draw bullets
      this.ctx.fillStyle = '#FFFF00';
      this.gameState.bullets.forEach(bullet => {
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, bullet.size || 5, 0, Math.PI * 2);
        this.ctx.fill();
      });
      
      // Draw effects
      this.activeEffects.forEach(effect => {
        this.ctx.globalAlpha = effect.opacity;
        this.ctx.fillStyle = effect.color;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      });
      
      // Draw player
      this.ctx.fillStyle = '#2ecc71';
      this.ctx.fillRect(
        this.gameState.playerPosition.x,
        this.gameState.playerPosition.y,
        40,
        50
      );
      
      // Draw player face
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      const faceDirection = this.gameState.playerFacingDirection > 0 ? 1 : -1;
      const eyeOffset = faceDirection * 5;
      this.ctx.arc(
        this.gameState.playerPosition.x + 15 + eyeOffset,
        this.gameState.playerPosition.y + 15,
        3,
        0,
        Math.PI * 2
      );
      this.ctx.arc(
        this.gameState.playerPosition.x + 25 + eyeOffset,
        this.gameState.playerPosition.y + 15,
        3,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
      
      // Draw player gun
      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      if (faceDirection > 0) {
        this.ctx.moveTo(this.gameState.playerPosition.x + 30, this.gameState.playerPosition.y + 25);
        this.ctx.lineTo(this.gameState.playerPosition.x + 45, this.gameState.playerPosition.y + 25);
      } else {
        this.ctx.moveTo(this.gameState.playerPosition.x + 10, this.gameState.playerPosition.y + 25);
        this.ctx.lineTo(this.gameState.playerPosition.x - 5, this.gameState.playerPosition.y + 25);
      }
      this.ctx.stroke();
      
      // Draw UI elements
      this.drawUI();
    } catch (error) {
      console.error("Error rendering 2D training arena:", error);
    }
  }
  
  // Draw UI elements (score, timer)
  drawUI() {
    // Draw score
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(20, 20, 150, 40);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Score: ${this.score}`, 30, 45);
    
    // Draw timer
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(this.canvas.width - 170, 20, 150, 40);
    
    // Make timer red when time is running out
    if (this.timeRemaining <= 10) {
      this.ctx.fillStyle = '#FF0000';
    } else {
      this.ctx.fillStyle = '#FFFFFF';
    }
    
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`Time: ${Math.ceil(this.timeRemaining)}s`, this.canvas.width - 30, 45);
    
    // Draw instructions
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(this.canvas.width / 2 - 150, 20, 300, 40);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Press L to shoot | Press E near exit to leave', this.canvas.width / 2, 45);
  }
  
  // End the challenge (time out)
  endChallenge() {
    console.log("Ending challenge with score:", this.score);
    
    // Set flag to show we're in the end state but keep arena active for rendering
    this.isEnding = true;
    
    // Immediately remove the L key event listener to prevent input interference
    if (this.lKeyHandler) {
      window.removeEventListener('keydown', this.lKeyHandler);
      this.lKeyHandler = null;
    }
    
    // Show final score immediately
    this.showFinalScore();
    
    // Set a timeout to exit the challenge after 5 seconds
    this.exitTimeout = setTimeout(() => {
      this.exitArena();
    }, 5000);
  }
  
  // Show final score
  showFinalScore() {
    console.log("Showing final score"); // Debug log
    
    // Make sure we have a valid context
    if (!this.ctx) {
      console.error("No context available for showing final score");
      return;
    }
    
    // Store original game state for restoration during the score display
    // This allows movement to work while still showing the score
    if (!this.isRestoringState) {
      this.isRestoringState = true;
      
      // Save current arena state for rendering
      this.endingArenaState = {
        platforms: [...this.gameState.platforms],
        enemies: [...this.gameState.enemies],
        gameApps: [...this.gameState.gameApps]
      };
      
      // Restore original game state to allow movement
      this.gameState.platforms = [...this.originalPlatforms];
      this.gameState.enemies = [...this.originalEnemies];
      this.gameState.gameApps = [...this.originalGameApps];
      this.gameState.playerPosition = { 
        x: this.originalPlayerPosition.x, 
        y: this.originalPlayerPosition.y 
      };
      
      // Reset velocity and jumping state
      this.gameState.velocity = { x: 0, y: 0 };
      this.gameState.isJumping = false;
    }
  }
  
  // Exit arena and return to main 2D world
  exitArena() {
    console.log("Exiting 2D training arena");
    
    try {
      // First, set isActive to false to prevent any further updates
      this.isActive = false;
      
      // Clean up resources
      this.cleanup();
      
      // Restore original game state
      this.gameState.platforms = [...this.originalPlatforms];
      this.gameState.enemies = [...this.originalEnemies];
      this.gameState.gameApps = [...this.originalGameApps];
      this.gameState.playerPosition = { 
        x: this.originalPlayerPosition.x, 
        y: this.originalPlayerPosition.y 
      };
      
      // Ensure velocity is reset
      this.gameState.velocity = { x: 0, y: 0 };
      
      // Ensure isJumping is reset
      this.gameState.isJumping = false;
      
      // Ensure all keys are reset to prevent stuck keys
      for (const key in this.gameState.keys) {
        this.gameState.keys[key] = false;
      }
      
      // Return to normal 2D mode
      this.gameState.mode = '2D';
      
      console.log("Returned to normal 2D mode");
    } catch (error) {
      console.error("Error exiting 2D training arena:", error);
      // Force return to 2D mode even if there's an error
      this.gameState.mode = '2D';
    }
  }
  
  // Clean up resources
  cleanup() {
    console.log("Cleaning up 2D training arena");
    
    try {
      // Remove our custom event listener
      if (this.lKeyHandler) {
        window.removeEventListener('keydown', this.lKeyHandler);
        this.lKeyHandler = null;
      }
      
      // Remove global reference
      if (window.trainingArena2DManager === this) {
        delete window.trainingArena2DManager;
      }
      
      // Clear bullets and effects
      this.gameState.bullets = [];
      this.activeEffects = [];
      this.targets = [];
      
      // Clear any pending timeouts
      if (this.exitTimeout) {
        clearTimeout(this.exitTimeout);
        this.exitTimeout = null;
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

// Create training arena manager instance
let trainingArena2DManager = null;

// Function to shoot in training arena - can be called from outside
export function shootInTrainingArena() {
  if (trainingArena2DManager && trainingArena2DManager.isActive) {
    trainingArena2DManager.createBullet();
  }
}

// Function to initialize the 2D training arena
export function enterTrainingArena2D(canvas, ctx, state) {
  console.log("Entering 2D training arena");
  
  try {
    // Clean up any existing instance
    if (trainingArena2DManager) {
      trainingArena2DManager.cleanup();
    }
    
    // Create new instance
    trainingArena2DManager = new TrainingArena2DManager(canvas, ctx, state);
    
    // Initialize arena
    trainingArena2DManager.initialize();
    
    // Set game mode to 2D_TRAINING
    state.previousMode = state.mode;
    state.mode = '2D_TRAINING';
    
    return trainingArena2DManager;
  } catch (error) {
    console.error("Error entering 2D training arena:", error);
    // If there's an error, make sure we return to 2D mode
    state.mode = '2D';
    return null;
  }
}

// Function to update the 2D training arena
export function updateTrainingArena2D(deltaTime) {
  try {
    if (trainingArena2DManager && trainingArena2DManager.isActive) {
      return trainingArena2DManager.update(deltaTime);
    }
  } catch (error) {
    console.error("Error updating 2D training arena:", error);
  }
  return false;
}

// Function to render the 2D training arena
export function renderTrainingArena2D() {
  try {
    if (trainingArena2DManager && trainingArena2DManager.isActive) {
      trainingArena2DManager.render();
      return true;
    }
  } catch (error) {
    console.error("Error rendering 2D training arena:", error);
  }
  return false;
}

// Function to cleanup the 2D training arena
export function cleanupTrainingArena2D() {
  console.log("Cleaning up 2D training arena from external call");
  try {
    if (trainingArena2DManager) {
      trainingArena2DManager.cleanup();
      trainingArena2DManager = null;
    }
  } catch (error) {
    console.error("Error cleaning up 2D training arena:", error);
  }
} 