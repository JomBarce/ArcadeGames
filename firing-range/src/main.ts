import * as THREE from 'three';
import BlasterScene from './BlasterScene';

const width = window.innerWidth;
const height = window.innerHeight;

// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: document.getElementById('app') as HTMLCanvasElement
});

renderer.setSize(width, height);
renderer.setClearColor( 0xffffff, 0);

// Perspective Camera
const camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 100);

// Scene
const scene = new BlasterScene(camera);
scene.initialize();

// Animation
function animate(){
  scene.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
