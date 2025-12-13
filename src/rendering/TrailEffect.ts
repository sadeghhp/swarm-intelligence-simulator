/**
 * Trail Effect - Motion trails for visual polish
 * Version: 1.0.0
 * 
 * Creates fading trails behind moving birds for a more
 * dynamic and visually appealing effect.
 */

import * as PIXI from 'pixi.js';
import type { Bird } from '../simulation/Bird';
import { lerpColor, clamp } from '../utils/MathUtils';

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export class TrailEffect {
  /** Container for trail graphics */
  private container: PIXI.Container;
  
  /** Trail history per bird */
  private trails: Map<number, TrailPoint[]> = new Map();
  
  /** Maximum trail length */
  private maxLength: number = 8;
  
  /** Trail decay rate */
  private decayRate: number = 0.15;
  
  /** Base color */
  private baseColor: number = 0x00d4ff;
  
  /** Graphics object for drawing */
  private graphics: PIXI.Graphics;
  
  /** Is effect enabled */
  private enabled: boolean = false;

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
    this.container.alpha = 0.5;
  }

  /**
   * Get container to add to stage
   */
  getContainer(): PIXI.Container {
    return this.container;
  }

  /**
   * Enable or disable trail effect
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.visible = enabled;
    
    if (!enabled) {
      this.trails.clear();
    }
  }

  /**
   * Set maximum trail length
   */
  setMaxLength(length: number): void {
    this.maxLength = Math.max(1, Math.min(20, length));
  }

  /**
   * Set base color
   */
  setColor(color: number): void {
    this.baseColor = color;
  }

  /**
   * Update trails for all birds
   */
  update(birds: Bird[], deltaTime: number): void {
    if (!this.enabled) return;
    
    // Update existing trails
    for (const [birdId, trail] of this.trails) {
      // Age all points
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age += deltaTime * this.decayRate;
        if (trail[i].age >= 1) {
          trail.splice(i, 1);
        }
      }
    }
    
    // Add new trail points for each bird
    for (const bird of birds) {
      // Only add trail if bird is moving fast enough
      if (bird.speed < 3) continue;
      
      let trail = this.trails.get(bird.id);
      if (!trail) {
        trail = [];
        this.trails.set(bird.id, trail);
      }
      
      // Add current position
      trail.unshift({
        x: bird.position.x,
        y: bird.position.y,
        age: 0
      });
      
      // Limit trail length
      while (trail.length > this.maxLength) {
        trail.pop();
      }
    }
    
    // Remove trails for birds that no longer exist
    const birdIds = new Set(birds.map(b => b.id));
    for (const id of this.trails.keys()) {
      if (!birdIds.has(id)) {
        this.trails.delete(id);
      }
    }
    
    // Render trails
    this.render(birds);
  }

  /**
   * Render all trails
   */
  private render(birds: Bird[]): void {
    this.graphics.clear();
    
    for (const bird of birds) {
      const trail = this.trails.get(bird.id);
      if (!trail || trail.length < 2) continue;
      
      // Get bird color (consider panic level)
      const color = bird.panicLevel > 0.1
        ? lerpColor(this.baseColor, 0xff3366, bird.panicLevel)
        : this.baseColor;
      
      // Draw trail segments
      for (let i = 0; i < trail.length - 1; i++) {
        const p1 = trail[i];
        const p2 = trail[i + 1];
        
        // Fade based on age and position in trail
        const alpha = (1 - p1.age) * (1 - i / trail.length) * 0.6;
        const width = (1 - i / trail.length) * 2;
        
        if (alpha > 0.01) {
          this.graphics.moveTo(p1.x, p1.y);
          this.graphics.lineTo(p2.x, p2.y);
          this.graphics.stroke({ width, color, alpha });
        }
      }
    }
  }

  /**
   * Clear all trails
   */
  clear(): void {
    this.trails.clear();
    this.graphics.clear();
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.clear();
    this.container.destroy({ children: true });
  }
}

