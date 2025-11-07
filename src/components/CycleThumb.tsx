import React, { useEffect, useRef } from "react";

type Keypoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  name?: string;
};

export type CycleForThumb = {
  id: string;
  startTime: number;
  endTime: number;
  duration?: number;
  confidence?: number;
  handKeypoints?: Keypoint[];
  bodyKeypoints?: Keypoint[];
};

type Props = {
  cycle: CycleForThumb;
  videoUrl?: string;
  width?: number;
  height?: number;
  showBody?: boolean;
  showHands?: boolean;
};

const HAND_EDGES: [number, number][] = [
  [0, 1],[1, 2],[2, 3],[3, 4],
  [0, 5],[5, 6],[6, 7],[7, 8],
  [5, 9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

const BODY_EDGES: [number, number][] = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [23,24],[11,23],[12,24],
];

function maybeNormalizedToPx(p: Keypoint, W: number, H: number) {
  const isNorm = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const x = isNorm ? p.x * W : p.x;
  const y = isNorm ? p.y * H : p.y;
  return { x: Math.max(0, Math.min(W, x)), y: Math.max(0, Math.min(H, y)) };
}

const CycleThumb: React.FC<Props> = ({
  cycle,
  videoUrl,
  width = 120,
  height = 68,
  showBody = true,
  showHands = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 🔧 Evita que CSS global (e.g., canvas { width: 100% }) lo estire
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawRigOnly = (context: CanvasRenderingContext2D, W: number, H: number) => {
      context.globalAlpha = 0.85;

      if (showHands && Array.isArray(cycle.handKeypoints) && cycle.handKeypoints.length >= 21) {
        context.strokeStyle = "#00E5FF";
        context.lineWidth = 2;
        HAND_EDGES.forEach(([a, b]) => {
          const p1 = maybeNormalizedToPx(cycle.handKeypoints![a], W, H);
          const p2 = maybeNormalizedToPx(cycle.handKeypoints![b], W, H);
          context.beginPath();
          context.moveTo(p1.x, p1.y);
          context.lineTo(p2.x, p2.y);
          context.stroke();
        });
        context.fillStyle = "#00E5FF";
        for (let i = 0; i < 21; i++) {
          const p = maybeNormalizedToPx(cycle.handKeypoints![i], W, H);
          context.beginPath();
          context.arc(p.x, p.y, 2, 0, Math.PI * 2);
          context.fill();
        }
      }

      if (showBody && Array.isArray(cycle.bodyKeypoints) && cycle.bodyKeypoints.length >= 25) {
        context.strokeStyle = "#7C3AED";
        context.lineWidth = 2;
        BODY_EDGES.forEach(([a, b]) => {
          const p1 = maybeNormalizedToPx(cycle.bodyKeypoints![a], W, H);
          const p2 = maybeNormalizedToPx(cycle.bodyKeypoints![b], W, H);
          context.beginPath();
          context.moveTo(p1.x, p1.y);
          context.lineTo(p2.x, p2.y);
          context.stroke();
        });
        context.fillStyle = "#7C3AED";
        for (let i = 0; i < cycle.bodyKeypoints!.length; i++) {
          const p = maybeNormalizedToPx(cycle.bodyKeypoints![i], W, H);
          context.beginPath();
          context.arc(p.x, p.y, 2, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.globalAlpha = 1;
      context.strokeStyle = "rgba(255,255,255,0.2)";
      context.lineWidth = 1;
      context.strokeRect(0.5, 0.5, W - 1, H - 1);

      context.fillStyle = "rgba(0,0,0,0.6)";
      context.fillRect(4, H - 18, 48, 14);
      context.fillStyle = "#fff";
      context.font = "10px ui-sans-serif, system-ui";
      context.fillText(formatTs(cycle.endTime), 8, H - 7);
    };

    const drawFromVideo = async () => {
      if (!videoUrl) {
        drawRigOnly(ctx, width, height);
        return;
      }
      const video = document.createElement("video");
      video.src = videoUrl;
      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.muted = true;

      const target = Math.max(0, cycle.endTime - 0.001);

      const onLoaded = () => { video.currentTime = target; };
      const onSeeked = () => {
        try {
          ctx.drawImage(video, 0, 0, width, height);
        } catch {}
        drawRigOnly(ctx, width, height);
        cleanup();
      };
      const onError = () => { drawRigOnly(ctx, width, height); cleanup(); };
      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.load();
    };

    // Fondo negro inicial + rig o frame
    const ctxFill = canvas.getContext("2d");
    if (ctxFill) {
      ctxFill.fillStyle = "#000";
      ctxFill.fillRect(0, 0, width, height);
    }
    drawFromVideo();
  }, [cycle, videoUrl, width, height, showBody, showHands]);

  return (
    <div
      className="inline-block align-middle"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        className="cycle-thumb rounded border border-gray-200 block"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  );
};

function formatTs(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
}

export default CycleThumb;
