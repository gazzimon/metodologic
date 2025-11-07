import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { Play, Video, Camera, Settings } from 'lucide-react'
import RealTimeAnalyzer from './components/RealTimeAnalyzer'
import VideoUploader from './components/VideoUploader'
import CycleEditor from './components/CycleEditor'
import './App.css'

export type AnalysisMode = 'realtime' | 'video' | 'edit'

interface AnalysisResult {
  id: string
  timestamp: number
  cycles: Array<{
    id: string
    startTime: number
    endTime: number
    duration: number
    confidence: number
    bodyKeypoints: any[]
    handKeypoints: any[]
  }>
  averageCycleTime: number
}

function App() {
  const [currentMode, setCurrentMode] = useState<AnalysisMode>('realtime')
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Play className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Analizador de Ciclos Industriales
              </h1>
            </div>
            
            <nav className="flex space-x-8">
              <button
                onClick={() => setCurrentMode('realtime')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'realtime'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Camera className="h-4 w-4 mr-2" />
                Tiempo Real
              </button>
              
              <button
                onClick={() => setCurrentMode('video')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'video'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Video className="h-4 w-4 mr-2" />
                Subir Video
              </button>
              
              <button
                onClick={() => setCurrentMode('edit')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'edit'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="h-4 w-4 mr-2" />
                Editar Ciclos
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          {currentMode === 'realtime' && (
            <RealTimeAnalyzer
              onAnalysisReady={(cycles) => {
                const result = {
                  id: crypto.randomUUID(),
                  timestamp: Date.now(),
                  cycles,
                  averageCycleTime:
                    cycles.reduce((a, c) => a + c.duration, 0) / Math.max(1, cycles.length),
                }
                setAnalysisResults(prev => [...prev, result])
              }}
              isAnalyzing={isAnalyzing}
              setIsAnalyzing={setIsAnalyzing}
            />
          )}
          
          {currentMode === 'video' && (
            <VideoUploader
              onAnalysisComplete={(results) => setAnalysisResults(prev => [...prev, results])}
            />
          )}
          
          {currentMode === 'edit' && (
            <CycleEditor
              results={analysisResults}
              onResultsUpdate={setAnalysisResults}
            />
          )}
        </div>
        
        {/* Analysis History */}
        {analysisResults.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Historial de Análisis
            </h2>
            <div className="space-y-4">
              {analysisResults.map((result) => (
                <div
                  key={result.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-500">
                        {new Date(result.timestamp).toLocaleString()}
                      </p>
                      <p className="font-medium">
                        {result.cycles.length} ciclos detectados
                      </p>
                      <p className="text-sm text-gray-600">
                        Tiempo promedio: {result.averageCycleTime.toFixed(2)}s
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentMode('edit')}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
