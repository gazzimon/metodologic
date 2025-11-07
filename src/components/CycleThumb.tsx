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
  // si están en [0..1] (normalizados) igual los pintamos; si vienen en px también
  handKeypoints?: Keypoint[];
  bodyKeypoints?: Keypoint[];
};

type Props = {
  cycle: CycleForThumb;
  videoUrl?: string;    // URL del video (blob o http) para extraer el frame
  width?: number;       // default 120
  height?: number;      // default 68 (16:9 compacto)
  showBody?: boolean;   // dibujar cuerpo si hay keypoints
  showHands?: boolean;  // dibujar manos si hay keypoints
};

/** Conexiones básicas de mano (similar a MediaPipe HAND_CONNECTIONS) */
const HAND_EDGES: [number, number][] = [
  // palm
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9,10], [10,11], [11,12],
  [9,13], [13,14], [14,15], [15,16],
  [13,17], [17,18], [18,19], [19,20],
  [0,17]
];

/** Conexiones muy simples de cuerpo (si algún día usás pose 33pts) */
const BODY_EDGES: [number, number][] = [
  [11,12], // hombros
  [11,13], [13,15], // brazo izq
  [12,14], [14,16], // brazo der
  [23,24], // caderas
  [11,23], [12,24]  // tronco diagonal
];

function maybeNormalizedToPx(p: Keypoint, W: number, H: number): {x:number; y:number} {
  // Si parecen estar en [0..1], escalamos; si ya son px, los limitamos al canvas
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
  showHands = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fondo base
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // 1) Si tenemos videoUrl: capturamos el frame del fin de ciclo
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

      const target = Math.max(0, cycle.endTime - 0.001); // un pelín antes del final por seguridad

      const drawFrame = () => {
        try {
          ctx.drawImage(video, 0, 0, width, height);
          drawRigOnly(ctx, width, height); // si hay keypoints, superponemos rig
        } catch {
          // si no pudo dibujar, al menos mostramos el rig sólo
          drawRigOnly(ctx, width, height);
        }
      };

      const onLoaded = () => {
        // ajustamos el tiempo y esperamos el evento "seeked"
        // notá que algunos navegadores requieren user-gesture para reproducir;
        // acá NO reproducimos, sólo saltamos al tiempo:
        video.currentTime = target;
      };

      const onSeeked = () => {
        drawFrame();
        cleanup();
      };

      const onError = () => {
        // fallback: sin video, solo rig
        drawRigOnly(ctx, width, height);
        cleanup();
      };

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      // Inicia carga
      video.load();
    };

    const drawRigOnly = (context: CanvasRenderingContext2D, W: number, H: number) => {
      // semi-transparente para distinguir del fondo
      context.globalAlpha = 0.85;

      // Manos
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

      // Cuerpo (si existe)
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
      // Borde
      context.strokeStyle = "rgba(255,255,255,0.2)";
      context.lineWidth = 1;
      context.strokeRect(0.5, 0.5, W - 1, H - 1);

      // Etiqueta del timestamp
      context.fillStyle = "rgba(0,0,0,0.6)";
      context.fillRect(4, H - 18, 48, 14);
      context.fillStyle = "#fff";
      context.font = "10px ui-sans-serif, system-ui";
      context.fillText(formatTs(cycle.endTime), 8, H - 7);
    };

    drawFromVideo();
  }, [cycle, videoUrl, width, height, showBody, showHands]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-gray-200"
      title={`Fin: ${formatTs(cycle.endTime)}`}
    />
  );
};

function formatTs(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
}

export default CycleThumb;
