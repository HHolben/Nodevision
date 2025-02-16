const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("three-canvas") });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function loadWorld(worldDefinition) {
    // Clear previous objects
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    // Add ground plane back
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // Load objects from worldDefinition
    worldDefinition.objects.forEach(obj => {
        const geometry = new THREE.BoxGeometry(...obj.size);
        const material = new THREE.MeshBasicMaterial({ color: obj.color });
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(...obj.position);
        scene.add(mesh);
    });

    console.log("World updated!");
}

// Camera initial position
camera.position.set(0, 2, 5);



