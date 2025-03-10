// A shared game state object that can be imported by any module.
// (In a more complex app you might use Redux or React context for reactivity.)
const gameState = {
    mode: '3D', // '3D', '2D', 'TASK_GAME', '2D_TRAINING', or '2D_TASK_ARENA'
    previousMode: null, // To track previous mode when transitioning
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
    velocity: { x: 0, y: 0 },
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
    shootCooldown: 300, // milliseconds
    taskGamePosition: { x: window.innerWidth / 2, y: 200 },
    playerFacingDirection: 1,
    isPaused: false,
    currentTaskChallenge: undefined, // Index of the current task being challenged
    
    // Graphics quality settings
    graphicsQuality: 'low', // 'low', 'medium', 'high'
    
    // Function to change graphics quality
    setGraphicsQuality: function(quality) {
        if (['low', 'medium', 'high'].includes(quality)) {
            this.graphicsQuality = quality;
            // Save to localStorage for persistence
            try {
                localStorage.setItem('graphicsQuality', quality);
            } catch (e) {
                console.warn('Could not save graphics quality to localStorage:', e);
            }
            return true;
        }
        return false;
    },
    
    // Function to load saved graphics quality
    loadGraphicsQuality: function() {
        try {
            const savedQuality = localStorage.getItem('graphicsQuality');
            if (savedQuality && ['low', 'medium', 'high'].includes(savedQuality)) {
                this.graphicsQuality = savedQuality;
            }
        } catch (e) {
            console.warn('Could not load graphics quality from localStorage:', e);
        }
    },
    
    // Function to set the game mode
    setMode: function(newMode) {
        console.log(`Setting game mode from ${this.mode} to ${newMode}`);
        
        // Store reference to previous mode
        this.previousMode = this.mode;
        
        // Set the new mode
        this.mode = newMode;
        
        // Let's add a mode change timestamp for debugging
        this.lastModeChangeTime = Date.now();
        this.lastModeChangeFrom = this.previousMode;
        this.lastModeChangeTo = newMode;
        
        // Reset animation frame tracking to prevent stale animation frames
        this.resetAnimationRequested = true;
        
        // Make sure FPS display continues across mode changes
        if (newMode === '3D') {
            // Update the FPS tracking for 3D mode
            this.lastFpsUpdate3D = performance.now();
            this.frameCount3D = 0;
        } else {
            // Make sure 2D FPS tracking is initialized
            this.lastFpsUpdate = this.lastFpsUpdate || performance.now();
            this.frameCount = this.frameCount || 0;
        }
        
        console.log(`Mode set to ${this.mode}, animation reset requested`);
    }
};

// Load saved graphics quality on initialization
gameState.loadGraphicsQuality();

export default gameState;
  