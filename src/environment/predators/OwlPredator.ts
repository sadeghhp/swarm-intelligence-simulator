/**
 * OwlPredator - Ambush specialist
 * Version: 2.0.0
 * 
 * Hunting Strategy: Ambush
 * - Finds strategic position (edge of simulation or near food sources)
 * - Remains stationary with minimal panic broadcast (stealth mode)
 * - Strike only when bird comes within close range
 * - High success rate within strike zone
 * 
 * Best against: Unsuspecting birds that come close
 */

import { Vector2 } from '../../utils/Vector2';
import { BasePredator } from './BasePredator';
import type { Bird } from '../../simulation/Bird';
import type { IEnvironmentConfig, IPredatorStats, PredatorType } from '../../types';

export class OwlPredator extends BasePredator {
  public readonly type: PredatorType = 'owl';
  public readonly color: string = '#9b59b6';
  public readonly panicRadius: number = 80;

  protected readonly stats: IPredatorStats = {
    maxEnergy: 90,
    energyRegenRate: 10,      // Fast regen while waiting
    huntingDrain: 18,         // High drain during strike
    attackCost: 25,
    exhaustionThreshold: 15,
    burstMultiplier: 2.5,     // Fast strike (8 * 2.5 = 20 base, but strikeSpeed overrides to 28)
    staminaRecoveryDelay: 1   // Quick recovery
  };

  /** Whether currently in stealth mode */
  public isStealthed: boolean = false;
  
  /** Stealth radius - reduced panic effect while stealthed */
  public readonly stealthRadius: number = 40;
  
  /** Current ambush position */
  private ambushPosition: Vector2 | null = null;
  
  /** Time spent in ambush */
  private ambushTime: number = 0;
  
  /** Maximum time to wait in ambush before relocating */
  private readonly maxAmbushTime: number = 12;
  
  /** Strike range - must be very close to strike */
  private readonly strikeRange: number = 70;
  
  /** Minimum wait time before striking */
  private readonly minWaitTime: number = 1.5;
  
  /** Strike speed - owls can strike at ~40 mph from ambush (vs 20-25 mph cruising) */
  private readonly strikeSpeed: number = 28;
  
  /** Patience factor - affects willingness to wait */
  private patience: number = 1.0;

  constructor(width: number, height: number) {
    super(width, height);
    this.maxSpeed = 8;        // Very slow normal movement
    this.maxForce = 0.4;
    this.attackDistance = 40;
    this.huntingDuration = 3; // Short strike window
    this.initializeEnergy();
  }

  /**
   * Owl-specific behavior state machine
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
        this.updateFindingPosition(deltaTime, config, birds, flockCenter);
        break;
      case 'ambushing':
        this.updateAmbush(deltaTime, config, birds, flockCenter);
        break;
      case 'attacking':
        this.updateStrike(deltaTime, config, birds);
        break;
      case 'recovering':
        this.updateRecovering(deltaTime);
        break;
    }
  }

  /**
   * Override idle to include patience regeneration
   */
  protected updateIdle(deltaTime: number, config: IEnvironmentConfig, flockCenter: Vector2): void {
    this.isStealthed = false;
    this.ambushPosition = null;
    this.ambushTime = 0;
    
    // Regenerate patience while idle
    this.patience = Math.min(1.5, this.patience + deltaTime * 0.1);
    
    super.updateIdle(deltaTime, config, flockCenter);
  }

  /**
   * Finding position: Move to strategic ambush location
   */
  private updateFindingPosition(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    // Calculate best ambush position
    if (!this.ambushPosition) {
      this.ambushPosition = this.calculateAmbushPosition(flockCenter, birds);
    }
    
    // Move toward ambush position
    const distToPosition = this.position.dist(this.ambushPosition);
    
    if (distToPosition > 30) {
      this.steerToward(this.ambushPosition.x, this.ambushPosition.y, 0.6, 0.5);
    } else {
      // Reached position, begin ambush
      this.velocity.mult(0.1); // Nearly stop
      this.setState('ambushing');
      this.isStealthed = true;
    }
    
    // Timeout - couldn't reach position
    if (this.stateTime > 8) {
      this.setState('idle');
    }
  }

  /**
   * Calculate optimal ambush position
   */
  private calculateAmbushPosition(flockCenter: Vector2, birds: Bird[]): Vector2 {
    // Find position on edge of typical bird movement
    // Prefer positions between flock and edges
    
    const candidates: { pos: Vector2; score: number }[] = [];
    
    // Generate candidate positions
    const numCandidates = 8;
    for (let i = 0; i < numCandidates; i++) {
      const angle = (i / numCandidates) * Math.PI * 2;
      const radius = 150 + Math.random() * 100;
      
      const pos = new Vector2(
        flockCenter.x + Math.cos(angle) * radius,
        flockCenter.y + Math.sin(angle) * radius
      );
      
      // Clamp to bounds
      pos.x = Math.max(100, Math.min(this.width - 100, pos.x));
      pos.y = Math.max(100, Math.min(this.height - 100, pos.y));
      
      // Score based on bird traffic (how many birds are moving toward this area)
      let score = 0;
      for (const bird of birds) {
        const toBird = bird.position.dist(pos);
        if (toBird < 200) {
          // Check if bird is moving toward this position
          const toPos = new Vector2(pos.x - bird.position.x, pos.y - bird.position.y).normalize();
          const birdDir = bird.velocity.clone().normalize();
          const dot = toPos.x * birdDir.x + toPos.y * birdDir.y;
          if (dot > 0) {
            score += dot * (1 - toBird / 200);
          }
        }
      }
      
      // Bonus for edge positions
      const edgeDist = Math.min(
        pos.x, pos.y,
        this.width - pos.x,
        this.height - pos.y
      );
      if (edgeDist < 150) {
        score += 0.5;
      }
      
      candidates.push({ pos, score });
    }
    
    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    
    // Return best position with some randomness
    const idx = Math.floor(Math.random() * Math.min(3, candidates.length));
    return candidates[idx]?.pos || new Vector2(this.width / 2, this.height / 2);
  }

  /**
   * Ambush: Wait for prey to come close
   */
  private updateAmbush(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[],
    flockCenter: Vector2
  ): void {
    this.ambushTime += deltaTime;
    this.isStealthed = true;
    
    // Very slow velocity decay (nearly stationary)
    this.velocity.mult(0.95);
    
    // Regenerate energy while waiting
    this.energy = Math.min(this.stats.maxEnergy, this.energy + this.stats.energyRegenRate * 0.5 * deltaTime);
    
    // Look for targets within strike range
    if (this.ambushTime >= this.minWaitTime) {
      const nearbyTarget = this.findNearbyTarget(birds);
      if (nearbyTarget) {
        this.target = nearbyTarget.position.clone();
        this.targetBirdId = nearbyTarget.id;
        this.isStealthed = false;
        this.setState('attacking');
      }
    }
    
    // Relocate if waiting too long
    if (this.ambushTime > this.maxAmbushTime * this.patience) {
      this.patience *= 0.9; // Decrease patience
      this.ambushPosition = null;
      this.setState('scanning');
    }
    
    // Stay near ambush position
    if (this.ambushPosition) {
      const drift = this.position.dist(this.ambushPosition);
      if (drift > 20) {
        this.steerToward(this.ambushPosition.x, this.ambushPosition.y, 0.2, 0.2);
      }
    }
  }

  /**
   * Find a target within strike range
   */
  private findNearbyTarget(birds: Bird[]): Bird | null {
    let bestTarget: Bird | null = null;
    let bestScore = 0;
    
    for (const bird of birds) {
      const dist = this.position.dist(bird.position);
      
      if (dist <= this.strikeRange) {
        // Score based on distance (closer = better)
        let score = 1 - dist / this.strikeRange;
        
        // Bonus if bird is moving toward us
        const toOwl = new Vector2(
          this.position.x - bird.position.x,
          this.position.y - bird.position.y
        ).normalize();
        const birdDir = bird.velocity.clone().normalize();
        const dot = toOwl.x * birdDir.x + toOwl.y * birdDir.y;
        if (dot > 0) {
          score += dot * 0.5;
        }
        
        // Prefer non-panicked birds (they haven't noticed us)
        score += (1 - bird.panicLevel) * 0.3;
        
        if (score > bestScore) {
          bestScore = score;
          bestTarget = bird;
        }
      }
    }
    
    return bestTarget;
  }

  /**
   * Strike: Lightning-fast attack
   */
  private updateStrike(
    deltaTime: number,
    config: IEnvironmentConfig,
    birds: Bird[]
  ): void {
    this.isStealthed = false;
    
    // Find target bird
    const targetBird = birds.find(b => b.id === this.targetBirdId);
    if (targetBird) {
      // Slight lead on fast-moving targets
      const leadTime = 0.15;
      this.target = new Vector2(
        targetBird.position.x + targetBird.velocity.x * leadTime,
        targetBird.position.y + targetBird.velocity.y * leadTime
      );
    }
    
    if (!this.target) {
      this.registerFailure();
      this.patience *= 0.8;
      this.setState('idle');
      return;
    }
    
    // Ultra-fast strike toward target
    const strikeMult = this.strikeSpeed / this.maxSpeed;
    this.steerToward(this.target.x, this.target.y, strikeMult, 3.5);
    
    const dist = this.position.dist(this.target);
    
    // Check for successful strike
    if (dist < this.attackDistance) {
      this.registerSuccess();
      this.patience = Math.min(1.5, this.patience + 0.2); // Success increases patience
      this.setState('recovering');
      this.velocity.mult(0.2);
      return;
    }
    
    // Strike timeout - owl attacks are quick
    if (this.stateTime > 1.5) {
      this.registerFailure();
      this.patience *= 0.85;
      this.setState('idle');
    }
  }

  /**
   * Get effective panic radius - much smaller when stealthed
   */
  getEffectivePanicRadius(): number {
    if (this.isStealthed) {
      return this.stealthRadius;
    }
    return this.panicRadius;
  }

  /**
   * Override target weights - owl cares most about proximity
   */
  protected getTargetWeights() {
    return {
      isolation: 0.3,
      edge: 0.2,
      velocity: 0.5,    // Prefer birds moving toward us
      panic: -0.5,      // Strongly avoid panicked birds
      intercept: 2.0    // Proximity is everything
    };
  }

  /**
   * Override getState to include stealth info
   */
  getState() {
    const baseState = super.getState();
    return {
      ...baseState,
      isStealthed: this.isStealthed,
      patience: this.patience,
      ambushTime: this.ambushTime
    };
  }

  /**
   * Reset owl-specific state
   */
  reset(): void {
    super.reset();
    this.isStealthed = false;
    this.ambushPosition = null;
    this.ambushTime = 0;
    this.patience = 1.0;
  }
}
