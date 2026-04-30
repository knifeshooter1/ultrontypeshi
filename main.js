import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import gsap from 'gsap';

// SCENE SETUP
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x020202, 0.05);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// LIGHTING - Cinematic Red & Chrome highlights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// Primary Red Light (Underglow/Core)
const redLight = new THREE.PointLight(0xff003c, 5, 10);
redLight.position.set(0, -1, 1);
scene.add(redLight);

// Rim Light 1 (Cyan/White cool contrast)
const rimLight1 = new THREE.SpotLight(0x88ccff, 3);
rimLight1.position.set(5, 5, -5);
rimLight1.lookAt(0, 0, 0);
rimLight1.penumbra = 1;
scene.add(rimLight1);

// Rim Light 2 (Deep Red)
const rimLight2 = new THREE.SpotLight(0xff0000, 4);
rimLight2.position.set(-5, 2, -3);
rimLight2.lookAt(0, 0, 0);
rimLight2.penumbra = 1;
scene.add(rimLight2);

// Fill Light (Soft White)
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(0, 2, 5);
scene.add(fillLight);

// LOAD MODEL
let model;
let mixer;

const loadingManager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(loadingManager);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(dracoLoader);

// Using a basic HDR generation trick
const envScene = new THREE.Scene();
const envCamera = new THREE.CubeCamera(0.1, 100, new THREE.WebGLCubeRenderTarget(256));
const envLight1 = new THREE.PointLight(0xffffff, 10);
envLight1.position.set(10, 10, 10);
envScene.add(envLight1);
const envLight2 = new THREE.PointLight(0xff003c, 20);
envLight2.position.set(-10, -10, -10);
envScene.add(envLight2);
envCamera.update(renderer, envScene);
scene.environment = envCamera.renderTarget.texture;

gltfLoader.load('/Hitem3d-1777529944927.glb', (gltf) => {
    model = gltf.scene;
    
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    
    const group = new THREE.Group();
    group.add(model);
    scene.add(group);
    
    group.scale.set(1.5, 1.5, 1.5);
    group.position.set(1.5, -0.5, 0); // Offset to the right

    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
                child.material.envMapIntensity = 1.5;
                child.material.needsUpdate = true;
                
                if (child.material.emissive && child.material.emissive.r > 0) {
                    child.material.emissiveIntensity = 2;
                }
            }
        }
    });

    if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
    }

    setupScrollAnimations(group);
    
}, undefined, (error) => {
    console.error('An error happened', error);
});


// Particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 500;
const posArray = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 15;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({
    size: 0.02,
    color: 0xff003c,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// RESIZE HANDLER
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// MOUSE MOVEMENT
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

// SCROLL ANIMATIONS
function setupScrollAnimations(modelGroup) {
    const panels = document.querySelectorAll('.panel');
    const content = document.querySelector('.content');

    content.addEventListener('scroll', () => {
        const scrollPosition = content.scrollTop;
        const windowHeight = window.innerHeight;
        
        panels.forEach((panel, index) => {
            const panelTop = index * windowHeight;
            if (scrollPosition >= panelTop - windowHeight / 2 && scrollPosition < panelTop + windowHeight / 2) {
                if(!panel.classList.contains('active')) {
                    panel.classList.add('active');
                    updateNav(index);
                }
            } else {
                panel.classList.remove('active');
            }
        });
    });

    panels[0].classList.add('active');
    
    // We can calculate actual scroll bounds
    content.addEventListener('scroll', () => {
        // Approximate total scrollable height for 5 panels
        const totalScroll = window.innerHeight * 4; 
        let progress = content.scrollTop / totalScroll;
        // Clamp progress
        progress = Math.max(0, Math.min(1, progress));
        
        if (progress < 0.25) {
            const p = progress / 0.25;
            gsap.to(modelGroup.position, {
                x: 1.5 - (p * 3), // Move from right to left
                y: -0.5,
                z: p * 1,
                duration: 0.5,
                ease: "power2.out",
                overwrite: "auto"
            });
            gsap.to(modelGroup.rotation, {
                y: p * Math.PI / 4,
                duration: 0.5,
                overwrite: "auto"
            });
        }
        else if (progress < 0.5) {
            const p = (progress - 0.25) / 0.25;
            gsap.to(modelGroup.position, {
                x: -1.5 + (p * 1.5), // Center
                y: -0.5 - (p * 0.5), // slightly down
                z: 1 - (p * 0.5),
                duration: 0.5,
                ease: "power2.out",
                overwrite: "auto"
            });
            gsap.to(modelGroup.rotation, {
                x: p * 0.2,
                y: (Math.PI / 4) - (p * Math.PI / 4),
                duration: 0.5,
                overwrite: "auto"
            });
        }
        else if (progress < 0.75) {
            const p = (progress - 0.5) / 0.25;
            gsap.to(modelGroup.position, {
                x: 0 + (p * 1.5), // Right
                y: -1.0 + (p * 0.5),
                z: 0.5 + (p * 1.5), // Closer
                duration: 0.5,
                ease: "power2.out",
                overwrite: "auto"
            });
            gsap.to(modelGroup.rotation, {
                y: -p * Math.PI / 6,
                duration: 0.5,
                overwrite: "auto"
            });
        }
        else {
            const p = (progress - 0.75) / 0.25;
            gsap.to(modelGroup.position, {
                x: 1.5 - (p * 1.5), // Center
                y: -0.5,
                z: 2 - (p * 1), // Step back
                duration: 0.5,
                ease: "power2.out",
                overwrite: "auto"
            });
            gsap.to(modelGroup.rotation, {
                x: 0,
                y: (-Math.PI / 6) + (p * Math.PI / 6),
                duration: 0.5,
                overwrite: "auto"
            });
        }
    });

    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            content.scrollTo({
                top: index * window.innerHeight,
                behavior: 'smooth'
            });
        });
    });
}

function updateNav(index) {
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => link.classList.remove('active'));
    if(navLinks[index]) {
        navLinks[index].classList.add('active');
    }
}

// ANIMATION LOOP
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    if (mixer) mixer.update(delta);

    // Subtle breathing/idle animation
    if (model && !mixer) {
        // Find group to not overwrite the GSAP position animations
        model.position.y = Math.sin(elapsedTime * 1.5) * 0.05;
    }

    particlesMesh.rotation.y = elapsedTime * 0.02;
    particlesMesh.rotation.x = elapsedTime * 0.01;

    // Mouse parallax
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (-targetY - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    // Dynamic light pulsing
    redLight.intensity = 5 + Math.sin(elapsedTime * 2) * 1.5;

    renderer.render(scene, camera);
}

animate();
