/**
 * Ecosystem Manager - Multi-species swarm simulation
 * Version: 1.0.0
 * 
 * Manages multiple species in a shared simulation environment.
 * Features:
 * - Multiple flocks with different behaviors
 * - Inter-species interactions (predator-prey)
 * - Species-specific rendering colors
 * - Configurable population dynamics
 */

import { Bird } from './Bird';
import { Flock } from './Flock';
import { SpatialGrid } from './SpatialGrid';
import { Vector2 } from '../utils/Vector2';
import type {
  ISimulationConfig,
  IEnvironmentConfig,
  CreaturePreset,
  ICreaturePreset
} from '../types';
import { getConfig } from '../config/ConfigLoader';

/** Species definition */
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
  species: ISpecies[];
  interactionRadius: number;
  huntingForce: number;
  fleeingForce: number;
}

/** Species runtime state */
interface ISpeciesState {
  species: ISpecies;
  birds: Bird[];
  config: ISimulationConfig;
  presetConfig: ICreaturePreset;
}

// Pre-allocated vectors for calculations
const tempHuntForce = new Vector2();
const tempFleeForce = new Vector2();

export class Ecosystem {
  /** All species states */
  private speciesStates: Map<string, ISpeciesState> = new Map();
  
  /** Spatial grid for inter-species queries */
  private spatialGrid: SpatialGrid;
  
  /** Simulation dimensions */
  private width: number;
  private height: number;
  
  /** Bird ID counter */
  private birdIdCounter: number = 0;
  
  /** Default ecosystem config */
  private ecosystemConfig: IEcosystemConfig = {
    species: [],
    interactionRadius: 150,
    huntingForce: 0.8,
    fleeingForce: 1.5
  };
  
  /** Loaded creature presets */
  private presets: Record<CreaturePreset, ICreaturePreset>;
  
  /** Base configs */
  private baseSimConfig: ISimulationConfig;
  private envConfig: IEnvironmentConfig;

  constructor(
    width: number,
    height: number,
    simConfig: ISimulationConfig,
    envConfig: IEnvironmentConfig
  ) {
    this.width = width;
    this.height = height;
    this.baseSimConfig = simConfig;
    this.envConfig = envConfig;
    
    // Load presets
    this.presets = getConfig().creaturePresets;
    
    // Create spatial grid for inter-species interactions
    this.spatialGrid = new SpatialGrid(width, height, this.ecosystemConfig.interactionRadius);
  }

  /**
   * Initialize ecosystem with default species
   */
  initialize(): void {
    // Start with the default species from base config
    this.addSpecies({
      id: 'default',
      preset: this.baseSimConfig.creaturePreset,
      count: this.baseSimConfig.birdCount,
      preyOn: [],
      avoidSpecies: [],
      active: true
    });
  }

  /**
   * Add a new species to the ecosystem
   */
  addSpecies(species: ISpecies): void {
    if (this.speciesStates.has(species.id)) {
      console.warn(`Species "${species.id}" already exists`);
      return;
    }
    
    // Get preset configuration
    const presetConfig = this.presets[species.preset] || this.presets['custom'];
    
    // Create simulation config for this species based on preset
    const speciesSimConfig: ISimulationConfig = {
      ...this.baseSimConfig,
      creaturePreset: species.preset,
      birdCount: species.count,
      particleSize: presetConfig.particleSize,
      maxSpeed: presetConfig.maxSpeed,
      maxForce: presetConfig.maxForce,
      perceptionRadius: presetConfig.perceptionRadius,
      separationRadius: presetConfig.separationRadius,
      alignmentWeight: presetConfig.alignmentWeight,
      cohesionWeight: presetConfig.cohesionWeight,
      separationWeight: presetConfig.separationWeight,
      fieldOfView: presetConfig.fieldOfView
    };
    
    // Create birds for this species
    const birds = this.createBirds(species.id, species.count);
    
    // Store species state
    this.speciesStates.set(species.id, {
      species,
      birds,
      config: speciesSimConfig,
      presetConfig
    });
    
    // Add to ecosystem config
    this.ecosystemConfig.species.push(species);
    
    console.log(`🦋 Added species: ${species.id} (${species.preset}) with ${species.count} creatures`);
  }

  /**
   * Remove a species from the ecosystem
   */
  removeSpecies(speciesId: string): void {
    if (!this.speciesStates.has(speciesId)) {
      console.warn(`Species "${speciesId}" not found`);
      return;
    }
    
    this.speciesStates.delete(speciesId);
    this.ecosystemConfig.species = this.ecosystemConfig.species.filter(s => s.id !== speciesId);
    
    console.log(`🗑️ Removed species: ${speciesId}`);
  }

  /**
   * Set species count (add or remove birds)
   */
  setSpeciesCount(speciesId: string, count: number): void {
    const state = this.speciesStates.get(speciesId);
    if (!state) return;
    
    const currentCount = state.birds.length;
    
    if (count > currentCount) {
      // Add new birds
      const newBirds = this.createBirds(speciesId, count - currentCount);
      state.birds.push(...newBirds);
    } else if (count < currentCount) {
      // Remove birds from the end
      state.birds.length = count;
    }
    
    state.species.count = count;
    state.config.birdCount = count;
  }

  /**
   * Create birds for a species
   */
  private createBirds(speciesId: string, count: number): Bird[] {
    const birds: Bird[] = [];
    const margin = 200;
    const spawnWidth = this.width - margin * 2;
    const spawnHeight = this.height - margin * 2;
    
    for (let i = 0; i < count; i++) {
      const x = margin + Math.random() * spawnWidth;
      const y = margin + Math.random() * spawnHeight;
      const bird = new Bird(this.birdIdCounter++, x, y);
      bird.speciesId = speciesId;
      birds.push(bird);
    }
    
    return birds;
  }

  /**
   * Get all birds from all species
   */
  getAllBirds(): Bird[] {
    const allBirds: Bird[] = [];
    for (const state of this.speciesStates.values()) {
      if (state.species.active) {
        allBirds.push(...state.birds);
      }
    }
    return allBirds;
  }

  /**
   * Get birds of a specific species
   */
  getSpeciesBirds(speciesId: string): Bird[] {
    return this.speciesStates.get(speciesId)?.birds || [];
  }

  /**
   * Get species state
   */
  getSpeciesState(speciesId: string): ISpeciesState | undefined {
    return this.speciesStates.get(speciesId);
  }

  /**
   * Get all active species
   */
  getActiveSpecies(): ISpecies[] {
    return Array.from(this.speciesStates.values())
      .filter(state => state.species.active)
      .map(state => state.species);
  }

  /**
   * Get preset config for a species
   */
  getSpeciesPreset(speciesId: string): ICreaturePreset | undefined {
    return this.speciesStates.get(speciesId)?.presetConfig;
  }

  /**
   * Find prey within hunting radius
   */
  findPrey(hunter: Bird, preySpecies: string[], radius: number): Bird[] {
    const prey: Bird[] = [];
    const radiusSq = radius * radius;
    
    for (const preyId of preySpecies) {
      const preyBirds = this.getSpeciesBirds(preyId);
      
      for (const bird of preyBirds) {
        const dx = bird.position.x - hunter.position.x;
        const dy = bird.position.y - hunter.position.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < radiusSq && distSq > 0) {
          prey.push(bird);
        }
      }
    }
    
    return prey;
  }

  /**
   * Find predators within flee radius
   */
  findPredators(prey: Bird, predatorSpecies: string[], radius: number): Bird[] {
    const predators: Bird[] = [];
    const radiusSq = radius * radius;
    
    // Also need to find species that prey on this bird's species
    for (const state of this.speciesStates.values()) {
      if (state.species.preyOn.includes(prey.speciesId) || predatorSpecies.includes(state.species.id)) {
        for (const bird of state.birds) {
          const dx = bird.position.x - prey.position.x;
          const dy = bird.position.y - prey.position.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq < radiusSq && distSq > 0) {
            predators.push(bird);
          }
        }
      }
    }
    
    return predators;
  }

  /**
   * Calculate hunting force toward nearest prey
   */
  calculateHuntingForce(
    hunter: Bird,
    prey: Bird[],
    force: number,
    outForce: Vector2
  ): boolean {
    outForce.x = 0;
    outForce.y = 0;
    
    if (prey.length === 0) return false;
    
    // Find nearest prey
    let nearestPrey: Bird | null = null;
    let nearestDistSq = Infinity;
    
    for (const p of prey) {
      const dx = p.position.x - hunter.position.x;
      const dy = p.position.y - hunter.position.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestPrey = p;
      }
    }
    
    if (nearestPrey) {
      const dist = Math.sqrt(nearestDistSq);
      if (dist > 0) {
        outForce.x = ((nearestPrey.position.x - hunter.position.x) / dist) * force;
        outForce.y = ((nearestPrey.position.y - hunter.position.y) / dist) * force;
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate fleeing force away from predators
   */
  calculateFleeingForce(
    prey: Bird,
    predators: Bird[],
    force: number,
    radius: number,
    outForce: Vector2
  ): boolean {
    outForce.x = 0;
    outForce.y = 0;
    
    if (predators.length === 0) return false;
    
    let count = 0;
    
    for (const predator of predators) {
      const dx = prey.position.x - predator.position.x;
      const dy = prey.position.y - predator.position.y;
      const distSq = dx * dx + dy * dy;
      const radiusSq = radius * radius;
      
      if (distSq < radiusSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const factor = (1 - dist / radius) * force;
        
        outForce.x += (dx / dist) * factor;
        outForce.y += (dy / dist) * factor;
        count++;
      }
    }
    
    if (count > 0) {
      outForce.x /= count;
      outForce.y /= count;
      return true;
    }
    
    return false;
  }

  /**
   * Check for successful hunt (capture prey)
   * Returns true if prey was caught and removed
   */
  tryCapturePrey(hunter: Bird, captureRadius: number = 15): Bird | null {
    const state = this.speciesStates.get(hunter.speciesId);
    if (!state || state.species.preyOn.length === 0) return null;
    
    const captureRadiusSq = captureRadius * captureRadius;
    
    for (const preySpeciesId of state.species.preyOn) {
      const preyState = this.speciesStates.get(preySpeciesId);
      if (!preyState) continue;
      
      for (let i = preyState.birds.length - 1; i >= 0; i--) {
        const prey = preyState.birds[i];
        const dx = prey.position.x - hunter.position.x;
        const dy = prey.position.y - hunter.position.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < captureRadiusSq) {
          // Remove prey
          preyState.birds.splice(i, 1);
          preyState.species.count = preyState.birds.length;
          
          // Restore hunter energy
          hunter.restoreEnergy(0.3);
          
          return prey;
        }
      }
    }
    
    return null;
  }

  /**
   * Respawn prey that was captured
   */
  respawnPrey(speciesId: string, count: number = 1): void {
    const state = this.speciesStates.get(speciesId);
    if (!state) return;
    
    const newBirds = this.createBirds(speciesId, count);
    state.birds.push(...newBirds);
    state.species.count = state.birds.length;
  }

  /**
   * Toggle species active state
   */
  setSpeciesActive(speciesId: string, active: boolean): void {
    const state = this.speciesStates.get(speciesId);
    if (state) {
      state.species.active = active;
    }
  }

  /**
   * Get ecosystem config
   */
  getConfig(): IEcosystemConfig {
    return this.ecosystemConfig;
  }

  /**
   * Set ecosystem config
   */
  setConfig(config: Partial<IEcosystemConfig>): void {
    Object.assign(this.ecosystemConfig, config);
  }

  /**
   * Get total bird count across all species
   */
  getTotalCount(): number {
    let total = 0;
    for (const state of this.speciesStates.values()) {
      if (state.species.active) {
        total += state.birds.length;
      }
    }
    return total;
  }

  /**
   * Get species count
   */
  getSpeciesCount(): number {
    return this.speciesStates.size;
  }

  /**
   * Resize simulation area
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.spatialGrid.resize(width, height);
  }

  /**
   * Reset all species to initial counts
   */
  reset(): void {
    for (const state of this.speciesStates.values()) {
      // Clear and recreate birds
      state.birds = this.createBirds(state.species.id, state.config.birdCount);
      state.species.count = state.config.birdCount;
    }
    this.birdIdCounter = 0;
  }

  /**
   * Clear all species
   */
  clear(): void {
    this.speciesStates.clear();
    this.ecosystemConfig.species = [];
    this.birdIdCounter = 0;
  }
}


