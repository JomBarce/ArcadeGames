import * as THREE from 'three';
import { GLTFLoader, MTLLoader, OBJLoader } from 'three/examples/jsm/Addons.js';

class AssetManager {
    private objLoader: OBJLoader;
    private mtlLoader: MTLLoader;
    private images: { [key: string]: ImageBitmap };
    private models: { [key: string]: THREE.Object3D | THREE.Group | any };

    constructor() {
        this.objLoader = new OBJLoader();
        this.mtlLoader = new MTLLoader();
        this.images = {};
        this.models = {};
    }

    async loadImage(name: string, url: string): Promise<ImageBitmap | null> {
        if (!this.images[name]) {
            try {
                const loader = new THREE.ImageBitmapLoader();
                loader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });

                const bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
                    loader.load(url, resolve, undefined, reject);
                });

                this.images[name] = bitmap;
            } catch (error) {
                console.error(`Failed to load image: ${url}`, error);
                return null;
            }
        }

        return this.images[name]; 
    }

    async loadGLTF(name: string, url: string): Promise<THREE.Object3D | null> {
        if (!this.models[name]) {
            const loader = new GLTFLoader();
            try {
                const gltf = await loader.loadAsync(url);
                this.models[name] = gltf.scene;
            } catch (error) {
                console.error(`Failed to load GLTF model: ${url}`, error);
                return null;
            }
        }

        return this.models[name];
    }

    async loadOBJ(name: string, objUrl: string, mtlUrl?: string): Promise<THREE.Object3D | null> {
        if (this.models[name]) return this.models[name];

        if (mtlUrl) {
            const materialCreator = await this.mtlLoader.loadAsync(mtlUrl);
            materialCreator.preload();
            this.objLoader.setMaterials(materialCreator);
        }

        try {
            const obj = await new Promise<THREE.Object3D>((resolve, reject) => {
                this.objLoader.load(objUrl, resolve, undefined, reject);
            });

            this.models[name] = obj;
        } catch (error) {
            console.error(`Failed to load OBJ model: ${objUrl}`, error);
            return null;
        }

        return this.models[name];
    }

    // Get a loaded image by name
    getImage(name: string): ImageBitmap | undefined {
        return this.images[name];
    }

    // Get a loaded model by name
    getModel(name: string): THREE.Object3D | undefined {
        return this.models[name];
    }

    // Clear loaded assets
    clear(): void {
        this.images = {};
        this.models = {};
    }
}

export default new AssetManager();