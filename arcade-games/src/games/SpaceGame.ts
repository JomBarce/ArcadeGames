import * as THREE from 'three';

import GameBase from './shared/GameBase';
import GameState from './shared/GameState';
import AssetManager from './shared/AssetManager';
import { clamp } from '../utils/math';

export default class SpaceGame extends GameBase {
    private spaceship: THREE.Object3D | null = null;
    private lasers: THREE.Object3D[] = [];
    private laserVelocities: Map<THREE.Object3D, THREE.Vector3> = new Map();
    
    private hud: HTMLDivElement;
    private scoreText: HTMLDivElement;
	private timerText: HTMLDivElement;
    private countdownTimer: HTMLDivElement;
    private gameOverScreen: HTMLDivElement;
    private finalScore: HTMLParagraphElement;
    private countdownNumber!: HTMLDivElement;

    private lastUpdateTime = 0;
    private pauseStartTime = 0;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private isUnpausing: boolean = false;

    private keys: { [key: string]: boolean } = { up: false, down: false, left: false, right: false, rollLeft: false, rollRight: false, throttle: false };
    private velocity = 0;
    private cameraOffset = new THREE.Vector3();
    private cameraOffsetY = 50;
    private cameraOffsetZ = -100;
    private cameratargetPos = new THREE.Vector3();
    private currentLookAt = new THREE.Vector3();

    private readonly MAX_SPEED = 250;
    private readonly ACCELERATION = 20;
    private readonly FRICTION = 10; 
    private readonly TURN_SPEED = 1;

    private readonly LASER_SPEED = 12;
    private readonly LASER_LIFETIME = 2500;

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

        this.addListeners();
    }

    async initialize() {
        if (!this.scene) throw new Error('Scene is not initialized');
        if (this.camera) {
            this.camera.far = 4000; 
            this.camera.updateProjectionMatrix();
        }

        this.generateMapGrid();

        // Load and create the spaceship
        this.spaceship = await this.createSpaceship();
        if (this.spaceship && this.camera) {
            this.spaceship.position.set(0, 0, 0);
            this.spaceship.rotation.y = Math.PI;
            this.scene.add(this.spaceship);
        }

        // Initial Game State
        this.countdownNumber = this.countdownTimer.querySelector(
            ".countdown-number"
        ) as HTMLDivElement;
    }

    // Create a spaceship object
    private async createSpaceship(): Promise<THREE.Object3D | null> {
        // Load spaceship material
        const spaceshipModel = await AssetManager.loadGLTF('Spaceship', './assets/Spaceship/Spaceship.glb');
       
        if (!spaceshipModel) {
            console.error("Failed to load spaceship model");
            return null;
        }

        spaceshipModel.scale.set(0.05, 0.05, 0.05);

        return spaceshipModel;
    }

    private createLaser = () => {
        if (!this.spaceship || !this.scene) return;

        // Create a simple laser beam geometry
        const laserLength = 20;
        const laserRadius = 0.5;
        const laserGeometry = new THREE.CylinderGeometry(laserRadius, laserRadius, laserLength);
        const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);

        // Rotate cylinder so it's pointing forward along Z
        laser.rotateX(Math.PI / 2); // cylinder default is along Y axis

        // Spawn position at the front of the spaceship
        const forward = new THREE.Vector3(0, 0, 1);        
        forward.applyQuaternion(this.spaceship.quaternion);
        forward.normalize();

        const spawnPosition = this.spaceship.position.clone().add(forward.clone().multiplyScalar(5)); // adjust distance from ship
        laser.position.copy(spawnPosition);

        // Rotate laser to match spaceship orientation
        laser.quaternion.multiplyQuaternions(this.spaceship.quaternion, laser.quaternion);

        // Add to scene and track it
        this.scene.add(laser);
        this.lasers.push(laser);

        // Set velocity along ship's forward direction
        const velocity = forward.multiplyScalar(this.LASER_SPEED);
        this.laserVelocities.set(laser, velocity);
    };

    private generateMapGrid() {
        const radius = 2000;
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        
        const material = new THREE.MeshBasicMaterial({
            color: 0x505050,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });

        const areaSphere = new THREE.Mesh(geometry, material);
        this.scene?.add(areaSphere);
    }

    private updateCamera() {
        if (!this.camera || !this.spaceship) return;

        this.cameraOffset.set(0, this.cameraOffsetY, this.cameraOffsetZ);
        this.cameraOffset.applyQuaternion(this.spaceship.quaternion);

        this.cameratargetPos.copy(this.spaceship.position).add(this.cameraOffset);
        this.camera.position.lerp(this.cameratargetPos, 0.2);

        const lookTarget = this.spaceship.position.clone();
        lookTarget.y += 2.5;

        this.currentLookAt.lerp(lookTarget, 0.2);

        const pitchDirection = new THREE.Vector3(0, 1, 0);
        pitchDirection.applyQuaternion(this.spaceship.quaternion);
        this.camera.up.copy(pitchDirection);

        this.camera.lookAt(this.currentLookAt);
    }

    private updateSpaceshipMovement(delta: number) {
        if (!this.spaceship) return;

        // Throttle
        if (this.keys.throttle) {
            this.velocity += this.ACCELERATION * delta;
        } else {
            if (this.velocity > 0) {
                this.velocity -= this.FRICTION * delta;
                if (this.velocity < 0) this.velocity = 0;
            } else if (this.velocity < 0) {
                this.velocity += this.FRICTION * delta;
                if (this.velocity > 0) this.velocity = 0;
            }
        }
        this.velocity = clamp(this.velocity, -this.MAX_SPEED * 0.5, this.MAX_SPEED);

        // Yaw
        if (this.keys.left) this.spaceship.rotateY(this.TURN_SPEED * delta);
        if (this.keys.right) this.spaceship.rotateY(-this.TURN_SPEED * delta);

        if (Math.abs(this.velocity) > 0.1) {
            // Roll
            if (this.keys.rollLeft) this.spaceship.rotateZ(-this.TURN_SPEED * delta);
            if (this.keys.rollRight) this.spaceship.rotateZ(this.TURN_SPEED * delta);

            // Pitch
            if (this.keys.up) this.spaceship.rotateX(this.TURN_SPEED * delta);
            if (this.keys.down) this.spaceship.rotateX(-this.TURN_SPEED * delta);
        }

        // Move Forward
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.spaceship.quaternion);
        forward.normalize();

        // Apply velocity
        this.spaceship.position.addScaledVector(forward, this.velocity * delta);
    }

    // Handle keyboard click
    private onKeyDown = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'KeyW': 
            case 'ArrowUp':    
                this.keys.up = true;
                break;
            case 'KeyS': 
            case 'ArrowDown':
                this.keys.down = true;
                break;
            case 'KeyA': 
            case 'ArrowLeft':  
                this.keys.left = true;
                break;
            case 'KeyD': 
            case 'ArrowRight': 
                this.keys.right = true;
                break;
            case 'KeyQ':   
                this.keys.rollLeft = true;
                break;
            case 'KeyE': 
                this.keys.rollRight = true;
                break;
            case 'Space':
                this.keys.throttle = true;
                break;
            case 'KeyJ':
                this.createLaser();
                break;
        }
    };

    private onKeyUp = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'KeyW': 
            case 'ArrowUp':    
                this.keys.up = false;
                break;
            case 'KeyS': 
            case 'ArrowDown':
                this.keys.down = false;
                break;
            case 'KeyA': 
            case 'ArrowLeft':  
                this.keys.left = false;
                break;
            case 'KeyD': 
            case 'ArrowRight': 
                this.keys.right = false;
                break;
            case 'KeyQ':   
                this.keys.rollLeft = false;
                break;
            case 'KeyE': 
                this.keys.rollRight = false;
                break;
            case 'Space':
                this.keys.throttle = false;
                break;
        }
    };

    override addListeners() {
        super.addListeners();

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    private removeListeners() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    private startCountdown(onComplete: () => void) {
        if (this.countdownInterval !== null) return;
        
        let countdown = GameState.countdownTime;

        this.countdownTimer.classList.remove('hidden');

        this.countdownNumber.textContent = countdown.toString();
        this.countdownNumber.classList.remove("pop");
        void this.countdownNumber.offsetWidth;
        this.countdownNumber.classList.add("pop");

        this.countdownInterval = setInterval(() => {
            countdown--;

            this.countdownNumber.textContent = countdown.toString();
            this.countdownNumber.classList.remove("pop");
            void this.countdownNumber.offsetWidth;
            this.countdownNumber.classList.add("pop");

            if (countdown <= 0) {
                clearInterval(this.countdownInterval!);
                this.countdownInterval = null;
                this.countdownTimer.classList.add('hidden');

                onComplete();
            }
        }, 1000);
    }

    override start() {
        // this.startCountdown(() => {
        //     super.start();
        //     this.lastUpdateTime = this.clock.getElapsedTime();
        // });
        super.start();
        this.lastUpdateTime = this.clock.getElapsedTime();
    }

    override reset() {
        super.reset();

        this.hud.style.display = 'block';

        GameState.reset();
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
        if (this.countdownInterval !== null || this.isUnpausing) return;

        this.isUnpausing = true;

        this.startCountdown(() => {
            const now = this.clock.getElapsedTime();
            const pauseDuration = now - this.pauseStartTime;
            this.lastUpdateTime += pauseDuration;

            this.isUnpausing = false;

            super.unpause();
            this.addListeners();
        });
    }

    override endGame() {
		super.endGame();

		GameState.saveHighScore("spaceship");

		this.hud.style.display = 'none';
		this.finalScore.innerHTML = `
			Your score: ${GameState.score}<br>
			High score: ${GameState.getHighScore("spaceship")}
		`;
		this.gameOverScreen.classList.remove('hidden');

        GameState.reset();
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

        GameState.time = Math.max(0, GameState.time - delta);

        if (this.spaceship) {
            // this.spaceship.rotation.y += 0.01;
            this.updateSpaceshipMovement(delta*2);
            this.updateCamera();
        }

        // Update lasers
        this.lasers.forEach((laser) => {
            const velocity = this.laserVelocities.get(laser);
            if (!velocity) return;
            
            laser.position.add(velocity);

            if (laser.position.length() > this.LASER_LIFETIME) {
                this.scene?.remove(laser);
                this.lasers = this.lasers.filter(b => b !== laser);
                this.laserVelocities.delete(laser);
            }
        });

        // if (GameState.time <= 0) {
        //     this.endGame();
        //     return;
        // }

        if (!this.isUnpausing) {
            this.updateHUD();
        }
    }

    override async cleanup() {
        if (!this.camera || !this.scene) return;

        this.removeListeners();

        await super.cleanup();
    }
}