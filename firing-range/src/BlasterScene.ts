import * as THREE from 'three';

import { MTLLoader } from 'three/examples/jsm/Addons.js';
import { OBJLoader } from 'three/examples/jsm/Addons.js';

export default class BlasterScene extends THREE.Scene{
    private readonly mtLoader = new MTLLoader();
    private readonly objLoader = new OBJLoader();

    private readonly camera: THREE.PerspectiveCamera;

    private blaster: THREE.Object3D | null = null;
    private directionVector = new THREE.Vector3();

    private bulletMtl?: MTLLoader.MaterialCreator;

    constructor(camera: THREE.PerspectiveCamera){
        super();
        this.camera = camera;

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
    }

    async initialize(){
        // Load targets
        const targetMtl = await this.mtLoader.loadAsync('assets/targetA.mtl');
        targetMtl.preload();

        // Create Targets
        const targetPositions = [
            { x: -2, z: -2 },
            { x: -1, z: -3 },
            { x: 0, z: -2 },
            { x: 1, z: -3 },
            { x: 2, z: -2 }
        ];

        const targets = await Promise.all(targetPositions.map(async (position) => {
            const target = await this.createTarget(targetMtl);
            target.position.set(position.x, 0, position.z);
            return target;
        }));

        this.add(...targets);

        // Create Blaster
        this.blaster = await this.createBlaster();
        if (this.blaster) {
            this.blaster.position.z = 2;
            this.add(this.blaster);

            this.blaster.add(this.camera);
            this.camera.position.z = 1;
            this.camera.position.y = 0.5;
        }

        // Create Bullets
        this.bulletMtl = await this.mtLoader.loadAsync('assets/foamBulletB.mtl');
        this.bulletMtl.preload();

        // Light
        const light = new THREE.DirectionalLight(0xFFFFFF, 3);
        light.position.set(0, 4, 2);
        this.add(light);

        // Mouse listener
        window.addEventListener('mousemove', this.onMouseMove, false);
        window.addEventListener('mousedown', this.onMouseDown, false);
    }

    private async createTarget(mtl: MTLLoader.MaterialCreator){
        this.objLoader.setMaterials(mtl);

        const modelRoot = await this.objLoader.loadAsync('assets/targetA.obj');
    
        modelRoot.rotateY(Math.PI * 0.5);

        return modelRoot;
    }
    
    private async createBlaster(){
        const blasterMtl = await this.mtLoader.loadAsync('assets/blasterG.mtl');
        blasterMtl.preload();
        
        this.objLoader.setMaterials(blasterMtl);

        const blasterModel = await this.objLoader.loadAsync('assets/blasterG.obj');

        return blasterModel;
    }  

    private async createBullet(){
        if(!this.blaster){
            return;
        }

        if(this.bulletMtl){
            this.objLoader.setMaterials(this.bulletMtl);
        }

        const bulletModel = await this.objLoader.loadAsync('assets/foamBulletB.obj');

        this.camera.getWorldDirection(this.directionVector);

        const aabb = new THREE.Box3().setFromObject(this.blaster)
		const size = aabb.getSize(new THREE.Vector3())

		const vec = this.blaster.position.clone()
		vec.y += 0.06

        bulletModel.position.add(
			vec.add(
				this.directionVector.clone().multiplyScalar(size.z * 0.5)
			)
		)

        this.add(bulletModel);
    }

    private onMouseMove(event: MouseEvent) {
        if (this.blaster) {
            // Normalize mouse coordinates (-1 to 1)
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

            // Set the tilt range for the camera and blaster rotation (you can adjust these values)
            const maxTilt = Math.PI / 3; // Max tilt of 30 degrees

            // Tilt based on mouse X position (camera rotation around the Y axis)
            this.blaster.rotation.y = -mouseX * maxTilt;

            // Tilt based on mouse Y position (camera rotation around the X axis)
            this.blaster.rotation.x = mouseY * maxTilt;

            // The camera will follow the blaster's rotation, no need to adjust its rotation separately
        }
    }

    private onMouseDown(event: MouseEvent) {
        if (event.button === 0) {
            this.createBullet();
;        }
    }

    update(){
        // update
    }
}