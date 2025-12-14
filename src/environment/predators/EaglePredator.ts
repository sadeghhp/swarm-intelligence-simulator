/**
 * EaglePredator - Sustained pursuit specialist
 * Version: 2.0.0
 * 
 * Hunting Strategy: Sustained Pursuit
 * - Locks onto a single target and maintains pursuit
 * - High stamina allows extended chases
 * - Slower but powerful, wears down prey
 * - Target eventually tires and slows
 * 
 * Best against: Slower birds, sustained chases
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

export class EaglePredator extends BasePredator {
  public readonly type: PredatorType = 'eagle';
  public readonly color: string = '#8b4513';
  public readonly panicRadius: number = 200;

  protected readonly stats: IPredatorStats = {
    maxEnergy: 120,         // High stamina
    energyRegenRate: 5,     // Slower regen
    huntingDrain: 6,        // Very efficient hunter
    attackCost: 15,
    exhaustionThreshold: 20,
    burstMultiplier: 1.3,   // Modest burst
    staminaRecoveryDelay: 2.5
  };

  /** Current locked target (persistent across state changes) */
  private lockedTargetId: number | null = null;
  
  /** Time pursuing current target */
  private pursuitTime: number = 0;
  
  /** Maximum pursuit time before giving up */
  private readonly maxPursuitTime: number = 15;
  
  /** Pursuit bonus speed multiplier (increases over time) */
  private pursuitBonus: number = 1.0;
  
  /** Rate at which pursuit bonus increases */
  private readonly pursuitBonusRate: number = 0.02;
  
  /** Maximum pursuit bonus */
  private readonly maxPursuitBonus: number = 1.4;
  
  /** Target exhaustion tracker (simulated prey fatigue) */
  private targetExhaustion: number = 0;

  constructor(width: number, height: number) {
    super(width, height);
    // Eagles cruise ~30-40 mph, similar to prey but with incredible endurance
    // Pursuit bonus builds to 1.4x, so 18 * 1.4 = 25.2 at max pursuit
    this.maxSpeed = 18;
    this.maxForce = 0.6;    // Deliberate but powerful movements
    this.attackDistance = 60;
    this.huntingDuration = 20; // Long hunting duration
    this.initializeEnergy();
  }

  /**
   * Eagle-specific behavior state machine
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
      case 'hunting':
        this.updatePursuit(deltaTime, config, birds, flockCenter);
        break;
      case 'attacking':
        this.updateAttacking(deltaTime, config, birds);
        break;
      case 'recovering':
        this.updateRecovering(deltaTime);
        break;
    }
  }

  /**
   * Override idle to reset pursuit state
   */
  protected updateIdle(deltaTime: number, config: IEnvironmentConfig, flockCenter: Vector2): void {
    this.pursuitBonus = 1.0;
    this.targetExhaustion = 0;
    this.pursuitTime = 0;
    this.lockedTargetId = null;
    
    super.updateIdle(deltaTime, config, flockCenter);
  }

  /**
   * Scanning: Survey the flock for the best target
   */
  private updateScanning(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Move toward flock at moderate pace
    this.steerToward(flockCenter.x, flockCenter.y, 0.6, 0.4);
    
    // Evaluate all targets more thoroughly
    const bestTarget = this.findBestTarget(birds, flockCenter);
    if (bestTarget) {
      this.lockTarget(bestTarget.birdId, birds);
      this.setState('hunting');
    }
    
    // Timeout
    if (this.stateTime > 8) {
      this.setState('idle');
    }
  }

  /**
   * Lock onto a target for sustained pursuit
   */
  private lockTarget(birdId: number, birds: Bird[]): void {
    const targetBird = birds.find(b => b.id === birdId);
    if (targetBird) {
      this.lockedTargetId = birdId;
      this.targetBirdId = birdId;
      this.target = targetBird.position.clone();
      this.pursuitTime = 0;
      this.pursuitBonus = 1.0;
      this.targetExhaustion = 0;
    }
  }

  /**
   * Sustained pursuit: Relentless chase that wears down prey
   */
  private updatePursuit(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Find locked target
    const targetBird = birds.find(b => b.id === this.lockedTargetId);
    if (!targetBird) {
      // Target lost, try to find new one
      this.lockedTargetId = null;
      this.setState('scanning');
      return;
    }
    
    // Update pursuit tracking
    this.pursuitTime += deltaTime;
    this.target = targetBird.position.clone();
    this.targetBirdId = this.lockedTargetId;
    
    // Increase pursuit bonus over time (eagle gets faster during chase)
    this.pursuitBonus = Math.min(
      this.maxPursuitBonus,
      1.0 + this.pursuitTime * this.pursuitBonusRate
    );
    
    // Simulate target exhaustion (longer chase = slower prey)
    this.targetExhaustion = Math.min(0.3, this.pursuitTime * 0.015);
    
    // Calculate intercept with lead based on pursuit bonus
    const leadFactor = 0.3 + this.pursuitBonus * 0.2;
    const interceptX = targetBird.position.x + targetBird.velocity.x * leadFactor;
    const interceptY = targetBird.position.y + targetBird.velocity.y * leadFactor;
    
    // Pursue with increasing effectiveness
    this.steerToward(interceptX, interceptY, this.pursuitBonus, 0.8);
    
    const distToTarget = this.position.dist(targetBird.position);
    
    // Transition to attack when close enough
    if (distToTarget < this.attackDistance * 2) {
      this.setState('attacking');
    }
    
    // Give up conditions
    if (this.pursuitTime > this.maxPursuitTime) {
      this.registerFailure();
      this.setState('idle');
    }
    
    // Energy check
    if (this.energy < this.stats.exhaustionThreshold) {
      this.registerFailure();
      this.setState('recovering');
    }
  }

  /**
   * Attacking: Final capture attempt
   */
  private updateAttacking(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    const targetBird = birds.find(b => b.id === this.lockedTargetId);
    
    if (targetBird) {
      this.target = targetBird.position.clone();
      
      // Apply target exhaustion effect (simulated slower prey)
      // This affects how the eagle perceives its advantage
      const effectiveTargetSpeed = targetBird.velocity.mag() * (1 - this.targetExhaustion);
      
      // Calculate intercept accounting for exhausted prey
      const leadTime = 0.2;
      const interceptX = targetBird.position.x + targetBird.velocity.x * leadTime * (1 - this.targetExhaustion);
      const interceptY = targetBird.position.y + targetBird.velocity.y * leadTime * (1 - this.targetExhaustion);
      this.target.set(interceptX, interceptY);
    }
    
    if (!this.target) {
      this.registerFailure();
      this.setState('idle');
      return;
    }
    
    // Powerful final strike
    this.steerToward(this.target.x, this.target.y, this.pursuitBonus * 1.2, 2.0);
    
    const dist = this.position.dist(this.target);
    
    // Success check with bonus from pursuit duration
    const effectiveRange = this.attackDistance * (1 + this.targetExhaustion);
    if (dist < effectiveRange) {
      this.registerSuccess();
      this.setState('recovering');
      this.velocity.mult(0.4);
      return;
    }
    
    // If target escapes attack range, resume pursuit
    if (dist > this.attackDistance * 3 && this.stateTime > 1) {
      this.setState('hunting');
    }
    
    // Attack timeout
    if (this.stateTime > 3) {
      this.registerFailure();
      this.setState('idle');
    }
  }

  /**
   * Override target weights for eagle's pursuit preference
   */
  protected getTargetWeights() {
    return {
      isolation: 0.4,   // Less important, can pursue into flock
      edge: 0.3,        // Position doesn't matter much
      velocity: 1.2,    // Prefer slower birds or predictable movement
      panic: 0.8,       // Panicked birds tire faster
      intercept: 0.6    // Don't need perfect intercept
    };
  }

  /**
   * Override to prefer slower/weaker targets
   */
  protected findBestTarget(birds: Bird[], flockCenter: Vector2) {
    const baseResult = super.findBestTarget(birds, flockCenter);
    if (!baseResult) return null;
    
    // Additional scoring for eagle: prefer birds with lower speed
    const targetBird = birds.find(b => b.id === baseResult.birdId);
    if (targetBird) {
      const speedFactor = 1 - Math.min(1, targetBird.velocity.mag() / 15);
      baseResult.totalScore += speedFactor * 0.5;
    }
    
    return baseResult;
  }

  /**
   * Get pursuit information for display
   */
  getPursuitInfo(): { bonus: number; time: number; exhaustion: number } {
    return {
      bonus: this.pursuitBonus,
      time: this.pursuitTime,
      exhaustion: this.targetExhaustion
    };
  }

  /**
   * Reset eagle-specific state
   */
  reset(): void {
    super.reset();
    this.lockedTargetId = null;
    this.pursuitTime = 0;
    this.pursuitBonus = 1.0;
    this.targetExhaustion = 0;
  }
}
