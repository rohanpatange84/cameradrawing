/**
 * ParticleSystem - Real-time Glowing Fingertip Particle Engine
 */

export class ParticleSystem {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.activeColor = '#00f3ff';
    
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  setColor(color) {
    this.activeColor = color;
  }

  emit(x, y, count = 3, isDrawing = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = isDrawing ? (Math.random() * 2.5 + 0.5) : (Math.random() * 1.2 + 0.2);
      
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isDrawing ? 0.5 : 0),
        size: isDrawing ? (Math.random() * 4 + 2) : (Math.random() * 2.5 + 1),
        alpha: 1,
        life: 1,
        decay: Math.random() * 0.03 + 0.02,
        color: this.activeColor
      });
    }
  }

  updateAndRender() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.alpha = Math.max(0, p.life);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.shadowBlur = p.size * 2;
      this.ctx.shadowColor = p.color;
      this.ctx.fillStyle = p.color;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }
}
