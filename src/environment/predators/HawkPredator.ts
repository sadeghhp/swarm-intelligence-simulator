/**
 * HawkPredator - Edge hunting specialist
 * Version: 2.0.0
 * 
 * Hunting Strategy: Edge Hunting
 * - Circles around flock perimeter
 * - Identifies birds that stray from the group
 * - Quick acceleration bursts to cut off escape routes
 * - High agility, medium stamina
 * 
 * Best against: Isolated birds on flock edges
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

/** Pre-allocated vector */
const tempCircle = new Vector2();

export class HawkPredator extends BasePredator {
  public readonly type: PredatorType = 'hawk';
  public readonly color: string = '#ff6b35';
  public readonly panicRadius: number = 120;

  protected readonly stats: IPredatorStats = {
    maxEnergy: 80,
    energyRegenRate: 8,
    huntingDrain: 12,
    attackCost: 20,
    exhaustionThreshold: 15,
    burstMultiplier: 1.8,  // Burst speed: 22 * 1.8 = ~40 (realistic hawk dive)
    staminaRecoveryDelay: 2
  };

  /** Circling angle around flock */
  private circleAngle: number = 0;
  
  /** Distance to maintain from flock center while circling */
  private circleRadius: number = 200;
  
  /** Is in burst mode */
  private isBursting: boolean = false;
  
  /** Burst timer */
  private burstTimer: number = 0;

  constructor(width: number, height: number) {
    super(width, height);
    // Hawks are agile and fast - slightly faster than prey (starlings ~15)
    // Real hawks: 40-50 mph cruising, 120 mph diving
    this.maxSpeed = 22;
    this.maxForce = 1.2;
    this.attackDistance = 45;
    this.huntingDuration = 6;
    this.circleAngle = Math.random() * Math.PI * 2;
    this.initializeEnergy();
  }

  /**
   * Hawk-specific behavior state machine
   */
  protected updateBehavior(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Update burst timer
    if (this.isBursting) {
      this.burstTimer -= deltaTime;
      if (this.burstTimer <= 0) {
        this.isBursting = false;
      }
    }

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
        this.updateHunting(deltaTime, config, birds, flockCenter);
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
   * Scanning: Circle around flock, looking for targets
   */
  private updateScanning(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Update circle angle
    this.circleAngle += deltaTime * 0.5;
    
    // Calculate circling position
    tempCircle.set(
      flockCenter.x + Math.cos(this.circleAngle) * this.circleRadius,
      flockCenter.y + Math.sin(this.circleAngle) * this.circleRadius
    );
    
    // Steer toward circle position
    this.steerToward(tempCircle.x, tempCircle.y, 0.8, 0.6);
    
    // Look for isolated targets
    const bestTarget = this.findBestTarget(birds, flockCenter);
    if (bestTarget && bestTarget.isolationScore > 0.4) {
      this.target = new Vector2(bestTarget.position.x, bestTarget.position.y);
      this.targetBirdId = bestTarget.birdId;
      this.setState('stalking');
    }
    
    // Timeout - return to idle
    if (this.stateTime > 8) {
      this.setState('idle');
    }
  }

  /**
   * Stalking: Approach target carefully
   */
  private updateStalking(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Find target bird
    const targetBird = birds.find(b => b.id === this.targetBirdId);
    if (!targetBird) {
      this.setState('scanning');
      return;
    }
    
    // Update target position
    this.target = targetBird.position.clone();
    
    // Calculate approach angle (from the side, away from flock)
    const toFlock = new Vector2(
      flockCenter.x - targetBird.position.x,
      flockCenter.y - targetBird.position.y
    ).normalize();
    
    // Approach from opposite side of flock
    const approachPoint = new Vector2(
      targetBird.position.x - toFlock.x * 80,
      targetBird.position.y - toFlock.y * 80
    );
    
    const distToApproach = this.position.dist(approachPoint);
    
    if (distToApproach > 50) {
      // Still approaching
      this.steerToward(approachPoint.x, approachPoint.y, 0.9, 0.7);
    } else {
      // Close enough, begin hunting
      this.setState('hunting');
    }
    
    // Check if target rejoined flock
    const targetScore = this.scorePrey(targetBird, birds, flockCenter);
    if (targetScore.isolationScore < 0.2) {
      // Target is no longer isolated, find new target
      this.setState('scanning');
    }
    
    // Timeout
    if (this.stateTime > 5) {
      this.setState('scanning');
    }
  }

  /**
   * Hunting: Active pursuit with burst capability
   */
  private updateHunting(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    const targetBird = birds.find(b => b.id === this.targetBirdId);
    if (!targetBird) {
      this.registerFailure();
      this.setState('idle');
      return;
    }
    
    // Update target
    this.target = targetBird.position.clone();
    
    // Calculate intercept point
    const interceptX = targetBird.position.x + targetBird.velocity.x * 0.5;
    const interceptY = targetBird.position.y + targetBird.velocity.y * 0.5;
    
    // Determine if we should burst
    const distToTarget = this.position.dist(targetBird.position);
    if (distToTarget < 120 && !this.isBursting && this.energy > this.stats.attackCost * 1.5) {
      this.isBursting = true;
      this.burstTimer = 1.5;
    }
    
    // Steer with burst multiplier if active
    const speedMult = this.isBursting ? 1.4 : 1.1;
    const forceMult = this.isBursting ? 1.8 : 1.0;
    this.steerToward(interceptX, interceptY, speedMult, forceMult);
    
    // Extra energy drain during burst
    if (this.isBursting) {
      this.energy -= this.stats.huntingDrain * 0.5 * deltaTime;
    }
    
    // Transition to attack when close
    if (distToTarget < this.attackDistance * 1.5) {
      this.setState('attacking');
    }
    
    // Timeout or target escaped
    if (this.stateTime > this.huntingDuration || distToTarget > 300) {
      this.registerFailure();
      this.setState('idle');
    }
  }

  /**
   * Attacking: Final strike
   */
  private updateAttacking(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    const targetBird = birds.find(b => b.id === this.targetBirdId);
    
    if (targetBird) {
      this.target = targetBird.position.clone();
    }
    
    if (!this.target) {
      this.registerFailure();
      this.setState('idle');
      return;
    }
    
    // Maximum aggression
    this.steerToward(this.target.x, this.target.y, 1.6, 2.5);
    
    const dist = this.position.dist(this.target);
    
    // Check for successful strike
    if (dist < this.attackDistance) {
      this.registerSuccess();
      this.setState('recovering');
      this.velocity.mult(-0.3); // Recoil
      return;
    }
    
    // Attack timeout
    if (this.stateTime > 2) {
      this.registerFailure();
      this.setState('idle');
    }
  }

  /**
   * Override target weights for hawk's edge-hunting preference
   */
  protected getTargetWeights() {
    return {
      isolation: 1.5,  // Hawks strongly prefer isolated targets
      edge: 1.2,       // Prefer birds on the edge
      velocity: 0.8,   // Some preference for birds moving away
      panic: 0.3,      // Less focus on panicked birds
      intercept: 1.0
    };
  }
}
