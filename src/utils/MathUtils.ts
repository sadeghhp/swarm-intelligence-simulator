/**
 * Mathematical utilities for swarm simulation
 * Version: 1.0.0
 * 
 * Includes:
 * - Perlin noise for natural randomness
 * - Interpolation functions
 * - Angle utilities
 * - Random distributions
 */

// ==================== CONSTANTS ====================

export const TWO_PI = Math.PI * 2;
export const HALF_PI = Math.PI / 2;
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

// ==================== BASIC MATH ====================

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth step interpolation (cubic)
 */
export function smoothstep(a: number, b: number, t: number): number {
  t = clamp((t - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Smoother step interpolation (quintic)
 */
export function smootherstep(a: number, b: number, t: number): number {
  t = clamp((t - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Map value from one range to another
 */
export function map(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Exponential decay
 */
export function expDecay(value: number, target: number, decay: number, dt: number): number {
  return target + (value - target) * Math.exp(-decay * dt);
}

// ==================== ANGLE UTILITIES ====================

/**
 * Normalize angle to [-PI, PI]
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= TWO_PI;
  while (angle < -Math.PI) angle += TWO_PI;
  return angle;
}

/**
 * Get shortest angle difference between two angles
 */
export function angleDifference(from: number, to: number): number {
  const diff = normalizeAngle(to - from);
  return diff;
}

/**
 * Lerp between angles (handles wraparound)
 */
export function lerpAngle(from: number, to: number, t: number): number {
  const diff = angleDifference(from, to);
  return normalizeAngle(from + diff * t);
}

/**
 * Check if angle is within field of view
 */
export function isInFieldOfView(
  viewerHeading: number,
  targetAngle: number,
  fovDegrees: number
): boolean {
  const halfFov = (fovDegrees * DEG_TO_RAD) / 2;
  const diff = Math.abs(angleDifference(viewerHeading, targetAngle));
  return diff <= halfFov;
}

// ==================== RANDOM UTILITIES ====================

/**
 * Random float in range [min, max)
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Random integer in range [min, max]
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Gaussian (normal) distribution random
 * Uses Box-Muller transform
 */
export function randomGaussian(mean: number = 0, stdDev: number = 1): number {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(TWO_PI * u2);
  return z * stdDev + mean;
}

// ==================== PERLIN NOISE ====================

/**
 * Simple 2D Perlin noise implementation
 * Used for natural-looking variations in movement
 */
class PerlinNoise {
  private permutation: number[];
  private gradients: { x: number; y: number }[];

  constructor(seed?: number) {
    // Initialize permutation table
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    
    // Shuffle with optional seed
    const random = seed !== undefined ? this.seededRandom(seed) : Math.random;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    
    // Duplicate for overflow
    this.permutation = [...this.permutation, ...this.permutation];
    
    // Pre-compute gradients
    this.gradients = [];
    for (let i = 0; i < 256; i++) {
      const angle = (this.permutation[i] / 256) * TWO_PI;
      this.gradients[i] = { x: Math.cos(angle), y: Math.sin(angle) };
    }
  }

  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private dotGridGradient(ix: number, iy: number, x: number, y: number): number {
    const gradient = this.gradients[this.permutation[ix + this.permutation[iy]] & 255];
    const dx = x - ix;
    const dy = y - iy;
    return dx * gradient.x + dy * gradient.y;
  }

  /**
   * Get noise value at position (returns -1 to 1)
   */
  noise2D(x: number, y: number): number {
    // Grid cell coordinates
    const x0 = Math.floor(x) & 255;
    const y0 = Math.floor(y) & 255;
    const x1 = (x0 + 1) & 255;
    const y1 = (y0 + 1) & 255;

    // Relative position in cell
    const sx = x - Math.floor(x);
    const sy = y - Math.floor(y);

    // Interpolation weights
    const u = this.fade(sx);
    const v = this.fade(sy);

    // Interpolate
    const n00 = this.dotGridGradient(x0, y0, x, y);
    const n10 = this.dotGridGradient(x1, y0, x, y);
    const n01 = this.dotGridGradient(x0, y1, x, y);
    const n11 = this.dotGridGradient(x1, y1, x, y);

    const nx0 = lerp(n00, n10, u);
    const nx1 = lerp(n01, n11, u);

    return lerp(nx0, nx1, v);
  }

  /**
   * Fractal Brownian Motion (layered noise)
   */
  fbm(x: number, y: number, octaves: number = 4, lacunarity: number = 2, gain: number = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }
}

// Global noise instance
let noiseInstance: PerlinNoise | null = null;

/**
 * Get 2D Perlin noise value
 */
export function noise(x: number, y: number): number {
  if (!noiseInstance) {
    noiseInstance = new PerlinNoise();
  }
  return noiseInstance.noise2D(x, y);
}

/**
 * Get layered (FBM) noise value
 */
export function fbmNoise(x: number, y: number, octaves: number = 4): number {
  if (!noiseInstance) {
    noiseInstance = new PerlinNoise();
  }
  return noiseInstance.fbm(x, y, octaves);
}

/**
 * Reset noise with new seed
 */
export function setNoiseSeed(seed: number): void {
  noiseInstance = new PerlinNoise(seed);
}

// ==================== EASING FUNCTIONS ====================

export const Easing = {
  linear: (t: number) => t,
  
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  
  easeInElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  }
};

// ==================== COLOR UTILITIES ====================

/**
 * Convert HSL to RGB hex
 */
export function hslToHex(h: number, s: number, l: number): number {
  h = h % 360;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);

  return (ri << 16) + (gi << 8) + bi;
}

/**
 * Lerp between two colors
 */
export function lerpColor(color1: number, color2: number, t: number): number {
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;

  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;

  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));

  return (r << 16) + (g << 8) + b;
}

