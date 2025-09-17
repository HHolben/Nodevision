// Nodevision/public/InfoSTL.js
// Purpose: TODO: Add description of module purpose
(function() {
  document.addEventListener("DOMContentLoaded", () => {
    // ... previous THREE checks ...

    let container = document.getElementById("stl-viewer-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "stl-viewer-container";
      container.style.width = "100%";
      container.style.height = "400px";
      container.style.border = "1px solid #ccc";
      const infoPanel = document.getElementById("content-frame-container");
      infoPanel.appendChild(container);
    }

    let renderer, scene, camera, controls;
    let overlayRenderer, overlayScene, overlayCamera, axesHelper;

    function initViewer() {
      // Main scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);

      camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
      camera.position.set(200, 200, 200);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      const ambientLight = new THREE.AmbientLight(0x606060);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff);
      directionalLight.position.set(1, 1, 1).normalize();
      scene.add(directionalLight);

      // Overlay axes scene
      overlayScene = new THREE.Scene();
      overlayCamera = new THREE.PerspectiveCamera(50, 1, 1, 100);
      overlayCamera.position.set(50, 50, 50);
      overlayScene.add(new THREE.AxesHelper(20));

      overlayRenderer = new THREE.WebGLRenderer({ alpha: true });
      overlayRenderer.setSize(100, 100); // small corner
      overlayRenderer.domElement.style.position = 'absolute';
      overlayRenderer.domElement.style.top = '10px';
      overlayRenderer.domElement.style.right = '10px';
      container.appendChild(overlayRenderer.domElement);
    }

    function animate() {
      requestAnimationFrame(animate);
      if (controls) controls.update();
      if (renderer && scene && camera) renderer.render(scene, camera);
      if (overlayRenderer && overlayScene && overlayCamera) overlayRenderer.render(overlayScene, overlayCamera);
    }

    initViewer();
    animate();

    window.renderSTL = function(filePath) {
      for (let i = scene.children.length - 1; i >= 0; i--) {
        const obj = scene.children[i];
        if (obj.type === "Mesh" || obj.userData.isVertex) scene.remove(obj);
      }

      const loader = new THREE.STLLoader();
      loader.load(`/Notebook/${encodeURIComponent(filePath)}`, geometry => {
        // Faces
        const material = new THREE.MeshPhongMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geometry, material);
// Compute bounding box of the mesh
geometry.computeBoundingBox();
const boundingBox = geometry.boundingBox;

// Compute center and size
const center = new THREE.Vector3();
boundingBox.getCenter(center);

const size = new THREE.Vector3();
boundingBox.getSize(size);
const maxDim = Math.max(size.x, size.y, size.z);

// Re-center the mesh
mesh.position.sub(center);

// Adjust camera distance based on the bounding box size
const fov = camera.fov * (Math.PI / 180); // convert to radians
let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
cameraZ *= 1.5; // zoom out a bit extra
camera.position.set(center.x, center.y, cameraZ);

// Ensure controls target the object center
controls.target.copy(center);
controls.update();

        // Edges
        const edges = new THREE.EdgesGeometry(geometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
        edgeLines.position.sub(center);
        scene.add(edgeLines);

        // Vertices as tiny spheres
        const vertexMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00 });
        const vertexGeom = new THREE.SphereGeometry(0.1, 8, 8); // small sphere
        const positionAttr = geometry.attributes.position;
        for (let i = 0; i < positionAttr.count; i++) {
          const vertex = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
          const sphere = new THREE.Mesh(vertexGeom, vertexMaterial);
          sphere.position.copy(vertex.sub(center));
          sphere.userData.isVertex = true;
          scene.add(sphere);
        }
      }, undefined, err => {
        console.error("Error loading STL:", err);
      });
    };

  });
})();
