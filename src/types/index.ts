/**
 * Core TypeScript interfaces for the Starling Swarm Simulator
 * Version: 1.7.0 - Added gender and mating/fighting behavior system
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
export type CreaturePreset = 'starlings' | 'insects' | 'fish' | 'bats' | 'fireflies' | 'ants' | 'locusts' | 'jellyfish' | 'sparrows' | 'plankton' | 'herring' | 'custom';

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

/** Feeding behavior types */
export type FeedingBehaviorType = 'gather' | 'swarm' | 'hover';

/** Creature feeding states */
export type FeedingState = 'none' | 'approaching' | 'gathering' | 'feeding';

/** Bird gender for mating behavior */
export type Gender = 'male' | 'female';

/** Mating/courtship behavior states */
export type MatingState = 
  | 'none'        // Not seeking/not eligible
  | 'seeking'     // Actively looking for mate
  | 'approaching' // Moving toward target mate
  | 'courting'    // Close to mate, pre-mating display
  | 'mating'      // Paired and stationary
  | 'fighting'    // Male competition for access
  | 'cooldown';   // Post-mating recovery period

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
  
  // Feeding behavior (creatures gathering at food)
  feedingBehavior: FeedingBehaviorType;
  gatherRadius: number;           // Distance at which creatures orbit food
  feedingDuration: number;        // Minimum time (seconds) creatures stay at food
  maxFeedersPerFood: number;      // Maximum creatures allowed at one food source
  consumptionPerFeeder: number;   // Food amount consumed per second per creature
  
  // Hunting behavior (creatures hunting each other)
  huntingEnabled: boolean;
  huntingSpeed: number;
  huntingRadius: number;
  
  // Mating & competition behavior
  matingEnabled: boolean;              // Toggle mating system
  mateSearchRadius: number;            // Detection range for opposite gender
  mateAttractionStrength: number;      // Steering force multiplier toward mate (0.5-2.0)
  courtingDistance: number;            // Distance to start courting display
  matingDistance: number;              // Distance to lock into mating
  matingDuration: number;              // Time pair stays together (seconds)
  matingCooldown: number;              // Cooldown before seeking again (seconds)
  fightRadius: number;                 // Male competition detection radius
  fightDuration: number;               // Contest length (seconds)
  fightStrength: number;               // Repulsion/jostle force
  panicSuppressesMating: boolean;      // High panic disables mating
  energyThresholdForMating: number;    // Min energy to seek mate (0-1)
  femaleSelectivity: number;           // Female pickiness (0-1, higher = fewer acceptances)
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
  /** Set of bird IDs currently feeding at this source */
  feeders: Set<number>;
  /** Current consumption rate (based on number of feeders) */
  consumptionRate: number;
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
  // Gender & mating stats
  maleCount?: number;
  femaleCount?: number;
  activeMatingPairs?: number;
  activeFights?: number;
}

/** Predator types - different hunting strategies */
export type PredatorType = 
  | 'hawk' | 'falcon' | 'eagle' | 'owl'           // Air predators
  | 'shark' | 'orca' | 'barracuda' | 'sea_lion';  // Ocean predators

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

