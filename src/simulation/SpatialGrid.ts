/**
 * Spatial Grid - O(n) neighbor lookup for large flocks
 * Version: 1.0.0
 * 
 * How it works:
 * 1. Divide the simulation space into a grid of cells
 * 2. Each cell stores indices of birds within it
 * 3. To find neighbors, only check adjacent cells
 * 
 * This reduces neighbor lookup from O(n²) to O(n * k)
 * where k is the average number of birds per cell.
 * 
 * Cell size should match or slightly exceed the perception radius
 * to ensure all potential neighbors are found efficiently.
 */

import type { Bird } from './Bird';
import type { IVector2 } from '../types';

export class SpatialGrid {
  /** Grid cell size (should match perception radius) */
  private cellSize: number;
  
  /** Number of columns in grid */
  private cols: number;
  
  /** Number of rows in grid */
  private rows: number;
  
  /** Grid cells, each containing bird indices */
  private cells: number[][];
  
  /** Total simulation width */
  private width: number;
  
  /** Total simulation height */
  private height: number;

  constructor(width: number, height: number, cellSize: number) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    
    // Initialize empty cells
    this.cells = [];
    for (let i = 0; i < this.cols * this.rows; i++) {
      this.cells[i] = [];
    }
  }

  /**
   * Update grid dimensions (call when canvas resizes)
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / this.cellSize);
    this.rows = Math.ceil(height / this.cellSize);
    
    // Resize cells array
    const newCellCount = this.cols * this.rows;
    while (this.cells.length < newCellCount) {
      this.cells.push([]);
    }
    this.cells.length = newCellCount;
  }

  /**
   * Update cell size (call when perception radius changes)
   */
  setCellSize(cellSize: number): void {
    this.cellSize = cellSize;
    this.cols = Math.ceil(this.width / cellSize);
    this.rows = Math.ceil(this.height / cellSize);
    
    const newCellCount = this.cols * this.rows;
    while (this.cells.length < newCellCount) {
      this.cells.push([]);
    }
    this.cells.length = newCellCount;
  }

  /**
   * Clear all cells (call at start of each frame)
   */
  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0;
    }
  }

  /**
   * Get cell index for a position
   */
  private getCellIndex(x: number, y: number): number {
    const col = Math.floor(Math.max(0, Math.min(x, this.width - 1)) / this.cellSize);
    const row = Math.floor(Math.max(0, Math.min(y, this.height - 1)) / this.cellSize);
    return row * this.cols + Math.min(col, this.cols - 1);
  }

  /**
   * Insert a bird into the grid
   */
  insert(bird: Bird): void {
    const cellIndex = this.getCellIndex(bird.position.x, bird.position.y);
    if (cellIndex >= 0 && cellIndex < this.cells.length) {
      this.cells[cellIndex].push(bird.id);
    }
  }

  /**
   * Insert all birds into the grid
   */
  insertAll(birds: Bird[]): void {
    for (let i = 0; i < birds.length; i++) {
      this.insert(birds[i]);
    }
  }

  /**
   * Get all bird indices in neighboring cells
   * Returns indices of birds that MIGHT be within radius
   * (actual distance check should be done by caller)
   */
  getNeighborIndices(position: IVector2, radius: number): number[] {
    const results: number[] = [];
    
    // Calculate cell range to check
    const minCol = Math.max(0, Math.floor((position.x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((position.x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((position.y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((position.y + radius) / this.cellSize));
    
    // Collect all bird indices from cells in range
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellIndex = row * this.cols + col;
        const cell = this.cells[cellIndex];
        for (let i = 0; i < cell.length; i++) {
          results.push(cell[i]);
        }
      }
    }
    
    return results;
  }

  /**
   * Get neighbors with actual distance filtering
   * More accurate but slightly slower than getNeighborIndices
   */
  getNeighbors(
    bird: Bird,
    birds: Bird[],
    radius: number,
    fov?: number
  ): Bird[] {
    const radiusSq = radius * radius;
    const candidates = this.getNeighborIndices(bird.position, radius);
    const neighbors: Bird[] = [];
    
    for (let i = 0; i < candidates.length; i++) {
      const otherId = candidates[i];
      
      // Skip self
      if (otherId === bird.id) continue;
      
      const other = birds[otherId];
      const distSq = bird.position.distSq(other.position);
      
      // Check if within radius
      if (distSq < radiusSq) {
        // Check field of view if specified
        if (fov === undefined || bird.isInFieldOfView(other.position, fov)) {
          neighbors.push(other);
        }
      }
    }
    
    return neighbors;
  }

  /**
   * Count birds in a radius (for density calculation)
   */
  countInRadius(position: IVector2, radius: number, birds: Bird[]): number {
    const radiusSq = radius * radius;
    const candidates = this.getNeighborIndices(position, radius);
    let count = 0;
    
    for (let i = 0; i < candidates.length; i++) {
      const bird = birds[candidates[i]];
      if (bird.position.distSq(position) < radiusSq) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Find the closest bird to a position
   */
  findClosest(position: IVector2, birds: Bird[], maxRadius: number): Bird | null {
    const candidates = this.getNeighborIndices(position, maxRadius);
    let closest: Bird | null = null;
    let closestDistSq = maxRadius * maxRadius;
    
    for (let i = 0; i < candidates.length; i++) {
      const bird = birds[candidates[i]];
      const distSq = bird.position.distSq(position);
      
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = bird;
      }
    }
    
    return closest;
  }

  /**
   * Get statistics about grid distribution
   * Useful for debugging and monitoring
   */
  getStats(): { totalCells: number; occupiedCells: number; avgBirdsPerCell: number; maxBirdsInCell: number } {
    let occupiedCells = 0;
    let totalBirds = 0;
    let maxBirds = 0;
    
    for (let i = 0; i < this.cells.length; i++) {
      const count = this.cells[i].length;
      if (count > 0) {
        occupiedCells++;
        totalBirds += count;
        maxBirds = Math.max(maxBirds, count);
      }
    }
    
    return {
      totalCells: this.cells.length,
      occupiedCells,
      avgBirdsPerCell: occupiedCells > 0 ? totalBirds / occupiedCells : 0,
      maxBirdsInCell: maxBirds
    };
  }

  /**
   * Get grid dimensions
   */
  get dimensions(): { cols: number; rows: number; cellSize: number } {
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize
    };
  }
}

