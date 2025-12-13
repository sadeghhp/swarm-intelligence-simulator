/**
 * Control Panel - Tweakpane integration for real-time parameter adjustment
 * Version: 1.0.0
 * 
 * Provides organized controls for all simulation parameters:
 * - Simulation controls (bird count, speed, pause/reset)
 * - Swarm rule weights
 * - Environmental settings
 * - Rendering options
 */

import { Pane } from 'tweakpane';
import type {
  ISimulationConfig,
  IEnvironmentConfig,
  IRenderingConfig
} from '../types';

export interface ControlPanelCallbacks {
  onBirdCountChange: (count: number) => void;
  onPerceptionRadiusChange: (radius: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onPredatorToggle: (enabled: boolean) => void;
  onTrailsToggle: (enabled: boolean) => void;
}

export class ControlPanel {
  private pane: Pane;
  private callbacks: ControlPanelCallbacks;
  
  /** Bound configuration objects */
  public simConfig: ISimulationConfig;
  public envConfig: IEnvironmentConfig;
  public renderConfig: IRenderingConfig;

  constructor(
    container: HTMLElement,
    simConfig: ISimulationConfig,
    envConfig: IEnvironmentConfig,
    renderConfig: IRenderingConfig,
    callbacks: ControlPanelCallbacks
  ) {
    this.simConfig = { ...simConfig };
    this.envConfig = { ...envConfig };
    this.renderConfig = { ...renderConfig };
    this.callbacks = callbacks;
    
    // Create Tweakpane instance
    this.pane = new Pane({
      container,
      title: 'Simulation Parameters'
    });
    
    this.setupSimulationControls();
    this.setupSwarmRules();
    this.setupEnvironment();
    this.setupRendering();
  }

  /**
   * Setup simulation control folder
   */
  private setupSimulationControls(): void {
    const folder = this.pane.addFolder({
      title: 'Simulation',
      expanded: true
    });
    
    // Bird count
    folder.addBinding(this.simConfig, 'birdCount', {
      label: 'Birds',
      min: 100,
      max: 5000,
      step: 100
    }).on('change', (ev) => {
      this.callbacks.onBirdCountChange(ev.value);
    });
    
    // Simulation speed
    folder.addBinding(this.simConfig, 'simulationSpeed', {
      label: 'Speed',
      min: 0.1,
      max: 2.0,
      step: 0.1
    });
    
    // Max speed
    folder.addBinding(this.simConfig, 'maxSpeed', {
      label: 'Max Speed',
      min: 5,
      max: 30,
      step: 1
    });
    
    // Max force
    folder.addBinding(this.simConfig, 'maxForce', {
      label: 'Max Force',
      min: 0.1,
      max: 2.0,
      step: 0.1
    });
    
    // Pause/Resume button
    const pauseBtn = folder.addButton({
      title: 'Pause'
    });
    pauseBtn.on('click', () => {
      this.simConfig.paused = !this.simConfig.paused;
      pauseBtn.title = this.simConfig.paused ? 'Resume' : 'Pause';
      if (this.simConfig.paused) {
        this.callbacks.onPause();
      } else {
        this.callbacks.onResume();
      }
    });
    
    // Reset button
    folder.addButton({
      title: 'Reset Simulation'
    }).on('click', () => {
      this.callbacks.onReset();
    });
  }

  /**
   * Setup swarm rules folder
   */
  private setupSwarmRules(): void {
    const folder = this.pane.addFolder({
      title: 'Swarm Rules',
      expanded: true
    });
    
    // Alignment weight
    folder.addBinding(this.simConfig, 'alignmentWeight', {
      label: 'Alignment',
      min: 0,
      max: 2,
      step: 0.1
    });
    
    // Cohesion weight
    folder.addBinding(this.simConfig, 'cohesionWeight', {
      label: 'Cohesion',
      min: 0,
      max: 2,
      step: 0.1
    });
    
    // Separation weight
    folder.addBinding(this.simConfig, 'separationWeight', {
      label: 'Separation',
      min: 0,
      max: 3,
      step: 0.1
    });
    
    // Perception radius
    folder.addBinding(this.simConfig, 'perceptionRadius', {
      label: 'Perception',
      min: 20,
      max: 150,
      step: 5
    }).on('change', (ev) => {
      this.callbacks.onPerceptionRadiusChange(ev.value);
    });
    
    // Separation radius
    folder.addBinding(this.simConfig, 'separationRadius', {
      label: 'Sep. Radius',
      min: 10,
      max: 50,
      step: 2
    });
    
    // Field of view
    folder.addBinding(this.simConfig, 'fieldOfView', {
      label: 'Field of View',
      min: 90,
      max: 360,
      step: 10
    });
  }

  /**
   * Setup environment folder
   */
  private setupEnvironment(): void {
    const folder = this.pane.addFolder({
      title: 'Environment',
      expanded: true
    });
    
    // Wind speed
    folder.addBinding(this.envConfig, 'windSpeed', {
      label: 'Wind Speed',
      min: 0,
      max: 10,
      step: 0.5
    });
    
    // Wind direction
    folder.addBinding(this.envConfig, 'windDirection', {
      label: 'Wind Dir',
      min: 0,
      max: 360,
      step: 5
    });
    
    // Wind turbulence
    folder.addBinding(this.envConfig, 'windTurbulence', {
      label: 'Turbulence',
      min: 0,
      max: 1,
      step: 0.1
    });
    
    // Predator separator
    folder.addBlade({
      view: 'separator'
    });
    
    // Predator enabled
    folder.addBinding(this.envConfig, 'predatorEnabled', {
      label: 'Predator'
    }).on('change', (ev) => {
      this.callbacks.onPredatorToggle(ev.value);
    });
    
    // Predator speed
    folder.addBinding(this.envConfig, 'predatorSpeed', {
      label: 'Pred. Speed',
      min: 10,
      max: 30,
      step: 1
    });
    
    // Predator aggression
    folder.addBinding(this.envConfig, 'predatorAggression', {
      label: 'Aggression',
      min: 0,
      max: 1,
      step: 0.1
    });
    
    // Panic radius
    folder.addBinding(this.envConfig, 'panicRadius', {
      label: 'Panic Radius',
      min: 50,
      max: 300,
      step: 10
    });
  }

  /**
   * Setup rendering folder
   */
  private setupRendering(): void {
    const folder = this.pane.addFolder({
      title: 'Rendering',
      expanded: false
    });
    
    // Show trails
    folder.addBinding(this.renderConfig, 'showTrails', {
      label: 'Show Trails'
    }).on('change', (ev) => {
      this.callbacks.onTrailsToggle(ev.value);
    });
    
    // Trail length
    folder.addBinding(this.renderConfig, 'trailLength', {
      label: 'Trail Length',
      min: 1,
      max: 15,
      step: 1
    });
    
    // Color by density
    folder.addBinding(this.renderConfig, 'colorByDensity', {
      label: 'Color by Density'
    });
    
    // Show wind particles
    folder.addBinding(this.renderConfig, 'showWindParticles', {
      label: 'Wind Particles'
    });
    
    // Show predator range
    folder.addBinding(this.renderConfig, 'showPredatorRange', {
      label: 'Predator Range'
    });
  }

  /**
   * Refresh pane (call after programmatic config changes)
   */
  refresh(): void {
    this.pane.refresh();
  }

  /**
   * Dispose of the pane
   */
  dispose(): void {
    this.pane.dispose();
  }
}

