/**
 * Generic Object Pool for memory-efficient simulation
 * Version: 1.0.0
 * 
 * Prevents garbage collection pressure by reusing objects
 * instead of creating new ones in hot loops.
 */

export interface IPoolable {
  reset(): void;
}

export class ObjectPool<T extends IPoolable> {
  private pool: T[] = [];
  private factory: () => T;
  private activeCount: number = 0;

  constructor(factory: () => T, initialSize: number = 100) {
    this.factory = factory;
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /**
   * Get an object from the pool (or create new if empty)
   */
  acquire(): T {
    this.activeCount++;
    
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    
    return this.factory();
  }

  /**
   * Return an object to the pool
   */
  release(obj: T): void {
    obj.reset();
    this.pool.push(obj);
    this.activeCount--;
  }

  /**
   * Release multiple objects at once
   */
  releaseAll(objects: T[]): void {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  /**
   * Get current pool size (available objects)
   */
  get available(): number {
    return this.pool.length;
  }

  /**
   * Get count of active (borrowed) objects
   */
  get active(): number {
    return this.activeCount;
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool.length = 0;
    this.activeCount = 0;
  }

  /**
   * Ensure pool has at least minSize available objects
   */
  ensureCapacity(minSize: number): void {
    while (this.pool.length < minSize) {
      this.pool.push(this.factory());
    }
  }
}

/**
 * Specialized Vector2 pool for frequent vector operations
 */
import { Vector2 } from './Vector2';

class Vector2Poolable extends Vector2 implements IPoolable {
  reset(): void {
    this.x = 0;
    this.y = 0;
  }
}

// Global vector pool for temporary calculations
export const vectorPool = new ObjectPool<Vector2Poolable>(
  () => new Vector2Poolable(),
  500
);

/**
 * Helper to safely use pooled vectors with automatic release
 */
export function withVector<R>(fn: (v: Vector2) => R): R {
  const v = vectorPool.acquire();
  try {
    return fn(v);
  } finally {
    vectorPool.release(v as Vector2Poolable);
  }
}

/**
 * Helper to safely use multiple pooled vectors
 */
export function withVectors<R>(count: number, fn: (vectors: Vector2[]) => R): R {
  const vectors: Vector2Poolable[] = [];
  for (let i = 0; i < count; i++) {
    vectors.push(vectorPool.acquire());
  }
  try {
    return fn(vectors);
  } finally {
    for (const v of vectors) {
      vectorPool.release(v);
    }
  }
}

