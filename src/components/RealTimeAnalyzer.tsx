import { useState, useRef, useEffect } from 'react'
import { Camera, Square, Play, Pause, RotateCcw } from 'lucide-react'
import { Hands } from '@mediapipe/hands'
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import toast from 'react-hot-toast'

interface Cycle {
  id: string
  startTime: number
  endTime: number
  duration: number
  confidence: number
  bodyKeypoints: any[]
  handKeypoints: any[]
}

interface AnalysisResult {
  id: string
  timestamp: number
  cycles: Cycle[]
  averageCycleTime: number
}

interface RealTimeAnalyzerProps {
  onAnalysisComplete: (result: AnalysisResult) => void
  isAnalyzing: boolean
  setIsAnalyzing: (analyzing: boolean) => void
}

const RealTimeAnalyzer: React.FC<RealTimeAnalyzerProps> = ({
  onAnalysisComplete,
  isAnalyzing,
  setIsAnalyzing
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handsRef = useRef<Hands | null>(null)
  const cameraRef = useRef<MediaPipeCamera | null>(null)
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null)
  const [cycleStartTime, setCycleStartTime] = useState<number | null>(null)

  // MediaPipe Hands configuration
  const handsConfig = {
    staticImageMode: false,
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      })
      
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          initializeMediaPipe()
        }
      }
      
      toast.success('Cámara iniciada correctamente')
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast.error('No se pudo acceder a la cámara')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (cameraRef.current) {
      cameraRef.current.stop()
    }
  }

  const initializeMediaPipe = () => {
    // Initialize Hands
    const hands = new Hands(handsConfig)
    hands.setOptions(handsConfig)
    
    hands.onResults((results) => {
      drawResults(results)
      detectCycles(results)
    })
    
    handsRef.current = hands

    // Initialize Camera
    if (videoRef.current && canvasRef.current) {
      const camera = new MediaPipeCamera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && canvasRef.current && handsRef.current) {
            await handsRef.current.send({ image: videoRef.current })
          }
        },
        width: 640,
        height: 480
      })
      
      cameraRef.current = camera
      
      if (isAnalyzing) {
        camera.start()
      }
    }
  }

  const drawResults = (results: any) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw video frame
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    ctx.restore()

    // Draw hand landmarks and connections
    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i]
        const handedness = results.multiHandedness[i]

        // Draw connections
        drawConnectors(ctx, landmarks, hands.HAND_CONNECTIONS, {
          color: handedness.label === 'Left' ? '#00ff00' : '#ff0000',
          lineWidth: 3
        })

        // Draw landmarks
        drawLandmarks(ctx, landmarks, {
          color: '#00ff00',
          lineWidth: 2,
          radius: 3
        })
      }
    }
  }

  const detectCycles = (results: any) => {
    const currentTime = Date.now() / 1000
    
    // Simple cycle detection logic
    // A cycle starts when hands are detected after a period of no hands
    // and ends when hands disappear or change significantly
    
    const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0
    
    if (hasHands && !currentCycle) {
      // Start new cycle
      const newCycle: Cycle = {
        id: `cycle_${currentTime}`,
        startTime: currentTime,
        endTime: 0,
        duration: 0,
        confidence: results.multiHandLandmarks.length > 0 ? 0.8 : 0.3,
        bodyKeypoints: [], // Add pose detection here
        handKeypoints: results.multiHandLandmarks[0] || []
      }
      setCurrentCycle(newCycle)
      setCycleStartTime(currentTime)
      toast.success('Ciclo iniciado')
    } else if (!hasHands && currentCycle) {
      // End current cycle
      const completedCycle: Cycle = {
        ...currentCycle,
        endTime: currentTime,
        duration: currentTime - currentCycle.startTime
      }
      
      setCycles(prev => [...prev, completedCycle])
      setCurrentCycle(null)
      setCycleStartTime(null)
      toast.success(`Ciclo completado: ${completedCycle.duration.toFixed(2)}s`)
    }
  }

  const startAnalysis = async () => {
    setIsAnalyzing(true)
    if (!stream) {
      await startCamera()
    }
    
    if (cameraRef.current) {
      cameraRef.current.start()
    }
    
    toast.success('Análisis en tiempo real iniciado')
  }

  const stopAnalysis = () => {
    setIsAnalyzing(false)
    if (cameraRef.current) {
      cameraRef.current.stop()
    }
    
    // Complete current cycle if exists
    if (currentCycle) {
      const completedCycle: Cycle = {
        ...currentCycle,
        endTime: Date.now() / 1000,
        duration: (Date.now() / 1000) - currentCycle.startTime
      }
      setCycles(prev => [...prev, completedCycle])
      setCurrentCycle(null)
    }
    
    toast.success('Análisis detenido')
  }

  const resetAnalysis = () => {
    stopCamera()
    setCycles([])
    setCurrentCycle(null)
    setCycleStartTime(null)
    setIsAnalyzing(false)
    toast.success('Análisis reiniciado')
  }

  const saveAnalysis = () => {
    if (cycles.length === 0) {
      toast.error('No hay ciclos para guardar')
      return
    }

    const result: AnalysisResult = {
      id: `analysis_${Date.now()}`,
      timestamp: Date.now(),
      cycles: cycles,
      averageCycleTime: cycles.reduce((sum, cycle) => sum + cycle.duration, 0) / cycles.length
    }

    onAnalysisComplete(result)
    toast.success('Análisis guardado correctamente')
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Análisis en Tiempo Real
        </h2>
        <div className="flex space-x-2">
          {!isAnalyzing ? (
            <button
              onClick={startAnalysis}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar
            </button>
          ) : (
            <button
              onClick={stopAnalysis}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Pause className="h-4 w-4 mr-2" />
              Detener
            </button>
          )}
          
          <button
            onClick={resetAnalysis}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reiniciar
          </button>
          
          <button
            onClick={saveAnalysis}
            disabled={cycles.length === 0}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Guardar Análisis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video and Canvas */}
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover"
              autoPlay
              muted
              playsInline
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            />
            
            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                <button
                  onClick={startCamera}
                  className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Camera className="h-6 w-6 mr-2" />
                  Activar Cámara
                </button>
              </div>
            )}
          </div>

          {currentCycle && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <Square className="h-5 w-5 text-green-600 mr-2" />
                <span className="font-medium text-green-800">
                  Ciclo en progreso...
                </span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Iniciado: {currentCycle.startTime.toFixed(2)}s
              </p>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Estadísticas del Análisis
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-600">Ciclos Detectados</p>
              <p className="text-2xl font-bold text-blue-900">{cycles.length}</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-600">Promedio</p>
              <p className="text-2xl font-bold text-green-900">
                {cycles.length > 0 
                  ? (cycles.reduce((sum, c) => sum + c.duration, 0) / cycles.length).toFixed(2)
                  : '0.00'
                }s
              </p>
            </div>
          </div>

          {cycles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Últimos Ciclos</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {cycles.slice(-5).map((cycle, index) => (
                  <div
                    key={cycle.id}
                    className="bg-gray-50 border border-gray-200 rounded p-3 text-sm"
                  >
                    <div className="flex justify-between">
                      <span>Ciclo {cycles.length - 5 + index + 1}</span>
                      <span className="font-medium">{cycle.duration.toFixed(2)}s</span>
                    </div>
                    <p className="text-gray-500">
                      {new Date(cycle.startTime * 1000).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RealTimeAnalyzer