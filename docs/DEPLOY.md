# 🚀 Guía de Despliegue en Servidor Propio (Self-Hosting) — Amellify v3

Esta guía detalla el despliegue de **Amellify v3** en un servidor virtual privado (VPS) o servidor dedicado con **Ubuntu** o **Debian**, utilizando **Docker Compose**, base de datos **PostgreSQL 17**, contenedor standalone de **Next.js 16**, proxy inverso **Caddy** con certificados SSL/TLS automáticos (compatibles con dominios personalizados y hostnames gratuitos de [sslip.io](https://sslip.io)), y copias de seguridad automáticas con retención.

---

## 📋 Requisitos Previos

### Hardware y Sistema Recomendados
- **Sistema Operativo:** Ubuntu 22.04 / 24.04 LTS o Debian 12 (Bookworm).
- **Recursos mínimos:** 1 vCPU, 1 GB RAM, 10 GB de almacenamiento SSD (óptimo: 2 GB RAM con swap configurado).
- **Puertos de Red:** Puertos `80` (HTTP) y `443` (HTTPS) accesibles desde internet para la emisión de certificados SSL.

---

## 🛠️ Paso 1: Instalación de Docker y Docker Compose

En tu servidor Ubuntu o Debian, actualiza los paquetes e instala Docker mediante el script oficial:

```bash
# Actualizar repositorios
sudo apt-get update && sudo apt-get upgrade -y

# Instalar Docker Engine y plugins oficiales (Compose incluido)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Permitir ejecutar docker sin sudo con tu usuario actual
sudo usermod -aG docker $USER
newgrp docker

# Verificar instalación
docker --version
docker compose version
```

Configura el firewall (UFW) si está activo:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 📥 Paso 2: Clonar el Repositorio

Clona el repositorio oficial de Amellify y cambia al directorio del proyecto:

```bash
git clone -b v3 https://github.com/ManuelAmell/Amellify.git
cd Amellify
```

---

## ⚙️ Paso 3: Configuración de Variables de Entorno

Copia la plantilla de variables de entorno:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tu editor preferido (`nano .env`):

```bash
nano .env
```

### Variables Esenciales

1. **Secreto de Autenticación (`BETTER_AUTH_SECRET`):**
   Genera una clave criptográfica de 32 bytes con OpenSSL:
   ```bash
   openssl rand -base64 32
   ```
   Copia el valor resultante en `BETTER_AUTH_SECRET`.

2. **Dominio o Hostname con sslip.io (`DOMAIN`):**
   - **Si tienes un dominio propio:** `DOMAIN=horarios.tuuniversidad.edu`
   - **Si NO tienes dominio y usas la IP pública de tu VPS (ej. `198.51.100.25`):**
     Puedes usar un hostname gratuito de **[sslip.io](https://sslip.io)**:
     ```env
     DOMAIN=amellify.198.51.100.25.sslip.io
     ```
     Caddy resolverá este hostname y generará automáticamente un certificado SSL gratuito de Let's Encrypt o ZeroSSL sin configuraciones adicionales.

3. **URL Base de la Aplicación (`BETTER_AUTH_URL`):**
   Debe coincidir con tu protocolo y dominio:
   ```env
   BETTER_AUTH_URL=https://amellify.198.51.100.25.sslip.io
   ```

4. **Credenciales de Base de Datos:**
   Define una contraseña segura para PostgreSQL:
   ```env
   POSTGRES_USER=amellify
   POSTGRES_PASSWORD=tu_password_super_seguro_aqui
   POSTGRES_DB=amellify
   ```

5. **Correo para Notificaciones de SSL (`ACME_EMAIL`):**
   ```env
   ACME_EMAIL=tu_correo@ejemplo.com
   ```

6. **Proveedores de IA para Extracción de Horarios (Opcional pero recomendado):**
   Consulta [docs/AI-PROVIDERS.md](AI-PROVIDERS.md) para obtener claves gratuitas de **Google AI Studio (Gemini)**, **Groq**, **OpenRouter** o **Mistral**:
   ```env
   GEMINI_API_KEY=tu_api_key_de_gemini
   GROQ_API_KEY=tu_api_key_de_groq
   ```

---

## 🚢 Paso 4: Despliegue con Docker Compose

Amellify incluye perfiles de Docker Compose modulares:
- **`proxy`:** Despliega el servidor web Caddy para terminar SSL y redirigir el tráfico hacia el contenedor de Next.js.
- **`backup`:** Inicia un contenedor cron que ejecuta copias de seguridad diarias de PostgreSQL.

Para iniciar la aplicación completa en producción con SSL y copias de seguridad automáticas:

```bash
docker compose --profile proxy --profile backup up -d --build
```

### ¿Qué sucede durante este comando?
1. **`db`:** Levanta PostgreSQL 17 Alpine en una red interna aislada y ejecuta comprobaciones de salud (`pg_isready`).
2. **`migrate`:** Espera a que PostgreSQL esté saludable y ejecuta automáticamente `drizzle-kit migrate` para aplicar el esquema y tablas más recientes.
3. **`app`:** Construye y arranca la imagen ligera de Next.js 16 (standalone, non-root `nextjs`), expuesta internamente en el puerto `3000`.
4. **`caddy`:** Escucha en los puertos `80` y `443`, solicita el certificado SSL para tu `$DOMAIN` y realiza el balanceo inverso hacia `app:3000`.
5. **`backup`:** Programa el respaldo periódico de la base de datos con rotación de 14 días.

---

## 🔍 Paso 5: Verificación del Estado

Comprueba que todos los contenedores estén corriendo y saludables:

```bash
docker compose ps
```

Verifica el endpoint de salud de la aplicación:

```bash
curl -I https://${DOMAIN}/api/health
```

Debe retornar código HTTP `200 OK` con `{ "ok": true, "db": "up" }`.

Para consultar los registros en tiempo real:

```bash
# Registros de la aplicación Next.js
docker compose logs -f app

# Registros del proxy Caddy (emisión de certificados SSL)
docker compose logs -f caddy

# Registros de la base de datos
docker compose logs -f db
```

---

## 💾 Paso 6: Copias de Seguridad y Restauración

### Backups Automáticos
Si habilitaste el perfil `backup`, se ejecutará una copia de seguridad diaria programada a las `03:00 UTC` dentro del directorio `./backups/` con compresión gzip:
```
./backups/amellify_YYYYMMDD_HHMMSS.sql.gz
```
Los archivos con más de **14 días** de antigüedad se purgan automáticamente para evitar saturar el disco.

### Realizar un Backup Manual Inmediato
Puedes forzar un respaldo inmediato en cualquier momento:

```bash
docker compose run --rm backup /scripts/backup.sh
```

O directamente contra la base de datos:

```bash
docker compose exec db pg_dump -U amellify -d amellify | gzip > ./backups/amellify_manual_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restaurar una Copia de Seguridad
El repositorio incluye un script seguro de restauración (`scripts/restore.sh`) que verifica la conectividad, pide confirmación previa y aplica el dump en una transacción:

```bash
# Uso interactivo con confirmación
./scripts/restore.sh ./backups/amellify_20260910_030000.sql.gz

# O a través del contenedor
docker compose run --rm -v $(pwd)/backups:/backups backup /scripts/restore.sh /backups/amellify_20260910_030000.sql.gz
```

---

## 🔄 Paso 7: Actualización de Versión

Para actualizar Amellify a una nueva versión sin interrumpir tus datos:

```bash
# 1. Obtener los últimos cambios de código
git pull origin v3

# 2. Reconstruir imágenes y reiniciar contenedores
docker compose --profile proxy --profile backup up -d --build

# 3. Limpiar imágenes Docker huérfanas o antiguas
docker image prune -f
```

Las migraciones de base de datos se aplicarán automáticamente a través del servicio `migrate` antes de que el contenedor de la aplicación se reinicie.

---

## 🛡️ Consejos de Seguridad para Producción

1. **No expongas el puerto 5432 al exterior:** El puerto de PostgreSQL está configurado deliberadamente para comunicarse sólo dentro de la red interna de Docker (`amellify_default`).
2. **Habilita memoria Swap si tienes 1 GB de RAM:**
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
3. **Copia remota de backups:** Se recomienda sincronizar la carpeta `./backups` a un bucket S3 o almacenamiento secundario mediante `rclone` o `rsync`.
