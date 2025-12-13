/**
 * Predator AI - Autonomous predator with hunting behavior
 * Version: 1.0.0
 * 
 * The predator creates panic in the flock, triggering evasive behavior.
 * 
 * Behaviors:
 * - IDLE: Wander around the edges, occasionally entering flock area
 * - HUNTING: Move toward flock center
 * - ATTACKING: Dive toward nearest bird
 * - COOLDOWN: Rest after attack before hunting again
 * 
 * Panic mechanics:
 * - Birds within panic radius feel direct fear
 * - Panic propagates through neighbors (cascade effect)
 * - Creates visually dramatic split/scatter behavior
 */

import { Vector2 } from '../utils/Vector2';
import { noise, randomRange } from '../utils/MathUtils';
import type { Bird } from '../simulation/Bird';
import type { IEnvironmentConfig, IPredatorState } from '../types';

export class Predator {
  /** Current position */
  public position: Vector2;
  
  /** Current velocity */
  public velocity: Vector2;
  
  /** Current target (bird or position) */
  private target: Vector2 | null = null;
  
  /** Current behavior state */
  public state: 'idle' | 'hunting' | 'attacking' = 'idle';
  
  /** Cooldown timer after attack */
  private cooldown: number = 0;
  
  /** Time in current state */
  private stateTime: number = 0;
  
  /** Wander target for idle behavior */
  private wanderTarget: Vector2;
  
  /** Simulation bounds */
  private width: number;
  private height: number;
  
  /** Time accumulator for noise-based movement */
  private time: number = 0;

  // Physics constants
  private readonly maxSpeed: number = 18;
  private readonly maxForce: number = 0.8;
  private readonly attackCooldown: number = 3;
  private readonly attackDistance: number = 50;
  private readonly huntingDuration: number = 5;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    // Start at random edge
    this.position = this.getRandomEdgePosition();
    this.velocity = Vector2.random().mult(5);
    this.wanderTarget = this.getRandomWanderTarget();
  }

  /**
   * Update predator behavior and physics
   */
  update(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    if (!config.predatorEnabled) {
      return;
    }
    
    this.time += deltaTime;
    this.stateTime += deltaTime;
    
    // Update cooldown
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }
    
    // State machine
    switch (this.state) {
      case 'idle':
        this.updateIdle(deltaTime, config, flockCenter);
        break;
      case 'hunting':
        this.updateHunting(deltaTime, config, birds, flockCenter);
        break;
      case 'attacking':
        this.updateAttacking(deltaTime, config, birds);
        break;
    }
    
    // Apply physics
    this.velocity.limit(this.maxSpeed * (config.predatorSpeed / 18));
    this.position.add(new Vector2(this.velocity.x * deltaTime, this.velocity.y * deltaTime));
    
    // Soft boundary avoidance
    this.applyBoundaryForce();
  }

  /**
   * Idle behavior: wander around edges, occasionally decide to hunt
   */
  private updateIdle(
    deltaTime: number,
    config: IEnvironmentConfig,
    flockCenter: Vector2
  ): void {
    // Move toward wander target
    const toTarget = new Vector2(
      this.wanderTarget.x - this.position.x,
      this.wanderTarget.y - this.position.y
    );
    
    if (toTarget.mag() < 50) {
      // Reached target, pick new one
      this.wanderTarget = this.getRandomWanderTarget();
    }
    
    // Steering toward target
    const steer = toTarget.clone().normalize().mult(this.maxSpeed);
    steer.sub(this.velocity).limit(this.maxForce * 0.5);
    this.velocity.add(steer);
    
    // Random chance to start hunting based on aggression
    if (this.cooldown <= 0 && Math.random() < config.predatorAggression * 0.02) {
      this.setState('hunting');
      this.target = flockCenter.clone();
    }
  }

  /**
   * Hunting behavior: move toward flock center
   */
  private updateHunting(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Update target to flock center
    this.target = flockCenter.clone();
    
    // Steering toward target
    const toTarget = new Vector2(
      this.target.x - this.position.x,
      this.target.y - this.position.y
    );
    
    const steer = toTarget.clone().normalize().mult(this.maxSpeed * 1.2);
    steer.sub(this.velocity).limit(this.maxForce);
    this.velocity.add(steer);
    
    // Check if close enough to attack
    const closestBird = this.findClosestBird(birds);
    if (closestBird) {
      const distToBird = this.position.dist(closestBird.position);
      if (distToBird < this.attackDistance * 2) {
        this.setState('attacking');
        this.target = closestBird.position.clone();
      }
    }
    
    // Timeout: return to idle if hunting too long
    if (this.stateTime > this.huntingDuration) {
      this.setState('idle');
    }
  }

  /**
   * Attacking behavior: dive toward target bird
   */
  private updateAttacking(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    // Find closest bird to attack
    const closestBird = this.findClosestBird(birds);
    if (closestBird) {
      this.target = closestBird.position.clone();
    }
    
    if (!this.target) {
      this.setState('idle');
      return;
    }
    
    // Fast dive toward target
    const toTarget = new Vector2(
      this.target.x - this.position.x,
      this.target.y - this.position.y
    );
    
    const dist = toTarget.mag();
    
    // Increase speed during attack
    const steer = toTarget.clone().normalize().mult(this.maxSpeed * 1.5);
    steer.sub(this.velocity).limit(this.maxForce * 2);
    this.velocity.add(steer);
    
    // Check if reached target (attack complete)
    if (dist < this.attackDistance) {
      this.cooldown = this.attackCooldown;
      this.setState('idle');
      // Move away after attack
      this.velocity.mult(-0.5);
    }
    
    // Timeout
    if (this.stateTime > 3) {
      this.cooldown = this.attackCooldown * 0.5;
      this.setState('idle');
    }
  }

  /**
   * Find the closest bird to the predator
   */
  private findClosestBird(birds: Bird[]): Bird | null {
    let closest: Bird | null = null;
    let closestDist = Infinity;
    
    for (const bird of birds) {
      const dist = this.position.distSq(bird.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = bird;
      }
    }
    
    return closest;
  }

  /**
   * Apply soft boundary force
   */
  private applyBoundaryForce(): void {
    const margin = 100;
    const force = 0.5;
    
    if (this.position.x < margin) {
      this.velocity.x += force;
    } else if (this.position.x > this.width - margin) {
      this.velocity.x -= force;
    }
    
    if (this.position.y < margin) {
      this.velocity.y += force;
    } else if (this.position.y > this.height - margin) {
      this.velocity.y -= force;
    }
  }

  /**
   * Get random position on edge of screen
   */
  private getRandomEdgePosition(): Vector2 {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: // Top
        return new Vector2(Math.random() * this.width, 50);
      case 1: // Right
        return new Vector2(this.width - 50, Math.random() * this.height);
      case 2: // Bottom
        return new Vector2(Math.random() * this.width, this.height - 50);
      default: // Left
        return new Vector2(50, Math.random() * this.height);
    }
  }

  /**
   * Get random wander target (biased toward edges)
   */
  private getRandomWanderTarget(): Vector2 {
    const margin = 150;
    
    // 70% chance to target edges, 30% chance to go anywhere
    if (Math.random() < 0.7) {
      return this.getRandomEdgePosition();
    }
    
    return new Vector2(
      margin + Math.random() * (this.width - margin * 2),
      margin + Math.random() * (this.height - margin * 2)
    );
  }

  /**
   * Set behavior state
   */
  private setState(newState: 'idle' | 'hunting' | 'attacking'): void {
    this.state = newState;
    this.stateTime = 0;
    
    if (newState === 'idle') {
      this.wanderTarget = this.getRandomWanderTarget();
    }
  }

  /**
   * Get current state for display
   */
  getState(): IPredatorState {
    return {
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      target: this.target ? { x: this.target.x, y: this.target.y } : null,
      state: this.state,
      cooldown: this.cooldown
    };
  }

  /**
   * Resize bounds
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Reset predator to initial state
   */
  reset(): void {
    this.position = this.getRandomEdgePosition();
    this.velocity = Vector2.random().mult(5);
    this.target = null;
    this.state = 'idle';
    this.stateTime = 0;
    this.cooldown = 0;
    this.wanderTarget = this.getRandomWanderTarget();
  }
}

