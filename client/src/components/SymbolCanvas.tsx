import { useEffect, useRef } from "react";

const hash = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;
  return Math.abs(h >>> 0);
};

export const SymbolCanvas = ({ seed, size = 96 }: { seed: string; size?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const h = hash(seed);
    const c1 = `hsl(${h % 360}, 72%, 56%)`;
    const c2 = `hsl(${(h / 2) % 360}, 65%, 40%)`;
    const c3 = `hsl(${(h / 3) % 360}, 70%, 75%)`;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = c3;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c2;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((h % 360) * (Math.PI / 180));
    ctx.fillRect(-size / 10, -size / 2.5, size / 5, size / 1.25);
    ctx.restore();
  }, [seed, size]);

  return <canvas width={size} height={size} ref={ref} style={{ borderRadius: 12 }} />;
};
