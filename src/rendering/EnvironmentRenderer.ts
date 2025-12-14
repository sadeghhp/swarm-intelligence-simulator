/**
 * Environment Renderer - Visualizes environmental elements
 * Version: 2.0.0 - Multiple predator types with distinct visuals
 * 
 * Renders:
 * - Wind particles showing direction and strength
 * - Multiple predator types with unique shapes/colors
 * - Attractors/repulsors with pulsing effect
 * - Food sources
 */

import * as PIXI from 'pixi.js';
import type { IAttractor, IEnvironmentConfig, IRenderingConfig, IFoodSource, IPredatorState, PredatorType } from '../types';
import { Vector2 } from '../utils/Vector2';

/** Predator visual configuration */
interface PredatorVisualConfig {
  color: number;
  size: number;
  shape: 'triangle' | 'arrow' | 'circle' | 'oval';
}

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
    predatorStates: IPredatorState[] | null,
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
    
    // Update predators
    if (predatorStates && predatorStates.length > 0 && envConfig.predatorEnabled) {
      this.updatePredators(predatorStates);
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
   * Get visual configuration for a predator type
   */
  private getPredatorVisual(type: PredatorType): PredatorVisualConfig {
    switch (type) {
      case 'hawk':
        return { color: 0xff6b35, size: 12, shape: 'triangle' };
      case 'falcon':
        return { color: 0x4ecdc4, size: 10, shape: 'arrow' };
      case 'eagle':
        return { color: 0x8b4513, size: 16, shape: 'triangle' };
      case 'owl':
        return { color: 0x9b59b6, size: 14, shape: 'oval' };
      default:
        return { color: 0xff3366, size: 12, shape: 'circle' };
    }
  }

  /**
   * Update multiple predator visuals
   * Each predator's effective panic radius is in its state (accounts for stealth/altitude)
   */
  private updatePredators(predatorStates: IPredatorState[]): void {
    this.predatorGraphics.visible = true;
    this.predatorGraphics.clear();
    this.predatorRangeGraphics.clear();
    
    for (const state of predatorStates) {
      const visual = this.getPredatorVisual(state.type);
      const pos = state.position;
      const vel = state.velocity;
      
      // Calculate heading from velocity
      const heading = Math.atan2(vel.y, vel.x);
      
      // State-based effects
      const isActive = state.state === 'hunting' || state.state === 'attacking' || state.state === 'diving';
      const isStealthed = (state as any).isStealthed === true;
      const altitude = (state as any).altitude ?? 0;
      
      // Pulsing effect (faster when active)
      const pulseSpeed = isActive ? 8 : 4;
      const pulse = Math.sin(this.time * pulseSpeed + state.id) * 0.2 + 0.9;
      
      // Alpha based on stealth and altitude
      let alpha = 1.0;
      if (isStealthed) alpha = 0.4;
      if (altitude > 0) alpha = 0.6 + altitude * 0.4; // More visible at altitude
      
      // Draw predator shape based on type
      this.drawPredatorShape(pos.x, pos.y, heading, visual, pulse, alpha, state);
      
      // Draw energy bar
      this.drawEnergyBar(pos.x, pos.y, state.energy, state.maxEnergy, visual.color);
      
      // Draw panic range indicator using predator's effective panic radius
      if (this.renderConfig.showPredatorRange) {
        this.predatorRangeGraphics.visible = true;
        // Use the predator's actual effective panic radius from state
        const effectivePanicRadius = state.panicRadius;
        const rangeAlpha = isStealthed ? 0.15 : 0.3;
        
        this.drawDashedCircle(pos.x, pos.y, effectivePanicRadius, visual.color, rangeAlpha);
      }
      
      // Draw target line if hunting
      if (state.target && isActive) {
        this.predatorGraphics.moveTo(pos.x, pos.y);
        this.predatorGraphics.lineTo(state.target.x, state.target.y);
        this.predatorGraphics.stroke({ width: 1, color: visual.color, alpha: 0.4 });
      }
      
      // Falcon dive trail
      if (state.type === 'falcon' && state.state === 'diving') {
        this.drawDiveTrail(pos.x, pos.y, vel.x, vel.y, visual.color);
      }
      
      // Hawk burst effect
      if (state.type === 'hawk' && isActive) {
        this.drawSpeedLines(pos.x, pos.y, heading, visual.color);
      }
    }
    
    if (!this.renderConfig.showPredatorRange) {
      this.predatorRangeGraphics.visible = false;
    }
  }

  /**
   * Draw predator shape based on type
   */
  private drawPredatorShape(
    x: number, y: number, heading: number,
    visual: PredatorVisualConfig, pulse: number, alpha: number,
    state: IPredatorState
  ): void {
    const size = visual.size * pulse;
    
    switch (visual.shape) {
      case 'triangle':
        // Angular triangle (hawk/eagle)
        this.predatorGraphics.moveTo(
          x + Math.cos(heading) * size * 1.5,
          y + Math.sin(heading) * size * 1.5
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + 2.5) * size,
          y + Math.sin(heading + 2.5) * size
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading - 2.5) * size,
          y + Math.sin(heading - 2.5) * size
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha });
        break;
        
      case 'arrow':
        // Sleek arrow (falcon)
        this.predatorGraphics.moveTo(
          x + Math.cos(heading) * size * 2,
          y + Math.sin(heading) * size * 2
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + 2.8) * size * 0.8,
          y + Math.sin(heading + 2.8) * size * 0.8
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI) * size * 0.5,
          y + Math.sin(heading + Math.PI) * size * 0.5
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading - 2.8) * size * 0.8,
          y + Math.sin(heading - 2.8) * size * 0.8
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha });
        break;
        
      case 'oval':
        // Rounded oval (owl)
        this.predatorGraphics.ellipse(x, y, size * 0.8, size * 1.2);
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Eyes
        const eyeOffset = size * 0.3;
        this.predatorGraphics.circle(x - eyeOffset, y - size * 0.3, 3);
        this.predatorGraphics.circle(x + eyeOffset, y - size * 0.3, 3);
        this.predatorGraphics.fill({ color: 0xffff00, alpha: alpha * 0.9 });
        break;
        
      default:
        // Circle fallback
        this.predatorGraphics.circle(x, y, size);
        this.predatorGraphics.fill({ color: visual.color, alpha });
    }
    
    // Outer glow
    this.predatorGraphics.circle(x, y, size * 1.4 * pulse);
    this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.2 });
  }

  /**
   * Draw energy bar below predator
   */
  private drawEnergyBar(x: number, y: number, energy: number, maxEnergy: number, color: number): void {
    const barWidth = 24;
    const barHeight = 3;
    const barY = y + 20;
    
    // Background
    this.predatorGraphics.rect(x - barWidth / 2, barY, barWidth, barHeight);
    this.predatorGraphics.fill({ color: 0x333333, alpha: 0.6 });
    
    // Energy fill
    const fillWidth = (energy / maxEnergy) * barWidth;
    const energyColor = energy > maxEnergy * 0.3 ? color : 0xff0000;
    this.predatorGraphics.rect(x - barWidth / 2, barY, fillWidth, barHeight);
    this.predatorGraphics.fill({ color: energyColor, alpha: 0.8 });
  }

  /**
   * Draw dashed circle for panic radius
   */
  private drawDashedCircle(x: number, y: number, radius: number, color: number, alpha: number): void {
    const segments = 32;
    for (let i = 0; i < segments; i += 2) {
      const startAngle = (i / segments) * Math.PI * 2;
      const endAngle = ((i + 1) / segments) * Math.PI * 2;
      
      this.predatorRangeGraphics.moveTo(
        x + Math.cos(startAngle) * radius,
        y + Math.sin(startAngle) * radius
      );
      this.predatorRangeGraphics.lineTo(
        x + Math.cos(endAngle) * radius,
        y + Math.sin(endAngle) * radius
      );
    }
    this.predatorRangeGraphics.stroke({ width: 1, color, alpha });
  }

  /**
   * Draw dive trail for falcon
   */
  private drawDiveTrail(x: number, y: number, vx: number, vy: number, color: number): void {
    const trailLength = 5;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 1) return;
    
    const dx = -vx / speed;
    const dy = -vy / speed;
    
    for (let i = 1; i <= trailLength; i++) {
      const trailX = x + dx * i * 8;
      const trailY = y + dy * i * 8;
      const trailAlpha = 0.4 * (1 - i / trailLength);
      const trailSize = 4 * (1 - i / trailLength);
      
      this.predatorGraphics.circle(trailX, trailY, trailSize);
      this.predatorGraphics.fill({ color, alpha: trailAlpha });
    }
  }

  /**
   * Draw speed lines for hawk burst
   */
  private drawSpeedLines(x: number, y: number, heading: number, color: number): void {
    const lineCount = 3;
    const lineLength = 15;
    
    for (let i = 0; i < lineCount; i++) {
      const offset = (i - 1) * 0.3;
      const angle = heading + Math.PI + offset;
      
      const startX = x + Math.cos(angle) * 10;
      const startY = y + Math.sin(angle) * 10;
      const endX = startX + Math.cos(angle) * lineLength;
      const endY = startY + Math.sin(angle) * lineLength;
      
      this.predatorGraphics.moveTo(startX, startY);
      this.predatorGraphics.lineTo(endX, endY);
      this.predatorGraphics.stroke({ width: 2, color, alpha: 0.4 });
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

