/**
 * Flock Renderer - High-performance PixiJS rendering for creatures
 * Version: 1.3.0 - Added multi-species color support
 * 
 * Uses PixiJS Container with optimized sprite batching
 * for rendering thousands of creatures at 60fps.
 * 
 * Features:
 * - Multiple particle shapes (arrow, circle, triangle, dot)
 * - Dynamic color based on density, speed, or panic
 * - Configurable particle size
 * - Optional glow effects
 * - Motion trails
 */

import * as PIXI from 'pixi.js';
import type { Bird } from '../simulation/Bird';
import type { IRenderingConfig, ISimulationConfig, ICreaturePreset } from '../types';
import { lerpColor, clamp } from '../utils/MathUtils';

export class FlockRenderer {
  /** PixiJS container for all bird sprites */
  private container: PIXI.Container;
  
  /** Individual bird sprites */
  private sprites: PIXI.Sprite[] = [];
  
  /** Bird sprite textures for different shapes */
  private textures: Map<string, PIXI.Texture> = new Map();
  
  /** Current texture in use */
  private currentTexture: PIXI.Texture;
  
  /** Glow container */
  private glowContainer: PIXI.Container | null = null;
  
  /** Glow sprites */
  private glowSprites: PIXI.Sprite[] = [];
  
  /** Glow texture */
  private glowTexture: PIXI.Texture | null = null;
  
  /** Trail container (optional) */
  private trailContainer: PIXI.Container | null = null;
  
  /** Trail graphics */
  private trails: PIXI.Graphics[] = [];
  
  /** Color settings */
  private baseColor: number = 0x00d4ff;
  private panicColor: number = 0xff3366;
  private denseColor: number = 0x8b5cf6;
  
  /** Rendering configuration */
  private config: IRenderingConfig;
  
  /** Current particle size */
  private particleSize: number = 1.0;
  
  /** Species color map for multi-species rendering */
  private speciesColors: Map<string, { base: number; dense: number; panic: number }> = new Map();
  
  /** Whether to color by species */
  private colorBySpecies: boolean = false;

  constructor(config: IRenderingConfig) {
    this.config = config;
    
    // Create main container
    this.container = new PIXI.Container();
    
    // Generate all textures
    this.generateTextures();
    this.currentTexture = this.textures.get(config.particleShape) || this.textures.get('arrow')!;
    
    // Apply initial colors
    this.baseColor = config.baseColor;
    this.denseColor = config.denseColor;
    this.panicColor = config.panicColor;
    
    // Create glow container if enabled
    if (config.glowEnabled) {
      this.setupGlow();
    }
    
    // Create trail container if enabled
    if (config.showTrails) {
      this.trailContainer = new PIXI.Container();
      this.container.addChild(this.trailContainer);
    }
  }

  /**
   * Generate all particle shape textures
   */
  private generateTextures(): void {
    // Arrow shape
    this.textures.set('arrow', this.createArrowTexture());
    
    // Circle shape
    this.textures.set('circle', this.createCircleTexture());
    
    // Triangle shape
    this.textures.set('triangle', this.createTriangleTexture());
    
    // Dot shape
    this.textures.set('dot', this.createDotTexture());
    
    // Glow texture
    this.glowTexture = this.createGlowTexture();
  }

  /**
   * Create arrow texture
   */
  private createArrowTexture(): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(2, 2);
    ctx.lineTo(5, 8);
    ctx.lineTo(2, 14);
    ctx.closePath();
    ctx.fill();
    
    return PIXI.Texture.from(canvas);
  }

  /**
   * Create circle texture
   */
  private createCircleTexture(): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.fill();
    
    return PIXI.Texture.from(canvas);
  }

  /**
   * Create triangle texture
   */
  private createTriangleTexture(): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(2, 3);
    ctx.lineTo(2, 13);
    ctx.closePath();
    ctx.fill();
    
    return PIXI.Texture.from(canvas);
  }

  /**
   * Create dot texture
   */
  private createDotTexture(): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    
    return PIXI.Texture.from(canvas);
  }

  /**
   * Create glow texture
   */
  private createGlowTexture(): PIXI.Texture {
    const canvas = document.createElement('canvas');
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    return PIXI.Texture.from(canvas);
  }

  /**
   * Setup glow effect layer
   */
  private setupGlow(): void {
    this.glowContainer = new PIXI.Container();
    this.glowContainer.alpha = this.config.glowIntensity;
    this.container.addChildAt(this.glowContainer, 0);
  }

  /**
   * Get the container to add to the stage
   */
  getContainer(): PIXI.Container {
    return this.container;
  }

  /**
   * Set particle shape
   */
  setShape(shape: string): void {
    const texture = this.textures.get(shape);
    if (texture && texture !== this.currentTexture) {
      this.currentTexture = texture;
      
      // Update all sprites
      for (const sprite of this.sprites) {
        sprite.texture = this.currentTexture;
      }
    }
  }

  /**
   * Set particle size
   */
  setParticleSize(size: number): void {
    this.particleSize = size;
  }

  /**
   * Set color theme
   */
  setColorTheme(base: number, dense: number, panic: number): void {
    this.baseColor = base;
    this.denseColor = dense;
    this.panicColor = panic;
  }

  /**
   * Set glow enabled
   */
  setGlowEnabled(enabled: boolean): void {
    this.config.glowEnabled = enabled;
    
    if (enabled && !this.glowContainer) {
      this.setupGlow();
      this.syncGlowSprites(this.sprites.length);
    } else if (!enabled && this.glowContainer) {
      this.container.removeChild(this.glowContainer);
      this.glowContainer.destroy({ children: true });
      this.glowContainer = null;
      this.glowSprites = [];
    }
  }

  /**
   * Set glow intensity
   */
  setGlowIntensity(intensity: number): void {
    this.config.glowIntensity = intensity;
    if (this.glowContainer) {
      this.glowContainer.alpha = intensity;
    }
  }

  /**
   * Sync glow sprites with bird count
   */
  private syncGlowSprites(count: number): void {
    if (!this.glowContainer || !this.glowTexture) return;
    
    const currentCount = this.glowSprites.length;
    
    if (count > currentCount) {
      for (let i = currentCount; i < count; i++) {
        const sprite = new PIXI.Sprite(this.glowTexture);
        sprite.anchor.set(0.5, 0.5);
        sprite.scale.set(1.5);
        sprite.blendMode = 'add';
        this.glowSprites.push(sprite);
        this.glowContainer.addChild(sprite);
      }
    } else if (count < currentCount) {
      for (let i = currentCount - 1; i >= count; i--) {
        const sprite = this.glowSprites.pop()!;
        this.glowContainer.removeChild(sprite);
        sprite.destroy();
      }
    }
  }

  /**
   * Update sprites to match bird count
   */
  syncBirdCount(count: number): void {
    const currentCount = this.sprites.length;
    
    if (count > currentCount) {
      for (let i = currentCount; i < count; i++) {
        const sprite = new PIXI.Sprite(this.currentTexture);
        sprite.anchor.set(0.5, 0.5);
        sprite.scale.set(0.8 * this.particleSize);
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
    
    // Sync glow sprites
    if (this.config.glowEnabled) {
      this.syncGlowSprites(count);
    }
  }

  /**
   * Update all bird sprites
   */
  update(birds: Bird[], simConfig: ISimulationConfig): void {
    // Ensure sprite count matches
    if (this.sprites.length !== birds.length) {
      this.syncBirdCount(birds.length);
    }
    
    // Update particle size from config
    if (this.particleSize !== simConfig.particleSize) {
      this.particleSize = simConfig.particleSize;
    }
    
    // Update each sprite
    const len = birds.length;
    for (let i = 0; i < len; i++) {
      const bird = birds[i];
      const sprite = this.sprites[i];
      
      // Position
      sprite.x = bird.position.x;
      sprite.y = bird.position.y;
      
      // Rotation (heading direction)
      sprite.rotation = bird.heading;
      
      // Color based on state
      sprite.tint = this.calculateBirdColor(bird);
      
      // Scale based on size config and speed (subtle)
      const speedScale = 0.7 + clamp(bird.speed / 20, 0, 0.5);
      sprite.scale.set(speedScale * this.particleSize);
      
      // Alpha based on panic (slight fade when calm)
      sprite.alpha = 0.85 + bird.panicLevel * 0.15;
      
      // Update glow sprite if enabled
      if (this.config.glowEnabled && this.glowSprites[i]) {
        const glow = this.glowSprites[i];
        glow.x = bird.position.x;
        glow.y = bird.position.y;
        glow.tint = sprite.tint;
        glow.scale.set(1.5 * this.particleSize * (0.8 + Math.sin(bird.id * 0.5 + Date.now() * 0.003) * 0.2));
      }
    }
    
    // Update trails if enabled
    if (this.config.showTrails) {
      this.updateTrails(birds);
    }
  }

  /**
   * Calculate bird color based on state
   */
  private calculateBirdColor(bird: Bird): number {
    // Get base colors - use species-specific colors if available
    let baseColor = this.baseColor;
    let denseColor = this.denseColor;
    let panicColor = this.panicColor;
    
    if (this.colorBySpecies && bird.speciesId !== 'default') {
      const speciesColor = this.speciesColors.get(bird.speciesId);
      if (speciesColor) {
        baseColor = speciesColor.base;
        denseColor = speciesColor.dense;
        panicColor = speciesColor.panic;
      }
    }
    
    let color = baseColor;
    
    // Color by speed
    if (this.config.colorBySpeed) {
      const speedFactor = clamp(bird.speed / 20, 0, 1);
      color = lerpColor(baseColor, denseColor, speedFactor);
    }
    // Color by density
    else if (this.config.colorByDensity) {
      const densityFactor = clamp(bird.localDensity / 15, 0, 1);
      color = lerpColor(baseColor, denseColor, densityFactor);
    }
    
    // Low energy makes color dimmer
    if (bird.energy < 0.5) {
      const energyFactor = bird.energy / 0.5;
      color = lerpColor(0x333333, color, energyFactor);
    }
    
    // Overlay panic color
    if (bird.panicLevel > 0.1) {
      color = lerpColor(color, panicColor, bird.panicLevel * 0.8);
    }
    
    return color;
  }
  
  /**
   * Set species colors for multi-species rendering
   */
  setSpeciesColors(speciesId: string, preset: ICreaturePreset): void {
    this.speciesColors.set(speciesId, {
      base: preset.baseColor,
      dense: preset.denseColor,
      panic: preset.panicColor
    });
  }
  
  /**
   * Enable/disable coloring by species
   */
  setColorBySpecies(enabled: boolean): void {
    this.colorBySpecies = enabled;
  }
  
  /**
   * Clear species color cache
   */
  clearSpeciesColors(): void {
    this.speciesColors.clear();
  }

  /**
   * Update motion trails
   */
  private updateTrails(birds: Bird[]): void {
    if (!this.trailContainer) return;
    
    const len = Math.min(birds.length, this.trails.length);
    for (let i = 0; i < len; i++) {
      const bird = birds[i];
      const trail = this.trails[i];
      
      trail.clear();
      
      // Only draw trail if bird is moving fast enough
      if (bird.speed < 3) continue;
      
      const trailLength = this.config.trailLength;
      const color = this.calculateBirdColor(bird);
      
      // Draw trail as line behind bird
      trail.moveTo(bird.position.x, bird.position.y);
      
      const tailX = bird.position.x - Math.cos(bird.heading) * bird.speed * trailLength;
      const tailY = bird.position.y - Math.sin(bird.heading) * bird.speed * trailLength;
      
      trail.lineTo(tailX, tailY);
      trail.stroke({ width: 1.5 * this.particleSize, color, alpha: 0.4 });
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
      
      for (let i = 0; i < this.sprites.length; i++) {
        const trail = new PIXI.Graphics();
        trail.alpha = 0.3;
        this.trails.push(trail);
        this.trailContainer.addChild(trail);
      }
    } else if (!enabled && this.trailContainer) {
      this.container.removeChild(this.trailContainer);
      this.trailContainer.destroy({ children: true });
      this.trailContainer = null;
      this.trails = [];
    }
  }

  /**
   * Set color by density mode
   */
  setColorByDensity(enabled: boolean): void {
    this.config.colorByDensity = enabled;
    if (enabled) this.config.colorBySpeed = false;
  }

  /**
   * Set color by speed mode
   */
  setColorBySpeed(enabled: boolean): void {
    this.config.colorBySpeed = enabled;
    if (enabled) this.config.colorByDensity = false;
  }

  /**
   * Set trail length
   */
  setTrailLength(length: number): void {
    this.config.trailLength = length;
  }

  /**
   * Get sprite count
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
    
    for (const sprite of this.glowSprites) {
      sprite.destroy();
    }
    this.glowSprites = [];
    
    for (const trail of this.trails) {
      trail.destroy();
    }
    this.trails = [];
    
    if (this.trailContainer) {
      this.trailContainer.destroy({ children: true });
      this.trailContainer = null;
    }
    
    if (this.glowContainer) {
      this.glowContainer.destroy({ children: true });
      this.glowContainer = null;
    }
  }

  /**
   * Destroy renderer and clean up resources
   */
  destroy(): void {
    this.clear();
    for (const texture of this.textures.values()) {
      texture.destroy(true);
    }
    this.textures.clear();
    if (this.glowTexture) {
      this.glowTexture.destroy(true);
    }
    this.container.destroy({ children: true });
  }
}
