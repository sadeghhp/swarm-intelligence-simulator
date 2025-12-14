/**
 * OrcaPredator - Ocean pack coordination hunter
 * Version: 1.0.0
 * 
 * Hunting Strategy: Pack Coordination
 * - Simulates intelligent coordinated hunting via larger influence radius
 * - Extremely high stamina for extended hunts
 * - Strategic target selection focusing on larger groups
 * - Creates panic waves that split schools
 * 
 * Best against: Jellyfish, larger groups, slow-moving creatures
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

export class OrcaPredator extends BasePredator {
  public readonly type: PredatorType = 'orca';
  public readonly color: string = '#1a1a2e';
  public readonly panicRadius: number = 250; // Large panic radius simulates pack presence

  protected readonly stats: IPredatorStats = {
    maxEnergy: 150,          // Extremely high stamina
    energyRegenRate: 4,      // Slower regen, but huge capacity
    huntingDrain: 5,         // Very efficient
    attackCost: 12,
    exhaustionThreshold: 25,
    burstMultiplier: 1.4,
    staminaRecoveryDelay: 3
  };

  /** Strategic position offset for "pack" simulation */
  private strategicOffset: Vector2 = new Vector2();
  
  /** Time spent herding/controlling the school */
  private herdingTime: number = 0;
  
  /** Current target density (prefers denser areas to scatter) */
  private targetDensity: number = 0;
  
  /** Locked target ID */
  private lockedTargetId: number | null = null;
  
  /** Coordination bonus (simulates pack effectiveness) */
  private coordinationBonus: number = 1.0;

  constructor(width: number, height: number) {
    super(width, height);
    this.maxSpeed = 14;       // Orcas are powerful but not fastest
    this.maxForce = 0.5;      // Deliberate movements
    this.attackDistance = 70; // Large attack range
    this.huntingDuration = 25; // Very long hunts
    this.strategicOffset = Vector2.random().mult(100);
    this.initializeEnergy();
  }

  /**
   * Orca-specific behavior state machine
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
        this.updateHerding(deltaTime, config, birds, flockCenter);
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
   * Override idle to reset state
   */
  protected updateIdle(deltaTime: number, config: IEnvironmentConfig, flockCenter: Vector2): void {
    this.coordinationBonus = 1.0;
    this.herdingTime = 0;
    this.lockedTargetId = null;
    this.targetDensity = 0;
    
    super.updateIdle(deltaTime, config, flockCenter);
  }

  /**
   * Scanning: Survey the school for strategic attack points
   */
  private updateScanning(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Move toward flock strategically
    const approachPoint = new Vector2(
      flockCenter.x + this.strategicOffset.x,
      flockCenter.y + this.strategicOffset.y
    );
    this.steerToward(approachPoint.x, approachPoint.y, 0.6, 0.4);

    // Analyze school density
    this.targetDensity = this.analyzeSchoolDensity(birds, flockCenter);

    // Look for targets in dense areas (to scatter them)
    const bestTarget = this.findBestTarget(birds, flockCenter);
    if (bestTarget) {
      this.lockTarget(bestTarget.birdId, birds);
      // If dense, go to herding phase first
      if (this.targetDensity > 0.5) {
        this.setState('stalking'); // Use stalking as herding phase
      } else {
        this.setState('hunting');
      }
    }

    // Slowly update strategic offset
    this.strategicOffset.x += (Math.random() - 0.5) * 20 * deltaTime;
    this.strategicOffset.y += (Math.random() - 0.5) * 20 * deltaTime;
    this.strategicOffset.limit(150);

    // Timeout
    if (this.stateTime > 10) {
      this.setState('idle');
    }
  }

  /**
   * Analyze school density around center
   */
  private analyzeSchoolDensity(birds: Bird[], center: Vector2): number {
    let nearbyCount = 0;
    const densityRadius = 100;
    const radiusSq = densityRadius * densityRadius;

    for (const bird of birds) {
      const dx = bird.position.x - center.x;
      const dy = bird.position.y - center.y;
      if (dx * dx + dy * dy < radiusSq) {
        nearbyCount++;
      }
    }

    return Math.min(1, nearbyCount / 50); // Normalize to 0-1
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
      this.herdingTime = 0;
    }
  }

  /**
   * Herding: Move strategically to scatter the school
   */
  private updateHerding(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    this.herdingTime += deltaTime;

    // Build coordination bonus while herding
    this.coordinationBonus = Math.min(1.5, 1.0 + this.herdingTime * 0.05);

    const targetBird = birds.find(b => b.id === this.lockedTargetId);
    if (!targetBird) {
      this.setState('scanning');
      return;
    }

    // Position to drive prey away from school center
    const toCenter = new Vector2(
      flockCenter.x - targetBird.position.x,
      flockCenter.y - targetBird.position.y
    );
    const distToCenter = toCenter.mag();
    
    if (distToCenter > 10) {
      toCenter.normalize();
    }

    // Approach from school side to push target outward
    const herdingPoint = new Vector2(
      targetBird.position.x + toCenter.x * 80,
      targetBird.position.y + toCenter.y * 80
    );

    this.steerToward(herdingPoint.x, herdingPoint.y, 0.8, 0.7);

    // Update target
    this.target = targetBird.position.clone();

    // Check if target is now isolated enough
    const targetScore = this.scorePrey(targetBird, birds, flockCenter);
    if (targetScore.isolationScore > 0.4 || this.herdingTime > 5) {
      this.setState('hunting');
    }

    // Timeout
    if (this.stateTime > 8) {
      this.setState('hunting');
    }
  }

  /**
   * Pursuit: Coordinated chase
   */
  private updatePursuit(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    const targetBird = birds.find(b => b.id === this.lockedTargetId);
    if (!targetBird) {
      this.lockedTargetId = null;
      this.setState('scanning');
      return;
    }

    this.target = targetBird.position.clone();
    this.targetBirdId = this.lockedTargetId;

    // Calculate intercept with coordination bonus
    const leadFactor = 0.35 * this.coordinationBonus;
    const interceptX = targetBird.position.x + targetBird.velocity.x * leadFactor;
    const interceptY = targetBird.position.y + targetBird.velocity.y * leadFactor;

    // Pursue with coordination effectiveness
    this.steerToward(interceptX, interceptY, this.coordinationBonus, 0.8);

    const distToTarget = this.position.dist(targetBird.position);

    // Transition to attack
    if (distToTarget < this.attackDistance * 1.5) {
      this.setState('attacking');
    }

    // Give up conditions (orca is very persistent)
    if (this.huntDuration > this.huntingDuration || distToTarget > 400) {
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
   * Attacking: Powerful coordinated strike
   */
  private updateAttacking(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    const targetBird = birds.find(b => b.id === this.lockedTargetId);

    if (targetBird) {
      this.target = targetBird.position.clone();
      
      // Lead with coordination bonus
      const leadTime = 0.2 * this.coordinationBonus;
      const interceptX = targetBird.position.x + targetBird.velocity.x * leadTime;
      const interceptY = targetBird.position.y + targetBird.velocity.y * leadTime;
      this.target.set(interceptX, interceptY);
    }

    if (!this.target) {
      this.registerFailure();
      this.setState('idle');
      return;
    }

    // Powerful strike
    this.steerToward(this.target.x, this.target.y, 1.4, 2.0);

    const dist = this.position.dist(this.target);

    // Success check with coordination bonus
    const effectiveRange = this.attackDistance * (0.8 + this.coordinationBonus * 0.2);
    if (dist < effectiveRange) {
      this.registerSuccess();
      this.setState('recovering');
      this.velocity.mult(0.4);
      return;
    }

    // Resume pursuit if target escapes
    if (dist > this.attackDistance * 2.5 && this.stateTime > 1) {
      this.setState('hunting');
    }

    // Attack timeout
    if (this.stateTime > 3) {
      this.registerFailure();
      this.setState('idle');
    }
  }

  /**
   * Override target weights for orca's pack hunting preference
   */
  protected getTargetWeights() {
    return {
      isolation: 0.6,    // Can handle grouped targets
      edge: 0.8,         // Prefer edge targets
      velocity: 0.5,     // Speed doesn't matter as much
      panic: 1.0,        // Panicked targets are good
      intercept: 0.7     // Pack compensates for intercept
    };
  }

  /**
   * Override to prefer targets in denser areas (to scatter)
   */
  protected findBestTarget(birds: Bird[], flockCenter: Vector2) {
    const baseResult = super.findBestTarget(birds, flockCenter);
    if (!baseResult) return null;

    // Bonus for targets near dense areas
    const densityBonus = this.targetDensity * 0.4;
    baseResult.totalScore += densityBonus;

    return baseResult;
  }

  /**
   * Reset orca-specific state
   */
  reset(): void {
    super.reset();
    this.lockedTargetId = null;
    this.herdingTime = 0;
    this.coordinationBonus = 1.0;
    this.targetDensity = 0;
    this.strategicOffset = Vector2.random().mult(100);
  }
}
