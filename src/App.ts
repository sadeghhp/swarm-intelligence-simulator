/**
 * Main Application - Orchestrates the entire simulation
 * Version: 1.3.0 - Added energy system integration
 * 
 * This is the central hub that:
 * - Initializes PixiJS renderer
 * - Creates and manages all subsystems
 * - Handles the main game loop
 * - Coordinates user input
 * - Manages creature presets and food sources
 */

import * as PIXI from 'pixi.js';
import { Flock } from './simulation/Flock';
import { FlockRenderer } from './rendering/FlockRenderer';
import { EnvironmentRenderer } from './rendering/EnvironmentRenderer';
import { TrailEffect } from './rendering/TrailEffect';
import { ControlPanel } from './ui/ControlPanel';
import { Statistics } from './ui/Statistics';
import { Predator } from './environment/Predator';
import { FoodSourceManager } from './environment/FoodSource';
import { Vector2 } from './utils/Vector2';
import { getConfig, type ILoadedConfig } from './config/ConfigLoader';
import type { ISimulationConfig, IEnvironmentConfig, IRenderingConfig, CreaturePreset, ICreaturePreset } from './types';

// Pre-allocated vector for flock center calculation
const tempFlockCenter = new Vector2();
const tempFoodForce = new Vector2();

export class App {
  /** PixiJS Application */
  private app!: PIXI.Application;
  
  /** Simulation container canvas */
  private canvas: HTMLCanvasElement;
  
  /** Flock simulation */
  private flock!: Flock;
  
  /** Flock renderer */
  private flockRenderer!: FlockRenderer;
  
  /** Environment renderer */
  private envRenderer!: EnvironmentRenderer;
  
  /** Trail effect */
  private trailEffect!: TrailEffect;
  
  /** Control panel UI */
  private controlPanel!: ControlPanel;
  
  /** Statistics display */
  private statistics!: Statistics;
  
  /** Predator AI */
  private predator!: Predator;
  
  /** Food source manager */
  private foodManager!: FoodSourceManager;
  
  /** Configuration */
  private simConfig: ISimulationConfig;
  private envConfig: IEnvironmentConfig;
  private renderConfig: IRenderingConfig;
  
  /** Loaded config with presets */
  private loadedConfig: ILoadedConfig;
  
  /** Simulation dimensions */
  private width: number = 0;
  private height: number = 0;
  
  /** Last frame timestamp */
  private lastTime: number = 0;
  
  /** Is running */
  private running: boolean = false;

  constructor() {
    // Get canvas element
    this.canvas = document.getElementById('simulation-canvas') as HTMLCanvasElement;
    
    // Get loaded config (must be loaded before App is created)
    this.loadedConfig = getConfig();
    
    // Initialize configs from loaded JSON
    this.simConfig = { ...this.loadedConfig.simulation };
    this.envConfig = { ...this.loadedConfig.environment };
    this.renderConfig = { ...this.loadedConfig.rendering };
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    // Calculate dimensions (66% of viewport width)
    this.updateDimensions();
    
    // Initialize PixiJS
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.canvas,
      width: this.width,
      height: this.height,
      backgroundColor: 0x0a0a0f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    
    // Initialize simulation
    this.flock = new Flock(
      this.width,
      this.height,
      this.simConfig,
      this.envConfig
    );
    
    // Initialize predator
    this.predator = new Predator(this.width, this.height);
    
    // Initialize food manager
    this.foodManager = new FoodSourceManager(this.width, this.height);
    
    // Connect food manager to flock for energy system
    this.flock.setFoodManager(this.foodManager);
    
    // Initialize renderers
    this.flockRenderer = new FlockRenderer(this.renderConfig);
    this.envRenderer = new EnvironmentRenderer(this.width, this.height, this.renderConfig);
    this.trailEffect = new TrailEffect();
    
    // Add renderers to stage (order matters for layering)
    this.app.stage.addChild(this.trailEffect.getContainer());
    this.app.stage.addChild(this.envRenderer.getContainer());
    this.app.stage.addChild(this.flockRenderer.getContainer());
    
    // Initialize UI
    this.initializeUI();
    
    // Initialize statistics
    this.statistics = new Statistics();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial sync
    this.flockRenderer.syncBirdCount(this.simConfig.birdCount);
  }

  /**
   * Initialize control panel UI
   */
  private initializeUI(): void {
    const controlsWrapper = document.getElementById('controls-wrapper');
    if (!controlsWrapper) {
      throw new Error('Controls wrapper element not found');
    }
    
    this.controlPanel = new ControlPanel(
      controlsWrapper,
      this.simConfig,
      this.envConfig,
      this.renderConfig,
      {
        onBirdCountChange: (count) => {
          this.flock.setBirdCount(count);
          this.flockRenderer.syncBirdCount(count);
        },
        onPerceptionRadiusChange: (radius) => {
          this.flock.setPerceptionRadius(radius);
        },
        onPause: () => {
          this.simConfig.paused = true;
        },
        onResume: () => {
          this.simConfig.paused = false;
        },
        onReset: () => {
          this.resetSimulation();
        },
        onPredatorToggle: (enabled) => {
          if (enabled) {
            this.predator.reset();
          }
        },
        onTrailsToggle: (enabled) => {
          this.trailEffect.setEnabled(enabled);
          this.flockRenderer.setTrailsEnabled(false);
        },
        onPresetChange: (preset: CreaturePreset) => {
          this.applyPreset(preset);
        },
        onFoodToggle: (enabled) => {
          if (enabled) {
            this.foodManager.initialize(this.envConfig);
          } else {
            this.foodManager.clear();
          }
        },
        onColorChange: () => {
          this.updateColors();
        }
      }
    );
  }

  /**
   * Apply a creature preset
   */
  private applyPreset(preset: CreaturePreset): void {
    const presetConfig = this.getPreset(preset);
    
    // Update flock renderer visuals
    this.flockRenderer.setParticleSize(presetConfig.particleSize);
    this.flockRenderer.setColorTheme(
      presetConfig.baseColor,
      presetConfig.denseColor,
      presetConfig.panicColor
    );
    this.flockRenderer.setGlowEnabled(presetConfig.glowEnabled);
    this.flockRenderer.setGlowIntensity(presetConfig.glowIntensity);
    
    // Update trail effect colors
    this.trailEffect.setColor(presetConfig.baseColor);
  }

  /**
   * Get a creature preset from loaded config
   */
  private getPreset(preset: CreaturePreset): ICreaturePreset {
    return this.loadedConfig.creaturePresets[preset];
  }

  /**
   * Update colors from control panel
   */
  private updateColors(): void {
    this.flockRenderer.setColorTheme(
      this.renderConfig.baseColor,
      this.renderConfig.denseColor,
      this.renderConfig.panicColor
    );
    this.trailEffect.setColor(this.renderConfig.baseColor);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Resize handler
    window.addEventListener('resize', () => {
      this.handleResize();
    });
    
    // Click handler for attractors
    this.canvas.addEventListener('click', (event) => {
      this.handleClick(event);
    });
    
    // Right-click handler for repulsors
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.handleRightClick(event);
    });
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    this.updateDimensions();
    
    this.app.renderer.resize(this.width, this.height);
    this.flock.resize(this.width, this.height);
    this.envRenderer.resize(this.width, this.height);
    this.predator.resize(this.width, this.height);
    this.foodManager.resize(this.width, this.height);
  }

  /**
   * Update dimensions based on viewport
   */
  private updateDimensions(): void {
    const container = document.getElementById('simulation-container');
    if (container) {
      this.width = container.clientWidth;
      this.height = container.clientHeight;
    } else {
      this.width = window.innerWidth * 0.66;
      this.height = window.innerHeight;
    }
  }

  /**
   * Handle left click - add attractor or food
   */
  private handleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Add food if food mode is enabled, otherwise add attractor
    if (this.envConfig.foodEnabled && event.shiftKey) {
      this.foodManager.spawnFood(x, y, this.envConfig.foodAttractionRadius);
    } else {
      this.flock.addAttractor(x, y, 1.0, 150, 8, false);
    }
  }

  /**
   * Handle right click - add repulsor
   */
  private handleRightClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.flock.addAttractor(x, y, 1.5, 150, 8, true);
  }

  /**
   * Start the simulation
   */
  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Main game loop
   */
  private gameLoop(): void {
    if (!this.running) return;
    
    const now = performance.now();
    const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    
    // Sync configs from control panel
    this.syncConfigs();
    
    // Update simulation
    this.update(deltaTime);
    
    // Render
    this.render();
    
    // Update statistics
    this.updateStatistics();
    
    // Request next frame
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Sync configurations from control panel
   */
  private syncConfigs(): void {
    // Copy control panel configs to flock
    Object.assign(this.flock.config, this.controlPanel.simConfig);
    Object.assign(this.flock.envConfig, this.controlPanel.envConfig);
    
    // Update local refs
    this.simConfig = this.controlPanel.simConfig;
    this.envConfig = this.controlPanel.envConfig;
    this.renderConfig = this.controlPanel.renderConfig;
    
    // Update rendering options
    this.flockRenderer.setColorByDensity(this.renderConfig.colorByDensity);
    this.flockRenderer.setColorBySpeed(this.renderConfig.colorBySpeed);
    this.flockRenderer.setTrailLength(this.renderConfig.trailLength);
    this.flockRenderer.setShape(this.renderConfig.particleShape);
    this.flockRenderer.setParticleSize(this.simConfig.particleSize);
    this.flockRenderer.setGlowEnabled(this.renderConfig.glowEnabled);
    this.flockRenderer.setGlowIntensity(this.renderConfig.glowIntensity);
    
    this.trailEffect.setMaxLength(this.renderConfig.trailLength);
    this.envRenderer.setWindParticlesEnabled(this.renderConfig.showWindParticles);
    this.envRenderer.setPredatorRangeEnabled(this.renderConfig.showPredatorRange);
  }

  /**
   * Update simulation
   */
  private update(deltaTime: number): void {
    // Update predator
    if (this.envConfig.predatorEnabled) {
      const flockCenter = this.calculateFlockCenter();
      this.predator.update(deltaTime, this.envConfig, this.flock.birds, flockCenter);
      this.flock.setPredatorPosition(this.predator.position);
    } else {
      this.flock.setPredatorPosition(null);
    }
    
    // Update food sources
    if (this.envConfig.foodEnabled) {
      this.foodManager.update(deltaTime, this.envConfig);
      this.applyFoodAttraction();
    }
    
    // Update flock
    this.flock.update(deltaTime);
    
    // Update trail effect
    if (this.renderConfig.showTrails) {
      this.trailEffect.update(this.flock.birds, deltaTime);
    }
  }

  /**
   * Apply food attraction forces to birds
   */
  private applyFoodAttraction(): void {
    const birds = this.flock.birds;
    const strength = this.envConfig.foodAttractionStrength;
    const radius = this.envConfig.foodAttractionRadius;
    
    for (let i = 0; i < birds.length; i++) {
      const bird = birds[i];
      
      if (this.foodManager.getAttractionForce(bird.position, strength * 0.3, radius, tempFoodForce)) {
        bird.applyForce(tempFoodForce);
        
        // Try to consume food if very close
        this.foodManager.consume(bird.position, 0.1);
      }
    }
  }

  /**
   * Calculate center of flock
   */
  private calculateFlockCenter(): Vector2 {
    tempFlockCenter.x = 0;
    tempFlockCenter.y = 0;
    
    const birds = this.flock.birds;
    const len = birds.length;
    
    if (len === 0) {
      return tempFlockCenter.set(this.width / 2, this.height / 2);
    }
    
    for (let i = 0; i < len; i++) {
      tempFlockCenter.x += birds[i].position.x;
      tempFlockCenter.y += birds[i].position.y;
    }
    
    tempFlockCenter.x /= len;
    tempFlockCenter.y /= len;
    
    return tempFlockCenter;
  }

  /**
   * Render frame
   */
  private render(): void {
    // Update flock renderer
    this.flockRenderer.update(this.flock.birds, this.simConfig);
    
    // Get food sources for rendering
    const foodSources = this.envConfig.foodEnabled && this.renderConfig.showFoodSources
      ? this.foodManager.getAll()
      : [];
    
    // Update environment renderer
    this.envRenderer.update(
      1 / 60,
      this.envConfig,
      this.envConfig.predatorEnabled ? this.predator.position : null,
      this.flock.getAttractors(),
      foodSources
    );
  }

  /**
   * Update statistics display
   */
  private updateStatistics(): void {
    const stats = this.flock.getStats();
    stats.predatorState = this.predator.state;
    stats.foodConsumed = Math.floor(this.foodManager.totalConsumed);
    stats.activeFood = this.foodManager.getActiveCount();
    this.statistics.update(stats);
    this.flock.setFPS(this.statistics.getFps());
  }

  /**
   * Reset the simulation
   */
  private resetSimulation(): void {
    this.flock.reset();
    this.predator.reset();
    this.trailEffect.clear();
    this.foodManager.initialize(this.envConfig);
    this.foodManager.resetStats();
    this.flockRenderer.syncBirdCount(this.simConfig.birdCount);
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.running = false;
    this.controlPanel.dispose();
    this.flockRenderer.destroy();
    this.envRenderer.destroy();
    this.trailEffect.destroy();
    this.app.destroy(true);
  }
}
