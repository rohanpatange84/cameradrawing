/**
 * HandTracker - MediaPipe Hands Web Tracking Engine
 */

export class HandTracker {
  constructor(options = {}) {
    this.videoElement = options.videoElement;
    this.pipVideoElement = options.pipVideoElement;
    this.pipCanvasElement = options.pipCanvasElement;
    this.onResultsCallback = options.onResults || (() => {});
    this.onStatusCallback = options.onStatus || (() => {});
    
    this.hands = null;
    this.camera = null;
    
    // Smoothing parameters (Exponential Moving Average)
    this.smoothingFactor = 0.65; // 0 = no smooth, 1 = max smooth
    this.smoothedX = null;
    this.smoothedY = null;
    
    // Tracking state
    this.triggerMode = 'pointing'; // 'pointing', 'pinch', 'continuous'
    this.isTracking = false;
    this.isMirrored = true;
    
    // Current frame output data
    this.currentData = {
      isDetected: false,
      cursorX: 0,
      cursorY: 0,
      isDrawing: false,
      gesture: 'NONE', // 'POINTING', 'PINCH', 'HOVER', 'PALM', 'FIST'
      rawLandmarks: null,
      pinchDistance: 1
    };

    this.pipCtx = this.pipCanvasElement ? this.pipCanvasElement.getContext('2d') : null;
  }

  async getHandsClass() {
    if (window.Hands) return window.Hands;
    for (let i = 0; i < 50; i++) {
      if (window.Hands) return window.Hands;
      await new Promise(r => setTimeout(r, 100));
    }
    try {
      const mod = await import('@mediapipe/hands');
      return window.Hands || mod.Hands || (mod.default && mod.default.Hands) || mod;
    } catch (e) {
      if (window.Hands) return window.Hands;
      throw new Error('MediaPipe Hands script failed to load.');
    }
  }

  async getCameraClass() {
    if (window.Camera) return window.Camera;
    for (let i = 0; i < 50; i++) {
      if (window.Camera) return window.Camera;
      await new Promise(r => setTimeout(r, 100));
    }
    try {
      const mod = await import('@mediapipe/camera_utils');
      return window.Camera || mod.Camera || (mod.default && mod.default.Camera) || mod;
    } catch (e) {
      if (window.Camera) return window.Camera;
      throw new Error('MediaPipe CameraUtils script failed to load.');
    }
  }

  async init() {
    this.onStatusCallback('Loading MediaPipe AI model...');

    try {
      const HandsClass = await this.getHandsClass();
      
      this.hands = new HandsClass({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      this.hands.onResults((results) => this.handleResults(results));

      this.onStatusCallback('Requesting webcam access...');
      await this.startCamera();
      
      this.isTracking = true;
      this.onStatusCallback('Tracker ready!');
    } catch (err) {
      console.error('Failed to initialize HandTracker:', err);
      this.onStatusCallback(`Error: ${err.message || 'Camera permission denied or failed to load AI model.'}`);
      throw err;
    }
  }

  async startCamera() {
    const CameraClass = await this.getCameraClass();
    
    // Use navigator.mediaDevices getUserMedia
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }
    });

    this.videoElement.srcObject = stream;
    if (this.pipVideoElement) {
      this.pipVideoElement.srcObject = stream;
    }

    this.camera = new CameraClass(this.videoElement, {
      onFrame: async () => {
        if (this.videoElement && this.videoElement.readyState >= 2) {
          await this.hands.send({ image: this.videoElement });
        }
      },
      width: 1280,
      height: 720
    });

    await this.camera.start();
  }

  setTriggerMode(mode) {
    this.triggerMode = mode;
  }

  setSmoothing(val) {
    this.smoothingFactor = Math.max(0.05, Math.min(0.95, val));
  }

  setMirrored(isMirrored) {
    this.isMirrored = isMirrored;
  }

  handleResults(results) {
    const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    
    // Render PIP overlay landmarks if PIP canvas is visible
    if (this.pipCtx && this.pipCanvasElement) {
      this.drawPipOverlay(results);
    }

    if (!hasHand) {
      this.currentData = {
        isDetected: false,
        cursorX: this.smoothedX || 0,
        cursorY: this.smoothedY || 0,
        isDrawing: false,
        gesture: 'SEARCHING',
        rawLandmarks: null,
        pinchDistance: 1
      };
      this.onResultsCallback(this.currentData);
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    
    // Screen coordinate mapping
    const rawX = this.isMirrored ? (1 - indexTip.x) * window.innerWidth : indexTip.x * window.innerWidth;
    const rawY = indexTip.y * window.innerHeight;

    // Apply Exponential Moving Average (EMA) smoothing
    if (this.smoothedX === null || this.smoothedY === null) {
      this.smoothedX = rawX;
      this.smoothedY = rawY;
    } else {
      this.smoothedX = this.smoothedX * this.smoothingFactor + rawX * (1 - this.smoothingFactor);
      this.smoothedY = this.smoothedY * this.smoothingFactor + rawY * (1 - this.smoothingFactor);
    }

    // Pinch distance calculation (Euclidean normalized distance)
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const dz = (indexTip.z || 0) - (thumbTip.z || 0);
    const pinchDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Finger extensions detection
    const isIndexExtended = landmarks[8].y < landmarks[6].y;
    const isMiddleExtended = landmarks[12].y < landmarks[10].y;
    const isRingExtended = landmarks[16].y < landmarks[14].y;
    const isPinkyExtended = landmarks[20].y < landmarks[18].y;

    // Classify gesture
    let gesture = 'HOVER';
    let isDrawing = false;

    const isPinching = pinchDist < 0.08;
    const isPointingOnly = isIndexExtended && !isMiddleExtended && !isRingExtended;
    const isTwoFingersHover = isIndexExtended && isMiddleExtended && !isRingExtended;
    const isOpenPalm = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended;

    if (isOpenPalm) {
      gesture = 'PALM_PAUSE';
      isDrawing = false;
    } else if (this.triggerMode === 'twoFingers') {
      if (isTwoFingersHover) {
        gesture = 'TWO_FINGER_DRAW';
        isDrawing = true;
      } else {
        gesture = 'HOVER';
        isDrawing = false;
      }
    } else if (this.triggerMode === 'pinch') {
      if (isPinching) {
        gesture = 'PINCH_DRAW';
        isDrawing = true;
      } else {
        gesture = 'HOVER';
        isDrawing = false;
      }
    } else if (this.triggerMode === 'pointing') {
      if (isPointingOnly || isPinching) {
        gesture = isPinching ? 'PINCH_DRAW' : 'POINT_DRAW';
        isDrawing = true;
      } else if (isTwoFingersHover) {
        gesture = 'HOVER';
        isDrawing = false;
      } else {
        gesture = 'HOVER';
        isDrawing = false;
      }
    } else if (this.triggerMode === 'continuous') {
      gesture = 'CONTINUOUS_DRAW';
      isDrawing = true;
    }

    this.currentData = {
      isDetected: true,
      cursorX: this.smoothedX,
      cursorY: this.smoothedY,
      isDrawing: isDrawing,
      gesture: gesture,
      rawLandmarks: landmarks,
      pinchDistance: pinchDist
    };

    this.onResultsCallback(this.currentData);
  }

  drawPipOverlay(results) {
    const canvas = this.pipCanvasElement;
    const ctx = this.pipCtx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;

    const landmarks = results.multiHandLandmarks[0];
    ctx.lineWidth = 2;

    // Simple skeleton connections array
    const CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4], // Thumb
      [0,5],[5,6],[6,7],[7,8], // Index
      [5,9],[9,10],[10,11],[11,12], // Middle
      [9,13],[13,14],[14,15],[15,16], // Ring
      [13,17],[17,18],[18,19],[19,20],[0,17] // Pinky
    ];

    ctx.strokeStyle = '#00f3ff';
    ctx.fillStyle = '#ff007f';

    CONNECTIONS.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      const x1 = (1 - p1.x) * canvas.width;
      const y1 = p1.y * canvas.height;
      const x2 = (1 - p2.x) * canvas.width;
      const y2 = p2.y * canvas.height;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    landmarks.forEach((lm, idx) => {
      const x = (1 - lm.x) * canvas.width;
      const y = lm.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, idx === 8 ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = idx === 8 ? '#00ff87' : '#ff007f';
      ctx.fill();
    });
  }
}
