/**
 * Control Panel - Tweakpane integration for real-time parameter adjustment
 * Version: 1.3.0 - Added custom preset save/load from localStorage
 * 
 * Provides organized controls for all simulation parameters:
 * - Creature presets (starlings, insects, fish, bats, fireflies)
 * - Custom preset save/load (localStorage)
 * - Simulation controls (count, speed, pause/reset)
 * - Swarm rule weights
 * - Environmental settings (wind, predator, food)
 * - Visual customization (size, colors, effects)
 */

import { Pane, FolderApi } from 'tweakpane';
import type {
  ISimulationConfig,
  IEnvironmentConfig,
  IRenderingConfig,
  CreaturePreset,
  ICreaturePreset
} from '../types';
import { getConfig } from '../config/ConfigLoader';
import { getPresetManager } from '../config/PresetManager';

export interface ControlPanelCallbacks {
  onBirdCountChange: (count: number) => void;
  onPerceptionRadiusChange: (radius: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onPredatorToggle: (enabled: boolean) => void;
  onTrailsToggle: (enabled: boolean) => void;
  onPresetChange: (preset: CreaturePreset) => void;
  onFoodToggle: (enabled: boolean) => void;
  onColorChange: () => void;
}

export class ControlPanel {
  private pane: Pane;
  private callbacks: ControlPanelCallbacks;
  
  /** Bound configuration objects */
  public simConfig: ISimulationConfig;
  public envConfig: IEnvironmentConfig;
  public renderConfig: IRenderingConfig;
  
  /** Creature presets from loaded config */
  private creaturePresets: Record<CreaturePreset, ICreaturePreset>;
  
  /** Preset selector state */
  private presetState = { preset: 'starlings' as CreaturePreset };
  
  /** Custom preset state */
  private customPresetState = {
    selectedPreset: '',
    newPresetName: '',
    newPresetDesc: ''
  };
  
  /** Custom presets folder reference for refresh */
  private customPresetsFolder: FolderApi | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private savedPresetBinding: any = null;

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
    
    // Get creature presets from loaded config
    this.creaturePresets = getConfig().creaturePresets;
    
    // Create Tweakpane instance
    this.pane = new Pane({
      container,
      title: 'Simulation Parameters'
    });
    
    this.setupPresets();
    this.setupCustomPresets();
    this.setupSimulationControls();
    this.setupSwarmRules();
    this.setupEnvironment();
    this.setupFood();
    this.setupVisuals();
    this.setupRendering();
  }

  /**
   * Setup creature presets
   */
  private setupPresets(): void {
    const folder = this.pane.addFolder({
      title: 'Creature Preset',
      expanded: true
    });
    
    // Preset dropdown
    folder.addBinding(this.presetState, 'preset', {
      label: 'Type',
      options: {
        'Starlings': 'starlings',
        'Insects': 'insects',
        'Fish School': 'fish',
        'Bats': 'bats',
        'Fireflies': 'fireflies',
        'Custom': 'custom'
      }
    }).on('change', (ev) => {
      this.applyPreset(ev.value as CreaturePreset);
      this.callbacks.onPresetChange(ev.value as CreaturePreset);
    });
    
    // Description text
    const presetInfo = this.creaturePresets[this.presetState.preset];
    folder.addBlade({
      view: 'text',
      label: 'Info',
      parse: (v: string) => v,
      value: presetInfo.description
    });
  }

  /**
   * Apply a creature preset
   */
  private applyPreset(preset: CreaturePreset): void {
    const presetConfig = this.creaturePresets[preset];
    
    // Apply to simulation config
    this.simConfig.creaturePreset = preset;
    this.simConfig.particleSize = presetConfig.particleSize;
    this.simConfig.maxSpeed = presetConfig.maxSpeed;
    this.simConfig.maxForce = presetConfig.maxForce;
    this.simConfig.perceptionRadius = presetConfig.perceptionRadius;
    this.simConfig.separationRadius = presetConfig.separationRadius;
    this.simConfig.alignmentWeight = presetConfig.alignmentWeight;
    this.simConfig.cohesionWeight = presetConfig.cohesionWeight;
    this.simConfig.separationWeight = presetConfig.separationWeight;
    this.simConfig.fieldOfView = presetConfig.fieldOfView;
    
    // Apply to render config
    this.renderConfig.baseColor = presetConfig.baseColor;
    this.renderConfig.denseColor = presetConfig.denseColor;
    this.renderConfig.panicColor = presetConfig.panicColor;
    this.renderConfig.glowEnabled = presetConfig.glowEnabled;
    this.renderConfig.glowIntensity = presetConfig.glowIntensity;
    
    // Refresh UI
    this.pane.refresh();
    this.callbacks.onColorChange();
    this.callbacks.onPerceptionRadiusChange(presetConfig.perceptionRadius);
  }

  /**
   * Setup custom presets (save/load from localStorage)
   */
  private setupCustomPresets(): void {
    const folder = this.pane.addFolder({
      title: '💾 Custom Presets',
      expanded: false
    });
    this.customPresetsFolder = folder;

    const presetManager = getPresetManager();

    // Build saved presets dropdown options
    const buildPresetOptions = (): Record<string, string> => {
      const options: Record<string, string> = { '-- Select --': '' };
      for (const preset of presetManager.getAllPresets()) {
        options[preset.name] = preset.name;
      }
      return options;
    };

    // Saved presets dropdown
    this.savedPresetBinding = folder.addBinding(this.customPresetState, 'selectedPreset', {
      label: 'Saved',
      options: buildPresetOptions()
    });

    // Load button
    folder.addButton({
      title: '📂 Load Selected'
    }).on('click', () => {
      const name = this.customPresetState.selectedPreset;
      if (!name) {
        this.showNotification('Select a preset first', 'warning');
        return;
      }

      const preset = presetManager.getPreset(name);
      if (!preset) {
        this.showNotification(`Preset "${name}" not found`, 'error');
        return;
      }

      // Apply preset
      presetManager.applyPreset(preset, this.simConfig, this.envConfig, this.renderConfig);
      
      // Update UI and notify callbacks
      this.pane.refresh();
      this.callbacks.onColorChange();
      this.callbacks.onPerceptionRadiusChange(this.simConfig.perceptionRadius);
      this.callbacks.onPresetChange('custom');
      
      this.showNotification(`Loaded "${name}"`, 'success');
    });

    // Delete button
    folder.addButton({
      title: '🗑️ Delete Selected'
    }).on('click', () => {
      const name = this.customPresetState.selectedPreset;
      if (!name) {
        this.showNotification('Select a preset first', 'warning');
        return;
      }

      if (confirm(`Delete preset "${name}"?`)) {
        presetManager.deletePreset(name);
        this.customPresetState.selectedPreset = '';
        this.refreshPresetDropdown();
        this.showNotification(`Deleted "${name}"`, 'success');
      }
    });

    // Separator
    folder.addBlade({ view: 'separator' });

    // New preset name input
    folder.addBinding(this.customPresetState, 'newPresetName', {
      label: 'Name'
    });

    // New preset description input
    folder.addBinding(this.customPresetState, 'newPresetDesc', {
      label: 'Description'
    });

    // Save button
    folder.addButton({
      title: '💾 Save Current as New Preset'
    }).on('click', () => {
      const name = this.customPresetState.newPresetName.trim();
      if (!name) {
        this.showNotification('Enter a preset name', 'warning');
        return;
      }

      const desc = this.customPresetState.newPresetDesc.trim() || 'Custom preset';

      // Check if exists
      if (presetManager.hasPreset(name)) {
        if (!confirm(`Preset "${name}" exists. Overwrite?`)) {
          return;
        }
      }

      // Save preset
      presetManager.savePreset(name, desc, this.simConfig, this.envConfig, this.renderConfig);
      
      // Clear inputs
      this.customPresetState.newPresetName = '';
      this.customPresetState.newPresetDesc = '';
      this.customPresetState.selectedPreset = name;
      
      // Refresh dropdown
      this.refreshPresetDropdown();
      this.pane.refresh();
      
      this.showNotification(`Saved "${name}"`, 'success');
    });

    // Separator
    folder.addBlade({ view: 'separator' });

    // Export button
    folder.addButton({
      title: '📤 Export All Presets'
    }).on('click', () => {
      const json = presetManager.exportPresets();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'swarm-presets.json';
      a.click();
      
      URL.revokeObjectURL(url);
      this.showNotification('Presets exported', 'success');
    });

    // Import button
    folder.addButton({
      title: '📥 Import Presets'
    }).on('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const count = presetManager.importPresets(text, false);
          this.refreshPresetDropdown();
          this.showNotification(`Imported ${count} presets`, 'success');
        } catch (error) {
          this.showNotification('Import failed: invalid file', 'error');
        }
      };

      input.click();
    });

    // Stats
    const count = presetManager.getPresetCount();
    const size = (presetManager.getStorageSize() / 1024).toFixed(1);
    folder.addBlade({
      view: 'text',
      label: 'Storage',
      parse: (v: string) => v,
      value: `${count} presets (${size} KB)`
    });
  }

  /**
   * Refresh the saved presets dropdown
   */
  private refreshPresetDropdown(): void {
    if (!this.customPresetsFolder || !this.savedPresetBinding) return;

    const presetManager = getPresetManager();
    
    // Remove old binding
    this.savedPresetBinding.dispose();
    
    // Build new options
    const options: Record<string, string> = { '-- Select --': '' };
    for (const preset of presetManager.getAllPresets()) {
      options[preset.name] = preset.name;
    }

    // Add new binding at the start of the folder (index 0)
    this.savedPresetBinding = this.customPresetsFolder.addBinding(this.customPresetState, 'selectedPreset', {
      label: 'Saved',
      options,
      index: 0
    });
  }

  /**
   * Show a notification message
   */
  private showNotification(message: string, type: 'success' | 'warning' | 'error'): void {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `preset-notification preset-notification-${type}`;
    notification.textContent = message;
    
    // Style it
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      animation: 'slideIn 0.3s ease-out',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    });

    // Type-specific colors
    const colors = {
      success: { bg: '#10b981', text: '#ffffff' },
      warning: { bg: '#f59e0b', text: '#000000' },
      error: { bg: '#ef4444', text: '#ffffff' }
    };
    notification.style.backgroundColor = colors[type].bg;
    notification.style.color = colors[type].text;

    document.body.appendChild(notification);

    // Remove after delay
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }

  /**
   * Setup simulation control folder
   */
  private setupSimulationControls(): void {
    const folder = this.pane.addFolder({
      title: 'Simulation',
      expanded: true
    });
    
    // Creature count
    folder.addBinding(this.simConfig, 'birdCount', {
      label: 'Count',
      min: 100,
      max: 5000,
      step: 100
    }).on('change', (ev) => {
      this.callbacks.onBirdCountChange(ev.value);
    });
    
    // Particle size
    folder.addBinding(this.simConfig, 'particleSize', {
      label: 'Size',
      min: 0.2,
      max: 2.5,
      step: 0.1
    });
    
    // Simulation speed
    folder.addBinding(this.simConfig, 'simulationSpeed', {
      label: 'Speed',
      min: 0.1,
      max: 3.0,
      step: 0.1
    });
    
    // Max speed
    folder.addBinding(this.simConfig, 'maxSpeed', {
      label: 'Max Velocity',
      min: 3,
      max: 40,
      step: 1
    });
    
    // Max force
    folder.addBinding(this.simConfig, 'maxForce', {
      label: 'Agility',
      min: 0.1,
      max: 2.0,
      step: 0.1
    });
    
    // Noise strength
    folder.addBinding(this.simConfig, 'noiseStrength', {
      label: 'Randomness',
      min: 0,
      max: 0.3,
      step: 0.01
    });
    
    // Wander strength
    folder.addBinding(this.simConfig, 'wanderStrength', {
      label: 'Wander',
      min: 0,
      max: 0.5,
      step: 0.05
    });
    
    // Wrap edges toggle
    folder.addBinding(this.simConfig, 'wrapEdges', {
      label: 'Wrap Edges'
    });
    
    // Buttons
    folder.addBlade({ view: 'separator' });
    
    // Pause/Resume button
    const pauseBtn = folder.addButton({ title: 'Pause' });
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
    folder.addButton({ title: 'Reset' }).on('click', () => {
      this.callbacks.onReset();
    });
  }

  /**
   * Setup swarm rules folder
   */
  private setupSwarmRules(): void {
    const folder = this.pane.addFolder({
      title: 'Swarm Behavior',
      expanded: false
    });
    
    // Alignment weight
    folder.addBinding(this.simConfig, 'alignmentWeight', {
      label: 'Alignment',
      min: 0,
      max: 3,
      step: 0.1
    });
    
    // Cohesion weight
    folder.addBinding(this.simConfig, 'cohesionWeight', {
      label: 'Cohesion',
      min: 0,
      max: 3,
      step: 0.1
    });
    
    // Separation weight
    folder.addBinding(this.simConfig, 'separationWeight', {
      label: 'Separation',
      min: 0,
      max: 4,
      step: 0.1
    });
    
    folder.addBlade({ view: 'separator' });
    
    // Perception radius
    folder.addBinding(this.simConfig, 'perceptionRadius', {
      label: 'Vision Range',
      min: 15,
      max: 200,
      step: 5
    }).on('change', (ev) => {
      this.callbacks.onPerceptionRadiusChange(ev.value);
    });
    
    // Separation radius
    folder.addBinding(this.simConfig, 'separationRadius', {
      label: 'Personal Space',
      min: 5,
      max: 80,
      step: 2
    });
    
    // Field of view
    folder.addBinding(this.simConfig, 'fieldOfView', {
      label: 'Field of View',
      min: 60,
      max: 360,
      step: 10
    });
    
    folder.addBlade({ view: 'separator' });
    
    // Boundary settings
    folder.addBinding(this.simConfig, 'boundaryMargin', {
      label: 'Edge Margin',
      min: 50,
      max: 300,
      step: 10
    });
    
    folder.addBinding(this.simConfig, 'boundaryForce', {
      label: 'Edge Force',
      min: 0.1,
      max: 2.0,
      step: 0.1
    });
  }

  /**
   * Setup environment folder
   */
  private setupEnvironment(): void {
    const folder = this.pane.addFolder({
      title: 'Environment',
      expanded: false
    });
    
    // Wind section
    const windFolder = folder.addFolder({ title: 'Wind', expanded: true });
    
    windFolder.addBinding(this.envConfig, 'windSpeed', {
      label: 'Speed',
      min: 0,
      max: 15,
      step: 0.5
    });
    
    windFolder.addBinding(this.envConfig, 'windDirection', {
      label: 'Direction',
      min: 0,
      max: 360,
      step: 5
    });
    
    windFolder.addBinding(this.envConfig, 'windTurbulence', {
      label: 'Turbulence',
      min: 0,
      max: 1,
      step: 0.1
    });
    
    // Predator section
    const predatorFolder = folder.addFolder({ title: 'Predator', expanded: true });
    
    predatorFolder.addBinding(this.envConfig, 'predatorEnabled', {
      label: 'Active'
    }).on('change', (ev) => {
      this.callbacks.onPredatorToggle(ev.value);
    });
    
    predatorFolder.addBinding(this.envConfig, 'predatorSpeed', {
      label: 'Speed',
      min: 8,
      max: 35,
      step: 1
    });
    
    predatorFolder.addBinding(this.envConfig, 'predatorAggression', {
      label: 'Aggression',
      min: 0,
      max: 1,
      step: 0.1
    });
    
    predatorFolder.addBinding(this.envConfig, 'panicRadius', {
      label: 'Panic Range',
      min: 50,
      max: 400,
      step: 10
    });
    
    predatorFolder.addBinding(this.envConfig, 'panicDecay', {
      label: 'Panic Spread',
      min: 0.5,
      max: 1.0,
      step: 0.05
    });
  }

  /**
   * Setup food/hunting folder
   */
  private setupFood(): void {
    const folder = this.pane.addFolder({
      title: 'Food & Hunting',
      expanded: false
    });
    
    // Food section
    const foodFolder = folder.addFolder({ title: 'Food Sources', expanded: true });
    
    foodFolder.addBinding(this.envConfig, 'foodEnabled', {
      label: 'Active'
    }).on('change', (ev) => {
      this.callbacks.onFoodToggle(ev.value);
    });
    
    foodFolder.addBinding(this.envConfig, 'foodCount', {
      label: 'Count',
      min: 1,
      max: 20,
      step: 1
    });
    
    foodFolder.addBinding(this.envConfig, 'foodAttractionStrength', {
      label: 'Attraction',
      min: 0.1,
      max: 3.0,
      step: 0.1
    });
    
    foodFolder.addBinding(this.envConfig, 'foodAttractionRadius', {
      label: 'Range',
      min: 50,
      max: 500,
      step: 25
    });
    
    foodFolder.addBinding(this.envConfig, 'foodRespawnTime', {
      label: 'Respawn (s)',
      min: 1,
      max: 30,
      step: 1
    });
    
    // Hunting section (creatures hunting each other)
    const huntingFolder = folder.addFolder({ title: 'Hunting Behavior', expanded: false });
    
    huntingFolder.addBinding(this.envConfig, 'huntingEnabled', {
      label: 'Active'
    });
    
    huntingFolder.addBinding(this.envConfig, 'huntingSpeed', {
      label: 'Chase Speed',
      min: 5,
      max: 25,
      step: 1
    });
    
    huntingFolder.addBinding(this.envConfig, 'huntingRadius', {
      label: 'Detection',
      min: 30,
      max: 200,
      step: 10
    });
  }

  /**
   * Setup visual customization folder
   */
  private setupVisuals(): void {
    const folder = this.pane.addFolder({
      title: 'Visual Style',
      expanded: false
    });
    
    // Particle shape
    folder.addBinding(this.renderConfig, 'particleShape', {
      label: 'Shape',
      options: {
        'Arrow': 'arrow',
        'Circle': 'circle',
        'Triangle': 'triangle',
        'Dot': 'dot'
      }
    });
    
    folder.addBlade({ view: 'separator' });
    
    // Colors (as hex strings for Tweakpane)
    const colorState = {
      baseColor: '#' + this.renderConfig.baseColor.toString(16).padStart(6, '0'),
      denseColor: '#' + this.renderConfig.denseColor.toString(16).padStart(6, '0'),
      panicColor: '#' + this.renderConfig.panicColor.toString(16).padStart(6, '0')
    };
    
    folder.addBinding(colorState, 'baseColor', {
      label: 'Base Color'
    }).on('change', (ev) => {
      this.renderConfig.baseColor = parseInt(ev.value.slice(1), 16);
      this.callbacks.onColorChange();
    });
    
    folder.addBinding(colorState, 'denseColor', {
      label: 'Dense Color'
    }).on('change', (ev) => {
      this.renderConfig.denseColor = parseInt(ev.value.slice(1), 16);
      this.callbacks.onColorChange();
    });
    
    folder.addBinding(colorState, 'panicColor', {
      label: 'Panic Color'
    }).on('change', (ev) => {
      this.renderConfig.panicColor = parseInt(ev.value.slice(1), 16);
      this.callbacks.onColorChange();
    });
    
    folder.addBlade({ view: 'separator' });
    
    // Coloring modes
    folder.addBinding(this.renderConfig, 'colorByDensity', {
      label: 'Color by Density'
    });
    
    folder.addBinding(this.renderConfig, 'colorBySpeed', {
      label: 'Color by Speed'
    });
    
    folder.addBlade({ view: 'separator' });
    
    // Glow effect
    folder.addBinding(this.renderConfig, 'glowEnabled', {
      label: 'Glow Effect'
    });
    
    folder.addBinding(this.renderConfig, 'glowIntensity', {
      label: 'Glow Intensity',
      min: 0,
      max: 1,
      step: 0.1
    });
  }

  /**
   * Setup rendering folder
   */
  private setupRendering(): void {
    const folder = this.pane.addFolder({
      title: 'Effects',
      expanded: false
    });
    
    // Show trails
    folder.addBinding(this.renderConfig, 'showTrails', {
      label: 'Motion Trails'
    }).on('change', (ev) => {
      this.callbacks.onTrailsToggle(ev.value);
    });
    
    // Trail length
    folder.addBinding(this.renderConfig, 'trailLength', {
      label: 'Trail Length',
      min: 1,
      max: 20,
      step: 1
    });
    
    // Motion blur
    folder.addBinding(this.renderConfig, 'motionBlur', {
      label: 'Motion Blur'
    });
    
    folder.addBlade({ view: 'separator' });
    
    // Show wind particles
    folder.addBinding(this.renderConfig, 'showWindParticles', {
      label: 'Wind Particles'
    });
    
    // Show predator range
    folder.addBinding(this.renderConfig, 'showPredatorRange', {
      label: 'Predator Range'
    });
    
    // Show food sources
    folder.addBinding(this.renderConfig, 'showFoodSources', {
      label: 'Food Sources'
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
