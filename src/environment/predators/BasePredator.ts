/**
 * BasePredator - Abstract base class for all predator types
 * Version: 2.0.0
 * 
 * Provides shared functionality for all predator types:
 * - Energy/stamina system
 * - State management
 * - Basic physics and movement
 * - Target selection interface
 * - Boundary handling
 * 
 * Subclasses implement specific hunting strategies:
 * - HawkPredator: Edge hunting with burst speed
 * - FalconPredator: Stoop diving from altitude
 * - EaglePredator: Sustained pursuit
 * - OwlPredator: Ambush attacks
 */

import { Vector2 } from '../../utils/Vector2';
import type { Bird } from '../../simulation/Bird';
import type {
  IEnvironmentConfig,
  IPredatorState,
  IPredatorStats,
  PredatorType,
  PredatorBehaviorState,
  ITargetScore
} from '../../types';

/** Static ID counter for unique predator IDs */
let predatorIdCounter = 0;

/** Pre-allocated vectors to avoid GC pressure */
const tempSteer = new Vector2();
const tempToTarget = new Vector2();

export abstract class BasePredator {
  /** Unique identifier */
  public readonly id: number;
  
  /** Predator type identifier */
  public abstract readonly type: PredatorType;
  
  /** Current position */
  public position: Vector2;
  
  /** Current velocity */
  public velocity: Vector2;
  
  /** Current behavior state */
  public state: PredatorBehaviorState = 'idle';
  
  /** Current energy level */
  public energy: number;
  
  /** Current target position */
  protected target: Vector2 | null = null;
  
  /** Current target bird ID */
  protected targetBirdId: number | null = null;
  
  /** Cooldown timer after attack */
  protected cooldown: number = 0;
  
  /** Time since energy last started recovering */
  protected recoveryTimer: number = 0;
  
  /** Time in current state */
  protected stateTime: number = 0;
  
  /** Time spent in current hunt */
  protected huntDuration: number = 0;
  
  /** Wander target for idle behavior */
  protected wanderTarget: Vector2;
  
  /** Simulation bounds */
  protected width: number;
  protected height: number;
  
  /** Time accumulator for noise-based movement */
  protected time: number = 0;
  
  /** Hunt statistics */
  public successfulHunts: number = 0;
  public failedHunts: number = 0;

  /** Base physics constants (can be overridden by subclasses) */
  protected maxSpeed: number = 18;
  protected maxForce: number = 0.8;
  protected attackDistance: number = 50;
  protected huntingDuration: number = 8;

  /** Stats configuration */
  protected abstract readonly stats: IPredatorStats;
  
  /** Color for rendering */
  public abstract readonly color: string;
  
  /** Panic radius - how far panic effect extends */
  public abstract readonly panicRadius: number;

  constructor(width: number, height: number) {
    this.id = predatorIdCounter++;
    this.width = width;
    this.height = height;
    
    // Start at random edge
    this.position = this.getRandomEdgePosition();
    this.velocity = Vector2.random().mult(3);
    this.wanderTarget = this.getRandomWanderTarget();
    
    // Energy will be set by subclass stats
    this.energy = 100;
  }

  /**
   * Initialize energy from stats (called by subclass constructor)
   */
  protected initializeEnergy(): void {
    this.energy = this.stats.maxEnergy;
  }

  /**
   * Main update loop - handles common logic and delegates to subclass
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
    
    // Energy management
    this.updateEnergy(deltaTime);
    
    // Check for exhaustion
    if (this.energy <= this.stats.exhaustionThreshold && this.state !== 'recovering' && this.state !== 'idle') {
      this.setState('recovering');
      this.failedHunts++;
    }
    
    // Delegate to subclass state machine
    this.updateBehavior(deltaTime, config, birds, flockCenter);
    
    // Apply physics
    const speedMultiplier = this.getSpeedMultiplier(config);
    this.velocity.limit(this.maxSpeed * speedMultiplier);
    this.position.add(new Vector2(this.velocity.x * deltaTime, this.velocity.y * deltaTime));
    
    // Soft boundary avoidance
    this.applyBoundaryForce();
  }

  /**
   * Abstract method for subclass-specific behavior updates
   */
  protected abstract updateBehavior(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void;

  /**
   * Get current speed multiplier based on config and state
   */
  protected getSpeedMultiplier(config: IEnvironmentConfig): number {
    let multiplier = config.predatorSpeed / 18;
    
    // Apply burst multiplier during attack states
    if (this.state === 'attacking' || this.state === 'diving') {
      multiplier *= this.stats.burstMultiplier;
    }
    
    // Reduce speed when low on energy
    if (this.energy < this.stats.exhaustionThreshold * 2) {
      multiplier *= 0.7 + (this.energy / (this.stats.exhaustionThreshold * 2)) * 0.3;
    }
    
    return multiplier;
  }

  /**
   * Update energy system
   */
  protected updateEnergy(deltaTime: number): void {
    const isActive = this.state === 'hunting' || this.state === 'attacking' || 
                     this.state === 'diving' || this.state === 'stalking';
    
    if (isActive) {
      // Drain energy during active hunting
      this.energy -= this.stats.huntingDrain * deltaTime;
      this.energy = Math.max(0, this.energy);
      this.recoveryTimer = 0;
      this.huntDuration += deltaTime;
    } else {
      // Regenerate energy when idle/recovering
      this.recoveryTimer += deltaTime;
      if (this.recoveryTimer >= this.stats.staminaRecoveryDelay) {
        this.energy += this.stats.energyRegenRate * deltaTime;
        this.energy = Math.min(this.stats.maxEnergy, this.energy);
      }
    }
  }

  /**
   * Consume energy for an attack
   */
  protected consumeAttackEnergy(): void {
    this.energy -= this.stats.attackCost;
    this.energy = Math.max(0, this.energy);
  }

  /**
   * Common idle behavior: wander around edges
   */
  protected updateIdle(_deltaTime: number, config: IEnvironmentConfig, flockCenter: Vector2): void {
    // Move toward wander target
    tempToTarget.set(
      this.wanderTarget.x - this.position.x,
      this.wanderTarget.y - this.position.y
    );
    
    if (tempToTarget.mag() < 50) {
      this.wanderTarget = this.getRandomWanderTarget();
    }
    
    // Steering toward target
    tempSteer.copy(tempToTarget).normalize().mult(this.maxSpeed * 0.6);
    tempSteer.sub(this.velocity).limit(this.maxForce * 0.4);
    this.velocity.add(tempSteer);
    
    // Random chance to start hunting based on aggression and energy
    // Higher probability: aggression 0.5 = ~3% per frame = starts hunting within ~0.5-1 second
    if (this.cooldown <= 0 && 
        this.energy >= this.stats.exhaustionThreshold * 1.5 &&
        Math.random() < config.predatorAggression * 0.06) {
      this.beginHunt(flockCenter);
    }
  }

  /**
   * Common recovery behavior: rest and regain energy
   */
  protected updateRecovering(_deltaTime: number): void {
    // Slow down significantly
    this.velocity.mult(0.98);
    
    // Move toward edge if not already there
    const centerDist = Math.sqrt(
      Math.pow(this.position.x - this.width / 2, 2) +
      Math.pow(this.position.y - this.height / 2, 2)
    );
    
    if (centerDist < Math.min(this.width, this.height) * 0.3) {
      // Move toward nearest edge
      tempSteer.set(
        this.wanderTarget.x - this.position.x,
        this.wanderTarget.y - this.position.y
      ).normalize().mult(this.maxSpeed * 0.3);
      tempSteer.sub(this.velocity).limit(this.maxForce * 0.2);
      this.velocity.add(tempSteer);
    }
    
    // Return to idle when energy is sufficient
    if (this.energy >= this.stats.maxEnergy * 0.6) {
      this.setState('idle');
      this.huntDuration = 0;
    }
  }

  /**
   * Begin a hunt - transition to hunting/scanning state
   */
  protected beginHunt(flockCenter: Vector2): void {
    this.setState('scanning');
    this.target = flockCenter.clone();
    this.huntDuration = 0;
  }

  /**
   * Register a successful hunt
   */
  protected registerSuccess(): void {
    this.successfulHunts++;
    this.consumeAttackEnergy();
    this.cooldown = 3 + Math.random() * 2;
    this.huntDuration = 0;
  }

  /**
   * Register a failed hunt
   */
  protected registerFailure(): void {
    this.failedHunts++;
    this.cooldown = 1.5 + Math.random();
    this.huntDuration = 0;
  }

  /**
   * Find and score potential targets using intelligent selection
   */
  protected findBestTarget(birds: Bird[], flockCenter: Vector2): ITargetScore | null {
    if (birds.length === 0) return null;
    
    const scores: ITargetScore[] = [];
    
    for (const bird of birds) {
      const score = this.scorePrey(bird, birds, flockCenter);
      if (score.totalScore > 0) {
        scores.push(score);
      }
    }
    
    if (scores.length === 0) return null;
    
    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);
    
    // Return best target (with some randomness in top picks)
    const topCount = Math.min(3, scores.length);
    const idx = Math.floor(Math.random() * topCount);
    return scores[idx];
  }

  /**
   * Score a potential prey bird
   */
  protected scorePrey(bird: Bird, allBirds: Bird[], flockCenter: Vector2): ITargetScore {
    const pos = { x: bird.position.x, y: bird.position.y };
    
    // Calculate isolation score (distance from nearest neighbors)
    let minNeighborDist = Infinity;
    let neighborCount = 0;
    for (const other of allBirds) {
      if (other.id === bird.id) continue;
      const dist = bird.position.dist(other.position);
      if (dist < 100) neighborCount++;
      if (dist < minNeighborDist) minNeighborDist = dist;
    }
    const isolationScore = Math.min(1, minNeighborDist / 80) * (1 - Math.min(1, neighborCount / 10));
    
    // Calculate edge score (distance from flock center)
    const distFromCenter = bird.position.dist(flockCenter);
    const edgeScore = Math.min(1, distFromCenter / 150);
    
    // Calculate velocity score (moving away from flock)
    const toCenter = new Vector2(
      flockCenter.x - bird.position.x,
      flockCenter.y - bird.position.y
    ).normalize();
    const birdDir = bird.velocity.clone().normalize();
    const dot = toCenter.x * birdDir.x + toCenter.y * birdDir.y;
    const velocityScore = Math.max(0, -dot); // Higher score if moving away
    
    // Panic score (already panicked birds are easier targets)
    const panicScore = bird.panicLevel * 0.5;
    
    // Intercept score (can we reach the bird?)
    const distToBird = this.position.dist(bird.position);
    const interceptScore = Math.max(0, 1 - distToBird / 400);
    
    // Calculate total score with type-specific weighting
    const weights = this.getTargetWeights();
    const totalScore = 
      isolationScore * weights.isolation +
      edgeScore * weights.edge +
      velocityScore * weights.velocity +
      panicScore * weights.panic +
      interceptScore * weights.intercept;
    
    return {
      birdId: bird.id,
      position: pos,
      isolationScore,
      edgeScore,
      velocityScore,
      panicScore,
      interceptScore,
      totalScore
    };
  }

  /**
   * Get target selection weights - override in subclasses for different priorities
   */
  protected getTargetWeights(): { isolation: number; edge: number; velocity: number; panic: number; intercept: number } {
    return {
      isolation: 1.0,
      edge: 0.8,
      velocity: 0.6,
      panic: 0.4,
      intercept: 1.0
    };
  }

  /**
   * Find the closest bird to the predator
   */
  protected findClosestBird(birds: Bird[]): Bird | null {
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
   * Steer toward a target position
   */
  protected steerToward(targetX: number, targetY: number, speedMult: number = 1, forceMult: number = 1): void {
    tempToTarget.set(targetX - this.position.x, targetY - this.position.y);
    tempSteer.copy(tempToTarget).normalize().mult(this.maxSpeed * speedMult);
    tempSteer.sub(this.velocity).limit(this.maxForce * forceMult);
    this.velocity.add(tempSteer);
  }

  /**
   * Apply soft boundary force
   */
  protected applyBoundaryForce(): void {
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
  protected getRandomEdgePosition(): Vector2 {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: return new Vector2(Math.random() * this.width, 50);
      case 1: return new Vector2(this.width - 50, Math.random() * this.height);
      case 2: return new Vector2(Math.random() * this.width, this.height - 50);
      default: return new Vector2(50, Math.random() * this.height);
    }
  }

  /**
   * Get random wander target (biased toward edges)
   */
  protected getRandomWanderTarget(): Vector2 {
    const margin = 150;
    
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
  protected setState(newState: PredatorBehaviorState): void {
    this.state = newState;
    this.stateTime = 0;
    
    if (newState === 'idle') {
      this.wanderTarget = this.getRandomWanderTarget();
      this.target = null;
      this.targetBirdId = null;
    }
  }

  /**
   * Get effective panic radius - can be overridden by subclasses
   * Owl uses stealthRadius when stealthed, Falcon reduces at altitude
   */
  getEffectivePanicRadius(): number {
    return this.panicRadius;
  }

  /**
   * Get current state for display
   */
  getState(): IPredatorState {
    return {
      id: this.id,
      type: this.type,
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      target: this.target ? { x: this.target.x, y: this.target.y } : null,
      targetBirdId: this.targetBirdId,
      state: this.state,
      energy: this.energy,
      maxEnergy: this.stats.maxEnergy,
      cooldown: this.cooldown,
      panicRadius: this.getEffectivePanicRadius(),
      huntDuration: this.huntDuration,
      successfulHunts: this.successfulHunts,
      failedHunts: this.failedHunts
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
    this.velocity = Vector2.random().mult(3);
    this.target = null;
    this.targetBirdId = null;
    this.state = 'idle';
    this.stateTime = 0;
    this.cooldown = 0;
    this.energy = this.stats.maxEnergy;
    this.recoveryTimer = 0;
    this.huntDuration = 0;
    this.wanderTarget = this.getRandomWanderTarget();
    // Don't reset hunt statistics
  }
}
