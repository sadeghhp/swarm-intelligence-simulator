# Starling Swarm Simulator

A high-performance, real-time starling murmuration simulator demonstrating emergent swarm intelligence through simple interaction rules.

## Quick Start

```bash
npm install
npm run dev
```

## Features

- **2000-5000+ birds** at 60fps with spatial partitioning optimization
- **Real-time controls** via Tweakpane for all simulation parameters
- **Environmental dynamics**: Wind with turbulence, predator AI with panic propagation
- **Interactive**: Click to add attractors, right-click for repulsors

## Swarm Intelligence Rules

### Main Rules (Reynolds' Boids)

1. **Alignment** - Birds match velocity direction of nearby neighbors
2. **Cohesion** - Birds move toward local center of mass
3. **Separation** - Birds avoid crowding each other

### Sub-Rules

- **Field of View**: 270° vision (blind spot behind)
- **Distance Weighting**: Closer neighbors have stronger influence
- **Noise Injection**: Perlin noise for natural variation
- **Boundary Avoidance**: Soft force field at screen edges
- **Density Adaptation**: Reduced cohesion in crowded areas

## Controls

| Control | Description |
|---------|-------------|
| Left Click | Add attractor (draws birds toward point) |
| Right Click | Add repulsor (pushes birds away) |

## Technical Architecture

```
src/
├── simulation/      # Core physics and behavior
│   ├── Bird.ts      # Bird entity with physics state
│   ├── Flock.ts     # Flock manager (update loop)
│   ├── SpatialGrid.ts  # O(n) neighbor lookup
│   └── SwarmRules.ts   # Alignment, cohesion, separation
├── environment/     # Environmental systems
│   ├── Wind.ts      # Wind force field
│   ├── Predator.ts  # Predator AI
│   └── Attractor.ts # Attractors/repulsors
├── rendering/       # PixiJS visualization
│   ├── FlockRenderer.ts
│   ├── EnvironmentRenderer.ts
│   └── TrailEffect.ts
└── ui/             # Tweakpane controls
    ├── ControlPanel.ts
    └── Statistics.ts
```

## Performance

- **Spatial Grid**: O(n) neighbor lookup instead of O(n²)
- **Object Pooling**: Minimizes garbage collection
- **PixiJS Batching**: Efficient sprite rendering

## Technologies

- TypeScript 5.x
- PixiJS 8.x
- Tweakpane 4.x
- Vite 6.x

