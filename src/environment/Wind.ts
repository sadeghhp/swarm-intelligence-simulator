/**
 * Wind System - Environmental force field
 * Version: 1.0.0
 * 
 * Simulates wind as a directional force affecting all birds.
 * Features:
 * - Configurable direction and speed
 * - Perlin noise-based turbulence for gusts
 * - Position-based variation (different wind at different locations)
 */

import { Vector2 } from '../utils/Vector2';
import { fbmNoise } from '../utils/MathUtils';
import type { IEnvironmentConfig } from '../types';

export class Wind {
  /** Current wind direction in radians */
  private directionRad: number = 0;
  
  /** Base wind force vector */
  private baseForce: Vector2 = new Vector2();
  
  /** Time accumulator for turbulence animation */
  private time: number = 0;
  
  /** Scale for position-based noise sampling */
  private readonly noiseScale: number = 0.003;
  
  /** Speed of turbulence changes */
  private readonly turbulenceSpeed: number = 0.3;

  constructor() {
    // Initialize with default values
    this.update(0, { windDirection: 0, windSpeed: 0 } as IEnvironmentConfig);
  }

  /**
   * Update wind state
   * @param deltaTime - Time since last frame
   * @param config - Environment configuration
   */
  update(deltaTime: number, config: IEnvironmentConfig): void {
    this.time += deltaTime * this.turbulenceSpeed;
    
    // Convert direction to radians
    this.directionRad = config.windDirection * Math.PI / 180;
    
    // Calculate base force
    this.baseForce.set(
      Math.cos(this.directionRad) * config.windSpeed,
      Math.sin(this.directionRad) * config.windSpeed
    );
  }

  /**
   * Get wind force at a specific position
   * 
   * Wind varies slightly based on position due to turbulence,
   * creating more natural-looking effects.
   * 
   * @param x - X position
   * @param y - Y position
   * @param config - Environment configuration
   */
  getForceAt(x: number, y: number, config: IEnvironmentConfig): Vector2 {
    if (config.windSpeed === 0) {
      return new Vector2(0, 0);
    }
    
    const force = this.baseForce.clone();
    
    // Add turbulence if enabled
    if (config.windTurbulence > 0) {
      // Sample noise at position
      const nx = x * this.noiseScale + this.time;
      const ny = y * this.noiseScale;
      
      // Get turbulence values (multi-octave noise for more complexity)
      const turbX = fbmNoise(nx, ny, 3) * config.windTurbulence * config.windSpeed * 0.5;
      const turbY = fbmNoise(nx + 100, ny + 100, 3) * config.windTurbulence * config.windSpeed * 0.5;
      
      force.x += turbX;
      force.y += turbY;
    }
    
    // Scale down to reasonable force magnitude
    force.mult(0.01);
    
    return force;
  }

  /**
   * Get average wind direction in degrees
   */
  getDirection(): number {
    return this.directionRad * 180 / Math.PI;
  }

  /**
   * Get wind heading in radians
   */
  getHeading(): number {
    return this.directionRad;
  }

  /**
   * Get base force magnitude
   */
  getSpeed(): number {
    return this.baseForce.mag();
  }

  /**
   * Check if wind is active
   */
  isActive(config: IEnvironmentConfig): boolean {
    return config.windSpeed > 0;
  }
}

