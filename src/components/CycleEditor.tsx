import { useState, useEffect } from 'react'
import { Edit2, Save, X, Plus, Trash2, Clock, Users } from 'lucide-react'
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

interface CycleEditorProps {
  results: AnalysisResult[]
  onResultsUpdate: (results: AnalysisResult[]) => void
}

const CycleEditor: React.FC<CycleEditorProps> = ({ results, onResultsUpdate }) => {
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null)
  const [editingCycle, setEditingCycle] = useState<string | null>(null)
  const [editedCycles, setEditedCycles] = useState<Cycle[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (selectedResult) {
      setEditedCycles([...selectedResult.cycles])
      setHasChanges(false)
    }
  }, [selectedResult])

  const selectResult = (result: AnalysisResult) => {
    if (hasChanges) {
      const confirmLeave = window.confirm(
        'Tienes cambios sin guardar. ¿Estás seguro de que quieres cambiar de análisis?'
      )
      if (!confirmLeave) return
    }
    setSelectedResult(result)
  }

  const updateCycle = (cycleId: string, field: keyof Cycle, value: any) => {
    setEditedCycles(prev => 
      prev.map(cycle => {
        if (cycle.id === cycleId) {
          const updatedCycle = { ...cycle, [field]: value }
          
          // Auto-calculate duration if start or end time changes
          if (field === 'startTime' || field === 'endTime') {
            updatedCycle.duration = updatedCycle.endTime - updatedCycle.startTime
          }
          
          return updatedCycle
        }
        return cycle
      })
    )
    setHasChanges(true)
  }

  const deleteCycle = (cycleId: string) => {
    const confirmDelete = window.confirm('¿Estás seguro de que quieres eliminar este ciclo?')
    if (!confirmDelete) return

    setEditedCycles(prev => prev.filter(cycle => cycle.id !== cycleId))
    setHasChanges(true)
    toast.success('Ciclo eliminado')
  }

  const addManualCycle = () => {
    const lastCycle = editedCycles[editedCycles.length - 1]
    const newCycle: Cycle = {
      id: `manual_${Date.now()}`,
      startTime: lastCycle ? lastCycle.endTime : 0,
      endTime: lastCycle ? lastCycle.endTime + 10 : 10,
      duration: 10,
      confidence: 1.0,
      bodyKeypoints: [],
      handKeypoints: []
    }
    
    setEditedCycles(prev => [...prev, newCycle])
    setHasChanges(true)
    toast.success('Ciclo manual agregado')
  }

  const saveChanges = () => {
    if (!selectedResult) return

    const updatedResult: AnalysisResult = {
      ...selectedResult,
      cycles: editedCycles,
      averageCycleTime: editedCycles.length > 0 
        ? editedCycles.reduce((sum, cycle) => sum + cycle.duration, 0) / editedCycles.length
        : 0
    }

    const updatedResults = results.map(result => 
      result.id === selectedResult.id ? updatedResult : result
    )

    onResultsUpdate(updatedResults)
    setSelectedResult(updatedResult)
    setHasChanges(false)
    toast.success('Cambios guardados correctamente')
  }

  const discardChanges = () => {
    const confirmDiscard = window.confirm('¿Estás seguro de que quieres descartar los cambios?')
    if (!confirmDiscard) return

    if (selectedResult) {
      setEditedCycles([...selectedResult.cycles])
    }
    setHasChanges(false)
    setEditingCycle(null)
    toast.success('Cambios descartados')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(2)
    return `${mins}:${secs.padStart(5, '0')}`
  }

  const parseTime = (timeString: string): number => {
    const parts = timeString.split(':')
    if (parts.length !== 2) return 0
    const minutes = parseInt(parts[0])
    const seconds = parseFloat(parts[1])
    return minutes * 60 + seconds
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay análisis disponibles
        </h3>
        <p className="text-gray-500">
          Realiza un análisis en tiempo real o sube un video para comenzar
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Editor de Ciclos
        </h2>
        
        {hasChanges && (
          <div className="flex space-x-2">
            <button
              onClick={discardChanges}
              className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
            >
              <X className="h-4 w-4 mr-2" />
              Descartar
            </button>
            <button
              onClick={saveChanges}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Results Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result) => (
          <button
            key={result.id}
            onClick={() => selectResult(result)}
            className={`p-4 border-2 rounded-lg text-left transition-colors ${
              selectedResult?.id === result.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-xs text-gray-500">
                {new Date(result.timestamp).toLocaleDateString()}
              </span>
            </div>
            <p className="font-medium text-gray-900">
              {result.cycles.length} ciclos
            </p>
            <p className="text-sm text-gray-600">
              Promedio: {result.averageCycleTime.toFixed(2)}s
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(result.timestamp).toLocaleTimeString()}
            </p>
          </button>
        ))}
      </div>

      {/* Cycles Editor */}
      {selectedResult && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Ciclos Detectados
              </h3>
              <button
                onClick={addManualCycle}
                className="flex items-center px-3 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Ciclo Manual
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tiempo Inicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tiempo Fin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duración
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confianza
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {editedCycles.map((cycle, index) => (
                  <tr key={cycle.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <input
                        type="text"
                        value={formatTime(cycle.startTime)}
                        onChange={(e) => updateCycle(cycle.id, 'startTime', parseTime(e.target.value))}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <input
                        type="text"
                        value={formatTime(cycle.endTime)}
                        onChange={(e) => updateCycle(cycle.id, 'endTime', parseTime(e.target.value))}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{cycle.duration.toFixed(2)}s</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={cycle.confidence.toFixed(2)}
                        onChange={(e) => updateCycle(cycle.id, 'confidence', parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => deleteCycle(cycle.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editedCycles.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Total de Ciclos</p>
                  <p className="text-xl font-bold text-gray-900">{editedCycles.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duración Promedio</p>
                  <p className="text-xl font-bold text-blue-600">
                    {(editedCycles.reduce((sum, cycle) => sum + cycle.duration, 0) / editedCycles.length).toFixed(2)}s
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duración Total</p>
                  <p className="text-xl font-bold text-green-600">
                    {editedCycles.reduce((sum, cycle) => sum + cycle.duration, 0).toFixed(2)}s
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CycleEditor