import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragonMistSystem } from '../effects/DragonMistSystem.js';

// === 元素引用 ===
const canvas = document.querySelector('#dragon-canvas');
const loadingScreen = document.querySelector('#loading-screen');
const loadingBar = document.querySelector('#loading-bar');
const loadingDetail = document.querySelector('#loading-detail');
const loadStatus = document.querySelector('#load-status');
const fpsReadout = document.querySelector('#fps-readout');
const readyToast = document.querySelector('#ready-toast');
const rotateToggle = document.querySelector('#rotate-toggle');
const mistToggle = document.querySelector('#mist-toggle');
const resetButton = document.querySelector('#reset-camera');
const deckState = document.querySelector('#deck-state');

// === 渲染器 ===
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// === 场景 + 相机 ===
const scene = new THREE.Scene();
scene.background = null; // 透明，CSS 背景透出
scene.fog = new THREE.FogExp2(0x080807, 0.04);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.4, 5.5);

const initialCamPos = camera.position.clone();
const initialTarget = new THREE.Vector3(0, 0.8, 0);

// === 控制器 ===
const controls = new OrbitControls(camera, canvas);
controls.target.copy(initialTarget);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2.5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.85;

// === 光照（暖金调） ===
const ambient = new THREE.AmbientLight(0xfff0d0, 0.4);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffd57a, 1.6);
keyLight.position.set(4, 6, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x4ecdc4, 0.6);
rimLight.position.set(-5, 3, -3);
scene.add(rimLight);

const bottomGlow = new THREE.PointLight(0xff7a2a, 1.2, 8);
bottomGlow.position.set(0, -0.5, 1.5);
scene.add(bottomGlow);

// === 雾效 ===
const mist = new DragonMistSystem({ count: 220 });
scene.add(mist);

// === 加载龙模型 ===
let dragon = null;
let autoRotate = true;
let mistEnabled = true;

const loader = new GLTFLoader();

loader.load(
  `${import.meta.env.BASE_URL}dragon/scene.gltf`,
  (gltf) => {
    dragon = gltf.scene;
    dragon.scale.set(0.9, 0.9, 0.9);
    dragon.position.set(0, 0, 0);
    dragon.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    scene.add(dragon);
    hideLoading();
    showReady();
    loadStatus.textContent = '已就绪';
  },
  (xhr) => {
    if (xhr.total) {
      const pct = (xhr.loaded / xhr.total) * 100;
      loadingBar.style.transform = `scaleX(${pct / 100})`;
      loadingDetail.textContent = `预载 glTF · ${Math.round(pct)}% · ${(xhr.loaded / 1024 / 1024).toFixed(1)} MB`;
    }
  },
  (err) => {
    console.error(err);
    loadingDetail.textContent = '模型加载失败';
    loadStatus.textContent = '错误';
  }
);

function hideLoading() {
  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 600);
}

let toastTimer = 0;
function showReady() {
  readyToast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    readyToast.classList.remove('is-visible');
  }, 2400);
}

// === 旋转 + 交互 ===
rotateToggle.addEventListener('click', () => {
  autoRotate = !autoRotate;
  rotateToggle.querySelector('.launch-button__label').textContent = autoRotate ? '暂停旋转' : '继续旋转';
});

mistToggle.addEventListener('click', () => {
  mistEnabled = !mistEnabled;
  mist.visible = mistEnabled;
  deckState.textContent = mistEnabled ? '雾效已开' : '雾效已关';
});

resetButton.addEventListener('click', () => {
  camera.position.copy(initialCamPos);
  controls.target.copy(initialTarget);
  deckState.textContent = '已复位';
  setTimeout(() => {
    deckState.textContent = '拖拽旋转 · 滚轮缩放';
  }, 1500);
});

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

// === FPS 计数 ===
let frames = 0;
let lastTime = performance.now();

// === 动画循环 ===
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  if (autoRotate && dragon) {
    dragon.rotation.y += dt * 0.25;
  }
  if (dragon) {
    // 龙头微微上抬 + 呼吸
    dragon.position.y = Math.sin(t * 0.8) * 0.05;
  }

  mist.update(dt, t);
  controls.update();
  renderer.render(scene, camera);

  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fpsReadout.textContent = `${frames} fps`;
    frames = 0;
    lastTime = now;
  }
}
tick();
