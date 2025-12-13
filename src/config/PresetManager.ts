/**
 * Preset Manager - Save/Load custom presets to browser localStorage
 * Version: 1.0.0
 * 
 * Manages user-created presets stored in localStorage.
 * Presets include simulation, environment, and rendering configurations.
 */

import type {
  ISimulationConfig,
  IEnvironmentConfig,
  IRenderingConfig
} from '../types';

const STORAGE_KEY = 'swarm-simulator-presets';
const STORAGE_VERSION = 1;

/** Saved preset structure */
export interface ISavedPreset {
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  simulation: Partial<ISimulationConfig>;
  environment: Partial<IEnvironmentConfig>;
  rendering: Partial<IRenderingConfig>;
}

/** Storage format with version for migrations */
interface IPresetStorage {
  version: number;
  presets: Record<string, ISavedPreset>;
}

/**
 * Preset Manager - handles localStorage operations for custom presets
 */
export class PresetManager {
  private storage: IPresetStorage;

  constructor() {
    this.storage = this.loadFromStorage();
  }

  /**
   * Load presets from localStorage
   */
  private loadFromStorage(): IPresetStorage {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this.createEmptyStorage();
      }

      const parsed = JSON.parse(raw) as IPresetStorage;
      
      // Version migration (for future use)
      if (parsed.version !== STORAGE_VERSION) {
        console.log(`📦 Migrating presets from v${parsed.version} to v${STORAGE_VERSION}`);
        return this.migrateStorage(parsed);
      }

      return parsed;
    } catch (error) {
      console.warn('⚠️ Failed to load presets from localStorage:', error);
      return this.createEmptyStorage();
    }
  }

  /**
   * Create empty storage structure
   */
  private createEmptyStorage(): IPresetStorage {
    return {
      version: STORAGE_VERSION,
      presets: {}
    };
  }

  /**
   * Migrate storage from older versions
   */
  private migrateStorage(old: IPresetStorage): IPresetStorage {
    // For now, just return the old data with updated version
    // Future migrations can be added here
    return {
      ...old,
      version: STORAGE_VERSION
    };
  }

  /**
   * Save storage to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage));
    } catch (error) {
      console.error('❌ Failed to save presets to localStorage:', error);
      throw new Error('Failed to save preset. Storage may be full.');
    }
  }

  /**
   * Generate a safe key from preset name
   */
  private nameToKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }

  /**
   * Get all saved preset names
   */
  getPresetNames(): string[] {
    return Object.values(this.storage.presets).map(p => p.name);
  }

  /**
   * Get all saved presets
   */
  getAllPresets(): ISavedPreset[] {
    return Object.values(this.storage.presets).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Check if a preset exists
   */
  hasPreset(name: string): boolean {
    const key = this.nameToKey(name);
    return key in this.storage.presets;
  }

  /**
   * Get a preset by name
   */
  getPreset(name: string): ISavedPreset | null {
    const key = this.nameToKey(name);
    return this.storage.presets[key] || null;
  }

  /**
   * Save a new preset or update existing
   */
  savePreset(
    name: string,
    description: string,
    simConfig: ISimulationConfig,
    envConfig: IEnvironmentConfig,
    renderConfig: IRenderingConfig
  ): void {
    const key = this.nameToKey(name);
    const now = Date.now();

    const existing = this.storage.presets[key];

    this.storage.presets[key] = {
      name,
      description,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      simulation: {
        particleSize: simConfig.particleSize,
        maxSpeed: simConfig.maxSpeed,
        maxForce: simConfig.maxForce,
        perceptionRadius: simConfig.perceptionRadius,
        separationRadius: simConfig.separationRadius,
        alignmentWeight: simConfig.alignmentWeight,
        cohesionWeight: simConfig.cohesionWeight,
        separationWeight: simConfig.separationWeight,
        fieldOfView: simConfig.fieldOfView,
        boundaryMargin: simConfig.boundaryMargin,
        boundaryForce: simConfig.boundaryForce,
        wrapEdges: simConfig.wrapEdges,
        noiseStrength: simConfig.noiseStrength,
        wanderStrength: simConfig.wanderStrength
      },
      environment: {
        windSpeed: envConfig.windSpeed,
        windDirection: envConfig.windDirection,
        windTurbulence: envConfig.windTurbulence,
        predatorEnabled: envConfig.predatorEnabled,
        predatorSpeed: envConfig.predatorSpeed,
        predatorAggression: envConfig.predatorAggression,
        panicRadius: envConfig.panicRadius,
        panicDecay: envConfig.panicDecay,
        foodEnabled: envConfig.foodEnabled,
        foodCount: envConfig.foodCount,
        foodAttractionStrength: envConfig.foodAttractionStrength,
        foodAttractionRadius: envConfig.foodAttractionRadius,
        foodRespawnTime: envConfig.foodRespawnTime,
        huntingEnabled: envConfig.huntingEnabled,
        huntingSpeed: envConfig.huntingSpeed,
        huntingRadius: envConfig.huntingRadius
      },
      rendering: {
        showTrails: renderConfig.showTrails,
        trailLength: renderConfig.trailLength,
        showWindParticles: renderConfig.showWindParticles,
        showPredatorRange: renderConfig.showPredatorRange,
        showFoodSources: renderConfig.showFoodSources,
        colorByDensity: renderConfig.colorByDensity,
        colorBySpeed: renderConfig.colorBySpeed,
        particleShape: renderConfig.particleShape,
        baseColor: renderConfig.baseColor,
        denseColor: renderConfig.denseColor,
        panicColor: renderConfig.panicColor,
        glowEnabled: renderConfig.glowEnabled,
        glowIntensity: renderConfig.glowIntensity,
        motionBlur: renderConfig.motionBlur
      }
    };

    this.saveToStorage();
    console.log(`💾 Preset "${name}" saved`);
  }

  /**
   * Delete a preset
   */
  deletePreset(name: string): boolean {
    const key = this.nameToKey(name);
    if (!(key in this.storage.presets)) {
      return false;
    }

    delete this.storage.presets[key];
    this.saveToStorage();
    console.log(`🗑️ Preset "${name}" deleted`);
    return true;
  }

  /**
   * Apply a preset to configs
   */
  applyPreset(
    preset: ISavedPreset,
    simConfig: ISimulationConfig,
    envConfig: IEnvironmentConfig,
    renderConfig: IRenderingConfig
  ): void {
    // Apply simulation config
    Object.assign(simConfig, preset.simulation);
    simConfig.creaturePreset = 'custom'; // Mark as custom since it's user-defined

    // Apply environment config
    Object.assign(envConfig, preset.environment);

    // Apply rendering config
    Object.assign(renderConfig, preset.rendering);

    console.log(`📂 Preset "${preset.name}" applied`);
  }

  /**
   * Export all presets as JSON string (for backup)
   */
  exportPresets(): string {
    return JSON.stringify(this.storage.presets, null, 2);
  }

  /**
   * Import presets from JSON string
   */
  importPresets(json: string, overwrite: boolean = false): number {
    try {
      const imported = JSON.parse(json) as Record<string, ISavedPreset>;
      let count = 0;

      for (const [key, preset] of Object.entries(imported)) {
        if (!overwrite && key in this.storage.presets) {
          continue; // Skip existing
        }
        this.storage.presets[key] = preset;
        count++;
      }

      this.saveToStorage();
      console.log(`📥 Imported ${count} presets`);
      return count;
    } catch (error) {
      console.error('❌ Failed to import presets:', error);
      throw new Error('Invalid preset JSON format');
    }
  }

  /**
   * Clear all saved presets
   */
  clearAll(): void {
    this.storage = this.createEmptyStorage();
    this.saveToStorage();
    console.log('🗑️ All presets cleared');
  }

  /**
   * Get storage size in bytes (approximate)
   */
  getStorageSize(): number {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? raw.length * 2 : 0; // UTF-16 = 2 bytes per char
  }

  /**
   * Get preset count
   */
  getPresetCount(): number {
    return Object.keys(this.storage.presets).length;
  }
}

/** Global preset manager instance */
let presetManagerInstance: PresetManager | null = null;

/**
 * Get the global preset manager instance
 */
export function getPresetManager(): PresetManager {
  if (!presetManagerInstance) {
    presetManagerInstance = new PresetManager();
  }
  return presetManagerInstance;
}

