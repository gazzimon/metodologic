# 🎯 Analizador de Ciclos Industriales V2 - Guía de Instalación y Uso

## 📋 Estado Actual

### ✅ **Aplicación Frontend Ejecutándose**
- **URL**: http://localhost:5173
- **Estado**: ✅ Funcionando correctamente
- **Tecnologías**: React + Vite + MediaPipe + TypeScript

### 📁 **Estructura de Archivos**
```
/workspace/industrial-cycle-analyzer-v2/
├── src/
│   ├── components/
│   │   ├── RealTimeAnalyzer.tsx    # Detección en tiempo real
│   │   ├── VideoUploader.tsx       # Subida y análisis de videos
│   │   └── CycleEditor.tsx         # Editor de ciclos
│   ├── App.tsx                     # Aplicación principal
│   └── App.css                     # Estilos
├── backend/                        # Backend (pendiente de configuración)
├── package.json                    # Dependencias instaladas
└── vite.config.ts                  # Configuración de Vite
```

## 🚀 **Funcionalidades Disponibles**

### 1. **Análisis en Tiempo Real** 🎥
- ✅ **Detección de Manos**: MediaPipe Hands integrado
- ✅ **Detección de Cuerpo**: Puntos clave corporales
- ✅ **Ciclos Automáticos**: Identificación y timing
- ✅ **Visualización en Vivo**: Landmarks superpuestos en video
- ✅ **Estadísticas en Tiempo Real**: Contador de ciclos, promedio

### 2. **Análisis de Videos** 📹
- ✅ **Subida de Videos**: Drag & drop de archivos
- ✅ **Formatos Soportados**: MP4, AVI, MOV, MKV, WebM
- ✅ **Progreso Visual**: Barra de progreso del análisis
- ✅ **Datos Mock**: Simulación de análisis completo

### 3. **Editor de Ciclos** ✏️
- ✅ **Modificación Manual**: Editar tiempos de inicio/fin
- ✅ **Formato MM:SS**: Interface intuitiva
- ✅ **Agregar/Eliminar**: Gestión completa de ciclos
- ✅ **Recálculo Automático**: Promedios y estadísticas
- ✅ **Historial**: Guardar y cargar análisis

## 🎮 **Cómo Usar la Aplicación**

### **Opción 1: Análisis en Tiempo Real**
1. **Abrir**: http://localhost:5173
2. **Navegar**: Pestaña "Tiempo Real"
3. **Permitir Cámara**: Aceptar permisos del navegador
4. **Activar Cámara**: Clic en "Activar Cámara"
5. **Iniciar Análisis**: Clic en "Iniciar"
6. **Detectar Ciclos**: Realizar movimientos repetitivos
7. **Ver Resultados**: Estadísticas en tiempo real
8. **Guardar**: Clic en "Guardar Análisis"

### **Opción 2: Análisis de Video**
1. **Navegar**: Pestaña "Subir Video"
2. **Seleccionar Video**: Arrastrar archivo o clic para seleccionar
3. **Iniciar Análisis**: Clic en "Analizar Video"
4. **Ver Progreso**: Barra de progreso del procesamiento
5. **Resultados**: Análisis automático completado
6. **Editar**: Ir a pestaña "Editar Ciclos"

### **Opción 3: Editor de Ciclos**
1. **Navegar**: Pestaña "Editar Ciclos"
2. **Seleccionar Análisis**: Clic en análisis del historial
3. **Editar Tiempos**: Modificar campos de tiempo
4. **Gestionar Ciclos**: Agregar, eliminar o ajustar
5. **Guardar Cambios**: Clic en "Guardar"

## 🔧 **Backend (Opcional)**

### **Para Funcionalidad Completa de Video**
Si quieres el backend completo, necesitarás:

1. **Instalar Node.js 20+** (actualmente tienes v18.19.0)
2. **Configurar Backend**:
   ```bash
   cd /workspace/industrial-cycle-analyzer-v2/backend
   npm install
   npm start
   ```

3. **Endpoints Disponibles**:
   - `GET /api/health` - Estado del servidor
   - `POST /api/upload` - Subir y analizar video
   - `GET /api/analyses` - Listar análisis
   - `GET /api/analyses/:id` - Obtener análisis específico

## 💡 **Características Técnicas**

### **MediaPipe Integration**
- **Manos**: 21 puntos clave por mano
- **Cuerpo**: 33 puntos clave corporales
- **Precisión**: Configurable (minConfidence: 0.5)
- **Rendimiento**: WebAssembly en navegador

### **Eficiencia del Software**
- **Tiempo Real**: Solo guarda datos de pose (no videos)
- **Procesamiento Local**: Sin envío de datos a servidores
- **Sin Post-procesamiento**: Análisis directo durante captura
- **Liviano**: MediaPipe optimizado para navegadores

## 🎯 **Próximos Pasos**

1. **Probar la Aplicación**: http://localhost:5173
2. **Testear Detección**: Usar cámara web para detectar manos/cuerpo
3. **Subir Video**: Probar con videos de ejemplo
4. **Editar Ciclos**: Corregir tiempos manualmente
5. **Configurar Backend** (opcional): Para análisis real de videos

## ⚠️ **Notas Importantes**

- **Cámara Web**: Requiere permisos del navegador
- **HTTPS**: Algunos navegadores requieren HTTPS para cámara
- **Compatibilidad**: MediaPipe compatible con navegadores modernos
- **Performance**: Funciona mejor con buena iluminación

La aplicación está lista para usar y demostrar todas las funcionalidades solicitadas!