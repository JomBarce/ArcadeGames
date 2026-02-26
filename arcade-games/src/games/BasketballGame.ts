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

    private ballColliderRadius = 0;
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
    private countdownNumber!: HTMLDivElement;

    private lastUpdateTime = 0;
    private timeRemaining = 60;
    private pauseStartTime = 0;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private isUnpausing: boolean = false;

    private readonly BALL_SPEED = 0.0025;
    private readonly BALL_ARC = 1.1;
    private readonly BALL_LIFETIME = -10;
    private readonly RIM_RADIUS = 1;
    private readonly RIM_VERTICAL_THICKNESS = 0.2;
    private readonly RIM_HEIGHT_OFFSET = -0.1;
    private readonly RIM_THICKNESS = 0.05;
    private readonly RIM_RESTITUTION = 1.2;
    private readonly RIM_FRICTION = 0.1;
    private readonly BALL_COLLIDER_SCALE = .5;


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
                this.computeBallColliderRadius();
            }
            
            // Hoop
            const hoop = this.basketball.getObjectByName('hoop');
            if (hoop) {
                hoop.position.set(0, 1.5, 0);
                this.hoop = hoop;
            }

            if (this.hoop) {
                this.hoop.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(this.hoop);
                const shrink = 0.4;
                box.min.add(new THREE.Vector3(shrink, shrink, shrink));
                box.max.sub(new THREE.Vector3(shrink, 0.5, shrink));
                this.hoopScoringBox = box;
            }
        }

        // Initial Game State
        GameState.score = 0;
        GameState.time = 60;

        this.countdownNumber = this.countdownTimer.querySelector(
            ".countdown-number"
        ) as HTMLDivElement;
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

    private computeBallColliderRadius() {
        if (!this.currentBall) return;

        const box = new THREE.Box3().setFromObject(this.currentBall);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);

        this.ballColliderRadius = sphere.radius * this.BALL_COLLIDER_SCALE;
    }

    private handleRimCollision() {
        if (this.currentBall && this.ballInMotion && this.hoop) {
            const ballPos = this.currentBall.position;
            const rimPos = this.hoop.position.clone();
            rimPos.y += this.RIM_HEIGHT_OFFSET;

            const BALL_R = this.ballColliderRadius;

            // Horizontal distance from rim center
            const dx = ballPos.x - rimPos.x;
            const dz = ballPos.z - rimPos.z;
            const distXZ = Math.sqrt(dx * dx + dz * dz);

            const innerRadius = this.RIM_RADIUS - this.RIM_THICKNESS;
            const outerRadius = this.RIM_RADIUS + this.RIM_THICKNESS;

            // Vertical distance
            const verticalDist = Math.abs(ballPos.y - rimPos.y);

            const isAtRimHeight =
                verticalDist < this.RIM_VERTICAL_THICKNESS * 0.5 + BALL_R * 0.25;

            const isTouchingRim =
                distXZ > innerRadius - BALL_R &&
                distXZ < outerRadius + BALL_R;

            // Only collide if ball is falling
            if (isTouchingRim && isAtRimHeight && this.ballVelocity.y < 0) {

                if (distXZ < innerRadius - BALL_R * 0.8) return;

                // Penetration depths
                const radialPenetration = outerRadius + BALL_R - distXZ;
                const verticalPenetration = this.RIM_VERTICAL_THICKNESS * 0.5 + BALL_R - verticalDist;
                const isTopHit = verticalPenetration < radialPenetration && ballPos.y > rimPos.y;

                if (isTopHit) {
                    const rimVec = new THREE.Vector3(dx, 0, dz);
                    const distXZ = rimVec.length();

                    const innerRadius = this.RIM_RADIUS - this.RIM_THICKNESS;

                    if (distXZ < innerRadius) {
                        // Cone effect
                        const slopeAngle = 20 * (Math.PI/180);
                        const coneNormal = new THREE.Vector3(
                            rimVec.x, Math.tan(slopeAngle) * distXZ, rimVec.z
                        ).normalize();

                        // Bounce
                        const v = this.ballVelocity.clone();
                        const vNormal = coneNormal.clone().multiplyScalar(v.dot(coneNormal));
                        const vTangent = v.clone().sub(vNormal);

                        const bouncedNormal = vNormal.multiplyScalar(-this.RIM_RESTITUTION);
                        const bouncedTangent = vTangent.multiplyScalar(1 - this.RIM_FRICTION);

                        this.ballVelocity.copy(bouncedNormal.add(bouncedTangent));

                        // Push ball slightly out of inner rim
                        this.currentBall.position.x = rimPos.x + coneNormal.x * (BALL_R + 0.001);
                        this.currentBall.position.z = rimPos.z + coneNormal.z * (BALL_R + 0.001);
                        this.currentBall.position.y = Math.max(
                            this.currentBall.position.y,
                            rimPos.y + BALL_R * 0.5
                        );

                    } else {
                        // Ball hits top of rim
                        if (Math.abs(this.ballVelocity.x) + Math.abs(this.ballVelocity.z) > 0.05) {
                            this.ballVelocity.y = Math.abs(this.ballVelocity.y) * this.RIM_RESTITUTION * 0.3;
                        }
                        this.currentBall.position.y = rimPos.y + this.RIM_VERTICAL_THICKNESS * 0.5 + BALL_R + 0.001;
                    }
                } else {
                    // Side rim hit
                    const normal = new THREE.Vector3(dx, 0, dz).normalize();

                    const v = this.ballVelocity.clone();
                    const vNormal = normal.clone().multiplyScalar(v.dot(normal));
                    const vTangent = v.clone().sub(vNormal);

                    const bouncedNormal = vNormal.multiplyScalar(-this.RIM_RESTITUTION);
                    const bouncedTangent = vTangent.multiplyScalar(1 - this.RIM_FRICTION);

                    this.ballVelocity.copy(bouncedNormal.add(bouncedTangent));

                    // Push radially outward
                    const pushOut = normal.multiplyScalar(outerRadius + BALL_R + 0.001);
                    this.currentBall.position.x = rimPos.x + pushOut.x;
                    this.currentBall.position.z = rimPos.z + pushOut.z;

                    // Clamp Y
                    this.currentBall.position.y = Math.max(
                        this.currentBall.position.y,
                        rimPos.y - this.RIM_VERTICAL_THICKNESS * 0.25
                    );
                }
            }
        }
    }

    private updateBall(delta: number) {
        if (!this.currentBall || !this.ballInMotion) return;

        this.ballVelocity.y -= GRAVITY * delta;
        this.currentBall.position.addScaledVector(this.ballVelocity, delta);
        this.currentBall.rotateX(this.ballSpinSpeed * delta);

        if (this.currentBall.position.y < this.BALL_LIFETIME) {
            this.resetBall();
        }
    }

    private onScore() {
        GameState.score += 200;
        this.updateHUD();
        
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
        const dy = this.dragStart.y - this.dragEnd.y;
        const dt = (this.dragEnd.time - this.dragStart.time) / 1000;

        const screenDir = new THREE.Vector2(dx, dy).normalize();
        const flickDirection = new THREE.Vector3(screenDir.x, screenDir.y + this.BALL_ARC, -1).normalize();
        flickDirection.applyQuaternion(this.camera.quaternion);

        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        const velocity = flickDirection.multiplyScalar(speed * this.BALL_SPEED);
        this.ballVelocity.copy(velocity);
        this.ballSpinSpeed = 1 - Math.min(5, speed * 0.02);
        this.ballInMotion = true;

        this.dragStart = null;
        this.dragEnd = null;
    };

    override addListeners() {
        super.addListeners();

        window.addEventListener('mouseup', this.onMouseUp, false);
        window.addEventListener('mousedown', this.onMouseDown, false);
    }

    private removeListeners() {
        this.onMouseUp && window.removeEventListener('mouseup', this.onMouseUp, false);
        this.onMouseDown && window.removeEventListener('mousedown', this.onMouseDown, false);
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

        this.resetBall();

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

        this.updateBall(delta);
        this.handleRimCollision();

        if (this.hoopScoringBox && !this.hasScoredThisShot && this.currentBall) {
            if (this.hoopScoringBox.containsPoint(this.currentBall.position)) {
                this.onScore();
                this.hasScoredThisShot = true;
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