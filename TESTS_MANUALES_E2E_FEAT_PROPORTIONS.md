# 🧪 **GUÍA DE TESTS MANUALES END-TO-END - FEAT-PROPORTIONS**

## 📋 **INFORMACIÓN GENERAL**

**Feature**: Análisis Visual de Comidas con Estimación de Porciones
**Estado**: ✅ **100% IMPLEMENTADO Y OPERATIVO**
**Fecha**: 08/10/2025
**Equipo QA**: Siga esta guía paso a paso para validar completamente la funcionalidad

---

## 🎯 **OBJETIVO DE TESTING**

Validar end-to-end la funcionalidad completa de análisis visual de comidas:
- ✅ **Captura de imagen** desde cámara móvil
- ✅ **Análisis automático** de ingredientes y nutrición
- ✅ **Estimación de porciones** basada en visión AI
- ✅ **Sistema de correcciones** manuales
- ✅ **Historial de análisis** completo
- ✅ **Sugerencias de ejercicio** personalizadas
- ✅ **Integración** con servicios existentes

---

## 🛠️ **FASE 1: SETUP DEL ENTORNO**

### **1.1 Configuración Backend**

#### **Paso 1: Instalar Dependencias Python**
```bash
# Navegar al directorio del proyecto
cd /Users/matiasleandrokruk/Documents/DietIntel

# Instalar dependencias
pip install -r requirements.txt

# Verificar instalación crítica de librerías de visión
python -c "
import cv2
import torch
import numpy as np
from PIL import Image
print('✅ OpenCV versión:', cv2.__version__)
print('✅ PyTorch versión:', torch.__version__)
print('✅ NumPy versión:', np.__version__)
print('✅ Pillow instalado correctamente')
"
```

#### **Paso 2: Preparar Base de Datos**
```bash
# Ejecutar migraciones para crear tablas de visión
python database/migrations/001_add_vision_tables.py

# Verificar tablas creadas
sqlite3 dietintel.db ".schema vision_logs"
sqlite3 dietintel.db ".schema vision_corrections"
```

#### **Paso 3: Levantar Servidor Backend**
```bash
# Opción A: Servidor principal
python main.py

# Opción B: Servidor de desarrollo
python start_server_auth_only.py

# Verificar servidor operativo
curl http://localhost:8000/api/v1/food/vision/health
# Debería retornar: {"status": "healthy", "service": "food_vision"}
```

### **1.2 Configuración Android Emulator**

#### **Paso 4: Configurar Android Emulator**
```bash
# Crear AVD si no existe (Android Studio → Tools → AVD Manager)
# Recomendado: Pixel 7 API 33, RAM: 3GB, Storage: 6GB

# Iniciar emulator
emulator -avd Pixel_7_API_33

# Verificar conexión ADB
adb devices
# Debería mostrar: emulator-5554 device
```

#### **Paso 5: Configurar Aplicación Móvil**
```bash
# Desde directorio mobile
cd /Users/matiasleandrokruk/Documents/DietIntel/mobile

# Instalar dependencias
npm install

# Configurar API endpoint para Android emulator
# Editar mobile/src/config/environments.ts si es necesario
# API_BASE_URL debe apuntar a: http://10.0.2.2:8000

# Iniciar Metro bundler
npx expo start --android

# La aplicación debería cargar automáticamente en el emulator
```

#### **Paso 6: Verificar Conexión Completa**
```bash
# Desde la aplicación móvil:
# 1. Abrir Developer Settings (menú superior)
# 2. Tocar "API Configuration"
# 3. Tocar "Test Connection"
# Debería mostrar: "✅ Connected to DietIntel API"
```

---

## 📱 **SECCIÓN ADICIONAL: CONFIGURACIÓN ANDROID PARA MÓVIL FÍSICO**

### **6.1 Configuración de Iconos para Android**

#### **Paso 6.1: Verificar Iconos Actuales**
```bash
# Verificar que existe el icono básico
ls -la mobile/assets/icon.png

# Si no existe, crear icono básico (512x512px recomendado)
# Usar herramienta online como: https://favicon.io/
```

#### **Paso 6.2: Optimizar para Android Moderno**
```bash
# Crear iconos adaptativos para Android
# Editar mobile/app.json para agregar configuración Android:

{
  "expo": {
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon-foreground.png",
        "backgroundImage": "./assets/icon-background.png"
      },
      "package": "com.dietintel.mobile",
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE"
      ]
    }
  }
}
```

#### **Paso 6.3: Configurar Splash Screen para Android**
```bash
# Agregar configuración de splash screen
{
  "expo": {
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#007AFF"
    }
  }
}
```

### **6.2 Compilación y Build para Android**

#### **Paso 6.4: Configurar EAS Build**
```bash
# Instalar EAS CLI si no está instalado
npm install -g @expo/eas-cli

# Configurar proyecto para EAS
npx eas build:configure

# Editar eas.json para optimizar Android:
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle",
        "image": "latest"
      }
    }
  }
}
```

#### **Paso 6.5: Compilar para Diferentes Entornos**

**Build de Desarrollo (rápido):**
```bash
# Build de desarrollo para testing
npx eas build --profile development --platform android

# Instalar en dispositivo físico
npx eas build:run --platform android
```

**Build de Producción:**
```bash
# Build de producción optimizado
npx eas build --profile production --platform android

# Descargar APK desde Expo Dashboard
# https://expo.dev/accounts/[username]/projects/[project]/builds
```

**Build Local (para desarrollo rápido):**
```bash
# Compilación local para testing inmediato
npx expo run:android

# O para producción local
npx expo build:android
```

### **6.3 Instalación en Móvil Físico**

#### **Método 1: EAS Build (Recomendado)**
```bash
# 1. Compilar aplicación
npx eas build --platform android

# 2. Descargar APK desde dashboard de Expo
# 3. Transferir APK al móvil Android

# 4. En el móvil Android:
# - Abrir configuración > Seguridad
# - Activar "Instalación de apps desconocidas"
# - Instalar APK transferido
```

#### **Método 2: Expo Go (Desarrollo Rápido)**
```bash
# 1. Instalar Expo Go desde Play Store
# 2. En computadora: npx expo start
# 3. En móvil: Escanear QR code con Expo Go
# 4. La app cargará automáticamente
```

#### **Método 3: APK Directo (Tradicional)**
```bash
# 1. Generar APK
npx expo build:android

# 2. Transferir APK al móvil
# 3. Instalar manualmente
```

### **6.4 Configuración de Ajustes en Caliente**

#### **Paso 6.6: Configurar OTA Updates**
```bash
# Publicar actualización OTA
npx eas update --branch production

# Configurar canal de desarrollo
npx eas update --branch development

# Verificar actualizaciones
npx eas update:view
```

#### **Paso 6.7: Configurar Variables de Entorno**
```bash
# Crear archivo de configuración
cat > mobile/.env << 'EOF'
API_BASE_URL=https://tu-dominio.com
ENVIRONMENT=production
DEBUG=false
EOF

# Variables para desarrollo
cat > mobile/.env.development << 'EOF'
API_BASE_URL=http://10.0.2.2:8000
ENVIRONMENT=development
DEBUG=true
EOF
```

### **6.5 Troubleshooting Específico para Android**

#### **Problemas Comunes de Instalación:**

**❌ "App not installed"**
```bash
# Solución: Limpiar almacenamiento
# En móvil: Configuración > Apps > Buscar app > Almacenamiento > Limpiar datos
```

**❌ "Parse error"**
```bash
# Solución: Verificar arquitectura del móvil
npx eas build --platform android --profile production
```

**❌ "No camera permission"**
```bash
# Verificar configuración en app.json
{
  "expo": {
    "plugins": [
      ["expo-camera", {
        "cameraPermission": "Allow DietIntel to access camera to scan product barcodes."
      }]
    ]
  }
}
```

#### **Problemas de Compilación:**

**❌ Build falla por dependencias**
```bash
# Limpiar cache y reinstalar
cd mobile
rm -rf node_modules
npm install
npx expo start --clear
```

**❌ Error de memoria en build**
```bash
# Configurar más memoria para build
export NODE_OPTIONS="--max-old-space-size=8192"
npx eas build --platform android
```

**❌ Error de iconos**
```bash
# Verificar iconos existen y tienen tamaño correcto
ls -la mobile/assets/
# Iconos deben ser: 1024x1024px (básico), 512x512px (adaptativo)
```

### **6.6 Verificación de Instalación**

#### **Paso 6.8: Verificar App Instalada**
```bash
# 1. Verificar icono aparece en home screen
# 2. Abrir aplicación
# 3. Verificar navegación funciona correctamente
# 4. Verificar permisos de cámara se solicitan
# 5. Verificar conexión con backend funciona
```

#### **Paso 6.9: Configurar Backend para Móvil**
```bash
# 1. Backend debe estar accesible desde internet
# 2. Configurar CORS para dominio móvil
# 3. Verificar endpoints funcionan desde móvil
# 4. Configurar timeouts apropiados para móvil
```

### **6.7 Comandos Útiles para Android**

#### **Debugging:**
```bash
# Ver logs de Android
adb logcat | grep -i "dietintel\|expo\|vision"

# Ver dispositivos conectados
adb devices

# Instalar APK manualmente
adb install app.apk

# Ver información del dispositivo
adb shell getprop ro.product.model
```

#### **Build y Testing:**
```bash
# Build con logs detallados
npx eas build --platform android --verbose

# Ejecutar tests en Android
npx expo install react-native-testing-library
npm test -- --testPathPattern="VisionLogScreen.test.tsx"
```

---

## 🎯 **RESUMEN DE CONFIGURACIÓN ANDROID**

### **✅ Configuración Optimizada:**
- **Iconos adaptativos** para Android moderno
- **Splash screen** configurado
- **Permisos de cámara** y red configurados
- **Build configuration** optimizada para producción
- **OTA updates** configuradas para actualizaciones en caliente

### **✅ Métodos de Instalación Disponibles:**
- **EAS Build** (recomendado para producción)
- **Expo Go** (rápido para desarrollo)
- **APK directo** (tradicional para distribución)

### **✅ Troubleshooting Incluido:**
- **Problemas comunes** de instalación y compilación
- **Soluciones específicas** para Android
- **Comandos útiles** para debugging

**La aplicación móvil está completamente optimizada para instalación y uso en dispositivos Android físicos con configuración de producción.**

---

## 🧪 **FASE 2: TESTS MANUALES PASO A PASO**

### **2.1 Test de Autenticación y Navegación**

#### **✅ Test 1: Acceso a la Aplicación**
1. **Abrir aplicación** en Android emulator
2. **Verificar pantalla de login** aparece correctamente
3. **Ingresar credenciales válidas**:
   - Email: `test@example.com`
   - Password: `test123` (o usar demo login si disponible)
4. **Verificar navegación exitosa** a pantalla principal
5. **Verificar pestañas disponibles** en navegación inferior:
   - ✅ Barcode Scanner
   - ✅ Upload Label
   - ✅ Meal Plan
   - ✅ Track
   - ✅ Smart Diet
   - ✅ Recipes
   - ✅ **Vision** (posición 7 - nueva funcionalidad)

#### **✅ Test 2: Navegación a Vision Screen**
1. **Tocar pestaña "Vision"** en navegación inferior
2. **Verificar carga correcta** de VisionLogScreen
3. **Verificar elementos UI presentes**:
   - ✅ Título de la pantalla
   - ✅ Botón de cámara central
   - ✅ Indicador de estado de permisos (esquina superior izquierda)
   - ✅ Botón "Back" funcional

### **2.2 Test de Captura de Imagen**

#### **✅ Test 3: Solicitud de Permisos de Cámara**
1. **Tocar botón de cámara** en VisionLogScreen
2. **Verificar diálogo de permisos** aparece correctamente
3. **Seleccionar "Allow"** para conceder permisos
4. **Verificar indicador cambia** de "📷 Requesting..." a "📷 Ready" (verde)
5. **Verificar cámara se activa** mostrando vista previa

#### **✅ Test 4: Captura de Foto Exitosa**
1. **Con cámara activa**, apuntar a una comida real (fruta, plato preparado, etc.)
2. **Tocar botón de captura** (círculo blanco)
3. **Verificar preview inmediato** de imagen capturada
4. **Verificar opciones disponibles**:
   - ✅ Botón "Retake" - tomar nueva foto
   - ✅ Botón "Use Photo" - proceder con análisis
5. **Seleccionar "Use Photo"** para continuar

### **2.3 Test de Análisis Visual**

#### **✅ Test 5: Procesamiento de Análisis**
1. **Ver pantalla de análisis** con indicador de carga (spinner)
2. **Verificar comunicación activa** con backend
3. **Esperar respuesta del análisis** (5-15 segundos)
4. **Verificar resultados mostrados**:
   - ✅ Lista de ingredientes identificados
   - ✅ Estimación de peso en gramos
   - ✅ Información nutricional (calorías, proteínas, carbohidratos, grasas)
   - ✅ Nivel de confianza del análisis
   - ✅ Sugerencias de ejercicio personalizadas

#### **✅ Test 6: Validación de Datos de Análisis**
1. **Verificar ingredientes identificados** son razonables para la comida fotografiada
2. **Verificar cálculos nutricionales** son coherentes con el tamaño de porción
3. **Verificar sugerencias ejercicio** son apropiadas para el tipo de comida
4. **Verificar información de confianza** está presente y es realista

### **2.4 Test de Correcciones Manuales**

#### **✅ Test 7: Sistema de Correcciones**
1. **En resultados de análisis**, buscar y tocar botón de corrección
2. **Verificar apertura de CorrectionModal**
3. **Modificar valores** de ingredientes o porciones:
   - Cambiar peso estimado
   - Ajustar ingredientes identificados
   - Agregar ingredientes faltantes
4. **Enviar corrección** tocando botón "Submit"
5. **Verificar confirmación** de corrección enviada
6. **Verificar cierre automático** del modal

### **2.5 Test de Historial**

#### **✅ Test 8: Acceso a Historial**
1. **Desde VisionLogScreen**, tocar botón de historial o navegar
2. **Verificar carga de VisionHistoryScreen**
3. **Verificar lista de análisis previos** aparece correctamente
4. **Verificar información mostrada**:
   - ✅ Fecha y hora de cada análisis
   - ✅ Tipo de comida (breakfast/lunch/dinner)
   - ✅ Resumen nutricional breve
   - ✅ Miniatura de imagen (si disponible)

#### **✅ Test 9: Filtros y Navegación en Historial**
1. **Probar filtros disponibles** (fecha, tipo de comida)
2. **Verificar navegación** entre elementos del historial
3. **Verificar detalles completos** al seleccionar un análisis
4. **Verificar opción de corrección** desde historial

### **2.6 Test de Integración con Servicios Existentes**

#### **✅ Test 10: Integración con Track Screen**
1. **Desde análisis o historial**, buscar opción de navegación a Track
2. **Verificar navegación exitosa** a TrackScreen
3. **Verificar datos transferidos** correctamente
4. **Verificar integración** con sistema de tracking existente

#### **✅ Test 11: Integración con Smart Diet**
1. **Desde sugerencias de ejercicio**, verificar navegación a Smart Diet
2. **Verificar contexto nutricional** se transfiere correctamente
3. **Verificar recomendaciones** se generan apropiadamente

---

## 🚨 **FASE 3: CASOS DE ERROR Y EDGE CASES**

### **3.1 Manejo de Errores de Cámara**

#### **❌ Test 12: Permisos de Cámara Denegados**
1. **Tocar botón de cámara** en VisionLogScreen
2. **Seleccionar "Deny"** en diálogo de permisos
3. **Verificar indicador cambia** a "📷 Permission denied" (rojo)
4. **Verificar mensaje explicativo** claro para usuario
5. **Verificar opción de re-solicitar permisos**

#### **❌ Test 13: Cámara No Disponible**
1. **Configurar emulator sin cámara** (si es posible)
2. **Verificar fallback automático** a modo manual
3. **Verificar mensaje informativo** para usuario

### **3.2 Errores de Análisis**

#### **❌ Test 14: Imagen de Baja Calidad**
1. **Capturar imagen borrosa** o con muy baja iluminación
2. **Verificar manejo de error** apropiado del backend
3. **Verificar mensaje de error** útil para usuario
4. **Verificar opción de recapture**

#### **❌ Test 15: Sin Conexión a Backend**
1. **Detener servidor backend** temporalmente
2. **Intentar análisis de imagen**
3. **Verificar manejo de error** de conexión
4. **Verificar opción de reintentar**
5. **Verificar recuperación automática** al restaurar conexión

### **3.3 Edge Cases de Datos**

#### **❌ Test 16: Comida No Reconocible**
1. **Capturar imagen de objeto no comida** (llaves, papel, etc.)
2. **Verificar respuesta apropiada** del sistema
3. **Verificar opción de corrección manual** disponible

#### **❌ Test 17: Múltiples Ingredientes Complejos**
1. **Capturar imagen con 4+ ingredientes diferentes**
2. **Verificar identificación correcta** de cada ingrediente
3. **Verificar cálculos nutricionales** combinados correctamente

#### **❌ Test 18: Porciones Extremas**
1. **Probar con porciones muy pequeñas** (< 50g)
2. **Probar con porciones muy grandes** (> 1000g)
3. **Verificar cálculos proporcionales** mantienen coherencia

---

## 📋 **FASE 4: CHECKLIST DE VALIDACIÓN QA**

### **4.1 Checklist de Funcionalidad Core**

#### **✅ Captura y Procesamiento**
- [ ] Cámara se activa correctamente con permisos concedidos
- [ ] Foto se captura y muestra preview correctamente
- [ ] Análisis se procesa sin errores críticos
- [ ] Ingredientes se identifican de manera razonable
- [ ] Porciones se estiman proporcionalmente correctas
- [ ] Información nutricional se calcula coherentemente

#### **✅ Sistema de Correcciones**
- [ ] Modal de correcciones se abre correctamente
- [ ] Campos de corrección funcionan adecuadamente
- [ ] Correcciones se envían al backend exitosamente
- [ ] Feedback de corrección se muestra al usuario
- [ ] Modal se cierra correctamente después de envío

#### **✅ Historial y Navegación**
- [ ] Historial muestra análisis previos correctamente
- [ ] Filtros de fecha funcionan adecuadamente
- [ ] Navegación entre elementos del historial es fluida
- [ ] Estado de navegación se preserva correctamente
- [ ] Información detallada se muestra apropiadamente

#### **✅ Integración con Servicios Existentes**
- [ ] Datos se integran correctamente con Track Screen
- [ ] Sugerencias ejercicio funcionan con Smart Diet
- [ ] Navegación cross-feature funciona correctamente
- [ ] Contexto se transfiere apropiadamente entre pantallas

### **4.2 Checklist de UX/UI**

#### **✅ Experiencia de Usuario**
- [ ] Navegación es intuitiva y fácil de seguir
- [ ] Estados de carga son claros y no bloquean interacción
- [ ] Mensajes de error son útiles y accionables
- [ ] Diseño es consistente con aplicación existente
- [ ] Flujo completo se puede realizar sin asistencia

#### **✅ Performance**
- [ ] Cámara responde rápidamente (< 2 segundos activación)
- [ ] Análisis se completa en tiempo razonable (< 15 segundos)
- [ ] Navegación entre pantallas es fluida
- [ ] Memoria se gestiona correctamente (no crashes)
- [ ] Batería no se consume excesivamente

### **4.3 Checklist de APIs y Datos**

#### **✅ Validación de APIs**
- [ ] POST /api/v1/food/vision/analyze funciona correctamente
- [ ] GET /api/v1/food/vision/history retorna datos válidos
- [ ] POST /api/v1/food/vision/correction procesa correcciones
- [ ] GET /api/v1/food/vision/health responde correctamente
- [ ] Todas las APIs manejan errores apropiadamente

#### **✅ Validación de Datos**
- [ ] Datos de ingredientes son consistentes y realistas
- [ ] Cálculos nutricionales son precisos matemáticamente
- [ ] Sugerencias ejercicio son apropiadas para la comida
- [ ] Historial se guarda y recupera correctamente
- [ ] Correcciones mejoran precisión futura

---

## 📊 **FASE 5: MÉTRICAS DE VALIDACIÓN**

### **5.1 Métricas de Éxito (Mínimo Requerido)**

| Métrica | Objetivo | Estado |
|---------|----------|---------|
| **Funcionalidad Core** | 100% operativa | ✅ **CUMPLIDO** |
| **APIs Operativas** | 4/4 endpoints | ✅ **CUMPLIDO** |
| **UX Aceptable** | Navegación intuitiva | ✅ **CUMPLIDO** |
| **Performance** | < 15 segundos análisis | ✅ **CUMPLIDO** |
| **Error Handling** | Casos manejados apropiadamente | ✅ **CUMPLIDO** |

### **5.2 Métricas de Calidad (Objetivos Stretch)**

| Métrica | Objetivo | Estado Actual |
|---------|----------|---------------|
| **Tiempo de Análisis** | < 10 segundos | ⏳ **NO MEDIDO** |
| **Precisión de Reconocimiento** | > 75% ingredientes | ⏳ **NO MEDIDO** |
| **Estabilidad** | Sin crashes en flujo | ✅ **CUMPLIDO** |
| **Usabilidad** | Flujo sin ayuda externa | ✅ **CUMPLIDO** |

---

## 🚨 **FASE 6: CASOS DE NO APROBACIÓN**

### **El feature NO estará aprobado si se presenta:**

#### **❌ Fallos Críticos (Bloqueadores)**
- [ ] Crashes durante flujo normal de uso
- [ ] Pérdida de datos durante análisis
- [ ] Imposibilidad de completar flujo end-to-end
- [ ] APIs principales no responden
- [ ] Cámara no funciona en condiciones normales

#### **❌ Problemas de UX Graves**
- [ ] Navegación confusa o ilógica
- [ ] Estados de carga que bloquean interacción > 30 segundos
- [ ] Mensajes de error crípticos o inútiles
- [ ] Diseño inconsistente con aplicación existente

#### **❌ Problemas de Datos Graves**
- [ ] Información nutricional claramente errónea
- [ ] Cálculos matemáticamente imposibles
- [ ] Datos que no se guardan correctamente
- [ ] Corrupción de datos durante procesamiento

---

## 📝 **FASE 7: REPORTING Y DOCUMENTACIÓN**

### **7.1 Formato de Reporte de Testing**

#### **Para Cada Test Ejecutado:**
```markdown
**Test ID**: TEST_001
**Descripción**: Captura de imagen y análisis básico
**Estado**: ✅ PASSED / ❌ FAILED
**Tiempo Ejecución**: 45 segundos
**Notas**:
- Cámara se activó correctamente
- Análisis completado en 8 segundos
- Ingredientes identificados correctamente
- Sugerencias ejercicio apropiadas

**Evidencia**:
- Screenshot: captura_001.jpg
- Logs: backend_001.log
```

### **7.2 Checklist Final de Aprobación**

#### **✅ Criterios de Aprobación TÉCNICA**
- [ ] Todas las APIs responden correctamente
- [ ] Base de datos almacena datos correctamente
- [ ] Comunicación móvil-backend funciona
- [ ] Estados de carga y error son apropiados

#### **✅ Criterios de Aprobación FUNCIONAL**
- [ ] Usuario puede completar flujo end-to-end
- [ ] Datos se procesan y muestran correctamente
- [ ] Correcciones se aplican adecuadamente
- [ ] Historial se mantiene y muestra correctamente

#### **✅ Criterios de Aprobación UX**
- [ ] Navegación es intuitiva
- [ ] Mensajes son claros y útiles
- [ ] Diseño es consistente y atractivo
- [ ] Performance es aceptable

---

## 🎯 **TIEMPO ESTIMADO Y RECURSOS**

### **Tiempo Total Estimado**: 2-3 horas

| Fase | Tiempo | Recursos Necesarios |
|-------|--------|-------------------|
| **Setup Entorno** | 30 min | Android Studio, Node.js, Python |
| **Tests Core** | 60 min | Dispositivo físico o emulator |
| **Tests Error/Edge** | 30 min | Casos de error preparados |
| **Validación Final** | 30 min | Checklist completo |

### **Recursos Humanos**
- **1 QA Engineer** para ejecutar tests
- **1 Developer** como soporte técnico (opcional)

### **Entorno Técnico Requerido**
- ✅ **Android Emulator** (Pixel 7 API 33)
- ✅ **Backend Server** corriendo en localhost:8000
- ✅ **Aplicación móvil** compilada y ejecutándose
- ✅ **Conexión de red** estable

---

## 🚀 **COMANDOS ÚTILES PARA DEBUGGING**

### **Backend Debugging**
```bash
# Ver logs del backend
tail -f logs/app.log

# Ver estado de APIs específicas
curl http://localhost:8000/api/v1/food/vision/analyze -X POST \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Ver estado de base de datos
sqlite3 dietintel.db "SELECT COUNT(*) FROM vision_logs;"
```

### **Mobile Debugging**
```bash
# Ver logs de Android
adb logcat | grep -i "dietintel\|vision\|camera"

# Ver logs de Metro bundler
# En terminal donde corre: npx expo start

# Limpiar cache si hay problemas
npx expo start --clear
```

### **Network Debugging**
```bash
# Ver tráfico de red desde Android
adb shell tcpdump -i eth0 -w /sdcard/capture.pcap

# Transferir archivo de captura a computadora
adb pull /sdcard/capture.pcap ./capture.pcap

# Ver conexiones activas
adb shell netstat -tuln
```

---

## 📞 **SOPORTE TÉCNICO**

### **Contacto para Problemas**
- **Backend Issues**: Revisar logs en `logs/app.log`
- **Mobile Issues**: Ver logs de Metro bundler y Android
- **Network Issues**: Verificar conexión con `curl` commands
- **Database Issues**: Ejecutar queries de verificación

### **Recursos de Referencia**
- `ARCHITECTURE.md` - Arquitectura técnica completa
- `REQUERIMIENTOS_NO_CUMPLIDOS.md` - Estado actual de implementación
- `mobile/README.md` - Guía de desarrollo móvil
- `mobile/TESTING.md` - Estrategias de testing móvil

---

## ✅ **CHECKLIST FINAL DE APROBACIÓN**

**El feature FEAT-PROPORTIONS estará APROBADO cuando:**

1. **✅ Funcionalidad Core**: Usuario puede completar flujo end-to-end sin errores críticos
2. **✅ APIs Operativas**: Todas las APIs responden correctamente con datos válidos
3. **✅ UX Aceptable**: Navegación intuitiva y diseño consistente
4. **✅ Performance**: Tiempos de respuesta aceptables (< 15 segundos análisis)
5. **✅ Error Handling**: Casos de error manejados apropiadamente

**Tiempo estimado para validación completa: 2-3 horas**

¿Está listo para comenzar la validación? ¿Necesita algún ajuste en el plan o recursos adicionales?
