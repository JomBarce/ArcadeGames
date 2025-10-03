import * as THREE from 'three';

export default class GameBase {
    protected canvas: HTMLCanvasElement;
	protected renderer: THREE.WebGLRenderer | null = null;
	protected scene: THREE.Scene | null = null;
	protected camera: THREE.PerspectiveCamera | null = null;
	protected clock: THREE.Clock;

	private animationFrameId: number | null = null;
	private handleResizeBound = this.handleResize.bind(this);

    protected isGamePaused = false;
	protected isGameOver = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.clock = new THREE.Clock();

        this.setRenderer();
        this.setScene();
        this.setLight();
        this.setCamera();
        this.setControls();
    }

    async initialize(): Promise<void> {}

    setRenderer() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: this.canvas,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0xffffff, 0);
    }

    setScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333344);       
    }

    setLight() {
        if (!this.scene) return;

        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(0, 4, 2);
        this.scene.add(directional);

        const ambient = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambient);
    }

    setCamera() {
        const fieldOfView = 75;
        const aspectRatio = window.innerWidth / window.innerHeight;
        const nearPlane = 0.1;
        const farPlane = 1000;

        this.camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane);
        this.camera.position.set(0, 0, 5);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    protected setControls() {}

    protected addListeners() {
        window.addEventListener('resize', this.handleResizeBound);
    }

    protected handleResize() {
        if (!this.renderer || !this.camera || !this.camera.isPerspectiveCamera) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    /** Start or restart game loop */
	public start() {
		this.isGameOver = false;
		this.isGamePaused = false;
		this.clock.start();
		this.animate();
	}

	/** Reset game state */
	public reset() {
		this.isGameOver = false;
		this.isGamePaused = false;
		this.clock.stop();
		this.clock.start();
	}

	/** Pause the game loop */
	public pause() {
		this.isGamePaused = true;
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

    /** Resume the game loop if paused */
    public unpause() {
        if (!this.isGamePaused || this.isGameOver) return;

        this.isGamePaused = false;
        this.animate();
    }

	/** End the game */
	protected endGame() {
		this.isGameOver = true;
		this.pause();
	}

    protected get elapsedTime(): number {
        return this.clock.getElapsedTime();
    }

    protected get deltaTime(): number {
        return this.clock.getDelta();  // Time in seconds since last call
    }

    protected update() {}

    protected animate = () => {
        if (this.isGameOver || this.isGamePaused) return;

        this.update();

        if (this.scene && this.camera && this.renderer) {
            this.renderer.render(this.scene, this.camera);
            this.animationFrameId = requestAnimationFrame(this.animate);
        }
    };

    public async cleanup() {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.scene = null;

        window.removeEventListener('resize', this.handleResizeBound);
    }
}