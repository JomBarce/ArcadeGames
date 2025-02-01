import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/Addons.js';
import { OBJLoader } from 'three/examples/jsm/Addons.js';

export default class BlasterScene extends THREE.Scene {
    private readonly mtLoader = new MTLLoader();
    private readonly objLoader = new OBJLoader();

    private readonly camera: THREE.PerspectiveCamera;

    private blaster?: THREE.Group;
    private bulletMtl?: MTLLoader.MaterialCreator;

    private directionVector = new THREE.Vector3(); 

    private targets: THREE.Group[] = [];
    private targetPositionsMap: Map<THREE.Group, THREE.Vector3> = new Map();
    private bullets: THREE.Object3D[] = [];

    constructor(camera: THREE.PerspectiveCamera) {
        super();
        this.camera = camera;

        // Event handler bindings
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
    }

    // Initialize the scene
    async initialize() {
        // Load target material
        const targetMtl = await this.mtLoader.loadAsync('assets/targetA.mtl');
        targetMtl.preload();
        // Target positions
        const targetPositions = [
            { x:-2, y:0, z:-2 }, { x:-2, y:2, z:-3 },
            { x:-1, y:0, z:-3 }, { x:-1, y:1, z:-2 },
            { x:0, y:0, z:-2 }, { x:0, y:2, z:-3 },
            { x:1, y:0, z:-3 }, { x:1, y:1, z:-2 },
            { x:2, y:0, z:-2 }, { x:2, y:2, z:-3 },
            { x:-1, y:-1, z:-2 }, { x:1, y:-1, z:-2 }
        ];
        // Load and position targets
        const targets = await Promise.all(targetPositions.map(async (position) => {
            const target = await this.createTarget(targetMtl);
            target.position.set(position.x, position.y, position.z);

            this.targets.push(target);
            this.targetPositionsMap.set(target, target.position.clone());

            return target;
        }));
        // Add the targets to the scene
        this.add(...targets);

        // Load and create the blaster
        this.blaster = await this.createBlaster();
        if (this.blaster) {
            this.blaster.position.z = 2; // Blaster Position
            this.add(this.blaster);
            // Attach the camera to the blaster
            this.blaster.add(this.camera);
            this.camera.position.set(0, 0.4, 1); // Camera Position
        }

        // Load bullet material
        this.bulletMtl = await this.mtLoader.loadAsync('assets/foamBulletB.mtl');
        this.bulletMtl.preload();

        // Light
        const light = new THREE.DirectionalLight(0xFFFFFF, 3);
        light.position.set(0, 4, 2);
        this.add(light);

        // Add mouse event listeners
        window.addEventListener('mousemove', this.onMouseMove, false);
        window.addEventListener('mousedown', this.onMouseDown, false);
    }

    // Create a target object
    private async createTarget(mtl: MTLLoader.MaterialCreator) {
        this.objLoader.setMaterials(mtl);

        const targetModel = await this.objLoader.loadAsync('assets/targetA.obj');
        // Modify the target model
        targetModel.rotateY(Math.PI * 0.5);
        targetModel.scale.set(2, 2, 2);

        return targetModel;
    }

    // Create a blaster object
    private async createBlaster() {
        // Load blaster material
        const blasterMtl = await this.mtLoader.loadAsync('assets/blasterG.mtl');
        blasterMtl.preload();
        // Set and load the object
        this.objLoader.setMaterials(blasterMtl);
        const blasterModel = await this.objLoader.loadAsync('assets/blasterG.obj');

        return blasterModel;
    }

    // Create a bullet object
    private async createBullet() {
        if (!this.blaster) {
            return;
        }
        // Set the materials
        if (this.bulletMtl) {
            this.objLoader.setMaterials(this.bulletMtl);
        }
        // Load the object
        const bulletModel = await this.objLoader.loadAsync('assets/foamBulletB.obj');
        // Modify the bullet model
        bulletModel.scale.set(2, 2, 2);

        // Get the camera direction
        this.camera.getWorldDirection(this.directionVector);
        this.directionVector.normalize();
        
        // Bullet spawn position
        const aabb = new THREE.Box3().setFromObject(this.blaster);
        const size = aabb.getSize(new THREE.Vector3());
        const vec = this.blaster.position.clone();
        vec.y += 0.1;

        bulletModel.position.add(
            vec.add(
                this.directionVector.clone().multiplyScalar(size.z * 0.5)
            )
        );

        // Rotate and align the bullet to face the firing direction
        bulletModel.children.forEach(child => child.rotateX(Math.PI * -0.5));
        bulletModel.rotation.copy(this.blaster.rotation);

        // Add the bullet to the scene
        this.add(bulletModel);
        // Store the bullet reference
        this.bullets.push(bulletModel);

        // Set the bullet velocity
        const velocity = this.directionVector.clone().multiplyScalar(0.1);
        // Bullet movement
        const moveBullet = () => {
            // Move the bullet
            bulletModel.position.add(velocity);
            // Check for collisions with targets
            this.checkCollisions(bulletModel);
            // Remove bullet if it goes out of bounds
            if (bulletModel.position.length() > 100) {
                this.remove(bulletModel);
                this.bullets = this.bullets.filter(b => b !== bulletModel);
            } else {
                requestAnimationFrame(moveBullet);
            }
        };
        // Start moving the bullet
        moveBullet(); 
    }

    // Check if bullet and target collides
    private checkCollisions(bullet: THREE.Object3D) {
        // Bullet bounding box
        const bulletBox = new THREE.Box3().setFromObject(bullet);
        // Check each target for collision with the bullet
        for (let target of this.targets) {
            const targetBox = new THREE.Box3().setFromObject(target);
            // If collision is detected
            if (bulletBox.intersectsBox(targetBox)) {
                this.handleTargetHit(target, bullet);
                break;
            }
        }
    }

    // Handle a target hit
    private handleTargetHit(target: THREE.Group, bullet: THREE.Object3D) {
        // Remove the target
        this.remove(target);
        // Remove the bullet
        this.remove(bullet);
        this.bullets = this.bullets.filter(b => b !== bullet);
        // Respawn the target 
        setTimeout(() => {
            target.position.copy(this.targetPositionsMap.get(target) || new THREE.Vector3());
            this.add(target);
        }, 2000); // Respawn after 2 seconds
    }

    // Handle mouse movement
    private onMouseMove(event: MouseEvent) {
        if (this.blaster) {
            // Normalize mouse coordinates
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
            // Max tilt for the blaster
            const maxTilt = Math.PI / 3;
            // Rotate the blaster
            this.blaster.rotation.y = -mouseX * maxTilt;
            this.blaster.rotation.x = mouseY * maxTilt;
        }
    }

    // Handle mouse click
    private onMouseDown(event: MouseEvent) {
        if (event.button === 0) {
            // Fire Bullet
            this.createBullet();
        }
    }
}
