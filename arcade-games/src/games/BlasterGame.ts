import * as THREE from 'three';

import GameBase from './shared/GameBase';
import GameState from './shared/GameState';
import AssetManager from './shared/AssetManager';
import { clamp } from '../utils/math';

export default class BlasterGame extends GameBase {
    private targets: THREE.Object3D[] = [];
    private targetPositionsMap: Map<THREE.Object3D, THREE.Vector3> = new Map();
    private blaster: THREE.Object3D | null = null;
    private bullets: THREE.Object3D[] = [];

    private directionVector = new THREE.Vector3();
    private bulletVelocities: Map<THREE.Object3D, THREE.Vector3> = new Map();
    
    private hud: HTMLDivElement;
    private scoreText: HTMLDivElement;
	private timerText: HTMLDivElement;
    private countdownTimer: HTMLDivElement;
    private gameOverScreen: HTMLDivElement;
    private finalScore: HTMLParagraphElement;

    private lastUpdateTime = 0;
    private timeRemaining = 60;
    private pauseStartTime = 0;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private isUnpausing: boolean = false;

    private readonly BULLET_SPEED = 0.1;
    private readonly BULLET_LIFETIME = 20;
    private readonly TARGET_RESPAWN_DELAY = 2000;

    constructor(
        canvas: HTMLCanvasElement,
        hud: HTMLDivElement,
		scoreText: HTMLDivElement,
		timerText: HTMLDivElement,
        countdownTimer: HTMLDivElement,
		gameOverScreen: HTMLDivElement,
        finalScore: HTMLParagraphElement
    ) {
        super(canvas);

        this.scoreText = scoreText;
		this.timerText = timerText;
		this.finalScore = finalScore;
		this.hud = hud;
		this.gameOverScreen = gameOverScreen;
        this.countdownTimer = countdownTimer;

        // Event handler bindings
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);

        this.addListeners();
    }

    async initialize() {
        if (!this.scene) throw new Error('Scene is not initialized');

        // Load and position targets with random positions
        await AssetManager.loadOBJ('Target', './assets/Blaster/Target.obj', './assets/Blaster/Target.mtl');
        const targets = await Promise.all(Array.from({ length: 10 }).map(async () => {
            const target = await this.createTarget();

            if (!target) return null;

            // Randomize target position
            target.position.set(
                Math.random() * 4 - 2,  // -2 to 2
                Math.random() * 4 - 2,  // -2 to 2
                Math.random() * 7 - 11  // -2 to -10
            );

            this.targets.push(target);
            this.targetPositionsMap.set(target, target.position.clone());

            return target;
        }));

        // Filter and Add the targets to the scene
        const validTargets = targets.filter(Boolean) as THREE.Object3D[];
        this.scene.add(...validTargets);

        // Load and create the blaster
        this.blaster = await this.createBlaster();
        if (this.blaster && this.camera) {
            this.blaster.position.set(0, 0, 0); // Blaster Position
            this.scene.add(this.blaster);
            // Attach the camera to the blaster
            this.blaster.add(this.camera);
            this.camera.position.set(0, 0.4, 1); // Camera Position
        }

        // Load bullet
        await AssetManager.loadOBJ('Bullet', './assets/Blaster/Bullet.obj', './assets/Blaster/Bullet.mtl');

        // Initial Game State
        GameState.score = 0;
		GameState.time = 60;
    }


    private async createTarget(): Promise<THREE.Object3D | null> {
        const targetModel = AssetManager.getModel('Target');
        if (!targetModel) {
            console.error("Failed to load target model");
            return null;
        }

        const targetClone = targetModel.clone(true);

        // Modify the target model
        targetClone.rotateY(Math.PI * 0.5);
        targetClone.scale.set(2, 2, 2);

        return targetClone;
    }

    // Create a blaster object
    private async createBlaster(): Promise<THREE.Object3D | null> {
        // Load blaster material
        const blasterModel = await AssetManager.loadOBJ('Blaster', './assets/Blaster/Blaster.obj', './assets/Blaster/Blaster.mtl');
       
        if (!blasterModel) {
            console.error("Failed to load blaster model");
            return null;
        }

        return blasterModel;
    }

    // Create a bullet object
    private createBullet = () => {
        if (!this.blaster || !this.camera || !this.scene) return;

        // Retrieve the cached bullet model
        const bulletModel = AssetManager.getModel('Bullet');
        if (!bulletModel) {
            console.error("Failed to load bullet model");
            return;
        }

        // Clone the model for an independent bullet instance
        const bulletClone = bulletModel.clone(true);

        // Scale the bullet
        bulletClone.scale.set(2, 2, 2);

        // Get the camera direction
        this.camera.getWorldDirection(this.directionVector);
        this.directionVector.normalize();

        // Bullet spawn position
        const aabb = new THREE.Box3().setFromObject(this.blaster);
        const size = aabb.getSize(new THREE.Vector3());
        const spawnPosition = this.blaster.position.clone();
        spawnPosition.add(this.directionVector.clone().multiplyScalar(size.z * 0.1));
        spawnPosition.y += 0.08;

        bulletClone.position.copy(spawnPosition);

        // Rotate bullet children to align with the firing direction
        bulletClone.children.forEach(child => child.rotateX(Math.PI * -0.5));
        bulletClone.rotation.copy(this.blaster.rotation);

        // Add bullet to the scene and bullets array
        this.scene.add(bulletClone);
        this.bullets.push(bulletClone);

        // Set bullet velocity
        const velocity = this.directionVector.clone().multiplyScalar(this.BULLET_SPEED);
        this.bulletVelocities.set(bulletClone, velocity);
    };

    // Check if bullet and target collides
    private checkCollisions(bullet: THREE.Object3D): boolean {
        // Bullet bounding box
        const bulletBox = new THREE.Box3().setFromObject(bullet);
        // Check each target for collision with the bullet
        for (let target of this.targets) {
            const targetBox = new THREE.Box3().setFromObject(target);
            // If collision is detected
            if (bulletBox.intersectsBox(targetBox)) {
                this.handleTargetHit(target, bullet);
                return true;
            }
        }
        return false;
    }

    // Handle a target hit
    private handleTargetHit(target: THREE.Object3D, bullet: THREE.Object3D) {
        // Remove the target
        this.scene?.remove(target);
        this.targets = this.targets.filter(t => t !== target);
        // Remove the bullet
        this.scene?.remove(bullet);
        this.bullets = this.bullets.filter(b => b !== bullet);
        
        // Notify score change
        GameState.score += 100;
		this.updateHUD();
        
        // Respawn the target 
        setTimeout(() => {
            target.position.set(
                Math.random() * 4 - 2,  // -2 to 2
                Math.random() * 4 - 2,  // -2 to 2
                Math.random() * 7 - 11  // -2 to -10
            );

            this.scene?.add(target);
            this.targets.push(target);
        }, this.TARGET_RESPAWN_DELAY);
    }

    // Handle mouse movement
    private onMouseMove = (event: MouseEvent) => {
        if (this.blaster) {
            // console.log('Moving blaster', event.clientX, event.clientY);
            // Normalize mouse coordinates
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

            // Max tilt for the blaster
            const maxTilt = Math.PI / 3;

            // Update blaster rotation based on mouse movement
            this.blaster.rotation.y = -mouseX * maxTilt;
            this.blaster.rotation.x = mouseY * maxTilt;
        }
    }

    // Handle mouse click
    private onMouseDown = (event: MouseEvent) => {
        if (event.button === 0) this.createBullet();
    };

    override addListeners() {
        super.addListeners();
        // Add mouse event listeners
        window.addEventListener('mousemove', this.onMouseMove, false);
        window.addEventListener('mousedown', this.onMouseDown, false);
    }

    private removeListeners() {
        this.onMouseMove && window.removeEventListener('mousemove', this.onMouseMove, false);
        this.onMouseDown && window.removeEventListener('mousedown', this.onMouseDown, false);
    }

    override start() {
        let countdown = GameState.countdownTime;
    
        this.countdownTimer.classList.remove('hidden');
        this.countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

        if (this.countdownInterval !== null) return;

        this.countdownInterval = setInterval(() => {
            countdown--;
            this.countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

            if (countdown <= 0) {
                clearInterval(this.countdownInterval!);
                this.countdownInterval = null;
                this.countdownTimer.classList.add('hidden');
                super.start();
                this.lastUpdateTime = this.clock.getElapsedTime();
            }
        }, 1000);
	}

    override reset() {
		super.reset();

        this.hud.style.display = 'block';

        this.bullets.forEach(bullet => this.scene?.remove(bullet));
        this.bullets = [];
        this.bulletVelocities.clear();

        GameState.reset();
        this.timeRemaining = GameState.time;
        this.lastUpdateTime = this.clock.getElapsedTime();

        this.addListeners();
        this.updateHUD()
	}

    override pause() {
		super.pause();

        this.pauseStartTime = this.clock.getElapsedTime();
        
        this.removeListeners();
	}

    override unpause() {
        let countdown = GameState.countdownTime;
    
        this.countdownTimer.classList.remove('hidden');
        this.countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

        if (this.countdownInterval !== null || this.isUnpausing) return;

        this.isUnpausing = true;

        this.countdownInterval = setInterval(() => {
            countdown--;
            this.countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

            if (countdown <= 0) {
                clearInterval(this.countdownInterval!);
                this.countdownInterval = null;
                this.countdownTimer.classList.add('hidden');
                
                const now = this.clock.getElapsedTime();
                const pauseDuration = now - this.pauseStartTime;
                this.lastUpdateTime += pauseDuration;
                this.isUnpausing = false;

                super.unpause();
                this.addListeners();
            }
        }, 1000);
    }

    override endGame() {
		super.endGame();

		GameState.saveHighScore("blaster");

		this.hud.style.display = 'none';
		this.finalScore.innerHTML = `
			Your score: ${GameState.score}<br>
			High score: ${GameState.getHighScore("blaster")}
		`;
		this.gameOverScreen.classList.remove('hidden');
	}

    private updateHUD() {
        this.scoreText.textContent = `Score: ${GameState.score}`;
        this.timerText.textContent = `Time: ${GameState.time.toFixed(1)}s`;
    }

    override update() {
        if (this.isGamePaused || this.isGameOver || this.isUnpausing) return;

        const now = this.clock.getElapsedTime();
        const delta = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        this.timeRemaining = Math.max(0, this.timeRemaining - delta);
        GameState.time = this.timeRemaining;

        if (this.timeRemaining <= 0) {
            this.endGame();
            return;
        }

        // Update bullets
        this.bullets.forEach((bullet) => {
            const velocity = this.bulletVelocities.get(bullet);
            if (!velocity) return;

            bullet.position.add(velocity);

            const hit = this.checkCollisions(bullet);

            if (bullet.position.length() > this.BULLET_LIFETIME || hit) {
                this.scene?.remove(bullet);
                this.bullets = this.bullets.filter(b => b !== bullet);
                this.bulletVelocities.delete(bullet);

                if (!hit && !this.isGameOver && !this.isGamePaused) {
                    GameState.score = clamp(GameState.score - 10, 0, Infinity);
                    this.updateHUD();
                }
            }
        });

        if (!this.isUnpausing) {
            this.updateHUD();
        }
    }

    override async cleanup() {
        if (!this.blaster || !this.camera || !this.scene) return;

        // Remove all targets
        this.targets.forEach(target => this.scene?.remove(target));
        this.targets = [];
        this.targetPositionsMap.clear();

        // Remove all bullets
        this.bullets.forEach(bullet => this.scene?.remove(bullet));
        this.bullets = [];

        // Remove blaster and detach camera
        if (this.blaster) {
            if (this.camera.parent === this.blaster) {
                this.blaster.remove(this.camera);
            }
            this.scene.remove(this.blaster);
            this.blaster = null;
        }

        this.removeListeners();

        await super.cleanup();
    }
}