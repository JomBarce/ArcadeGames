import * as THREE from 'three';

import GameBase from './shared/GameBase';
import GameState from './shared/GameState';
import AssetManager from './shared/AssetManager';
import { clamp } from '../utils/math';

export default class CarGame extends GameBase {
    private car: THREE.Object3D | null = null;
    // private enemies: THREE.Object3D[] = [];
    // private enemiesPositionsMap: Map<THREE.Object3D, THREE.Vector3> = new Map();
    private wheels: {
        fl: THREE.Object3D | null;
        fr: THREE.Object3D | null;
        rl: THREE.Object3D | null;
        rr: THREE.Object3D | null;
    } = { fl: null, fr: null, rl: null, rr: null };
    private frontWheelPivots: {
        fl: THREE.Object3D | null;
        fr: THREE.Object3D | null;
    } = { fl: null, fr: null };
    
    private hud: HTMLDivElement;
    private scoreText: HTMLDivElement;
	private timerText: HTMLDivElement;
    private countdownTimer: HTMLDivElement;
    private gameOverScreen: HTMLDivElement;
    private finalScore: HTMLParagraphElement;

    private lastUpdateTime = 0;
    private pauseStartTime = 0;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private isUnpausing: boolean = false;

    private keys: { [key: string]: boolean } = { forward: false, backward: false, left: false, right: false };
    private velocity = 0;
    private cameraOffsetZ = -5;

    private readonly MAX_SPEED = 100;
    private readonly ACCELERATION = 20;
    private readonly BRAKE_FORCE = 30;
    private readonly FRICTION = 10; 
    private readonly TURN_SPEED = 3;
    private readonly WHEEL_RADIUS = 0.03 / 2;
    private readonly MAX_STEER_ANGLE = Math.PI / 6;
    // private readonly ENEMY_LIFETIME = 20;
    // private readonly ENEMY_RESPAWN_DELAY = 2000;

    private readonly TILE_SIZE = 10;
    private readonly GRID_SIZE = 100;


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
        // this.onMouseMove = this.onMouseMove.bind(this);
        // this.onMouseDown = this.onMouseDown.bind(this);

        this.addListeners();
    }

    async initialize() {
        if (!this.scene) throw new Error('Scene is not initialized');

        this.generateMapGrid();

        // Load and create the car
        this.car = await this.createCar();
        if (this.car && this.camera) {
            this.car.position.set(0, 0, 0);
            this.car.rotation.y = Math.PI;
            this.scene.add(this.car);

            this.setupWheels();
            this.setupFrontWheelPivots();
        }

        // Initial Game State
        GameState.score = 0;
		GameState.time = 60;
    }

    // Create a car object
    private async createCar(): Promise<THREE.Object3D | null> {
        // Load car material
        const carModel = await AssetManager.loadGLTF('Car', './assets/Car/Car.glb');
       
        if (!carModel) {
            console.error("Failed to load car model");
            return null;
        }

        return carModel;
    }

    private generateMapGrid() {

        const groundGeometry = new THREE.PlaneGeometry(
            this.TILE_SIZE,
            this.TILE_SIZE
        );

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            wireframe: true
        });

        const offset = (this.GRID_SIZE * this.TILE_SIZE) / 2;

        for (let x = 0; x < this.GRID_SIZE; x++) {
            for (let z = 0; z < this.GRID_SIZE; z++) {

                const tile = new THREE.Mesh(groundGeometry, groundMaterial);

                tile.rotation.x = -Math.PI / 2;
                tile.position.set(x * this.TILE_SIZE - offset, 0, z * this.TILE_SIZE - offset);

                this.scene?.add(tile);
            }
        }
    }

    private updateCamera() {
        if (!this.camera || !this.car) return;

        const offset = new THREE.Vector3(0, 5, this.cameraOffsetZ);
        offset.applyQuaternion(this.car.quaternion);

        this.camera.position.copy(this.car.position).add(offset);

        const lookTarget = this.car.position.clone();
        lookTarget.y += 2.5;

        this.camera.lookAt(lookTarget);
    }

    private setupWheels() {
        if (!this.car || !this.wheels) return;

        this.wheels.fl = this.car.getObjectByName('FL_WHEEL') ?? null;
        this.wheels.fr = this.car.getObjectByName('FR_WHEEL') ?? null;
        this.wheels.rl = this.car.getObjectByName('RL_WHEEL') ?? null;
        this.wheels.rr = this.car.getObjectByName('RR_WHEEL') ?? null;
    }

    private setupFrontWheelPivots() {
        const createPivot = (wheel: THREE.Object3D | null): THREE.Object3D | null => {
            if (!wheel || !wheel.parent) return null;

            const pivot = new THREE.Object3D();
            wheel.parent.add(pivot);
            pivot.position.copy(wheel.position);
            pivot.add(wheel);
            wheel.position.set(0, 0, 0);
            return pivot;
        };

        this.frontWheelPivots.fl = createPivot(this.wheels.fl);
        this.frontWheelPivots.fr = createPivot(this.wheels.fr);
    }

    private updateCarMovement(delta: number) {
        if (!this.car) return;

        // Acceleration & braking
        if (this.keys.forward) {
            this.velocity += this.ACCELERATION * delta;
        } else if (this.keys.backward) {
            this.velocity -= this.BRAKE_FORCE * delta;
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

        // Steering
        if (Math.abs(this.velocity) > 0.1) {
            const speedFactor = Math.min( Math.abs(this.velocity) / this.MAX_SPEED, 1 );

            // Reverse steering when backing up
            const steeringDirection = this.velocity > 0 ? 1 : -1;

            if (this.keys.left) {
                this.car.rotation.y += this.TURN_SPEED * speedFactor * delta * steeringDirection;
            }

            if (this.keys.right) {
                this.car.rotation.y -= this.TURN_SPEED * speedFactor * delta * steeringDirection;
            }
        }

        // Accelerate
        this.car.translateZ(this.velocity * delta);

        // Steering Animation
        let steer = 0;
        if (this.keys.left) steer = 1;
        if (this.keys.right) steer = -1;
        const steerAngle = steer * this.MAX_STEER_ANGLE;

        if (this.frontWheelPivots.fl) this.frontWheelPivots.fl.rotation.y = steerAngle;
        if (this.frontWheelPivots.fr) this.frontWheelPivots.fr.rotation.y = steerAngle;

        // Wheel Animation
        const rollAngle = (this.velocity * delta) / this.WHEEL_RADIUS;
        [this.wheels.fl, this.wheels.fr, this.wheels.rl, this.wheels.rr].forEach(wheel => {
            if (wheel) wheel.rotation.x -= rollAngle;
        });
    }    

    // Handle keyboard click
    private onKeyDown = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'KeyW': 
            case 'ArrowUp':    
                this.keys.forward = true;
                break;
            case 'KeyS': 
            case 'ArrowDown':
                this.keys.backward = true;
                break;
            case 'KeyA': 
            case 'ArrowLeft':  
                this.keys.left = true;
                break;
            case 'KeyD': 
            case 'ArrowRight': 
                this.keys.right = true;
                break;

            case 'Space':
                this.cameraOffsetZ = 5;
                break;
        }
    };

    private onKeyUp = (event: KeyboardEvent) => {
        switch (event.code) {
            case 'KeyW': 
            case 'ArrowUp':    
                this.keys.forward = false;
                break;
            case 'KeyS': 
            case 'ArrowDown':
                this.keys.backward = false;
                break;
            case 'KeyA': 
            case 'ArrowLeft':  
                this.keys.left = false;
                break;
            case 'KeyD': 
            case 'ArrowRight': 
                this.keys.right = false;
                break;

            case 'Space':
                this.cameraOffsetZ = -5;
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

    override start() {
        // let countdown = GameState.countdownTime;
    
        // this.countdownTimer.classList.remove('hidden');
        // this.countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

        // if (this.countdownInterval !== null) return;

        // this.countdownInterval = setInterval(() => {
        //     countdown--;
        //     this.countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

        //     if (countdown <= 0) {
        //         clearInterval(this.countdownInterval!);
        //         this.countdownInterval = null;
        //         this.countdownTimer.classList.add('hidden');
        //         super.start();
        //         this.lastUpdateTime = this.clock.getElapsedTime();
        //     }
        // }, 1000);
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

        // this.timeRemaining = Math.max(0, this.timeRemaining - delta);
        // GameState.time = this.timeRemaining;

        if (this.car) {
            // this.car.rotation.y += 0.01;
            this.updateCarMovement(delta);
            this.updateCamera();
        }

        // if (this.timeRemaining <= 0) {
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