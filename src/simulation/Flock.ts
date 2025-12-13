/**
 * Flock Manager - Orchestrates the swarm simulation
 * Version: 1.0.0
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
  
  /** Statistics */
  private stats: ISimulationStats = {
    fps: 60,
    birdCount: 0,
    averageDensity: 0,
    averageVelocity: 0,
    simulationTime: 0,
    predatorState: 'idle'
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
   */
  private fixedUpdate(dt: number): void {
    // Step 1: Rebuild spatial grid
    this.spatialGrid.clear();
    this.spatialGrid.insertAll(this.birds);
    
    // Step 2: Update each bird
    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i];
      
      // Find neighbors using spatial grid
      const neighbors = this.spatialGrid.getNeighbors(
        bird,
        this.birds,
        this.config.perceptionRadius,
        this.config.fieldOfView
      );
      
      // Calculate swarm forces
      const swarmForce = this.rules.calculate(
        bird,
        neighbors,
        this.config,
        this.envConfig,
        this.simulationTime
      );
      bird.applyForce(swarmForce);
      
      // Apply wind force
      if (this.envConfig.windSpeed > 0) {
        const windForce = this.calculateWindForce(bird);
        bird.applyForce(windForce);
      }
      
      // Apply predator panic
      if (this.predatorPosition && this.envConfig.predatorEnabled) {
        const panicForce = this.rules.calculatePanicResponse(
          bird,
          this.predatorPosition,
          this.envConfig.panicRadius,
          this.config.maxForce * 2
        );
        bird.applyForce(panicForce);
        
        // Propagate panic to nearby birds
        if (bird.panicLevel > 0.3) {
          for (const neighbor of neighbors) {
            neighbor.applyPanic(bird.panicLevel * this.envConfig.panicDecay * 0.5);
          }
        }
      }
      
      // Apply attractor forces
      for (const attractor of this.attractors) {
        const attractorForce = this.rules.calculateAttractorForce(
          bird,
          new Vector2(attractor.position.x, attractor.position.y),
          attractor.strength,
          attractor.radius,
          attractor.isRepulsor,
          this.config.maxForce
        );
        bird.applyForce(attractorForce);
      }
      
      // Apply boundary avoidance
      bird.applyBoundaryForce(
        this.width,
        this.height,
        this.config.boundaryMargin,
        this.config.boundaryForce
      );
      
      // Update bird physics
      bird.update(dt, this.config);
    }
  }

  /**
   * Calculate wind force for a bird
   */
  private calculateWindForce(bird: Bird): Vector2 {
    const windAngle = this.envConfig.windDirection * Math.PI / 180;
    const baseWind = Vector2.fromAngle(windAngle, this.envConfig.windSpeed * 0.01);
    
    // Add turbulence based on position
    if (this.envConfig.windTurbulence > 0) {
      const turbulence = this.envConfig.windTurbulence;
      const nx = bird.position.x * 0.005 + this.simulationTime * 0.5;
      const ny = bird.position.y * 0.005;
      
      // Simple noise approximation for turbulence
      const turbX = Math.sin(nx * 2.5 + ny * 1.3) * turbulence * 0.3;
      const turbY = Math.cos(nx * 1.7 + ny * 2.1) * turbulence * 0.3;
      
      baseWind.x += turbX;
      baseWind.y += turbY;
    }
    
    return baseWind;
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

  /**
   * Set predator position
   */
  setPredatorPosition(position: Vector2 | null): void {
    this.predatorPosition = position;
    this.stats.predatorState = position ? 'hunting' : 'idle';
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
    
    for (const bird of this.birds) {
      totalVelocity += bird.speed;
      totalDensity += bird.localDensity;
    }
    
    this.stats.birdCount = this.birds.length;
    this.stats.averageVelocity = this.birds.length > 0
      ? totalVelocity / this.birds.length
      : 0;
    this.stats.averageDensity = this.birds.length > 0
      ? totalDensity / this.birds.length
      : 0;
    this.stats.simulationTime = this.simulationTime;
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
}

