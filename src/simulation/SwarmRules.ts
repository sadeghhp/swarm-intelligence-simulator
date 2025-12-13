/**
 * Swarm Rules Engine - Core flocking behavior
 * Version: 1.0.0
 * 
 * Implements the three fundamental rules of flocking behavior
 * (Reynolds' Boids model) plus refinements for realistic starling murmurations:
 * 
 * MAIN RULES:
 * 
 * 1. ALIGNMENT - Birds adjust their velocity to match nearby neighbors
 *    - Calculates average velocity of neighbors
 *    - Steers toward that average direction
 *    - Creates coordinated group movement
 * 
 * 2. COHESION - Birds move toward the local center of mass
 *    - Finds the average position of nearby birds
 *    - Steers toward that center point
 *    - Keeps the flock together
 * 
 * 3. SEPARATION - Birds avoid crowding each other
 *    - Calculates repulsion force from very close neighbors
 *    - Stronger force for closer birds (inverse square)
 *    - Prevents collisions and maintains spacing
 * 
 * SUB-RULES AND REFINEMENTS:
 * 
 * - Field of View (FOV): Birds have a blind spot behind them (270° vision)
 * - Distance Weighting: Closer neighbors have stronger influence
 * - Noise Injection: Perlin noise adds natural variation
 * - Density Adaptation: Cohesion reduces in crowded areas
 * - Velocity Smoothing: Forces are limited to prevent jittery movement
 */

import { Vector2 } from '../utils/Vector2';
import { Bird } from './Bird';
import { noise } from '../utils/MathUtils';
import type { ISimulationConfig, IEnvironmentConfig } from '../types';

// Reusable vectors to avoid allocations in hot loop
const tempAlignment = new Vector2();
const tempCohesion = new Vector2();
const tempSeparation = new Vector2();
const tempSteer = new Vector2();
const tempDiff = new Vector2();

export class SwarmRules {
  /** Noise time offset for natural variation */
  private noiseTime: number = 0;
  
  /** Noise scale for position-based variation */
  private noiseScale: number = 0.01;

  constructor() {
    // Initialize with random noise offset
    this.noiseTime = Math.random() * 1000;
  }

  /**
   * Calculate all steering forces for a single bird
   * 
   * This is the main entry point called once per bird per frame.
   * It combines all rules and returns the total steering force.
   */
  calculate(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig,
    envConfig: IEnvironmentConfig,
    time: number
  ): Vector2 {
    const force = new Vector2();
    
    if (neighbors.length === 0) {
      // No neighbors - add slight random movement
      this.addNoise(bird, force, time, 0.1);
      return force;
    }

    // Calculate each rule
    const alignment = this.calculateAlignment(bird, neighbors, config);
    const cohesion = this.calculateCohesion(bird, neighbors, config);
    const separation = this.calculateSeparation(bird, neighbors, config);
    
    // Apply weights
    alignment.mult(config.alignmentWeight);
    cohesion.mult(config.cohesionWeight);
    separation.mult(config.separationWeight);
    
    // Combine forces
    force.add(alignment);
    force.add(cohesion);
    force.add(separation);
    
    // Add natural variation via noise
    this.addNoise(bird, force, time, 0.05);
    
    // Limit total force
    force.limit(config.maxForce * (1 + bird.panicLevel));
    
    // Update bird's local density (for visual feedback)
    bird.localDensity = neighbors.length;
    
    return force;
  }

  /**
   * ALIGNMENT RULE
   * 
   * Calculate steering force to align with neighbors' average velocity.
   * Birds naturally want to fly in the same direction as their neighbors.
   * 
   * Process:
   * 1. Sum all neighbor velocities (weighted by distance)
   * 2. Calculate average
   * 3. Steer toward that average
   */
  private calculateAlignment(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig
  ): Vector2 {
    tempAlignment.zero();
    let totalWeight = 0;
    
    for (let i = 0; i < neighbors.length; i++) {
      const other = neighbors[i];
      const distance = bird.position.dist(other.position);
      
      // Distance-weighted influence (closer = stronger)
      const weight = 1 - (distance / config.perceptionRadius);
      
      tempAlignment.x += other.velocity.x * weight;
      tempAlignment.y += other.velocity.y * weight;
      totalWeight += weight;
    }
    
    if (totalWeight > 0) {
      // Average velocity
      tempAlignment.div(totalWeight);
      
      // Steering = desired - current
      tempAlignment.setMag(config.maxSpeed);
      tempAlignment.sub(bird.velocity);
      tempAlignment.limit(config.maxForce);
    }
    
    return tempAlignment.clone();
  }

  /**
   * COHESION RULE
   * 
   * Calculate steering force toward the center of nearby birds.
   * This keeps the flock together as a cohesive group.
   * 
   * Process:
   * 1. Find center of mass of neighbors
   * 2. Steer toward that center
   * 3. Reduce strength in high-density areas (density adaptation)
   */
  private calculateCohesion(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig
  ): Vector2 {
    tempCohesion.zero();
    let totalWeight = 0;
    
    for (let i = 0; i < neighbors.length; i++) {
      const other = neighbors[i];
      const distance = bird.position.dist(other.position);
      
      // Distance-weighted influence
      const weight = 1 - (distance / config.perceptionRadius);
      
      tempCohesion.x += other.position.x * weight;
      tempCohesion.y += other.position.y * weight;
      totalWeight += weight;
    }
    
    if (totalWeight > 0) {
      // Center of mass
      tempCohesion.div(totalWeight);
      
      // Vector pointing from bird to center
      tempCohesion.sub(bird.position);
      
      // Density adaptation: reduce cohesion when crowded
      const densityFactor = Math.max(0.3, 1 - neighbors.length / 20);
      tempCohesion.mult(densityFactor);
      
      // Steering
      tempCohesion.setMag(config.maxSpeed);
      tempCohesion.sub(bird.velocity);
      tempCohesion.limit(config.maxForce);
    }
    
    return tempCohesion.clone();
  }

  /**
   * SEPARATION RULE
   * 
   * Calculate steering force to avoid crowding neighbors.
   * This prevents collisions and maintains comfortable spacing.
   * 
   * Process:
   * 1. For each nearby bird, calculate a repulsion vector
   * 2. Weight by inverse square of distance (closer = stronger)
   * 3. Sum all repulsion vectors
   */
  private calculateSeparation(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig
  ): Vector2 {
    tempSeparation.zero();
    let count = 0;
    
    for (let i = 0; i < neighbors.length; i++) {
      const other = neighbors[i];
      const distance = bird.position.dist(other.position);
      
      // Only apply separation within separation radius
      if (distance < config.separationRadius && distance > 0) {
        // Vector pointing away from neighbor
        tempDiff.copy(bird.position).sub(other.position);
        
        // Weight by inverse square of distance
        // Closer birds create much stronger repulsion
        tempDiff.normalize();
        tempDiff.div(distance * distance);
        
        tempSeparation.add(tempDiff);
        count++;
      }
    }
    
    if (count > 0) {
      tempSeparation.div(count);
      
      if (!tempSeparation.isZero()) {
        tempSeparation.setMag(config.maxSpeed);
        tempSeparation.sub(bird.velocity);
        tempSeparation.limit(config.maxForce);
      }
    }
    
    return tempSeparation.clone();
  }

  /**
   * Add Perlin noise for natural movement variation
   * 
   * Real birds don't move perfectly - they have subtle random variations.
   * This uses Perlin noise (smooth randomness) to add natural-looking jitter.
   */
  private addNoise(
    bird: Bird,
    force: Vector2,
    time: number,
    strength: number
  ): void {
    // Use bird position and time for unique noise per bird
    const nx = bird.position.x * this.noiseScale + time * 0.5;
    const ny = bird.position.y * this.noiseScale + bird.id * 0.1;
    
    // Get noise value (-1 to 1)
    const noiseVal = noise(nx, ny);
    
    // Apply as rotational force (changes direction slightly)
    const angle = noiseVal * Math.PI * strength;
    tempSteer.copy(bird.velocity).rotate(angle).mult(0.1);
    force.add(tempSteer);
  }

  /**
   * Apply panic response to escape from predator
   * Birds flee and spread panic to neighbors
   */
  calculatePanicResponse(
    bird: Bird,
    predatorPosition: Vector2,
    panicRadius: number,
    maxForce: number
  ): Vector2 {
    const distance = bird.position.dist(predatorPosition);
    
    if (distance < panicRadius) {
      // Calculate panic level based on distance (closer = more panic)
      const panicLevel = 1 - (distance / panicRadius);
      bird.applyPanic(panicLevel);
      
      // Flee force (away from predator)
      tempSteer.copy(bird.position).sub(predatorPosition);
      tempSteer.normalize();
      
      // Stronger flee when closer
      tempSteer.mult(maxForce * (1 + panicLevel * 2));
      
      return tempSteer.clone();
    }
    
    return new Vector2();
  }

  /**
   * Calculate attractor/repulsor influence
   */
  calculateAttractorForce(
    bird: Bird,
    attractorPosition: Vector2,
    strength: number,
    radius: number,
    isRepulsor: boolean,
    maxForce: number
  ): Vector2 {
    const distance = bird.position.dist(attractorPosition);
    
    if (distance < radius && distance > 0) {
      // Direction to/from attractor
      tempSteer.copy(attractorPosition).sub(bird.position);
      
      if (isRepulsor) {
        tempSteer.mult(-1); // Reverse for repulsion
      }
      
      // Strength falls off with distance
      const factor = 1 - (distance / radius);
      tempSteer.normalize().mult(strength * factor * maxForce);
      
      return tempSteer.clone();
    }
    
    return new Vector2();
  }

  /**
   * Update internal time (for noise variation)
   */
  update(deltaTime: number): void {
    this.noiseTime += deltaTime;
  }
}

