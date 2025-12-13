/**
 * Environment Renderer - Visualizes environmental elements
 * Version: 1.0.0
 * 
 * Renders:
 * - Wind particles showing direction and strength
 * - Predator sprite with attack indicator
 * - Attractors/repulsors with pulsing effect
 */

import * as PIXI from 'pixi.js';
import type { IAttractor, IEnvironmentConfig, IRenderingConfig, IFoodSource } from '../types';
import { Vector2 } from '../utils/Vector2';

interface WindParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
}

export class EnvironmentRenderer {
  /** Main container */
  private container: PIXI.Container;
  
  /** Wind particle container */
  private windContainer: PIXI.Container;
  
  /** Predator graphics */
  private predatorGraphics: PIXI.Graphics;
  
  /** Predator range indicator */
  private predatorRangeGraphics: PIXI.Graphics;
  
  /** Attractor container */
  private attractorContainer: PIXI.Container;
  
  /** Food source container */
  private foodContainer: PIXI.Container;
  
  /** Wind particles */
  private windParticles: WindParticle[] = [];
  
  /** Wind particle count */
  private readonly WIND_PARTICLE_COUNT = 100;
  
  /** Simulation dimensions */
  private width: number;
  private height: number;
  
  /** Animation time */
  private time: number = 0;
  
  /** Configuration */
  private renderConfig: IRenderingConfig;

  constructor(
    width: number,
    height: number,
    renderConfig: IRenderingConfig
  ) {
    this.width = width;
    this.height = height;
    this.renderConfig = renderConfig;
    
    // Create containers
    this.container = new PIXI.Container();
    
    // Wind particle layer (behind everything)
    this.windContainer = new PIXI.Container();
    this.windContainer.alpha = 0.3;
    this.container.addChild(this.windContainer);
    
    // Food source layer
    this.foodContainer = new PIXI.Container();
    this.container.addChild(this.foodContainer);
    
    // Attractor layer
    this.attractorContainer = new PIXI.Container();
    this.container.addChild(this.attractorContainer);
    
    // Predator range indicator (behind predator)
    this.predatorRangeGraphics = new PIXI.Graphics();
    this.predatorRangeGraphics.visible = false;
    this.container.addChild(this.predatorRangeGraphics);
    
    // Predator graphics
    this.predatorGraphics = new PIXI.Graphics();
    this.predatorGraphics.visible = false;
    this.container.addChild(this.predatorGraphics);
    
    // Initialize wind particles
    this.initWindParticles();
  }

  /**
   * Get container to add to stage
   */
  getContainer(): PIXI.Container {
    return this.container;
  }

  /**
   * Initialize wind particle pool
   */
  private initWindParticles(): void {
    for (let i = 0; i < this.WIND_PARTICLE_COUNT; i++) {
      this.windParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: 0,
        vy: 0,
        alpha: Math.random(),
        life: Math.random()
      });
    }
  }

  /**
   * Update all environmental visuals
   */
  update(
    deltaTime: number,
    envConfig: IEnvironmentConfig,
    predatorPosition: Vector2 | null,
    attractors: IAttractor[],
    foodSources: IFoodSource[] = []
  ): void {
    this.time += deltaTime;
    
    // Update wind particles
    if (this.renderConfig.showWindParticles && envConfig.windSpeed > 0) {
      this.updateWindParticles(deltaTime, envConfig);
      this.windContainer.visible = true;
    } else {
      this.windContainer.visible = false;
    }
    
    // Update predator
    if (predatorPosition && envConfig.predatorEnabled) {
      this.updatePredator(predatorPosition, envConfig.panicRadius);
    } else {
      this.predatorGraphics.visible = false;
      this.predatorRangeGraphics.visible = false;
    }
    
    // Update attractors
    this.updateAttractors(attractors);
    
    // Update food sources
    if (this.renderConfig.showFoodSources && foodSources.length > 0) {
      this.updateFoodSources(foodSources);
      this.foodContainer.visible = true;
    } else {
      this.foodContainer.visible = false;
    }
  }

  /**
   * Update food source visuals
   */
  private updateFoodSources(sources: IFoodSource[]): void {
    this.foodContainer.removeChildren();
    
    for (const source of sources) {
      const graphics = new PIXI.Graphics();
      
      // Pulsing effect
      const pulse = Math.sin(this.time * 2 + source.id * 0.5) * 0.15 + 0.85;
      const amountRatio = source.amount / source.maxAmount;
      
      // Outer glow
      graphics.circle(source.position.x, source.position.y, source.radius * 0.3 * pulse);
      graphics.fill({ color: 0x88ff88, alpha: 0.1 * amountRatio });
      
      // Inner circle (size based on remaining amount)
      const innerRadius = 8 + amountRatio * 8;
      graphics.circle(source.position.x, source.position.y, innerRadius * pulse);
      graphics.fill({ color: 0x44ff44, alpha: 0.6 * amountRatio });
      
      // Core
      graphics.circle(source.position.x, source.position.y, 5 * pulse);
      graphics.fill({ color: 0xaaffaa, alpha: 0.9 });
      
      // Amount indicator ring (only when partially consumed)
      if (amountRatio < 1 && amountRatio > 0) {
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + amountRatio * Math.PI * 2;
        const ringRadius = innerRadius + 4;
        
        // Move to the start of the arc first to avoid line from origin
        const startX = source.position.x + Math.cos(startAngle) * ringRadius;
        const startY = source.position.y + Math.sin(startAngle) * ringRadius;
        graphics.moveTo(startX, startY);
        graphics.arc(source.position.x, source.position.y, ringRadius, startAngle, endAngle);
        graphics.stroke({ width: 2, color: 0x00ff00, alpha: 0.5 });
      }
      
      this.foodContainer.addChild(graphics);
    }
  }

  /**
   * Update wind particles
   */
  private updateWindParticles(deltaTime: number, envConfig: IEnvironmentConfig): void {
    const windAngle = envConfig.windDirection * Math.PI / 180;
    const windVx = Math.cos(windAngle) * envConfig.windSpeed * 5;
    const windVy = Math.sin(windAngle) * envConfig.windSpeed * 5;
    
    // Clear previous drawing
    this.windContainer.removeChildren();
    
    const graphics = new PIXI.Graphics();
    
    for (const particle of this.windParticles) {
      // Update velocity with some randomness
      particle.vx = windVx + (Math.random() - 0.5) * envConfig.windTurbulence * 20;
      particle.vy = windVy + (Math.random() - 0.5) * envConfig.windTurbulence * 20;
      
      // Update position
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      
      // Update life
      particle.life -= deltaTime * 0.5;
      
      // Reset if out of bounds or dead
      if (
        particle.x < 0 || particle.x > this.width ||
        particle.y < 0 || particle.y > this.height ||
        particle.life <= 0
      ) {
        // Respawn at edge based on wind direction
        if (windVx > 0) {
          particle.x = 0;
        } else if (windVx < 0) {
          particle.x = this.width;
        } else {
          particle.x = Math.random() * this.width;
        }
        
        if (windVy > 0) {
          particle.y = 0;
        } else if (windVy < 0) {
          particle.y = this.height;
        } else {
          particle.y = Math.random() * this.height;
        }
        
        particle.life = 1;
        particle.alpha = 0.3 + Math.random() * 0.4;
      }
      
      // Draw particle as small line
      const length = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy) * 0.1;
      const angle = Math.atan2(particle.vy, particle.vx);
      
      graphics.moveTo(particle.x, particle.y);
      graphics.lineTo(
        particle.x + Math.cos(angle) * length,
        particle.y + Math.sin(angle) * length
      );
      graphics.stroke({ width: 1, color: 0x00d4ff, alpha: particle.alpha * particle.life });
    }
    
    this.windContainer.addChild(graphics);
  }

  /**
   * Update predator visual
   */
  private updatePredator(position: Vector2, panicRadius: number): void {
    this.predatorGraphics.visible = true;
    
    // Draw predator (hawk shape)
    this.predatorGraphics.clear();
    
    // Body
    this.predatorGraphics.circle(position.x, position.y, 12);
    this.predatorGraphics.fill({ color: 0xff3366 });
    
    // Pulsing effect
    const pulse = Math.sin(this.time * 5) * 0.3 + 0.7;
    this.predatorGraphics.circle(position.x, position.y, 16 * pulse);
    this.predatorGraphics.fill({ color: 0xff3366, alpha: 0.3 });
    
    // Panic range indicator
    if (this.renderConfig.showPredatorRange) {
      this.predatorRangeGraphics.visible = true;
      this.predatorRangeGraphics.clear();
      
      // Draw dashed circle for panic radius
      const segments = 32;
      for (let i = 0; i < segments; i += 2) {
        const startAngle = (i / segments) * Math.PI * 2;
        const endAngle = ((i + 1) / segments) * Math.PI * 2;
        
        this.predatorRangeGraphics.moveTo(
          position.x + Math.cos(startAngle) * panicRadius,
          position.y + Math.sin(startAngle) * panicRadius
        );
        this.predatorRangeGraphics.lineTo(
          position.x + Math.cos(endAngle) * panicRadius,
          position.y + Math.sin(endAngle) * panicRadius
        );
      }
      this.predatorRangeGraphics.stroke({ width: 1, color: 0xff3366, alpha: 0.3 });
    } else {
      this.predatorRangeGraphics.visible = false;
    }
  }

  /**
   * Update attractor visuals
   */
  private updateAttractors(attractors: IAttractor[]): void {
    // Clear previous
    this.attractorContainer.removeChildren();
    
    for (const attractor of attractors) {
      const graphics = new PIXI.Graphics();
      
      // Pulsing effect based on lifetime
      const lifeFactor = attractor.lifetime / attractor.maxLifetime;
      const pulse = Math.sin(this.time * 3) * 0.2 + 0.8;
      
      const color = attractor.isRepulsor ? 0xff6b6b : 0x6bff6b;
      const alpha = lifeFactor * 0.6;
      
      // Outer ring
      graphics.circle(attractor.position.x, attractor.position.y, attractor.radius * pulse);
      graphics.stroke({ width: 2, color, alpha: alpha * 0.3 });
      
      // Inner circle
      graphics.circle(attractor.position.x, attractor.position.y, 10);
      graphics.fill({ color, alpha });
      
      // Icon (+ for attractor, - for repulsor)
      graphics.moveTo(attractor.position.x - 5, attractor.position.y);
      graphics.lineTo(attractor.position.x + 5, attractor.position.y);
      graphics.stroke({ width: 2, color: 0xffffff, alpha: alpha });
      
      if (!attractor.isRepulsor) {
        graphics.moveTo(attractor.position.x, attractor.position.y - 5);
        graphics.lineTo(attractor.position.x, attractor.position.y + 5);
        graphics.stroke({ width: 2, color: 0xffffff, alpha: alpha });
      }
      
      this.attractorContainer.addChild(graphics);
    }
  }

  /**
   * Resize environment renderer
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    // Redistribute wind particles
    for (const particle of this.windParticles) {
      particle.x = Math.random() * width;
      particle.y = Math.random() * height;
    }
  }

  /**
   * Toggle wind particle visibility
   */
  setWindParticlesEnabled(enabled: boolean): void {
    this.renderConfig.showWindParticles = enabled;
  }

  /**
   * Toggle predator range visibility
   */
  setPredatorRangeEnabled(enabled: boolean): void {
    this.renderConfig.showPredatorRange = enabled;
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.container.destroy({ children: true });
  }
}

