/**
 * SharkPredator - Ocean sustained pursuit specialist
 * Version: 1.0.0
 * 
 * Hunting Strategy: Sustained Pursuit with Circling
 * - Circles schools detecting stragglers and isolated targets
 * - High stamina for extended pursuits
 * - Moderate speed but relentless
 * - Excellent at tracking prey through turns
 * 
 * Best against: Fish schools, slower aquatic creatures
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

/** Pre-allocated vector for circling */
const tempCircle = new Vector2();

export class SharkPredator extends BasePredator {
  public readonly type: PredatorType = 'shark';
  public readonly color: string = '#5f7c8a';
  public readonly panicRadius: number = 180;

  protected readonly stats: IPredatorStats = {
    maxEnergy: 100,          // Good stamina
    energyRegenRate: 6,      // Moderate regen
    huntingDrain: 8,         // Efficient hunter
    attackCost: 18,
    exhaustionThreshold: 18,
    burstMultiplier: 1.5,    // Good burst for final strike
    staminaRecoveryDelay: 2
  };

  /** Circling angle around school */
  private circleAngle: number = 0;
  
  /** Current circling radius */
  private circleRadius: number = 250;
  
  /** Pursuit time for current target */
  private pursuitTime: number = 0;
  
  /** Maximum pursuit time */
  private readonly maxPursuitTime: number = 12;
  
  /** Locked target ID */
  private lockedTargetId: number | null = null;
  
  /** Tracking bonus (improves over time during pursuit) */
  private trackingBonus: number = 1.0;

  constructor(width: number, height: number) {
    super(width, height);
    this.maxSpeed = 16;
    this.maxForce = 0.7;
    this.attackDistance = 55;
    this.huntingDuration = 15;
    this.circleAngle = Math.random() * Math.PI * 2;
    this.initializeEnergy();
  }

  /**
   * Shark-specific behavior state machine
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
        this.updateStalking(deltaTime, config, birds, flockCenter);
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
    this.trackingBonus = 1.0;
    this.pursuitTime = 0;
    this.lockedTargetId = null;
    
    super.updateIdle(deltaTime, config, flockCenter);
  }

  /**
   * Scanning: Circle around school looking for targets
   */
  private updateScanning(
    deltaTime: number,
    _config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Update circle angle - slow, menacing circling
    this.circleAngle += deltaTime * 0.4;
    
    // Adjust circle radius based on school size
    const idealRadius = Math.max(180, Math.min(300, birds.length * 0.8));
    this.circleRadius += (idealRadius - this.circleRadius) * deltaTime;
    
    // Calculate circling position
    tempCircle.set(
      flockCenter.x + Math.cos(this.circleAngle) * this.circleRadius,
      flockCenter.y + Math.sin(this.circleAngle) * this.circleRadius
    );
    
    // Steer toward circle position
    this.steerToward(tempCircle.x, tempCircle.y, 0.7, 0.5);
    
    // Look for isolated or edge targets
    const bestTarget = this.findBestTarget(birds, flockCenter);
    if (bestTarget && bestTarget.isolationScore > 0.35) {
      this.lockTarget(bestTarget.birdId, birds);
      this.setState('stalking');
    }
    
    // Timeout
    if (this.stateTime > 10) {
      this.setState('idle');
    }
  }

  /**
   * Lock onto target
   */
  private lockTarget(birdId: number, birds: Bird[]): void {
    const targetBird = birds.find(b => b.id === birdId);
    if (targetBird) {
      this.lockedTargetId = birdId;
      this.targetBirdId = birdId;
      this.target = targetBird.position.clone();
      this.pursuitTime = 0;
      this.trackingBonus = 1.0;
    }
  }

  /**
   * Stalking: Close distance while still circling
   */
  private updateStalking(
    deltaTime: number,
    _config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    const targetBird = birds.find(b => b.id === this.lockedTargetId);
    if (!targetBird) {
      this.setState('scanning');
      return;
    }

    // Update target position
    this.target = targetBird.position.clone();

    // Approach while circling - spiral in
    this.circleAngle += deltaTime * 0.5;
    const currentDist = this.position.dist(targetBird.position);
    const spiralRadius = Math.max(80, currentDist * 0.7);
    
    tempCircle.set(
      targetBird.position.x + Math.cos(this.circleAngle) * spiralRadius,
      targetBird.position.y + Math.sin(this.circleAngle) * spiralRadius
    );

    this.steerToward(tempCircle.x, tempCircle.y, 0.85, 0.6);

    // Transition to active pursuit when close enough
    if (currentDist < 150) {
      this.setState('hunting');
    }

    // Check if target rejoined school
    const targetScore = this.scorePrey(targetBird, birds, flockCenter);
    if (targetScore.isolationScore < 0.15) {
      this.setState('scanning');
    }

    // Timeout
    if (this.stateTime > 6) {
      this.setState('scanning');
    }
  }

  /**
   * Pursuit: Active chase with tracking bonus
   */
  private updatePursuit(
    deltaTime: number,
    _config: IEnvironmentConfig,
    birds: Bird[],
    _flockCenter: Vector2
  ): void {
    const targetBird = birds.find(b => b.id === this.lockedTargetId);
    if (!targetBird) {
      this.lockedTargetId = null;
      this.setState('scanning');
      return;
    }

    // Update pursuit tracking
    this.pursuitTime += deltaTime;
    this.target = targetBird.position.clone();
    this.targetBirdId = this.lockedTargetId;

    // Increase tracking bonus over time (shark gets better at predicting)
    this.trackingBonus = Math.min(1.35, 1.0 + this.pursuitTime * 0.025);

    // Calculate intercept with improved tracking
    const leadFactor = 0.4 * this.trackingBonus;
    const interceptX = targetBird.position.x + targetBird.velocity.x * leadFactor;
    const interceptY = targetBird.position.y + targetBird.velocity.y * leadFactor;

    // Pursue with tracking bonus
    this.steerToward(interceptX, interceptY, this.trackingBonus, 0.9);

    const distToTarget = this.position.dist(targetBird.position);

    // Transition to attack when close
    if (distToTarget < this.attackDistance * 1.8) {
      this.setState('attacking');
    }

    // Give up conditions
    if (this.pursuitTime > this.maxPursuitTime || distToTarget > 350) {
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
   * Attacking: Final strike with burst
   */
  private updateAttacking(
    _deltaTime: number,
    _config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    const targetBird = birds.find(b => b.id === this.lockedTargetId);

    if (targetBird) {
      this.target = targetBird.position.clone();
      
      // Lead the target
      const leadTime = 0.15;
      const interceptX = targetBird.position.x + targetBird.velocity.x * leadTime;
      const interceptY = targetBird.position.y + targetBird.velocity.y * leadTime;
      this.target.set(interceptX, interceptY);
    }

    if (!this.target) {
      this.registerFailure();
      this.setState('idle');
      return;
    }

    // Burst strike
    this.steerToward(this.target.x, this.target.y, 1.5, 2.2);

    const dist = this.position.dist(this.target);

    // Success check
    if (dist < this.attackDistance) {
      this.registerSuccess();
      this.setState('recovering');
      this.velocity.mult(0.3);
      return;
    }

    // If target escapes, resume pursuit
    if (dist > this.attackDistance * 2.5 && this.stateTime > 0.8) {
      this.setState('hunting');
    }

    // Attack timeout
    if (this.stateTime > 2.5) {
      this.registerFailure();
      this.setState('idle');
    }
  }

  /**
   * Override target weights for shark's circling/isolation preference
   */
  protected getTargetWeights() {
    return {
      isolation: 1.3,   // Strongly prefer isolated targets
      edge: 1.0,        // Good on edge targets
      velocity: 0.7,    // Some preference for predictable movement
      panic: 0.5,       // Panicked prey moves erratically
      intercept: 0.9    // Good intercept capability
    };
  }

  /**
   * Reset shark-specific state
   */
  reset(): void {
    super.reset();
    this.lockedTargetId = null;
    this.pursuitTime = 0;
    this.trackingBonus = 1.0;
    this.circleAngle = Math.random() * Math.PI * 2;
  }
}
