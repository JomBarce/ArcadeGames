import * as THREE from 'three';
import BlasterScene from './BlasterScene';
import GameState from './GameState';

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

// UI Elements
const mainMenu = document.getElementById('mainMenu') as HTMLDivElement;
const startButton = document.getElementById('startShootingGame') as HTMLButtonElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const scoreText = document.getElementById('score') as HTMLDivElement;
const timerText = document.getElementById('timer') as HTMLDivElement;
const gameOverScreen = document.getElementById('gameOverScreen') as HTMLDivElement;
const finalScore = document.getElementById('finalScore') as HTMLParagraphElement;
const restartButton = document.getElementById('restartButton') as HTMLButtonElement;
const menuButton = document.getElementById('menuButton') as HTMLButtonElement;
const countdownTimer = document.getElementById('countdownTimer') as HTMLDivElement;

// Scene
let scene: BlasterScene | null = null;
let animationId: number | null = null;
let timerInterval: number | null = null;
let startTime: number = 0;
const totalGameTime = 60;

function updateHUD() {
	scoreText.textContent = `Score: ${GameState.score}`;
	timerText.textContent = `Time: ${GameState.time.toFixed(2)}s`;
}

// Start Countdown function
function startCountDown() {
    let countdown = GameState.countdownTime;
    
	countdownTimer.classList.remove('hidden');
    countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

    const countdownInterval = setInterval(() => {
        countdown--;
        countdownTimer.innerHTML = `<h3>Starting in: ${countdown}s</h3>`;

        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownTimer.classList.add('hidden');
            startTime = performance.now(); // Start the timer when countdown ends
            animate();  // Start the game loop
        }
    }, 1000);
}

async function startGame() {
	mainMenu.classList.add('hidden');
	gameOverScreen.classList.add('hidden');
	hud.style.display = 'block';

	// Reset GameState
	GameState.score = 0;
	GameState.time = 30;
	GameState.isGameOver = false;

	updateHUD();

    if (scene) {
        scene.reset(); 
    }

	scene = new BlasterScene(camera);
	await scene.initialize();

	// Callback to increase score on target hit
	GameState.onTargetHit = () => {
		GameState.score += 100;
		updateHUD();
	};

	// show count down screen
	startCountDown();
}

function endGame() {
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}

	GameState.isGameOver = true;

	if (scene) {
		scene.reset();
		scene = null;
	}

	hud.style.display = 'none';

    // Update high score
    if (GameState.score > GameState.highScore) {
        GameState.highScore = GameState.score;
        localStorage.setItem('highScore', String(GameState.score));
    }

	finalScore.innerHTML = `
        Your score: ${GameState.score}<br>
        High score: ${GameState.highScore}
    `;
    gameOverScreen.classList.remove('hidden');

	if (animationId) {
		cancelAnimationFrame(animationId);
		animationId = null;
	}
}

// Animation Loop
function animate(timestamp = performance.now()) {
	if (!scene || GameState.isGameOver) return;

	const elapsed = (timestamp - startTime) / 1000; // in seconds
	GameState.time = Math.max(0, totalGameTime - elapsed);

	if (GameState.time <= 0) {
		endGame();
		return;
	}

	updateHUD();

	renderer.render(scene, camera);
	animationId = requestAnimationFrame(animate);
}

// Start button handler
startButton.addEventListener('click', () => {
	startGame();
});

// Restart button handler
restartButton.addEventListener('click', () => {
	startGame();
});

// Menu button handler
menuButton.addEventListener('click', () => {
    if (scene) {
        scene.reset(); 
    }
    gameOverScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});

// Handle window resize
window.addEventListener('resize', () => {
	const width = window.innerWidth;
	const height = window.innerHeight;
	renderer.setSize(width, height);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
});

// Initial state: show main menu, hide others
hud.style.display = 'none';
gameOverScreen.classList.add('hidden');
mainMenu.classList.remove('hidden');