import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  depth: number;
  phase: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)");
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let raf = 0;

    // NEW: where the mouse is (target) and where the stars currently are (eased)
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(140, Math.floor((width * height) / 12000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.2 + 0.3,
        depth: Math.random() * 0.8 + 0.2,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const scroll = window.scrollY;
      const still = reduced.matches;

      // NEW: glide towards the mouse position a little each frame
      if (!still) {
        eased.x += (target.x - eased.x) * 0.05;
        eased.y += (target.y - eased.y) * 0.05;
      }

      for (const s of stars) {
        const drift = still ? 0 : time * 0.004 * s.depth;

        // NEW: nearer stars (higher depth) shift further, opposite the cursor
        const offsetX = -eased.x * 40 * s.depth;
        const offsetY = -eased.y * 40 * s.depth;

        const x = (((s.x + offsetX) % width) + width) % width;
        const y =
          (((s.y - drift - scroll * 0.05 * s.depth + offsetY) % height) +
            height) %
          height;

        const twinkle = still
          ? 0.5
          : 0.35 + 0.25 * Math.sin(time * 0.001 + s.phase);

        ctx.globalAlpha = twinkle * s.depth;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (time: number) => {
      draw(time);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced.matches) draw(0);
      else raf = requestAnimationFrame(loop);
    };

    const onResize = () => {
      if (
        window.innerWidth !== width ||
        Math.abs(window.innerHeight - height) > 150
      ) {
        setup();
        start();
      }
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };

    // NEW: record the cursor position as a value from -0.5 to 0.5
    const onMouseMove = (e: MouseEvent) => {
      target.x = e.clientX / width - 0.5;
      target.y = e.clientY / height - 0.5;
    };

    // NEW: drift back to centre when the cursor leaves the window
    const onMouseLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    setup();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", start);

    if (hasMouse.matches) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      document.documentElement.addEventListener("mouseleave", onMouseLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", start);
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}