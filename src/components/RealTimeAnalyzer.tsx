import React, { useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Play, Pause, RotateCcw, Save } from "lucide-react";

// MediaPipe
// Asegúrate de tener instalados:
//   npm i @mediapipe/hands @mediapipe/camera_utils @mediapipe/drawing_utils
// y de que Vite resuelva correctamente los assets de mediapipe.
import "@mediapipe/hands";
import "@mediapipe/camera_utils";
import "@mediapipe/drawing_utils";

type Landmark = { x: number; y: number; z: number; visibility?: number };
type Cycle = {
  id: string;
  startTime: number; // segundos
  endTime: number;   // segundos
  duration: number;  // end - start
  confidence?: number;
  bodyKeypoints?: any[];
  handKeypoints?: any[];
};

declare global {
  // Tipos globales expuestos por los bundles de MediaPipe
  // (evitamos importar tipos internos no ESM)
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

const cryptoUUID = () =>
  (globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)) as string;

// --------- Utilidades de señal / detección de “límite de ciclo” ---------

/**
 * Métrica de fase: distancia 2D entre la muñeca y la punta del índice (landmark 0 y 8).
 * Puedes reemplazar esta métrica por otra que represente mejor TU gesto/ritmo.
 */
function phaseMetric(handLandmarks: Landmark[]): number {
  // wrist = 0, index_finger_tip = 8
  const wrist = handLandmarks[0];
  const indexTip = handLandmarks[8];
  if (!wrist || !indexTip) return 0;

  const dx = indexTip.x - wrist.x;
  const dy = indexTip.y - wrist.y;
  const dist = Math.hypot(dx, dy);

  // La norma de MediaPipe está en [0..1] relativo al frame.
  // Devolvemos la distancia como métrica de fase.
  return dist;
}

/**
 * Detector con histeresis (alto/bajo). Detecta un “límite de ciclo” cuando
 * la métrica cruza el umbral ALTO (de estado bajo→alto).
 * El estado vuelve a “bajo” cuando la métrica cae por debajo de LOW.
 */
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
    if (opts.low >= opts.high) {
      throw new Error("Histeresis inválida: LOW debe ser < HIGH");
    }
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
      // Estado BAJO -> esperamos cruce por HIGH para generar límite
      if (metric >= this.high) {
        // Boundary detectado
        this.tryBoundary(tSec);
        this.stateHigh = true;
      }
    } else {
      // Estado ALTO -> esperamos caer por debajo de LOW para “rearmar”
      if (metric <= this.low) {
        this.stateHigh = false;
      }
    }
  }

  private tryBoundary(tSec: number) {
    if (this.lastBoundarySec === null) {
      this.lastBoundarySec = tSec;
      this.onBoundary(tSec); // Primer hito (no formará ciclo aún, pero es útil visualizar)
      return;
    }
    const dt = tSec - this.lastBoundarySec;
    if (dt >= this.minDurationSec) {
      this.lastBoundarySec = tSec;
      this.onBoundary(tSec);
    }
    // Si dt < minDuration, ignoramos este boundary (ruido).
  }
}

// --------- Componente principal ---------

const RealTimeAnalyzer: React.FC<{
  onAnalysisReady?: (cycles: Cycle[]) => void;
}> = ({ onAnalysisReady }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  // Tiempos / resultados
  const sessionStartRef = useRef<number | null>(null); // performance.now() en ms
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const lastBoundarySecRef = useRef<number | null>(null);

  // Parámetros de detección
  const [high, setHigh] = useState(0.20);        // umbral alto (distancia wrist-index)
  const [low, setLow] = useState(0.14);          // umbral bajo
  const [minDur, setMinDur] = useState(0.35);    // duración mínima del ciclo (seg)
  const [drawSkeleton, setDrawSkeleton] = useState(true);

  // Detector con histeresis
  const detectorRef = useRef<BoundaryDetector | null>(null);
  useEffect(() => {
    detectorRef.current = new BoundaryDetector({
      high,
      low,
      minDurationSec: minDur,
      onBoundary: (tSec) => {
        // Cada boundary “cierra” el ciclo anterior y abre el nuevo
        const prev = lastBoundarySecRef.current;
        lastBoundarySecRef.current = tSec;

        if (prev !== null) {
          const start = prev;
          const end = tSec;
          const duration = end - start;
          const cycle: Cycle = {
            id: cryptoUUID(),
            startTime: start,
            endTime: end,
            duration,
            confidence: 1, // puedes calcular un score real
            bodyKeypoints: [],
            handKeypoints: [],
          };
          setCycles((c) => [...c, cycle]);
        }
      },
    });

    return () => {
      detectorRef.current = null;
    };
  }, []); // init

  // Mantener thresholds/duración en el detector
  useEffect(() => {
    detectorRef.current?.setThresholds(high, low);
  }, [high, low]);
  useEffect(() => {
    detectorRef.current?.setMinDuration(minDur);
  }, [minDur]);

  // Inicialización de MediaPipe Hands
  useEffect(() => {
    const Hands = (window as any).Hands;
    const Camera = (window as any).Camera;
    const drawLandmarks = (window as any).drawLandmarks;
    const drawConnectors = (window as any).drawConnectors;
    const HAND_CONNECTIONS = (window as any).HAND_CONNECTIONS;

    if (!Hands || !Camera) {
      toast.error(
        "No se cargaron las dependencias de MediaPipe. Revisa @mediapipe/hands y @mediapipe/camera_utils."
      );
      return;
    }

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
      // Pintar frame
      if (!ctx) return;
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;

      ctx.save();
      // Espejo horizontal
      ctx.scale(-1, 1);
      ctx.translate(-canvasEl.width, 0);
      ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);
      ctx.restore();

      // Dibujar esqueletos
      if (drawSkeleton && results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { lineWidth: 2 });
          drawLandmarks(ctx, landmarks, { radius: 2 });
        }
      }

      // Detección de límites (si estamos corriendo)
      if (running && results.multiHandLandmarks?.length) {
        const landmarks: Landmark[] = results.multiHandLandmarks[0];
        const metric = phaseMetric(landmarks);

        // Tiempo relativo en segundos desde el inicio de sesión
        const nowMs = performance.now();
        if (sessionStartRef.current === null) {
          sessionStartRef.current = nowMs;
        }
        const tSec = (nowMs - sessionStartRef.current) / 1000;

        detectorRef.current?.step(metric, tSec);
      }
    });

    handsRef.current = hands;

    // Cámara
    const camera = new Camera(videoEl, {
      onFrame: async () => {
        await hands.send({ image: videoEl });
      },
      width: 1280,
      height: 720,
    });
    cameraRef.current = camera;

    // Autostart cámara
    camera.start().catch((e: any) => {
      console.error(e);
      toast.error("No se pudo iniciar la cámara. Da permisos o elige otro dispositivo.");
    });

    return () => {
      camera.stop();
      hands.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, drawSkeleton]);

  // Controles
  const handleStart = () => {
    if (running) return;
    // reset estado
    setCycles([]);
    sessionStartRef.current = null;
    lastBoundarySecRef.current = null;
    detectorRef.current?.reset();
    setRunning(true);
    toast.success("Grabando límites de ciclo…");
  };

  const handlePause = () => {
    setRunning(false);
    toast("Pausado");
  };

  const handleReset = () => {
    setRunning(false);
    setCycles([]);
    sessionStartRef.current = null;
    lastBoundarySecRef.current = null;
    detectorRef.current?.reset();
    toast("Reiniciado");
  };

  const handleSave = () => {
    if (!cycles.length) {
      toast("No hay ciclos aún");
      return;
    }
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
    () => (avgDuration > 0 ? 60 / avgDuration : 0), // ciclos por minuto
    [avgDuration]
  );

  return (
    <div className="w-full h-full p-4 flex flex-col gap-4">
      <Toaster position="top-right" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Video / Canvas */}
        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden shadow">
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="w-full h-auto bg-black"
            style={{ aspectRatio: "16/9" }}
          />
          <div className="absolute left-3 bottom-3 flex items-center gap-2">
            <button
              onClick={running ? handlePause : handleStart}
              className="px-3 py-2 rounded-2xl shadow bg-white/80 backdrop-blur hover:bg-white"
              title={running ? "Pausar" : "Iniciar"}
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-2xl shadow bg-white/80 backdrop-blur hover:bg-white"
              title="Reiniciar"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-2 rounded-2xl shadow bg-white/80 backdrop-blur hover:bg-white"
              title="Guardar ciclos en el historial"
            >
              <Save size={18} />
            </button>
          </div>
        </div>

        {/* Panel de control */}
        <div className="lg:col-span-1 rounded-2xl p-4 border bg-white">
          <h3 className="font-semibold mb-3">Detección (1 marcador)</h3>

          <div className="space-y-3">
            <label className="block text-sm">
              Umbral alto (HIGH): {high.toFixed(2)}
              <input
                type="range"
                min={0.05}
                max={0.50}
                step={0.005}
                value={high}
                onChange={(e) => setHigh(parseFloat(e.target.value))}
                className="w-full"
              />
            </label>

            <label className="block text-sm">
              Umbral bajo (LOW): {low.toFixed(2)}
              <input
                type="range"
                min={0.03}
                max={0.45}
                step={0.005}
                value={low}
                onChange={(e) => setLow(parseFloat(e.target.value))}
                className="w-full"
              />
            </label>

            <label className="block text-sm">
              Duración mínima (s): {minDur.toFixed(2)}
              <input
                type="range"
                min={0.10}
                max={2.00}
                step={0.01}
                value={minDur}
                onChange={(e) => setMinDur(parseFloat(e.target.value))}
                className="w-full"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={drawSkeleton}
                onChange={(e) => setDrawSkeleton(e.target.checked)}
              />
              Dibujar esqueleto
            </label>

            <div className="mt-4 text-sm grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-500">Ciclos</div>
                <div className="text-xl font-semibold">{cycles.length}</div>
              </div>
              <div className="p-2 rounded bg-gray-50">
                <div className="text-gray-500">Cadencia (cpm)</div>
                <div className="text-xl font-semibold">
                  {cadence.toFixed(1)}
                </div>
              </div>
              <div className="p-2 rounded bg-gray-50 col-span-2">
                <div className="text-gray-500">Duración promedio (s)</div>
                <div className="text-xl font-semibold">
                  {avgDuration.toFixed(2)}
                </div>
              </div>
            </div>

            <hr className="my-3" />

            <div className="max-h-52 overflow-auto text-xs">
              {cycles.map((c) => (
                <div key={c.id} className="py-1 flex justify-between">
                  <span>
                    {formatTime(c.startTime)} → {formatTime(c.endTime)}
                  </span>
                  <span>{c.duration.toFixed(2)}s</span>
                </div>
              ))}
              {!cycles.length && (
                <div className="text-gray-500">Sin ciclos detectados todavía…</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------- Helpers de formato ---------

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export default RealTimeAnalyzer;
