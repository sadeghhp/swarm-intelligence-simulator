/**
 * Attractor Manager - Dynamic attractors and repulsors
 * Version: 1.0.0
 * 
 * Manages temporary influence points that can attract or repel birds.
 * Used for interactive control and environmental effects.
 */

import { Vector2 } from '../utils/Vector2';
import type { IAttractor } from '../types';

export class AttractorManager {
  /** Active attractors */
  private attractors: Map<number, IAttractor> = new Map();
  
  /** ID counter */
  private nextId: number = 0;
  
  /** Default lifetime for new attractors */
  private readonly defaultLifetime: number = 8;
  
  /** Default radius */
  private readonly defaultRadius: number = 150;
  
  /** Default strength */
  private readonly defaultStrength: number = 1.0;

  /**
   * Add a new attractor
   */
  addAttractor(
    x: number,
    y: number,
    options?: {
      strength?: number;
      radius?: number;
      lifetime?: number;
      isRepulsor?: boolean;
    }
  ): number {
    const id = this.nextId++;
    
    const attractor: IAttractor = {
      id,
      position: { x, y },
      strength: options?.strength ?? this.defaultStrength,
      radius: options?.radius ?? this.defaultRadius,
      lifetime: options?.lifetime ?? this.defaultLifetime,
      maxLifetime: options?.lifetime ?? this.defaultLifetime,
      isRepulsor: options?.isRepulsor ?? false
    };
    
    this.attractors.set(id, attractor);
    return id;
  }

  /**
   * Add a repulsor (convenience method)
   */
  addRepulsor(
    x: number,
    y: number,
    options?: {
      strength?: number;
      radius?: number;
      lifetime?: number;
    }
  ): number {
    return this.addAttractor(x, y, { ...options, isRepulsor: true });
  }

  /**
   * Remove an attractor by ID
   */
  remove(id: number): boolean {
    return this.attractors.delete(id);
  }

  /**
   * Update all attractors (decay lifetime)
   */
  update(deltaTime: number): void {
    for (const [id, attractor] of this.attractors) {
      attractor.lifetime -= deltaTime;
      
      if (attractor.lifetime <= 0) {
        this.attractors.delete(id);
      }
    }
  }

  /**
   * Get all active attractors
   */
  getAll(): IAttractor[] {
    return Array.from(this.attractors.values());
  }

  /**
   * Get attractor by ID
   */
  get(id: number): IAttractor | undefined {
    return this.attractors.get(id);
  }

  /**
   * Calculate force on a position from all attractors
   */
  calculateForce(position: Vector2, maxForce: number): Vector2 {
    const totalForce = new Vector2();
    
    for (const attractor of this.attractors.values()) {
      const dx = attractor.position.x - position.x;
      const dy = attractor.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      if (dist < attractor.radius && dist > 0) {
        // Strength falls off with distance
        const factor = 1 - (dist / attractor.radius);
        let magnitude = attractor.strength * factor * maxForce;
        
        // Invert for repulsor
        if (attractor.isRepulsor) {
          magnitude *= -1;
        }
        
        // Normalize and apply magnitude
        totalForce.x += (dx / dist) * magnitude;
        totalForce.y += (dy / dist) * magnitude;
      }
    }
    
    return totalForce;
  }

  /**
   * Clear all attractors
   */
  clear(): void {
    this.attractors.clear();
  }

  /**
   * Get count of active attractors
   */
  get count(): number {
    return this.attractors.size;
  }
}

