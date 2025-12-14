# Starling Swarm Simulator

A high-performance, real-time starling murmuration simulator demonstrating emergent swarm intelligence through simple interaction rules. Built entirely with **TypeScript** and rendered on HTML5 Canvas using PixiJS.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![PixiJS](https://img.shields.io/badge/PixiJS-8.6-e72264?logo=pixijs)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Live Demo

**[▶️ Try the Simulator](https://sadeghhp.github.io/swarm-intelligence-simulator/)**

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ (comes with Node.js)

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open your browser at `http://localhost:5173` to see the simulation.

---

## Features

### Core Simulation
- **2000-5000+ birds** running smoothly at 60fps
- **Spatial partitioning** for O(n) neighbor lookups instead of O(n²)
- **Object pooling** to minimize garbage collection pauses
- **Real-time parameter tuning** via Tweakpane UI

### Environmental Dynamics
- **Wind system** with configurable speed, direction, and turbulence
- **Predator AI** that hunts the flock with panic propagation
- **Food sources** that attract birds with configurable strength

### Rendering Options
- **Multiple particle shapes**: Arrow, circle, triangle
- **Color modes**: By density, by speed, or solid color
- **Trail effects** for motion visualization
- **Glow effects** for certain presets (fireflies)

### Interactive Controls
| Input | Action |
|-------|--------|
| **Left Click** | Add attractor (draws birds toward cursor) |
| **Right Click** | Add repulsor (pushes birds away from cursor) |

---

## Swarm Intelligence Rules

The simulation implements **Reynolds' Boids algorithm** — three simple rules that produce complex emergent behavior:

### Main Rules

| Rule | Description |
|------|-------------|
| **Alignment** | Birds match the velocity direction of nearby neighbors |
| **Cohesion** | Birds steer toward the local center of mass |
| **Separation** | Birds avoid crowding by steering away from close neighbors |

### Sub-Rules & Enhancements

- **Field of View**: Configurable vision cone (default 270° — blind spot behind)
- **Distance Weighting**: Closer neighbors exert stronger influence
- **Noise Injection**: Perlin noise for natural movement variation
- **Boundary Avoidance**: Soft force field keeps birds within view
- **Density Adaptation**: Reduced cohesion in crowded areas to prevent clumping
- **Wander Behavior**: Random steering for more organic movement

---

## Creature Presets

The simulator includes pre-configured behavior profiles:

| Preset | Description | Characteristics |
|--------|-------------|-----------------|
| **Starlings** | Classic murmuration | Balanced rules, 270° FOV, moderate speed |
| **Insects** | Fast erratic swarm | High speed, quick turns, 360° FOV |
| **Fish** | Smooth flowing school | Slower, stronger alignment, graceful |
| **Bats** | Nocturnal cave swarm | High separation, narrow FOV (180°) |
| **Fireflies** | Glowing drifting swarm | Slow, loose formation, glow enabled |
| **Custom** | User-defined | Fully configurable via UI |

---

## Configuration

All simulation parameters can be configured via `public/config.json` or the real-time UI:

### Simulation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `birdCount` | 2000 | Number of birds in the flock |
| `maxSpeed` | 15 | Maximum bird velocity |
| `maxForce` | 0.5 | Maximum steering force |
| `perceptionRadius` | 50 | How far birds can "see" neighbors |
| `separationRadius` | 25 | Minimum comfortable distance |
| `alignmentWeight` | 1.0 | Strength of alignment rule |
| `cohesionWeight` | 1.0 | Strength of cohesion rule |
| `separationWeight` | 1.5 | Strength of separation rule |
| `fieldOfView` | 270 | Vision angle in degrees |

### Environment Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `windSpeed` | 0 | Global wind velocity |
| `windDirection` | 0 | Wind angle in degrees |
| `windTurbulence` | 0.3 | Wind variation intensity |
| `predatorEnabled` | false | Toggle predator AI |
| `panicRadius` | 150 | Distance at which birds panic |
| `foodEnabled` | false | Toggle food sources |
| `foodCount` | 5 | Number of food sources |

---

## Project Structure

```
starling-swarm-simulator/
├── public/
│   └── config.json         # Default configuration
├── src/
│   ├── main.ts             # Entry point
│   ├── App.ts              # Application orchestrator
│   ├── config/
│   │   └── ConfigLoader.ts # Configuration management
│   ├── simulation/         # Core physics & behavior
│   │   ├── Bird.ts         # Bird entity with physics state
│   │   ├── Flock.ts        # Flock manager (main update loop)
│   │   ├── SpatialGrid.ts  # O(n) spatial partitioning
│   │   └── SwarmRules.ts   # Alignment, cohesion, separation
│   ├── environment/        # Environmental systems
│   │   ├── Wind.ts         # Wind force field
│   │   ├── Predator.ts     # Predator AI & hunting logic
│   │   ├── Attractor.ts    # Click attractors/repulsors
│   │   └── FoodSource.ts   # Food attraction points
│   ├── rendering/          # PixiJS visualization
│   │   ├── FlockRenderer.ts       # Bird sprite rendering
│   │   ├── EnvironmentRenderer.ts # Wind/predator/food visuals
│   │   └── TrailEffect.ts         # Motion trail system
│   ├── ui/                 # User interface
│   │   ├── ControlPanel.ts # Tweakpane parameter controls
│   │   └── Statistics.ts   # FPS, bird count, performance
│   ├── utils/              # Utilities
│   │   ├── Vector2.ts      # 2D vector math
│   │   ├── MathUtils.ts    # Math helpers
│   │   └── ObjectPool.ts   # Memory pooling
│   └── types/
│       └── index.ts        # TypeScript type definitions
├── index.html              # HTML entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Performance Optimizations

| Technique | Benefit |
|-----------|---------|
| **Spatial Grid** | O(n) neighbor queries instead of O(n²) brute force |
| **Object Pooling** | Reuses vector objects to reduce GC pressure |
| **PixiJS Batching** | Renders thousands of sprites in few draw calls |
| **Typed Arrays** | Uses typed arrays for performance-critical data |
| **Frame Budgeting** | Maintains 60fps by limiting work per frame |

---

## Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **TypeScript** | 5.7.x | Type-safe application code |
| **PixiJS** | 8.6.x | High-performance 2D rendering |
| **Tweakpane** | 4.0.x | Real-time parameter UI controls |
| **Vite** | 6.0.x | Fast development server & bundler |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript and build for production |
| `npm run preview` | Preview the production build locally |

---

## Browser Support

Works in all modern browsers with WebGL support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## License

This project is licensed under the [MIT License](./LICENSE) — feel free to use, modify, and distribute.
