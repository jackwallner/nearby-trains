/**
 * Effects Engine — sparkles, confetti, count-up numbers, ripples, particles
 * Pure visual pizzazz, no functional changes
 */

const Effects = {
  canvas: null,
  ctx: null,
  particles: [],
  sparkles: [],
  confetti: [],
  animating: false,
  dpr: 1,

  /**
   * Initialize the effects engine
   */
  init() {
    this.canvas = document.getElementById('sparkle-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.resize();

    window.addEventListener('resize', () => this.resize());

    // Start the render loop
    this.animating = true;
    this.loop();

    // Add ripple effect to all buttons
    this.initRipples();

    // Add floating particles background
    this.initBackgroundParticles();

    console.log('✨ Effects engine initialized');
  },

  /**
   * Resize canvas to fill viewport
   */
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(this.dpr, this.dpr);
  },

  /**
   * Main animation loop
   */
  loop() {
    if (!this.animating) return;
    this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Draw background particles
    this.drawBackgroundParticles();

    // Draw sparkles
    this.drawSparkles();

    // Draw confetti
    this.drawConfetti();

    requestAnimationFrame(() => this.loop());
  },

  // =============================================
  // BACKGROUND FLOATING PARTICLES
  // =============================================

  initBackgroundParticles() {
    const count = Math.min(40, Math.floor(window.innerWidth / 30));
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.15 + 0.03,
        color: ['59,130,246', '124,58,237', '22,163,74', '245,158,11'][Math.floor(Math.random() * 4)]
      });
    }
  },

  drawBackgroundParticles() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      this.ctx.fill();
    });

    // Draw connections between nearby particles
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.strokeStyle = `rgba(59,130,246, ${0.04 * (1 - dist / 120)})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.stroke();
        }
      }
    }
  },

  // =============================================
  // SPARKLES (emitted on train detection)
  // =============================================

  /**
   * Emit sparkles at a position
   */
  emitSparkles(x, y, count = 12, colors) {
    const defaultColors = ['#3b82f6', '#7c3aed', '#f59e0b', '#16a34a', '#ec4899', '#06b6d4'];
    const c = colors || defaultColors;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = Math.random() * 3 + 1.5;
      this.sparkles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.02 + 0.015,
        size: Math.random() * 4 + 2,
        color: c[Math.floor(Math.random() * c.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2
      });
    }
  },

  drawSparkles() {
    this.sparkles = this.sparkles.filter(s => s.life > 0);

    this.sparkles.forEach(s => {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.04; // gravity
      s.life -= s.decay;
      s.rotation += s.rotSpeed;

      this.ctx.save();
      this.ctx.translate(s.x, s.y);
      this.ctx.rotate(s.rotation);
      this.ctx.globalAlpha = s.life;

      // Draw a 4-point star
      this.ctx.beginPath();
      const r = s.size * s.life;
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        this.ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        this.ctx.lineTo(Math.cos(angle + Math.PI / 4) * r * 0.3, Math.sin(angle + Math.PI / 4) * r * 0.3);
      }
      this.ctx.closePath();
      this.ctx.fillStyle = s.color;
      this.ctx.shadowColor = s.color;
      this.ctx.shadowBlur = 6;
      this.ctx.fill();

      this.ctx.restore();
    });
  },

  // =============================================
  // CONFETTI BURST (on new train spotted)
  // =============================================

  /**
   * Burst confetti from a point
   */
  burstConfetti(x, y, count = 30) {
    const colors = ['#3b82f6', '#7c3aed', '#f59e0b', '#16a34a', '#ec4899', '#ef4444', '#06b6d4', '#f97316'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.confetti.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 1,
        decay: Math.random() * 0.008 + 0.005,
        width: Math.random() * 8 + 4,
        height: Math.random() * 5 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.random() * 0.1 + 0.03
      });
    }
  },

  /**
   * Confetti rain from the top
   */
  confettiRain(duration = 2000) {
    const interval = setInterval(() => {
      const x = Math.random() * window.innerWidth;
      this.burstConfetti(x, -10, 3);
    }, 50);
    setTimeout(() => clearInterval(interval), duration);
  },

  drawConfetti() {
    this.confetti = this.confetti.filter(c => c.life > 0);

    this.confetti.forEach(c => {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.12; // gravity
      c.vx *= 0.99; // air resistance
      c.life -= c.decay;
      c.rotation += c.rotSpeed;
      c.wobble += c.wobbleSpeed;

      // Wobble
      c.x += Math.sin(c.wobble) * 0.5;

      this.ctx.save();
      this.ctx.translate(c.x, c.y);
      this.ctx.rotate(c.rotation);
      this.ctx.globalAlpha = Math.min(c.life * 2, 1);
      this.ctx.fillStyle = c.color;
      this.ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
      this.ctx.restore();
    });
  },

  // =============================================
  // BUTTON RIPPLE EFFECT
  // =============================================

  initRipples() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn, .suggested-card, .location-tab');
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  },

  // =============================================
  // COUNT-UP ANIMATION for stat values
  // =============================================

  /**
   * Animate a number counting up
   */
  countUp(element, endValue, duration = 600) {
    if (!element) return;

    const text = String(endValue);
    // Only animate pure numbers
    const numericValue = parseFloat(text);
    if (isNaN(numericValue)) {
      element.textContent = text;
      return;
    }

    const startValue = parseFloat(element.textContent) || 0;
    if (startValue === numericValue) return;

    const isFloat = text.includes('.');
    const decimals = isFloat ? (text.split('.')[1] || '').length : 0;
    const startTime = performance.now();

    element.classList.add('counting');

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (numericValue - startValue) * eased;

      element.textContent = isFloat ? current.toFixed(decimals) : Math.round(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = text;
        element.classList.remove('counting');
      }
    };

    requestAnimationFrame(animate);
  },

  // =============================================
  // HEADER TRAIN ANIMATION
  // =============================================

  /**
   * Quick celebration when refresh finds trains
   */
  celebrateTrains(count) {
    if (count <= 0) return;

    // Sparkle from the stats area
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
      const rect = statsGrid.getBoundingClientRect();
      this.emitSparkles(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        Math.min(count * 3, 20)
      );
    }
  },

  /**
   * Celebrate a NEW train being spotted for the first time
   */
  celebrateNewTrain() {
    const heroCard = document.getElementById('current-train-card');
    if (heroCard) {
      const rect = heroCard.getBoundingClientRect();
      this.burstConfetti(rect.left + rect.width / 2, rect.top + 30, 25);
    }
  },

  // =============================================
  // REFRESH BUTTON SPIN
  // =============================================

  spinRefreshButton() {
    const btn = document.getElementById('btn-refresh');
    if (btn) {
      btn.classList.add('btn-refresh-spinning');
      setTimeout(() => btn.classList.remove('btn-refresh-spinning'), 800);
    }
  }
};

window.Effects = Effects;
