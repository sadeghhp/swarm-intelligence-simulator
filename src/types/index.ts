/**
 * Core TypeScript interfaces for the Starling Swarm Simulator
 * Version: 1.0.0
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

/** Simulation configuration */
export interface ISimulationConfig {
  // Flock settings
  birdCount: number;
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
  
  // Simulation
  simulationSpeed: number;
  paused: boolean;
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
}

/** Statistics for display */
export interface ISimulationStats {
  fps: number;
  birdCount: number;
  averageDensity: number;
  averageVelocity: number;
  simulationTime: number;
  predatorState: 'idle' | 'hunting' | 'attacking';
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
  colorByDensity: boolean;
}

/** Default simulation configuration */
export const DEFAULT_SIMULATION_CONFIG: ISimulationConfig = {
  birdCount: 2000,
  maxSpeed: 15,
  maxForce: 0.5,
  perceptionRadius: 50,
  separationRadius: 25,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  separationWeight: 1.5,
  fieldOfView: 270,
  boundaryMargin: 100,
  boundaryForce: 0.8,
  simulationSpeed: 1.0,
  paused: false
};

/** Default environment configuration */
export const DEFAULT_ENVIRONMENT_CONFIG: IEnvironmentConfig = {
  windSpeed: 0,
  windDirection: 0,
  windTurbulence: 0.3,
  predatorEnabled: false,
  predatorSpeed: 18,
  predatorAggression: 0.5,
  panicRadius: 150,
  panicDecay: 0.95
};

/** Default rendering configuration */
export const DEFAULT_RENDERING_CONFIG: IRenderingConfig = {
  showTrails: false,
  trailLength: 5,
  showWindParticles: true,
  showPredatorRange: true,
  colorByDensity: true
};

