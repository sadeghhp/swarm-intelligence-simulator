/**
 * Flock Renderer - High-performance PixiJS rendering for birds
 * Version: 1.0.0
 * 
 * Uses PixiJS Container with optimized sprite batching
 * for rendering thousands of birds at 60fps.
 * 
 * Features:
 * - Efficient sprite batching
 * - Dynamic color based on local density
 * - Rotation matches velocity direction
 * - Panic state visual feedback
 * - Motion trails (optional)
 */

import * as PIXI from 'pixi.js';
import type { Bird } from '../simulation/Bird';
import type { IRenderingConfig } from '../types';
import { hslToHex, lerpColor, clamp, map } from '../utils/MathUtils';

export class FlockRenderer {
  /** PixiJS container for all bird sprites */
  private container: PIXI.Container;
  
  /** Individual bird sprites */
  private sprites: PIXI.Sprite[] = [];
  
  /** Bird sprite texture (generated procedurally) */
  private birdTexture: PIXI.Texture;
  
  /** Trail container (optional) */
  private trailContainer: PIXI.Container | null = null;
  
  /** Trail graphics */
  private trails: PIXI.Graphics[] = [];
  
  /** Base color for birds */
  private baseColor: number = 0x00d4ff;
  
  /** Panic color */
  private panicColor: number = 0xff3366;
  
  /** Dense flock color */
  private denseColor: number = 0x8b5cf6;
  
  /** Rendering configuration */
  private config: IRenderingConfig;

  constructor(config: IRenderingConfig) {
    this.config = config;
    
    // Create main container
    this.container = new PIXI.Container();
    
    // Generate bird texture
    this.birdTexture = this.createBirdTexture();
    
    // Create trail container if enabled
    if (config.showTrails) {
      this.trailContainer = new PIXI.Container();
      this.container.addChild(this.trailContainer);
    }
  }

  /**
   * Create procedural bird texture (arrow/chevron shape)
   */
  private createBirdTexture(): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    
    // Draw a stylized bird shape (chevron/arrow)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    
    // Arrow pointing right (will be rotated by sprite)
    ctx.moveTo(14, 8);  // Tip
    ctx.lineTo(2, 2);   // Top back
    ctx.lineTo(5, 8);   // Center back indent
    ctx.lineTo(2, 14);  // Bottom back
    ctx.closePath();
    
    ctx.fill();
    
    return PIXI.Texture.from(canvas);
  }

  /**
   * Get the container to add to the stage
   */
  getContainer(): PIXI.Container {
    return this.container;
  }

  /**
   * Update sprites to match bird count
   */
  syncBirdCount(count: number): void {
    const currentCount = this.sprites.length;
    
    if (count > currentCount) {
      // Add new sprites
      for (let i = currentCount; i < count; i++) {
        const sprite = new PIXI.Sprite(this.birdTexture);
        sprite.anchor.set(0.5, 0.5);
        sprite.scale.set(0.8);
        this.sprites.push(sprite);
        this.container.addChild(sprite);
        
        // Add trail graphics if enabled
        if (this.config.showTrails && this.trailContainer) {
          const trail = new PIXI.Graphics();
          trail.alpha = 0.3;
          this.trails.push(trail);
          this.trailContainer.addChild(trail);
        }
      }
    } else if (count < currentCount) {
      // Remove excess sprites
      for (let i = currentCount - 1; i >= count; i--) {
        const sprite = this.sprites.pop()!;
        this.container.removeChild(sprite);
        sprite.destroy();
        
        if (this.config.showTrails && this.trails.length > count) {
          const trail = this.trails.pop()!;
          this.trailContainer?.removeChild(trail);
          trail.destroy();
        }
      }
    }
  }

  /**
   * Update all bird sprites
   */
  update(birds: Bird[]): void {
    // Ensure sprite count matches
    if (this.sprites.length !== birds.length) {
      this.syncBirdCount(birds.length);
    }
    
    // Update each sprite
    for (let i = 0; i < birds.length; i++) {
      const bird = birds[i];
      const sprite = this.sprites[i];
      
      // Position
      sprite.x = bird.position.x;
      sprite.y = bird.position.y;
      
      // Rotation (heading direction)
      sprite.rotation = bird.heading;
      
      // Color based on state
      sprite.tint = this.calculateBirdColor(bird);
      
      // Scale based on speed (subtle)
      const speedScale = 0.7 + clamp(bird.speed / 20, 0, 0.5);
      sprite.scale.set(speedScale);
      
      // Alpha based on panic (slight fade when calm)
      sprite.alpha = 0.85 + bird.panicLevel * 0.15;
    }
    
    // Update trails if enabled
    if (this.config.showTrails) {
      this.updateTrails(birds);
    }
  }

  /**
   * Calculate bird color based on state
   * - Base color: Cyan (#00d4ff)
   * - Dense areas: Violet (#8b5cf6)
   * - Panic: Red (#ff3366)
   */
  private calculateBirdColor(bird: Bird): number {
    if (!this.config.colorByDensity) {
      // Simple panic-based coloring
      if (bird.panicLevel > 0.1) {
        return lerpColor(this.baseColor, this.panicColor, bird.panicLevel);
      }
      return this.baseColor;
    }
    
    // Density-based coloring
    const densityFactor = clamp(bird.localDensity / 15, 0, 1);
    let color = lerpColor(this.baseColor, this.denseColor, densityFactor);
    
    // Overlay panic color
    if (bird.panicLevel > 0.1) {
      color = lerpColor(color, this.panicColor, bird.panicLevel * 0.8);
    }
    
    return color;
  }

  /**
   * Update motion trails (optional feature)
   */
  private updateTrails(birds: Bird[]): void {
    if (!this.trailContainer) return;
    
    for (let i = 0; i < birds.length && i < this.trails.length; i++) {
      const bird = birds[i];
      const trail = this.trails[i];
      
      trail.clear();
      
      // Only draw trail if bird is moving fast enough
      if (bird.speed < 3) continue;
      
      const trailLength = this.config.trailLength;
      const color = this.calculateBirdColor(bird);
      
      // Draw trail as line behind bird
      trail.moveTo(bird.position.x, bird.position.y);
      
      // Calculate tail position (opposite of heading)
      const tailX = bird.position.x - Math.cos(bird.heading) * bird.speed * trailLength;
      const tailY = bird.position.y - Math.sin(bird.heading) * bird.speed * trailLength;
      
      trail.lineTo(tailX, tailY);
      trail.stroke({ width: 1.5, color, alpha: 0.4 });
    }
  }

  /**
   * Toggle trails on/off
   */
  setTrailsEnabled(enabled: boolean): void {
    this.config.showTrails = enabled;
    
    if (enabled && !this.trailContainer) {
      this.trailContainer = new PIXI.Container();
      this.container.addChildAt(this.trailContainer, 0);
      
      // Create trail graphics for existing sprites
      for (let i = 0; i < this.sprites.length; i++) {
        const trail = new PIXI.Graphics();
        trail.alpha = 0.3;
        this.trails.push(trail);
        this.trailContainer.addChild(trail);
      }
    } else if (!enabled && this.trailContainer) {
      // Remove trail container
      this.container.removeChild(this.trailContainer);
      this.trailContainer.destroy({ children: true });
      this.trailContainer = null;
      this.trails = [];
    }
  }

  /**
   * Set whether to color by density
   */
  setColorByDensity(enabled: boolean): void {
    this.config.colorByDensity = enabled;
  }

  /**
   * Set trail length
   */
  setTrailLength(length: number): void {
    this.config.trailLength = length;
  }

  /**
   * Set base color theme
   */
  setColorTheme(base: number, dense: number, panic: number): void {
    this.baseColor = base;
    this.denseColor = dense;
    this.panicColor = panic;
  }

  /**
   * Get sprite count (for debugging)
   */
  getSpriteCount(): number {
    return this.sprites.length;
  }

  /**
   * Clear all sprites
   */
  clear(): void {
    for (const sprite of this.sprites) {
      sprite.destroy();
    }
    this.sprites = [];
    
    for (const trail of this.trails) {
      trail.destroy();
    }
    this.trails = [];
    
    if (this.trailContainer) {
      this.trailContainer.destroy({ children: true });
      this.trailContainer = null;
    }
  }

  /**
   * Destroy renderer and clean up resources
   */
  destroy(): void {
    this.clear();
    this.birdTexture.destroy(true);
    this.container.destroy({ children: true });
  }
}

