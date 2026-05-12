# 🌐 Acceso Remoto - Amellify

## Descripción

Amellify incluye un servidor web con **base de datos SQLite** y **WebSocket** para sincronización en tiempo real entre todos los dispositivos conectados.

---

## Inicio Rápido

```bash
# Iniciar servidor
./iniciar-web.sh

# Acceder desde cualquier dispositivo
http://100.101.28.97:3000
```

---

## Características

| Feature | Descripción |
|---------|-------------|
| 🔄 **Sincronización real** | Cambios instantáneos en todos los dispositivos |
| 📡 **WebSocket** | Conexión persistente bidireccional |
| 🗄️ **SQLite** | Base de datos eficiente |
| 🌐 **Multi-dispositivo** | Móvil, tablet, laptop, PC |

---

## Scripts

| Script | Descripción |
|--------|-------------|
| `./iniciar-web.sh` | Iniciar en segundo plano |
| `./detener-web.sh` | Detener servidor |
| `./iniciar-back.sh` | Iniciar en terminal |

```bash
# Ver logs
tail -f /tmp/amellify.log

# Ver estado
pgrep -f "node server.js" && echo "Corriendo" || echo "Detenido"
```

---

## Configuración

### Cambiar IP (server.js línea 7)
```javascript
const HOST = process.env.HOST || 'TU_IP';
```

### Cambiar puerto
```bash
PORT=8080 ./iniciar-web.sh
```

---

## Base de Datos

**Archivo**: `amellify.db` (carpeta del proyecto)

**Tablas**:
- `courses` - Materias
- `schedules` - Horarios
- `config` - Configuración

### Backup
```bash
cp amellify.db amellify-backup-$(date +%Y%m%d).db
```

---

## Solución de Problemas

```bash
# Verificar que corre
curl http://localhost:3000/api/stats

# Ver IP del servidor
hostname -I

# Permitir firewall
sudo ufw allow 3000
```