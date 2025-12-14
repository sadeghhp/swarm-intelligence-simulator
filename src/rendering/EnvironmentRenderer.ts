/**
 * Environment Renderer - Visualizes environmental elements
 * Version: 2.2.0 - Added ocean predator visuals (shark, orca, barracuda, sea_lion)
 * 
 * Renders:
 * - Wind particles showing direction and strength
 * - Multiple predator types with unique shapes/colors (air + ocean)
 * - Attractors/repulsors with pulsing effect
 * - Food sources with feeder count and active consumption indicator
 */

import * as PIXI from 'pixi.js';
import type { IAttractor, IEnvironmentConfig, IRenderingConfig, IFoodSource, IPredatorState, PredatorType } from '../types';

/** Predator visual configuration */
interface PredatorVisualConfig {
  color: number;
  size: number;
  shape: 'triangle' | 'arrow' | 'circle' | 'oval' | 'fin' | 'torpedo' | 'streamlined' | 'flipper';
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
   * Shows feeder count and enhanced visuals when creatures are actively feeding
   */
  private updateFoodSources(sources: IFoodSource[]): void {
    this.foodContainer.removeChildren();
    
    for (const source of sources) {
      const graphics = new PIXI.Graphics();
      
      const amountRatio = source.amount / source.maxAmount;
      const feederCount = source.feeders?.size || 0;
      const isBeingConsumed = feederCount > 0;
      
      // Enhanced pulsing when actively consumed
      const basePulseSpeed = isBeingConsumed ? 6 : 2;
      const pulseIntensity = isBeingConsumed ? 0.25 : 0.15;
      const pulse = Math.sin(this.time * basePulseSpeed + source.id * 0.5) * pulseIntensity + (1 - pulseIntensity / 2);
      
      // Outer glow - larger and more visible when being consumed
      const outerGlowRadius = isBeingConsumed 
        ? source.radius * 0.4 * pulse 
        : source.radius * 0.3 * pulse;
      const outerGlowColor = isBeingConsumed ? 0xffff88 : 0x88ff88;
      graphics.circle(source.position.x, source.position.y, outerGlowRadius);
      graphics.fill({ color: outerGlowColor, alpha: (isBeingConsumed ? 0.2 : 0.1) * amountRatio });
      
      // Gathering radius indicator (when feeders present)
      if (isBeingConsumed && source.radius > 30) {
        // Draw subtle gathering zone
        graphics.circle(source.position.x, source.position.y, source.radius * 0.5);
        graphics.stroke({ width: 1, color: 0x88ff88, alpha: 0.15 });
      }
      
      // Inner circle (size based on remaining amount)
      const innerRadius = 8 + amountRatio * 8;
      const innerColor = isBeingConsumed ? 0x88ff44 : 0x44ff44;
      graphics.circle(source.position.x, source.position.y, innerRadius * pulse);
      graphics.fill({ color: innerColor, alpha: (isBeingConsumed ? 0.8 : 0.6) * amountRatio });
      
      // Core - brighter when being consumed
      const coreColor = isBeingConsumed ? 0xffffaa : 0xaaffaa;
      graphics.circle(source.position.x, source.position.y, 5 * pulse);
      graphics.fill({ color: coreColor, alpha: 0.9 });
      
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
        
        // Ring color changes based on consumption state
        const ringColor = isBeingConsumed ? 0xffff00 : 0x00ff00;
        graphics.stroke({ width: 2, color: ringColor, alpha: isBeingConsumed ? 0.7 : 0.5 });
      }
      
      // Draw feeder count indicator when creatures are feeding
      if (feederCount > 0) {
        // Draw feeder indicator dots around the food
        const indicatorRadius = innerRadius + 12;
        const maxIndicators = Math.min(feederCount, 12); // Cap visual indicators
        
        for (let i = 0; i < maxIndicators; i++) {
          const angle = (i / maxIndicators) * Math.PI * 2 - Math.PI / 2;
          // Add slight animation offset per dot
          const dotPulse = Math.sin(this.time * 4 + i * 0.5) * 0.3 + 0.7;
          const dotX = source.position.x + Math.cos(angle + this.time * 0.5) * indicatorRadius;
          const dotY = source.position.y + Math.sin(angle + this.time * 0.5) * indicatorRadius;
          
          graphics.circle(dotX, dotY, 2 * dotPulse);
          graphics.fill({ color: 0xffaa00, alpha: 0.7 });
        }
        
        // Draw feeder count text (as a number near the food)
        if (feederCount > 3) {
          // Draw background for count
          const countX = source.position.x + innerRadius + 8;
          const countY = source.position.y - innerRadius - 4;
          
          graphics.circle(countX, countY, 8);
          graphics.fill({ color: 0x333333, alpha: 0.7 });
          
          // Simple number representation using dots for counts
          const displayCount = Math.min(feederCount, 99);
          if (displayCount < 10) {
            // Single digit - show as center dot
            graphics.circle(countX, countY, 3);
            graphics.fill({ color: 0xffaa00, alpha: 0.9 });
          } else {
            // Double digit - show two small dots
            graphics.circle(countX - 2, countY, 2);
            graphics.circle(countX + 2, countY, 2);
            graphics.fill({ color: 0xffaa00, alpha: 0.9 });
          }
        }
      }
      
      // Consumption particle effect when actively being consumed
      if (isBeingConsumed && source.consumptionRate > 0) {
        const particleCount = Math.min(Math.ceil(feederCount / 2), 5);
        for (let i = 0; i < particleCount; i++) {
          // Create floating particles effect
          const particleTime = (this.time * 2 + i * 1.5) % 1;
          const particleAngle = (i / particleCount) * Math.PI * 2 + this.time;
          const particleDist = innerRadius * (1 - particleTime * 0.5);
          const particleX = source.position.x + Math.cos(particleAngle) * particleDist;
          const particleY = source.position.y + Math.sin(particleAngle) * particleDist - particleTime * 15;
          
          graphics.circle(particleX, particleY, 2 * (1 - particleTime));
          graphics.fill({ color: 0xaaffaa, alpha: (1 - particleTime) * 0.6 });
        }
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
      // Air predators
      case 'hawk':
        return { color: 0xff6b35, size: 12, shape: 'triangle' };
      case 'falcon':
        return { color: 0x4ecdc4, size: 10, shape: 'arrow' };
      case 'eagle':
        return { color: 0x8b4513, size: 16, shape: 'triangle' };
      case 'owl':
        return { color: 0x9b59b6, size: 14, shape: 'oval' };
      // Ocean predators
      case 'shark':
        return { color: 0x5f7c8a, size: 16, shape: 'fin' };
      case 'orca':
        return { color: 0x1a1a2e, size: 20, shape: 'torpedo' };
      case 'barracuda':
        return { color: 0xc0c0c0, size: 14, shape: 'streamlined' };
      case 'sea_lion':
        return { color: 0x8b6914, size: 12, shape: 'flipper' };
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
      
      // Shark circling effect (water ripples when hunting)
      if (state.type === 'shark' && isActive) {
        this.drawWaterRipples(pos.x, pos.y, visual.color);
      }
      
      // Orca wake effect (large predator creates visible wake)
      if (state.type === 'orca' && isActive) {
        this.drawWake(pos.x, pos.y, vel.x, vel.y, visual.color);
      }
      
      // Barracuda burst trail (silver flash)
      if (state.type === 'barracuda' && state.state === 'attacking') {
        this.drawBurstTrail(pos.x, pos.y, vel.x, vel.y, visual.color);
      }
      
      // Sea lion bubble trail
      if (state.type === 'sea_lion' && isActive) {
        this.drawBubbles(pos.x, pos.y, heading);
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
    _state: IPredatorState
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
        
      case 'fin':
        // Shark shape with dorsal fin
        // Main body - elongated oval
        this.predatorGraphics.ellipse(x, y, size * 1.2, size * 0.5);
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Nose point
        this.predatorGraphics.moveTo(
          x + Math.cos(heading) * size * 1.8,
          y + Math.sin(heading) * size * 1.8
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + 2.3) * size * 1.2,
          y + Math.sin(heading + 2.3) * size * 1.2
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading - 2.3) * size * 1.2,
          y + Math.sin(heading - 2.3) * size * 1.2
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Dorsal fin (perpendicular to heading)
        const finAngle = heading - Math.PI / 2;
        this.predatorGraphics.moveTo(x, y);
        this.predatorGraphics.lineTo(
          x + Math.cos(finAngle) * size * 0.8,
          y + Math.sin(finAngle) * size * 0.8
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI) * size * 0.4,
          y + Math.sin(heading + Math.PI) * size * 0.4
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.9 });
        // Tail fin
        this.predatorGraphics.moveTo(
          x + Math.cos(heading + Math.PI) * size * 1.2,
          y + Math.sin(heading + Math.PI) * size * 1.2
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI + 0.5) * size * 1.6,
          y + Math.sin(heading + Math.PI + 0.5) * size * 1.6
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI - 0.5) * size * 1.6,
          y + Math.sin(heading + Math.PI - 0.5) * size * 1.6
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.8 });
        break;
        
      case 'torpedo':
        // Orca shape - large torpedo with distinctive markings
        // Main body
        this.predatorGraphics.ellipse(x, y, size * 1.4, size * 0.6);
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Head
        this.predatorGraphics.moveTo(
          x + Math.cos(heading) * size * 1.8,
          y + Math.sin(heading) * size * 1.8
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + 2.0) * size * 1.4,
          y + Math.sin(heading + 2.0) * size * 1.4
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading - 2.0) * size * 1.4,
          y + Math.sin(heading - 2.0) * size * 1.4
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // White belly marking (orca distinctive)
        const bellyAngle = heading + Math.PI / 2;
        this.predatorGraphics.ellipse(
          x + Math.cos(bellyAngle) * size * 0.15,
          y + Math.sin(bellyAngle) * size * 0.15,
          size * 0.8, size * 0.25
        );
        this.predatorGraphics.fill({ color: 0xffffff, alpha: alpha * 0.7 });
        // Dorsal fin (tall)
        const orcaFinAngle = heading - Math.PI / 2;
        this.predatorGraphics.moveTo(x, y);
        this.predatorGraphics.lineTo(
          x + Math.cos(orcaFinAngle) * size * 1.0,
          y + Math.sin(orcaFinAngle) * size * 1.0
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI) * size * 0.3,
          y + Math.sin(heading + Math.PI) * size * 0.3
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.9 });
        break;
        
      case 'streamlined':
        // Barracuda shape - very elongated, streamlined
        // Long thin body
        this.predatorGraphics.ellipse(x, y, size * 1.8, size * 0.3);
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Sharp nose
        this.predatorGraphics.moveTo(
          x + Math.cos(heading) * size * 2.2,
          y + Math.sin(heading) * size * 2.2
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + 2.6) * size * 1.8,
          y + Math.sin(heading + 2.6) * size * 1.8
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading - 2.6) * size * 1.8,
          y + Math.sin(heading - 2.6) * size * 1.8
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Forked tail
        this.predatorGraphics.moveTo(
          x + Math.cos(heading + Math.PI) * size * 1.8,
          y + Math.sin(heading + Math.PI) * size * 1.8
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI + 0.4) * size * 2.2,
          y + Math.sin(heading + Math.PI + 0.4) * size * 2.2
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI) * size * 1.6,
          y + Math.sin(heading + Math.PI) * size * 1.6
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI - 0.4) * size * 2.2,
          y + Math.sin(heading + Math.PI - 0.4) * size * 2.2
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.8 });
        // Silver stripe
        this.predatorGraphics.moveTo(
          x + Math.cos(heading) * size * 1.5,
          y + Math.sin(heading) * size * 1.5
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI) * size * 1.5,
          y + Math.sin(heading + Math.PI) * size * 1.5
        );
        this.predatorGraphics.stroke({ width: 2, color: 0xffffff, alpha: alpha * 0.4 });
        break;
        
      case 'flipper':
        // Sea lion shape - rounded with flippers
        // Body
        this.predatorGraphics.ellipse(x, y, size * 1.0, size * 0.6);
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Head (rounded)
        this.predatorGraphics.circle(
          x + Math.cos(heading) * size * 0.8,
          y + Math.sin(heading) * size * 0.8,
          size * 0.45
        );
        this.predatorGraphics.fill({ color: visual.color, alpha });
        // Nose
        this.predatorGraphics.circle(
          x + Math.cos(heading) * size * 1.2,
          y + Math.sin(heading) * size * 1.2,
          size * 0.2
        );
        this.predatorGraphics.fill({ color: 0x5a4010, alpha: alpha * 0.9 });
        // Front flippers
        const flipperAngle1 = heading + Math.PI / 2;
        const flipperAngle2 = heading - Math.PI / 2;
        // Left flipper
        this.predatorGraphics.moveTo(
          x + Math.cos(flipperAngle1) * size * 0.4,
          y + Math.sin(flipperAngle1) * size * 0.4
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(flipperAngle1 + 0.3) * size * 0.9,
          y + Math.sin(flipperAngle1 + 0.3) * size * 0.9
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(flipperAngle1 - 0.2) * size * 0.7,
          y + Math.sin(flipperAngle1 - 0.2) * size * 0.7
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.8 });
        // Right flipper
        this.predatorGraphics.moveTo(
          x + Math.cos(flipperAngle2) * size * 0.4,
          y + Math.sin(flipperAngle2) * size * 0.4
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(flipperAngle2 - 0.3) * size * 0.9,
          y + Math.sin(flipperAngle2 - 0.3) * size * 0.9
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(flipperAngle2 + 0.2) * size * 0.7,
          y + Math.sin(flipperAngle2 + 0.2) * size * 0.7
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.8 });
        // Tail
        this.predatorGraphics.moveTo(
          x + Math.cos(heading + Math.PI) * size * 1.0,
          y + Math.sin(heading + Math.PI) * size * 1.0
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI + 0.3) * size * 1.3,
          y + Math.sin(heading + Math.PI + 0.3) * size * 1.3
        );
        this.predatorGraphics.lineTo(
          x + Math.cos(heading + Math.PI - 0.3) * size * 1.3,
          y + Math.sin(heading + Math.PI - 0.3) * size * 1.3
        );
        this.predatorGraphics.closePath();
        this.predatorGraphics.fill({ color: visual.color, alpha: alpha * 0.8 });
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
   * Draw water ripples for shark circling
   */
  private drawWaterRipples(x: number, y: number, _color: number): void {
    const rippleCount = 3;
    for (let i = 0; i < rippleCount; i++) {
      const ripplePhase = (this.time * 2 + i * 0.8) % 1;
      const radius = 15 + ripplePhase * 30;
      const alpha = (1 - ripplePhase) * 0.3;
      
      this.predatorGraphics.circle(x, y, radius);
      this.predatorGraphics.stroke({ width: 1.5, color: 0x4488aa, alpha });
    }
  }

  /**
   * Draw wake effect for orca
   */
  private drawWake(x: number, y: number, vx: number, vy: number, _color: number): void {
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 1) return;
    
    const dx = -vx / speed;
    const dy = -vy / speed;
    const perpX = -dy;
    const perpY = dx;
    
    // Draw V-shaped wake
    for (let i = 1; i <= 4; i++) {
      const dist = i * 12;
      const spread = i * 6;
      const alpha = 0.35 * (1 - i / 5);
      
      // Left wake line
      this.predatorGraphics.circle(
        x + dx * dist + perpX * spread,
        y + dy * dist + perpY * spread,
        3 - i * 0.5
      );
      this.predatorGraphics.fill({ color: 0x6699bb, alpha });
      
      // Right wake line
      this.predatorGraphics.circle(
        x + dx * dist - perpX * spread,
        y + dy * dist - perpY * spread,
        3 - i * 0.5
      );
      this.predatorGraphics.fill({ color: 0x6699bb, alpha });
    }
  }

  /**
   * Draw burst trail for barracuda attack
   */
  private drawBurstTrail(x: number, y: number, vx: number, vy: number, _color: number): void {
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 1) return;
    
    const dx = -vx / speed;
    const dy = -vy / speed;
    
    // Silver flash trail
    for (let i = 1; i <= 6; i++) {
      const trailX = x + dx * i * 10;
      const trailY = y + dy * i * 10;
      const trailAlpha = 0.6 * (1 - i / 7);
      const trailSize = 5 * (1 - i / 7);
      
      this.predatorGraphics.circle(trailX, trailY, trailSize);
      this.predatorGraphics.fill({ color: 0xffffff, alpha: trailAlpha });
    }
    
    // Motion blur line
    this.predatorGraphics.moveTo(x, y);
    this.predatorGraphics.lineTo(x + dx * 50, y + dy * 50);
    this.predatorGraphics.stroke({ width: 3, color: 0xffffff, alpha: 0.3 });
  }

  /**
   * Draw bubbles for sea lion
   */
  private drawBubbles(x: number, y: number, heading: number): void {
    const bubbleCount = 4;
    const tailAngle = heading + Math.PI;
    
    for (let i = 0; i < bubbleCount; i++) {
      // Animated bubble positions
      const bubbleTime = (this.time * 3 + i * 0.5) % 1;
      const bubbleOffset = 15 + i * 8;
      const bubbleFloat = bubbleTime * 20;
      const bubbleX = x + Math.cos(tailAngle) * bubbleOffset + (Math.random() - 0.5) * 5;
      const bubbleY = y + Math.sin(tailAngle) * bubbleOffset - bubbleFloat;
      const bubbleSize = 2 + (1 - bubbleTime) * 2;
      const bubbleAlpha = (1 - bubbleTime) * 0.5;
      
      this.predatorGraphics.circle(bubbleX, bubbleY, bubbleSize);
      this.predatorGraphics.stroke({ width: 1, color: 0xaaddff, alpha: bubbleAlpha });
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

