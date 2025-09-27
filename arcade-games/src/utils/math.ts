const PI: number = Math.PI;
const DEG_TO_RAD: number = PI / 180;
const RAD_TO_DEG: number = 180 / PI;
const GRAVITY: number = 9.81;

// MATH
// Clamps a value between a minimum and maximum
const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

// Linearly interpolates between two values based on the amount (0 to 1)
const lerp = (min: number, max: number, amount: number): number => {
    return min + amount * (max - min);
};

// Modulo that always returns a positive result
const mod = (value: number, modulus: number): number => {
    return ((value % modulus) + modulus) % modulus;
};

// Raises a value to the given exponent
const power = (value: number, exponent: number): number => {
    return Math.pow(value, exponent);
};

// Raises a random number to the given exponent
const powerRandom = (exponent: number): number => {
    return Math.pow(Math.random(), exponent);
};

// Returns a random number between min (inclusive) and max (exclusive)
const rangeRandom = (min: number, max: number): number => {
    return Math.random() * (max - min) + min;
};  

// Returns a random integer between min (inclusive) and max (exclusive)
const rangeRandomFloor = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min) + min);
};

// Rounds a number down to the nearest integer
const floorValue = (value: number): number => {
    return Math.floor(value);
};

// Random number between 0 and the given value (exclusive)
const randomFloor = (value: number): number => {
    return Math.floor(Math.random() * value);
};

// PHYSICS
// Calculate the weight (W = m * g)
const applyWeight = (mass: number, gravity: number = GRAVITY): number => {
    return mass * gravity;
};

// Calculates the velocity based on acceleration and time.
const calculateVelocity = (initialVelocity: number, acceleration: number, time: number): number => {
    return initialVelocity + (acceleration * time);
};

// Calculates the position of an object based on its initial position, initial velocity, and acceleration.
const calculatePosition = (
    initialPosition: number, 
    initialVelocity: number, 
    acceleration: number, 
    time: number
): number => {
    return initialPosition + (initialVelocity * time) + (0.5 * acceleration * Math.pow(time, 2));
};

// Calculate the distance between two points in 2D space (Euclidean distance).
const distance = (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

// VECTORS
// Adds two vectors (x1, y1) and (x2, y2).
const addVectors = (x1: number, y1: number, x2: number, y2: number): { x: number, y: number } => {
    return { x: x1 + x2, y: y1 + y2 };
};

// Subtracts vector (x2, y2) from (x1, y1).
const subtractVectors = (x1: number, y1: number, x2: number, y2: number): { x: number, y: number } => {
    return { x: x1 - x2, y: y1 - y2 };
};

// Calculates the magnitude (length) of a vector.
const vectorMagnitude = (x: number, y: number): number => {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
};  

// Normalizes a vector (scales it to have a magnitude of 1).
const normalizeVector = (x: number, y: number): { x: number, y: number } => {
    const magnitude = vectorMagnitude(x, y);
    return { x: x / magnitude, y: y / magnitude };
};

// Returns the dot product of two vectors.
const dotProduct = (x1: number, y1: number, x2: number, y2: number): number => {
    return x1 * x2 + y1 * y2;
};

export {
    PI,
    DEG_TO_RAD,
    RAD_TO_DEG,
    GRAVITY,
    clamp,
    lerp,
    mod,
    power,
    powerRandom,
    rangeRandom,
    rangeRandomFloor,
    floorValue,
    randomFloor,
    applyWeight,
    calculateVelocity,
    calculatePosition,
    distance,
    addVectors,
    subtractVectors,
    vectorMagnitude,
    normalizeVector,
    dotProduct
};