/**
 * FalconPredator - Stoop diving specialist (Peregrine-style)
 * Version: 2.0.0
 * 
 * Hunting Strategy: Stoop Diving
 * - Maintains simulated "altitude" (reduced panic trigger while high)
 * - Calculates intercept trajectory
 * - High-speed dive with 2-3x normal speed
 * - Recovery period after dive (success or fail)
 * 
 * Best against: Any bird, excels at high-speed interception
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

export class FalconPredator extends BasePredator {
  public readonly type: PredatorType = 'falcon';
  public readonly color: string = '#4ecdc4';
  public readonly panicRadius: number = 180;

  protected readonly stats: IPredatorStats = {
    maxEnergy: 60,
    energyRegenRate: 6,
    huntingDrain: 10,
    attackCost: 30,
    exhaustionThreshold: 10,
    burstMultiplier: 3.5, // Extreme dive speed (18 * 3.5 = 63) - Peregrines dive 4x+ faster
    staminaRecoveryDelay: 3
  };

  /** Simulated altitude (0 = ground level, 1 = maximum) */
  public altitude: number = 0;
  
  /** Maximum altitude */
  private readonly maxAltitude: number = 1;
  
  /** Altitude climb rate */
  private readonly climbRate: number = 0.15;
  
  /** Dive speed multiplier - Peregrines dive at 200+ mph vs 60 mph cruising */
  private readonly diveSpeedMultiplier: number = 3.5;
  
  /** Whether currently in a dive */
  private isDiving: boolean = false;
  
  /** Dive start position (for rendering trail) */
  private diveStartPosition: Vector2 | null = null;
  
  /** Minimum altitude to initiate dive */
  private readonly minDiveAltitude: number = 0.6;

  constructor(width: number, height: number) {
    super(width, height);
    // Peregrines cruise at ~60 mph, starlings at ~45 mph
    // In simulation: prey = 15, falcon cruising = 18, diving = 63
    this.maxSpeed = 18;
    this.maxForce = 0.7;
    this.attackDistance = 55;
    this.huntingDuration = 10;
    this.initializeEnergy();
  }

  /**
   * Falcon-specific behavior state machine
   */
  protected updateBehavior(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    switch (this.state) {
      case 'idle':
        this.updateIdle(deltaTime, config, flockCenter);
        break;
      case 'scanning':
        this.updateScanning(deltaTime, config, birds, flockCenter);
        break;
      case 'stalking':
        this.updateClimbing(deltaTime, config, birds, flockCenter);
        break;
      case 'diving':
        this.updateDiving(deltaTime, config, birds);
        break;
      case 'recovering':
        this.updateRecovering(deltaTime);
        break;
    }
  }

  /**
   * Override idle to maintain some altitude awareness
   */
  protected updateIdle(deltaTime: number, config: IEnvironmentConfig, flockCenter: Vector2): void {
    // Slowly lose altitude while idle
    this.altitude = Math.max(0, this.altitude - deltaTime * 0.1);
    this.isDiving = false;
    this.diveStartPosition = null;
    
    super.updateIdle(deltaTime, config, flockCenter);
  }

  /**
   * Scanning: Look for targets while gaining some altitude
   */
  private updateScanning(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Gain altitude while scanning
    this.altitude = Math.min(this.maxAltitude * 0.4, this.altitude + this.climbRate * deltaTime);
    
    // Circle at a distance from flock
    const circleRadius = 250;
    const angle = this.time * 0.3;
    const targetX = flockCenter.x + Math.cos(angle) * circleRadius;
    const targetY = flockCenter.y + Math.sin(angle) * circleRadius;
    
    this.steerToward(targetX, targetY, 0.7, 0.5);
    
    // Look for targets
    const bestTarget = this.findBestTarget(birds, flockCenter);
    if (bestTarget && bestTarget.totalScore > 0.5) {
      this.target = new Vector2(bestTarget.position.x, bestTarget.position.y);
      this.targetBirdId = bestTarget.birdId;
      this.setState('stalking'); // Climbing state
    }
    
    // Timeout
    if (this.stateTime > 10) {
      this.setState('idle');
    }
  }

  /**
   * Climbing: Gain altitude for dive while tracking target
   */
  private updateClimbing(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Climb to dive altitude
    this.altitude = Math.min(this.maxAltitude, this.altitude + this.climbRate * deltaTime);
    
    // Find target bird
    const targetBird = birds.find(b => b.id === this.targetBirdId);
    if (!targetBird) {
      this.setState('scanning');
      return;
    }
    
    // Update target position
    this.target = targetBird.position.clone();
    
    // Position ourselves above and ahead of target
    const leadTime = 1.5;
    const interceptX = targetBird.position.x + targetBird.velocity.x * leadTime;
    const interceptY = targetBird.position.y + targetBird.velocity.y * leadTime;
    
    // Stay above but track lateral position
    this.steerToward(interceptX, interceptY, 0.5, 0.4);
    
    // Check if ready to dive
    if (this.altitude >= this.minDiveAltitude && this.energy > this.stats.attackCost) {
      // Calculate if we have a good dive angle
      const distToTarget = this.position.dist(targetBird.position);
      if (distToTarget > 100 && distToTarget < 350) {
        this.initiateDive(targetBird);
      }
    }
    
    // Timeout - can't get good position
    if (this.stateTime > 6) {
      this.registerFailure();
      this.setState('idle');
    }
  }

  /**
   * Initiate a stoop dive
   */
  private initiateDive(targetBird: Bird): void {
    this.isDiving = true;
    this.diveStartPosition = this.position.clone();
    this.setState('diving');
    
    // Calculate intercept point with lead
    const leadTime = this.calculateLeadTime(targetBird);
    const interceptX = targetBird.position.x + targetBird.velocity.x * leadTime;
    const interceptY = targetBird.position.y + targetBird.velocity.y * leadTime;
    
    this.target = new Vector2(interceptX, interceptY);
    
    // Initial dive velocity boost
    const diveDirection = new Vector2(
      interceptX - this.position.x,
      interceptY - this.position.y
    ).normalize();
    
    this.velocity.set(
      diveDirection.x * this.maxSpeed * 1.5,
      diveDirection.y * this.maxSpeed * 1.5
    );
  }

  /**
   * Calculate lead time for intercept
   */
  private calculateLeadTime(targetBird: Bird): number {
    const dist = this.position.dist(targetBird.position);
    const diveSpeed = this.maxSpeed * this.diveSpeedMultiplier;
    const targetSpeed = targetBird.velocity.mag();
    
    // Simple intercept calculation
    if (diveSpeed > targetSpeed) {
      return dist / (diveSpeed - targetSpeed * 0.5);
    }
    return dist / diveSpeed;
  }

  /**
   * Diving: High-speed attack descent
   */
  private updateDiving(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    // Rapidly lose altitude during dive
    this.altitude = Math.max(0, this.altitude - deltaTime * 2);
    
    // Heavy energy drain during dive
    this.energy -= this.stats.huntingDrain * 2 * deltaTime;
    
    // Update target position with prediction
    const targetBird = birds.find(b => b.id === this.targetBirdId);
    if (targetBird) {
      // Continuous intercept adjustment
      const leadTime = 0.3;
      const interceptX = targetBird.position.x + targetBird.velocity.x * leadTime;
      const interceptY = targetBird.position.y + targetBird.velocity.y * leadTime;
      this.target = new Vector2(interceptX, interceptY);
    }
    
    if (!this.target) {
      this.endDive(false);
      return;
    }
    
    // Aggressive steering toward target
    this.steerToward(this.target.x, this.target.y, this.diveSpeedMultiplier, 3.0);
    
    const dist = this.position.dist(this.target);
    
    // Check for hit
    if (dist < this.attackDistance) {
      this.endDive(true);
      return;
    }
    
    // Dive timeout or altitude too low
    if (this.stateTime > 2.5 || this.altitude <= 0) {
      this.endDive(false);
    }
  }

  /**
   * End the dive attack
   */
  private endDive(success: boolean): void {
    this.isDiving = false;
    this.altitude = 0;
    
    if (success) {
      this.registerSuccess();
    } else {
      this.registerFailure();
    }
    
    // Strong recovery needed after dive
    this.setState('recovering');
    this.cooldown = success ? 4 : 2;
    
    // Velocity reduction after dive (pull-up)
    this.velocity.mult(0.3);
  }

  /**
   * Override recovery to regain altitude slowly
   */
  protected updateRecovering(deltaTime: number): void {
    super.updateRecovering(deltaTime);
    
    // Very slowly regain altitude capability during recovery
    if (this.energy > this.stats.maxEnergy * 0.3) {
      this.altitude = Math.min(0.2, this.altitude + deltaTime * 0.02);
    }
  }

  /**
   * Override getState to include altitude
   */
  getState() {
    const baseState = super.getState();
    return {
      ...baseState,
      altitude: this.altitude,
      isDiving: this.isDiving
    };
  }

  /**
   * Get panic radius - reduced when at altitude (less visible to prey)
   */
  getEffectivePanicRadius(): number {
    // Panic radius is reduced at higher altitude
    return this.panicRadius * (1 - this.altitude * 0.6);
  }

  /**
   * Override target weights for falcon's intercept preference
   */
  protected getTargetWeights() {
    return {
      isolation: 0.6,   // Less important for falcon
      edge: 0.5,        // Can target anywhere
      velocity: 0.4,    // Slightly prefer predictable movement
      panic: 0.2,       // Panicked birds are harder to intercept
      intercept: 1.8    // Strong preference for interceptable targets
    };
  }

  /**
   * Reset falcon-specific state
   */
  reset(): void {
    super.reset();
    this.altitude = 0;
    this.isDiving = false;
    this.diveStartPosition = null;
  }
}
