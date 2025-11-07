import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Play, FileVideo, Clock } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

import { enforceContinuity, type Cycle } from '../lib/enforceContinuity'

interface AnalysisResult {
  id: string
  timestamp: number
  cycles: Cycle[]
  averageCycleTime: number
}

interface VideoUploaderProps {
  onAnalysisComplete: (result: AnalysisResult) => void
}

const API_URL = 'http://localhost:3001/api/upload'

const VideoUploader: React.FC<VideoUploaderProps> = ({ onAnalysisComplete }) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setUploadedFile(file)
      toast.success(`Archivo seleccionado: ${file.name}`)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'] },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024
  })

  const uploadAndAnalyze = async () => {
    if (!uploadedFile) {
      toast.error('Por favor selecciona un video primero')
      return
    }

    setIsUploading(true)
    setIsAnalyzing(true)
    setAnalysisProgress(0)

    const formData = new FormData()
    formData.append('video', uploadedFile)

    try {
      // progreso “cosmético” durante la subida
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      const response = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      clearInterval(progressInterval)
      setAnalysisProgress(100)

      // --------- Integramos ambos escenarios: backend real o mock ---------
      // Esperamos del backend: { success?: boolean, id?, timestamp?, cycles?: Cycle[] }
      const payload = response?.data ?? {}

      // Si el backend todavía no devuelve ciclos reales,
      // usamos mock y normalizamos igual:
      let rawCycles: Cycle[] =
        Array.isArray(payload?.cycles) ? payload.cycles : generateMockCycles(uploadedFile.name)

      // 🔧 Normalizar a estudio continuo: start[i] = end[i-1]
      const fixed = enforceContinuity(rawCycles, { clampNonPositive: true })

      const avg =
        fixed.length > 0
          ? fixed.reduce((sum, c) => sum + (c.duration ?? c.endTime - c.startTime), 0) / fixed.length
          : 0

      const result: AnalysisResult = {
        id: payload.id ?? `video_analysis_${Date.now()}`,
        timestamp: payload.timestamp ?? Date.now(),
        cycles: fixed,
        averageCycleTime: avg
      }

      onAnalysisComplete(result)
      toast.success('Análisis de video completado (ciclos normalizados).')
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    } catch (error) {
      console.error('Upload/Analysis error:', error)
      toast.error('Error al subir o analizar el video')
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  // --------- Generador de mock (se normaliza igual con enforceContinuity) ---------
  const generateMockCycles = (videoName: string): Cycle[] => {
    const base = videoName.includes('assembly') ? 12 : videoName.includes('welding') ? 8 : 10
    const total = Math.floor(Math.random() * 10) + 5 // 5–15 ciclos

    const arr: Cycle[] = []
    for (let i = 0; i < total; i++) {
      // generan “rangos” sueltos; luego enforceContinuity se encarga de pegarlos
      const startTime = i * base + Math.random() * 2
      const endTime = startTime + base + (Math.random() * 3 - 1.5)
      arr.push({
        id: `video_cycle_${i}`,
        startTime,
        endTime,
        duration: endTime - startTime,
        confidence: 0.7 + Math.random() * 0.3,
        bodyKeypoints: generateMockKeypoints('body'),
        handKeypoints: generateMockKeypoints('hand')
      })
    }
    return arr
  }

  const generateMockKeypoints = (type: 'body' | 'hand') => {
    const pts = []
    const n = type === 'body' ? 33 : 21
    for (let i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * 640,
        y: Math.random() * 480,
        z: Math.random() * 0.5,
        visibility: Math.random(),
        name: `${type}_point_${i}`
      })
    }
    return pts
  }

  const removeFile = () => {
    setUploadedFile(null)
    setAnalysisProgress(0)
    setIsAnalyzing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Análisis de Video</h2>
      </div>

      {/* Upload Area */}
      <div className="space-y-4">
        {!uploadedFile ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-lg text-blue-600">Suelta el video aquí...</p>
            ) : (
              <div>
                <p className="text-lg text-gray-600 mb-2">
                  Arrastra un video aquí o haz clic para seleccionar
                </p>
                <p className="text-sm text-gray-500">
                  Formatos soportados: MP4, AVI, MOV, MKV, WebM (máx. 500MB)
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileVideo className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button onClick={removeFile} className="text-red-600 hover:text-red-800 text-sm font-medium">
                Remover
              </button>
            </div>
          </div>
        )}

        {/* Analysis Button */}
        {uploadedFile && !isAnalyzing && (
          <button
            onClick={uploadAndAnalyze}
            disabled={isUploading}
            className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Subiendo y Analizando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Analizar Video
              </>
            )}
          </button>
        )}

        {/* Progress Bar */}
        {isAnalyzing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {analysisProgress < 90 ? 'Subiendo video...' : 'Analizando ciclos...'}
              </span>
              <span className="text-sm text-gray-600">{analysisProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${analysisProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Instrucciones para el Análisis</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start"><Clock className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" /> El video debe mostrar claramente las manos y el cuerpo del trabajador</li>
          <li className="flex items-start"><Clock className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" /> Los ciclos deben ser consistentes y repetitivos</li>
          <li className="flex items-start"><Clock className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" /> Buena iluminación mejora la precisión de la detección</li>
          <li className="flex items-start"><Clock className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" /> El sistema detectará automáticamente manos y puntos clave del cuerpo</li>
        </ul>
      </div>
    </div>
  )
}

export default VideoUploader
