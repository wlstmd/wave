import React, { useEffect, useRef } from "react";
import "./App.css";

function App() {
  // mouse position state removed (not needed after removing cursor glow)
  const wavesRef = useRef([]);
  const starsRef = useRef([]);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const hoverIntervalRef = useRef(null);
  const renderScaleRef = useRef(0.75); // internal render resolution scale (0..1)
  const avgDtRef = useRef(16);
  const segmentsRef = useRef(8);
  const frameRef = useRef(0);
  // ...existing code...

  // createWave moved to component scope so other effects (hover splashes) can call it
  const createWave = (x, y, velocity = 2, small = false) => {
    const w = (small ? 36 : 60) + Math.min(velocity * 1.6, 100);
    const h = (small ? 10 : 16) + Math.min(velocity * 0.6, 36);
    const wave = {
      id: Date.now() + Math.random(),
      x,
      y,
      width: w,
      height: h,
      opacity: Math.min(0.5 + velocity / 25, 0.98),
      expandSpeed: (small ? 0.9 : 1.0) + velocity * 0.03,
      age: 0,
      foam: [],
    };

    const foamCount = Math.max(
      1,
      Math.floor((small ? 1 : 2) + velocity * 0.14)
    );
    for (let i = 0; i < foamCount; i++) {
      const angle = -Math.PI * 0.45 + Math.random() * Math.PI * 0.9;
      const dist = Math.random() * w * 0.45;
      wave.foam.push({
        offsetX: Math.cos(angle) * dist,
        offsetY: Math.sin(angle) * dist - Math.random() * 6,
        size: Math.random() * (small ? 1.4 : 2) + 0.6,
        opacity: Math.random() * 0.5 + 0.25,
        life: 1,
        speed: Math.random() * 0.45 + 0.08,
      });
    }

    // keep arrays bounded
    wavesRef.current.push(wave);
    if (wavesRef.current.length > 20) wavesRef.current.shift();
    // no droplets: only foam + wave
  };

  // stars (top area)
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.3,
        size: Math.random() * 2.2,
        opacity: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;
  }, []);

  // mouse handling - immediate spawn when entering ocean area + hover splashes
  useEffect(() => {
    const oceanStartY = window.innerHeight * 0.7;
    let lastX = 0;
    let lastY = 0;
    let lastInOcean = false;
    let lastCreate = 0;

    const onMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      const dx = x - lastX;
      const dy = y - lastY;
      const v = Math.sqrt(dx * dx + dy * dy);
      const now = Date.now();
      const inOcean = y > oceanStartY;

      if (inOcean && !lastInOcean) {
        // immediate spawn on enter
        createWave(x, y, Math.min(v, 8), false);
        lastCreate = now;

        // start light hover splashes while cursor remains
        if (hoverIntervalRef.current == null) {
          hoverIntervalRef.current = setInterval(() => {
            const mp = { x: lastX, y: lastY };
            createWave(
              mp.x + (Math.random() - 0.5) * 12,
              mp.y + Math.random() * 6,
              1.6,
              true
            );
          }, 140);
        }
      }

      if (inOcean) {
        if (v > 2 && now - lastCreate > 35) {
          createWave(x, y, Math.min(v, 10), false);
          lastCreate = now;
        } else if (now - lastCreate > 220 && v > 0.5) {
          createWave(x, y, Math.min(v, 6), true);
          lastCreate = now;
        }
      } else {
        // left ocean: stop hover splashes
        if (hoverIntervalRef.current != null) {
          clearInterval(hoverIntervalRef.current);
          hoverIntervalRef.current = null;
        }
      }

      lastX = x;
      lastY = y;
      lastInOcean = inOcean;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hoverIntervalRef.current != null) {
        clearInterval(hoverIntervalRef.current);
        hoverIntervalRef.current = null;
      }
    };
  }, []);

  // animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const scale = renderScaleRef.current;
      canvas.width = Math.max(1, Math.floor(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * scale));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      // reset transform so 1 unit == 1 css pixel after scaling
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    resize();

    let last = performance.now();

    const loop = (now) => {
      const dt = Math.min(40, now - last);
      last = now;

      // update average dt (smoothed)
      avgDtRef.current = avgDtRef.current * 0.92 + dt * 0.08;
      // adapt detail if rendering is slow
      if (avgDtRef.current > 28) {
        if (segmentsRef.current !== 5) segmentsRef.current = 5;
        if (renderScaleRef.current !== 0.6) {
          renderScaleRef.current = 0.6;
          resize();
        }
      } else if (avgDtRef.current > 22) {
        if (segmentsRef.current !== 6) segmentsRef.current = 6;
        if (renderScaleRef.current !== 0.7) {
          renderScaleRef.current = 0.7;
          resize();
        }
      } else {
        if (segmentsRef.current !== 8) segmentsRef.current = 8;
        if (renderScaleRef.current !== 0.75) {
          renderScaleRef.current = 0.75;
          resize();
        }
      }

      frameRef.current++;

      // Clear the full device buffer using identity transform to avoid trails
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // set scaled transform for drawing (so drawing coordinates stay in CSS pixels)
      const scale = renderScaleRef.current;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      // stars (skip some frames when under load)
      const drawStars = !(avgDtRef.current > 24 && frameRef.current % 2 === 1);
      if (drawStars) {
        for (let i = 0; i < starsRef.current.length; i++) {
          const s = starsRef.current[i];
          const tw =
            Math.sin(now * 0.001 * s.twinkleSpeed + s.phase) * 0.45 + 0.55;
          ctx.fillStyle = `rgba(255,255,255,${s.opacity * tw})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // update waves
      for (let i = 0; i < wavesRef.current.length; i++) {
        const w = wavesRef.current[i];
        for (let j = w.foam.length - 1; j >= 0; j--) {
          const f = w.foam[j];
          f.life -= 0.03 * (dt / 16);
          f.offsetY -= f.speed * (dt / 16);
          if (f.life <= 0) w.foam.splice(j, 1);
        }
        w.width += w.expandSpeed * (dt / 16);
        w.height += w.expandSpeed * 0.18 * (dt / 16);
        w.opacity -= 0.012 * (dt / 16);
        w.age += 1;
      }

      // droplets (splash) disabled

      wavesRef.current = wavesRef.current.filter(
        (w) => w.opacity > 0.05 && w.width < 300
      );

      // draw waves (sine crest)
      for (let wi = 0; wi < wavesRef.current.length; wi++) {
        const w = wavesRef.current[wi];
        ctx.save();
        ctx.translate(w.x, w.y);
        const segments = segmentsRef.current;
        const width = w.width;
        const amp = Math.max(6, w.height * 0.55);
        const t = w.age * 0.04;

        ctx.beginPath();
        for (let si = 0; si <= segments; si++) {
          const px = -width / 2 + (si / segments) * width;
          const py =
            -Math.sin((si / segments) * Math.PI * 2 + t) *
            amp *
            (1 - si / (segments + 1));
          if (si === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.lineTo(width / 2, w.height * 0.12);
        ctx.lineTo(-width / 2, w.height * 0.12);
        ctx.closePath();

        const stroke = ctx.createLinearGradient(0, -amp, 0, w.height * 0.12);
        stroke.addColorStop(0, `rgba(255,255,255,${Math.min(w.opacity, 0.9)})`);
        stroke.addColorStop(0.4, `rgba(190,230,250,${w.opacity * 0.7})`);
        stroke.addColorStop(1, `rgba(120,180,210,${w.opacity * 0.25})`);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        const fill = ctx.createLinearGradient(0, -amp, 0, w.height * 0.12);
        fill.addColorStop(0, `rgba(240,250,255,${w.opacity * 0.25})`);
        fill.addColorStop(1, `rgba(160,200,230,${w.opacity * 0.05})`);
        ctx.fillStyle = fill;
        ctx.fill();

        for (let fi = 0; fi < w.foam.length; fi++) {
          const f = w.foam[fi];
          ctx.globalAlpha = f.life * f.opacity * w.opacity;
          ctx.beginPath();
          ctx.arc(f.offsetX, f.offsetY, f.size, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }

      // droplets rendering removed

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      starsRef.current = starsRef.current.map((star) => ({
        ...star,
        x: Math.min(star.x, window.innerWidth),
        y: Math.min(star.y, window.innerHeight * 0.3),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="wave-canvas" />

      <div className="ocean-bg">
        <div className="horizon"></div>
        <div className="wave wave1"></div>
        <div className="wave wave2"></div>
        <div className="wave wave3"></div>
        <div className="wave wave4"></div>
        <div className="wave wave5"></div>
      </div>

      <div className="moon"></div>

      {/* cursor glow removed per user request */}
    </div>
  );
}

export default App;
