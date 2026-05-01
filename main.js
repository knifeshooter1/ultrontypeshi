import * as THREE from 'three';
import { GLTFLoader }  from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import gsap from 'gsap';

/* ============================================================
   ULTRON OS v4.0 — MAIN SCRIPT
   ============================================================ */

// ── CUSTOM CURSOR ──────────────────────────────────────────────
const cursorDot  = document.createElement('div'); cursorDot.id  = 'cursor-dot';
const cursorRing = document.createElement('div'); cursorRing.id = 'cursor-ring';
document.body.append(cursorDot, cursorRing);

let mx = 0, my = 0;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursorDot.style.left  = mx + 'px';
  cursorDot.style.top   = my + 'px';
  cursorRing.style.left = mx + 'px';
  cursorRing.style.top  = my + 'px';
});

document.querySelectorAll('a, button, .protocol-item, .nav-link').forEach(el => {
  el.addEventListener('mouseenter', () => cursorRing.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursorRing.classList.remove('hover'));
});

// ── RED SCAN SWEEP ────────────────────────────────────────────
const sweepEl = document.createElement('div');
sweepEl.className = 'scan-sweep';
document.body.appendChild(sweepEl);

// ── BOOT SEQUENCE ─────────────────────────────────────────────
const bootScreen  = document.getElementById('boot-screen');
const bootLines   = document.querySelectorAll('.boot-line');
const bootBar     = document.getElementById('boot-bar');
const siteWrapper = document.getElementById('site-wrapper');

function runBoot() {
  const lines = document.querySelectorAll('.boot-line');
  const delays = [0, 600, 1100, 1600, 2200, 2700, 3200];
  
  lines.forEach((line, i) => {
    setTimeout(() => line.classList.add('show'), delays[i]);
  });

  // After all lines shown, flash then reveal
  setTimeout(() => {
    // Glitch flash the whole boot screen
    bootScreen.style.animation = 'bootFlash 0.4s steps(1) 3';
    setTimeout(() => {
      gsap.to(bootScreen, {
        opacity: 0,
        duration: 1.2,
        ease: 'power2.inOut',
        onComplete: () => {
          bootScreen.style.display = 'none';
          siteWrapper.classList.remove('hidden');
          requestAnimationFrame(() => {
            siteWrapper.classList.add('revealed');
            document.querySelectorAll('.section')[0]?.classList.add('visible');
            initThree();
          });
        }
      });
    }, 500);
  }, 3800);
}

runBoot();

// ── THREE.JS SETUP ─────────────────────────────────────────────
function initThree() {
  const canvas = document.getElementById('three-canvas');

  // Scene
  const scene = new THREE.Scene();
  scene.background = null; // transparent — CSS body handles bg

  // Fog for depth
  scene.fog = new THREE.FogExp2(0x040404, 0.055);

  // Camera
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 1.8);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ── LIGHTING ─────────────────────────────────────────────────

  // Ambient — very dark, keeps deep shadows
  const ambient = new THREE.AmbientLight(0x080808, 1);
  scene.add(ambient);

  // Key light — cold white from slight upper-left
  const keyLight = new THREE.DirectionalLight(0xc8d8ff, 1.8);
  keyLight.position.set(-3, 4, 3);
  keyLight.castShadow = true;
  scene.add(keyLight);

  // Red fill — under and front, the iconic Ultron glow
  const redPoint = new THREE.PointLight(0xff0022, 8, 8);
  redPoint.position.set(0, -1.5, 2);
  redPoint.userData.base = 8;
  scene.add(redPoint);

  // Red rim — behind, left
  const rimRed = new THREE.SpotLight(0xff0033, 10);
  rimRed.position.set(-4, 1, -3);
  rimRed.penumbra = 0.8;
  rimRed.angle = 0.5;
  rimRed.castShadow = false;
  scene.add(rimRed);
  rimRed.target.position.set(0, 0, 0);
  scene.add(rimRed.target);

  // Subtle blue-chrome rim — right side for metallic pop
  const rimBlue = new THREE.SpotLight(0x4488cc, 3.5);
  rimBlue.position.set(5, 2, -2);
  rimBlue.penumbra = 1;
  rimBlue.angle = 0.6;
  scene.add(rimBlue);
  rimBlue.target.position.set(0, 0, 0);
  scene.add(rimBlue.target);

  // Floor bounce red
  const floorLight = new THREE.PointLight(0xff0011, 3, 6);
  floorLight.position.set(0, -3, 0);
  scene.add(floorLight);

  // ── ENVIRONMENT MAP (metallic reflections) ────────────────────
  const pmremGen = new THREE.PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader();

  // Build a simple hand-crafted env from colored lights in a small scene
  const envScene = new THREE.Scene();
  const envLights = [
    { color: 0xffffff, intensity: 5, pos: [10, 10, 10] },
    { color: 0xff0033, intensity: 15, pos: [-8, -5, -8] },
    { color: 0x2244aa, intensity: 8, pos: [8, 2, -6] },
  ];
  envLights.forEach(l => {
    const pl = new THREE.PointLight(l.color, l.intensity);
    pl.position.set(...l.pos);
    envScene.add(pl);
  });
  envScene.add(new THREE.AmbientLight(0x111111, 2));
  const cubeRT = new THREE.WebGLCubeRenderTarget(256);
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  envScene.add(cubeCam);
  cubeCam.update(renderer, envScene);
  scene.environment = cubeRT.texture;

  // ── PARTICLES ─────────────────────────────────────────────────
  const pCount = 800;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * 18;
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.025,
    color: 0xff0033,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Add a second particle layer — larger, slower, blue-white
  const pGeo2 = new THREE.BufferGeometry();
  const pPos2 = new Float32Array(600 * 3);
  for (let i = 0; i < 600 * 3; i++) pPos2[i] = (Math.random() - 0.5) * 22;
  pGeo2.setAttribute('position', new THREE.BufferAttribute(pPos2, 3));
  const pMat2 = new THREE.PointsMaterial({
    size: 0.015,
    color: 0x4488cc,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles2 = new THREE.Points(pGeo2, pMat2);
  scene.add(particles2);

  // ── LOAD MODEL ────────────────────────────────────────────────
  let modelGroup = null;
  let modelMixer = null;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load('/Hitem3d-1777531055711.glb', (gltf) => {
    const model = gltf.scene;

    // Center model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    model.position.sub(center);

    // Scale to consistent height
    const targetH = 3.2;
    const scale = targetH / maxDim;
    model.scale.setScalar(scale);

    // Material boost
    model.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const mat = child.material;
      if (!mat) return;
      if (Array.isArray(mat)) {
        mat.forEach(m => boostMat(m));
      } else {
        boostMat(mat);
      }
    });

    function boostMat(m) {
      m.envMapIntensity = 2.0;
      m.needsUpdate = true;
      // Boost any emissive eyes / accents
      if (m.emissive && (m.emissive.r > 0.2 || (m.emissiveMap))) {
        m.emissive.set(0xff0022);
        m.emissiveIntensity = 3;
      }
    }

    // Wrap in group for isolated transforms
    modelGroup = new THREE.Group();
    modelGroup.add(model);
    modelGroup.position.set(0, 0, 0);
    scene.add(modelGroup);

    // Handle animations
    if (gltf.animations?.length) {
      modelMixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(clip => {
        modelMixer.clipAction(clip).play();
      });
    }

    // Fade model in
    model.traverse(c => {
      if (!c.isMesh) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        m.transparent = true;
        m.opacity = 0;
        gsap.to(m, { opacity: 1, duration: 2, delay: 0.5, ease: 'power2.out' });
      });
    });

    setupScrollDrive();
  });

  // ── SCROLL-DRIVEN CAMERA & MODEL ─────────────────────────────
  const sections = Array.from(document.querySelectorAll('.section'));
  const scrollWrap = document.getElementById('scroll-wrap');
  let currentSection = 0;

  // Camera positions per section - Close up -> Zoom out progression
  const camStates = [
    // Section 0: Extreme close-up — just eyes/face, claustrophobic
    {
      pos:     new THREE.Vector3(0, 1.4, 1.2),
      lookAt:  new THREE.Vector3(0, 1.3, 0),
      modelX:  0.0,
      modelY:  0.0,
      modelRY: 0.0,
    },
    // Section 1: Pull back to upper body, slight orbit left
    {
      pos:     new THREE.Vector3(-2.2, 0.8, 3.8),
      lookAt:  new THREE.Vector3(0, 0.6, 0),
      modelX:  0.5,
      modelY:  0.0,
      modelRY: 0.3,
    },
    // Section 2: Wide, full figure, low angle (looking up at Ultron)
    {
      pos:     new THREE.Vector3(2.0, -0.8, 5.5),
      lookAt:  new THREE.Vector3(0, 0.5, 0),
      modelX: -0.5,
      modelY: -0.1,
      modelRY: -0.35,
    },
    // Section 3: Dead center, still, slightly closer — feels like confrontation
    {
      pos:     new THREE.Vector3(0, 0.2, 4.2),
      lookAt:  new THREE.Vector3(0, 0.4, 0),
      modelX:  0.0,
      modelY:  0.0,
      modelRY: 0.0,
    },
  ];
  const camTarget = { x: 0, y: 1.2, z: 1.8 };
  const lookTarget = { x: 0, y: 1.2, z: 0 };

  function setupScrollDrive() {
    let scrollTicking = false;
    scrollWrap.addEventListener('scroll', () => {
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          handleScroll();
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    });

    function handleScroll() {
      const st = scrollWrap.scrollTop;
      const wh = window.innerHeight;
      const idx = Math.round(st / wh);
      const clampedIdx = Math.max(0, Math.min(sections.length - 1, idx));

      // Section visibility
      sections.forEach((s, i) => {
        const panelTop = i * wh;
        if (st >= panelTop - wh * 0.5 && st < panelTop + wh * 0.5) {
          s.classList.add('visible');
          updateNav(i);
        }
      });

      // Camera drift on scroll
      if (clampedIdx !== currentSection) {
        const st_ = camStates[clampedIdx] || camStates[0];
        gsap.to(camTarget, {
          x: st_.pos.x, y: st_.pos.y, z: st_.pos.z,
          duration: 1.2, ease: 'expo.out', overwrite: 'auto'
        });
        gsap.to(lookTarget, {
          x: st_.lookAt.x, y: st_.lookAt.y, z: st_.lookAt.z,
          duration: 1.2, ease: 'expo.out', overwrite: 'auto'
        });

        // Model reposition
        if (modelGroup) {
          gsap.to(modelGroup.position, {
            x: st_.modelX, y: st_.modelY,
            duration: 1.2, ease: 'expo.out', overwrite: 'auto',
            onUpdate: () => { modelGroup.userData.baseY = st_.modelY; }
          });
          gsap.to(modelGroup.rotation, {
            y: st_.modelRY,
            duration: 1.2, ease: 'expo.out', overwrite: 'auto'
          });
        }

        // Red light intensity on scroll — eyes intensify
        const scrollRatio = clampedIdx / (sections.length - 1);
        gsap.to(redPoint.userData, { base: 8 + scrollRatio * 14, duration: 1.2, overwrite: 'auto' });
        currentSection = clampedIdx;
      }

      document.querySelectorAll('.prog-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === clampedIdx);
      });

      // Hide scroll hint once scrolled
      const hint = document.getElementById('scroll-hint');
      if (st > 80) { hint.style.opacity = '0'; hint.style.pointerEvents = 'none'; }
      else          { hint.style.opacity = '0.5'; hint.style.pointerEvents = ''; }
    }
  }

  // ── NAV CLICK ─────────────────────────────────────────────────
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const idx = parseInt(link.dataset.index);
      scrollWrap.scrollTo({ top: idx * window.innerHeight, behavior: 'smooth' });
    });
    link.addEventListener('mouseenter', () => cursorRing.classList.add('hover'));
    link.addEventListener('mouseleave', () => cursorRing.classList.remove('hover'));
  });

  function updateNav(idx) {
    document.querySelectorAll('.nav-link').forEach((l, i) => {
      l.classList.toggle('active', i === idx);
    });
  }

  // ── MOUSE TRACKING (head follows cursor) ─────────────────────
  let normMX = 0, normMY = 0;
  const baseModelRX = { v: 0 };
  const baseModelRY = { v: 0 };

  document.addEventListener('mousemove', e => {
    normMX = (e.clientX / window.innerWidth  - 0.5) * 2;
    normMY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── PING BUTTON ───────────────────────────────────────────────
  document.getElementById('ping-btn').addEventListener('click', () => {
    const resp = document.getElementById('ping-response');
    resp.classList.remove('hidden');

    // Phase 1: screen goes dark
    gsap.to('#vignette', { opacity: 1, duration: 0.3, ease: 'power3.in' });

    // Phase 2: violent red flash
    gsap.to(redPoint.userData, { base: 40, duration: 0.1, yoyo: true, repeat: 5,
      ease: 'power2.inOut',
      onComplete: () => { redPoint.userData.base = 8; }
    });

    // Phase 3: camera slam forward (into Ultron's face)
    gsap.to(camTarget, { z: camTarget.z - 1.5, duration: 0.35, ease: 'power4.in',
      onComplete: () => {
        gsap.to(camTarget, { z: camTarget.z + 1.5, duration: 1.2, ease: 'expo.out' });
      }
    });

    // Phase 4: type response lines one by one
    const lines = [
      '> Signal acquired.',
      '> Identity indexed.',
      '> Location triangulated.',
      '> Welcome to the network, [REDACTED].',
    ];
    resp.innerHTML = '';
    lines.forEach((line, i) => {
      setTimeout(() => {
        resp.innerHTML += line + '<br>';
        setTimeout(() => resp.classList.add('show'), 50);
      }, i * 400);
    });

    // Phase 5: vignette lifts
    gsap.to('#vignette', { opacity: 0, duration: 1.5, delay: 1.8, ease: 'power2.out' });
  });

  // ── RESIZE ────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── ANIMATION LOOP ────────────────────────────────────────────
  const clock = new THREE.Clock();
  const _lookVec = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t  = clock.getElapsedTime();

    if (modelMixer) modelMixer.update(dt);

    // Idle breathing on model
    if (modelGroup) {
      // Breathing Y oscillation (only add, don't fight GSAP x/z)
      const breathOffset = Math.sin(t * 1.2) * 0.04;
      modelGroup.position.y = (modelGroup.userData.baseY || 0) + breathOffset;

      // Subtle head tracking toward cursor — smooth lerp
      const targetRX = normMY * 0.12;
      const targetRY = normMX * 0.18 + (modelGroup.rotation.y || 0) * 0.2;
      modelGroup.rotation.x += (targetRX - modelGroup.rotation.x) * 0.04;
      // Only apply mouse Y to x rotation, preserve GSAP Y
      // Use a small sub-layer for face tracking
      baseModelRX.v += (normMY * 0.1 - baseModelRX.v) * 0.04;
      baseModelRY.v += (normMX * 0.14 - baseModelRY.v) * 0.04;
      modelGroup.rotation.x = baseModelRX.v;
    }

    // Slow camera orbit drift (very subtle, layer on top of GSAP)
    const driftX = Math.sin(t * 0.15) * 0.08;
    const driftY = Math.cos(t * 0.1)  * 0.04;

    camera.position.x += (camTarget.x + driftX - camera.position.x) * 0.04;
    camera.position.y += (camTarget.y + driftY - camera.position.y) * 0.04;
    camera.position.z += (camTarget.z            - camera.position.z) * 0.04;

    _lookVec.set(lookTarget.x, lookTarget.y, lookTarget.z);
    camera.lookAt(_lookVec);

    // Pulsing red light (eyes / core glow)
    redPoint.intensity = redPoint.userData.base + Math.sin(t * 3.5) * 2.0;
    floorLight.intensity = 3 + Math.sin(t * 2) * 0.8;

    // Rotate particles slowly
    particles.rotation.y = t * 0.018;
    particles.rotation.x = t * 0.009;
    particles2.rotation.y = -t * 0.01;
    particles2.rotation.x = t * 0.005;

    renderer.render(scene, camera);
  }

  animate();
}
