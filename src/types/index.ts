/**
 * Core TypeScript interfaces for the Starling Swarm Simulator
 * Version: 1.2.0 - Extended with creature presets and food mechanics
 */

/** 2D Vector representation */
export interface IVector2 {
  x: number;
  y: number;
}

/** Bird state interface */
export interface IBirdState {
  id: number;
  position: IVector2;
  velocity: IVector2;
  acceleration: IVector2;
  panicLevel: number;
}

/** Creature preset types */
export type CreaturePreset = 'starlings' | 'insects' | 'fish' | 'bats' | 'fireflies' | 'custom';

/** Creature preset configuration */
export interface ICreaturePreset {
  name: string;
  description: string;
  particleSize: number;
  maxSpeed: number;
  maxForce: number;
  perceptionRadius: number;
  separationRadius: number;
  alignmentWeight: number;
  cohesionWeight: number;
  separationWeight: number;
  fieldOfView: number;
  baseColor: number;
  denseColor: number;
  panicColor: number;
  glowEnabled: boolean;
  glowIntensity: number;
}

/** Simulation configuration */
export interface ISimulationConfig {
  // Creature settings
  creaturePreset: CreaturePreset;
  birdCount: number;
  particleSize: number;
  maxSpeed: number;
  maxForce: number;
  perceptionRadius: number;
  separationRadius: number;
  
  // Rule weights
  alignmentWeight: number;
  cohesionWeight: number;
  separationWeight: number;
  
  // Field of view (degrees)
  fieldOfView: number;
  
  // Boundary behavior
  boundaryMargin: number;
  boundaryForce: number;
  wrapEdges: boolean;
  
  // Simulation
  simulationSpeed: number;
  paused: boolean;
  
  // Noise/randomness
  noiseStrength: number;
  wanderStrength: number;
}

/** Environment configuration */
export interface IEnvironmentConfig {
  // Wind
  windSpeed: number;
  windDirection: number;
  windTurbulence: number;
  
  // Predator
  predatorEnabled: boolean;
  predatorSpeed: number;
  predatorAggression: number;
  panicRadius: number;
  panicDecay: number;
  
  // Food sources
  foodEnabled: boolean;
  foodCount: number;
  foodAttractionStrength: number;
  foodAttractionRadius: number;
  foodRespawnTime: number;
  
  // Hunting behavior (creatures hunting each other)
  huntingEnabled: boolean;
  huntingSpeed: number;
  huntingRadius: number;
}

/** Food source */
export interface IFoodSource {
  id: number;
  position: IVector2;
  amount: number;
  maxAmount: number;
  radius: number;
  respawnTimer: number;
  consumed: boolean;
}

/** Statistics for display */
export interface ISimulationStats {
  fps: number;
  birdCount: number;
  averageDensity: number;
  averageVelocity: number;
  simulationTime: number;
  predatorState: 'idle' | 'hunting' | 'attacking';
  foodConsumed: number;
  activeFood: number;
}

/** Predator state */
export interface IPredatorState {
  position: IVector2;
  velocity: IVector2;
  target: IVector2 | null;
  state: 'idle' | 'hunting' | 'attacking';
  cooldown: number;
}

/** Attractor/Repulsor */
export interface IAttractor {
  id: number;
  position: IVector2;
  strength: number;
  radius: number;
  lifetime: number;
  maxLifetime: number;
  isRepulsor: boolean;
}

/** Spatial grid cell */
export interface IGridCell {
  birds: number[];
}

/** Neighbor query result */
export interface INeighborResult {
  index: number;
  distance: number;
  direction: IVector2;
}

/** Rendering options */
export interface IRenderingConfig {
  showTrails: boolean;
  trailLength: number;
  showWindParticles: boolean;
  showPredatorRange: boolean;
  showFoodSources: boolean;
  colorByDensity: boolean;
  colorBySpeed: boolean;
  
  // Visual customization
  particleShape: 'arrow' | 'circle' | 'triangle' | 'dot';
  baseColor: number;
  denseColor: number;
  panicColor: number;
  
  // Effects
  glowEnabled: boolean;
  glowIntensity: number;
  motionBlur: boolean;
}

/**
 * Default configurations are now loaded from /config.json at startup.
 * Import from '../config/ConfigLoader' to access loaded configuration.
 * 
 * @see src/config/ConfigLoader.ts
 * @see public/config.json
 */

// Re-export config loader functions for convenience
export { loadConfig, getConfig, setConfig, getFallbackConfig } from '../config/ConfigLoader';
export type { ILoadedConfig } from '../config/ConfigLoader';

