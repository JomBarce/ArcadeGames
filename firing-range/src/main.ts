import * as THREE from 'three';
import BlasterScene from './BlasterScene';

const width = window.innerWidth;
const height = window.innerHeight;

// Renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas: document.getElementById('app') as HTMLCanvasElement
});
// Set the size and color of renderer
renderer.setSize(width, height);
renderer.setClearColor( 0xffffff, 0);

// Perspective Camera
const camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 100);

// Scene
const scene = new BlasterScene(camera);
// Initialize the scene
scene.initialize();

// Animation
function animate() {
    // Render the scene
    renderer.render(scene, camera); 
    requestAnimationFrame(animate);
}
// Start the animation loop
animate();