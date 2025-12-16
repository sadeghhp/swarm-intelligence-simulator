/**
 * Configuration Loader - Loads settings from external JSON file
 * Version: 1.0.0
 * 
 * Loads simulation configuration from /config.json at startup.
 * Provides fallback defaults if the file cannot be loaded.
 * Supports hex color strings in JSON that get converted to numbers.
 */

import type {
  ISimulationConfig,
  IEnvironmentConfig,
  IRenderingConfig,
  ICreaturePreset,
  CreaturePreset
} from '../types';

/** Raw JSON configuration structure */
interface IRawConfig {
  version: string;
  simulation: ISimulationConfig;
  environment: IEnvironmentConfig;
  rendering: Omit<IRenderingConfig, 'baseColor' | 'denseColor' | 'panicColor'> & {
    baseColor: string;
    denseColor: string;
    panicColor: string;
  };
  creaturePresets: Record<string, Omit<ICreaturePreset, 'baseColor' | 'denseColor' | 'panicColor'> & {
    baseColor: string;
    denseColor: string;
    panicColor: string;
  }>;
}

/** Loaded configuration */
export interface ILoadedConfig {
  version: string;
  simulation: ISimulationConfig;
  environment: IEnvironmentConfig;
  rendering: IRenderingConfig;
  creaturePresets: Record<CreaturePreset, ICreaturePreset>;
}

/** Hardcoded fallback defaults (used if JSON fails to load) */
const FALLBACK_SIMULATION: ISimulationConfig = {
  creaturePreset: 'starlings',
  birdCount: 2000,
  particleSize: 1.0,
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
  wrapEdges: false,
  simulationSpeed: 1.0,
  paused: false,
  noiseStrength: 0.05,
  wanderStrength: 0.1,
  energyEnabled: false,
  energyDecayRate: 0.02,
  minEnergySpeed: 0.3,
  foodEnergyRestore: 0.3
};

const FALLBACK_ENVIRONMENT: IEnvironmentConfig = {
  windSpeed: 0,
  windDirection: 0,
  windTurbulence: 0.3,
  predatorEnabled: true,
  predatorType: 'hawk',
  predatorCount: 1,
  predatorSpeed: 22,
  predatorAggression: 0.7,
  panicRadius: 150,
  panicDecay: 0.95,
  foodEnabled: false,
  foodCount: 5,
  foodAttractionStrength: 1.0,
  foodAttractionRadius: 200,
  foodRespawnTime: 10,
  feedingBehavior: 'gather',
  gatherRadius: 50,
  feedingDuration: 2,
  maxFeedersPerFood: 20,
  consumptionPerFeeder: 1,
  huntingEnabled: false,
  huntingSpeed: 12,
  huntingRadius: 100,
  // Mating & competition behavior
  matingEnabled: false,
  mateSearchRadius: 80,
  mateAttractionStrength: 1.0,
  courtingDistance: 30,
  matingDistance: 15,
  matingDuration: 3,
  matingCooldown: 10,
  fightRadius: 50,
  fightDuration: 2,
  fightStrength: 0.8,
  panicSuppressesMating: true,
  energyThresholdForMating: 0.5,
  femaleSelectivity: 0.3
};

const FALLBACK_RENDERING: IRenderingConfig = {
  showTrails: false,
  trailLength: 5,
  showWindParticles: true,
  showPredatorRange: true,
  showFoodSources: true,
  colorByDensity: true,
  colorBySpeed: false,
  particleShape: 'arrow',
  baseColor: 0x00d4ff,
  denseColor: 0x8b5cf6,
  panicColor: 0xff3366,
  glowEnabled: false,
  glowIntensity: 0.5,
  motionBlur: false
};

const FALLBACK_PRESETS: Record<CreaturePreset, ICreaturePreset> = {
  starlings: {
    name: 'Starlings',
    description: 'Classic murmuration behavior',
    particleSize: 1.0,
    maxSpeed: 15,
    maxForce: 0.5,
    perceptionRadius: 50,
    separationRadius: 25,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    separationWeight: 1.5,
    fieldOfView: 270,
    baseColor: 0x00d4ff,
    denseColor: 0x8b5cf6,
    panicColor: 0xff3366,
    glowEnabled: false,
    glowIntensity: 0
  },
  insects: {
    name: 'Insects',
    description: 'Fast, erratic swarm behavior',
    particleSize: 0.5,
    maxSpeed: 25,
    maxForce: 1.2,
    perceptionRadius: 30,
    separationRadius: 15,
    alignmentWeight: 0.5,
    cohesionWeight: 1.5,
    separationWeight: 2.0,
    fieldOfView: 360,
    baseColor: 0xcc8800,
    denseColor: 0x8b6914,
    panicColor: 0xff4400,
    glowEnabled: false,
    glowIntensity: 0
  },
  fish: {
    name: 'Fish School',
    description: 'Smooth, flowing school behavior',
    particleSize: 0.8,
    maxSpeed: 10,
    maxForce: 0.3,
    perceptionRadius: 60,
    separationRadius: 20,
    alignmentWeight: 1.5,
    cohesionWeight: 1.2,
    separationWeight: 1.0,
    fieldOfView: 300,
    baseColor: 0x00ffcc,
    denseColor: 0x0088ff,
    panicColor: 0xff6600,
    glowEnabled: false,
    glowIntensity: 0
  },
  bats: {
    name: 'Bats',
    description: 'Nocturnal cave swarm',
    particleSize: 1.2,
    maxSpeed: 20,
    maxForce: 0.8,
    perceptionRadius: 40,
    separationRadius: 30,
    alignmentWeight: 0.8,
    cohesionWeight: 0.6,
    separationWeight: 2.0,
    fieldOfView: 180,
    baseColor: 0x9966ff,
    denseColor: 0x6633cc,
    panicColor: 0xff3399,
    glowEnabled: false,
    glowIntensity: 0
  },
  fireflies: {
    name: 'Fireflies',
    description: 'Glowing, drifting swarm',
    particleSize: 0.6,
    maxSpeed: 5,
    maxForce: 0.2,
    perceptionRadius: 80,
    separationRadius: 40,
    alignmentWeight: 0.3,
    cohesionWeight: 0.5,
    separationWeight: 1.0,
    fieldOfView: 360,
    baseColor: 0xccff44,
    denseColor: 0xaaff00,
    panicColor: 0xffaa22,
    glowEnabled: true,
    glowIntensity: 0.8
  },
  ants: {
    name: 'Ants',
    description: 'Trail-following foraging behavior',
    particleSize: 0.4,
    maxSpeed: 8,
    maxForce: 0.6,
    perceptionRadius: 25,
    separationRadius: 8,
    alignmentWeight: 0.3,
    cohesionWeight: 2.5,
    separationWeight: 2.5,
    fieldOfView: 90,
    baseColor: 0x8B4513,
    denseColor: 0x654321,
    panicColor: 0xFF4500,
    glowEnabled: false,
    glowIntensity: 0
  },
  locusts: {
    name: 'Locusts',
    description: 'Dense, aggressive swarm',
    particleSize: 0.7,
    maxSpeed: 30,
    maxForce: 1.5,
    perceptionRadius: 35,
    separationRadius: 10,
    alignmentWeight: 1.8,
    cohesionWeight: 2.0,
    separationWeight: 0.5,
    fieldOfView: 360,
    baseColor: 0x9ACD32,
    denseColor: 0x228B22,
    panicColor: 0xFF6347,
    glowEnabled: false,
    glowIntensity: 0
  },
  jellyfish: {
    name: 'Jellyfish',
    description: 'Drifting, pulsing movement',
    particleSize: 1.5,
    maxSpeed: 3,
    maxForce: 0.1,
    perceptionRadius: 100,
    separationRadius: 50,
    alignmentWeight: 0.2,
    cohesionWeight: 0.3,
    separationWeight: 0.8,
    fieldOfView: 360,
    baseColor: 0x88aaff,
    denseColor: 0xaa88ff,
    panicColor: 0xff88aa,
    glowEnabled: true,
    glowIntensity: 0.6
  },
  sparrows: {
    name: 'Sparrows',
    description: 'Chaotic small bird flock',
    particleSize: 0.9,
    maxSpeed: 18,
    maxForce: 0.7,
    perceptionRadius: 45,
    separationRadius: 20,
    alignmentWeight: 0.6,
    cohesionWeight: 0.8,
    separationWeight: 1.8,
    fieldOfView: 270,
    baseColor: 0x8B7355,
    denseColor: 0x654321,
    panicColor: 0xFF4500,
    glowEnabled: false,
    glowIntensity: 0
  },
  plankton: {
    name: 'Plankton',
    description: 'Microscopic organisms',
    particleSize: 0.3,
    maxSpeed: 6,
    maxForce: 0.8,
    perceptionRadius: 15,
    separationRadius: 12,
    alignmentWeight: 0.1,
    cohesionWeight: 0.4,
    separationWeight: 3.0,
    fieldOfView: 360,
    baseColor: 0x00CED1,
    denseColor: 0x20B2AA,
    panicColor: 0x48D1CC,
    glowEnabled: false,
    glowIntensity: 0
  },
  herring: {
    name: 'Atlantic Herring',
    description: 'Tight, highly coordinated schooling behavior',
    particleSize: 0.7,
    maxSpeed: 12,
    maxForce: 0.4,
    perceptionRadius: 70,
    separationRadius: 15,
    alignmentWeight: 1.8,
    cohesionWeight: 1.4,
    separationWeight: 1.2,
    fieldOfView: 300,
    baseColor: 0x6B8FAD,
    denseColor: 0x4A6D8C,
    panicColor: 0xC0C0C0,
    glowEnabled: false,
    glowIntensity: 0
  },
  custom: {
    name: 'Custom',
    description: 'User-defined settings',
    particleSize: 1.0,
    maxSpeed: 15,
    maxForce: 0.5,
    perceptionRadius: 50,
    separationRadius: 25,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    separationWeight: 1.5,
    fieldOfView: 270,
    baseColor: 0x00d4ff,
    denseColor: 0x8b5cf6,
    panicColor: 0xff3366,
    glowEnabled: false,
    glowIntensity: 0
  }
};

/**
 * Parse hex color string to number
 * Supports "#RRGGBB" and "0xRRGGBB" formats
 */
function parseColor(color: string | number): number {
  if (typeof color === 'number') {
    return color;
  }
  
  // Remove # prefix if present
  const hex = color.startsWith('#') ? color.slice(1) : color.replace('0x', '');
  return parseInt(hex, 16);
}

/**
 * Convert raw preset with string colors to preset with number colors
 */
function convertPreset(raw: IRawConfig['creaturePresets'][string]): ICreaturePreset {
  return {
    ...raw,
    baseColor: parseColor(raw.baseColor),
    denseColor: parseColor(raw.denseColor),
    panicColor: parseColor(raw.panicColor)
  };
}

/**
 * Convert raw rendering config with string colors to config with number colors
 */
function convertRendering(raw: IRawConfig['rendering']): IRenderingConfig {
  return {
    ...raw,
    baseColor: parseColor(raw.baseColor),
    denseColor: parseColor(raw.denseColor),
    panicColor: parseColor(raw.panicColor)
  };
}

/**
 * Load configuration from JSON file
 */
export async function loadConfig(configPath: string = '/config.json'): Promise<ILoadedConfig> {
  try {
    const response = await fetch(configPath);
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to load config from ${configPath}: ${response.status}`);
      return getFallbackConfig();
    }
    
    const rawConfig: IRawConfig = await response.json();
    
    console.log(`📋 Loaded config v${rawConfig.version} from ${configPath}`);
    
    // Convert colors and presets
    const creaturePresets: Record<CreaturePreset, ICreaturePreset> = {} as Record<CreaturePreset, ICreaturePreset>;
    for (const [key, preset] of Object.entries(rawConfig.creaturePresets)) {
      creaturePresets[key as CreaturePreset] = convertPreset(preset);
    }
    
    return {
      version: rawConfig.version,
      simulation: rawConfig.simulation,
      environment: rawConfig.environment,
      rendering: convertRendering(rawConfig.rendering),
      creaturePresets
    };
    
  } catch (error) {
    console.warn(`⚠️ Error loading config: ${error}`);
    return getFallbackConfig();
  }
}

/**
 * Get fallback configuration (used when JSON fails to load)
 */
export function getFallbackConfig(): ILoadedConfig {
  console.log('📋 Using fallback configuration');
  return {
    version: '1.2.0-fallback',
    simulation: { ...FALLBACK_SIMULATION },
    environment: { ...FALLBACK_ENVIRONMENT },
    rendering: { ...FALLBACK_RENDERING },
    creaturePresets: { ...FALLBACK_PRESETS }
  };
}

/**
 * Global config instance (set after loading)
 */
let loadedConfig: ILoadedConfig | null = null;

/**
 * Get the loaded configuration (must call loadConfig first)
 */
export function getConfig(): ILoadedConfig {
  if (!loadedConfig) {
    loadedConfig = getFallbackConfig();
  }
  return loadedConfig;
}

/**
 * Set the loaded configuration
 */
export function setConfig(config: ILoadedConfig): void {
  loadedConfig = config;
}



