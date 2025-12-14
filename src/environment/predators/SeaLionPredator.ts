/**
 * SeaLionPredator - Ocean agile pursuit specialist
 * Version: 1.0.0
 * 
 * Hunting Strategy: Agile Pursuit
 * - High maneuverability for quick direction changes
 * - Excels at chasing erratic, fast-moving prey
 * - Moderate speed with exceptional turning ability
 * - Playful hunting style with feints and intercepts
 * 
 * Best against: Plankton, small schools, fast movers
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

export class SeaLionPredator extends BasePredator {
  public readonly type: PredatorType = 'sea_lion';
  public readonly color: string = '#8b6914';
  public readonly panicRadius: number = 140;

  protected readonly stats: IPredatorStats = {
    maxEnergy: 85,           // Good stamina
    energyRegenRate: 7,      // Moderate regen
    huntingDrain: 10,        // Active hunting costs energy
    attackCost: 15,
    exhaustionThreshold: 15,
    burstMultiplier: 1.7,    // Good burst capability
    staminaRecoveryDelay: 1.8
  };

  /** Agility multiplier (affects turning) */
  private readonly agilityBonus: number = 1.8;
  
  /** Current target prediction */
  private predictedPosition: Vector2 = new Vector2();
  
  /** Time tracking target's movement pattern */
  private patternTrackTime: number = 0;
  
  /** Feint direction for misdirection */
  private feintAngle: number = 0;
  
  /** Is performing a feint */
  private isFeinting: boolean = false;
  
  /** Feint timer */
  private feintTimer: number = 0;

  constructor(width: number, height: number) {
    super(width, height);
    this.maxSpeed = 17;
    this.maxForce = 1.1;      // High agility
    this.attackDistance = 45;
    this.huntingDuration = 10;
    this.initializeEnergy();
  }

  /**
   * Sea lion-specific behavior state machine
   */
  protected updateBehavior(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Update feint timer
    if (this.isFeinting) {
      this.feintTimer -= deltaTime;
      if (this.feintTimer <= 0) {
        this.isFeinting = false;
      }
    }

    switch (this.state) {
      case 'idle':
        this.updateIdle(deltaTime, config, flockCenter);
        break;
      case 'scanning':
        this.updateScanning(deltaTime, config, birds, flockCenter);
        break;
      case 'hunting':
        this.updateAgilePursuit(deltaTime, config, birds, flockCenter);
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
    this.isFeinting = false;
    this.patternTrackTime = 0;
    
    super.updateIdle(deltaTime, config, flockCenter);
  }

  /**
   * Scanning: Actively search for targets with playful movement
   */
  private updateScanning(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Move toward flock with slight weaving
    const weaveAngle = Math.sin(this.time * 2) * 0.3;
    const toFlock = new Vector2(
      flockCenter.x - this.position.x,
      flockCenter.y - this.position.y
    );
    const angle = Math.atan2(toFlock.y, toFlock.x) + weaveAngle;
    const targetX = this.position.x + Math.cos(angle) * 100;
    const targetY = this.position.y + Math.sin(angle) * 100;
    
    this.steerToward(targetX, targetY, 0.9, 0.7);

    // Look for fast-moving or erratic targets
    const bestTarget = this.findBestTarget(birds, flockCenter);
    if (bestTarget) {
      this.targetBirdId = bestTarget.birdId;
      const targetBird = birds.find(b => b.id === bestTarget.birdId);
      if (targetBird) {
        this.target = targetBird.position.clone();
        this.patternTrackTime = 0;
        this.setState('hunting');
      }
    }

    // Timeout
    if (this.stateTime > 8) {
      this.setState('idle');
    }
  }

  /**
   * Agile pursuit: Fast, maneuverable chase
   */
  private updateAgilePursuit(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    const targetBird = birds.find(b => b.id === this.targetBirdId);
    if (!targetBird) {
      this.setState('scanning');
      return;
    }

    this.patternTrackTime += deltaTime;
    this.target = targetBird.position.clone();

    // Predict target movement with increasing accuracy
    const predictionAccuracy = Math.min(1, this.patternTrackTime * 0.3);
    this.predictTargetPosition(targetBird, predictionAccuracy);

    // Occasionally feint to confuse prey
    if (!this.isFeinting && Math.random() < 0.005 && this.patternTrackTime > 1) {
      this.triggerFeint();
    }

    // Calculate pursuit target (predicted position or feint)
    let pursuitX: number;
    let pursuitY: number;

    if (this.isFeinting) {
      // Feint - move in slightly wrong direction
      const feintDist = 50;
      pursuitX = this.predictedPosition.x + Math.cos(this.feintAngle) * feintDist;
      pursuitY = this.predictedPosition.y + Math.sin(this.feintAngle) * feintDist;
    } else {
      pursuitX = this.predictedPosition.x;
      pursuitY = this.predictedPosition.y;
    }

    // Agile pursuit with high maneuverability
    this.steerToward(pursuitX, pursuitY, 1.2, this.agilityBonus);

    const distToTarget = this.position.dist(targetBird.position);

    // Transition to attack
    if (distToTarget < this.attackDistance * 2) {
      this.isFeinting = false;
      this.setState('attacking');
    }

    // Give up conditions
    if (this.huntDuration > this.huntingDuration || distToTarget > 300) {
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
   * Predict target position based on movement pattern
   */
  private predictTargetPosition(bird: Bird, accuracy: number): void {
    // Base prediction on velocity
    const leadTime = 0.3 + accuracy * 0.2;
    
    // Add acceleration prediction for erratic targets
    const accelFactor = accuracy * 0.1;
    
    this.predictedPosition.set(
      bird.position.x + bird.velocity.x * leadTime + bird.acceleration.x * accelFactor,
      bird.position.y + bird.velocity.y * leadTime + bird.acceleration.y * accelFactor
    );
  }

  /**
   * Trigger feint maneuver
   */
  private triggerFeint(): void {
    this.isFeinting = true;
    this.feintTimer = 0.3 + Math.random() * 0.2;
    this.feintAngle = Math.random() * Math.PI * 2;
  }

  /**
   * Attacking: Quick, agile strike
   */
  private updateAttacking(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    const targetBird = birds.find(b => b.id === this.targetBirdId);

    if (targetBird) {
      this.target = targetBird.position.clone();
      
      // Tight intercept prediction
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

    // Quick, agile strike
    this.steerToward(this.target.x, this.target.y, 1.7, 2.5);

    const dist = this.position.dist(this.target);

    // Success check
    if (dist < this.attackDistance) {
      this.registerSuccess();
      this.setState('recovering');
      this.velocity.mult(0.4);
      return;
    }

    // Resume pursuit if target evades
    if (dist > this.attackDistance * 2.5 && this.stateTime > 0.6) {
      this.setState('hunting');
    }

    // Attack timeout
    if (this.stateTime > 2) {
      this.registerFailure();
      this.setState('idle');
    }
  }

  /**
   * Override target weights for agile pursuit preference
   */
  protected getTargetWeights() {
    return {
      isolation: 0.8,   // Can handle some grouping
      edge: 0.6,        // Position matters less
      velocity: 0.4,    // Fast targets are fine
      panic: 0.7,       // Can handle erratic movement
      intercept: 1.4    // Excellent intercept ability
    };
  }

  /**
   * Override to prefer faster, more challenging targets
   */
  protected findBestTarget(birds: Bird[], flockCenter: Vector2) {
    const baseResult = super.findBestTarget(birds, flockCenter);
    if (!baseResult) return null;

    // Bonus for faster-moving targets (sea lion likes a challenge)
    const targetBird = birds.find(b => b.id === baseResult.birdId);
    if (targetBird) {
      const speedBonus = Math.min(0.4, targetBird.velocity.mag() / 20);
      baseResult.totalScore += speedBonus;
    }

    return baseResult;
  }

  /**
   * Reset sea lion-specific state
   */
  reset(): void {
    super.reset();
    this.isFeinting = false;
    this.feintTimer = 0;
    this.patternTrackTime = 0;
    this.predictedPosition.set(0, 0);
  }
}
