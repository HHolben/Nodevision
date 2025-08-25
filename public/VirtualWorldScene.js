//Nodevision/public/VirtualWorldScene.js
const container = document.getElementById('content-frame-container'); // right pane
const canvas = document.getElementById("three-canvas");

// Use injected canvas and set renderer size to container
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(container.clientWidth, container.clientHeight);

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);

// Scene
const scene = new THREE.Scene();

// Persistent objects can go here
const worldGroup = new THREE.Group();
scene.add(worldGroup);

// Ground plane
const planeGeometry = new THREE.PlaneGeometry(50, 50);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.userData.isSolid = true;
worldGroup.add(plane);

// Camera initial position
camera.position.set(0, 2, 5);

// Adjust renderer/camera on container resize
window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Render loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// Load world function
function loadWorld(worldDefinition) {
    while (worldGroup.children.length > 0) {
        worldGroup.remove(worldGroup.children[0]);
    }

    // Re-add ground
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.userData.isSolid = true;
    worldGroup.add(plane);

    worldDefinition.objects.forEach(obj => {
        let geometry;
        if (obj.type === "box") geometry = new THREE.BoxGeometry(...obj.size);
        else if (obj.type === "sphere") geometry = new THREE.SphereGeometry(obj.size[0], 32, 32);
        else return console.warn(`Unknown object type: ${obj.type}`);

        const material = new THREE.MeshBasicMaterial({ color: obj.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...obj.position);
        mesh.userData.isSolid = obj.isSolid || false;
        worldGroup.add(mesh);
    });

    console.log("World updated!");
}
