/**
 * Day/Night Cycle - Time-based behavior and visual modifications
 * Version: 1.0.0
 * 
 * Simulates a day/night cycle that affects creature behavior and visuals.
 * Features:
 * - Configurable cycle duration
 * - Dawn/day/dusk/night phases
 * - Species-specific behavior modifiers
 * - Background color transitions
 * - Glow intensity modulation
 */

/** Time of day phase */
export type TimePhase = 'night' | 'dawn' | 'day' | 'dusk';

/** Day/night cycle configuration */
export interface IDayNightConfig {
  enabled: boolean;
  cycleDuration: number;     // Seconds per full day cycle
  startTime: number;         // Initial time of day (0-1, 0=midnight)
  paused: boolean;
  
  // Phase durations (as fraction of day, should sum to 1)
  nightDuration: number;     // e.g., 0.35 = 35% of day is night
  dawnDuration: number;      // e.g., 0.1 = 10% is dawn
  dayDuration: number;       // e.g., 0.4 = 40% is day
  duskDuration: number;      // e.g., 0.15 = 15% is dusk
  
  // Visual settings
  dayBackgroundColor: number;
  nightBackgroundColor: number;
  showStars: boolean;
}

/** Species behavior modifier for time of day */
export interface ITimeBehaviorModifier {
  speedMultiplier: number;   // 1.0 = normal, 0.5 = half speed
  activityLevel: number;     // 0 = inactive, 1 = fully active
  glowMultiplier: number;    // For creatures with glow (fireflies, etc.)
  cohesionModifier: number;  // Birds roost tighter at night
}

/** Default behavior modifiers by phase */
const DEFAULT_MODIFIERS: Record<TimePhase, ITimeBehaviorModifier> = {
  night: {
    speedMultiplier: 0.5,
    activityLevel: 0.3,
    glowMultiplier: 1.5,
    cohesionModifier: 1.5
  },
  dawn: {
    speedMultiplier: 0.8,
    activityLevel: 0.7,
    glowMultiplier: 0.8,
    cohesionModifier: 1.2
  },
  day: {
    speedMultiplier: 1.0,
    activityLevel: 1.0,
    glowMultiplier: 0.2,
    cohesionModifier: 1.0
  },
  dusk: {
    speedMultiplier: 0.9,
    activityLevel: 0.8,
    glowMultiplier: 1.0,
    cohesionModifier: 1.3
  }
};

/** Nocturnal species get inverted modifiers */
const NOCTURNAL_SPECIES = ['bats', 'fireflies'];

/** Species that glow at night */
const BIOLUMINESCENT_SPECIES = ['fireflies', 'plankton', 'jellyfish'];

export class DayNightCycle {
  /** Current time of day (0-1, where 0 = midnight, 0.5 = noon) */
  private timeOfDay: number = 0.25; // Start at dawn by default
  
  /** Configuration */
  private config: IDayNightConfig = {
    enabled: false,
    cycleDuration: 120,      // 2 minutes per day
    startTime: 0.25,
    paused: false,
    nightDuration: 0.35,
    dawnDuration: 0.1,
    dayDuration: 0.4,
    duskDuration: 0.15,
    dayBackgroundColor: 0x87CEEB,    // Sky blue
    nightBackgroundColor: 0x0a0a1f,  // Dark blue
    showStars: true
  };
  
  /** Custom modifiers per species (optional overrides) */
  private speciesModifiers: Map<string, Record<TimePhase, Partial<ITimeBehaviorModifier>>> = new Map();
  
  /** Cached phase boundaries (recalculated when config changes) */
  private phaseBoundaries: { phase: TimePhase; start: number; end: number }[] = [];

  constructor(config?: Partial<IDayNightConfig>) {
    if (config) {
      this.setConfig(config);
    }
    this.calculatePhaseBoundaries();
    this.timeOfDay = this.config.startTime;
  }

  /**
   * Calculate phase boundaries based on durations
   */
  private calculatePhaseBoundaries(): void {
    this.phaseBoundaries = [];
    
    let current = 0;
    
    // Night starts at midnight (0)
    this.phaseBoundaries.push({
      phase: 'night',
      start: current,
      end: current + this.config.nightDuration / 2
    });
    current += this.config.nightDuration / 2;
    
    // Dawn
    this.phaseBoundaries.push({
      phase: 'dawn',
      start: current,
      end: current + this.config.dawnDuration
    });
    current += this.config.dawnDuration;
    
    // Day
    this.phaseBoundaries.push({
      phase: 'day',
      start: current,
      end: current + this.config.dayDuration
    });
    current += this.config.dayDuration;
    
    // Dusk
    this.phaseBoundaries.push({
      phase: 'dusk',
      start: current,
      end: current + this.config.duskDuration
    });
    current += this.config.duskDuration;
    
    // Night (second half)
    this.phaseBoundaries.push({
      phase: 'night',
      start: current,
      end: 1.0
    });
  }

  /**
   * Update the cycle
   */
  update(deltaTime: number): void {
    if (!this.config.enabled || this.config.paused) return;
    
    // Advance time
    const timeStep = deltaTime / this.config.cycleDuration;
    this.timeOfDay = (this.timeOfDay + timeStep) % 1;
  }

  /**
   * Get current time of day (0-1)
   */
  getTime(): number {
    return this.timeOfDay;
  }

  /**
   * Set time of day directly (0-1)
   */
  setTime(time: number): void {
    this.timeOfDay = Math.max(0, Math.min(1, time));
  }

  /**
   * Get current phase
   */
  getPhase(): TimePhase {
    for (const boundary of this.phaseBoundaries) {
      if (this.timeOfDay >= boundary.start && this.timeOfDay < boundary.end) {
        return boundary.phase;
      }
    }
    return 'day'; // Fallback
  }

  /**
   * Get progress within current phase (0-1)
   */
  getPhaseProgress(): number {
    for (const boundary of this.phaseBoundaries) {
      if (this.timeOfDay >= boundary.start && this.timeOfDay < boundary.end) {
        return (this.timeOfDay - boundary.start) / (boundary.end - boundary.start);
      }
    }
    return 0;
  }

  /**
   * Check if it's currently daytime (day or dawn)
   */
  isDaytime(): boolean {
    const phase = this.getPhase();
    return phase === 'day' || phase === 'dawn';
  }

  /**
   * Check if it's currently nighttime (night or dusk)
   */
  isNighttime(): boolean {
    const phase = this.getPhase();
    return phase === 'night' || phase === 'dusk';
  }

  /**
   * Get night factor (0 = full day, 1 = full night)
   * Smoothly transitions during dawn/dusk
   */
  getNightFactor(): number {
    const phase = this.getPhase();
    const progress = this.getPhaseProgress();
    
    switch (phase) {
      case 'night':
        return 1;
      case 'dawn':
        return 1 - progress; // Fades from night to day
      case 'day':
        return 0;
      case 'dusk':
        return progress; // Fades from day to night
      default:
        return 0;
    }
  }

  /**
   * Get ambient light level (0-1, where 1 is brightest)
   */
  getAmbientLight(): number {
    return 1 - this.getNightFactor() * 0.7; // Night is 30% of day brightness
  }

  /**
   * Get current background color (interpolated)
   */
  getBackgroundColor(): number {
    const nightFactor = this.getNightFactor();
    return this.lerpColor(
      this.config.dayBackgroundColor,
      this.config.nightBackgroundColor,
      nightFactor
    );
  }

  /**
   * Linear interpolation between two colors
   */
  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;
    
    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Get behavior modifier for a species at current time
   */
  getBehaviorModifier(speciesId: string): ITimeBehaviorModifier {
    const phase = this.getPhase();
    const baseModifier = { ...DEFAULT_MODIFIERS[phase] };
    
    // Check for nocturnal species - invert day/night behavior
    const isNocturnal = NOCTURNAL_SPECIES.includes(speciesId);
    if (isNocturnal) {
      // Swap day and night modifiers
      if (phase === 'night') {
        Object.assign(baseModifier, DEFAULT_MODIFIERS.day);
      } else if (phase === 'day') {
        Object.assign(baseModifier, DEFAULT_MODIFIERS.night);
      }
    }
    
    // Apply bioluminescence
    const isBioluminescent = BIOLUMINESCENT_SPECIES.includes(speciesId);
    if (isBioluminescent) {
      baseModifier.glowMultiplier = this.getNightFactor() * 2;
    }
    
    // Apply any custom species overrides
    const customModifiers = this.speciesModifiers.get(speciesId);
    if (customModifiers && customModifiers[phase]) {
      Object.assign(baseModifier, customModifiers[phase]);
    }
    
    return baseModifier;
  }

  /**
   * Set custom behavior modifier for a species
   */
  setSpeciesModifier(
    speciesId: string,
    phase: TimePhase,
    modifier: Partial<ITimeBehaviorModifier>
  ): void {
    if (!this.speciesModifiers.has(speciesId)) {
      this.speciesModifiers.set(speciesId, {} as Record<TimePhase, Partial<ITimeBehaviorModifier>>);
    }
    this.speciesModifiers.get(speciesId)![phase] = modifier;
  }

  /**
   * Get a human-readable time string (e.g., "6:00 AM")
   */
  getTimeString(): string {
    // Convert 0-1 to 24-hour time
    const hours24 = Math.floor(this.timeOfDay * 24);
    const minutes = Math.floor((this.timeOfDay * 24 * 60) % 60);
    
    const hours12 = hours24 % 12 || 12;
    const ampm = hours24 < 12 ? 'AM' : 'PM';
    
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  /**
   * Get phase name as string
   */
  getPhaseName(): string {
    return this.getPhase().charAt(0).toUpperCase() + this.getPhase().slice(1);
  }

  /**
   * Check if stars should be visible
   */
  shouldShowStars(): boolean {
    return this.config.showStars && this.getNightFactor() > 0.5;
  }

  /**
   * Get star visibility (for fading in/out)
   */
  getStarVisibility(): number {
    const nightFactor = this.getNightFactor();
    return Math.max(0, (nightFactor - 0.3) / 0.7); // Fade in after 30% night
  }

  /**
   * Get configuration
   */
  getConfig(): IDayNightConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<IDayNightConfig>): void {
    Object.assign(this.config, config);
    this.calculatePhaseBoundaries();
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable/disable
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Pause/unpause
   */
  setPaused(paused: boolean): void {
    this.config.paused = paused;
  }

  /**
   * Set cycle speed (duration in seconds)
   */
  setCycleDuration(seconds: number): void {
    this.config.cycleDuration = Math.max(10, seconds);
  }

  /**
   * Reset to start time
   */
  reset(): void {
    this.timeOfDay = this.config.startTime;
  }

  /**
   * Skip to a specific phase
   */
  skipToPhase(phase: TimePhase): void {
    for (const boundary of this.phaseBoundaries) {
      if (boundary.phase === phase) {
        this.timeOfDay = boundary.start;
        return;
      }
    }
  }
}


