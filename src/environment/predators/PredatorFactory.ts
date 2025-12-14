/**
 * PredatorFactory - Factory for creating predator instances
 * Version: 2.1.0 - Added ocean predators
 * 
 * Creates predator instances based on type.
 * Supports creating single predators or multiple predators for pack scenarios.
 */

import { BasePredator } from './BasePredator';
// Air predators
import { HawkPredator } from './HawkPredator';
import { FalconPredator } from './FalconPredator';
import { EaglePredator } from './EaglePredator';
import { OwlPredator } from './OwlPredator';
// Ocean predators
import { SharkPredator } from './SharkPredator';
import { OrcaPredator } from './OrcaPredator';
import { BarracudaPredator } from './BarracudaPredator';
import { SeaLionPredator } from './SeaLionPredator';
import type { PredatorType } from '../../types';

/**
 * Factory class for creating predator instances
 */
export class PredatorFactory {
  /**
   * Create a single predator of the specified type
   */
  static create(type: PredatorType, width: number, height: number): BasePredator {
    switch (type) {
      // Air predators
      case 'hawk':
        return new HawkPredator(width, height);
      case 'falcon':
        return new FalconPredator(width, height);
      case 'eagle':
        return new EaglePredator(width, height);
      case 'owl':
        return new OwlPredator(width, height);
      // Ocean predators
      case 'shark':
        return new SharkPredator(width, height);
      case 'orca':
        return new OrcaPredator(width, height);
      case 'barracuda':
        return new BarracudaPredator(width, height);
      case 'sea_lion':
        return new SeaLionPredator(width, height);
      default:
        // Default to hawk if unknown type
        console.warn(`Unknown predator type: ${type}, defaulting to hawk`);
        return new HawkPredator(width, height);
    }
  }

  /**
   * Create multiple predators of the specified type
   */
  static createMultiple(
    type: PredatorType,
    count: number,
    width: number,
    height: number
  ): BasePredator[] {
    const predators: BasePredator[] = [];
    for (let i = 0; i < count; i++) {
      predators.push(this.create(type, width, height));
    }
    return predators;
  }

  /**
   * Create a mixed pack of predators
   */
  static createMixed(
    types: PredatorType[],
    width: number,
    height: number
  ): BasePredator[] {
    return types.map(type => this.create(type, width, height));
  }

  /**
   * Get information about a predator type
   */
  static getTypeInfo(type: PredatorType): {
    name: string;
    description: string;
    huntingStyle: string;
    difficulty: 'easy' | 'medium' | 'hard';
    environment: 'air' | 'ocean';
  } {
    switch (type) {
      // Air predators
      case 'hawk':
        return {
          name: 'Hawk',
          description: 'Edge hunting specialist with burst speed',
          huntingStyle: 'Circles flock and targets isolated birds',
          difficulty: 'medium',
          environment: 'air'
        };
      case 'falcon':
        return {
          name: 'Falcon',
          description: 'High-speed stoop diver',
          huntingStyle: 'Climbs high then dives at extreme speed',
          difficulty: 'hard',
          environment: 'air'
        };
      case 'eagle':
        return {
          name: 'Eagle',
          description: 'Relentless pursuit predator',
          huntingStyle: 'Locks onto target and chases until exhaustion',
          difficulty: 'medium',
          environment: 'air'
        };
      case 'owl':
        return {
          name: 'Owl',
          description: 'Silent ambush predator',
          huntingStyle: 'Waits motionless then strikes nearby prey',
          difficulty: 'easy',
          environment: 'air'
        };
      // Ocean predators
      case 'shark':
        return {
          name: 'Shark',
          description: 'Sustained pursuit specialist',
          huntingStyle: 'Circles schools and tracks isolated prey',
          difficulty: 'medium',
          environment: 'ocean'
        };
      case 'orca':
        return {
          name: 'Orca',
          description: 'Intelligent pack coordination hunter',
          huntingStyle: 'Herds and isolates targets with strategic movements',
          difficulty: 'hard',
          environment: 'ocean'
        };
      case 'barracuda':
        return {
          name: 'Barracuda',
          description: 'Ambush burst striker',
          huntingStyle: 'Waits motionless then strikes with explosive speed',
          difficulty: 'easy',
          environment: 'ocean'
        };
      case 'sea_lion':
        return {
          name: 'Sea Lion',
          description: 'Agile pursuit specialist',
          huntingStyle: 'Quick direction changes and playful intercepts',
          difficulty: 'medium',
          environment: 'ocean'
        };
      default:
        return {
          name: 'Unknown',
          description: 'Unknown predator type',
          huntingStyle: 'Unknown',
          difficulty: 'medium',
          environment: 'air'
        };
    }
  }

  /**
   * Get all available predator types
   */
  static getAllTypes(): PredatorType[] {
    return ['hawk', 'falcon', 'eagle', 'owl', 'shark', 'orca', 'barracuda', 'sea_lion'];
  }

  /**
   * Get air predator types
   */
  static getAirTypes(): PredatorType[] {
    return ['hawk', 'falcon', 'eagle', 'owl'];
  }

  /**
   * Get ocean predator types
   */
  static getOceanTypes(): PredatorType[] {
    return ['shark', 'orca', 'barracuda', 'sea_lion'];
  }

  /**
   * Get color for a predator type
   */
  static getTypeColor(type: PredatorType): string {
    switch (type) {
      // Air predators
      case 'hawk': return '#ff6b35';
      case 'falcon': return '#4ecdc4';
      case 'eagle': return '#8b4513';
      case 'owl': return '#9b59b6';
      // Ocean predators
      case 'shark': return '#5f7c8a';
      case 'orca': return '#1a1a2e';
      case 'barracuda': return '#c0c0c0';
      case 'sea_lion': return '#8b6914';
      default: return '#ff3366';
    }
  }
}
