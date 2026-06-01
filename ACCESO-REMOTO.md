# Acceso remoto — Amellify

## Descripción

Servidor web con **SQLite**, **JWT por usuario** y **WebSocket** para sincronización en tiempo real entre dispositivos en la red.

---

## Inicio rápido

```bash
./iniciar-web.sh              # Segundo plano (log en /tmp/amellify.log)
./iniciar-web.sh --foreground # Desarrollo en terminal
./detener-web.sh
```

Tras iniciar, el script muestra la URL local y de red (IP LAN automática). Ejemplo:

- Local: `http://127.0.0.1:3000`
- Red: `http://192.168.x.x:3000`

---

## Scripts

| Script | Descripción |
|--------|-------------|
| `./iniciar-web.sh` | Servidor en segundo plano |
| `./iniciar-web.sh -f` | Servidor en primer plano |
| `./detener-web.sh` | Detener servidor |
| `./detener-web.sh --clean-log` | Detener y borrar log |
| `./iniciar-back.sh` | Backend en terminal (primer plano) |
| `./abrir-amellify.sh` | Electron o navegador + servidor |
| `./desplegar-ssh.sh` | Despliegue en otra máquina vía SSH |

```bash
tail -f /tmp/amellify.log
cat /tmp/amellify.pid
curl http://localhost:3000/api/health
```

Equivalentes npm: `npm run web:bg`, `npm run web:stop`, `npm run deploy:ssh`.

---

## Variables de entorno

| Variable | Default | Uso |
|----------|---------|-----|
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `PORT` | `3000` | Puerto HTTP |
| `DISPLAY_HOST` | IP LAN | Solo mensajes en consola |
| `AMELLIFY_DB_PATH` | `./amellify.db` | Ruta de la base de datos |
| `AMELLIFY_JWT_SECRET` | (dev) | Obligatorio en producción |

```bash
PORT=8080 HOST=0.0.0.0 ./iniciar-web.sh
```

Copia [`.env.example`](.env.example) a `.env` en el servidor.

---

## Base de datos

**Archivo:** `amellify.db` (o ruta en `AMELLIFY_DB_PATH`)

```bash
cp amellify.db "amellify-backup-$(date +%Y%m%d).db"
```

---

## Despliegue por SSH

Instala o actualiza Amellify en otra máquina (rsync + `npm install` + systemd user o nohup):

```bash
./desplegar-ssh.sh usuario@servidor.remoto ~/amellify
```

Opciones:

| Opción | Efecto |
|--------|--------|
| `--dry-run` | Solo muestra cambios de rsync |
| `--with-db` | Copia `amellify.db` al remoto |
| `--port N` | Puerto del servicio (default 3000) |
| `--restart-only` | Reinicia sin sincronizar archivos |

En el remoto:

```bash
ssh usuario@servidor systemctl --user status amellify
ssh usuario@servidor tail -f /tmp/amellify.log   # si usa nohup
```

Habilitar linger para que el servicio user sobreviva al cerrar sesión (opcional):

```bash
sudo loginctl enable-linger $USER
```

---

## Firewall

```bash
sudo ufw allow 3000/tcp
hostname -I
```

---

## Solución de problemas

```bash
./detener-web.sh
./iniciar-web.sh
tail -30 /tmp/amellify.log
```

Si el puerto está ocupado: `fuser -k 3000/tcp` (Linux) y reiniciar.
