/**
 * Flock Manager - Orchestrates the swarm simulation
 * Version: 1.1.0 - Added energy system integration
 * 
 * Responsibilities:
 * - Manages all bird instances
 * - Runs the simulation update loop
 * - Coordinates spatial partitioning
 * - Applies environmental forces
 * - Tracks simulation statistics
 * 
 * The update loop follows this order each frame:
 * 1. Clear and rebuild spatial grid
 * 2. For each bird:
 *    a. Find neighbors using spatial grid
 *    b. Calculate swarm forces (alignment, cohesion, separation)
 *    c. Apply environmental forces (wind, predator, attractors)
 *    d. Apply boundary forces
 *    e. Update bird physics
 * 3. Update statistics
 */

import { Bird } from './Bird';
import { SpatialGrid } from './SpatialGrid';
import { SwarmRules } from './SwarmRules';
import { Vector2 } from '../utils/Vector2';
import type {
  ISimulationConfig,
  IEnvironmentConfig,
  ISimulationStats,
  IAttractor
} from '../types';
import { FoodSourceManager } from '../environment/FoodSource';

// Pre-allocated vectors for simulation loop (avoid GC pressure)
const tempSwarmForce = new Vector2();
const tempPanicForce = new Vector2();
const tempAttractorForce = new Vector2();
const tempWindForce = new Vector2();
const tempFoodForce = new Vector2();

export class Flock {
  /** All birds in the flock */
  public birds: Bird[] = [];
  
  /** Spatial partitioning grid */
  private spatialGrid: SpatialGrid;
  
  /** Swarm behavior rules engine */
  private rules: SwarmRules;
  
  /** Simulation dimensions */
  private width: number;
  private height: number;
  
  /** Simulation time (seconds) */
  private simulationTime: number = 0;
  
  /** Frame time accumulator for fixed timestep */
  private accumulator: number = 0;
  
  /** Fixed timestep for physics (60 updates per second) */
  private readonly fixedDeltaTime: number = 1 / 60;
  
  /** Current configuration */
  public config: ISimulationConfig;
  public envConfig: IEnvironmentConfig;
  
  /** Active attractors */
  private attractors: IAttractor[] = [];
  private attractorIdCounter: number = 0;
  
  /** Predator state */
  private predatorPosition: Vector2 | null = null;
  
  /** Food source manager reference (optional, set externally) */
  private foodManager: FoodSourceManager | null = null;
  
  /** Statistics */
  private stats: ISimulationStats = {
    fps: 60,
    birdCount: 0,
    averageDensity: 0,
    averageVelocity: 0,
    averageEnergy: 1.0,
    simulationTime: 0,
    predatorState: 'idle',
    activePredators: 0,
    foodConsumed: 0,
    activeFood: 0
  };

  constructor(
    width: number,
    height: number,
    config: ISimulationConfig,
    envConfig: IEnvironmentConfig
  ) {
    this.width = width;
    this.height = height;
    this.config = config;
    this.envConfig = envConfig;
    
    // Initialize spatial grid with cell size matching perception radius
    this.spatialGrid = new SpatialGrid(width, height, config.perceptionRadius);
    
    // Initialize rules engine
    this.rules = new SwarmRules();
    
    // Create initial birds
    this.initializeBirds(config.birdCount);
  }

  /**
   * Initialize birds with random positions
   */
  private initializeBirds(count: number): void {
    this.birds = [];
    
    // Spawn birds in a central area (not at edges)
    const margin = 200;
    const spawnWidth = this.width - margin * 2;
    const spawnHeight = this.height - margin * 2;
    
    for (let i = 0; i < count; i++) {
      const x = margin + Math.random() * spawnWidth;
      const y = margin + Math.random() * spawnHeight;
      this.birds.push(new Bird(i, x, y));
    }
    
    this.stats.birdCount = count;
  }

  /**
   * Update bird count (add or remove birds)
   */
  setBirdCount(count: number): void {
    const currentCount = this.birds.length;
    
    if (count > currentCount) {
      // Add new birds
      const margin = 200;
      const spawnWidth = this.width - margin * 2;
      const spawnHeight = this.height - margin * 2;
      
      for (let i = currentCount; i < count; i++) {
        const x = margin + Math.random() * spawnWidth;
        const y = margin + Math.random() * spawnHeight;
        this.birds.push(new Bird(i, x, y));
      }
    } else if (count < currentCount) {
      // Remove birds from the end
      this.birds.length = count;
    }
    
    this.stats.birdCount = count;
  }

  /**
   * Main simulation update
   * Uses fixed timestep for consistent physics
   */
  update(deltaTime: number): void {
    if (this.config.paused) return;
    
    // Clamp delta time to prevent spiral of death
    deltaTime = Math.min(deltaTime, 0.1);
    
    // Accumulate time
    this.accumulator += deltaTime * this.config.simulationSpeed;
    
    // Update rules engine (noise time)
    this.rules.update(deltaTime);
    
    // Fixed timestep updates
    while (this.accumulator >= this.fixedDeltaTime) {
      this.fixedUpdate(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
      this.simulationTime += this.fixedDeltaTime;
    }
    
    // Update attractors (decay)
    this.updateAttractors(deltaTime);
    
    // Update statistics
    this.updateStats();
  }

  /**
   * Fixed timestep physics update
   * PERFORMANCE: Zero allocations in hot loop
   */
  private fixedUpdate(dt: number): void {
    // Step 1: Rebuild spatial grid
    this.spatialGrid.clear();
    this.spatialGrid.insertAll(this.birds);
    
    const birdsLen = this.birds.length;
    const attractorsLen = this.attractors.length;
    const hasPredator = this.predatorPosition && this.envConfig.predatorEnabled;
    const hasWind = this.envConfig.windSpeed > 0;
    
    // Step 2: Update each bird
    for (let i = 0; i < birdsLen; i++) {
      const bird = this.birds[i];
      
      // Find neighbors using spatial grid (returns view into buffer)
      const neighbors = this.spatialGrid.getNeighbors(
        bird,
        this.birds,
        this.config.perceptionRadius,
        this.config.fieldOfView
      );
      
      // Calculate swarm forces (result stored in tempSwarmForce)
      this.rules.calculate(
        bird,
        neighbors,
        this.config,
        this.envConfig,
        this.simulationTime,
        tempSwarmForce
      );
      bird.applyForce(tempSwarmForce);
      
      // Apply wind force
      if (hasWind) {
        this.calculateWindForce(bird, tempWindForce);
        bird.applyForce(tempWindForce);
      }
      
      // Apply predator panic using predator's actual panic radius
      if (hasPredator) {
        this.rules.calculatePanicResponse(
          bird,
          this.predatorPosition!,
          this.predatorPanicRadius,
          this.config.maxForce * 2,
          tempPanicForce
        );
        bird.applyForce(tempPanicForce);
        
        // Propagate panic to nearby birds
        if (bird.panicLevel > 0.3) {
          const neighborsLen = neighbors.length;
          const panicSpread = bird.panicLevel * this.envConfig.panicDecay * 0.5;
          for (let j = 0; j < neighborsLen; j++) {
            neighbors[j].applyPanic(panicSpread);
          }
        }
      }
      
      // Apply attractor forces
      for (let j = 0; j < attractorsLen; j++) {
        const attractor = this.attractors[j];
        this.rules.calculateAttractorForce(
          bird,
          attractor.position.x,
          attractor.position.y,
          attractor.strength,
          attractor.radius,
          attractor.isRepulsor,
          this.config.maxForce,
          tempAttractorForce
        );
        bird.applyForce(tempAttractorForce);
      }
      
      // Apply boundary avoidance
      bird.applyBoundaryForce(
        this.width,
        this.height,
        this.config.boundaryMargin,
        this.config.boundaryForce
      );
      
      // Energy-based food seeking (hungry creatures seek food more)
      if (this.config.energyEnabled && this.foodManager && this.envConfig.foodEnabled) {
        // Low energy creatures are more attracted to food
        const energyUrgency = 1 - bird.energy; // 0 when full, 1 when empty
        if (energyUrgency > 0.3) {
          const foodStrength = this.envConfig.foodAttractionStrength * (1 + energyUrgency * 2);
          const hasFood = this.foodManager.getAttractionForce(
            bird.position,
            foodStrength,
            this.envConfig.foodAttractionRadius,
            tempFoodForce
          );
          if (hasFood) {
            bird.applyForce(tempFoodForce);
          }
        }
        
        // Check for food consumption and restore energy
        const energyRestored = this.foodManager.consume(
          bird.position,
          1,
          this.config.foodEnergyRestore
        );
        if (energyRestored > 0) {
          bird.restoreEnergy(energyRestored);
        }
      }
      
      // Update bird physics (with energy parameters)
      bird.update(
        dt,
        this.config,
        this.config.energyEnabled,
        this.config.energyDecayRate,
        this.config.minEnergySpeed
      );
    }
  }

  /**
   * Calculate wind force for a bird
   * PERFORMANCE: Uses output parameter, zero allocations
   */
  private calculateWindForce(bird: Bird, outForce: Vector2): void {
    const windAngle = this.envConfig.windDirection * Math.PI / 180;
    const windMag = this.envConfig.windSpeed * 0.01;
    
    outForce.x = Math.cos(windAngle) * windMag;
    outForce.y = Math.sin(windAngle) * windMag;
    
    // Add turbulence based on position
    if (this.envConfig.windTurbulence > 0) {
      const turbulence = this.envConfig.windTurbulence;
      const nx = bird.position.x * 0.005 + this.simulationTime * 0.5;
      const ny = bird.position.y * 0.005;
      
      // Simple noise approximation for turbulence
      outForce.x += Math.sin(nx * 2.5 + ny * 1.3) * turbulence * 0.3;
      outForce.y += Math.cos(nx * 1.7 + ny * 2.1) * turbulence * 0.3;
    }
  }

  /**
   * Update attractor lifetimes and remove expired ones
   */
  private updateAttractors(deltaTime: number): void {
    for (let i = this.attractors.length - 1; i >= 0; i--) {
      this.attractors[i].lifetime -= deltaTime;
      if (this.attractors[i].lifetime <= 0) {
        this.attractors.splice(i, 1);
      }
    }
  }

  /**
   * Add an attractor or repulsor
   */
  addAttractor(
    x: number,
    y: number,
    strength: number,
    radius: number,
    lifetime: number,
    isRepulsor: boolean
  ): number {
    const id = this.attractorIdCounter++;
    this.attractors.push({
      id,
      position: { x, y },
      strength,
      radius,
      lifetime,
      maxLifetime: lifetime,
      isRepulsor
    });
    return id;
  }

  /**
   * Remove an attractor by id
   */
  removeAttractor(id: number): void {
    const index = this.attractors.findIndex(a => a.id === id);
    if (index !== -1) {
      this.attractors.splice(index, 1);
    }
  }

  /**
   * Get active attractors (for rendering)
   */
  getAttractors(): IAttractor[] {
    return this.attractors;
  }

  /** Predator's actual panic radius (from predator type) */
  private predatorPanicRadius: number = 150;

  /**
   * Set predator position and panic radius
   */
  setPredatorPosition(position: Vector2 | null, panicRadius?: number): void {
    this.predatorPosition = position;
    this.stats.predatorState = position ? 'hunting' : 'idle';
    if (panicRadius !== undefined) {
      this.predatorPanicRadius = panicRadius;
    }
  }

  /**
   * Get predator position
   */
  getPredatorPosition(): Vector2 | null {
    return this.predatorPosition;
  }

  /**
   * Update simulation statistics
   */
  private updateStats(): void {
    let totalVelocity = 0;
    let totalDensity = 0;
    let totalEnergy = 0;
    
    for (const bird of this.birds) {
      totalVelocity += bird.speed;
      totalDensity += bird.localDensity;
      totalEnergy += bird.energy;
    }
    
    this.stats.birdCount = this.birds.length;
    this.stats.averageVelocity = this.birds.length > 0
      ? totalVelocity / this.birds.length
      : 0;
    this.stats.averageDensity = this.birds.length > 0
      ? totalDensity / this.birds.length
      : 0;
    this.stats.averageEnergy = this.birds.length > 0
      ? totalEnergy / this.birds.length
      : 1.0;
    this.stats.simulationTime = this.simulationTime;
    
    // Update food stats if manager is set
    if (this.foodManager) {
      this.stats.foodConsumed = this.foodManager.totalConsumed;
      this.stats.activeFood = this.foodManager.getActiveCount();
    }
  }

  /**
   * Get current statistics
   */
  getStats(): ISimulationStats {
    return { ...this.stats };
  }

  /**
   * Update FPS in statistics (called by render loop)
   */
  setFPS(fps: number): void {
    this.stats.fps = fps;
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
   * Update perception radius (also updates spatial grid)
   */
  setPerceptionRadius(radius: number): void {
    this.config.perceptionRadius = radius;
    this.spatialGrid.setCellSize(radius);
  }

  /**
   * Reset simulation
   */
  reset(): void {
    this.initializeBirds(this.config.birdCount);
    this.attractors = [];
    this.predatorPosition = null;
    this.simulationTime = 0;
    this.accumulator = 0;
    this.stats.predatorState = 'idle';
  }

  /**
   * Get simulation dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Get simulation time
   */
  getSimulationTime(): number {
    return this.simulationTime;
  }
  
  /**
   * Set food source manager for energy integration
   */
  setFoodManager(manager: FoodSourceManager): void {
    this.foodManager = manager;
  }
  
  /**
   * Get all birds (for external access)
   */
  getBirds(): Bird[] {
    return this.birds;
  }
}

