/**
 * Starling Swarm Simulator - Main Entry Point
 * Version: 1.0.0
 * 
 * A real-time starling murmuration simulator demonstrating
 * emergent swarm intelligence through simple interaction rules.
 */

import { App } from './App';

console.log('🐦 Starling Swarm Simulator v1.0.0');

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new App();
    await app.initialize();
    
    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    
    // Start the simulation
    app.start();
    
    console.log('✅ Simulation initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize simulation:', error);
    
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div style="color: #ff6b6b; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 16px;">⚠️</div>
          <div>Failed to initialize simulation</div>
          <div style="font-size: 0.8rem; margin-top: 8px; opacity: 0.7;">${error}</div>
        </div>
      `;
    }
  }
});

