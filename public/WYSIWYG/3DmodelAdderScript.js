// public/WYSIWYG/3DmodelAdderScript.js
// Purpose: TODO: Add description of module purpose

function insert3DModel() {
    console.log("Inserting 3D Model...");

    const url = prompt("Enter the URL:");

    // Implement 3D model insert functionality here
    const ThreeJSelement = `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.7.7/dat.gui.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
        <div id="container"></div>
        <script type="module">
            // Custom Controls class
            class CustomControls {
                constructor(camera, renderer) {
                    this.camera = camera;
                    this.renderer = renderer;
                    this.domElement = renderer.domElement;
                    this.isDragging = false;
                    this.prevMouseX = 0;
                    this.prevMouseY = 0;
                    this.zoomSpeed = 1.0;
                    this.rotateSpeed = 0.005;
                    this.panSpeed = 0.1;
                    this.init();
                }
                init() {
                    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
                    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
                    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false);
                    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), false);
                }
                onMouseDown(event) {
                    this.isDragging = true;
                    this.prevMouseX = event.clientX;
                    this.prevMouseY = event.clientY;
                    event.preventDefault();
                }
                onMouseMove(event) {
                    if (!this.isDragging) return;
                    let deltaX = event.clientX - this.prevMouseX;
                    let deltaY = event.clientY - this.prevMouseY;
                    this.rotateCamera(deltaX, deltaY);
                    this.prevMouseX = event.clientX;
                    this.prevMouseY = event.clientY;
                }
                onMouseUp(event) {
                    this.isDragging = false;
                }
                onMouseWheel(event) {
                    let delta = event.deltaY > 0 ? 1 : -1;
                    this.zoomCamera(delta);
                    event.preventDefault();
                }
                rotateCamera(deltaX, deltaY) {
                    const spherical = new THREE.Spherical();
                    spherical.setFromVector3(this.camera.position);
                    spherical.phi -= deltaY * this.rotateSpeed;
                    spherical.theta -= deltaX * this.rotateSpeed;
                    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                    this.camera.position.setFromSpherical(spherical);
                    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
                }
                zoomCamera(delta) {
                    const zoomFactor = Math.exp(delta * this.zoomSpeed);
                    this.camera.position.multiplyScalar(zoomFactor);
                }
            }

            // Scene setup
            const gui = new dat.GUI();
            let width = window.innerWidth;
            let height = window.innerHeight;

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x262626);

            const renderer = new THREE.WebGLRenderer();
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.shadowMap.enabled = true;

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const light = new THREE.PointLight(0xffffff, 0.5);
            light.position.set(0, 10, 10);
            light.castShadow = true;
            scene.add(light);

            const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
            camera.position.set(0, 0, 10);

            const controls = new CustomControls(camera, renderer);

            const loader = new THREE.GLTFLoader();
            loader.load('${url}', (gltf) => {
                const model = gltf.scene;
                model.position.set(0, 0, 0);
                scene.add(model);
                renderer.render(scene, camera);
            }, undefined, (error) => {
                console.error('Error loading the model:', error);
            });

            window.addEventListener('resize', () => {
                width = window.innerWidth;
                height = window.innerHeight;
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.render(scene, camera);
            });

            function animate() {
                requestAnimationFrame(animate);
                renderer.render(scene, camera);
            }

            const container = document.querySelector('#container');
            container.append(renderer.domElement);
            animate();
        </script>
    `;

    document.execCommand('insertHTML', false, ThreeJSelement);
}
