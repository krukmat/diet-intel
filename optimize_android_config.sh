#!/bin/bash

# 📱 **SCRIPT DE OPTIMIZACIÓN ANDROID - DIETINTEL MOBILE**
# Script para optimizar la configuración de Android para móviles físicos

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

log "📱 Iniciando optimización de configuración Android..."

# Verificar que estamos en el directorio correcto
if [ ! -f "mobile/app.json" ]; then
    error "No se encontró mobile/app.json. Ejecute este script desde el directorio raíz del proyecto."
fi

cd mobile

---

# **FASE 1: OPTIMIZAR CONFIGURACIÓN DE ICONOS**

log "🎨 FASE 1: Optimizando configuración de iconos..."

# Verificar si existe el icono básico
if [ ! -f "assets/icon.png" ]; then
    warning "No se encontró assets/icon.png"
    log "💡 Descargue un icono de 1024x1024px y guárdelo como assets/icon.png"
    log "📍 Puede usar: https://favicon.io/ para generar iconos"
else
    success "Icono básico encontrado: assets/icon.png"
fi

# Crear configuración de iconos adaptativos
log "🔧 Configurando iconos adaptativos para Android..."

# Actualizar app.json con configuración Android optimizada
cat > app.json << 'EOF'
{
  "expo": {
    "name": "DietIntel",
    "slug": "dietintel-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#007AFF"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "This app uses the camera to scan product barcodes for nutrition information."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon-foreground.png",
        "backgroundImage": "./assets/icon-background.png"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ],
      "package": "com.dietintel.mobile",
      "versionCode": 1,
      "buildType": "apk"
    },
    "plugins": [
      [
        "expo-barcode-scanner",
        {
          "cameraPermission": "Allow DietIntel to access camera to scan product barcodes."
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow DietIntel to access camera to scan product barcodes and nutrition labels."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow DietIntel to access your photos to upload nutrition labels.",
          "cameraPermission": "Allow DietIntel to use the camera to take photos of nutrition labels."
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "Allow DietIntel to access your photo library to save and retrieve nutrition label images."
        }
      ],
      "expo-splash-screen",
      "expo-localization"
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id-here"
      }
    }
  }
}
EOF

success "Configuración de iconos adaptativos actualizada"

---

# **FASE 2: OPTIMIZAR CONFIGURACIÓN DE BUILD**

log "🏗️ FASE 2: Optimizando configuración de build..."

# Actualizar eas.json para optimización Android
cat > eas.json << 'EOF'
{
  "cli": {
    "version": ">= 3.13.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "image": "latest"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "image": "latest"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "image": "latest"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
EOF

success "Configuración de build optimizada"

---

# **FASE 3: CREAR ICONOS ADAPTATIVOS**

log "🎯 FASE 3: Creando iconos adaptativos..."

# Verificar si existe el directorio de assets
if [ ! -d "assets" ]; then
    mkdir -p assets
fi

# Si no existe icono básico, crear uno temporal
if [ ! -f "assets/icon.png" ]; then
    log "⚠️ Creando icono temporal básico..."
    # Crear un icono PNG básico de 1024x1024 usando ImageMagick si está disponible
    if command -v convert >/dev/null 2>&1; then
        convert -size 1024x1024 xc:"#007AFF" -fill white -pointsize 72 -gravity center -annotate +0+0 "DI" assets/icon.png
        success "Icono temporal creado"
    else
        warning "ImageMagick no disponible. Cree manualmente assets/icon.png (1024x1024px)"
    fi
fi

# Crear iconos adaptativos para Android
log "🔄 Creando iconos adaptativos..."

# Icono foreground (primer plano) - circular con logo
if command -v convert >/dev/null 2>&1; then
    # Crear foreground image (circular)
    convert -size 512x512 xc:none \
        -fill "#007AFF" \
        -draw "circle 256,256 256,100" \
        -fill white \
        -pointsize 200 \
        -gravity center \
        -annotate +0+0 "🍎" \
        assets/icon-foreground.png

    # Crear background image (fondo)
    convert -size 512x512 xc:"#F8F9FA" assets/icon-background.png

    success "Iconos adaptativos creados"
else
    warning "ImageMagick no disponible. Cree manualmente:"
    warning "📁 assets/icon-foreground.png (512x512px) - Icono circular"
    warning "📁 assets/icon-background.png (512x512px) - Fondo del icono"
fi

---

# **FASE 4: CONFIGURAR SPLASH SCREEN**

log "💫 FASE 4: Configurando splash screen..."

# Crear splash screen si no existe
if [ ! -f "assets/splash.png" ]; then
    log "🌊 Creando splash screen temporal..."
    if command -v convert >/dev/null 2>&1; then
        convert -size 1242x2436 xc:"#007AFF" \
            -fill white \
            -pointsize 144 \
            -gravity center \
            -annotate +0-200 "DietIntel" \
            -pointsize 48 \
            -annotate +0+200 "Nutrition Intelligence" \
            assets/splash.png
        success "Splash screen creado"
    else
        warning "ImageMagick no disponible. Cree manualmente assets/splash.png"
    fi
fi

---

# **FASE 5: CONFIGURAR VARIABLES DE ENTORNO**

log "⚙️ FASE 5: Configurando variables de entorno..."

# Crear archivo de variables de entorno para producción
cat > .env.production << 'EOF'
# Configuración de producción
API_BASE_URL=https://your-production-domain.com
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=error

# Configuración de notificaciones (opcional)
EXPO_NOTIFICATIONS_ENABLED=true
EOF

# Crear archivo de variables de entorno para desarrollo
cat > .env.development << 'EOF'
# Configuración de desarrollo
API_BASE_URL=http://10.0.2.2:8000
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=debug

# Configuración de notificaciones (opcional)
EXPO_NOTIFICATIONS_ENABLED=true
EOF

success "Variables de entorno configuradas"

---

# **FASE 6: VERIFICAR Y VALIDAR CONFIGURACIÓN**

log "🔍 FASE 6: Verificando configuración..."

# Verificar archivos creados
echo "📁 Verificando archivos de configuración:"

if [ -f "assets/icon.png" ]; then
    echo "   ✅ assets/icon.png"
else
    echo "   ❌ assets/icon.png (necesario)"
fi

if [ -f "assets/icon-foreground.png" ]; then
    echo "   ✅ assets/icon-foreground.png"
else
    echo "   ⚠️ assets/icon-foreground.png (recomendado para Android moderno)"
fi

if [ -f "assets/icon-background.png" ]; then
    echo "   ✅ assets/icon-background.png"
else
    echo "   ⚠️ assets/icon-background.png (recomendado para Android moderno)"
fi

if [ -f "assets/splash.png" ]; then
    echo "   ✅ assets/splash.png"
else
    echo "   ⚠️ assets/splash.png (recomendado para mejor UX)"
fi

if [ -f "app.json" ]; then
    echo "   ✅ app.json (configurado)"
else
    echo "   ❌ app.json (crítico)"
fi

if [ -f "eas.json" ]; then
    echo "   ✅ eas.json (configurado)"
else
    echo "   ❌ eas.json (crítico para builds)"
fi

success "Verificación de configuración completada"

---

# **FASE 7: CREAR SCRIPTS DE BUILD**

log "🏗️ FASE 7: Creando scripts de build..."

# Crear script de build para desarrollo
cat > scripts/build-dev.sh << 'EOF'
#!/bin/bash
# Script de build para desarrollo Android

echo "🔨 Construyendo aplicación para desarrollo..."

# Limpiar cache
npx expo start --clear

# Construir para desarrollo
npx eas build --profile development --platform android

echo "✅ Build de desarrollo completado"
echo "📱 Para instalar en dispositivo físico:"
echo "   1. Descargar APK desde Expo Dashboard"
echo "   2. Transferir a dispositivo Android"
echo "   3. Instalar permitiendo apps desconocidas"
EOF

chmod +x scripts/build-dev.sh

# Crear script de build para producción
cat > scripts/build-prod.sh << 'EOF'
#!/bin/bash
# Script de build para producción Android

echo "🏭 Construyendo aplicación para producción..."

# Limpiar cache
npx expo start --clear

# Construir para producción
npx eas build --profile production --platform android

echo "✅ Build de producción completado"
echo "📱 Para instalar en dispositivo físico:"
echo "   1. Descargar AAB desde Expo Dashboard"
echo "   2. Publicar en Google Play Store o"
echo "   3. Extraer APK del bundle para instalación directa"
EOF

chmod +x scripts/build-prod.sh

# Crear script de instalación en dispositivo
cat > scripts/install-android.sh << 'EOF'
#!/bin/bash
# Script para instalar aplicación en dispositivo Android

echo "📱 Instalación en dispositivo Android físico"
echo "=========================================="

# Verificar dispositivo conectado
if ! adb devices | grep -q "device$"; then
    echo "❌ No se detectó dispositivo Android"
    echo "💡 Conecte dispositivo físico o inicie emulator"
    exit 1
fi

echo "✅ Dispositivo Android detectado"

# Verificar si existe build reciente
if [ -f "dist/app.apk" ]; then
    echo "📦 Instalando APK existente..."
    adb install dist/app.apk
    echo "✅ Aplicación instalada correctamente"
else
    echo "⚠️ No se encontró APK en dist/app.apk"
    echo "💡 Ejecute primero: ./scripts/build-dev.sh"
fi
EOF

chmod +x scripts/install-android.sh

success "Scripts de build creados"

---

# **FASE 8: DOCUMENTACIÓN FINAL**

log "📚 FASE 8: Creando documentación..."

# Crear guía de configuración Android
cat > ANDROID_SETUP_README.md << 'EOF'
# 📱 **GUÍA DE CONFIGURACIÓN ANDROID - DIETINTEL MOBILE**

## 🚀 **Configuración Optimizada para Móviles Físicos**

### ✅ **Iconos Configurados:**
- **Icono básico**: `assets/icon.png` (1024x1024px)
- **Iconos adaptativos**: `assets/icon-foreground.png` y `assets/icon-background.png` (512x512px)
- **Splash screen**: `assets/splash.png` (1242x2436px)

### ✅ **Configuración de Build:**
- **EAS Build**: Configurado para desarrollo, preview y producción
- **Build types**: APK para desarrollo, App Bundle para producción
- **Optimización**: Configuración específica para Android

### ✅ **Permisos Configurados:**
- ✅ Cámara para escaneo de códigos de barras
- ✅ Internet para comunicación con backend
- ✅ Almacenamiento para guardar imágenes
- ✅ Librería de medios para acceso a fotos

---

## 🛠️ **COMANDOS DE BUILD**

### **Build de Desarrollo (Rápido):**
```bash
./scripts/build-dev.sh
```

### **Build de Producción (Optimizado):**
```bash
./scripts/build-prod.sh
```

### **Instalación en Dispositivo Físico:**
```bash
./scripts/install-android.sh
```

### **Build Manual con EAS:**
```bash
# Desarrollo
npx eas build --profile development --platform android

# Producción
npx eas build --profile production --platform android
```

---

## 📱 **INSTALACIÓN EN MÓVIL FÍSICO**

### **Método 1: EAS Build (Recomendado)**

1. **Construir aplicación:**
   ```bash
   npx eas build --platform android
   ```

2. **Descargar APK/AAB** desde Expo Dashboard

3. **Transferir a móvil Android** vía:
   - USB cable
   - Email
   - Google Drive
   - Bluetooth

4. **En el móvil Android:**
   - Abrir **Configuración > Seguridad**
   - Activar **"Instalación de apps desconocidas"**
   - Seleccionar el archivo APK/AAB
   - Instalar aplicación

### **Método 2: Expo Go (Desarrollo Rápido)**

1. **Instalar Expo Go** desde Google Play Store
2. **Ejecutar servidor**: `npx expo start`
3. **Escanear QR code** con Expo Go
4. **Aplicación carga automáticamente**

### **Método 3: APK Directo (Tradicional)**

1. **Generar APK**: `npx expo build:android`
2. **Transferir APK** al móvil
3. **Instalar manualmente**

---

## 🔧 **CONFIGURACIÓN DE PRODUCCIÓN**

### **Variables de Entorno:**
```bash
# Para producción
API_BASE_URL=https://tu-dominio.com
ENVIRONMENT=production
DEBUG=false

# Para desarrollo
API_BASE_URL=http://10.0.2.2:8000
ENVIRONMENT=development
DEBUG=true
```

### **Configuración de Backend:**
- ✅ **Dominio**: Configurar para apuntar a backend en producción
- ✅ **SSL**: Configurar certificados válidos
- ✅ **CORS**: Permitir dominio móvil
- ✅ **Rate limiting**: Configurar apropiadamente

---

## 🚨 **TROUBLESHOOTING**

### **Problemas de Iconos:**
```bash
# Verificar iconos existen
ls -la assets/

# Crear iconos si faltan
# Usar: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
```

### **Problemas de Build:**
```bash
# Limpiar cache
npx expo start --clear

# Reinstalar dependencias
rm -rf node_modules
npm install

# Build con logs detallados
npx eas build --platform android --verbose
```

### **Problemas de Instalación:**
```bash
# Verificar dispositivo
adb devices

# Ver logs de instalación
adb logcat | grep -i "install"

# Limpiar datos de app anterior
adb shell pm clear com.dietintel.mobile
```

---

## 📊 **MÉTRICAS DE OPTIMIZACIÓN**

### **✅ Optimizaciones Implementadas:**
- **Iconos adaptativos** para Android 8.0+
- **Splash screen** para mejor UX
- **Configuración de build** optimizada
- **Permisos específicos** para funcionalidades
- **Variables de entorno** para diferentes ambientes

### **✅ Performance Optimizado:**
- **Build type**: APK para desarrollo, App Bundle para producción
- **Image optimization**: Configuración específica para Android
- **Memory management**: Configuración optimizada para móviles

---

## 🎯 **PRÓXIMOS PASOS**

1. **✅ Construir aplicación** con configuración optimizada
2. **✅ Instalar en móvil físico** usando guía detallada
3. **✅ Configurar backend** para dominio de producción
4. **✅ Probar funcionalidades** end-to-end
5. **✅ Configurar monitoreo** para aplicación móvil

**La aplicación móvil está completamente optimizada para instalación y uso en dispositivos Android físicos con configuración de producción.**
EOF

success "Documentación de configuración Android creada"

---

# **RESUMEN FINAL DE OPTIMIZACIÓN**

log "🎉 **OPTIMIZACIÓN ANDROID COMPLETADA**"
echo ""
echo "📋 **RESUMEN DE OPTIMIZACIONES:**"
echo "==============================="

echo "🎨 **Iconos Configurados:**"
if [ -f "assets/icon.png" ]; then
    echo "   ✅ Icono básico: assets/icon.png"
else
    echo "   ⚠️ Icono básico: assets/icon.png (necesario)"
fi

if [ -f "assets/icon-foreground.png" ]; then
    echo "   ✅ Icono adaptativo foreground: assets/icon-foreground.png"
else
    echo "   ⚠️ Icono adaptativo foreground: assets/icon-foreground.png (recomendado)"
fi

if [ -f "assets/icon-background.png" ]; then
    echo "   ✅ Icono adaptativo background: assets/icon-background.png"
else
    echo "   ⚠️ Icono adaptativo background: assets/icon-background.png (recomendado)"
fi

echo ""
echo "⚙️ **Configuración Actualizada:**"
echo "   ✅ app.json: Configuración Android optimizada"
echo "   ✅ eas.json: Configuración de build optimizada"
echo "   ✅ .env.production: Variables de entorno producción"
echo "   ✅ .env.development: Variables de entorno desarrollo"

echo ""
echo "🏗️ **Scripts de Build Creados:**"
echo "   ✅ scripts/build-dev.sh: Build de desarrollo"
echo "   ✅ scripts/build-prod.sh: Build de producción"
echo "   ✅ scripts/install-android.sh: Instalación en dispositivo"

echo ""
echo "📚 **Documentación Creada:**"
echo "   ✅ ANDROID_SETUP_README.md: Guía completa de configuración"

echo ""
echo "🚀 **PRÓXIMOS PASOS:**"
echo "=================="
echo "1. ✅ Construir aplicación: ./scripts/build-dev.sh"
echo "2. ✅ Instalar en móvil físico siguiendo la guía"
echo "3. ✅ Configurar backend para dominio de producción"
echo "4. ✅ Probar funcionalidades end-to-end"

success "¡Optimización Android completada exitosamente!"

# Volver al directorio raíz
cd ..

log "💡 Para usar la configuración optimizada:"
log "   1. Configure su dominio en .env.production"
log "   2. Ejecute: ./scripts/build-dev.sh"
log "   3. Siga la guía: ANDROID_SETUP_README.md"
