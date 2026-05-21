// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldInteractions.mjs
// MetaWorld interaction system raycasts scene objects and routes picks to exhibit controllers.

import * as THREE from "/vendor/three/build/three.module.js";

export class MetaWorldInteractions {
  constructor({ sceneSystem, ui, permissions }) {
    this.sceneSystem = sceneSystem;
    this.ui = ui;
    this.permissions = permissions;
    this.selectedController = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerHandler = (event) => this.handlePointer(event);
  }

  start() {
    if (!this.permissions.allowPicking) return;
    this.sceneSystem.renderer.domElement.addEventListener("pointerdown", this.pointerHandler);
  }

  handlePointer(event) {
    const rect = this.sceneSystem.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.sceneSystem.camera);
    const hits = this.raycaster.intersectObjects(this.sceneSystem.clickableObjects, true);
    const hit = hits.find((item) => this.findController(item.object));
    if (!hit) return;
    this.selectController(this.findController(hit.object));
  }

  findController(object) {
    let current = object;
    while (current) {
      if (current.userData?.metaWorld?.controller) return current.userData.metaWorld.controller;
      current = current.parent;
    }
    return null;
  }

  selectController(controller) {
    if (this.selectedController?.onDeselect) this.selectedController.onDeselect();
    this.selectedController = controller;
    if (controller?.onSelect) controller.onSelect();
    this.ui.showExhibit(controller);
  }

  dispose() {
    this.sceneSystem.renderer.domElement.removeEventListener("pointerdown", this.pointerHandler);
    if (this.selectedController?.onDeselect) this.selectedController.onDeselect();
    this.selectedController = null;
  }
}
