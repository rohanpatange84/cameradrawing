/**
 * CanvasDrawer - High-Performance 2D Canvas Engine
 */

export class CanvasDrawer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    
    // Config state
    this.currentColor = '#00f3ff';
    this.brushSize = 12;
    this.brushStyle = 'neon'; // 'neon', 'rainbow', 'laser', 'calligraphy', 'particles', 'eraser'
    this.hueShift = 0;
    
    // Stroke path state
    this.isDrawing = false;
    this.lastX = null;
    this.lastY = null;
    this.lastSpeed = 0;
    this.lastTime = Date.now();
    
    // Undo / Redo history
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 25;

    this.initCanvas();
  }

  initCanvas() {
    this.resize();
    this.saveState();
  }

  resize() {
    // Preserve canvas drawings across window resizes
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.canvas, 0, 0);

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);

    // Restore pre-resize content
    if (tempCanvas.width > 0 && tempCanvas.height > 0) {
      this.ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width / dpr, tempCanvas.height / dpr);
    }
  }

  setColor(color) {
    this.currentColor = color;
  }

  setBrushSize(size) {
    this.brushSize = parseInt(size, 10);
  }

  setBrushStyle(style) {
    this.brushStyle = style;
  }

  startStroke(x, y) {
    this.saveState();
    this.isDrawing = true;
    this.lastX = x;
    this.lastY = y;
    this.lastTime = Date.now();
    this.lastSpeed = 0;
  }

  endStroke() {
    this.isDrawing = false;
    this.lastX = null;
    this.lastY = null;
  }

  drawTo(x, y) {
    if (!this.isDrawing || this.lastX === null || this.lastY === null) {
      this.startStroke(x, y);
      return;
    }

    const now = Date.now();
    const dt = Math.max(1, now - this.lastTime);
    const dist = Math.hypot(x - this.lastX, y - this.lastY);
    const speed = dist / dt;
    
    // Midpoint for quadratic bezier curve smoothing
    const midX = (this.lastX + x) / 2;
    const midY = (this.lastY + y) / 2;

    this.ctx.save();
    
    if (this.brushStyle === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = this.brushSize * 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
      this.ctx.stroke();
    } 
    else if (this.brushStyle === 'neon') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Outer Glow
      this.ctx.shadowBlur = this.brushSize * 1.5;
      this.ctx.shadowColor = this.currentColor;
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.brushSize;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
      this.ctx.stroke();

      // Bright Core Pass
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = Math.max(2, this.brushSize * 0.3);
      this.ctx.stroke();
    }
    else if (this.brushStyle === 'rainbow') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.hueShift = (this.hueShift + 4) % 360;
      const rainbowColor = `hsl(${this.hueShift}, 100%, 55%)`;

      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowBlur = this.brushSize;
      this.ctx.shadowColor = rainbowColor;
      this.ctx.strokeStyle = rainbowColor;
      this.ctx.lineWidth = this.brushSize;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
      this.ctx.stroke();
    }
    else if (this.brushStyle === 'laser') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineCap = 'square';
      this.ctx.lineJoin = 'miter';

      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = this.currentColor;
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.brushSize + 6;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();

      // Core center laser
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }
    else if (this.brushStyle === 'calligraphy') {
      this.ctx.globalCompositeOperation = 'source-over';
      // Speed-dependent width: faster -> thinner
      const targetWidth = Math.max(2, this.brushSize * (1.2 - Math.min(1, speed * 0.5)));
      
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = targetWidth;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
      this.ctx.stroke();
    }
    else if (this.brushStyle === 'particles') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.brushSize * 0.5;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
      this.ctx.stroke();
    }

    this.ctx.restore();

    this.lastX = x;
    this.lastY = y;
    this.lastTime = now;
    this.lastSpeed = speed;
  }

  saveState() {
    if (this.undoStack.length >= this.maxHistory) {
      this.undoStack.shift();
    }
    const dpr = window.devicePixelRatio || 1;
    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.undoStack.push(imgData);
    this.redoStack = []; // Reset redo on new action
  }

  undo() {
    if (this.undoStack.length > 1) {
      const current = this.undoStack.pop();
      this.redoStack.push(current);
      const previous = this.undoStack[this.undoStack.length - 1];
      this.ctx.putImageData(previous, 0, 0);
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const next = this.redoStack.pop();
      this.undoStack.push(next);
      this.ctx.putImageData(next, 0, 0);
    }
  }

  clear() {
    this.saveState();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  downloadPNG() {
    // Create export canvas with solid background if current body theme is dark
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    // Fill dark background for saved artwork
    expCtx.fillStyle = '#0a0b10';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    expCtx.drawImage(this.canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `air-canvas-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }
}
