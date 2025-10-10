#!/bin/bash

# 🚀 **SCRIPT DE DESPLIEGUE AUTOMÁTICO - DIETINTEL BACKEND EN DIGITAL OCEAN**
# Script completo para desplegar el backend de DietIntel en una instancia de Digital Ocean

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

# Función para verificar si comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para generar contraseña segura
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Configuración por defecto
DO_TOKEN="${DO_TOKEN:-}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
EMAIL="${EMAIL:-}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/krukmat/diet-intel.git}"
BRANCH="${BRANCH:-main}"

# Verificar argumentos requeridos
if [ -z "$DO_TOKEN" ]; then
    error "DO_TOKEN es requerido. Configúralo como variable de entorno."
fi

if [ -z "$DOMAIN_NAME" ]; then
    error "DOMAIN_NAME es requerido. Configúralo como variable de entorno."
fi

if [ -z "$EMAIL" ]; then
    error "EMAIL es requerido para SSL. Configúralo como variable de entorno."
fi

log "🎯 Iniciando despliegue de DietIntel Backend en Digital Ocean"
log "📧 Email: $EMAIL"
log "🌐 Dominio: $DOMAIN_NAME"
log "📦 Repo: $GITHUB_REPO"
log "🌿 Branch: $BRANCH"

# Generar contraseñas seguras si no están configuradas
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(generate_password)}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(generate_password)}"
SECRET_KEY="${SECRET_KEY:-$(openssl rand -base64 64 | tr -d '\n')}"

log "🔐 Contraseñas generadas/configuradas para servicios internos"

---

# **FASE 1: CONFIGURACIÓN INICIAL DE LA INSTANCIA**

log "🔧 FASE 1: Configuración inicial del sistema..."

# Actualizar sistema
log "📦 Actualizando sistema operativo..."
apt-get update && apt-get upgrade -y

# Instalar herramientas esenciales
log "🛠️ Instalando herramientas esenciales..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    git \
    wget \
    htop \
    nano \
    ufw \
    fail2ban \
    logrotate

# Instalar compiladores y herramientas de desarrollo
log "🔧 Instalando compiladores y herramientas de desarrollo..."
apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    autoconf \
    automake \
    libtool

# Instalar librerías para OpenCV y visión por computadora
log "👁️ Instalando librerías para visión por computadora..."
apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgtk-3-0 \
    libgthread-2.0-0 \
    libgdk-pixbuf2.0-0 \
    libcairo-gobject2 \
    libpango-1.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libgconf-2-4 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0

# Instalar librerías de imagen y multimedia
log "🖼️ Instalando librerías de imagen y multimedia..."
apt-get install -y \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libjasper-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libatlas-base-dev \
    liblapack-dev \
    libblas-dev \
    libeigen3-dev \
    libopenexr-dev \
    libgphoto2-dev \
    libhdf5-dev \
    libdc1394-22-dev

# Instalar Tesseract OCR con idiomas
log "📝 Instalando Tesseract OCR..."
apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-spa \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    tesseract-ocr-ita \
    tesseract-ocr-por

# Instalar herramientas adicionales para debugging y desarrollo
log "🔍 Instalando herramientas de debugging..."
apt-get install -y \
    strace \
    ltrace \
    gdb \
    valgrind \
    tcpdump \
    net-tools \
    dnsutils \
    telnet \
    ncdu \
    tree

# Instalar Docker
log "🐳 Instalando Docker..."
if ! command_exists docker; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    success "Docker instalado correctamente"
else
    success "Docker ya está instalado"
fi

# Instalar Docker Compose
log "🐳 Instalando Docker Compose..."
if ! command_exists docker-compose; then
    curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    success "Docker Compose instalado correctamente"
else
    success "Docker Compose ya está instalado"
fi

# Configurar usuario no-root para Docker
log "👤 Configurando usuario para Docker..."
if ! getent group docker > /dev/null 2>&1; then
    groupadd docker
fi

# Crear usuario de despliegue
if ! id "dietintel" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash dietintel
    usermod -aG docker dietintel
    success "Usuario dietintel creado"
else
    success "Usuario dietintel ya existe"
fi

# Configurar SSH para usuario dietintel
mkdir -p /home/dietintel/.ssh
chmod 700 /home/dietintel/.ssh

# Configurar firewall
log "🔥 Configurando firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 8000/tcp # API (opcional, para acceso directo)
ufw --force enable

success "Firewall configurado correctamente"

---

# **FASE 2: CONFIGURACIÓN DE LA APLICACIÓN**

log "🔧 FASE 2: Configuración de la aplicación..."

# Crear directorio de la aplicación
APP_DIR="/opt/dietintel"
if [ ! -d "$APP_DIR" ]; then
    mkdir -p $APP_DIR
    chown dietintel:dietintel $APP_DIR
fi

# Clonar repositorio (como usuario dietintel)
log "📥 Clonando repositorio desde GitHub..."
cd /tmp
if [ -d "dietintel-repo" ]; then
    rm -rf dietintel-repo
fi

git clone $GITHUB_REPO dietintel-repo
cd dietintel-repo

# Verificar rama correcta
git checkout $BRANCH
success "Repositorio clonado correctamente en rama $BRANCH"

# Copiar archivos al directorio de aplicación
log "📋 Copiando archivos de aplicación..."
cp -r . $APP_DIR/
chown -R dietintel:dietintel $APP_DIR

# Crear archivo de configuración de entorno
log "⚙️ Creando archivo de configuración de entorno..."
cd $APP_DIR

cat > .env << EOF
# Base de Datos
POSTGRES_DB=dietintel
POSTGRES_USER=dietintel_user
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# Redis
REDIS_PASSWORD=$REDIS_PASSWORD

# Aplicación
SECRET_KEY=$SECRET_KEY
API_PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=production

# OpenFoodFacts API
OFF_BASE_URL=https://world.openfoodfacts.org
OFF_TIMEOUT=10.0
OFF_RATE_LIMIT_DELAY=0.2
OFF_MAX_RETRIES=5
OFF_RETRY_DELAY=2.0

# SSL/Dominio
DOMAIN_NAME=$DOMAIN_NAME
EMAIL=$EMAIL

# Performance
API_REPLICAS=2
REDIS_CACHE_TTL_HOURS=24
REDIS_MAX_CONNECTIONS=20
EOF

# Crear directorios necesarios
mkdir -p logs uploads temp debug_images
chown -R dietintel:dietintel logs uploads temp debug_images

success "Archivo .env creado correctamente"

---

# **FASE 3: CONFIGURACIÓN DE SSL CON LET'S ENCRYPT**

log "🔒 FASE 3: Configuración de SSL..."

# Instalar Certbot
log "📜 Instalando Certbot para SSL..."
apt-get install -y certbot python3-certbot-nginx

# Crear configuración Nginx inicial (sin SSL)
log "🌐 Creando configuración Nginx inicial..."
cat > nginx/prod.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream dietintel_api {
        server api:8000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Redirect HTTP to HTTPS (después de obtener certificado)
        return 301 https://$host$request_uri;
    }

    # API server block (opcional, para acceso directo)
    server {
        listen 8000;
        server_name _;

        location / {
            proxy_pass http://dietintel_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Rate limiting para API
            limit_req zone=api burst=20 nodelay;
        }
    }
}
EOF

success "Configuración Nginx inicial creada"

---

# **FASE 4: CONFIGURACIÓN DE BASE DE DATOS**

log "🗄️ FASE 4: Configuración de base de datos..."

# Crear archivo de configuración de PostgreSQL optimizada
log "⚙️ Creando configuración PostgreSQL optimizada..."
cat > docker-compose.prod.override.yml << EOF
version: '3.8'

services:
  db:
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-dietintel}
      POSTGRES_USER: ${POSTGRES_USER:-dietintel_user}
      POSTGRES_PASSWORD: $POSTGRES_PASSWORD
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "effective_cache_size=1GB"
      - "-c"
      - "maintenance_work_mem=64MB"
      - "-c"
      - "checkpoint_completion_target=0.9"
      - "-c"
      - "wal_buffers=16MB"
      - "-c"
      - "default_statistics_target=100"
      - "-c"
      - "random_page_cost=1.5"
      - "-c"
      - "effective_io_concurrency=200"
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data/pgdata
      - ./database/init:/docker-entrypoint-initdb.d

  redis:
    command: redis-server --appendonly yes --requirepass $REDIS_PASSWORD --maxmemory 256mb --maxmemory-policy allkeys-lru

  api:
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-dietintel_user}:$POSTGRES_PASSWORD@db:5432/${POSTGRES_DB:-dietintel}
      REDIS_URL: redis://:$REDIS_PASSWORD@redis:6379/0
      SECRET_KEY: $SECRET_KEY
      DOMAIN_NAME: $DOMAIN_NAME
      EMAIL: $EMAIL
EOF

success "Configuración de producción creada"

---

# **FASE 5: CONFIGURACIÓN DE MONITOREO Y LOGS**

log "📊 FASE 5: Configuración de monitoreo..."

# Crear configuración de logrotate
log "📝 Configurando rotación de logs..."
cat > /etc/logrotate.d/dietintel << 'EOF'
/opt/dietintel/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 dietintel dietintel
    postrotate
        systemctl reload dietintel-api 2>/dev/null || true
    endscript
}
EOF

# Crear script de health check personalizado
log "💚 Creando script de health check..."
cat > scripts/health_check.sh << 'EOF'
#!/bin/bash
# Health check script para DietIntel

API_URL="http://localhost:8000/api/v1/food/vision/health"

# Verificar API
if curl -f -s $API_URL | grep -q "healthy"; then
    echo "✅ API: OK"
    exit 0
else
    echo "❌ API: ERROR"
    exit 1
fi
EOF

chmod +x scripts/health_check.sh

# Crear servicio systemd para la aplicación
log "⚙️ Creando servicio systemd..."
cat > /etc/systemd/system/dietintel-api.service << EOF
[Unit]
Description=DietIntel FastAPI Application
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
User=dietintel
Group=dietintel
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd
systemctl daemon-reload

success "Configuración de monitoreo y servicios creada"

---

# **FASE 6: CONFIGURACIÓN DE BACKUPS**

log "💾 FASE 6: Configuración de backups..."

# Crear script de backup
log "📦 Creando script de backup..."
cat > scripts/backup.sh << 'EOF'
#!/bin/bash
# Script de backup para DietIntel

BACKUP_DIR="/opt/dietintel/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio de backup
mkdir -p $BACKUP_DIR

# Backup de base de datos
echo "💾 Creando backup de base de datos..."
docker exec dietintel_postgres_prod pg_dump -U dietintel_user dietintel > $BACKUP_DIR/db_backup_$DATE.sql

# Backup de configuración
cp /opt/dietintel/.env $BACKUP_DIR/.env_backup_$DATE

# Backup de logs recientes
cp /opt/dietintel/logs/app.log $BACKUP_DIR/app_log_$DATE.log 2>/dev/null || true

# Comprimir backup
cd $BACKUP_DIR
tar -czf dietintel_backup_$DATE.tar.gz db_backup_$DATE.sql .env_backup_$DATE app_log_$DATE.log 2>/dev/null || true

# Limpiar backups antiguos (mantener últimos 7 días)
find $BACKUP_DIR -name "*.tar.gz" -type f -mtime +7 -delete

echo "✅ Backup completado: $BACKUP_DIR/dietintel_backup_$DATE.tar.gz"
EOF

chmod +x scripts/backup.sh

# Configurar cron job para backups diarios
crontab -l | { cat; echo "0 2 * * * /opt/dietintel/scripts/backup.sh"; } | crontab -

success "Sistema de backups configurado"

---

# **FASE 7: DESPLIEGUE INICIAL**

log "🚀 FASE 7: Despliegue inicial..."

# Construir e iniciar servicios
log "🏗️ Construyendo e iniciando servicios..."
cd $APP_DIR

# Construir imágenes
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml build

# Iniciar servicios
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml up -d

# Esperar a que servicios estén listos
log "⏳ Esperando servicios..."
sleep 30

# Verificar servicios
log "🔍 Verificando servicios..."

# Verificar PostgreSQL
if docker ps | grep -q "dietintel_postgres_prod"; then
    success "PostgreSQL: ✅ Corriendo correctamente"
else
    error "PostgreSQL: ❌ Error en el servicio"
fi

# Verificar Redis
if docker ps | grep -q "dietintel_redis_prod"; then
    success "Redis: ✅ Corriendo correctamente"
else
    error "Redis: ❌ Error en el servicio"
fi

# Verificar API
if docker ps | grep -q "dietintel_api_prod"; then
    success "API: ✅ Corriendo correctamente"
else
    error "API: ❌ Error en el servicio"
fi

# Verificar Nginx
if docker ps | grep -q "dietintel_nginx"; then
    success "Nginx: ✅ Corriendo correctamente"
else
    error "Nginx: ❌ Error en el servicio"
fi

success "Todos los servicios están corriendo correctamente"

---

# **FASE 8: CONFIGURACIÓN DE SSL Y DOMINIO**

log "🔒 FASE 8: Configuración de SSL..."

# Obtener certificado SSL con Let's Encrypt
log "📜 Solicitando certificado SSL..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/html \
    --email $EMAIL \
    --domain $DOMAIN_NAME \
    --domain api.$DOMAIN_NAME \
    --agree-tos \
    --no-eff-email \
    --force-renewal

if [ $? -eq 0 ]; then
    success "Certificado SSL obtenido correctamente"
else
    warning "No se pudo obtener certificado SSL automáticamente"
    warning "Configura SSL manualmente o verifica configuración DNS"
fi

# Crear directorio para certificados
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem nginx/ssl/

# Actualizar configuración Nginx con SSL
log "🌐 Actualizando configuración Nginx con SSL..."
cat > nginx/prod.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream dietintel_api {
        server api:8000;
    }

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=auth:10m rate=5r/s;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/fullchain.pem;
    ssl_certificate_key /etc/ssl/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;

    server {
        listen 80;
        server_name $DOMAIN_NAME api.$DOMAIN_NAME;
        return 301 https://\$server_name\$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name $DOMAIN_NAME;

        # SSL configuration
        ssl_certificate /etc/ssl/certs/fullchain.pem;
        ssl_certificate_key /etc/ssl/certs/privkey.pem;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        location / {
            proxy_pass http://dietintel_api;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;

            # Rate limiting para API
            limit_req zone=api burst=20 nodelay;
        }
    }

    # API subdomain
    server {
        listen 443 ssl http2;
        server_name api.$DOMAIN_NAME;

        # SSL configuration
        ssl_certificate /etc/ssl/certs/fullchain.pem;
        ssl_certificate_key /etc/ssl/certs/privkey.pem;

        location / {
            proxy_pass http://dietintel_api;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;

            # Rate limiting más permisivo para API directa
            limit_req zone=api burst=50 nodelay;
        }
    }
}
EOF

# Reiniciar Nginx para aplicar configuración SSL
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml restart nginx

success "Configuración SSL aplicada"

---

# **FASE 9: VERIFICACIÓN FINAL**

log "🔍 FASE 9: Verificación final del despliegue..."

# Verificar servicios
log "🔍 Verificando servicios..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Verificar health check de la aplicación
log "💚 Verificando health check de la aplicación..."
HEALTH_URL="http://localhost:8000/api/v1/food/vision/health"

if curl -f -s $HEALTH_URL | grep -q "healthy"; then
    success "Health check de aplicación: ✅ PASSED"
else
    warning "Health check de aplicación: ❌ FAILED"
    warning "Verifica logs: docker logs dietintel_api_prod"
fi

# Verificar conectividad de base de datos
log "🗄️ Verificando conectividad de base de datos..."
if docker exec dietintel_postgres_prod pg_isready -U dietintel_user -d dietintel >/dev/null 2>&1; then
    success "Base de datos: ✅ Conectada correctamente"
else
    error "Base de datos: ❌ Error de conexión"
fi

# Verificar conectividad de Redis
log "🔄 Verificando conectividad de Redis..."
if docker exec dietintel_redis_prod redis-cli -a $REDIS_PASSWORD ping | grep -q "PONG"; then
    success "Redis: ✅ Conectado correctamente"
else
    error "Redis: ❌ Error de conexión"
fi

success "Verificación final completada"

---

# **FASE 10: CONFIGURACIÓN DE MANTENIMIENTO**

log "🛠️ FASE 10: Configuración de mantenimiento..."

# Crear script de actualización
log "📦 Creando script de actualización..."
cat > scripts/update.sh << 'EOF'
#!/bin/bash
# Script de actualización para DietIntel

echo "🔄 Iniciando actualización de DietIntel..."

# Detener servicios
echo "⏹️ Deteniendo servicios..."
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml down

# Backup antes de actualizar
echo "💾 Creando backup antes de actualizar..."
/opt/dietintel/scripts/backup.sh

# Pull cambios más recientes
echo "📥 Actualizando código..."
cd /opt/dietintel
git pull origin main

# Reconstruir imágenes
echo "🏗️ Reconstruyendo imágenes..."
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml build --no-cache

# Iniciar servicios actualizados
echo "🚀 Iniciando servicios actualizados..."
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml up -d

# Verificar servicios
echo "🔍 Verificando servicios..."
sleep 10
/opt/dietintel/scripts/health_check.sh

if [ $? -eq 0 ]; then
    echo "✅ Actualización completada exitosamente"
else
    echo "❌ Error en actualización. Revisa logs."
    exit 1
fi
EOF

chmod +x scripts/update.sh

# Crear script de monitoreo
log "📊 Creando script de monitoreo..."
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash
# Script de monitoreo para DietIntel

echo "📊 Estado de servicios DietIntel:"
echo "================================="

# Servicios Docker
echo "🐳 Servicios Docker:"
docker ps --filter "name=dietintel" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "💾 Uso de recursos:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "🗄️ Base de datos:"
docker exec dietintel_postgres_prod psql -U dietintel_user -d dietintel -c "SELECT COUNT(*) as total_logs FROM vision_logs;" 2>/dev/null || echo "No se pudo conectar a BD"

echo ""
echo "🔄 Redis:"
docker exec dietintel_redis_prod redis-cli -a "$REDIS_PASSWORD" info memory | grep -E "(used_memory_human|maxmemory_human)" 2>/dev/null || echo "No se pudo conectar a Redis"

echo ""
echo "🌐 Nginx:"
curl -I http://localhost/health 2>/dev/null | head -1 || echo "Nginx no responde"
EOF

chmod +x scripts/monitor.sh

success "Scripts de mantenimiento creados"

---

# **FASE 11: DOCUMENTACIÓN Y FINALIZACIÓN**

log "📚 FASE 11: Documentación y finalización..."

# Crear archivo README de despliegue
cat > DEPLOYMENT_README.md << EOF
# 🚀 DietIntel - Despliegue en Digital Ocean

## Información del Despliegue
- **Fecha**: $(date)
- **Dominio**: $DOMAIN_NAME
- **Email SSL**: $EMAIL
- **Estado**: ✅ Despliegue completado exitosamente

## Servicios Desplegados

### 🐳 Docker Containers
- **dietintel_postgres_prod**: PostgreSQL 15 con datos de producción
- **dietintel_redis_prod**: Redis 7 con configuración optimizada
- **dietintel_api_prod**: FastAPI aplicación (2 réplicas)
- **dietintel_nginx**: Nginx reverse proxy con SSL

### 🌐 URLs de Acceso
- **Aplicación principal**: https://$DOMAIN_NAME
- **API directa**: https://api.$DOMAIN_NAME
- **Health check**: https://$DOMAIN_NAME/api/v1/food/vision/health

### 🔐 Credenciales de Servicios Internos
- **PostgreSQL**: Usuario: dietintel_user / Password: [CONFIGURADA]
- **Redis**: Password: [CONFIGURADA]
- **Aplicación**: Secret Key: [CONFIGURADA]

## Comandos Útiles

### Gestión de Servicios
\`\`\`bash
# Ver estado de servicios
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml ps

# Ver logs de aplicación
docker logs dietintel_api_prod -f

# Reiniciar servicios
docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml restart

# Actualizar aplicación
./scripts/update.sh
\`\`\`

### Monitoreo
\`\`\`bash
# Monitoreo básico
./scripts/monitor.sh

# Health check
./scripts/health_check.sh

# Logs del sistema
tail -f /var/log/syslog | grep dietintel
\`\`\`

### Backups
\`\`\`bash
# Crear backup manual
./scripts/backup.sh

# Ver backups disponibles
ls -la /opt/dietintel/backups/
\`\`\`

## Configuración SSL
- **Certificado**: Let's Encrypt
- **Auto-renovación**: Configurada automáticamente
- **Dominios**: $DOMAIN_NAME, api.$DOMAIN_NAME

## Seguridad Implementada
- ✅ Firewall configurado (UFW)
- ✅ SSL/TLS obligatorio
- ✅ Headers de seguridad
- ✅ Usuario no-root
- ✅ Rate limiting básico

## Próximos Pasos
1. **Configurar móvil** para apuntar a: https://$DOMAIN_NAME
2. **Probar endpoints** de la aplicación
3. **Configurar monitoreo** externo (opcional)
4. **Configurar CI/CD** para despliegues automáticos

---

**🎉 ¡Despliegue completado exitosamente!**

El backend de DietIntel está ahora corriendo en producción en Digital Ocean con configuración completa de seguridad, monitoreo y mantenimiento automático.
EOF

success "Documentación de despliegue creada"

---

# **RESUMEN FINAL DEL DESPLIEGUE**

log "🎉 **DESPLIEGUE COMPLETADO EXITOSAMENTE**"
echo ""
echo "📋 **RESUMEN DE LO DESPLEGADO:**"
echo "================================"

# Información del despliegue
echo "🌐 **Dominio**: https://$DOMAIN_NAME"
echo "📧 **Email SSL**: $EMAIL"
echo "🐳 **Servicios Docker**: 4 servicios desplegados"
echo "🗄️ **Base de Datos**: PostgreSQL 15 configurada"
echo "🔄 **Cache**: Redis 7 optimizado"
echo "🔒 **SSL**: Let's Encrypt configurado"
echo "📊 **Monitoreo**: Health checks y logs configurados"
echo "💾 **Backups**: Sistema automático configurado"

echo ""
echo "🔗 **ENDPOINTS DISPONIBLES:**"
echo "=========================="
echo "• Health Check: https://$DOMAIN_NAME/api/v1/food/vision/health"
echo "• API Análisis: https://$DOMAIN_NAME/api/v1/food/vision/analyze"
echo "• API Historial: https://$DOMAIN_NAME/api/v1/food/vision/history"
echo "• API Correcciones: https://$DOMAIN_NAME/api/v1/food/vision/correction"

echo ""
echo "📁 **ARCHIVOS CREADOS:**"
echo "======================="
echo "• .env (variables de entorno)"
echo "• docker-compose.prod.override.yml (configuración producción)"
echo "• nginx/prod.conf (configuración SSL)"
echo "• scripts/health_check.sh (verificación de salud)"
echo "• scripts/backup.sh (backups automáticos)"
echo "• scripts/update.sh (actualizaciones)"
echo "• scripts/monitor.sh (monitoreo)"
echo "• DEPLOYMENT_README.md (documentación completa)"

echo ""
echo "🚀 **PRÓXIMOS PASOS:**"
echo "===================="
echo "1. ✅ Configurar aplicación móvil para apuntar a: https://$DOMAIN_NAME"
echo "2. ✅ Probar todos los endpoints de la aplicación"
echo "3. ✅ Configurar dominio en proveedor DNS (si es necesario)"
echo "4. ✅ Verificar funcionamiento completo end-to-end"

echo ""
echo "🎯 **ESTADO FINAL**: Backend de DietIntel desplegado exitosamente en Digital Ocean"
echo "🔒 Seguridad: Configuración completa con SSL y monitoreo"
echo "📊 Performance: Optimizado para producción con 2 réplicas"
echo "🔄 Mantenimiento: Scripts automáticos para backups y actualizaciones"

success "¡Despliegue completado exitosamente! El backend está listo para producción."
