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
          const material = new THREE.MeshStandardMaterial({ color: 0x999999 });
          const mesh = new THREE.Mesh(geometry, material);
          geometry.center();
          scene.add(mesh);
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
  