/**
 * Statistics Display - Real-time telemetry updates
 * Version: 1.1.0 - Extended with food stats
 * 
 * Updates the HTML statistics panel with current simulation data.
 */

import type { ISimulationStats } from '../types';

export class Statistics {
  private fpsElement: HTMLElement | null;
  private birdsElement: HTMLElement | null;
  private densityElement: HTMLElement | null;
  private velocityElement: HTMLElement | null;
  private timeElement: HTMLElement | null;
  private predatorElement: HTMLElement | null;
  
  /** FPS calculation */
  private frameCount: number = 0;
  private lastFpsTime: number = 0;
  private currentFps: number = 60;

  constructor() {
    // Get DOM elements
    this.fpsElement = document.getElementById('stat-fps');
    this.birdsElement = document.getElementById('stat-birds');
    this.densityElement = document.getElementById('stat-density');
    this.velocityElement = document.getElementById('stat-velocity');
    this.timeElement = document.getElementById('stat-time');
    this.predatorElement = document.getElementById('stat-predator');
    
    this.lastFpsTime = performance.now();
  }

  /**
   * Update statistics display
   */
  update(stats: ISimulationStats): void {
    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round(this.frameCount * 1000 / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    
    // Update DOM elements
    if (this.fpsElement) {
      this.fpsElement.textContent = this.currentFps.toString();
      // Color code FPS
      if (this.currentFps >= 55) {
        this.fpsElement.style.color = 'var(--accent-cyan)';
      } else if (this.currentFps >= 30) {
        this.fpsElement.style.color = '#ffaa00';
      } else {
        this.fpsElement.style.color = '#ff6666';
      }
    }
    
    if (this.birdsElement) {
      this.birdsElement.textContent = stats.birdCount.toLocaleString();
    }
    
    if (this.densityElement) {
      this.densityElement.textContent = stats.averageDensity.toFixed(1);
    }
    
    if (this.velocityElement) {
      this.velocityElement.textContent = stats.averageVelocity.toFixed(1);
    }
    
    if (this.timeElement) {
      this.timeElement.textContent = this.formatTime(stats.simulationTime);
    }
    
    if (this.predatorElement) {
      // Show food info when available, otherwise predator state
      if (stats.activeFood !== undefined && stats.activeFood > 0) {
        this.predatorElement.textContent = `${stats.activeFood} Food`;
        this.predatorElement.style.color = '#88ff88';
      } else if (stats.activePredators > 0) {
        // Show predator type and state
        const typeStr = stats.predatorType ? this.capitalizeFirst(stats.predatorType) : 'Predator';
        const stateStr = this.capitalizeFirst(stats.predatorState);
        this.predatorElement.textContent = `${typeStr}: ${stateStr}`;
        
        // Color code predator state
        switch (stats.predatorState) {
          case 'hunting':
          case 'stalking':
          case 'scanning':
            this.predatorElement.style.color = '#ffaa00';
            break;
          case 'attacking':
          case 'diving':
            this.predatorElement.style.color = '#ff6666';
            break;
          case 'ambushing':
            this.predatorElement.style.color = '#9b59b6';
            break;
          case 'recovering':
            this.predatorElement.style.color = '#888888';
            break;
          default:
            this.predatorElement.style.color = 'var(--text-muted)';
        }
      } else {
        this.predatorElement.textContent = 'No Predator';
        this.predatorElement.style.color = 'var(--text-muted)';
      }
    }
  }

  /**
   * Get current FPS
   */
  getFps(): number {
    return this.currentFps;
  }

  /**
   * Format time as m:ss
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

