 // A shared game state object that can be imported by any module.
// (In a more complex app you might use Redux or React context for reactivity.)
const gameState = {
    mode: '3D', // '3D' or '2D' or 'TASK_GAME'
    tasks: [],
    lastTime: 0,
    fps: 0,
    frameCount: 0,
    lastFpsUpdate: 0,
    keys: {},
    shooting: false,
    mousePosition: { x: 0, y: 0 },
    playerPosition: { x: 100, y: 400 }, // 2D player position
    player3D: { x: 0, y: 1.6, z: 0 }, // 3D player position
    velocity: { x: 0, y: 0, z: 0 },
    portalPosition: { x: 5, y: 1, z: -5 },
    targets: [],
    bullets: [],
    gravity: 0.5,
    isJumping: false,
    platforms: [],
    enemies: [],
    score: 0,
    health: 100,
    gameApps: [],
    currentApp: null,
    taskTokens: 0,
    taskBoxes: [],
    lastShootTime: 0,
    shootCooldown: 250,
    taskGamePosition: { x: window.innerWidth / 2, y: 200 },
    playerFacingDirection: 1,
    isPaused: false
  };
  
  export default gameState;
  