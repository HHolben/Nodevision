//Nodevision/public/InfoSTL.js

(async () => {
    // Dynamically load OrbitControls
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.110.0/examples/js/controls/OrbitControls.js';
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error('Could not load OrbitControls'));
      document.head.appendChild(s);
    });
  
    // Define renderSTL and expose globally
    function renderSTL(filename, infoPanel, serverBase = '') {
      // Clear previous content
      infoPanel.innerHTML = '';
  
      // Create containers
      const viewer = document.createElement('div');
      viewer.style.cssText = 'width:100%; height:400px; border:1px solid #ccc;';
      infoPanel.appendChild(viewer);
  
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff); // Set white background
  
      const camera = new THREE.PerspectiveCamera(
        45,
        viewer.clientWidth / viewer.clientHeight,
        0.1,
        1000
      );
      camera.position.set(100, 100, 100);
      camera.lookAt(0, 0, 0);
  
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(viewer.clientWidth, viewer.clientHeight);
      viewer.appendChild(renderer.domElement);
  
      // Orbit Controls (from global scope)
      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
  
      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(1, 1, 1);
      scene.add(dirLight);
  
      // STL Loader
      const loader = new THREE.STLLoader();
      loader.load(
        `${serverBase}/${filename}`,
        geometry => {
          // Create blue material for faces
          const faceMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0066ff,  // Blue color for faces
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
          });
          
          // Create mesh with blue material
          const mesh = new THREE.Mesh(geometry, faceMaterial);
          geometry.center();
          scene.add(mesh);
          
          // Add yellow-orange edges
          const edges = new THREE.EdgesGeometry(geometry);
          const edgeMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,  // Green color for vertices
          });
          const wireframe = new THREE.LineSegments(edges, edgeMaterial);
          scene.add(wireframe);
          
          // Add green vertices (points)
          const vertices = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({ 
              color: 0xffaa00,  // Yellow-orange color for edges
              size: 2, 
              sizeAttenuation: false
            })
          );
          scene.add(vertices);
        },
        undefined,
        err => {
          console.error('Error loading STL:', err);
          infoPanel.innerHTML = '<p style="color:red;">Failed to load STL file.</p>';
        }
      );
  
      // Render loop
      (function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      })();
  
      // Handle window resize
      window.addEventListener('resize', () => {
        camera.aspect = viewer.clientWidth / viewer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(viewer.clientWidth, viewer.clientHeight);
      });
    }
  
    // Expose renderSTL globally for InfoPanel.js
    window.renderSTL = renderSTL;
  })();