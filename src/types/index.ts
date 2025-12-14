/**
 * Core TypeScript interfaces for the Starling Swarm Simulator
 * Version: 1.4.0 - Added ecosystem and multi-species support
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
export type CreaturePreset = 'starlings' | 'insects' | 'fish' | 'bats' | 'fireflies' | 'ants' | 'locusts' | 'jellyfish' | 'sparrows' | 'plankton' | 'custom';

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
  
  // Energy system
  energyEnabled: boolean;
  energyDecayRate: number;
  minEnergySpeed: number;
  foodEnergyRestore: number;
}

/** Environment configuration */
export interface IEnvironmentConfig {
  // Wind
  windSpeed: number;
  windDirection: number;
  windTurbulence: number;
  
  // Predator
  predatorEnabled: boolean;
  predatorType: PredatorType;
  predatorCount: number;
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
  averageEnergy: number;
  simulationTime: number;
  predatorState: PredatorBehaviorState;
  predatorEnergy?: number;
  predatorType?: PredatorType;
  activePredators: number;
  foodConsumed: number;
  activeFood: number;
}

/** Predator types - different hunting strategies */
export type PredatorType = 'hawk' | 'falcon' | 'eagle' | 'owl';

/** Predator behavior states */
export type PredatorBehaviorState = 
  | 'idle'           // Resting or wandering
  | 'scanning'       // Looking for targets
  | 'stalking'       // Approaching without triggering panic
  | 'hunting'        // Active pursuit
  | 'attacking'      // Final strike
  | 'diving'         // Falcon-specific dive attack
  | 'ambushing'      // Owl-specific wait state
  | 'recovering';    // Post-attack cooldown

/** Predator energy/stamina statistics */
export interface IPredatorStats {
  maxEnergy: number;           // Maximum energy (100 baseline)
  energyRegenRate: number;     // Energy regeneration per second while idle
  huntingDrain: number;        // Energy drain per second while hunting
  attackCost: number;          // One-time energy cost per attack
  exhaustionThreshold: number; // Must rest when energy below this
  burstMultiplier: number;     // Speed multiplier during burst/attack
  staminaRecoveryDelay: number; // Seconds before energy starts recovering
}

/** Predator preset configuration per type */
export interface IPredatorPreset {
  name: string;
  description: string;
  speed: number;
  diveSpeed?: number;          // Falcon-specific
  strikeSpeed?: number;        // Owl-specific
  stamina: number;
  burstMultiplier: number;
  pursuitBonus?: number;       // Eagle-specific
  stealthRadius?: number;      // Owl-specific
  panicRadius: number;
  color: string;
  stats: IPredatorStats;
}

/** Extended predator state with energy and type info */
export interface IPredatorState {
  id: number;
  type: PredatorType;
  position: IVector2;
  velocity: IVector2;
  target: IVector2 | null;
  targetBirdId: number | null;
  state: PredatorBehaviorState;
  energy: number;
  maxEnergy: number;
  cooldown: number;
  panicRadius: number;         // Effective panic radius (accounts for stealth/altitude)
  altitude?: number;           // Falcon-specific (simulated)
  isStealthed?: boolean;       // Owl-specific
  huntDuration: number;        // Time spent in current hunt
  successfulHunts: number;
  failedHunts: number;
}

/** Target selection scoring for intelligent prey selection */
export interface ITargetScore {
  birdId: number;
  position: IVector2;
  isolationScore: number;      // How far from neighbors
  edgeScore: number;           // Distance from flock center
  velocityScore: number;       // Moving away from flock
  panicScore: number;          // Already panicked
  interceptScore: number;      // Feasibility of intercept
  totalScore: number;
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

/** Species definition for ecosystem */
export interface ISpecies {
  id: string;
  preset: CreaturePreset;
  count: number;
  preyOn: string[];       // Species IDs this one hunts
  avoidSpecies: string[]; // Species IDs to flee from
  active: boolean;
}

/** Ecosystem configuration */
export interface IEcosystemConfig {
  enabled: boolean;
  species: ISpecies[];
  interactionRadius: number;
  huntingForce: number;
  fleeingForce: number;
  respawnDelay: number;
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

