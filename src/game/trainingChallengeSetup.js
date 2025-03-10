// src/game/trainingChallengeSetup.js
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import gameState from './gameState';

// Constants for the training challenge
const TRAINING_ARENA_SIZE = 50;
const TARGET_SPEED_MIN = 0.01;
const TARGET_SPEED_MAX = 0.05;
const MAX_DELTA_TIME = 0.1; // Maximum allowed delta time in seconds

// Quality-dependent constants
const QUALITY_SETTINGS = {
  low: {
    targetCount: 5,
    targetDetail: 8, // Segments for sphere geometry
    effectDetail: 8,
    maxBullets: 5,
    maxEffects: 3,
    drawDistance: 50,
    shadowsEnabled: false
  },
  medium: {
    targetCount: 10,
    targetDetail: 16,
    effectDetail: 16,
    maxBullets: 10,
    maxEffects: 5,
    drawDistance: 100,
    shadowsEnabled: true
  },
  high: {
    targetCount: 15,
    targetDetail: 24,
    effectDetail: 24,
    maxBullets: 20,
    maxEffects: 10,
    drawDistance: 200,
    shadowsEnabled: true
  }
};

// Create a class to manage the training challenge
class TrainingChallengeManager {
  constructor(scene, camera, renderer, controls) {
    console.log("TrainingChallengeManager constructor", { 
      sceneExists: !!scene, 
      cameraExists: !!camera, 
      rendererExists: !!renderer, 
      controlsExists: !!controls 
    });
    
    // Get quality settings
    this.quality = gameState.graphicsQuality || 'low';
    this.qualitySettings = QUALITY_SETTINGS[this.quality];
    console.log(`Using ${this.quality} quality settings for training challenge`);
    
    // Store original scene and camera
    this.originalScene = scene;
    this.originalCamera = camera;
    
    // Use the original scene - don't create a new one
    this.scene = scene;
    
    // Use the provided camera
    this.camera = camera;
    
    // Use provided renderer or try to get from gameState
    if (renderer) {
      this.renderer = renderer;
    } else if (gameState.renderer) {
      console.log("Using renderer from gameState");
      this.renderer = gameState.renderer;
    } else {
      console.warn("No renderer provided or found in gameState");
      this.renderer = null;
    }
    
    // Use the provided controls
    this.controls = controls;
    
    // Save original scene objects to restore later
    this.originalSceneObjects = [];
    if (scene && scene.children) {
      // Clone the children array to avoid modification issues
      this.originalSceneObjects = [...scene.children];
    }
    
    this.targets = [];
    this.score = 0;
    this.timeRemaining = 60; // seconds
    this.isActive = false;
    this.lastUpdateTime = 0;
    this.firstUpdate = true; // Flag to track first update
    this.bulletManager = null;
    this.scoreboard = null;
    this.timer = null;
    this.activeEffects = [];
    
    // Bind methods to retain 'this' context
    this.update = this.update.bind(this);
    this.handleShoot = this.handleShoot.bind(this);
    this.createTargets = this.createTargets.bind(this);
    this.cleanup = this.cleanup.bind(this);
    
    console.log("TrainingChallengeManager created");
  }
  
  // Initialize the training arena
  initialize() {
    console.log("Initializing training challenge");
    this.isActive = true;
    this.score = 0;
    this.timeRemaining = 60;
    this.lastUpdateTime = Date.now();
    this.firstUpdate = true;
    this.activeEffects = [];
    
    try {
      // Clear the existing scene but keep the original reference
      while(this.scene.children.length > 0){ 
        this.scene.remove(this.scene.children[0]); 
      }
      
      // Set a sky blue background
      this.scene.background = new THREE.Color(0x87CEEB);
      
      // Add fog for low/medium quality to limit draw distance
      if (this.quality !== 'high') {
        this.scene.fog = new THREE.Fog(
          0x87CEEB, 
          this.quality === 'low' ? 20 : 30, 
          this.qualitySettings.drawDistance
        );
      }
      
      // Setup the arena
      this.createTrainingArena();
      
      // Setup UI
      this.createUI();
      
      // Create targets
      this.createTargets();
      
      // Setup bullet manager
      this.setupBulletManager();
      
      // Setup event listeners
      document.addEventListener('mousedown', this.handleShoot);
      
      // Lock pointer
      if (this.controls) {
        try {
          this.controls.lock();
        } catch (error) {
          console.error("Error locking controls:", error);
        }
      }
      
      // Ensure camera is at a good starting position in the training arena
      this.camera.position.set(0, 1.7, 0);
      
      // Do an initial render to ensure everything is visible
      if (this.renderer) {
        this.renderer.render(this.scene, this.camera);
        console.log("Initial render successful");
      } else {
        console.warn("Cannot render - no renderer available");
      }
      
      console.log("Training challenge initialized with time:", this.timeRemaining);
    } catch (error) {
      console.error("Error initializing training challenge:", error);
      this.exitChallenge();
    }
  }
  
  // Create the training arena environment
  createTrainingArena() {
    console.log("Creating training arena");
    
    try {
      // Create floor with detail level based on quality
      const floorSegments = this.quality === 'low' ? 10 : (this.quality === 'medium' ? 25 : 50);
      const floorGeometry = new THREE.PlaneGeometry(TRAINING_ARENA_SIZE, TRAINING_ARENA_SIZE, floorSegments, floorSegments);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        side: THREE.DoubleSide,
        roughness: 0.8,
        flatShading: this.quality === 'low'
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = Math.PI / 2;
      floor.position.y = 0;
      
      // Only receive shadows on medium/high quality
      if (this.quality !== 'low' && this.qualitySettings.shadowsEnabled) {
        floor.receiveShadow = true;
      }
      
      this.scene.add(floor);
      
      // Create walls with detail level based on quality
      const wallSegments = this.quality === 'low' ? 1 : (this.quality === 'medium' ? 2 : 4);
      const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x0088FF,
        emissive: 0x0044AA,
        emissiveIntensity: 0.2,
        flatShading: this.quality === 'low'
      });
      
      // Create the four walls
      const northWall = new THREE.Mesh(
        new THREE.BoxGeometry(TRAINING_ARENA_SIZE, 4, 1, wallSegments, wallSegments, wallSegments), 
        wallMaterial
      );
      northWall.position.set(0, 2, -TRAINING_ARENA_SIZE/2);
      if (this.quality !== 'low' && this.qualitySettings.shadowsEnabled) northWall.castShadow = true;
      this.scene.add(northWall);
      
      const southWall = new THREE.Mesh(
        new THREE.BoxGeometry(TRAINING_ARENA_SIZE, 4, 1, wallSegments, wallSegments, wallSegments), 
        wallMaterial
      );
      southWall.position.set(0, 2, TRAINING_ARENA_SIZE/2);
      if (this.quality !== 'low' && this.qualitySettings.shadowsEnabled) southWall.castShadow = true;
      this.scene.add(southWall);
      
      const eastWall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 4, TRAINING_ARENA_SIZE, wallSegments, wallSegments, wallSegments), 
        wallMaterial
      );
      eastWall.position.set(TRAINING_ARENA_SIZE/2, 2, 0);
      if (this.quality !== 'low' && this.qualitySettings.shadowsEnabled) eastWall.castShadow = true;
      this.scene.add(eastWall);
      
      const westWall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 4, TRAINING_ARENA_SIZE, wallSegments, wallSegments, wallSegments), 
        wallMaterial
      );
      westWall.position.set(-TRAINING_ARENA_SIZE/2, 2, 0);
      if (this.quality !== 'low' && this.qualitySettings.shadowsEnabled) westWall.castShadow = true;
      this.scene.add(westWall);
      
      // Add lighting based on quality
      const ambientLight = new THREE.AmbientLight(0x404040, this.quality === 'low' ? 2.0 : 1.5);
      this.scene.add(ambientLight);
      
      // Only add directional light with shadows on medium/high
      if (this.quality !== 'low') {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = this.qualitySettings.shadowsEnabled;
        
        // Adjust shadow map size based on quality
        if (directionalLight.castShadow) {
          directionalLight.shadow.mapSize.width = this.quality === 'high' ? 1024 : 512;
          directionalLight.shadow.mapSize.height = this.quality === 'high' ? 1024 : 512;
        }
        
        this.scene.add(directionalLight);
      } else {
        // Add a simple directional light without shadows for low quality
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
      }
      
      // Add exit portal
      this.createExitPortal();
      
      console.log("Training arena created with", this.scene.children.length, "objects");
    } catch (error) {
      console.error("Error creating training arena:", error);
    }
  }
  
  // Create exit portal
  createExitPortal() {
    // Adjust portal detail based on quality
    const segments = this.quality === 'low' ? 16 : (this.quality === 'medium' ? 24 : 32);
    
    const portalGeometry = new THREE.SphereGeometry(0.7, segments, segments);
    const portalMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF0000,
      transparent: true,
      opacity: 0.7,
      emissive: 0xFF0000,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8
    });
    
    const portalMesh = new THREE.Mesh(portalGeometry, portalMaterial);
    portalMesh.position.set(TRAINING_ARENA_SIZE/2 - 2, 1.5, TRAINING_ARENA_SIZE/2 - 2);
    this.scene.add(portalMesh);
    
    // Add a text label near the portal
    this.createTextLabel("EXIT", portalMesh.position.x, portalMesh.position.y + 1, portalMesh.position.z);
    
    this.exitPortal = portalMesh;
  }
  
  // Create a floating text label
  createTextLabel(text, x, y, z) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = '#ffffff';
    context.font = 'Bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    const geometry = new THREE.PlaneGeometry(2, 0.5);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    
    // Always face the camera
    mesh.userData.isLabel = true;
    
    this.scene.add(mesh);
    return mesh;
  }
  
  // Create score and timer UI
  createUI() {
    // Create scoreboard element
    const scoreboardDiv = document.createElement('div');
    scoreboardDiv.id = 'training-scoreboard';
    scoreboardDiv.style.position = 'absolute';
    scoreboardDiv.style.top = '20px';
    scoreboardDiv.style.left = '20px';
    scoreboardDiv.style.fontSize = '24px';
    scoreboardDiv.style.fontWeight = 'bold';
    scoreboardDiv.style.color = '#FFFFFF';
    scoreboardDiv.style.textShadow = '2px 2px 4px #000000';
    scoreboardDiv.textContent = `Score: ${this.score}`;
    document.body.appendChild(scoreboardDiv);
    this.scoreboard = scoreboardDiv;
    
    // Create timer element
    const timerDiv = document.createElement('div');
    timerDiv.id = 'training-timer';
    timerDiv.style.position = 'absolute';
    timerDiv.style.top = '20px';
    timerDiv.style.right = '20px';
    timerDiv.style.fontSize = '24px';
    timerDiv.style.fontWeight = 'bold';
    timerDiv.style.color = '#FFFFFF';
    timerDiv.style.textShadow = '2px 2px 4px #000000';
    timerDiv.textContent = `Time: ${this.timeRemaining}s`;
    document.body.appendChild(timerDiv);
    this.timer = timerDiv;
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
    const isMoving = Math.random() > 0.5;
    
    // Create target geometry (different for static vs moving)
    let targetGeometry, targetMaterial;
    
    // Adjust detail based on quality
    const sphereDetail = this.qualitySettings.targetDetail;
    const boxDetail = this.quality === 'low' ? 1 : (this.quality === 'medium' ? 2 : 4);
    
    if (isMoving) {
      // Moving targets are spheres
      targetGeometry = new THREE.SphereGeometry(0.3, sphereDetail, sphereDetail);
      targetMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFF9500,
        emissive: 0xFF9500,
        emissiveIntensity: 0.5,
        flatShading: this.quality === 'low'
      });
    } else {
      // Static targets are cubes
      targetGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5, boxDetail, boxDetail, boxDetail);
      targetMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00FF00,
        emissive: 0x00FF00,
        emissiveIntensity: 0.3,
        flatShading: this.quality === 'low'
      });
    }
    
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    
    // Set random position within arena
    const margin = 5;
    target.position.set(
      Math.random() * (TRAINING_ARENA_SIZE - margin * 2) - (TRAINING_ARENA_SIZE / 2 - margin),
      1 + Math.random() * 3,
      Math.random() * (TRAINING_ARENA_SIZE - margin * 2) - (TRAINING_ARENA_SIZE / 2 - margin)
    );
    
    // Add shadows for medium/high quality
    if (this.quality !== 'low' && this.qualitySettings.shadowsEnabled) {
      target.castShadow = true;
    }
    
    // Add movement properties for moving targets
    if (isMoving) {
      const speed = TARGET_SPEED_MIN + Math.random() * (TARGET_SPEED_MAX - TARGET_SPEED_MIN);
      target.userData = {
        isTarget: true,
        isMoving: true,
        speed: speed,
        direction: new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 0.5 - 0.25,
          Math.random() * 2 - 1
        ).normalize(),
        points: 20, // More points for moving targets
        minY: 0.5,
        maxY: 4
      };
    } else {
      target.userData = {
        isTarget: true,
        isMoving: false,
        points: 10 // Fewer points for static targets
      };
    }
    
    this.scene.add(target);
    this.targets.push(target);
    
    return target;
  }
  
  // Setup bullet manager
  setupBulletManager() {
    // Import the BulletManager class similar to how it's used in threeSetup.js
    this.bulletManager = {
      scene: this.scene,
      bullets: [],
      raycaster: new THREE.Raycaster(),
      active: true,
      maxBullets: this.qualitySettings.maxBullets,
      bulletDetail: this.quality === 'low' ? 4 : (this.quality === 'medium' ? 6 : 8),
      
      createBullet: (camera) => {
        if (!this.bulletManager.active) return;
        
        // Limit max bullets based on quality
        if (this.bulletManager.bullets.length >= this.bulletManager.maxBullets) {
          // Remove oldest bullet if at max
          const oldestBullet = this.bulletManager.bullets.shift();
          this.scene.remove(oldestBullet);
        }
        
        // Create bullet geometry and material with detail level based on quality
        const bulletGeometry = new THREE.SphereGeometry(0.1, this.bulletManager.bulletDetail, this.bulletManager.bulletDetail);
        const bulletMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xFFD700, 
          emissive: 0xFFD700,
          emissiveIntensity: 0.5,
          flatShading: this.quality === 'low'
        });
        
        // Create bullet mesh
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Set initial position slightly in front of the camera
        const bulletStartPosition = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        bullet.position.copy(camera.position).add(bulletStartPosition.multiplyScalar(0.5));
        
        // Get direction from camera
        const bulletDirection = new THREE.Vector3(0, 0, -1);
        bulletDirection.applyQuaternion(camera.quaternion);
        bulletDirection.normalize();
        
        // Add bullet to scene
        this.scene.add(bullet);
        
        // Store bullet properties
        bullet.userData = { 
          direction: bulletDirection,
          speed: 0.15,
          lastUpdateTime: Date.now(),
          distanceTraveled: 0,
          maxDistance: this.qualitySettings.drawDistance,
          maxStepSize: 0.5
        };
        
        // Add bullet to tracking array
        this.bulletManager.bullets.push(bullet);
        
        // Create muzzle flash effect
        this.createMuzzleFlash(camera);
      },
      
      update: (currentTime) => {
        if (!this.bulletManager.active || this.bulletManager.bullets.length === 0) return;
        
        const bulletsToRemove = [];
        
        this.bulletManager.bullets.forEach(bullet => {
          // Calculate time-based movement
          const elapsedTime = currentTime - bullet.userData.lastUpdateTime;
          bullet.userData.lastUpdateTime = currentTime;
          
          // Calculate distance to move based on elapsed time and speed
          let distanceToMove = bullet.userData.speed * elapsedTime;
          
          // Limit maximum step size to prevent tunneling through objects
          while (distanceToMove > 0) {
            // Calculate step size for this iteration
            const stepSize = Math.min(distanceToMove, bullet.userData.maxStepSize);
            distanceToMove -= stepSize;
            
            // Store current position for collision detection
            const previousPosition = bullet.position.clone();
            
            // Move bullet forward by step size
            const movement = bullet.userData.direction.clone().multiplyScalar(stepSize);
            bullet.position.add(movement);
            
            // Update total distance traveled
            bullet.userData.distanceTraveled += stepSize;
            
            // Check for collisions using continuous collision detection
            this.bulletManager.raycaster.set(previousPosition, bullet.userData.direction);
            this.bulletManager.raycaster.far = previousPosition.distanceTo(bullet.position);
            
            const intersects = this.bulletManager.raycaster.intersectObjects(this.scene.children);
            let hitSomething = false;
            
            for (let i = 0; i < intersects.length; i++) {
              const object = intersects[i].object;
              
              // Skip the bullet itself
              if (object === bullet) continue;
              
              // Check if hit a target
              if (object.userData && object.userData.isTarget) {
                // Hit a target
                this.handleTargetHit(object);
                hitSomething = true;
                break;
              }
              
              // Check if hit a wall or floor (any non-bullet, non-label object)
              if (object !== bullet && !object.userData.isLabel) {
                this.createHitEffect(intersects[i].point);
                hitSomething = true;
                break;
              }
            }
            
            // If hit something or traveled too far, mark for removal and stop movement
            if (hitSomething || bullet.userData.distanceTraveled > bullet.userData.maxDistance) {
              bulletsToRemove.push(bullet);
              break;
            }
          }
        });
        
        // Remove bullets marked for removal
        bulletsToRemove.forEach(bullet => {
          const index = this.bulletManager.bullets.indexOf(bullet);
          if (index !== -1) {
            this.bulletManager.bullets.splice(index, 1);
          }
          this.scene.remove(bullet);
        });
      },
      
      cleanup: () => {
        this.bulletManager.active = false;
        
        // Remove all bullets from scene
        this.bulletManager.bullets.forEach(bullet => {
          this.scene.remove(bullet);
        });
        
        // Clear bullets array
        this.bulletManager.bullets = [];
      }
    };
  }
  
  // Handle target hit
  handleTargetHit(target) {
    // Increase score based on target type
    this.score += target.userData.points;
    this.updateScoreboard();
    
    // Create hit effect
    this.createHitEffect(target.position.clone());
    
    // Remove target
    this.scene.remove(target);
    
    // Remove from targets array
    const index = this.targets.indexOf(target);
    if (index !== -1) {
      this.targets.splice(index, 1);
    }
    
    // Create a new target to replace it
    setTimeout(() => {
      if (this.isActive) {
        this.createTarget();
      }
    }, 1000);
  }
  
  // Update score display
  updateScoreboard() {
    if (this.scoreboard) {
      this.scoreboard.textContent = `Score: ${this.score}`;
    }
  }
  
  // Update timer display
  updateTimer() {
    if (this.timer) {
      this.timer.textContent = `Time: ${Math.ceil(this.timeRemaining)}s`;
      
      // Make timer red when time is running out
      if (this.timeRemaining <= 10) {
        this.timer.style.color = '#FF0000';
      }
    }
  }
  
  // Create hit effect at position
  createHitEffect(position) {
    // Limit number of active effects based on quality
    if (this.activeEffects.length >= this.qualitySettings.maxEffects) {
      // Remove oldest effect
      const oldestEffect = this.activeEffects.shift();
      this.scene.remove(oldestEffect);
    }
    
    // Adjust detail based on quality
    const effectDetail = this.qualitySettings.effectDetail;
    
    const hitGeometry = new THREE.SphereGeometry(0.2, effectDetail, effectDetail);
    const hitMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFF00, 
      transparent: true, 
      opacity: 1,
      flatShading: this.quality === 'low'
    });
    
    const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
    hitEffect.position.copy(position);
    this.scene.add(hitEffect);
    this.activeEffects.push(hitEffect);
    
    // Animate and remove
    let scale = 1;
    let opacity = 1;
    
    const animateHit = () => {
      if (!this.isActive) {
        this.scene.remove(hitEffect);
        const index = this.activeEffects.indexOf(hitEffect);
        if (index !== -1) this.activeEffects.splice(index, 1);
        return;
      }
      
      // Adjust animation speed based on quality
      const scaleStep = this.quality === 'low' ? 0.2 : (this.quality === 'medium' ? 0.15 : 0.1);
      const opacityStep = this.quality === 'low' ? 0.1 : (this.quality === 'medium' ? 0.075 : 0.05);
      
      scale += scaleStep;
      opacity -= opacityStep;
      
      hitEffect.scale.set(scale, scale, scale);
      hitMaterial.opacity = opacity;
      
      if (opacity <= 0) {
        this.scene.remove(hitEffect);
        const index = this.activeEffects.indexOf(hitEffect);
        if (index !== -1) this.activeEffects.splice(index, 1);
        return;
      }
      
      requestAnimationFrame(animateHit);
    };
    
    animateHit();
  }
  
  // Create muzzle flash effect
  createMuzzleFlash(camera) {
    // Skip muzzle flash on low quality
    if (this.quality === 'low') return;
    
    // Limit number of active effects based on quality
    if (this.activeEffects.length >= this.qualitySettings.maxEffects) {
      // Remove oldest effect
      const oldestEffect = this.activeEffects.shift();
      this.scene.remove(oldestEffect);
    }
    
    // Adjust detail based on quality
    const effectDetail = this.qualitySettings.effectDetail;
    
    const flashGeometry = new THREE.SphereGeometry(0.15, effectDetail, effectDetail);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFFFF00, 
      transparent: true, 
      opacity: 1 
    });
    
    const muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
    
    // Position at the end of the gun
    const flashPosition = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    muzzleFlash.position.copy(camera.position).add(flashPosition.multiplyScalar(0.8));
    
    this.scene.add(muzzleFlash);
    this.activeEffects.push(muzzleFlash);
    
    // Animate and remove quickly
    let opacity = 1;
    
    const animateFlash = () => {
      if (!this.isActive) {
        this.scene.remove(muzzleFlash);
        const index = this.activeEffects.indexOf(muzzleFlash);
        if (index !== -1) this.activeEffects.splice(index, 1);
        return;
      }
      
      // Adjust animation speed based on quality
      const opacityStep = this.quality === 'medium' ? 0.3 : 0.2;
      
      opacity -= opacityStep;
      flashMaterial.opacity = opacity;
      
      if (opacity <= 0) {
        this.scene.remove(muzzleFlash);
        const index = this.activeEffects.indexOf(muzzleFlash);
        if (index !== -1) this.activeEffects.splice(index, 1);
        return;
      }
      
      requestAnimationFrame(animateFlash);
    };
    
    animateFlash();
  }
  
  // Handle shooting
  handleShoot(e) {
    if (this.isActive && this.controls.isLocked) {
      this.bulletManager.createBullet(this.camera);
    }
  }
  
  // Update function called every frame
  update(deltaTime) {
    if (!this.isActive) return false;
    
    try {
      // Reset lastUpdateTime on first update to avoid large initial deltaTime
      if (this.firstUpdate) {
        this.lastUpdateTime = Date.now();
        this.firstUpdate = false;
        console.log("First update - resetting timer");
        return true; // Skip the first update to avoid large deltaTime
      }
      
      // Cap deltaTime to prevent huge jumps
      const cappedDeltaTime = Math.min(deltaTime, MAX_DELTA_TIME);
      
      // Update timer - use capped deltaTime
      this.timeRemaining -= cappedDeltaTime;
      console.log("Time remaining:", this.timeRemaining, "Delta time:", cappedDeltaTime);
      this.updateTimer();
      
      // Check if time ran out
      if (this.timeRemaining <= 0) {
        console.log("Time ran out, ending challenge");
        this.endChallenge();
        return false;
      }
      
      // Update bullets using the current time
      const currentTime = Date.now();
      if (this.bulletManager) {
        this.bulletManager.update(currentTime);
      }
      
      // Update moving targets
      this.updateTargets(cappedDeltaTime);
      
      // Make text labels face the camera
      this.updateTextLabels();
      
      // Check for exit portal proximity
      this.checkExitPortalProximity();
      
      // Render the scene (if we have a renderer)
      if (this.renderer) {
        this.renderer.render(this.scene, this.camera);
      }
      
      return true;
    } catch (error) {
      console.error("Error updating training challenge:", error);
      return false;
    }
  }
  
  // Update targets (move the moving ones)
  updateTargets(deltaTime) {
    for (const target of this.targets) {
      if (target.userData.isMoving) {
        // Move the target according to its direction and speed
        const movement = target.userData.direction.clone().multiplyScalar(target.userData.speed * deltaTime * 60);
        target.position.add(movement);
        
        // Keep target within arena boundaries
        const MARGIN = 2;
        const MAX_X = TRAINING_ARENA_SIZE / 2 - MARGIN;
        const MIN_X = -MAX_X;
        const MAX_Z = TRAINING_ARENA_SIZE / 2 - MARGIN;
        const MIN_Z = -MAX_Z;
        const MIN_Y = target.userData.minY;
        const MAX_Y = target.userData.maxY;
        
        let bounced = false;
        
        // Check X boundaries
        if (target.position.x > MAX_X || target.position.x < MIN_X) {
          target.userData.direction.x *= -1;
          bounced = true;
        }
        
        // Check Z boundaries
        if (target.position.z > MAX_Z || target.position.z < MIN_Z) {
          target.userData.direction.z *= -1;
          bounced = true;
        }
        
        // Check Y boundaries
        if (target.position.y > MAX_Y || target.position.y < MIN_Y) {
          target.userData.direction.y *= -1;
          bounced = true;
        }
        
        // If target bounced, ensure it's within bounds
        if (bounced) {
          target.position.x = Math.max(MIN_X, Math.min(MAX_X, target.position.x));
          target.position.y = Math.max(MIN_Y, Math.min(MAX_Y, target.position.y));
          target.position.z = Math.max(MIN_Z, Math.min(MAX_Z, target.position.z));
        }
      }
    }
  }
  
  // Make text labels face the camera
  updateTextLabels() {
    this.scene.traverse((object) => {
      if (object.userData && object.userData.isLabel) {
        object.lookAt(this.camera.position);
      }
    });
  }
  
  // Check if player is near exit portal
  checkExitPortalProximity() {
    if (!this.exitPortal) return;
    
    const playerPosition = this.camera.position.clone();
    const portalPosition = this.exitPortal.position.clone();
    
    const distanceToPortal = playerPosition.distanceTo(portalPosition);
    const portalVisible = distanceToPortal < 3;
    
    // Portal interaction
    if (portalVisible && gameState.keys && gameState.keys['e']) {
      this.exitChallenge();
      gameState.keys['e'] = false; // Reset key to prevent multiple toggles
    }
    
    // Animate portal
    if (this.exitPortal) {
      this.exitPortal.rotation.y += 0.01;
      const scale = 1 + 0.1 * Math.sin(Date.now() * 0.002);
      this.exitPortal.scale.set(scale, scale, scale);
      
      // Glow effect based on proximity
      if (portalVisible) {
        const glowIntensity = 1 - (distanceToPortal / 3);
        this.exitPortal.material.opacity = 0.7 + glowIntensity * 0.3;
        
        // Check if material has emissive property before setting it
        if (this.exitPortal.material.emissive) {
          this.exitPortal.material.emissiveIntensity = 0.5 + glowIntensity * 0.5;
        }
      }
    }
  }
  
  // End the challenge (time out)
  endChallenge() {
    console.log("Ending challenge with score:", this.score);
    // Show final score
    this.showFinalScore();
    
    // Set a timeout to exit the challenge
    setTimeout(() => {
      this.exitChallenge();
    }, 5000);
  }
  
  // Show final score
  showFinalScore() {
    const finalScoreDiv = document.createElement('div');
    finalScoreDiv.id = 'final-score';
    finalScoreDiv.style.position = 'absolute';
    finalScoreDiv.style.top = '50%';
    finalScoreDiv.style.left = '50%';
    finalScoreDiv.style.transform = 'translate(-50%, -50%)';
    finalScoreDiv.style.fontSize = '32px';
    finalScoreDiv.style.fontWeight = 'bold';
    finalScoreDiv.style.color = '#FFFFFF';
    finalScoreDiv.style.textShadow = '2px 2px 4px #000000';
    finalScoreDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    finalScoreDiv.style.padding = '20px';
    finalScoreDiv.style.borderRadius = '10px';
    finalScoreDiv.style.textAlign = 'center';
    finalScoreDiv.innerHTML = `
      <div>Time's Up!</div>
      <div>Final Score: ${this.score}</div>
      <div style="font-size: 20px; margin-top: 20px;">Exiting in 5 seconds...</div>
    `;
    
    document.body.appendChild(finalScoreDiv);
    this.finalScoreDiv = finalScoreDiv;
  }
  
  // Exit challenge and return to main 3D world
  exitChallenge() {
    console.log("Exiting training challenge");
    
    try {
      this.cleanup();
      
      // Restore original scene objects
      this.restoreOriginalScene();
      
      // Return to main 3D world
      if (gameState.setMode) {
        gameState.setMode('3D');
      } else {
        gameState.mode = '3D';
      }
    } catch (error) {
      console.error("Error exiting training challenge:", error);
      // Force return to 3D mode even if there's an error
      gameState.mode = '3D';
    }
  }
  
  // Restore the original scene
  restoreOriginalScene() {
    try {
      // Clear current scene
      while(this.scene.children.length > 0){ 
        this.scene.remove(this.scene.children[0]); 
      }
      
      // Reset background
      this.scene.background = new THREE.Color(0x87CEEB);
      
      // Re-add original objects
      if (this.originalSceneObjects && this.originalSceneObjects.length > 0) {
        for (const obj of this.originalSceneObjects) {
          if (!this.scene.children.includes(obj)) {
            this.scene.add(obj);
          }
        }
      }
      
      console.log("Original scene restored");
    } catch (error) {
      console.error("Error restoring original scene:", error);
    }
  }
  
  // Clean up resources
  cleanup() {
    console.log("Cleaning up training challenge");
    this.isActive = false;
    
    try {
      // Remove UI elements
      if (this.scoreboard) {
        document.body.removeChild(this.scoreboard);
        this.scoreboard = null;
      }
      
      if (this.timer) {
        document.body.removeChild(this.timer);
        this.timer = null;
      }
      
      if (this.finalScoreDiv) {
        document.body.removeChild(this.finalScoreDiv);
        this.finalScoreDiv = null;
      }
      
      // Remove event listeners
      document.removeEventListener('mousedown', this.handleShoot);
      
      // Clean up bullet manager
      if (this.bulletManager) {
        this.bulletManager.cleanup();
      }
      
      // Unlock controls if needed
      if (this.controls && this.controls.isLocked) {
        try {
          this.controls.unlock();
        } catch (error) {
          console.error("Error unlocking controls:", error);
        }
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

// Create training challenge manager instance
let trainingChallengeManager = null;

// Function to initialize the training challenge
export function enterTrainingChallenge(scene, camera, renderer, controls) {
  console.log("Entering training challenge", { 
    sceneExists: !!scene, 
    cameraExists: !!camera, 
    rendererExists: !!renderer, 
    controlsExists: !!controls 
  });
  
  try {
    // Clean up any existing instance
    if (trainingChallengeManager) {
      trainingChallengeManager.cleanup();
    }
    
    // Use the provided renderer or get from gameState
    if (!renderer && gameState.renderer) {
      console.log("Using renderer from gameState in enterTrainingChallenge");
      renderer = gameState.renderer;
    }
    
    // Create new instance
    trainingChallengeManager = new TrainingChallengeManager(scene, camera, renderer, controls);
    
    // Initialize challenge
    trainingChallengeManager.initialize();
    
    return trainingChallengeManager;
  } catch (error) {
    console.error("Error entering training challenge:", error);
    // If there's an error, make sure we return to 3D mode
    if (gameState.setMode) {
      gameState.setMode('3D');
    } else {
      gameState.mode = '3D';
    }
    return null;
  }
}

// Function to update the training challenge
export function updateTrainingChallenge(deltaTime) {
  try {
    if (trainingChallengeManager && trainingChallengeManager.isActive) {
      // Convert deltaTime from milliseconds to seconds if needed
      const deltaTimeInSeconds = deltaTime / 1000;
      return trainingChallengeManager.update(deltaTimeInSeconds);
    }
  } catch (error) {
    console.error("Error updating training challenge:", error);
  }
  return false;
}

// Function to cleanup the training challenge
export function cleanupTrainingChallenge() {
  console.log("Cleaning up training challenge from external call");
  try {
    if (trainingChallengeManager) {
      trainingChallengeManager.cleanup();
      trainingChallengeManager = null;
    }
  } catch (error) {
    console.error("Error cleaning up training challenge:", error);
  }
} 