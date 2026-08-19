// Ultra-Lightweight & Optimized Particle System (Low RAM / Low CPU)
(function() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  const maxParticles = 20; // Reduced for performance
  let isPaused = false;
  let animFrameId = null;
  let lastTime = 0;
  const fpsInterval = 1000 / 30; // Cap at 30 FPS for minimal CPU footprint

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * canvas.width;
      this.y = initial ? Math.random() * canvas.height : canvas.height + 10;
      this.size = Math.random() * 2.0 + 0.8;
      this.speedY = Math.random() * 0.5 + 0.2;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.5 + 0.2;
      this.fadeSpeed = Math.random() * 0.002 + 0.001;
      this.sway = Math.random() * Math.PI * 2;
      this.swaySpeed = Math.random() * 0.015 + 0.008;

      const isLeft = this.x < canvas.width / 2;
      if (isLeft) {
        // Forbidden: Warm Torchlight Embers (Amber & Crimson)
        const rand = Math.random();
        if (rand > 0.5) {
          this.r = 245; this.g = 158; this.b = 11;
        } else if (rand > 0.2) {
          this.r = 220; this.g = 38; this.b = 38;
        } else {
          this.r = 251; this.g = 191; this.b = 36;
        }
      } else {
        // ATM 10: Tech Cyan & Gold
        if (Math.random() > 0.4) {
          this.r = 14; this.g = 165; this.b = 233;
        } else {
          this.r = 250; this.g = 204; this.b = 21;
        }
      }
    }

    update() {
      this.y -= this.speedY;
      this.sway += this.swaySpeed;
      this.x += Math.sin(this.sway) * 0.4 + this.speedX;
      this.opacity -= this.fadeSpeed;

      if (this.y < -10 || this.opacity <= 0) {
        this.reset(false);
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.r}, ${this.g}, ${this.b}, ${this.opacity})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < maxParticles; i++) {
    particles.push(new Particle());
  }

  function animate(now) {
    if (isPaused) return;

    animFrameId = requestAnimationFrame(animate);

    const elapsed = now - lastTime;
    if (elapsed < fpsInterval) return;
    lastTime = now - (elapsed % fpsInterval);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
  }

  function pause() {
    isPaused = true;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function resume() {
    if (isPaused) {
      isPaused = false;
      lastTime = performance.now();
      animate(lastTime);
    }
  }

  // Automatic pause when window is hidden or blurred
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else resume();
  });

  window.addEventListener('blur', () => {
    // Reduce activity when unfocused
    isPaused = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
  });

  window.addEventListener('focus', () => {
    resume();
  });

  // Global pause handler when game starts
  window.particleSystem = { pause, resume };

  resume();
})();
