// Nodevision/ApplicationSystem/public/TestingThree.js
// This file defines browser-side Testing Three logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/TestingThree.js
// Purpose: TODO: Add description of module purpose

function init() {
  const container = document.getElementById("stl-container");
  if (!container) {
    console.error("❌ stl-container not found in DOM!");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
}
init();
