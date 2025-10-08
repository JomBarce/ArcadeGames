import GameBase from './games/shared/GameBase';
import BlasterGame from './games/BlasterGame';

import { fetchJson } from '../src/utils/fetch';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const mainMenu = document.getElementById('mainMenu') as HTMLDivElement;
const cardContainer = document.getElementById('cardContainer') as HTMLButtonElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const scoreText = document.getElementById('score') as HTMLDivElement;
const timerText = document.getElementById('timer') as HTMLDivElement;
const gameOverScreen = document.getElementById('gameOverScreen') as HTMLDivElement;
const gamePauseScreen = document.getElementById('gamePauseScreen') as HTMLDivElement;
const finalScore = document.getElementById('finalScore') as HTMLParagraphElement;
const countdownTimer = document.getElementById('countdownTimer') as HTMLDivElement;

const continueButton = document.getElementById('continueButton') as HTMLButtonElement;
const restartButton1 = document.getElementById('restartButton1') as HTMLButtonElement;
const restartButton2 = document.getElementById('restartButton2') as HTMLButtonElement;
const menuButton1 = document.getElementById('menuButton1') as HTMLButtonElement;
const menuButton2 = document.getElementById('menuButton2') as HTMLButtonElement;

let currentPage: GameBase | null = null;

interface Games {
  id: number;
  name: string;
  description: string;
  imgPath: string;
  buttonPath: string;
}

const gamesData: Games[] = await fetchJson('./data/games.json');

gamesData.forEach((game) => {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <img class="thumbnail" src="${game.imgPath}" alt="Game-${game.id} Thumbnail" draggable="false"/>
    <h3>${game.name}</h3>
    <p>${game.description}</p>
  `;

  if (game.buttonPath) {
    const button = document.createElement("button");
    button.className = 'play-button';
    button.innerHTML= 'Play';

    const clickHandler = () => {
        switchPage(`${game.buttonPath}`);
    };
    button.addEventListener('click', clickHandler);

    div.appendChild(button);
  }

  cardContainer.appendChild(div);
});

// Switch games
async function switchPage(pageName: string) {
  if (currentPage) await currentPage.cleanup();

  const games: { [key: string]: new (
    canvas: HTMLCanvasElement,
    hud: HTMLDivElement,
    scoreText: HTMLDivElement,
    timerText: HTMLDivElement,
    countdownTimer: HTMLDivElement,
    gameOverScreen: HTMLDivElement,
    finalScore: HTMLParagraphElement
  ) => GameBase } = {
    blaster: BlasterGame
  };

  const gameClass = games[pageName];
  if (gameClass) {
    mainMenu.classList.add('hidden');
    gamePauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.style.display = 'block';

    if (pageName == "basketball"){
      document.body.style.cursor = 'grab';
    } else {
      document.body.style.cursor = 'none';
    }

    currentPage = new gameClass(canvas, hud, scoreText, timerText, countdownTimer, gameOverScreen, finalScore);
    if (currentPage) {
        await currentPage.initialize();
        currentPage.start();
    }
  } else {
    mainMenu.classList.remove('hidden');
    gamePauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.style.display = 'none';
  }
}

// Pause button handler
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (mainMenu.classList.contains('hidden') && countdownTimer.classList.contains('hidden')) {
        currentPage?.pause();
        gamePauseScreen.classList.remove('hidden');
      }  
    }
});

// Continue button handler
continueButton.addEventListener('click', () => {
	currentPage?.unpause();
    gamePauseScreen.classList.add('hidden');
});

// Restart button handler
restartButton1.addEventListener('click', () => {
	currentPage?.reset();
  currentPage?.start();
  gameOverScreen.classList.add('hidden');
});

restartButton2.addEventListener('click', () => {
	currentPage?.reset();
  currentPage?.start();
  gamePauseScreen.classList.add('hidden');
});

// Menu button handler
menuButton1.addEventListener('click', () => {
    currentPage?.pause();
    currentPage?.cleanup();
    gameOverScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    hud.style.display = 'none';
});

menuButton2.addEventListener('click', () => {
    currentPage?.pause();
    currentPage?.cleanup();
    gamePauseScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    hud.style.display = 'none';
});