/**
 * Optimized 2D Vector class for high-performance simulations
 * Version: 1.0.0
 * 
 * Design decisions:
 * - Mutable operations for performance (avoid allocations in hot loops)
 * - Static methods that reuse vectors via output parameter
 * - Pool-friendly design with reset() method
 */

import type { IVector2 } from '../types';

export class Vector2 implements IVector2 {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Reset vector to given values (pool-friendly)
   */
  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Copy values from another vector
   */
  copy(v: IVector2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  /**
   * Clone this vector
   */
  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  /**
   * Add another vector (mutates this)
   */
  add(v: IVector2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /**
   * Subtract another vector (mutates this)
   */
  sub(v: IVector2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /**
   * Multiply by scalar (mutates this)
   */
  mult(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Divide by scalar (mutates this)
   */
  div(scalar: number): this {
    if (scalar !== 0) {
      this.x /= scalar;
      this.y /= scalar;
    }
    return this;
  }

  /**
   * Get magnitude (length) of vector
   */
  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Get squared magnitude (faster, no sqrt)
   */
  magSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalize to unit vector (mutates this)
   */
  normalize(): this {
    const m = this.mag();
    if (m > 0) {
      this.div(m);
    }
    return this;
  }

  /**
   * Limit magnitude to max value (mutates this)
   */
  limit(max: number): this {
    const magSq = this.magSq();
    if (magSq > max * max) {
      this.div(Math.sqrt(magSq)).mult(max);
    }
    return this;
  }

  /**
   * Set magnitude to specific value (mutates this)
   */
  setMag(mag: number): this {
    return this.normalize().mult(mag);
  }

  /**
   * Get heading angle in radians
   */
  heading(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Rotate vector by angle in radians (mutates this)
   */
  rotate(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = this.x * cos - this.y * sin;
    const y = this.x * sin + this.y * cos;
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Linear interpolation toward target (mutates this)
   */
  lerp(target: IVector2, t: number): this {
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
    return this;
  }

  /**
   * Distance to another vector
   */
  dist(v: IVector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Squared distance to another vector (faster)
   */
  distSq(v: IVector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  /**
   * Dot product with another vector
   */
  dot(v: IVector2): number {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Cross product (returns scalar for 2D)
   */
  cross(v: IVector2): number {
    return this.x * v.y - this.y * v.x;
  }

  /**
   * Check if vector is zero
   */
  isZero(): boolean {
    return this.x === 0 && this.y === 0;
  }

  /**
   * Reset to zero
   */
  zero(): this {
    this.x = 0;
    this.y = 0;
    return this;
  }

  // ==================== STATIC METHODS ====================

  /**
   * Create vector from angle (in radians)
   */
  static fromAngle(angle: number, magnitude: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  }

  /**
   * Create random unit vector
   */
  static random(): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    return new Vector2(Math.cos(angle), Math.sin(angle));
  }

  /**
   * Add two vectors, store result in out
   */
  static add(a: IVector2, b: IVector2, out: Vector2): Vector2 {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
    return out;
  }

  /**
   * Subtract vectors (a - b), store result in out
   */
  static sub(a: IVector2, b: IVector2, out: Vector2): Vector2 {
    out.x = a.x - b.x;
    out.y = a.y - b.y;
    return out;
  }

  /**
   * Multiply vector by scalar, store result in out
   */
  static mult(v: IVector2, scalar: number, out: Vector2): Vector2 {
    out.x = v.x * scalar;
    out.y = v.y * scalar;
    return out;
  }

  /**
   * Linear interpolation between two vectors
   */
  static lerp(a: IVector2, b: IVector2, t: number, out: Vector2): Vector2 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
  }

  /**
   * Distance between two vectors
   */
  static dist(a: IVector2, b: IVector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Squared distance between two vectors
   */
  static distSq(a: IVector2, b: IVector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  /**
   * Angle between two vectors in radians
   */
  static angleBetween(a: IVector2, b: IVector2): number {
    const dot = a.x * b.x + a.y * b.y;
    const magA = Math.sqrt(a.x * a.x + a.y * a.y);
    const magB = Math.sqrt(b.x * b.x + b.y * b.y);
    if (magA === 0 || magB === 0) return 0;
    const cosTheta = Math.max(-1, Math.min(1, dot / (magA * magB)));
    return Math.acos(cosTheta);
  }
}

