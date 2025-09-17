// public/InfoSCAD.js
// Purpose: TODO: Add description of module purpose

/**
 * InfoSCAD.js - Renders OpenSCAD files in the browser
 * Part of Nodevision project (https://github.com/HHolben/Nodevision)
 */

/**
 * Renders an OpenSCAD file in the provided panel
 * @param {string} filename - Path to SCAD file relative to serverBase
 * @param {HTMLElement} infoPanel - DOM element to render the viewer in
 * @param {string} serverBase - Base URL for file requests
 */
function renderSCAD(filename, infoPanel, serverBase) {
  // Check if required libraries are available
  if (!window.THREE) {
    console.error('Three.js not loaded');
    infoPanel.innerHTML = '<p>Error: Three.js library not available</p>';
    return;
  }
  
  // The three-orbitcontrols package adds THREE.OrbitControls directly to the THREE namespace
  if (!window.THREE.OrbitControls) {
    console.error('OrbitControls not loaded');
    infoPanel.innerHTML = '<p>Error: OrbitControls library not available</p>';
    return;
  }
  
  if (!window.CSG) {
    console.error('CSG converter not loaded');
    infoPanel.innerHTML = '<p>Error: CSG library not available</p>';
    return;
  }

  // Clear previous panel content
  infoPanel.innerHTML = '';

  // Create UI components
  const container = document.createElement('div');
  container.className = 'scad-container';
  
  // 1. Create viewer & code containers
  const viewer = document.createElement('div');
  viewer.className = 'scad-viewer';
  viewer.style.cssText = 'width:100%; height:400px; border:1px solid #ccc; position:relative;';
  
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'scad-loading';
  loadingIndicator.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(255,255,255,0.8); padding:10px; border-radius:4px;';
  loadingIndicator.textContent = 'Loading...';
  viewer.appendChild(loadingIndicator);
  
  const codePre = document.createElement('pre');
  codePre.className = 'scad-code';
  codePre.style.cssText =
    'white-space:pre-wrap; font-family:monospace; ' +
    'background:#f9f9f9; border:1px solid #ccc; ' +
    'padding:10px; margin-top:10px; max-height:300px; overflow:auto;';
  
  const toolBar = document.createElement('div');
  toolBar.className = 'scad-toolbar';
  toolBar.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:10px;';
  
  const fileName = document.createElement('div');
  fileName.className = 'scad-filename';
  fileName.style.cssText = 'font-weight:bold;';
  fileName.textContent = filename;
  
  const resetViewBtn = document.createElement('button');
  resetViewBtn.textContent = 'Reset View';
  resetViewBtn.style.cssText = 'padding:4px 8px;';
  
  toolBar.appendChild(fileName);
  toolBar.appendChild(resetViewBtn);
  
  container.append(toolBar, viewer, codePre);
  infoPanel.appendChild(container);

  // Variables for scene management
  let scene, camera, renderer, controls, resultMesh;
  let initialCameraPosition, initialCameraTarget;
  
  // 2. Fetch SCAD source
  fetch(`${serverBase}/${filename}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(scadText => {
      // Display raw SCAD code
      codePre.textContent = scadText;
      
      // Setup 3D scene
      setupScene();
      
      // Parse and render SCAD
      renderModel(scadText);
      
      // Remove loading indicator
      if (loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
    })
    .catch(err => {
      console.error('renderSCAD error:', err);
      viewer.innerHTML = '';
      const errorMessage = document.createElement('div');
      errorMessage.style.cssText = 'color:red; padding:20px; text-align:center;';
      errorMessage.textContent = `Error loading or rendering SCAD file: ${err.message}`;
      viewer.appendChild(errorMessage);
    });
  
  /**
   * Setup the Three.js scene
   */
  function setupScene() {
    // 3. Three.js scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Add grid
    const gridHelper = new THREE.GridHelper(50, 50);
    scene.add(gridHelper);
    
    // Add axes
    const axesHelper = new THREE.AxesHelper(25);
    scene.add(axesHelper);
    
    camera = new THREE.PerspectiveCamera(
      45,
      viewer.clientWidth / viewer.clientHeight,
      0.1,
      1000
    );
    
    initialCameraPosition = new THREE.Vector3(100, 100, 100);
    initialCameraTarget = new THREE.Vector3(0, 0, 0);
    
    camera.position.copy(initialCameraPosition);
    camera.lookAt(initialCameraTarget);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    viewer.appendChild(renderer.domElement);

    // 4. OrbitControls - using THREE.OrbitControls from the CDN
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 500;
    controls.target.copy(initialCameraTarget);

    // 5. Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);
    
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-1, 0.5, -1);
    scene.add(dirLight2);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      if (viewer.clientWidth && viewer.clientHeight) {
        camera.aspect = viewer.clientWidth / viewer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(viewer.clientWidth, viewer.clientHeight);
      }
    });
    
    resizeObserver.observe(viewer);
    
    // Reset view handler
    resetViewBtn.addEventListener('click', () => {
      camera.position.copy(initialCameraPosition);
      controls.target.copy(initialCameraTarget);
      controls.update();
    });
  }
  
  /**
   * Render the SCAD model
   * @param {string} scadText - The OpenSCAD source code
   */
  function renderModel(scadText) {
    try {
      // Parse SCAD to CSG object
      // Make sure we're using the correct CSG library
      const jscadCSG = window.CSG ? CSG.parse(scadText) : THREE.CSG.parse(scadText);
      
      // If we already have a mesh in the scene, remove it
      if (resultMesh) {
        scene.remove(resultMesh);
        if (resultMesh.geometry) resultMesh.geometry.dispose();
        if (resultMesh.material) resultMesh.material.dispose();
      }

      // Convert CSG to THREE.Mesh via THREE-CSGMesh bridge
      // Determine which CSG library we're using and use the appropriate method
      if (window.CSG && CSG.toMesh) {
        resultMesh = CSG.toMesh(
          jscadCSG,
          new THREE.MeshStandardMaterial({ 
            color: 0x1976d2,
            metalness: 0.2, 
            roughness: 0.7
          })
        );
      } else if (THREE.CSG && THREE.CSG.toMesh) {
        resultMesh = THREE.CSG.toMesh(
          jscadCSG,
          new THREE.MeshStandardMaterial({ 
            color: 0x1976d2,
            metalness: 0.2, 
            roughness: 0.7
          })
        );
      } else {
        throw new Error("CSG to Mesh conversion not available");
      }
      
      // Center geometry
      resultMesh.geometry.computeBoundingBox();
      const boundingBox = resultMesh.geometry.boundingBox;
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      resultMesh.geometry.translate(-center.x, -center.y, -center.z);
      
      // Add to scene
      scene.add(resultMesh);
      
      // Auto-adjust camera based on model size
      adjustCameraToModel(boundingBox);
      
    } catch (e) {
      console.error('3D render error:', e);
      const errorOverlay = document.createElement('div');
      errorOverlay.style.cssText = 
        'position:absolute; top:0; left:0; right:0; bottom:0; ' +
        'background:rgba(255,255,255,0.8); display:flex; ' +
        'align-items:center; justify-content:center; color:red;';
      errorOverlay.innerHTML = `<div>Error rendering 3D model:<br>${e.message}</div>`;
      viewer.appendChild(errorOverlay);
    }
  }
  
  /**
   * Adjust camera position and target based on model size
   * @param {THREE.Box3} boundingBox - The model's bounding box
   */
  function adjustCameraToModel(boundingBox) {
    if (!boundingBox) return;
    
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    // Get the maximum dimension
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Set camera distance based on size (using simple heuristic)
    const distance = maxDim * 2;
    
    initialCameraPosition.set(distance, distance, distance);
    camera.position.copy(initialCameraPosition);
    
    initialCameraTarget.set(0, 0, 0);
    controls.target.copy(initialCameraTarget);
    
    controls.update();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderSCAD };
}