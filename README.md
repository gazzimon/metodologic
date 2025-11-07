Industrial Cycle Analyzer

Análisis de ciclos continuos (gestos/movimientos) en tiempo real o desde videos usando MediaPipe en el front y un backend Express para procesamiento/almacenamiento.

✨ Características

Tiempo real (cámara): detección por un solo marcador con histéresis (robusto ante ruido).

Subida de video: procesa archivos y agrega resultados al historial.

Editor de ciclos: ajuste manual de inicios/fin y duraciones.

Historial: guarda timestamp, número de ciclos y promedio.

En el front, los ciclos capturados desde cámara se envían a tu App con la prop onAnalysisReady(cycles), y allí se agregan al historial (ver src/App.tsx). 

App

🧱 Stack

Frontend: React + TypeScript + Vite + Tailwind + react-hot-toast + lucide-react

ML/Visión: @mediapipe/hands, @mediapipe/camera_utils, @mediapipe/drawing_utils

Backend: Node.js + Express (+ CORS, Multer/SQLite opcional)

Estilos: Tailwind configurado (ver src/App.css). 

App

✅ Requisitos

Node.js 18+ (recomendado LTS)

pnpm (recomendado) o npm / yarn

Cámara habilitada en el navegador (para modo tiempo real)

Instalar pnpm (opción recomendada):

npm i -g pnpm

🚀 Puesta en marcha (dev)
1) Clonar e instalar dependencias
# Clonar
git clone <tu-repo> industrial-cycle-analyzer
cd industrial-cycle-analyzer

# Instalar dependencias del front
pnpm install
# Si prefieres npm:
# npm install


Si tienes backend en ./backend, entra y ejecuta:

cd backend
npm install
cd ..

2) Ejecutar en dos terminales (VS Code → Terminal → “Nueva terminal”)

Terminal A — Frontend (Vite):

pnpm dev
# o
# npm run dev


Vite quedará en: http://localhost:5173

Terminal B — Backend (Express):

cd backend
npm run dev
# o
# npm start


API en: http://localhost:3001

Sí: abrís 2 terminales (una por cada servicio). Así puedes refrescar el front sin tocar el back, y viceversa.

🧭 Uso rápido

Abrí http://localhost:5173
 en Chrome/Edge.

Pestaña “Tiempo Real” → Permití el acceso a la cámara.

Ajustá HIGH/LOW y Duración mínima hasta que la detección sea estable.

Play para iniciar, Save para enviar los ciclos al historial.

Subir Video: arrastrá un .mp4/.mov; al finalizar, verás los ciclos en el historial.

Editar Ciclos: corrige inicios/fines y guarda.

El front muestra botones de navegación “Tiempo real / Subir Video / Editar Ciclos”. La captura en tiempo real llama a onAnalysisReady(cycles) y App arma el objeto de historial con promedio automáticamente. 

App

🔧 Scripts útiles

Frontend:

pnpm dev         # servidor Vite (desarrollo)
pnpm build       # build de producción
pnpm preview     # previsualizar build
pnpm lint        # lint del proyecto


Backend:

npm run dev      # nodemon server.js (dev)
npm start        # node server.js (prod)

🧪 Checklist de verificación

 Tiempo real: ves el video espejado y aparecen landmarks cuando hay manos.

 Al cruzar HIGH desde abajo (y volver por debajo de LOW antes), se generan límites; entre límites consecutivos se arma un ciclo con start = límite anterior, end = límite actual.

 Save agrega ciclos al historial (con promedio correcto). 

App

 Editor permite ajustar tiempos y guardar cambios.

🛟 Solución de problemas
“pnpm no se reconoce…”

Instalá pnpm global o usá npm:

npm i -g pnpm
# o cambia a:
npm install
npm run dev

La cámara no inicia / pantalla negra

Verificá permisos del navegador (icono de cámara en la barra de URL).

Cierra otras apps que usan la cámara (Zoom/Teams).

Prueba otro navegador (Chrome/Edge).

Consola del navegador → buscá errores de @mediapipe/*.

MediaPipe no carga

Asegurate de tener instalados:

npm i @mediapipe/hands @mediapipe/camera_utils @mediapipe/drawing_utils


El componente usa CDN para los modelos (jsdelivr) por defecto.

Backend no responde (Subir Video)

Verifica que el backend esté corriendo en http://localhost:3001.

Si cambiaste el puerto, actualiza la URL en tu VideoUploader.

Para CORS, asegúrate de tener app.use(cors()) en el backend.

Quiero ajustar sensibilidad / ruido

Sube/baja HIGH/LOW (LOW < HIGH).

Aumenta Duración mínima para filtrar micro-pulsos.

Considerá normalizar la métrica por escala del frame (pendiente) para mayor invariancia.

🧩 Estructura (resumen)
.
├─ src/
│  ├─ App.tsx               # Router de modos, historial (usa onAnalysisReady)  :contentReference[oaicite:6]{index=6}
│  ├─ App.css               # Tailwind + utilidades canvas/scroll               :contentReference[oaicite:7]{index=7}
│  ├─ components/
│  │  ├─ RealTimeAnalyzer.tsx  # Lógica 1 marcador + histéresis (cámara)
│  │  ├─ VideoUploader.tsx     # Subida de videos → backend
│  │  └─ CycleEditor.tsx       # Edición manual de ciclos
│  └─ ...
├─ backend/
│  ├─ server.js             # Express + (opcional Multer/SQLite)
│  └─ package.json
└─ package.json

🗺️ Roadmap corto

Gráfico de la métrica en tiempo real (para tunear HIGH/LOW).

Métrica alternativa basada en ángulos (menos sensible a escala).

Persistencia local (localStorage/IndexedDB) del historial.

Endpoints /api/upload y /api/results completos con Multer + SQLite.

📄 Licencia

MIT (o la que definas).