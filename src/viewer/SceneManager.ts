import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Owns the renderer, camera, lights, controls and the render loop. Knows
 * nothing about anatomy — it just renders whatever Object3Ds are added and
 * exposes a raycast helper for selection.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly controls: OrbitControls;

  private readonly raycaster = new THREE.Raycaster();
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private frameHandle = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const { clientWidth: w, clientHeight: h } = container;

    this.scene.background = new THREE.Color(0x0e1116);

    this.camera = new THREE.PerspectiveCamera(45, w / h || 1, 0.01, 1000);
    this.camera.position.set(3, 0, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Label renderer overlays the canvas; it must not eat pointer events except
    // on the labels themselves (handled in CSS).
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    // Sensible touch mapping: one finger orbit, two finger dolly + pan.
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.addLights();
    this.addOrientationReference();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x33384a, 0.8);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x99bbff, 0.5);
    fill.position.set(-6, 2, -4);
    this.scene.add(fill);
  }

  /** Faint ground grid + axes so users keep their orientation while rotating. */
  private addOrientationReference(): void {
    const grid = new THREE.GridHelper(20, 20, 0x3a4356, 0x232a36);
    grid.position.y = -5.5;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.name = '__grid';
    this.scene.add(grid);
  }

  /** NDC raycast from a screen point against the given objects (recursive). */
  raycast(clientX: number, clientY: number, objects: THREE.Object3D[]): THREE.Intersection[] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }

  /** Move the camera/target to frame a bounding box with a little margin. */
  frameBounds(box: THREE.Box3): void {
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.6;

    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(dist * 0.5, dist * 0.1, dist));
    this.camera.near = Math.max(maxDim / 1000, 0.01);
    this.camera.far = dist * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  start(): void {
    const loop = () => {
      this.frameHandle = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    };
    loop();
  }

  private onResize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
