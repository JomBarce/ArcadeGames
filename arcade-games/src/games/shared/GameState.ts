export default class GameState {
	static score = 0;
	static time = 60;
	static highScore = 0;
	static countdownTime = 3;
	static initialTime = 60;

	static reset() {
		GameState.score = 0;
		GameState.time = GameState.initialTime;
	}

	static saveHighScore(gameName: string) {
		if (GameState.score > GameState.highScore) {
			GameState.highScore = GameState.score;
			localStorage.setItem(gameName, String(GameState.highScore));
		}
	}

	static getHighScore(gameName: string) {
		GameState.highScore = Number(localStorage.getItem(gameName)) || 0;
		return GameState.highScore; 
	}
}