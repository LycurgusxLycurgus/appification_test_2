import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { enterTrainingChallenge, updateTrainingChallenge, cleanupTrainingChallenge } from './trainingChallengeSetup';

// Graphics quality presets
const QUALITY_SETTINGS = {
  low: {
    pixelRatio: 0.5,
    shadowMapEnabled: false,
    antialias: false,
    targetCount: 3,
    drawDistance: 50,
    textureQuality: 'low',
    particleCount: 5
  },
  medium: {
    pixelRatio: 0.75,
    shadowMapEnabled: true,
    antialias: true,
    targetCount: 5,
    drawDistance: 100,
    textureQuality: 'medium',
    particleCount: 10
  },
  high: {
    pixelRatio: 1.0,
    shadowMapEnabled: true,
    antialias: true,
    targetCount: 8,
    drawDistance: 200,
    textureQuality: 'high',
    particleCount: 20
  }
};

// BulletManager class to handle all bullet-related operations
class BulletManager {
  constructor(scene, quality = 'low') {
    this.scene = scene;
    this.bullets = [];
    this.raycaster = new THREE.Raycaster();
    this.active = true;
    this.quality = quality;
    
    // Set quality-specific properties
    this.maxBullets = QUALITY_SETTINGS[quality].particleCount;
    this.bulletDetail = quality === 'low' ? 4 : (quality === 'medium' ? 6 : 8);
  }

  createBullet(camera) {
    if (!this.active) return;
    
    // Limit max bullets based on quality
    if (this.bullets.length >= this.maxBullets) {
      // Remove oldest bullet if at max
      const oldestBullet = this.bullets.shift();
      this.scene.remove(oldestBullet);
    }

    // Create bullet geometry and material with detail level based on quality
    const bulletGeometry = new THREE.SphereGeometry(0.1, this.bulletDetail, this.bulletDetail);
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFD700, 
      emissive: 0xFFD700,
      emissiveIntensity: 0.5
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
      maxDistance: QUALITY_SETTINGS[this.quality].drawDistance,
      maxStepSize: 0.5
    };
    
    // Add bullet to tracking array
    this.bullets.push(bullet);
  }

  update(currentTime) {
    if (!this.active || this.bullets.length === 0) return;
    
    const bulletsToRemove = [];
    
    this.bullets.forEach(bullet => {
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
        this.raycaster.set(previousPosition, bullet.userData.direction);
        this.raycaster.far = previousPosition.distanceTo(bullet.position);
        
        const intersects = this.raycaster.intersectObjects(this.scene.children);
        let hitSomething = false;
        
        for (let i = 0; i < intersects.length; i++) {
          const object = intersects[i].object;
          
          // Skip the bullet itself
          if (object === bullet) continue;
          
          // Check if hit a target
          if (object.userData && object.userData.isTarget) {
            // Hit a target
            this.scene.remove(object);
            this.createHitEffect(intersects[i].point);
            hitSomething = true;
            break;
          }
          
          // Check if hit a wall or floor (any non-bullet object)
          if (object !== bullet) {
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
      const index = this.bullets.indexOf(bullet);
      if (index !== -1) {
        this.bullets.splice(index, 1);
      }
      this.scene.remove(bullet);
    });
  }

  createHitEffect(position) {
    const hitGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const hitMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFF00, 
      transparent: true, 
      opacity: 1 
    });
    
    const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
    hitEffect.position.copy(position);
    this.scene.add(hitEffect);
    
    // Animate and remove
    let scale = 1;
    let opacity = 1;
    
    const animateHit = () => {
      if (!this.active) {
        this.scene.remove(hitEffect);
        return;
      }
      
      scale += 0.1;
      opacity -= 0.05;
      
      hitEffect.scale.set(scale, scale, scale);
      hitMaterial.opacity = opacity;
      
      if (opacity <= 0) {
        this.scene.remove(hitEffect);
        return;
      }
      
      requestAnimationFrame(animateHit);
    };
    
    animateHit();
  }

  cleanup() {
    this.active = false;
    
    // Remove all bullets from scene
    this.bullets.forEach(bullet => {
      this.scene.remove(bullet);
    });
    
    // Clear bullets array
    this.bullets = [];
  }
}

// Function to apply quality settings to renderer
const applyQualitySettings = (renderer, quality) => {
  const settings = QUALITY_SETTINGS[quality];
  
  // Set pixel ratio (lower = better performance)
  renderer.setPixelRatio(window.devicePixelRatio * settings.pixelRatio);
  
  // Enable/disable shadows
  renderer.shadowMap.enabled = settings.shadowMapEnabled;
  
  // Set shadow map type based on quality
  if (settings.shadowMapEnabled) {
    renderer.shadowMap.type = quality === 'high' 
      ? THREE.PCFSoftShadowMap 
      : THREE.BasicShadowMap;
  }
  
  console.log(`Applied ${quality} quality settings`);
};

// Create quality settings UI
const createQualitySettingsUI = (state) => {
  const settingsContainer = document.createElement('div');
  settingsContainer.id = 'quality-settings';
  settingsContainer.style.position = 'absolute';
  settingsContainer.style.top = '10px';
  settingsContainer.style.right = '10px';
  settingsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  settingsContainer.style.padding = '10px';
  settingsContainer.style.borderRadius = '5px';
  settingsContainer.style.color = 'white';
  settingsContainer.style.fontFamily = 'Arial, sans-serif';
  settingsContainer.style.zIndex = '1000';
  settingsContainer.style.display = state.mode === '3D' ? 'block' : 'none';
  
  const title = document.createElement('div');
  title.textContent = 'Graphics Quality';
  title.style.marginBottom = '5px';
  title.style.fontWeight = 'bold';
  settingsContainer.appendChild(title);
  
  // Create radio buttons for each quality level
  ['low', 'medium', 'high'].forEach(quality => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.margin = '5px 0';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'quality';
    radio.value = quality;
    radio.checked = state.graphicsQuality === quality;
    radio.style.marginRight = '5px';
    
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.setGraphicsQuality(quality);
        // Reload the page to apply new settings
        // This is a simple approach - a more complex one would update everything in real-time
        alert(`Graphics quality set to ${quality}. The game will reload to apply changes.`);
        window.location.reload();
      }
    });
    
    label.appendChild(radio);
    label.appendChild(document.createTextNode(quality.charAt(0).toUpperCase() + quality.slice(1)));
    settingsContainer.appendChild(label);
  });
  
  // Add a note about performance
  const note = document.createElement('div');
  note.textContent = 'Lower quality = better performance';
  note.style.fontSize = '10px';
  note.style.marginTop = '5px';
  note.style.fontStyle = 'italic';
  settingsContainer.appendChild(note);
  
  document.body.appendChild(settingsContainer);
  
  // Update visibility when game mode changes
  const updateVisibility = () => {
    settingsContainer.style.display = state.mode === '3D' ? 'block' : 'none';
  };
  
  // Return the update function so it can be called when mode changes
  return updateVisibility;
};

export const initThreeScene = (container, state, setMode) => {
  // Clean up any existing event listeners and bullet manager first
  // This ensures we don't have duplicates when switching back from 2D mode
  if (state.shootHandler) {
    document.removeEventListener('mousedown', state.shootHandler);
    state.shootHandler = null;
  }
  
  if (state.bulletManager) {
    state.bulletManager.cleanup();
    state.bulletManager = null;
  }
  
  // Get current quality settings
  const quality = state.graphicsQuality || 'low';
  const qualitySettings = QUALITY_SETTINGS[quality];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);

  // Set fog based on quality (reduces draw distance on lower settings)
  if (quality === 'low') {
    scene.fog = new THREE.Fog(0x87CEEB, 20, qualitySettings.drawDistance);
  } else if (quality === 'medium') {
    scene.fog = new THREE.Fog(0x87CEEB, 30, qualitySettings.drawDistance);
  }

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, qualitySettings.drawDistance);
  camera.position.set(0, 1.7, 0);

  // Create renderer with quality-appropriate settings
  const renderer = new THREE.WebGLRenderer({ 
    antialias: qualitySettings.antialias,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyQualitySettings(renderer, quality);
  container.appendChild(renderer.domElement);
  
  // Store the renderer in the state for access by other components
  state.renderer = renderer;

  // Setup pointer lock controls
  const controls = new PointerLockControls(camera, document.body);
  
  // Handle pointer lock errors gracefully
  controls.addEventListener('lock', () => {
    // Pointer is locked successfully
    state.pointerLocked = true;
  });
  
  controls.addEventListener('unlock', () => {
    // Pointer is unlocked
    state.pointerLocked = false;
  });
  
  // Only try to lock on click when in 3D mode and not already locked
  container.addEventListener('click', () => {
    if (state.mode === '3D' && !state.pointerLocked) {
      try {
        controls.lock();
      } catch (error) {
        console.warn('Could not lock pointer:', error);
      }
    }
  });

  // Add scene objects (floor, walls, portal, targets)
  addFloor(scene, quality);
  addWalls(scene, quality);
  addPortal(scene, state, quality);
  addTargets(scene, quality, qualitySettings.targetCount);

  // Lighting - adjust based on quality
  const ambientLight = new THREE.AmbientLight(0x404040, quality === 'low' ? 2.0 : 1.5);
  scene.add(ambientLight);
  
  // Only add directional light with shadows on medium/high
  if (quality !== 'low') {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = qualitySettings.shadowMapEnabled;
    
    // Adjust shadow map size based on quality
    if (directionalLight.castShadow) {
      directionalLight.shadow.mapSize.width = quality === 'high' ? 1024 : 512;
      directionalLight.shadow.mapSize.height = quality === 'high' ? 1024 : 512;
    }
    
    scene.add(directionalLight);
  } else {
    // Add a simple directional light without shadows for low quality
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);
  }

  // Create bullet manager with quality setting
  state.bulletManager = new BulletManager(scene, quality);
  
  // Store the shoot handler function so we can remove it later
  const shootHandler = (e) => {
    if (state.mode === '3D' && controls.isLocked) {
      state.bulletManager.createBullet(camera);
    }
  };
  
  // Add mousedown event listener for shooting
  document.addEventListener('mousedown', shootHandler);
  
  // Store the handler in state so we can remove it when cleaning up
  state.shootHandler = shootHandler;
  
  // Create quality settings UI
  const updateSettingsVisibility = createQualitySettingsUI(state);
  state.updateSettingsVisibility = updateSettingsVisibility;

  return { scene, camera, renderer, controls };
};

const addFloor = (scene, quality) => {
  // Adjust floor detail based on quality
  const segments = quality === 'low' ? 10 : (quality === 'medium' ? 25 : 50);
  
  const floorGeometry = new THREE.PlaneGeometry(50, 50, segments, segments);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555,
    side: THREE.DoubleSide,
    roughness: 0.8,
    // Simplify material on low quality
    flatShading: quality === 'low'
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = 0;
  
  // Only receive shadows on medium/high quality
  if (quality !== 'low') {
    floor.receiveShadow = true;
  }
  
  scene.add(floor);
};

const addWalls = (scene, quality) => {
  // Adjust wall material based on quality
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    // Simplify material on low quality
    flatShading: quality === 'low'
  });
  
  // Adjust wall segments based on quality
  const segments = quality === 'low' ? 1 : (quality === 'medium' ? 2 : 4);
  
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 1, segments, segments, segments), wallMaterial);
  northWall.position.set(0, 2, -25);
  if (quality !== 'low') northWall.castShadow = true;
  scene.add(northWall);
  
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 1, segments, segments, segments), wallMaterial);
  southWall.position.set(0, 2, 25);
  if (quality !== 'low') southWall.castShadow = true;
  scene.add(southWall);
  
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 50, segments, segments, segments), wallMaterial);
  eastWall.position.set(25, 2, 0);
  if (quality !== 'low') eastWall.castShadow = true;
  scene.add(eastWall);
  
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 50, segments, segments, segments), wallMaterial);
  westWall.position.set(-25, 2, 0);
  if (quality !== 'low') westWall.castShadow = true;
  scene.add(westWall);
};

const addPortal = (scene, state, quality) => {
  // Adjust portal detail based on quality
  const segments = quality === 'low' ? 16 : (quality === 'medium' ? 24 : 32);
  
  // Main 2D world portal
  const portalGeometry = new THREE.SphereGeometry(0.5, segments, segments);
  const portalMaterial = new THREE.MeshStandardMaterial({
    color: 0x00BFFF,
    transparent: true,
    opacity: 0.7,
    emissive: 0x00BFFF,
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.8
  });
  const portalMesh = new THREE.Mesh(portalGeometry, portalMaterial);
  // You can later make portal position configurable via state
  portalMesh.position.set(5, 1, -5);
  scene.add(portalMesh);
  state.portalMesh = portalMesh;
  state.portalPosition = { x: 5, y: 1, z: -5 };
  
  // Add a text label above the 2D world portal
  const deadlineDemonCanvas = document.createElement('canvas');
  const deadlineDemonContext = deadlineDemonCanvas.getContext('2d');
  deadlineDemonCanvas.width = 256;
  deadlineDemonCanvas.height = 64;
  
  deadlineDemonContext.fillStyle = '#ffffff';
  deadlineDemonContext.font = 'Bold 20px Arial';
  deadlineDemonContext.textAlign = 'center';
  deadlineDemonContext.textBaseline = 'middle';
  deadlineDemonContext.fillText('DeadlineDemon', 128, 32);
  
  const deadlineDemonTexture = new THREE.CanvasTexture(deadlineDemonCanvas);
  deadlineDemonTexture.minFilter = THREE.LinearFilter;
  
  const deadlineDemonLabelMaterial = new THREE.MeshBasicMaterial({
    map: deadlineDemonTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  const deadlineDemonLabelGeometry = new THREE.PlaneGeometry(2, 0.5);
  const deadlineDemonLabelMesh = new THREE.Mesh(deadlineDemonLabelGeometry, deadlineDemonLabelMaterial);
  deadlineDemonLabelMesh.position.set(5, 2, -5);
  
  // Make label always face the camera
  deadlineDemonLabelMesh.userData.isLabel = true;
  
  scene.add(deadlineDemonLabelMesh);
  state.deadlineDemonLabel = deadlineDemonLabelMesh;
  
  // Training challenge portal (red)
  const trainingPortalGeometry = new THREE.SphereGeometry(0.5, segments, segments);
  const trainingPortalMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF5500,
    transparent: true,
    opacity: 0.7,
    emissive: 0xFF5500,
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.8
  });
  const trainingPortalMesh = new THREE.Mesh(trainingPortalGeometry, trainingPortalMaterial);
  trainingPortalMesh.position.set(-5, 1, -5);
  scene.add(trainingPortalMesh);
  state.trainingPortalMesh = trainingPortalMesh;
  state.trainingPortalPosition = { x: -5, y: 1, z: -5 };
  
  // Add a text label above the training portal
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  
  context.fillStyle = '#ffffff';
  context.font = 'Bold 20px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Training Arena', 128, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const labelMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  const labelGeometry = new THREE.PlaneGeometry(2, 0.5);
  const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
  labelMesh.position.set(-5, 2, -5);
  
  // Make label always face the camera
  labelMesh.userData.isLabel = true;
  
  scene.add(labelMesh);
  state.trainingPortalLabel = labelMesh;
};

const addTargets = (scene, quality, targetCount) => {
  // Adjust target detail based on quality
  const segments = quality === 'low' ? 1 : (quality === 'medium' ? 2 : 4);
  
  const targetGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5, segments, segments, segments);
  const targetMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xFF0000,
    // Simplify material on low quality
    flatShading: quality === 'low'
  });
  
  for (let i = 0; i < targetCount; i++) {
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.position.set(Math.random() * 40 - 20, 1 + Math.random() * 2, Math.random() * 40 - 20);
    target.userData = { isTarget: true, id: 'target-3d-' + i };
    
    // Only cast shadows on medium/high quality
    if (quality !== 'low') {
      target.castShadow = true;
    }
    
    scene.add(target);
  }
};

// Function to check wall collisions
const checkWallCollision = (x, z) => {
  // Player radius (collision size)
  const playerRadius = 0.5;
  
  // Check boundaries of the room (walls are at ±25)
  const wallMargin = 25 - playerRadius;
  
  // Check if player would go through walls
  if (x > wallMargin || x < -wallMargin || z > wallMargin || z < -wallMargin) {
    return true; // Collision detected
  }
  
  return false; // No collision
};

export const updateThreeScene = (deltaTime, scene, camera, controls, state, setMode, renderer) => {
  // Skip updates if game is paused
  if (state.isPaused) return;
  
  // Make sure renderer is available (use the one from state if provided renderer is undefined)
  if (!renderer && state.renderer) {
    renderer = state.renderer;
  }
  
  // Update settings UI visibility if mode changed
  if (state.updateSettingsVisibility) {
    state.updateSettingsVisibility();
  }
  
  // Check if in training challenge mode
  if (state.mode === 'TRAINING_CHALLENGE') {
    try {
      // Update training challenge
      const challengeActive = updateTrainingChallenge(deltaTime);
      if (!challengeActive) {
        console.log("Training challenge ended, returning to 3D mode");
        // Training challenge ended, return to 3D mode
        state.mode = '3D';
        
        // Make sure we render the main scene again
        if (renderer) {
          renderer.render(scene, camera);
        }
      }
      // Note: We don't need to call renderer.render here as the training challenge handles that
    } catch (error) {
      console.error("Error in training challenge update:", error);
      // If there's an error, return to 3D mode
      state.mode = '3D';
    }
    return;
  }
  
  // Cap deltaTime to prevent huge jumps if the game lags
  const cappedDeltaTime = Math.min(deltaTime, 100);
  
  // Update bullets using the bullet manager
  if (state.bulletManager) {
    state.bulletManager.update(Date.now());
  }
  
  // Check for movement
  const moveSpeed = 0.015 * cappedDeltaTime; // Reduced speed for smoother movement
  const direction = new THREE.Vector3();
  
  // Reset velocity
  state.velocity.x = 0;
  state.velocity.z = 0;
  
  // Only process movement if pointer is locked
  if (state.pointerLocked) {
    // Apply keyboard controls
    if (state.keys['w'] || state.keys['arrowup']) {
      direction.z = -1;
    }
    if (state.keys['s'] || state.keys['arrowdown']) {
      direction.z = 1;
    }
    if (state.keys['a'] || state.keys['arrowleft']) {
      direction.x = -1;
    }
    if (state.keys['d'] || state.keys['arrowright']) {
      direction.x = 1;
    }
    
    // Normalize direction vector to prevent faster diagonal movement
    if (direction.length() > 0) {
      direction.normalize();
      
      // Apply movement based on camera direction
      direction.applyQuaternion(camera.quaternion);
      direction.y = 0; // Keep movement on the xz plane
      
      // Calculate new position
      const newX = camera.position.x + direction.x * moveSpeed;
      const newZ = camera.position.z + direction.z * moveSpeed;
      
      // Check wall collisions
      if (!checkWallCollision(newX, camera.position.z)) {
        camera.position.x = newX;
      }
      
      if (!checkWallCollision(camera.position.x, newZ)) {
        camera.position.z = newZ;
      }
      
      // Update player position
      state.player3D.x = camera.position.x;
      state.player3D.z = camera.position.z;
    }
  }
  
  // Check for portal proximity
  const portalPosition = new THREE.Vector3(
    state.portalPosition.x,
    state.portalPosition.y,
    state.portalPosition.z
  );
  
  const distanceToPortal = camera.position.distanceTo(portalPosition);
  const portalVisible = distanceToPortal < 3;
  
  // Portal interaction
  if (portalVisible && state.keys['e']) {
    // Unlock pointer before switching modes
    if (controls.isLocked) {
      controls.unlock();
    }
    state.pointerLocked = false;
    
    setMode('2D');
    state.keys['e'] = false; // Reset key to prevent multiple toggles
  }
  
  // Check for training challenge portal proximity
  if (state.trainingPortalPosition) {
    const trainingPortalPosition = new THREE.Vector3(
      state.trainingPortalPosition.x,
      state.trainingPortalPosition.y,
      state.trainingPortalPosition.z
    );
    
    const distanceToTrainingPortal = camera.position.distanceTo(trainingPortalPosition);
    const trainingPortalVisible = distanceToTrainingPortal < 3;
    
    // Training portal interaction
    if (trainingPortalVisible && state.keys['e']) {
      console.log("Entering training challenge from portal", { 
        renderer: renderer ? "defined" : "undefined",
        scene: scene ? "defined" : "undefined",
        camera: camera ? "defined" : "undefined"
      });
      
      // Store renderer in state for use in the training challenge
      if (renderer) {
        state.renderer = renderer;
      }
      
      // Enter training challenge
      state.mode = 'TRAINING_CHALLENGE';
      state.keys['e'] = false; // Reset key to prevent multiple toggles
      
      try {
        // Initialize training challenge - pass renderer as parameter
        enterTrainingChallenge(scene, camera, renderer, controls);
      } catch (error) {
        console.error("Error entering training challenge:", error);
        // If there's an error, stay in 3D mode
        state.mode = '3D';
      }
    }
    
    // Animate training portal
    if (state.trainingPortalMesh) {
      state.trainingPortalMesh.rotation.y += 0.01;
      const scale = 1 + 0.1 * Math.sin(Date.now() * 0.002);
      state.trainingPortalMesh.scale.set(scale, scale, scale);
      
      // Glow effect based on proximity
      if (trainingPortalVisible) {
        const glowIntensity = 1 - (distanceToTrainingPortal / 3);
        state.trainingPortalMesh.material.opacity = 0.7 + glowIntensity * 0.3;
        
        // Check if material has emissive property before setting it
        if (state.trainingPortalMesh.material.emissive) {
          state.trainingPortalMesh.material.emissive.set(0xFF5500);
          state.trainingPortalMesh.material.emissiveIntensity = 0.5 + glowIntensity * 0.5;
        }
      }
    }
    
    // Make training portal label face the camera
    if (state.trainingPortalLabel) {
      state.trainingPortalLabel.lookAt(camera.position);
    }
  }
  
  // Animate portal
  if (state.portalMesh) {
    state.portalMesh.rotation.y += 0.01;
    const scale = 1 + 0.1 * Math.sin(Date.now() * 0.002);
    state.portalMesh.scale.set(scale, scale, scale);
    
    // Glow effect based on proximity
    if (portalVisible) {
      const glowIntensity = 1 - (distanceToPortal / 3);
      state.portalMesh.material.opacity = 0.7 + glowIntensity * 0.3;
      
      // Check if material has emissive property before setting it
      if (state.portalMesh.material.emissive) {
        state.portalMesh.material.emissive.set(0x00BFFF);
        state.portalMesh.material.emissiveIntensity = glowIntensity;
      }
    }
    
    // Make DeadlineDemon label face the camera
    if (state.deadlineDemonLabel) {
      state.deadlineDemonLabel.lookAt(camera.position);
    }
  }
  
  // Render the scene at the end of the update
  if (renderer && state.mode === '3D') {
    renderer.render(scene, camera);
  }
  
  // Update FPS counter
  state.frameCount3D = state.frameCount3D || 0;
  state.lastFpsUpdate3D = state.lastFpsUpdate3D || performance.now();
  
  state.frameCount3D++;
  const now = performance.now();
  const elapsed = now - state.lastFpsUpdate3D;
  
  // Update FPS display every 500ms
  if (elapsed >= 500) {
    state.fps = Math.round((state.frameCount3D * 1000) / elapsed);
    
    // Update the FPS display
    const fpsElement = document.getElementById('fps');
    if (fpsElement) {
      fpsElement.textContent = state.fps;
    }
    
    // Reset counters
    state.lastFpsUpdate3D = now;
    state.frameCount3D = 0;
  }
};

// Cleanup function to be called when switching modes
export const cleanupThreeScene = (state) => {
  // Remove event listeners
  if (state.shootHandler) {
    document.removeEventListener('mousedown', state.shootHandler);
    state.shootHandler = null;
  }
  
  // Cleanup bullet manager
  if (state.bulletManager) {
    state.bulletManager.cleanup();
    state.bulletManager = null;
  }
  
  // Cleanup training challenge if active
  if (state.mode === 'TRAINING_CHALLENGE') {
    cleanupTrainingChallenge();
  }
};

export const renderThreeScene = (renderer, scene, camera) => {
  renderer.render(scene, camera);
};
