/**
 * Food Source Manager - Food/resource mechanics for the simulation
 * Version: 1.1.0 - Added energy restoration for creatures
 * 
 * Food sources attract creatures, creating natural gathering points.
 * Features:
 * - Spawns food at random locations
 * - Food depletes when consumed by creatures
 * - Respawns after cooldown period
 * - Visual feedback showing food amount
 */

import { Vector2 } from '../utils/Vector2';
import type { IFoodSource, IEnvironmentConfig } from '../types';

export class FoodSourceManager {
  /** Active food sources */
  private sources: Map<number, IFoodSource> = new Map();
  
  /** ID counter */
  private nextId: number = 0;
  
  /** Simulation dimensions */
  private width: number;
  private height: number;
  
  /** Statistics */
  public totalConsumed: number = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Initialize food sources based on config
   */
  initialize(config: IEnvironmentConfig): void {
    this.clear();
    
    if (!config.foodEnabled) return;
    
    const margin = 150;
    for (let i = 0; i < config.foodCount; i++) {
      this.spawnFood(
        margin + Math.random() * (this.width - margin * 2),
        margin + Math.random() * (this.height - margin * 2),
        config.foodAttractionRadius
      );
    }
  }

  /**
   * Spawn a new food source
   */
  spawnFood(x: number, y: number, radius: number = 100): number {
    const id = this.nextId++;
    
    const source: IFoodSource = {
      id,
      position: { x, y },
      amount: 100,
      maxAmount: 100,
      radius,
      respawnTimer: 0,
      consumed: false
    };
    
    this.sources.set(id, source);
    return id;
  }

  /**
   * Update all food sources (respawn depleted ones)
   */
  update(deltaTime: number, config: IEnvironmentConfig): void {
    if (!config.foodEnabled) return;
    
    for (const source of this.sources.values()) {
      if (source.consumed) {
        source.respawnTimer -= deltaTime;
        
        if (source.respawnTimer <= 0) {
          // Respawn at new random location
          const margin = 150;
          source.position.x = margin + Math.random() * (this.width - margin * 2);
          source.position.y = margin + Math.random() * (this.height - margin * 2);
          source.amount = source.maxAmount;
          source.consumed = false;
        }
      }
    }
    
    // Ensure correct number of food sources
    const activeCount = this.getActiveCount();
    if (activeCount < config.foodCount) {
      const margin = 150;
      for (let i = activeCount; i < config.foodCount; i++) {
        this.spawnFood(
          margin + Math.random() * (this.width - margin * 2),
          margin + Math.random() * (this.height - margin * 2),
          config.foodAttractionRadius
        );
      }
    }
  }

  /**
   * Consume food at a position (called when creature reaches food)
   * @returns Energy restored (0 if no food consumed)
   */
  consume(position: Vector2, amount: number = 1, energyRestoreAmount: number = 0.1): number {
    for (const source of this.sources.values()) {
      if (source.consumed) continue;
      
      const dx = position.x - source.position.x;
      const dy = position.y - source.position.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < 400) { // Within 20 units
        source.amount -= amount;
        this.totalConsumed += amount;
        
        if (source.amount <= 0) {
          source.consumed = true;
          source.respawnTimer = 10; // Will be overridden by config
        }
        
        return energyRestoreAmount;
      }
    }
    
    return 0;
  }
  
  /**
   * Check if a position is near food (for energy-seeking behavior)
   * @returns Distance to nearest food, or -1 if none within radius
   */
  getNearestFoodDistance(position: Vector2, radius: number): number {
    let closestDistSq = radius * radius;
    let found = false;
    
    for (const source of this.sources.values()) {
      if (source.consumed) continue;
      
      const dx = source.position.x - position.x;
      const dy = source.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        found = true;
      }
    }
    
    return found ? Math.sqrt(closestDistSq) : -1;
  }

  /**
   * Get attraction force toward nearest food
   */
  getAttractionForce(
    position: Vector2,
    strength: number,
    radius: number,
    outForce: Vector2
  ): boolean {
    outForce.x = 0;
    outForce.y = 0;
    
    let closestDistSq = radius * radius;
    let closestSource: IFoodSource | null = null;
    
    for (const source of this.sources.values()) {
      if (source.consumed) continue;
      
      const dx = source.position.x - position.x;
      const dy = source.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestSource = source;
      }
    }
    
    if (closestSource) {
      const dist = Math.sqrt(closestDistSq);
      if (dist > 0) {
        const factor = (1 - dist / radius) * strength;
        outForce.x = ((closestSource.position.x - position.x) / dist) * factor;
        outForce.y = ((closestSource.position.y - position.y) / dist) * factor;
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get all active food sources (for rendering)
   */
  getAll(): IFoodSource[] {
    return Array.from(this.sources.values()).filter(s => !s.consumed);
  }

  /**
   * Get count of active (not consumed) food sources
   */
  getActiveCount(): number {
    let count = 0;
    for (const source of this.sources.values()) {
      if (!source.consumed) count++;
    }
    return count;
  }

  /**
   * Clear all food sources
   */
  clear(): void {
    this.sources.clear();
    this.nextId = 0;
  }

  /**
   * Resize simulation area
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalConsumed = 0;
  }
}

