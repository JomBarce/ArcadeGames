import * as THREE from 'three';

import GameBase from './shared/GameBase';
import GameState from './shared/GameState';
import AssetManager from './shared/AssetManager';

export default class SpaceGame extends GameBase {
    private spaceship: THREE.Object3D | null = null;
    
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

        this.camera?.position.set(100, 100, 750);
        this.camera?.lookAt(0, 0, 0);

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

        return spaceshipModel;
    }


    override addListeners() {
        super.addListeners();
    }

    private removeListeners() {

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
        this.startCountdown(() => {
            super.start();
            this.lastUpdateTime = this.clock.getElapsedTime();
        });
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
            this.spaceship.rotation.y += 0.01;
        }

        if (GameState.time <= 0) {
            this.endGame();
            return;
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