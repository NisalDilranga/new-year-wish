import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

// ===========================================
// PERFORMANCE DETECTION & QUALITY SETTINGS
// ===========================================
interface QualitySettings {
  particleMultiplier: number;
  trailLength: number;
  maxFireworks: number;
  starCount: number;
  enableGlow: boolean;
  enableTrails: boolean;
  fireworkParticles: number;
  spawnRate: number;
  textCurveSegments: number;
  textBevelSegments: number;
}

const QUALITY_PRESETS: Record<string, QualitySettings> = {
  low: {
    particleMultiplier: 0.25,
    trailLength: 3,
    maxFireworks: 4,
    starCount: 30,
    enableGlow: false,
    enableTrails: false,
    fireworkParticles: 80,
    spawnRate: 0.015,
    textCurveSegments: 6,
    textBevelSegments: 2,
  },
  medium: {
    particleMultiplier: 0.5,
    trailLength: 5,
    maxFireworks: 6,
    starCount: 50,
    enableGlow: false,
    enableTrails: true,
    fireworkParticles: 150,
    spawnRate: 0.025,
    textCurveSegments: 10,
    textBevelSegments: 4,
  },
  high: {
    particleMultiplier: 1,
    trailLength: 8,
    maxFireworks: 15,
    starCount: 100,
    enableGlow: true,
    enableTrails: true,
    fireworkParticles: 400,
    spawnRate: 0.05,
    textCurveSegments: 20,
    textBevelSegments: 8,
  },
};

function detectQuality(): QualitySettings {
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  // Check for low-end device indicators
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  const isLowMemory =
    (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const isSmallScreen = window.innerWidth < 480 || window.innerHeight < 480;
  const isLowEndGPU = gl ? false : true; // No WebGL = definitely low end

  // Score system: lower = worse device
  let score = 0;
  if (!isMobile) score += 3;
  if (!isLowMemory) score += 2;
  if (hardwareConcurrency >= 4) score += 2;
  if (hardwareConcurrency >= 8) score += 1;
  if (!isSmallScreen) score += 1;
  if (!isLowEndGPU) score += 1;

  console.log(
    `Device score: ${score}, Mobile: ${isMobile}, Cores: ${hardwareConcurrency}`
  );

  if (score <= 3 || (isMobile && isSmallScreen)) {
    console.log("Using LOW quality preset");
    return QUALITY_PRESETS.low;
  } else if (score <= 6 || isMobile) {
    console.log("Using MEDIUM quality preset");
    return QUALITY_PRESETS.medium;
  } else {
    console.log("Using HIGH quality preset");
    return QUALITY_PRESETS.high;
  }
}

const qualitySettings = detectQuality();

// ===========================================
// SOUND EFFECTS SYSTEM
// ===========================================
class SoundManager {
  private fireworkAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.5;
  private initialized = false;

  init() {
    if (this.initialized) return;
    try {
      // Load the firework audio file
      this.fireworkAudio = new Audio("/audio/fireworks-09-419028.mp3");
      this.fireworkAudio.volume = this.masterVolume;
      this.fireworkAudio.loop = true;

      // Initialize Web Audio API for boom sound
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      this.initialized = true;
    } catch (e) {
      console.warn("Audio not supported");
    }
  }

  // Start playing firework audio (loops continuously)
  playFireworkAudio() {
    if (!this.fireworkAudio || this.masterVolume === 0) return;
    this.fireworkAudio.currentTime = 0;
    this.fireworkAudio.volume = this.masterVolume;
    this.fireworkAudio.play().catch(() => {
      // Audio play failed, likely due to autoplay policy
    });
  }

  // Stop firework audio
  stopFireworkAudio() {
    if (!this.fireworkAudio) return;
    this.fireworkAudio.pause();
    this.fireworkAudio.currentTime = 0;
  }

  // These methods kept for compatibility
  playLaunch() {
    // Not used
  }

  // Generate explosion/boom sound
  playExplosion(isGrand = false) {
    if (!this.audioContext || this.masterVolume === 0) return;

    const duration = isGrand ? 0.8 : 0.5;
    const volume = isGrand ? 0.4 : 0.25;

    // Create noise buffer for explosion
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(
      1,
      bufferSize,
      this.audioContext.sampleRate
    );
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // Low-pass filter for bassy explosion
    const filter = this.audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(
      100,
      this.audioContext.currentTime + duration
    );

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(
      volume * this.masterVolume,
      this.audioContext.currentTime
    );
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration
    );

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    noise.start();
    noise.stop(this.audioContext.currentTime + duration);
  }

  playSparkle() {
    // Not used
  }

  playChime() {
    // Not used
  }

  setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.fireworkAudio) {
      this.fireworkAudio.volume = this.masterVolume;
    }
  }

  mute() {
    this.masterVolume = 0;
    if (this.fireworkAudio) {
      this.fireworkAudio.volume = 0;
    }
  }

  unmute() {
    this.masterVolume = 0.5;
    if (this.fireworkAudio) {
      this.fireworkAudio.volume = this.masterVolume;
    }
  }

  isMuted(): boolean {
    return this.masterVolume === 0;
  }
}

const soundManager = new SoundManager();

// Sound toggle button
const soundToggle = document.getElementById("soundToggle") as HTMLButtonElement;
let isSoundMuted = false;

function updateSoundButton() {
  if (soundToggle) {
    soundToggle.textContent = isSoundMuted ? "🔇" : "🔊";
    soundToggle.classList.toggle("muted", isSoundMuted);
  }
}

if (soundToggle) {
  soundToggle.addEventListener("click", () => {
    isSoundMuted = !isSoundMuted;
    if (isSoundMuted) {
      soundManager.mute();
      soundManager.stopFireworkAudio();
    } else {
      soundManager.unmute();
      soundManager.playFireworkAudio();
    }
    updateSoundButton();
  });
}

// ===========================================
// FIREWORK LOADER ANIMATION
// ===========================================
const loaderCanvas = document.getElementById(
  "loaderCanvas"
) as HTMLCanvasElement;
const loaderScreen = document.getElementById("loader") as HTMLElement;
const tapText = document.querySelector(".tap-text") as HTMLElement;

interface LoaderParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
}

interface LoaderFirework {
  x: number;
  y: number;
  targetY: number;
  vy: number;
  exploded: boolean;
  color: string;
  particles: LoaderParticle[];
  isGrand?: boolean;
}

let loaderCtx: CanvasRenderingContext2D | null = null;
let loaderFireworks: LoaderFirework[] = [];
let starParticles: LoaderParticle[] = [];
let loaderAnimationId: number;
let showStarted = false;
let mainSceneReady = false;

// Firework colors
const fireworkColors = [
  ["#ff0000", "#ff4444", "#ff8888"], // Red
  ["#ffd700", "#ffed4a", "#fff68f"], // Gold
  ["#00ff88", "#44ffaa", "#88ffcc"], // Green
  ["#00bfff", "#44d4ff", "#88e8ff"], // Cyan
  ["#ff00ff", "#ff44ff", "#ff88ff"], // Magenta
  ["#ff6b35", "#ff8c5a", "#ffad7f"], // Orange
  ["#ffffff", "#f0f0ff", "#e0e0ff"], // White
];

function initLoader() {
  if (!loaderCanvas) return;

  loaderCtx = loaderCanvas.getContext("2d", { alpha: false });
  if (!loaderCtx) return;

  // Set initial canvas size
  resizeLoaderCanvas();

  // Create twinkling stars background - use quality settings
  const starCount = qualitySettings.starCount;
  for (let i = 0; i < starCount; i++) {
    starParticles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: 0,
      vy: 0,
      life: Math.random(),
      color: "#ffffff",
      size: Math.random() * 2 + 0.5,
      trail: [],
    });
  }

  animateLoader();

  // Click/touch to start firework show
  loaderScreen.addEventListener("click", startFireworkShow);
  loaderScreen.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      startFireworkShow();
    },
    { passive: false }
  );
}

function resizeLoaderCanvas() {
  if (!loaderCanvas) return;

  const width = Math.max(
    window.innerWidth,
    document.documentElement.clientWidth
  );
  const height = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight
  );
  // Limit pixel ratio more aggressively on mobile for performance
  const dpr =
    qualitySettings === QUALITY_PRESETS.low
      ? 1
      : Math.min(window.devicePixelRatio || 1, 1.5);

  // Set display size
  loaderCanvas.style.width = width + "px";
  loaderCanvas.style.height = height + "px";

  // Set actual size in memory
  loaderCanvas.width = Math.floor(width * dpr);
  loaderCanvas.height = Math.floor(height * dpr);

  // Scale context to match
  if (loaderCtx) {
    loaderCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// Get scale factor for mobile
function getMobileScale(): number {
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  if (minDim < 400) return 0.5;
  if (minDim < 600) return 0.65;
  if (minDim < 800) return 0.8;
  return 1;
}

function createFirework(
  x?: number,
  y?: number,
  isGrand = false
): LoaderFirework {
  const colorSet =
    fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
  const scale = getMobileScale();

  // Play launch sound
  soundManager.playLaunch();

  return {
    x: x ?? Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1,
    y: y ?? window.innerHeight + 20,
    targetY:
      Math.random() * (window.innerHeight * 0.35) + window.innerHeight * 0.15,
    vy: (-18 - Math.random() * 8) * scale,
    exploded: false,
    color: colorSet[0],
    particles: [],
    isGrand,
  };
}

function explodeFirework(fw: LoaderFirework) {
  const scale = getMobileScale();
  const particleCount = Math.floor(
    (fw.isGrand ? 150 : 100) * qualitySettings.particleMultiplier
  );
  const colorSet =
    fireworkColors[Math.floor(Math.random() * fireworkColors.length)];

  // Play explosion sound
  soundManager.playExplosion(fw.isGrand);

  // Main burst - circular pattern
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount;
    const speed = (Math.random() * 6 + 4) * (fw.isGrand ? 1.5 : 1) * scale;
    const colorIndex = Math.floor(Math.random() * colorSet.length);

    fw.particles.push({
      x: fw.x,
      y: fw.y,
      vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
      vy: Math.sin(angle) * speed * (0.8 + Math.random() * 0.4),
      life: 1,
      color: colorSet[colorIndex],
      size: (Math.random() * 3 + 2) * scale,
      trail: [],
    });
  }

  // Inner sparkle burst - reduced for performance
  const sparkleCount = Math.floor(40 * qualitySettings.particleMultiplier);
  for (let i = 0; i < sparkleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 10 + 8) * scale;

    fw.particles.push({
      x: fw.x,
      y: fw.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: "#ffffff",
      size: (Math.random() * 2 + 1) * scale,
      trail: [],
    });
  }

  // Crackle effect - only on high quality and grand fireworks
  if (fw.isGrand && qualitySettings.enableGlow) {
    const crackleCount = Math.floor(30 * qualitySettings.particleMultiplier);
    for (let i = 0; i < crackleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 3 + 1) * scale;

      fw.particles.push({
        x: fw.x + (Math.random() - 0.5) * 50 * scale,
        y: fw.y + (Math.random() - 0.5) * 50 * scale,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7,
        color: "#ffd700",
        size: (Math.random() * 2 + 1) * scale,
        trail: [],
      });
    }
  }

  fw.exploded = true;
}

function animateLoader() {
  if (!loaderCtx || !loaderCanvas) return;

  // Clear with trail effect
  loaderCtx.fillStyle = "rgba(10, 10, 32, 0.25)";
  loaderCtx.fillRect(0, 0, loaderCanvas.width, loaderCanvas.height);

  // Draw twinkling stars - simplified
  for (const star of starParticles) {
    star.life += (Math.random() - 0.5) * 0.1;
    star.life = Math.max(0.2, Math.min(1, star.life));

    loaderCtx.beginPath();
    loaderCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    loaderCtx.fillStyle = `rgba(255, 255, 255, ${star.life * 0.8})`;
    loaderCtx.fill();
  }

  // Update and draw fireworks
  for (let i = loaderFireworks.length - 1; i >= 0; i--) {
    const fw = loaderFireworks[i];

    if (!fw.exploded) {
      // Rising rocket
      fw.y += fw.vy;
      fw.vy += 0.4;

      // Simplified rocket glow - no gradient on low quality
      if (qualitySettings.enableGlow) {
        const gradient = loaderCtx.createRadialGradient(
          fw.x,
          fw.y,
          0,
          fw.x,
          fw.y,
          15
        );
        gradient.addColorStop(0, fw.color);
        gradient.addColorStop(0.5, fw.color + "88");
        gradient.addColorStop(1, "transparent");

        loaderCtx.beginPath();
        loaderCtx.arc(fw.x, fw.y, 15, 0, Math.PI * 2);
        loaderCtx.fillStyle = gradient;
        loaderCtx.fill();
      }

      // Rocket core
      loaderCtx.beginPath();
      loaderCtx.arc(fw.x, fw.y, 4, 0, Math.PI * 2);
      loaderCtx.fillStyle = fw.color;
      loaderCtx.fill();

      // Rocket trail sparks - reduced count
      const sparkCount = qualitySettings.enableGlow ? 4 : 2;
      for (let j = 0; j < sparkCount; j++) {
        const sparkX = fw.x + (Math.random() - 0.5) * 8;
        const sparkY = fw.y + Math.random() * 25 + 5;
        const sparkSize = Math.random() * 2 + 1;

        loaderCtx.beginPath();
        loaderCtx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
        loaderCtx.fillStyle = `hsl(${40 + Math.random() * 20}, 100%, ${
          60 + Math.random() * 30
        }%)`;
        loaderCtx.fill();
      }

      // Check explosion
      if (fw.y <= fw.targetY || fw.vy >= 0) {
        explodeFirework(fw);
      }
    } else {
      // Explosion particles
      let allDead = true;

      for (const p of fw.particles) {
        if (p.life > 0) {
          allDead = false;

          // Trail - only if enabled and limited length
          if (qualitySettings.enableTrails) {
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > qualitySettings.trailLength) p.trail.shift();
          }

          // Physics
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.life -= 0.018; // Slightly faster decay

          // Draw trail - only if enabled
          if (qualitySettings.enableTrails && p.trail.length > 1) {
            loaderCtx.beginPath();
            loaderCtx.moveTo(p.trail[0].x, p.trail[0].y);
            for (let t = 1; t < p.trail.length; t++) {
              loaderCtx.lineTo(p.trail[t].x, p.trail[t].y);
            }
            loaderCtx.strokeStyle = p.color;
            loaderCtx.globalAlpha = p.life * 0.3;
            loaderCtx.lineWidth = p.size * 0.5;
            loaderCtx.stroke();
            loaderCtx.globalAlpha = 1;
          }

          // Draw particle - simplified (no shadow blur for performance)
          loaderCtx.beginPath();
          loaderCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          loaderCtx.fillStyle = p.color;
          loaderCtx.globalAlpha = p.life;
          loaderCtx.fill();
          loaderCtx.globalAlpha = 1;
        }
      }

      if (allDead) {
        loaderFireworks.splice(i, 1);
      }
    }
  }

  loaderAnimationId = requestAnimationFrame(animateLoader);
}

function startFireworkShow() {
  if (showStarted) return;
  showStarted = true;

  // Initialize sound on user interaction (required by browsers)
  soundManager.init();

  // Start playing the firework audio
  soundManager.playFireworkAudio();

  // Show sound toggle button
  if (soundToggle) {
    soundToggle.classList.add("visible");
  }

  // Hide tap text
  if (tapText) tapText.classList.add("hidden");

  const scale = getMobileScale();

  // Phase 1: Initial burst (0-1s) - reduced count
  const phase1Count = Math.max(
    2,
    Math.floor(5 * qualitySettings.particleMultiplier)
  );
  for (let i = 0; i < phase1Count; i++) {
    setTimeout(() => {
      loaderFireworks.push(createFirework());
    }, i * 200);
  }

  // Phase 2: Building up (1-2.5s) - reduced count
  const phase2Count = Math.max(
    3,
    Math.floor(8 * qualitySettings.particleMultiplier)
  );
  for (let i = 0; i < phase2Count; i++) {
    setTimeout(() => {
      loaderFireworks.push(createFirework());
    }, 1000 + i * 200);
  }

  // Phase 3: Grand Finale (2.5-4s) - reduced for mobile
  setTimeout(() => {
    // Center burst
    const centerX = window.innerWidth / 2;
    const centerCount = Math.max(
      3,
      Math.floor(6 * qualitySettings.particleMultiplier)
    );
    const spreadWidth = Math.min(300, window.innerWidth * 0.4);

    for (let i = 0; i < centerCount; i++) {
      setTimeout(() => {
        const x = centerX + (Math.random() - 0.5) * spreadWidth;
        loaderFireworks.push(createFirework(x, undefined, true));
      }, i * 150);
    }

    // Side bursts - only on medium/high quality
    if (qualitySettings.particleMultiplier >= 0.5) {
      const sideCount = Math.floor(4 * qualitySettings.particleMultiplier);
      for (let i = 0; i < sideCount; i++) {
        setTimeout(() => {
          const side = i % 2 === 0 ? 0.2 : 0.8;
          const x =
            window.innerWidth * side + (Math.random() - 0.5) * 100 * scale;
          loaderFireworks.push(createFirework(x, undefined, true));
        }, i * 180);
      }
    }
  }, 2500);

  // Transition to main scene
  setTimeout(() => {
    finishLoader();
  }, 4500);
}

function finishLoader() {
  // Play celebration chime
  soundManager.playChime();

  // Create golden flash burst
  const flash = document.createElement("div");
  flash.className = "flash-overlay";
  document.body.appendChild(flash);

  setTimeout(() => {
    flash.remove();
  }, 800);

  // Fade out loader
  loaderScreen.classList.add("fade-out");

  setTimeout(() => {
    cancelAnimationFrame(loaderAnimationId);
    loaderScreen.classList.add("hidden");

    // Clean up loader resources
    loaderFireworks = [];
    starParticles = [];

    // Launch fireworks in main scene!
    const fireworkCount = Math.max(
      3,
      Math.floor(qualitySettings.maxFireworks * 0.5)
    );
    if (mainSceneReady) {
      for (let i = 0; i < fireworkCount; i++) {
        setTimeout(() => {
          fireworks.push(new Firework());
        }, i * 120);
      }
    }
  }, 1200);
}

// Initialize loader
initLoader();
window.addEventListener("resize", resizeLoaderCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(resizeLoaderCanvas, 100);
});

// ===========================================
// MAIN THREE.JS SCENE
// ===========================================

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// Add some fog for depth
scene.fog = new THREE.FogExp2(0x000000, 0.002);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Responsive camera position
function getResponsiveCameraZ(): number {
  const width = window.innerWidth;
  if (width < 480) return 80;
  if (width < 768) return 65;
  if (width < 1024) return 55;
  return 50;
}
camera.position.set(0, 0, getResponsiveCameraZ());

const renderer = new THREE.WebGLRenderer({
  antialias: qualitySettings === QUALITY_PRESETS.high,
  powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio,
    qualitySettings === QUALITY_PRESETS.low ? 1 : 1.5
  )
);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = true;
controls.minDistance = 30;
controls.maxDistance = 150;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 0, 10);
scene.add(directionalLight);

// Stars - use quality settings for count
const starsGeometry = new THREE.BufferGeometry();
const starsCount = Math.floor(qualitySettings.starCount * 15); // Scale up from loader star count
const posArray = new Float32Array(starsCount * 3);

for (let i = 0; i < starsCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 200;
}

starsGeometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
const starsMaterial = new THREE.PointsMaterial({
  size: 0.25,
  color: 0xffffff,
});
const starsMesh = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starsMesh);

// Text - responsive sizing with quality settings
let textMesh: THREE.Mesh | null = null;
const fontLoader = new FontLoader();
fontLoader.load("/fonts/helvetiker_bold.typeface.json", (font) => {
  // Responsive text size
  const isMobile = window.innerWidth < 768;
  const isSmallMobile = window.innerWidth < 480;
  const textSize = isSmallMobile ? 4 : isMobile ? 5.5 : 8;
  const textDepth = isSmallMobile ? 0.6 : isMobile ? 0.8 : 1.5;

  // Use quality settings for geometry complexity
  const curveSegs = qualitySettings.textCurveSegments;
  const bevelSegs = qualitySettings.textBevelSegments;

  const textGeometry = new TextGeometry("Happy New Year\n       2026", {
    font: font,
    size: textSize,
    depth: textDepth,
    curveSegments: curveSegs,
    bevelEnabled: qualitySettings !== QUALITY_PRESETS.low,
    bevelThickness: textSize * 0.02,
    bevelSize: textSize * 0.004,
    bevelOffset: 0,
    bevelSegments: bevelSegs,
  });

  textGeometry.center();

  // Simplified materials for low quality
  let frontMaterial: THREE.Material;
  let sideMaterial: THREE.Material;

  if (qualitySettings === QUALITY_PRESETS.low) {
    frontMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.2,
    });
    sideMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.3,
    });
  } else {
    // Dual-tone style: Platinum face, Gold sides
    frontMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0,
    });
    sideMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 1.0,
      roughness: 0.3,
    });
  }

  textMesh = new THREE.Mesh(textGeometry, [frontMaterial, sideMaterial]);
  scene.add(textMesh);

  // Mark main scene as ready
  mainSceneReady = true;
});

// Fireworks - Optimized with object pooling
class Firework {
  mesh: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  velocities: Float32Array;
  life: number;
  active: boolean;
  soundPlayed: boolean;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    // Use quality settings for particle count
    const count = qualitySettings.fireworkParticles;
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.soundPlayed = false;

    // Play launch sound - less frequently to reduce audio overhead
    if (Math.random() < 0.3) {
      soundManager.playLaunch();
    }

    const color = new THREE.Color();
    color.setHSL(Math.random(), 1, 0.6);

    this.material = new THREE.PointsMaterial({
      size: 0.35,
      color: color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = Math.random() * 0.8 + 0.5;

      this.velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      this.velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
      this.velocities[i * 3 + 2] = speed * Math.cos(phi);
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    this.mesh = new THREE.Points(this.geometry, this.material);

    // Random start position - responsive
    const spread = qualitySettings === QUALITY_PRESETS.low ? 40 : 60;
    this.mesh.position.x = (Math.random() - 0.5) * spread;
    this.mesh.position.y = (Math.random() - 0.5) * spread * 0.6 + 10;
    this.mesh.position.z = (Math.random() - 0.5) * spread * 0.5 - 20;

    this.life = 1.0;
    this.active = true;
    scene.add(this.mesh);

    // Play explosion sound shortly after creation
    setTimeout(() => {
      if (this.active && Math.random() < 0.5) {
        soundManager.playExplosion(false);
      }
    }, 100);
  }

  update() {
    if (!this.active) return;

    const positions = this.geometry.attributes.position.array as Float32Array;
    const len = positions.length / 3;

    for (let i = 0; i < len; i++) {
      const i3 = i * 3;
      positions[i3] += this.velocities[i3];
      positions[i3 + 1] += this.velocities[i3 + 1];
      positions[i3 + 2] += this.velocities[i3 + 2];

      // Gravity
      this.velocities[i3 + 1] -= 0.015;

      // Drag
      this.velocities[i3] *= 0.98;
      this.velocities[i3 + 1] *= 0.98;
      this.velocities[i3 + 2] *= 0.98;
    }

    this.geometry.attributes.position.needsUpdate = true;

    this.life -= 0.018; // Slightly faster decay
    this.material.opacity = this.life;

    if (this.life <= 0) {
      this.active = false;
      scene.remove(this.mesh);
      this.geometry.dispose();
      this.material.dispose();
    }
  }
}

const fireworks: Firework[] = [];

// Frame time tracking for adaptive quality
let lastFrameTime = performance.now();
let frameCount = 0;
let avgFrameTime = 16.67; // Start assuming 60fps

// Animation Loop
function animate() {
  requestAnimationFrame(animate);

  // Track frame time for adaptive performance
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  frameCount++;
  if (frameCount > 10) {
    avgFrameTime = avgFrameTime * 0.9 + delta * 0.1;
    frameCount = 0;
  }

  // If running slow, skip some work
  const isLagging = avgFrameTime > 33; // Below 30fps

  controls.update();

  // Rotate stars slowly
  starsMesh.rotation.y += 0.0005;

  // Float text - reduced frequency calculations
  if (textMesh) {
    const t = now * 0.001;
    textMesh.rotation.y = Math.sin(t) * 0.1;
    textMesh.rotation.x = Math.sin(t * 2) * 0.05;
  }

  // Manage fireworks - use quality settings and adaptive spawn rate
  const spawnRate = isLagging
    ? qualitySettings.spawnRate * 0.5
    : qualitySettings.spawnRate;
  const maxFw = isLagging
    ? Math.floor(qualitySettings.maxFireworks * 0.5)
    : qualitySettings.maxFireworks;

  if (Math.random() < spawnRate && fireworks.length < maxFw) {
    fireworks.push(new Firework());
  }

  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    if (!fireworks[i].active) {
      fireworks.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

animate();

// Resize handler function - debounced
let resizeTimeout: number | null = null;
function handleResize() {
  if (resizeTimeout) return;

  resizeTimeout = window.setTimeout(() => {
    resizeTimeout = null;

    const width = Math.max(
      window.innerWidth,
      document.documentElement.clientWidth
    );
    const height = Math.max(
      window.innerHeight,
      document.documentElement.clientHeight
    );

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        qualitySettings === QUALITY_PRESETS.low ? 1 : 1.5
      )
    );
    camera.position.z = getResponsiveCameraZ();
  }, 100);
}

window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", () => {
  setTimeout(handleResize, 100);
  setTimeout(handleResize, 300);
});
