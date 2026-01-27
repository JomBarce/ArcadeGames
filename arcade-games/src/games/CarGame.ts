import * as THREE from 'three';

import GameBase from './shared/GameBase';
import GameState from './shared/GameState';
import AssetManager from './shared/AssetManager';

export default class CarGame extends GameBase {
    private car: THREE.Object3D | null = null;
    // private enemies: THREE.Object3D[] = [];
    // private enemiesPositionsMap: Map<THREE.Object3D, THREE.Vector3> = new Map();
    
    private hud: HTMLDivElement;
    private scoreText: HTMLDivElement;
	private timerText: HTMLDivElement;
    private countdownTimer: HTMLDivElement;
    private gameOverScreen: HTMLDivElement;
    private finalScore: HTMLParagraphElement;

    private lastUpdateTime = 0;
    private timeRemaining = 10;            // change time to distance and every car dodge can add score
    private pauseStartTime = 0;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private isUnpausing: boolean = false;

    private keys: { [key: string]: boolean } = { forward: false, backward: false, left: false, right: false };
    
    // private readonly ENEMY_LIFETIME = 20;
    // private readonly ENEMY_RESPAWN_DELAY = 2000;

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

        this.camera?.position.set(5, 5, 10);
        this.camera?.lookAt(0, 0, 0);

        // Load and create the car
        this.car = await this.createCar();
        if (this.car && this.camera) {
            this.car.position.set(0, 0, 0);
            this.car.rotation.y = Math.PI;
            this.scene.add(this.car);
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

        if (this.car) {
            this.car.rotation.y += 0.01;
        }

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