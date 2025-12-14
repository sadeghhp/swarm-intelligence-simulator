/**
 * Swarm Rules Engine - Core flocking behavior
 * Version: 1.2.0 - Added predator-prey hunting/fleeing dynamics
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
 * 
 * PERFORMANCE: All methods use pre-allocated vectors - zero GC pressure.
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
const tempForce = new Vector2();
const tempPanic = new Vector2();
const tempAttractor = new Vector2();
const tempHunt = new Vector2();
const tempFlee = new Vector2();

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
   * PERFORMANCE: Uses output parameter, zero allocations
   * 
   * @param outForce - Output vector to store result (will be modified)
   */
  calculate(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig,
    _envConfig: IEnvironmentConfig,
    time: number,
    outForce: Vector2
  ): void {
    outForce.zero();
    
    if (neighbors.length === 0) {
      // No neighbors - add slight random movement
      this.addNoise(bird, outForce, time, 0.1);
      return;
    }

    // Calculate each rule (results stored in temp vectors)
    this.calculateAlignment(bird, neighbors, config);
    this.calculateCohesion(bird, neighbors, config);
    this.calculateSeparation(bird, neighbors, config);
    
    // Apply weights and combine (use tempForce as accumulator)
    outForce.x = tempAlignment.x * config.alignmentWeight +
                 tempCohesion.x * config.cohesionWeight +
                 tempSeparation.x * config.separationWeight;
    outForce.y = tempAlignment.y * config.alignmentWeight +
                 tempCohesion.y * config.cohesionWeight +
                 tempSeparation.y * config.separationWeight;
    
    // Add natural variation via noise
    this.addNoise(bird, outForce, time, 0.05);
    
    // Limit total force
    outForce.limit(config.maxForce * (1 + bird.panicLevel));
    
    // Update bird's local density (for visual feedback)
    bird.localDensity = neighbors.length;
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
   * 
   * PERFORMANCE: Result stored in tempAlignment (no allocation)
   */
  private calculateAlignment(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig
  ): void {
    tempAlignment.zero();
    let totalWeight = 0;
    
    const len = neighbors.length;
    for (let i = 0; i < len; i++) {
      const other = neighbors[i];
      // Use squared distance when possible (avoid sqrt)
      const dx = bird.position.x - other.position.x;
      const dy = bird.position.y - other.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
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
  }

  /**
   * COHESION RULE
   * 
   * Calculate steering force toward the center of nearby birds.
   * This keeps the flock together as a cohesive group.
   * 
   * PERFORMANCE: Result stored in tempCohesion (no allocation)
   */
  private calculateCohesion(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig
  ): void {
    tempCohesion.zero();
    let totalWeight = 0;
    
    const len = neighbors.length;
    for (let i = 0; i < len; i++) {
      const other = neighbors[i];
      const dx = bird.position.x - other.position.x;
      const dy = bird.position.y - other.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
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
      const densityFactor = Math.max(0.3, 1 - len / 20);
      tempCohesion.mult(densityFactor);
      
      // Steering
      tempCohesion.setMag(config.maxSpeed);
      tempCohesion.sub(bird.velocity);
      tempCohesion.limit(config.maxForce);
    }
  }

  /**
   * SEPARATION RULE
   * 
   * Calculate steering force to avoid crowding neighbors.
   * This prevents collisions and maintains comfortable spacing.
   * 
   * PERFORMANCE: Result stored in tempSeparation (no allocation)
   */
  private calculateSeparation(
    bird: Bird,
    neighbors: Bird[],
    config: ISimulationConfig
  ): void {
    tempSeparation.zero();
    let count = 0;
    
    const sepRadiusSq = config.separationRadius * config.separationRadius;
    const len = neighbors.length;
    
    for (let i = 0; i < len; i++) {
      const other = neighbors[i];
      const dx = bird.position.x - other.position.x;
      const dy = bird.position.y - other.position.y;
      const distSq = dx * dx + dy * dy;
      
      // Only apply separation within separation radius
      if (distSq < sepRadiusSq && distSq > 0) {
        const distance = Math.sqrt(distSq);
        
        // Vector pointing away from neighbor, weighted by inverse square
        const invDistSq = 1 / distSq;
        tempSeparation.x += (dx / distance) * invDistSq;
        tempSeparation.y += (dy / distance) * invDistSq;
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
   * PERFORMANCE: Uses output parameter, zero allocations
   */
  calculatePanicResponse(
    bird: Bird,
    predatorPosition: Vector2,
    panicRadius: number,
    maxForce: number,
    outForce: Vector2
  ): void {
    const dx = bird.position.x - predatorPosition.x;
    const dy = bird.position.y - predatorPosition.y;
    const distSq = dx * dx + dy * dy;
    const panicRadiusSq = panicRadius * panicRadius;
    
    if (distSq < panicRadiusSq) {
      const distance = Math.sqrt(distSq);
      
      // Calculate panic level based on distance (closer = more panic)
      const panicLevel = 1 - (distance / panicRadius);
      bird.applyPanic(panicLevel);
      
      // Flee force (away from predator)
      if (distance > 0) {
        const forceMag = maxForce * (1 + panicLevel * 2);
        outForce.x = (dx / distance) * forceMag;
        outForce.y = (dy / distance) * forceMag;
      } else {
        outForce.zero();
      }
    } else {
      outForce.zero();
    }
  }

  /**
   * Calculate attractor/repulsor influence
   * PERFORMANCE: Uses output parameter, zero allocations
   */
  calculateAttractorForce(
    bird: Bird,
    attractorX: number,
    attractorY: number,
    strength: number,
    radius: number,
    isRepulsor: boolean,
    maxForce: number,
    outForce: Vector2
  ): void {
    const dx = attractorX - bird.position.x;
    const dy = attractorY - bird.position.y;
    const distSq = dx * dx + dy * dy;
    const radiusSq = radius * radius;
    
    if (distSq < radiusSq && distSq > 0) {
      const distance = Math.sqrt(distSq);
      
      // Strength falls off with distance
      const factor = 1 - (distance / radius);
      let forceMag = strength * factor * maxForce;
      
      if (isRepulsor) {
        forceMag = -forceMag;
      }
      
      outForce.x = (dx / distance) * forceMag;
      outForce.y = (dy / distance) * forceMag;
    } else {
      outForce.zero();
    }
  }

  /**
   * Update internal time (for noise variation)
   */
  update(deltaTime: number): void {
    this.noiseTime += deltaTime;
  }

  /**
   * Calculate hunting force - predator chases prey
   * PERFORMANCE: Uses output parameter, zero allocations
   * 
   * @param hunter - The hunting bird
   * @param prey - Array of potential prey birds
   * @param huntingSpeed - Speed boost when hunting
   * @param huntingRadius - Maximum hunting detection range
   * @param maxForce - Maximum steering force
   * @param outForce - Output vector for the force
   */
  calculateHuntingForce(
    hunter: Bird,
    prey: Bird[],
    huntingSpeed: number,
    huntingRadius: number,
    maxForce: number,
    outForce: Vector2
  ): void {
    outForce.zero();
    
    if (prey.length === 0) return;
    
    // Find nearest prey within radius
    let nearestPrey: Bird | null = null;
    let nearestDistSq = huntingRadius * huntingRadius;
    
    for (let i = 0; i < prey.length; i++) {
      const p = prey[i];
      const dx = p.position.x - hunter.position.x;
      const dy = p.position.y - hunter.position.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < nearestDistSq && distSq > 0) {
        nearestDistSq = distSq;
        nearestPrey = p;
      }
    }
    
    if (nearestPrey) {
      const dist = Math.sqrt(nearestDistSq);
      
      // Steering toward prey
      tempHunt.x = nearestPrey.position.x - hunter.position.x;
      tempHunt.y = nearestPrey.position.y - hunter.position.y;
      tempHunt.normalize();
      tempHunt.mult(huntingSpeed);
      tempHunt.sub(hunter.velocity);
      tempHunt.limit(maxForce * 1.5); // Hunting has stronger force
      
      // Urgency increases when closer
      const urgency = 1 - (dist / huntingRadius);
      
      outForce.x = tempHunt.x * (1 + urgency);
      outForce.y = tempHunt.y * (1 + urgency);
    }
  }

  /**
   * Calculate fleeing force - prey escapes from predators
   * PERFORMANCE: Uses output parameter, zero allocations
   * 
   * @param prey - The fleeing bird
   * @param predators - Array of predator birds
   * @param fleeRadius - Range at which prey detects predators
   * @param maxForce - Maximum steering force
   * @param outForce - Output vector for the force
   */
  calculateFleeingForce(
    prey: Bird,
    predators: Bird[],
    fleeRadius: number,
    maxForce: number,
    outForce: Vector2
  ): void {
    outForce.zero();
    
    if (predators.length === 0) return;
    
    let count = 0;
    const fleeRadiusSq = fleeRadius * fleeRadius;
    
    for (let i = 0; i < predators.length; i++) {
      const predator = predators[i];
      const dx = prey.position.x - predator.position.x;
      const dy = prey.position.y - predator.position.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < fleeRadiusSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        
        // Vector pointing away from predator
        // Strength inversely proportional to distance (closer = stronger)
        const strength = (1 - dist / fleeRadius);
        
        tempFlee.x = (dx / dist) * strength;
        tempFlee.y = (dy / dist) * strength;
        
        outForce.x += tempFlee.x;
        outForce.y += tempFlee.y;
        count++;
        
        // Apply panic to prey
        prey.applyPanic(strength);
      }
    }
    
    if (count > 0) {
      outForce.x /= count;
      outForce.y /= count;
      
      // Normalize and scale
      const mag = Math.sqrt(outForce.x * outForce.x + outForce.y * outForce.y);
      if (mag > 0) {
        outForce.x = (outForce.x / mag) * maxForce * 2; // Fleeing has high priority
        outForce.y = (outForce.y / mag) * maxForce * 2;
      }
    }
  }

  /**
   * Calculate territory return force - pull toward home territory
   * PERFORMANCE: Uses output parameter, zero allocations
   * 
   * @param bird - The bird
   * @param territoryX - Territory center X
   * @param territoryY - Territory center Y
   * @param territoryRadius - How far before pull activates
   * @param strength - Force strength
   * @param maxForce - Maximum force
   * @param outForce - Output vector
   */
  calculateTerritoryForce(
    bird: Bird,
    territoryX: number,
    territoryY: number,
    territoryRadius: number,
    strength: number,
    maxForce: number,
    outForce: Vector2
  ): void {
    outForce.zero();
    
    const dx = territoryX - bird.position.x;
    const dy = territoryY - bird.position.y;
    const distSq = dx * dx + dy * dy;
    const radiusSq = territoryRadius * territoryRadius;
    
    // Only apply force if outside territory
    if (distSq > radiusSq) {
      const dist = Math.sqrt(distSq);
      
      // Force increases with distance from territory
      const factor = Math.min(1, (dist - territoryRadius) / territoryRadius) * strength;
      
      outForce.x = (dx / dist) * factor * maxForce;
      outForce.y = (dy / dist) * factor * maxForce;
    }
  }
}

