/**
 * AirCanvas AI - Entry Point & Application Loop
 */

import './style.css';
import { HandTracker } from './handTracker.js';
import { CanvasDrawer } from './canvasDrawer.js';
import { ParticleSystem } from './particleSystem.js';
import { UIController } from './uiController.js';

document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('loading-screen');
  const cameraStatusText = document.getElementById('camera-status-text');
  const btnStartCamera = document.getElementById('btn-start-camera');

  const webcamBg = document.getElementById('webcam-bg');
  const webcamPip = document.getElementById('webcam-pip');
  const pipHandCanvas = document.getElementById('pip-hand-canvas');

  const drawingCanvas = document.getElementById('drawing-canvas');
  const particleCanvas = document.getElementById('particle-canvas');

  // Initialize Core Systems
  const canvasDrawer = new CanvasDrawer(drawingCanvas);
  const particleSystem = new ParticleSystem(particleCanvas);

  let uiController = null;
  let handTracker = null;

  const initApp = async () => {
    try {
      handTracker = new HandTracker({
        videoElement: webcamBg,
        pipVideoElement: webcamPip,
        pipCanvasElement: pipHandCanvas,

        onStatus: (statusMsg) => {
          cameraStatusText.textContent = statusMsg;
        },

        onResults: (data) => {
          if (uiController) {
            uiController.updateHUD(data);
          }

          if (data.isDetected) {
            // Update drawing canvas
            if (data.isDrawing) {
              canvasDrawer.drawTo(data.cursorX, data.cursorY);
              particleSystem.emit(data.cursorX, data.cursorY, 2, true);
            } else {
              canvasDrawer.endStroke();
              particleSystem.emit(data.cursorX, data.cursorY, 1, false);
            }
          } else {
            canvasDrawer.endStroke();
          }
        }
      });

      uiController = new UIController(handTracker, canvasDrawer, particleSystem);

      await handTracker.init();

      // Fade out loading screen smoothly
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);

    } catch (err) {
      console.error('Initialization error:', err);
      cameraStatusText.textContent = `Initialization failed: ${err.message || 'Camera permission denied.'}`;
      btnStartCamera.style.display = 'inline-block';
    }
  };

  btnStartCamera.addEventListener('click', () => {
    btnStartCamera.style.display = 'none';
    cameraStatusText.textContent = 'Retrying camera access...';
    initApp();
  });

  // Auto start initialization on load
  initApp();

  // Particle Animation Loop
  const renderLoop = () => {
    particleSystem.updateAndRender();
    requestAnimationFrame(renderLoop);
  };
  requestAnimationFrame(renderLoop);

  // Resize handling
  window.addEventListener('resize', () => {
    canvasDrawer.resize();
    particleSystem.resize();
    if (pipHandCanvas) {
      pipHandCanvas.width = pipHandCanvas.clientWidth;
      pipHandCanvas.height = pipHandCanvas.clientHeight;
    }
  });
});
