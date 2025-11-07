import React, { useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Play, Pause, RotateCcw, Save } from "lucide-react";

// ✅ Importar clases directamente (no usar window.*)
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks, HAND_CONNECTIONS } from "@mediapipe/drawing_utils";

type Landmark = { x: number; y: number; z: number; visibility?: number };
type Cycle = {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  confidence?: number;
  bodyKeypoints?: any[];
  handKeypoints?: any[];
};

const cryptoUUID = () =>
  (globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)) as string;

function phaseMetric(handLandmarks: Landmark[]): number {
  const wrist = handLandmarks[0];
  const indexTip = handLandmarks[8];
  if (!wrist || !indexTip) return 0;
  const dx = indexTip.x - wrist.x;
  const dy = indexTip.y - wrist.y;
  return Math.hypot(dx, dy);
}

class BoundaryDetector {
  private stateHigh = false;
  private lastBoundarySec: number | null = null;
  private minDurationSec: number;
  private onBoundary: (tSec: number) => void;
  private high: number;
  private low: number;

  constructor(opts: {
    high: number;
    low: number;
    minDurationSec: number;
    onBoundary: (tSec: number) => void;
  }) {
    if (opts.low >= opts.high) throw new Error("LOW debe ser < HIGH");
    this.high = opts.high;
    this.low = opts.low;
    this.minDurationSec = opts.minDurationSec;
    this.onBoundary = opts.onBoundary;
  }

  setThresholds(high: number, low: number) {
    if (low >= high) return;
    this.high = high;
    this.low = low;
  }
  setMinDuration(sec: number) {
    this.minDurationSec = Math.max(0, sec);
  }
  reset() {
    this.stateHigh = false;
    this.lastBoundarySec = null;
  }

  step(metric: number, tSec: number) {
    if (!this.stateHigh) {
      if (metric >= this.high) {
        this.tryBoundary(tSec);
        this.stateHigh = true;
      }
    } else {
      if (metric <= this.low) this.stateHigh = false;
    }
  }

  private tryBoundary(tSec: number) {
    if (this.lastBoundarySec === null) {
      this.lastBoundarySec = tSec;
      this.onBoundary(tSec);
      return;
    }
    const dt = tSec - this.lastBoundarySec;
    if (dt >= this.minDurationSec) {
      this.lastBoundarySec = tSec;
      this.onBoundary(tSec);
    }
  }
}

const RealTimeAnalyzer: React.FC<{
  onAnalysisReady?: (cycles: Cycle[]) => void;
  isAnalyzing?: boolean;
  setIsAnalyzing?: (v: boolean) => void;
}> = ({ onAnalysisReady, isAnalyzing, setIsAnalyzing }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const sessionStartRef = useRef<number | null>(null);
  const lastBoundarySecRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  const [high, setHigh] = useState(0.20);
  const [low, setLow] = useState(0.14);
  const [minDur, setMinDur] = useState(0.35);
  const [drawSkeleton, setDrawSkeleton] = useState(true);

  const detectorRef = useRef<BoundaryDetector | null>(null);
  useEffect(() => {
    detectorRef.current = new BoundaryDetector({
      high,
      low,
      minDurationSec: minDur,
      onBoundary: (tSec) => {
        const prev = lastBoundarySecRef.current;
        lastBoundarySecRef.current = tSec;
        if (prev !== null) {
          const cycle: Cycle = {
            id: cryptoUUID(),
            startTime: prev,
            endTime: tSec,
            duration: tSec - prev,
            confidence: 1,
            bodyKeypoints: [],
            handKeypoints: [],
          };
          setCycles((c) => [...c, cycle]);
        }
      },
    });
    return () => { detectorRef.current = null; };
  }, []);

  useEffect(() => { detectorRef.current?.setThresholds(high, low); }, [high, low]);
  useEffect(() => { detectorRef.current?.setMinDuration(minDur); }, [minDur]);

  useEffect(() => {
    const videoEl = videoRef.current!;
    const canvasEl = canvasRef.current!;
    const ctx = canvasEl.getContext("2d");

    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results: any) => {
      if (!ctx) return;
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvasEl.width, 0);
      ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);
      ctx.restore();

      if (drawSkeleton && results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { lineWidth: 2 });
          drawLandmarks(ctx, landmarks, { radius: 2 });
        }
      }

      if (running && results.multiHandLandmarks?.length) {
        const landmarks: Landmark[] = results.multiHandLandmarks[0];
        const metric = phaseMetric(landmarks);
        const nowMs = performance.now();
        if (sessionStartRef.current === null) sessionStartRef.current = nowMs;
        const tSec = (nowMs - sessionStartRef.current) / 1000;
        detectorRef.current?.step(metric, tSec);
      }
    });

    handsRef.current = hands;

    const camera = new Camera(videoEl, {
      onFrame: async () => { await hands.send({ image: videoEl }); },
      width: 1280,
      height: 720,
    });
    cameraRef.current = camera;

    camera.start().catch((e: any) => {
      console.error(e);
      toast.error("No se pudo iniciar la cámara. Concede permisos / elige otro dispositivo.");
    });

    return () => {
      camera.stop();
      hands.close();
    };
  }, [running, drawSkeleton]);

  const handleStart = () => {
    if (running) return;
    setCycles([]);
    sessionStartRef.current = null;
    lastBoundarySecRef.current = null;
    detectorRef.current?.reset();
    setRunning(true);
    setIsAnalyzing?.(true);
    toast.success("Grabando límites de ciclo…");
  };
  const handlePause = () => {
    setRunning(false);
    setIsAnalyzing?.(false);
    toast("Pausado");
  };
  const handleReset = () => {
    setRunning(false);
    setCycles([]);
    sessionStartRef.current = null;
    lastBoundarySecRef.current = null;
    detectorRef.current?.reset();
    setIsAnalyzing?.(false);
    toast("Reiniciado");
  };
  const handleSave = () => {
    if (!cycles.length) { toast("No hay ciclos aún"); return; }
    onAnalysisReady?.(cycles);
    toast.success("Ciclos enviados al historial");
  };

  const totalDuration = useMemo(
    () => cycles.reduce((acc, c) => acc + c.duration, 0),
    [cycles]
  );
  const avgDuration = useMemo(
    () => (cycles.length ? totalDuration / cycles.length : 0),
    [cycles, totalDuration]
  );
  const cadence = useMemo(
    () => (avgDuration > 0 ? 60 / avgDuration : 0),
    [avgDuration]
  );

  return (
    <div className="w-full h-full p-4 flex flex-col gap-4">
      <Toaster position="top-right" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden shadow">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="w-full h-auto bg-black" style={{ aspectRatio: "16/9" }} />

          <div className="absolute left-3 bottom-3 flex items-center gap-2">
            <button onClick={running ? handlePause : handleStart} className="px-3 py-2 rounded-2xl shadow bg-white/80 backdrop-blur hover:bg-white" title={running ? "Pausar" : "Iniciar"}>
              {running ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={handleReset} className="px-3 py-2 rounded-2xl shadow bg-white/80 backdrop-blur hover:bg-white" title="Reiniciar">
              <RotateCcw size={18} />
            </button>
            <button onClick={handleSave} className="px-3 py-2 rounded-2xl shadow bg-white/80 backdrop-blur hover:bg-white" title="Guardar ciclos en el historial">
              <Save size={18} />
            </button>
          </div>
        </div>

        <div className="lg:col-span-1 rounded-2xl p-4 border bg-white">
          <h3 className="font-semibold mb-3">Detección (1 marcador)</h3>

          <div className="space-y-3">
            <label className="block text-sm">
              Umbral alto (HIGH): {high.toFixed(2)}
              <input type="range" min={0.05} max={0.50} step={0.005} value={high} onChange={(e) => setHigh(parseFloat(e.target.value))} className="w-full" />
            </label>

            <label className="block text-sm">
              Umbral bajo (LOW): {low.toFixed(2)}
              <input type="range" min={0.03} max={0.45} step={0.005} value={low} onChange={(e) => setLow(parseFloat(e.target.value))} className="w-full" />
            </label>

            <label className="block text-sm">
              Duración mínima (s): {minDur.toFixed(2)}
              <input type="range" min={0.10} max={2.00} step={0.01} value={minDur} onChange={(e) => setMinDur(parseFloat(e.target.value))} className="w-full" />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={drawSkeleton} onChange={(e) => setDrawSkeleton(e.target.checked)} />
              Dibujar esqueleto
            </label>

            <div className="mt-4 text-sm grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-500">Ciclos</div>
                <div className="text-xl font-semibold">{cycles.length}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-500">Cadencia (cpm)</div>
                <div className="text-xl font-semibold">{cadence.toFixed(1)}</div>
              </div>
              <div className="p-2 rounded bg-gray-50 col-span-2">
                <div className="text-gray-500">Duración promedio (s)</div>
                <div className="text-xl font-semibold">{avgDuration.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeAnalyzer;
