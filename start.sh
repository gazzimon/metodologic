#!/bin/bash

# 🎯 Script de Inicio - Analizador de Ciclos Industriales V2
# Este script inicia la aplicación en modo desarrollo

echo "🚀 Iniciando Analizador de Ciclos Industriales V2..."
echo ""

# Verificar si estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde /workspace/industrial-cycle-analyzer-v2/"
    exit 1
fi

# Verificar si las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    pnpm install
    if [ $? -ne 0 ]; then
        echo "❌ Error al instalar dependencias"
        exit 1
    fi
fi

echo "✅ Dependencias verificadas"
echo "🌐 Iniciando servidor de desarrollo..."
echo ""
echo "📱 La aplicación estará disponible en:"
echo "   • Local: http://localhost:5173"
echo "   • Red:   http://172.17.136.149:5173"
echo ""
echo "⚡ Presiona Ctrl+C para detener el servidor"
echo ""

# Iniciar Vite
node_modules/.bin/vite --host --port 5173