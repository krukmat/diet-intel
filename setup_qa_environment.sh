#!/bin/bash

# 🛠️ **SCRIPT DE SETUP PARA TESTS MANUALES - FEAT-PROPORTIONS**
# Script para configurar automáticamente el entorno de testing QA

echo "🚀 Iniciando setup del entorno QA para FEAT-PROPORTIONS..."
echo "📅 Fecha: $(date)"
echo "💻 Usuario: $(whoami)"

# Función para verificar si comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para instalar dependencias Python
setup_python_deps() {
    echo "🐍 Configurando dependencias Python..."

    if ! command_exists python; then
        echo "❌ Python no encontrado. Instale Python 3.9+ primero."
        exit 1
    fi

    # Crear entorno virtual si no existe
    if [ ! -d "venv" ]; then
        echo "📦 Creando entorno virtual..."
        python -m venv venv
    fi

    # Activar entorno virtual
    source venv/bin/activate

    # Instalar dependencias
    echo "📚 Instalando dependencias Python..."
    pip install -r requirements.txt

    # Verificar librerías críticas
    echo "🔍 Verificando librerías de visión por computadora..."
    python -c "
import cv2
import torch
import numpy as np
from PIL import Image
print('✅ OpenCV versión:', cv2.__version__)
print('✅ PyTorch versión:', torch.__version__)
print('✅ NumPy versión:', np.__version__)
print('✅ Pillow instalado correctamente')
print('🎉 Todas las dependencias críticas instaladas!')
"
}

# Función para configurar base de datos
setup_database() {
    echo "🗄️ Configurando base de datos..."

    # Ejecutar migraciones
    python database/migrations/001_add_vision_tables.py

    # Verificar tablas creadas
    echo "🔍 Verificando tablas de visión..."
    sqlite3 dietintel.db ".schema vision_logs" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Tabla vision_logs creada correctamente"
    else
        echo "❌ Error creando tabla vision_logs"
        exit 1
    fi

    sqlite3 dietintel.db ".schema vision_corrections" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Tabla vision_corrections creada correctamente"
    else
        echo "❌ Error creando tabla vision_corrections"
        exit 1
    fi
}

# Función para iniciar servidor backend
start_backend() {
    echo "🔧 Iniciando servidor backend..."

    # Verificar si servidor ya está corriendo
    if curl -s http://localhost:8000/api/v1/food/vision/health >/dev/null 2>&1; then
        echo "✅ Servidor backend ya está corriendo"
        return 0
    fi

    # Iniciar servidor en background
    python main.py &
    BACKEND_PID=$!

    echo "⏳ Esperando servidor backend..."
    sleep 5

    # Verificar servidor
    if curl -s http://localhost:8000/api/v1/food/vision/health | grep -q "healthy"; then
        echo "✅ Servidor backend iniciado correctamente (PID: $BACKEND_PID)"
        echo "🔗 Health check: http://localhost:8000/api/v1/food/vision/health"
    else
        echo "❌ Error iniciando servidor backend"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
}

# Función para configurar Android emulator
setup_android() {
    echo "📱 Configurando Android emulator..."

    if ! command_exists adb; then
        echo "❌ ADB no encontrado. Instale Android Studio primero."
        exit 1
    fi

    # Verificar dispositivos conectados
    echo "🔍 Verificando dispositivos Android..."
    adb devices

    # Crear AVD si no existe
    if ! emulator -list-avds | grep -q "Pixel_7_API_33"; then
        echo "⚠️ AVD Pixel_7_API_33 no encontrado."
        echo "📝 Cree el AVD usando Android Studio:"
        echo "   Tools → AVD Manager → Create Virtual Device"
        echo "   Seleccione: Pixel 7 API 33, RAM: 3GB, Storage: 6GB"
        echo ""
        read -p "¿Desea continuar sin AVD? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Función para configurar aplicación móvil
setup_mobile() {
    echo "📱 Configurando aplicación móvil..."

    cd mobile

    if [ ! -d "node_modules" ]; then
        echo "📦 Instalando dependencias Node.js..."
        npm install
    fi

    # Verificar configuración API
    if [ ! -f "src/config/environments.ts" ]; then
        echo "❌ Archivo de configuración API no encontrado"
        exit 1
    fi

    # Verificar configuración actual
    API_URL=$(grep -o "baseURL.*http.*" src/config/environments.ts | head -1 | sed 's/.*http/http/' | sed 's/".*//')
    if [ "$API_URL" != "http://10.0.2.2:8000" ]; then
        echo "⚠️ API URL no configurada para Android emulator"
        echo "💡 Configure API_BASE_URL a: http://10.0.2.2:8000"
    fi

    cd ..
    echo "✅ Aplicación móvil configurada"
}

# Función para verificar conexión completa
verify_setup() {
    echo "🔍 Verificando setup completo..."

    # Verificar backend
    if curl -s http://localhost:8000/api/v1/food/vision/health | grep -q "healthy"; then
        echo "✅ Backend: Conectado correctamente"
    else
        echo "❌ Backend: No responde correctamente"
        return 1
    fi

    # Verificar dispositivos Android
    if adb devices | grep -q "device$"; then
        echo "✅ Android: Dispositivo conectado"
    else
        echo "⚠️ Android: No hay dispositivos conectados"
        echo "💡 Inicie el emulator manualmente: emulator -avd Pixel_7_API_33"
    fi

    # Verificar aplicación móvil
    if [ -d "mobile/node_modules" ]; then
        echo "✅ Mobile: Dependencias instaladas"
    else
        echo "❌ Mobile: Dependencias no instaladas"
        return 1
    fi

    echo "🎉 Setup completado exitosamente!"
}

# Función principal
main() {
    echo "🎯 **SETUP QA ENVIRONMENT - FEAT-PROPORTIONS**"
    echo "=========================================="

    # Ejecutar pasos de setup
    setup_python_deps
    setup_database
    start_backend
    setup_android
    setup_mobile
    verify_setup

    echo ""
    echo "📋 **PRÓXIMOS PASOS:**"
    echo "1. Inicie Android emulator: emulator -avd Pixel_7_API_33"
    echo "2. Ejecute aplicación: cd mobile && npx expo start --android"
    echo "3. Siga la guía: TESTS_MANUALES_E2E_FEAT_PROPORTIONS.md"
    echo ""
    echo "🚀 ¡Entorno listo para testing!"
}

# Ejecutar función principal
main "$@"
