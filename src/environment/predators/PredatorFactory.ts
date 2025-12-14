/**
 * PredatorFactory - Factory for creating predator instances
 * Version: 2.0.0
 * 
 * Creates predator instances based on type.
 * Supports creating single predators or multiple predators for pack scenarios.
 */

import { BasePredator } from './BasePredator';
import { HawkPredator } from './HawkPredator';
import { FalconPredator } from './FalconPredator';
import { EaglePredator } from './EaglePredator';
import { OwlPredator } from './OwlPredator';
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
      case 'hawk':
        return new HawkPredator(width, height);
      case 'falcon':
        return new FalconPredator(width, height);
      case 'eagle':
        return new EaglePredator(width, height);
      case 'owl':
        return new OwlPredator(width, height);
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
  } {
    switch (type) {
      case 'hawk':
        return {
          name: 'Hawk',
          description: 'Edge hunting specialist with burst speed',
          huntingStyle: 'Circles flock and targets isolated birds',
          difficulty: 'medium'
        };
      case 'falcon':
        return {
          name: 'Falcon',
          description: 'High-speed stoop diver',
          huntingStyle: 'Climbs high then dives at extreme speed',
          difficulty: 'hard'
        };
      case 'eagle':
        return {
          name: 'Eagle',
          description: 'Relentless pursuit predator',
          huntingStyle: 'Locks onto target and chases until exhaustion',
          difficulty: 'medium'
        };
      case 'owl':
        return {
          name: 'Owl',
          description: 'Silent ambush predator',
          huntingStyle: 'Waits motionless then strikes nearby prey',
          difficulty: 'easy'
        };
      default:
        return {
          name: 'Unknown',
          description: 'Unknown predator type',
          huntingStyle: 'Unknown',
          difficulty: 'medium'
        };
    }
  }

  /**
   * Get all available predator types
   */
  static getAllTypes(): PredatorType[] {
    return ['hawk', 'falcon', 'eagle', 'owl'];
  }

  /**
   * Get color for a predator type
   */
  static getTypeColor(type: PredatorType): string {
    switch (type) {
      case 'hawk': return '#ff6b35';
      case 'falcon': return '#4ecdc4';
      case 'eagle': return '#8b4513';
      case 'owl': return '#9b59b6';
      default: return '#ff3366';
    }
  }
}
