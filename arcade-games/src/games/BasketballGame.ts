import * as THREE from 'three';

import GameBase from './shared/GameBase';
import GameState from './shared/GameState';
import AssetManager from './shared/AssetManager';
import { GRAVITY  } from '../utils/math';

export default class BasketballGame extends GameBase {
    private basketball: THREE.Object3D | null = null;
    private currentBall: THREE.Object3D | null = null;
    private ballVelocity: THREE.Vector3 = new THREE.Vector3();
    private hoop: THREE.Object3D | null = null;
    private hoopScoringBox: THREE.Box3 | null = null;
    private hoopRim: THREE.Mesh | null = null;

    private isDragging: boolean = false;
    private dragStart: { x: number; y: number; time: number } | null = null;
    private dragEnd: { x: number; y: number; time: number } | null = null;
    private ballInMotion: boolean = false;
    private ballSpinSpeed: number = 0;
    private hasScoredThisShot: boolean = false;

    private hud: HTMLDivElement;
    private scoreText: HTMLDivElement;
	private timerText: HTMLDivElement;
    private countdownTimer: HTMLDivElement;
    private gameOverScreen: HTMLDivElement;
    private finalScore: HTMLParagraphElement;

    private lastUpdateTime = 0;
    private timeRemaining = 600;
    private pauseStartTime = 0;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private isUnpausing: boolean = false;

    private readonly BALL_SPEED = 0.0025;
    private readonly BALL_ARC = 1.1;
    private readonly BALL_LIFETIME = -10;
    private readonly RIM_RADIUS = 0.99;

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
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);

        this.addListeners();
    }

    async initialize() {
        if (!this.scene) throw new Error('Scene is not initialized');

        this.camera?.position.set(0, 0, 10);

        // Load BasketBall Models
        this.basketball = await AssetManager.loadGLTF('BasketBall', './assets/Basketball/Basketball.glb');
        if (this.basketball && this.camera) {
            this.scene.add(this.basketball);

            // Ball
            const ball = this.basketball.getObjectByName('ball');
            if (ball) {
                this.currentBall = ball;
                this.resetBall();
            }
            
            // Hoop
            const hoop = this.basketball.getObjectByName('hoop');
            if (hoop) {
                hoop.position.set(0, 1.5, 0);
                this.hoop = hoop;
            }

            if (this.hoop) {
                // Compute a box that tightly encloses the hoop’s “inner” region
                this.hoop.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(this.hoop);
                // You may want to shrink it slightly so the ball must go well inside:
                const shrink = 0.7;
                box.min.add(new THREE.Vector3(shrink, shrink, shrink));
                box.max.sub(new THREE.Vector3(shrink, 0.3, shrink));
                this.hoopScoringBox = box;

                const hoopScoringBoxHelper = new THREE.Box3Helper(this.hoopScoringBox, 0x00ff00);
                this.scene.add(hoopScoringBoxHelper);

                const rimThickness = 0.02;

                // Create a thin torus (ring) mesh as a collider (invisible)
                const rimCollider = new THREE.Mesh(
                    new THREE.TorusGeometry(this.RIM_RADIUS, rimThickness, 16, 100),
                    // new THREE.MeshBasicMaterial({ visible: false })
                    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
                );

                // Position and rotation should match the hoop mesh
                rimCollider.position.copy(this.hoop.position);
                rimCollider.quaternion.copy(this.hoop.quaternion);

                this.scene.add(rimCollider);
                this.hoopRim = rimCollider;
            }
        }

        // Initial Game State
        GameState.score = 0;
        GameState.time = 60;
    }

   private resetBall = () => {
        if (!this.currentBall || !this.camera) return;

        // Position in front of camera
        const offset = new THREE.Vector3(0, -0.5, -2);
        offset.applyQuaternion(this.camera.quaternion);
        this.currentBall.position.copy(this.camera.position).add(offset);

        this.ballVelocity.set(0, 0, 0);
        this.ballInMotion = false;
        this.ballSpinSpeed = 0;
    };

    private onScore() {
        GameState.score += 100;
        this.updateHUD();

        // e.g. play sound, particle effects
        console.log('Scored! New score:', GameState.score);
    }

    // Handle mouse click
    private onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;

        if (!this.currentBall) return;

        this.isDragging = true;
        this.dragStart = {
            x: event.clientX,
            y: event.clientY,
            time: performance.now()
        };
    };

    private onMouseUp = (event: MouseEvent) => {
        if (!this.isDragging || !this.dragStart || !this.currentBall || !this.camera || this.ballInMotion) return;

        this.isDragging = false;
        this.hasScoredThisShot = false;

        this.dragEnd = {
            x: event.clientX,
            y: event.clientY,
            time: performance.now()
        };

        const dx = this.dragEnd.x - this.dragStart.x;
        const dy = this.dragStart.y - this.dragEnd.y; // Y reversed (screen space)
        const dt = (this.dragEnd.time - this.dragStart.time) / 1000;

        const speed = Math.sqrt(dx * dx + dy * dy) / dt;

        // 1. Normalize the drag direction (screen space)
        const screenDir = new THREE.Vector2(dx, dy).normalize();

        // 2. Convert to world direction relative to camera
        const flickDirection = new THREE.Vector3(screenDir.x, screenDir.y + this.BALL_ARC, -1).normalize();

        // 3. Rotate direction based on camera orientation
        flickDirection.applyQuaternion(this.camera.quaternion);

        // 4. Apply a scalar multiplier to get actual velocity
        const velocity = flickDirection.multiplyScalar(speed * this.BALL_SPEED);

        // 5. Assign velocity to the ball
        this.ballVelocity.copy(velocity);
        this.ballInMotion = true;

        this.ballSpinSpeed = 1 - Math.min(5, speed * 0.02);
        this.ballVelocity.copy(velocity);
        this.ballInMotion = true;

        this.dragStart = null;
        this.dragEnd = null;
    };

    override addListeners() {
        super.addListeners();
        // Add mouse event listeners
        window.addEventListener('mouseup', this.onMouseUp, false);
        window.addEventListener('mousedown', this.onMouseDown, false);
    }

    private removeListeners() {
        this.onMouseUp && window.removeEventListener('mouseup', this.onMouseUp, false);
        this.onMouseDown && window.removeEventListener('mousedown', this.onMouseDown, false);
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

        GameState.saveHighScore("basketball");

        this.hud.style.display = 'none';
        this.finalScore.innerHTML = `
            Your score: ${GameState.score}<br>
            High score: ${GameState.getHighScore("basketball")}
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

        // Ball physics
        if (this.currentBall && this.ballInMotion) {
            // Apply gravity
            this.ballVelocity.y -= GRAVITY * delta;

            // Update position
            this.currentBall.position.addScaledVector(this.ballVelocity, delta);

            // / Apply backspin rotation (around local X-axis)
            this.currentBall.rotateX(this.ballSpinSpeed * delta);

            // Reset if ball falls below floor
            if (this.currentBall.position.y < this.BALL_LIFETIME) {
                this.resetBall();
            }
        }

        if (this.hoopScoringBox && !this.hasScoredThisShot && this.currentBall) {
            // Get the ball's world position
            const ballPos = this.currentBall.position.clone();

            // Check if ball is inside the scoring box
            if (this.hoopScoringBox.containsPoint(ballPos)) {
                this.onScore();
                this.hasScoredThisShot = true;
            }
        }

        if (this.currentBall && this.ballInMotion && this.hoopRim) {
            const ballPos = this.currentBall.position;
            const rimPos = this.hoopRim.position;

            const dx = ballPos.x - rimPos.x;
            const dz = ballPos.z - rimPos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            const ballRadius = 0.2;

            // const dy = ballPos.y - rimPos.y;

            // If ball is near the rim edge (not inside)
            const ringInner = this.RIM_RADIUS - ballRadius;
            const ringOuter = this.RIM_RADIUS + ballRadius;

            const isTouchingRim = horizontalDist > ringInner && horizontalDist < ringOuter;

            const minY = rimPos.y - ballRadius * 1.2;
            const maxY = rimPos.y + ballRadius * 0.8;
            const isVerticalAligned = ballPos.y > minY && ballPos.y < maxY;

            if (isTouchingRim && isVerticalAligned && this.ballVelocity.y < 0) {
                // Reflect the Y velocity
                this.ballVelocity.y *= -0.7;
                this.ballVelocity.x *= 0.8;
                this.ballVelocity.z *= 0.8;

                // Push ball slightly outside the rim to prevent clipping
                const outDir = new THREE.Vector3(dx, 0, dz).normalize();
                this.currentBall.position.x = rimPos.x + outDir.x * ringOuter;
                this.currentBall.position.z = rimPos.z + outDir.z * ringOuter;
                this.currentBall.position.y = rimPos.y + ballRadius;
            }
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