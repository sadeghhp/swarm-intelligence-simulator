/**
 * Starling Swarm Simulator - Main Entry Point
 * Version: 1.2.0 - Config from JSON, creature presets, food mechanics
 * 
 * A real-time starling murmuration simulator demonstrating
 * emergent swarm intelligence through simple interaction rules.
 * 
 * Configuration is loaded from /config.json at startup.
 */

import { App } from './App';
import { loadConfig, setConfig } from './config/ConfigLoader';

const VERSION = '1.3.0';

console.log(`🐦 Starling Swarm Simulator v${VERSION}`);

// Update loading text
function setLoadingText(text: string): void {
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = text;
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Step 1: Load configuration from JSON
    setLoadingText('Loading configuration...');
    const config = await loadConfig('/config.json');
    setConfig(config);
    console.log(`📋 Config loaded: v${config.version}`);
    
    // Step 2: Create and initialize the app
    setLoadingText('Initializing simulation...');
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

