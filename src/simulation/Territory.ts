/**
 * Territory System - Territorial zones for creatures
 * Version: 1.0.0
 * 
 * Manages territorial zones where creatures prefer to stay.
 * Features:
 * - Species-specific territories
 * - Home-pull behavior (creatures return to their territory)
 * - Territory boundaries that repel non-owners
 * - Visual representation support
 */

import { Vector2 } from '../utils/Vector2';

/** Territory definition */
export interface ITerritory {
  id: number;
  center: Vector2;
  radius: number;
  ownerSpecies: string;
  strength: number;      // How strongly creatures are pulled back (0-1)
  repelOthers: boolean;  // Whether to repel non-owner species
  repelStrength: number; // How strongly non-owners are repelled
  color: number;         // Visual color for the territory
}

/** Territory configuration */
export interface ITerritoryConfig {
  enabled: boolean;
  showTerritories: boolean;
  defaultRadius: number;
  defaultStrength: number;
  boundaryFalloff: number; // How quickly force falls off at edges
}

// Pre-allocated vector for calculations
const tempTerritoryForce = new Vector2();

export class TerritoryManager {
  /** All territories */
  private territories: Map<number, ITerritory> = new Map();
  
  /** Territory ID counter */
  private nextId: number = 0;
  
  /** Simulation dimensions */
  private width: number;
  private height: number;
  
  /** Configuration */
  private config: ITerritoryConfig = {
    enabled: false,
    showTerritories: true,
    defaultRadius: 200,
    defaultStrength: 0.5,
    boundaryFalloff: 0.3
  };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Create a new territory
   */
  createTerritory(
    centerX: number,
    centerY: number,
    ownerSpecies: string,
    radius?: number,
    strength?: number,
    color?: number
  ): number {
    const id = this.nextId++;
    
    const territory: ITerritory = {
      id,
      center: new Vector2(centerX, centerY),
      radius: radius ?? this.config.defaultRadius,
      ownerSpecies,
      strength: strength ?? this.config.defaultStrength,
      repelOthers: true,
      repelStrength: 0.3,
      color: color ?? this.getDefaultColor(ownerSpecies)
    };
    
    this.territories.set(id, territory);
    console.log(`🏠 Created territory ${id} for species "${ownerSpecies}"`);
    
    return id;
  }

  /**
   * Get default color for a species territory
   */
  private getDefaultColor(speciesId: string): number {
    // Generate a consistent color based on species ID hash
    let hash = 0;
    for (let i = 0; i < speciesId.length; i++) {
      hash = speciesId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to HSL then RGB for nice colors
    const hue = Math.abs(hash) % 360;
    return this.hslToHex(hue, 0.6, 0.4);
  }

  /**
   * Convert HSL to hex color
   */
  private hslToHex(h: number, s: number, l: number): number {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r = 0, g = 0, b = 0;
    
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    const ri = Math.round((r + m) * 255);
    const gi = Math.round((g + m) * 255);
    const bi = Math.round((b + m) * 255);
    
    return (ri << 16) | (gi << 8) | bi;
  }

  /**
   * Remove a territory
   */
  removeTerritory(id: number): boolean {
    if (this.territories.has(id)) {
      this.territories.delete(id);
      console.log(`🗑️ Removed territory ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get territory by ID
   */
  getTerritory(id: number): ITerritory | undefined {
    return this.territories.get(id);
  }

  /**
   * Get all territories
   */
  getAllTerritories(): ITerritory[] {
    return Array.from(this.territories.values());
  }

  /**
   * Get territories for a specific species
   */
  getSpeciesTerritories(speciesId: string): ITerritory[] {
    return Array.from(this.territories.values())
      .filter(t => t.ownerSpecies === speciesId);
  }

  /**
   * Find which territory (if any) a position is inside
   */
  findTerritoryAt(x: number, y: number): ITerritory | null {
    for (const territory of this.territories.values()) {
      const dx = x - territory.center.x;
      const dy = y - territory.center.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < territory.radius * territory.radius) {
        return territory;
      }
    }
    return null;
  }

  /**
   * Calculate territory force for a creature
   * Returns force pulling toward home territory or repelling from others
   */
  calculateForce(
    x: number,
    y: number,
    speciesId: string,
    maxForce: number,
    outForce: Vector2
  ): void {
    outForce.x = 0;
    outForce.y = 0;
    
    if (!this.config.enabled) return;
    
    let homePull = new Vector2();
    let repulsion = new Vector2();
    
    for (const territory of this.territories.values()) {
      const dx = territory.center.x - x;
      const dy = territory.center.y - y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      const radiusSq = territory.radius * territory.radius;
      
      if (territory.ownerSpecies === speciesId) {
        // Home territory - pull back if outside
        if (distSq > radiusSq * 0.7) { // Start pulling at 70% radius
          const pullStart = territory.radius * 0.7;
          const pullEnd = territory.radius * 1.5;
          const pullFactor = Math.min(1, (dist - pullStart) / (pullEnd - pullStart));
          
          const strength = territory.strength * pullFactor * maxForce;
          homePull.x += (dx / dist) * strength;
          homePull.y += (dy / dist) * strength;
        }
      } else if (territory.repelOthers) {
        // Other territory - repel if inside
        if (distSq < radiusSq) {
          const repelFactor = 1 - (dist / territory.radius);
          const strength = territory.repelStrength * repelFactor * maxForce;
          
          repulsion.x -= (dx / dist) * strength;
          repulsion.y -= (dy / dist) * strength;
        }
      }
    }
    
    // Combine forces (repulsion has priority)
    outForce.x = homePull.x + repulsion.x * 2;
    outForce.y = homePull.y + repulsion.y * 2;
    
    // Limit total force
    const mag = Math.sqrt(outForce.x * outForce.x + outForce.y * outForce.y);
    if (mag > maxForce) {
      outForce.x = (outForce.x / mag) * maxForce;
      outForce.y = (outForce.y / mag) * maxForce;
    }
  }

  /**
   * Auto-create territories for species based on their current positions
   */
  createTerritoryFromCluster(
    speciesId: string,
    birdPositions: Vector2[],
    radius?: number
  ): number | null {
    if (birdPositions.length === 0) return null;
    
    // Calculate centroid
    let cx = 0, cy = 0;
    for (const pos of birdPositions) {
      cx += pos.x;
      cy += pos.y;
    }
    cx /= birdPositions.length;
    cy /= birdPositions.length;
    
    // Calculate average distance from centroid if radius not specified
    if (radius === undefined) {
      let avgDist = 0;
      for (const pos of birdPositions) {
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        avgDist += Math.sqrt(dx * dx + dy * dy);
      }
      avgDist /= birdPositions.length;
      radius = avgDist * 2; // Territory is 2x the average spread
    }
    
    return this.createTerritory(cx, cy, speciesId, radius);
  }

  /**
   * Update territory center (for moving territories)
   */
  moveTerritory(id: number, newX: number, newY: number): void {
    const territory = this.territories.get(id);
    if (territory) {
      territory.center.x = newX;
      territory.center.y = newY;
    }
  }

  /**
   * Set territory strength
   */
  setStrength(id: number, strength: number): void {
    const territory = this.territories.get(id);
    if (territory) {
      territory.strength = Math.max(0, Math.min(1, strength));
    }
  }

  /**
   * Set territory radius
   */
  setRadius(id: number, radius: number): void {
    const territory = this.territories.get(id);
    if (territory) {
      territory.radius = Math.max(50, radius);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): ITerritoryConfig {
    return this.config;
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<ITerritoryConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Check if territories are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable/disable territories
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Resize simulation area
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Clear all territories
   */
  clear(): void {
    this.territories.clear();
    this.nextId = 0;
  }

  /**
   * Get territory count
   */
  getCount(): number {
    return this.territories.size;
  }
}
