import * as THREE from 'three';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aSeed;
  attribute float aWarmth;

  uniform float uPixelRatio;
  uniform float uPointScale;
  uniform float uMaxPointSize;

  varying float vOpacity;
  varying float vSeed;
  varying float vWarmth;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float perspective = uPointScale / max(1.0, -viewPosition.z);

    vOpacity = aOpacity;
    vSeed = aSeed;
    vWarmth = aWarmth;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * perspective * uPixelRatio, 1.0, uMaxPointSize * uPixelRatio);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uMistColor;
  uniform vec3 uGoldColor;

  varying float vOpacity;
  varying float vSeed;
  varying float vWarmth;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    mat2 octaveTransform = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) {
      sum += amplitude * valueNoise(p);
      p = octaveTransform * p;
      amplitude *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float angle = vSeed * 6.28318530718;
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    point = rotation * point;

    float drift = uTime * (0.055 + vSeed * 0.025);
    vec2 warp = vec2(
      fbm(point * 1.55 + vec2(vSeed * 7.1, drift)),
      fbm(point * 1.55 + vec2(8.7 + vSeed * 3.9, -drift * 0.83))
    ) - 0.5;
    float cloudNoise = fbm(point * 2.35 + warp * 1.18 + vSeed * 11.0);

    // Stretch and erode the sprite footprint so overlapping particles read as
    // drifting filaments rather than a collection of circular light spots.
    vec2 filamentPoint = vec2(point.x * 0.72, point.y * 1.24);
    float irregularField = 1.0 - dot(filamentPoint, filamentPoint);
    float brokenEdge = smoothstep(-0.42, 0.38, irregularField + (cloudNoise - 0.5) * 1.22);
    float filamentNoise = fbm(vec2(
      point.x * 1.3 + warp.x * 1.42 + vSeed * 4.0,
      point.y * 5.1 + warp.y * 0.72 - drift * 1.9
    ));
    float crossingNoise = fbm(vec2(
      point.x * 4.15 - warp.y * 0.85 + 7.0,
      point.y * 1.6 + warp.x * 1.15 + drift * 1.15
    ));
    float strandDensity = max(
      smoothstep(0.43, 0.78, filamentNoise) * 0.78,
      smoothstep(0.55, 0.84, crossingNoise) * 0.42
    );
    float density = brokenEdge * mix(0.08, 0.78, strandDensity);
    float alpha = density * vOpacity;
    if (alpha < 0.002) discard;

    float goldVein = smoothstep(0.76, 0.94, cloudNoise) * vWarmth;
    vec3 color = mix(uMistColor, uGoldColor, goldVein * 0.1);
    color += uGoldColor * goldVein * 0.01;

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

const DEFAULTS = Object.freeze({
  ambientCount: 82,
  trailCount: 152,
  ambientRadius: 1.35,
  ambientHeight: 0.72,
  ambientOpacity: 0.105,
  ambientSize: 0.46,
  trailOpacity: 0.15,
  trailSize: 0.54,
  trailLifetime: 2.35,
  trailSpeedThreshold: 0.12,
  fullTrailSpeed: 3.2,
  maxSpawnRate: 58,
  pointScale: 235,
  maxPointSize: 42,
  pixelRatio: 1,
  mistColor: 0xc9c8c4,
  goldColor: 0xd7ac55,
  renderOrder: 3,
});

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(min, max, value) {
  const t = clamp01((value - min) / Math.max(1e-6, max - min));
  return t * t * (3 - 2 * t);
}

function positiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function copyFiniteVector(target, source) {
  if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.y) || !Number.isFinite(source.z)) {
    throw new TypeError('DragonMistSystem.update requires finite dragonPosition and dragonVelocity vectors.');
  }
  return target.set(source.x, source.y, source.z);
}

function createGeometry(count) {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  const size = new THREE.BufferAttribute(new Float32Array(count), 1);
  const opacity = new THREE.BufferAttribute(new Float32Array(count), 1);
  const seed = new THREE.BufferAttribute(new Float32Array(count), 1);
  const warmth = new THREE.BufferAttribute(new Float32Array(count), 1);

  position.setUsage(THREE.DynamicDrawUsage);
  opacity.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('aSize', size);
  geometry.setAttribute('aOpacity', opacity);
  geometry.setAttribute('aSeed', seed);
  geometry.setAttribute('aWarmth', warmth);
  geometry.setDrawRange(0, count);
  return geometry;
}

function createMaterial(options) {
  return new THREE.ShaderMaterial({
    name: 'DragonMistProceduralMaterial',
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, Math.max(0.5, options.pixelRatio)) },
      uPointScale: { value: options.pointScale },
      uMaxPointSize: { value: options.maxPointSize },
      uMistColor: { value: new THREE.Color(options.mistColor) },
      uGoldColor: { value: new THREE.Color(options.goldColor) },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
    toneMapped: true,
  });
}

/**
 * Texture-free cloud mist that follows a dragon in world space.
 *
 * Usage:
 *   const mist = new DragonMistSystem(scene);
 *   mist.update(deltaSeconds, dragonWorldPosition, dragonWorldVelocity);
 *
 * The parent should be a scene or an identity-transformed world-space group.
 */
export class DragonMistSystem {
  constructor(parent, options = {}) {
    if (parent != null && !parent.isObject3D) {
      throw new TypeError('DragonMistSystem parent must be a THREE.Object3D.');
    }

    this.options = { ...DEFAULTS, ...options };
    this.options.ambientCount = positiveInteger(this.options.ambientCount, DEFAULTS.ambientCount);
    this.options.trailCount = positiveInteger(this.options.trailCount, DEFAULTS.trailCount);
    this._random = typeof options.random === 'function' ? options.random : Math.random;

    this.group = new THREE.Group();
    this.group.name = 'dragon-mist-system';
    this.group.matrixAutoUpdate = true;
    this.group.frustumCulled = false;

    this._ambientGeometry = createGeometry(this.options.ambientCount);
    this._trailGeometry = createGeometry(this.options.trailCount);
    this._ambientMaterial = createMaterial(this.options);
    this._trailMaterial = this._ambientMaterial.clone();
    this._trailMaterial.name = 'DragonMistTrailProceduralMaterial';

    this.ambientMist = new THREE.Points(this._ambientGeometry, this._ambientMaterial);
    this.ambientMist.name = 'dragon-mist-ambient';
    this.ambientMist.frustumCulled = false;
    this.ambientMist.renderOrder = this.options.renderOrder;

    this.trailMist = new THREE.Points(this._trailGeometry, this._trailMaterial);
    this.trailMist.name = 'dragon-mist-trail';
    this.trailMist.frustumCulled = false;
    this.trailMist.renderOrder = this.options.renderOrder - 1;

    this.group.add(this.trailMist, this.ambientMist);
    if (parent) parent.add(this.group);

    this._time = 0;
    this._flightAmount = 0;
    this._spawnAccumulator = 0;
    this._trailCursor = 0;
    this._hasPreviousPosition = false;
    this._disposed = false;

    this._dragonPosition = new THREE.Vector3();
    this._previousPosition = new THREE.Vector3();
    this._velocity = new THREE.Vector3();
    this._direction = new THREE.Vector3(1, 0, 0);
    this._side = new THREE.Vector3();
    this._binormal = new THREE.Vector3();
    this._scratch = new THREE.Vector3();

    this._ambientPhase = new Float32Array(this.options.ambientCount);
    this._ambientRadius = new Float32Array(this.options.ambientCount);
    this._ambientHeight = new Float32Array(this.options.ambientCount);
    this._ambientSpeed = new Float32Array(this.options.ambientCount);
    this._ambientPulse = new Float32Array(this.options.ambientCount);

    this._trailAge = new Float32Array(this.options.trailCount);
    this._trailLife = new Float32Array(this.options.trailCount);
    this._trailVelocity = new Float32Array(this.options.trailCount * 3);
    this._trailDrift = new Float32Array(this.options.trailCount * 3);

    this._initializeAmbientParticles();
    this.clearTrail();
  }

  _initializeAmbientParticles() {
    const { ambientCount, ambientRadius, ambientHeight, ambientOpacity, ambientSize } = this.options;
    const position = this._ambientGeometry.attributes.position.array;
    const size = this._ambientGeometry.attributes.aSize.array;
    const opacity = this._ambientGeometry.attributes.aOpacity.array;
    const seed = this._ambientGeometry.attributes.aSeed.array;
    const warmth = this._ambientGeometry.attributes.aWarmth.array;

    for (let i = 0; i < ambientCount; i++) {
      const distribution = (i + this._random() * 0.7) / ambientCount;
      this._ambientPhase[i] = distribution * TAU;
      this._ambientRadius[i] = ambientRadius * (0.48 + this._random() * 0.58);
      this._ambientHeight[i] = (this._random() * 2 - 1) * ambientHeight;
      this._ambientSpeed[i] = 0.12 + this._random() * 0.2;
      this._ambientPulse[i] = this._random() * TAU;

      const offset = i * 3;
      position[offset] = 0;
      position[offset + 1] = 0;
      position[offset + 2] = 0;
      size[i] = ambientSize * (0.68 + this._random() * 0.72);
      opacity[i] = ambientOpacity * (0.58 + this._random() * 0.42);
      seed[i] = this._random();
      warmth[i] = 0.06 + this._random() * 0.16;
    }

    this._ambientGeometry.attributes.aSize.needsUpdate = true;
    this._ambientGeometry.attributes.aOpacity.needsUpdate = true;
    this._ambientGeometry.attributes.aSeed.needsUpdate = true;
    this._ambientGeometry.attributes.aWarmth.needsUpdate = true;
  }

  _updateAmbientParticles(dt) {
    const { ambientCount, ambientOpacity } = this.options;
    const positionAttribute = this._ambientGeometry.attributes.position;
    const opacityAttribute = this._ambientGeometry.attributes.aOpacity;
    const position = positionAttribute.array;
    const opacity = opacityAttribute.array;

    for (let i = 0; i < ambientCount; i++) {
      const angle = this._ambientPhase[i] + this._time * this._ambientSpeed[i];
      const radiusBreath = 1 + Math.sin(this._time * 0.72 + this._ambientPulse[i]) * 0.075;
      const radius = this._ambientRadius[i] * radiusBreath;
      const offset = i * 3;

      position[offset] = Math.cos(angle) * radius;
      position[offset + 1] = this._ambientHeight[i] + Math.sin(angle * 1.7 + this._time * 0.18) * 0.13;
      position[offset + 2] = Math.sin(angle) * radius * 0.64;

      const breath = 0.78 + Math.sin(this._time * 0.61 + this._ambientPulse[i]) * 0.22;
      const flightThinning = 1 - this._flightAmount * 0.2;
      opacity[i] = ambientOpacity * breath * flightThinning;
    }

    positionAttribute.needsUpdate = true;
    opacityAttribute.needsUpdate = true;
    this.ambientMist.position.copy(this._dragonPosition);
    this.ambientMist.updateMatrix();
  }

  _spawnTrailParticle(segmentT, speedRatio) {
    const index = this._trailCursor;
    this._trailCursor = (this._trailCursor + 1) % this.options.trailCount;

    const position = this._trailGeometry.attributes.position.array;
    const size = this._trailGeometry.attributes.aSize.array;
    const opacity = this._trailGeometry.attributes.aOpacity.array;
    const seed = this._trailGeometry.attributes.aSeed.array;
    const warmth = this._trailGeometry.attributes.aWarmth.array;
    const offset = index * 3;

    this._scratch.lerpVectors(this._previousPosition, this._dragonPosition, segmentT);
    const backward = 0.15 + this._random() * (0.35 + speedRatio * 0.55);
    const sideJitter = (this._random() * 2 - 1) * (0.18 + speedRatio * 0.22);
    const verticalJitter = (this._random() * 2 - 1) * 0.2;
    this._scratch
      .addScaledVector(this._direction, -backward)
      .addScaledVector(this._side, sideJitter)
      .addScaledVector(this._binormal, verticalJitter);

    position[offset] = this._scratch.x;
    position[offset + 1] = this._scratch.y;
    position[offset + 2] = this._scratch.z;
    size[index] = this.options.trailSize * (0.7 + this._random() * 0.75) * (0.84 + speedRatio * 0.3);
    opacity[index] = 0.001;
    seed[index] = this._random();
    warmth[index] = 0.08 + this._random() * 0.22;

    this._trailAge[index] = 0;
    this._trailLife[index] = this.options.trailLifetime * (0.72 + this._random() * 0.52);

    const inheritedMotion = 0.035 + this._random() * 0.035;
    this._trailVelocity[offset] = this._velocity.x * inheritedMotion + this._side.x * sideJitter * 0.16;
    this._trailVelocity[offset + 1] = this._velocity.y * inheritedMotion + 0.055 + this._random() * 0.08;
    this._trailVelocity[offset + 2] = this._velocity.z * inheritedMotion + this._side.z * sideJitter * 0.16;
    this._trailDrift[offset] = this._random() * TAU;
    this._trailDrift[offset + 1] = this._random() * TAU;
    this._trailDrift[offset + 2] = 0.35 + this._random() * 0.65;
  }

  _updateTrailParticles(dt, speed, speedRatio) {
    const positionAttribute = this._trailGeometry.attributes.position;
    const opacityAttribute = this._trailGeometry.attributes.aOpacity;
    const sizeAttribute = this._trailGeometry.attributes.aSize;
    const seedAttribute = this._trailGeometry.attributes.aSeed;
    const warmthAttribute = this._trailGeometry.attributes.aWarmth;
    const position = positionAttribute.array;
    const opacity = opacityAttribute.array;

    for (let i = 0; i < this.options.trailCount; i++) {
      const life = this._trailLife[i];
      if (life <= 0) continue;

      const offset = i * 3;
      const age = this._trailAge[i] + dt;
      this._trailAge[i] = age;
      if (age >= life) {
        this._trailLife[i] = 0;
        opacity[i] = 0;
        continue;
      }

      const normalizedAge = age / life;
      const driftFrequency = this._trailDrift[offset + 2];
      const driftX = Math.sin(this._time * driftFrequency + this._trailDrift[offset]) * 0.035;
      const driftZ = Math.cos(this._time * driftFrequency * 0.83 + this._trailDrift[offset + 1]) * 0.035;
      position[offset] += (this._trailVelocity[offset] + driftX) * dt;
      position[offset + 1] += this._trailVelocity[offset + 1] * dt;
      position[offset + 2] += (this._trailVelocity[offset + 2] + driftZ) * dt;

      const fadeIn = smoothstep(0, 0.12, normalizedAge);
      const fadeOut = Math.pow(1 - normalizedAge, 1.65);
      const stoppedFade = speed < this.options.trailSpeedThreshold ? Math.exp(-normalizedAge * 2.2) : 1;
      opacity[i] = this.options.trailOpacity * fadeIn * fadeOut * stoppedFade;
    }

    if (speed >= this.options.trailSpeedThreshold && dt > 0) {
      const spawnRate = this.options.maxSpawnRate * (0.28 + speedRatio * 0.72);
      this._spawnAccumulator += spawnRate * dt;
      const spawnCount = Math.min(8, Math.floor(this._spawnAccumulator));
      this._spawnAccumulator -= spawnCount;
      for (let i = 0; i < spawnCount; i++) {
        this._spawnTrailParticle((i + 1) / (spawnCount + 1), speedRatio);
      }
    } else {
      this._spawnAccumulator = Math.min(this._spawnAccumulator, 0.99);
    }

    positionAttribute.needsUpdate = true;
    opacityAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
    seedAttribute.needsUpdate = true;
    warmthAttribute.needsUpdate = true;
  }

  /**
   * Advances the mist simulation.
   * @param {number} deltaTime elapsed seconds since the previous frame
   * @param {{x:number,y:number,z:number}} dragonPosition dragon world position
   * @param {{x:number,y:number,z:number}} dragonVelocity dragon world velocity
   * @returns {DragonMistSystem}
   */
  update(deltaTime, dragonPosition, dragonVelocity) {
    if (this._disposed) return this;

    const dt = Math.min(0.1, Math.max(0, Number.isFinite(deltaTime) ? deltaTime : 0));
    copyFiniteVector(this._dragonPosition, dragonPosition);
    copyFiniteVector(this._velocity, dragonVelocity);

    if (!this._hasPreviousPosition) {
      this._previousPosition.copy(this._dragonPosition);
      this._hasPreviousPosition = true;
    }

    this._time += dt;
    const speed = this._velocity.length();
    const speedRatio = smoothstep(this.options.trailSpeedThreshold, this.options.fullTrailSpeed, speed);
    const targetFlightAmount = speed >= this.options.trailSpeedThreshold ? speedRatio : 0;
    this._flightAmount += (targetFlightAmount - this._flightAmount) * (1 - Math.exp(-dt * 5.5));

    if (speed > 1e-5) this._direction.copy(this._velocity).normalize();
    const referenceUp = Math.abs(this._direction.dot(UP)) > 0.94 ? RIGHT : UP;
    this._side.crossVectors(this._direction, referenceUp).normalize();
    this._binormal.crossVectors(this._side, this._direction).normalize();

    this._ambientMaterial.uniforms.uTime.value = this._time;
    this._trailMaterial.uniforms.uTime.value = this._time;
    this._updateAmbientParticles(dt);
    this._updateTrailParticles(dt, speed, speedRatio);
    this._previousPosition.copy(this._dragonPosition);
    return this;
  }

  setPixelRatio(pixelRatio) {
    const value = Math.min(2, Math.max(0.5, Number.isFinite(pixelRatio) ? pixelRatio : 1));
    this._ambientMaterial.uniforms.uPixelRatio.value = value;
    this._trailMaterial.uniforms.uPixelRatio.value = value;
    return this;
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
    return this;
  }

  clearTrail() {
    this._trailAge.fill(0);
    this._trailLife.fill(0);
    this._trailGeometry.attributes.aOpacity.array.fill(0);
    this._trailGeometry.attributes.aOpacity.needsUpdate = true;
    this._spawnAccumulator = 0;
    return this;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.group.removeFromParent();
    this._ambientGeometry.dispose();
    this._trailGeometry.dispose();
    this._ambientMaterial.dispose();
    this._trailMaterial.dispose();
  }
}

export default DragonMistSystem;
