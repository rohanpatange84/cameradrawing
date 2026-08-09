/**
 * UIController - Handles HUD UI interactions, gesture reticle feedback, and settings
 */

export class UIController {
  constructor(handTracker, canvasDrawer, particleSystem) {
    this.tracker = handTracker;
    this.drawer = canvasDrawer;
    this.particles = particleSystem;

    // DOM Elements
    this.reticle = document.getElementById('finger-reticle');
    this.reticleLabel = document.getElementById('reticle-label');
    this.gestureBadge = document.getElementById('gesture-badge');
    this.gestureName = document.getElementById('gesture-name');
    this.fpsCounter = document.getElementById('fps-counter');

    this.videoBgContainer = document.getElementById('video-bg-container');
    this.pipContainer = document.getElementById('pip-container');
    this.modalGuide = document.getElementById('modal-guide');
    
    // FPS tracking
    this.frameCount = 0;
    this.lastFpsTime = performance.now();

    this.bindEvents();
  }

  bindEvents() {
    // Brush Selector Buttons
    const brushCards = document.querySelectorAll('.brush-card');
    brushCards.forEach(card => {
      card.addEventListener('click', () => {
        brushCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const style = card.dataset.brush;
        this.drawer.setBrushStyle(style);
      });
    });

    // Brush Size Slider
    const sizeSlider = document.getElementById('brush-size');
    const sizeValDisplay = document.getElementById('brush-size-val');
    const previewDot = document.getElementById('brush-preview-dot');

    sizeSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      sizeValDisplay.textContent = `${val}px`;
      previewDot.style.width = `${val}px`;
      previewDot.style.height = `${val}px`;
      this.drawer.setBrushSize(val);
    });

    // Color Swatches & Picker
    const swatches = document.querySelectorAll('.swatch:not(.picker-swatch)');
    const customPicker = document.getElementById('custom-color-picker');

    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const color = swatch.dataset.color;
        this.setColor(color);
      });
    });

    customPicker.addEventListener('input', (e) => {
      swatches.forEach(s => s.classList.remove('active'));
      this.setColor(e.target.value);
    });

    // Trigger Mode Selector
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        this.tracker.setTriggerMode(mode);
      });
    });

    // Camera Feed Controls
    const btnCamPip = document.getElementById('btn-cam-pip');
    const btnCamBg = document.getElementById('btn-cam-bg');
    const btnCamMirror = document.getElementById('btn-cam-mirror');

    btnCamPip.addEventListener('click', () => {
      btnCamPip.classList.toggle('active');
      this.pipContainer.classList.toggle('hidden', !btnCamPip.classList.contains('active'));
    });

    btnCamBg.addEventListener('click', () => {
      btnCamBg.classList.toggle('active');
      const isActive = btnCamBg.classList.contains('active');
      this.videoBgContainer.className = `video-bg-container ${isActive ? 'mode-full' : 'mode-dimmed'}`;
    });

    btnCamMirror.addEventListener('click', () => {
      btnCamMirror.classList.toggle('active');
      const isMirrored = btnCamMirror.classList.contains('active');
      this.tracker.setMirrored(isMirrored);
      document.getElementById('webcam-bg').style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
      document.getElementById('webcam-pip').style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
    });

    // Motion Smoothing Slider
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingValDisplay = document.getElementById('smoothing-val');

    smoothingSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      smoothingValDisplay.textContent = `Smooth (${val.toFixed(2)})`;
      this.tracker.setSmoothing(val);
    });

    // Background Selector
    const bgBtns = document.querySelectorAll('.bg-btn');
    bgBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        bgBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const bgTheme = btn.dataset.bg;
        document.body.className = `theme-${bgTheme}`;
      });
    });

    // Action Buttons
    document.getElementById('btn-undo').addEventListener('click', () => this.drawer.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.drawer.redo());
    document.getElementById('btn-clear').addEventListener('click', () => this.drawer.clear());
    document.getElementById('btn-save').addEventListener('click', () => this.drawer.downloadPNG());

    // PIP Minimize Button
    document.getElementById('btn-toggle-pip-minimize').addEventListener('click', () => {
      this.pipContainer.classList.toggle('minimized');
    });

    // Modal Guide
    document.getElementById('btn-guide').addEventListener('click', () => this.openGuide());
    document.getElementById('btn-close-guide').addEventListener('click', () => this.closeGuide());
    document.getElementById('btn-got-it').addEventListener('click', () => this.closeGuide());

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) this.drawer.redo();
        else this.drawer.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        this.drawer.redo();
      } else if (e.key === 'c' || e.key === 'C') {
        this.drawer.clear();
      } else if (e.key === 's' || e.key === 'S') {
        this.drawer.downloadPNG();
      } else if (e.key === 'g' || e.key === 'G') {
        this.toggleGuide();
      }
    });
  }

  setColor(color) {
    this.drawer.setColor(color);
    this.particles.setColor(color);
    document.getElementById('brush-preview-dot').style.backgroundColor = color;
    document.getElementById('brush-preview-dot').style.boxShadow = `0 0 10px ${color}`;
  }

  openGuide() {
    this.modalGuide.classList.remove('hidden');
  }

  closeGuide() {
    this.modalGuide.classList.add('hidden');
  }

  toggleGuide() {
    this.modalGuide.classList.toggle('hidden');
  }

  updateHUD(trackingData) {
    // Calculate FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.fpsCounter.textContent = fps;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (!trackingData.isDetected) {
      this.reticle.classList.add('hidden');
      this.gestureBadge.className = 'hud-pill gesture-pill state-searching';
      this.gestureName.textContent = 'SEARCHING HAND';
      return;
    }

    // Update Reticle Position & Mode
    this.reticle.classList.remove('hidden');
    this.reticle.style.left = `${trackingData.cursorX}px`;
    this.reticle.style.top = `${trackingData.cursorY}px`;

    const isDrawing = trackingData.isDrawing;
    this.reticle.className = `finger-reticle ${isDrawing ? 'mode-draw' : 'mode-hover'}`;
    this.reticleLabel.textContent = isDrawing ? 'DRAWING' : 'HOVER';

    // Update Badge Status
    if (isDrawing) {
      this.gestureBadge.className = 'hud-pill gesture-pill state-drawing';
      this.gestureName.textContent = `DRAWING (${trackingData.gesture})`;
    } else {
      this.gestureBadge.className = 'hud-pill gesture-pill state-hover';
      this.gestureName.textContent = trackingData.gesture;
    }
  }
}
