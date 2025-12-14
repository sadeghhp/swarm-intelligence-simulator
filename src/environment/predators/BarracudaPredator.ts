/**
 * BarracudaPredator - Ocean ambush burst specialist
 * Version: 1.0.0
 * 
 * Hunting Strategy: Ambush with Burst
 * - Waits motionless in strategic positions
 * - Detects approaching isolated prey
 * - Explosive burst strike at extreme speed
 * - Low stamina but devastating attacks
 * 
 * Best against: Isolated fish, predictable movement patterns
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

export class BarracudaPredator extends BasePredator {
  public readonly type: PredatorType = 'barracuda';
  public readonly color: string = '#c0c0c0';
  public readonly panicRadius: number = 100; // Small panic radius when waiting

  protected readonly stats: IPredatorStats = {
    maxEnergy: 70,           // Lower stamina
    energyRegenRate: 10,     // Fast regen when waiting
    huntingDrain: 15,        // High drain during burst
    attackCost: 25,          // Expensive but powerful attacks
    exhaustionThreshold: 12,
    burstMultiplier: 2.2,    // Extreme burst speed
    staminaRecoveryDelay: 1.5
  };

  /** Ambush position */
  private ambushPosition: Vector2;
  
  /** Time spent waiting in ambush */
  private ambushTime: number = 0;
  
  /** Maximum ambush wait time */
  private readonly maxAmbushTime: number = 10;
  
  /** Ambush detection radius */
  private readonly ambushDetectionRadius: number = 120;
  
  /** Is in burst mode */
  private isBursting: boolean = false;
  
  /** Burst timer */
  private burstTimer: number = 0;
  
  /** Maximum burst duration */
  private readonly maxBurstDuration: number = 1.2;

  constructor(width: number, height: number) {
    super(width, height);
    this.maxSpeed = 12;       // Low cruise speed
    this.maxForce = 1.2;      // High agility for burst
    this.attackDistance = 40; // Precise strike
    this.huntingDuration = 5; // Short active hunting
    this.ambushPosition = this.getStrategicAmbushPosition();
    this.initializeEnergy();
  }

  /**
   * Barracuda-specific behavior state machine
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
        this.updateFindAmbushSpot(deltaTime, config, birds, flockCenter);
        break;
      case 'ambushing':
        this.updateAmbush(deltaTime, config, birds, flockCenter);
        break;
      case 'attacking':
        this.updateBurstAttack(deltaTime, config, birds);
        break;
      case 'recovering':
        this.updateRecovering(deltaTime);
        break;
    }
  }

  /**
   * Override idle
   */
  protected updateIdle(deltaTime: number, config: IEnvironmentConfig, flockCenter: Vector2): void {
    this.isBursting = false;
    this.ambushTime = 0;
    
    super.updateIdle(deltaTime, config, flockCenter);
  }

  /**
   * Find strategic ambush position
   */
  private updateFindAmbushSpot(
    _deltaTime: number,
    _config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Find position near school edge where prey might pass
    this.ambushPosition = this.calculateAmbushPosition(birds, flockCenter);
    
    // Move toward ambush position
    const distToAmbush = this.position.dist(this.ambushPosition);
    
    if (distToAmbush > 30) {
      this.steerToward(this.ambushPosition.x, this.ambushPosition.y, 0.8, 0.6);
    } else {
      // Reached ambush position, start waiting
      this.setState('ambushing');
    }

    // Timeout
    if (this.stateTime > 8) {
      // Try ambushing from current position
      this.ambushPosition = this.position.clone();
      this.setState('ambushing');
    }
  }

  /**
   * Calculate strategic ambush position
   */
  private calculateAmbushPosition(birds: Bird[], flockCenter: Vector2): Vector2 {
    // Position at the edge of the school in the direction of movement
    let avgVelX = 0;
    let avgVelY = 0;
    
    for (const bird of birds) {
      avgVelX += bird.velocity.x;
      avgVelY += bird.velocity.y;
    }
    
    if (birds.length > 0) {
      avgVelX /= birds.length;
      avgVelY /= birds.length;
    }

    // Normalize movement direction
    const velMag = Math.sqrt(avgVelX * avgVelX + avgVelY * avgVelY);
    if (velMag > 0.1) {
      avgVelX /= velMag;
      avgVelY /= velMag;
    } else {
      // Random direction if school is stationary
      const angle = Math.random() * Math.PI * 2;
      avgVelX = Math.cos(angle);
      avgVelY = Math.sin(angle);
    }

    // Position ahead of school movement
    const ambushDistance = 150 + Math.random() * 100;
    return new Vector2(
      flockCenter.x + avgVelX * ambushDistance,
      flockCenter.y + avgVelY * ambushDistance
    );
  }

  /**
   * Ambush: Wait motionless for prey
   */
  private updateAmbush(
    deltaTime: number,
    _config: IEnvironmentConfig,
    birds: Bird[],
    _flockCenter: Vector2
  ): void {
    this.ambushTime += deltaTime;

    // Almost stop - slight drift only
    this.velocity.mult(0.95);

    // Scan for approaching prey
    const targetInRange = this.findAmbushTarget(birds);
    
    if (targetInRange) {
      this.targetBirdId = targetInRange.id;
      this.target = targetInRange.position.clone();
      this.triggerBurst();
      this.setState('attacking');
      return;
    }

    // Timeout - find new ambush spot
    if (this.ambushTime > this.maxAmbushTime) {
      this.setState('scanning');
    }
  }

  /**
   * Find prey approaching ambush position
   */
  private findAmbushTarget(birds: Bird[]): Bird | null {
    let bestTarget: Bird | null = null;
    let bestScore = 0;
    const detectionRadiusSq = this.ambushDetectionRadius * this.ambushDetectionRadius;

    for (const bird of birds) {
      const dx = bird.position.x - this.position.x;
      const dy = bird.position.y - this.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > detectionRadiusSq) continue;

      // Check if bird is approaching (moving toward us)
      const dist = Math.sqrt(distSq);
      if (dist < 1) continue;

      const toUs = new Vector2(-dx / dist, -dy / dist);
      const birdDir = bird.velocity.clone().normalize();
      const approachDot = toUs.x * birdDir.x + toUs.y * birdDir.y;

      // Must be approaching (dot > 0)
      if (approachDot < 0.2) continue;

      // Score: closer + more direct approach = better
      const proximityScore = 1 - (dist / this.ambushDetectionRadius);
      const approachScore = approachDot;
      const score = proximityScore * 0.6 + approachScore * 0.4;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = bird;
      }
    }

    return bestTarget;
  }

  /**
   * Trigger burst mode
   */
  private triggerBurst(): void {
    this.isBursting = true;
    this.burstTimer = this.maxBurstDuration;
  }

  /**
   * Burst attack: Explosive strike
   */
  private updateBurstAttack(
    deltaTime: number,
    _config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    const targetBird = birds.find(b => b.id === this.targetBirdId);

    if (targetBird) {
      this.target = targetBird.position.clone();
      
      // Minimal lead - barracuda relies on raw speed
      const leadTime = 0.1;
      const interceptX = targetBird.position.x + targetBird.velocity.x * leadTime;
      const interceptY = targetBird.position.y + targetBird.velocity.y * leadTime;
      this.target.set(interceptX, interceptY);
    }

    if (!this.target) {
      this.registerFailure();
      this.setState('idle');
      return;
    }

    // Explosive burst - maximum speed and force
    const burstMult = this.isBursting ? 2.2 : 1.2;
    const forceMult = this.isBursting ? 3.0 : 1.5;
    this.steerToward(this.target.x, this.target.y, burstMult, forceMult);

    // Extra energy drain during burst
    if (this.isBursting) {
      this.energy -= this.stats.huntingDrain * deltaTime;
    }

    const dist = this.position.dist(this.target);

    // Success check - tight strike zone
    if (dist < this.attackDistance) {
      this.registerSuccess();
      this.setState('recovering');
      this.velocity.mult(0.2); // Sharp deceleration
      return;
    }

    // Burst ended without hit
    if (!this.isBursting && this.stateTime > 0.5) {
      this.registerFailure();
      this.setState('recovering');
    }

    // Attack timeout
    if (this.stateTime > 2) {
      this.registerFailure();
      this.setState('recovering');
    }
  }

  /**
   * Get strategic ambush position near edges
   */
  private getStrategicAmbushPosition(): Vector2 {
    const margin = 150;
    return new Vector2(
      margin + Math.random() * (this.width - margin * 2),
      margin + Math.random() * (this.height - margin * 2)
    );
  }

  /**
   * Override target weights for ambush preference
   */
  protected getTargetWeights() {
    return {
      isolation: 1.8,   // Strongly prefer isolated targets
      edge: 0.5,        // Position in flock less important
      velocity: 1.0,    // Predictable movement is key
      panic: 0.2,       // Avoid panicked (erratic) targets
      intercept: 1.5    // Intercept is crucial for ambush
    };
  }

  /**
   * Override to use ambushing state
   */
  protected beginHunt(_flockCenter: Vector2): void {
    this.setState('scanning');
    this.huntDuration = 0;
  }

  /**
   * Reset barracuda-specific state
   */
  reset(): void {
    super.reset();
    this.isBursting = false;
    this.burstTimer = 0;
    this.ambushTime = 0;
    this.ambushPosition = this.getStrategicAmbushPosition();
  }
}
