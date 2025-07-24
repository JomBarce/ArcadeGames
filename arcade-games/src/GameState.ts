export type GameStateType = {
	score: number;
	time: number;
	isGameOver: boolean;
    highScore: number;
    countdownTime: number;
	onTargetHit?: () => void;
};

const GameState: GameStateType = {
	score: 0,
	time: 60,
	isGameOver: false,
	highScore: Number(localStorage.getItem('highScore')) || 0,
    countdownTime: 3,
    onTargetHit: undefined,
};

export default GameState;