const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("three-canvas") });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Persistent objects (like the player) should be added separately, for example:
// const player = createPlayer(); // (Assume this is done in another module)
// scene.add(player);

// Create a group for dynamic world objects
const worldGroup = new THREE.Group();
scene.add(worldGroup);

// Add a ground plane to the world group
const planeGeometry = new THREE.PlaneGeometry(50, 50);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.userData.isSolid = true;
worldGroup.add(plane);

// Camera initial position
camera.position.set(0, 2, 5);




renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function loadWorld(worldDefinition) {
    // Clear previous world objects from worldGroup, but leave persistent objects intact.
    while (worldGroup.children.length > 0) {
        worldGroup.remove(worldGroup.children[0]);
    }
    
    // (Optional) Re-add the ground plane if you want it as part of every world:
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.userData.isSolid = true;
    worldGroup.add(plane);

    // Load objects from the worldDefinition into worldGroup
    worldDefinition.objects.forEach(obj => {
        let geometry;
        if (obj.type === "box") {
            geometry = new THREE.BoxGeometry(...obj.size);
        } else if (obj.type === "sphere") {
            geometry = new THREE.SphereGeometry(obj.size[0], 32, 32);
        } else {
            console.warn(`Unknown object type: ${obj.type}`);
            return;
        }

        const material = new THREE.MeshBasicMaterial({ color: obj.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...obj.position);
        mesh.userData.isSolid = obj.isSolid || false;
        worldGroup.add(mesh);
    });
    
    console.log("World updated!");
}


// Camera initial position
camera.position.set(0, 2, 5);



