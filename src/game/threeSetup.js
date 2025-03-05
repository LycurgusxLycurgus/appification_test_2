import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

// BulletManager class to handle all bullet-related operations
class BulletManager {
  constructor(scene) {
    this.scene = scene;
    this.bullets = [];
    this.raycaster = new THREE.Raycaster();
    this.active = true;
  }

  createBullet(camera) {
    if (!this.active) return;

    // Create bullet geometry and material
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
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
      maxDistance: 100,
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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.7, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

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
  addFloor(scene);
  addWalls(scene);
  addPortal(scene, state);
  addTargets(scene);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Create bullet manager
  state.bulletManager = new BulletManager(scene);
  
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

  return { scene, camera, renderer, controls };
};

const addFloor = (scene) => {
  const floorGeometry = new THREE.PlaneGeometry(50, 50);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555,
    side: THREE.DoubleSide,
    roughness: 0.8
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);
};

const addWalls = (scene) => {
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 1), wallMaterial);
  northWall.position.set(0, 2, -25);
  scene.add(northWall);
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 1), wallMaterial);
  southWall.position.set(0, 2, 25);
  scene.add(southWall);
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 50), wallMaterial);
  eastWall.position.set(25, 2, 0);
  scene.add(eastWall);
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 50), wallMaterial);
  westWall.position.set(-25, 2, 0);
  scene.add(westWall);
};

const addPortal = (scene, state) => {
  const portalGeometry = new THREE.SphereGeometry(0.5, 32, 32);
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
};

const addTargets = (scene) => {
  const targetGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const targetMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
  for (let i = 0; i < 5; i++) {
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.position.set(Math.random() * 40 - 20, 1 + Math.random() * 2, Math.random() * 40 - 20);
    target.userData = { isTarget: true, id: 'target-3d-' + i };
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

export const updateThreeScene = (deltaTime, scene, camera, controls, state, setMode) => {
  // Skip updates if game is paused
  if (state.isPaused) return;
  
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
};

export const renderThreeScene = (renderer, scene, camera) => {
  renderer.render(scene, camera);
};
