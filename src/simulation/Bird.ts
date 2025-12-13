/**
 * Bird Entity - Core simulation unit for swarm behavior
 * Version: 1.0.0
 * 
 * Each bird maintains its own physics state:
 * - Position: Current location in 2D space
 * - Velocity: Current movement direction and speed
 * - Acceleration: Forces being applied this frame
 * 
 * Physics constraints ensure realistic movement:
 * - Maximum speed limit
 * - Maximum steering force
 * - Smooth acceleration/deceleration
 */

import { Vector2 } from '../utils/Vector2';
import type { ISimulationConfig } from '../types';

export class Bird {
  /** Unique identifier */
  public readonly id: number;
  
  /** Current position */
  public position: Vector2;
  
  /** Current velocity */
  public velocity: Vector2;
  
  /** Accumulated acceleration (cleared each frame) */
  public acceleration: Vector2;
  
  /** Panic level (0-1) - affected by predators */
  public panicLevel: number = 0;
  
  /** Local density (number of neighbors) - updated during simulation */
  public localDensity: number = 0;
  
  /** Cached heading angle for rendering */
  private _heading: number = 0;

  // Reusable vectors for calculations (avoid allocations)
  private static tempVec = new Vector2();

  constructor(id: number, x: number, y: number) {
    this.id = id;
    this.position = new Vector2(x, y);
    this.velocity = Vector2.random().mult(5); // Start with random velocity
    this.acceleration = new Vector2();
  }

  /**
   * Apply a steering force to the bird
   * Forces accumulate during each frame and are applied in update()
   */
  applyForce(force: Vector2): void {
    this.acceleration.add(force);
  }

  /**
   * Update bird position based on physics
   * 
   * @param deltaTime - Time since last frame (seconds)
   * @param config - Simulation configuration for constraints
   */
  update(deltaTime: number, config: ISimulationConfig): void {
    // Apply acceleration to velocity
    this.velocity.add(Bird.tempVec.copy(this.acceleration).mult(deltaTime * 60));
    
    // Limit to max speed (higher when panicked)
    const effectiveMaxSpeed = config.maxSpeed * (1 + this.panicLevel * 0.5);
    this.velocity.limit(effectiveMaxSpeed);
    
    // Apply velocity to position
    this.position.add(Bird.tempVec.copy(this.velocity).mult(deltaTime * config.simulationSpeed));
    
    // Cache heading for rendering
    if (!this.velocity.isZero()) {
      this._heading = this.velocity.heading();
    }
    
    // Clear acceleration for next frame
    this.acceleration.zero();
    
    // Decay panic level
    this.panicLevel *= 0.98;
    if (this.panicLevel < 0.01) {
      this.panicLevel = 0;
    }
  }

  /**
   * Get the heading angle (direction bird is facing)
   */
  get heading(): number {
    return this._heading;
  }

  /**
   * Apply boundary avoidance forces
   * Creates a soft force field at screen edges
   */
  applyBoundaryForce(
    width: number,
    height: number,
    margin: number,
    force: number
  ): void {
    const steer = new Vector2();
    
    // Left boundary
    if (this.position.x < margin) {
      const strength = (margin - this.position.x) / margin;
      steer.x += force * strength;
    }
    // Right boundary
    else if (this.position.x > width - margin) {
      const strength = (this.position.x - (width - margin)) / margin;
      steer.x -= force * strength;
    }
    
    // Top boundary
    if (this.position.y < margin) {
      const strength = (margin - this.position.y) / margin;
      steer.y += force * strength;
    }
    // Bottom boundary
    else if (this.position.y > height - margin) {
      const strength = (this.position.y - (height - margin)) / margin;
      steer.y -= force * strength;
    }
    
    if (!steer.isZero()) {
      this.applyForce(steer);
    }
  }

  /**
   * Calculate steering force toward a target
   * Returns desired velocity minus current velocity
   */
  seek(target: Vector2, maxSpeed: number, maxForce: number): Vector2 {
    const desired = Bird.tempVec.copy(target).sub(this.position);
    const d = desired.mag();
    
    if (d > 0) {
      desired.normalize();
      
      // Slow down when approaching target (arrival behavior)
      if (d < 100) {
        desired.mult(maxSpeed * (d / 100));
      } else {
        desired.mult(maxSpeed);
      }
      
      // Steering = desired - velocity
      const steer = desired.sub(this.velocity);
      steer.limit(maxForce);
      return steer.clone();
    }
    
    return new Vector2();
  }

  /**
   * Calculate steering force away from a target
   */
  flee(target: Vector2, maxSpeed: number, maxForce: number): Vector2 {
    const desired = Bird.tempVec.copy(this.position).sub(target);
    const d = desired.mag();
    
    if (d > 0) {
      desired.normalize().mult(maxSpeed);
      const steer = desired.sub(this.velocity);
      steer.limit(maxForce);
      return steer.clone();
    }
    
    return new Vector2();
  }

  /**
   * Apply panic from a predator
   * Panic spreads through the flock via neighbor connections
   */
  applyPanic(level: number): void {
    this.panicLevel = Math.min(1, Math.max(this.panicLevel, level));
  }

  /**
   * Reset bird to a new position (for simulation reset)
   */
  reset(x: number, y: number): void {
    this.position.set(x, y);
    this.velocity = Vector2.random().mult(5);
    this.acceleration.zero();
    this.panicLevel = 0;
    this.localDensity = 0;
  }

  /**
   * Check if a point is within this bird's field of view
   * 
   * @param point - Point to check
   * @param fovDegrees - Field of view in degrees (e.g., 270 = blind spot behind)
   */
  isInFieldOfView(point: Vector2, fovDegrees: number): boolean {
    if (this.velocity.isZero()) return true; // If stationary, can see everything
    
    const toPoint = Bird.tempVec.copy(point).sub(this.position);
    const angleToPoint = toPoint.heading();
    const halfFov = (fovDegrees * Math.PI / 180) / 2;
    
    let diff = angleToPoint - this._heading;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    return Math.abs(diff) <= halfFov;
  }

  /**
   * Get speed (magnitude of velocity)
   */
  get speed(): number {
    return this.velocity.mag();
  }
}

/**
 * Bird data stored in typed arrays for better cache performance
 * Used when simulating very large flocks (5000+)
 */
export class BirdArrays {
  public readonly count: number;
  
  // Position data
  public positionX: Float32Array;
  public positionY: Float32Array;
  
  // Velocity data
  public velocityX: Float32Array;
  public velocityY: Float32Array;
  
  // Acceleration data
  public accelerationX: Float32Array;
  public accelerationY: Float32Array;
  
  // Additional state
  public panicLevel: Float32Array;
  public localDensity: Float32Array;

  constructor(count: number) {
    this.count = count;
    
    this.positionX = new Float32Array(count);
    this.positionY = new Float32Array(count);
    this.velocityX = new Float32Array(count);
    this.velocityY = new Float32Array(count);
    this.accelerationX = new Float32Array(count);
    this.accelerationY = new Float32Array(count);
    this.panicLevel = new Float32Array(count);
    this.localDensity = new Float32Array(count);
  }

  /**
   * Initialize bird at index with random position and velocity
   */
  initialize(index: number, x: number, y: number): void {
    this.positionX[index] = x;
    this.positionY[index] = y;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 4;
    this.velocityX[index] = Math.cos(angle) * speed;
    this.velocityY[index] = Math.sin(angle) * speed;
    
    this.accelerationX[index] = 0;
    this.accelerationY[index] = 0;
    this.panicLevel[index] = 0;
    this.localDensity[index] = 0;
  }
}

