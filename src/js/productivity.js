/**
 * Features de productividad: feed ICS, PDF, push, import ICS URL, export completo, Google
 */
import { api, getAuthToken } from './api.js';
import { icon, escapeHtml, getClientOrigin } from './utils.js';

export function installProductivityFeatures(proto) {
  proto._icsFeedUrl = null;

  proto.ensureIcsFeed = async function () {
    try {
      const data = await api.createIcsFeed(false);
      this._icsFeedUrl = data.url;
      return data.url;
    } catch (e) {
      this.showToast(e.message, 'error');
      return null;
    }
  };

  proto.copyIcsFeedUrl = async function () {
    let url = this._icsFeedUrl;
    if (!url) {
      const data = await api.createIcsFeed(true);
      url = data.url;
      this._icsFeedUrl = url;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.showToast('Enlace de suscripción copiado', 'success');
    } catch {
      this.showAlert(url, 'info');
    }
  };

  proto.rotateIcsFeed = async function () {
    if (!confirm('¿Generar un nuevo enlace? El anterior dejará de funcionar.')) return;
    const data = await api.createIcsFeed(true);
    this._icsFeedUrl = data.url;
    const el = document.getElementById('ics-feed-url-display');
    if (el) el.textContent = data.url;
    this.showToast('Nuevo enlace generado', 'success');
  };

  proto.revokeIcsFeed = async function () {
    if (!confirm('¿Revocar el enlace de calendario? Las apps suscritas dejarán de actualizar.')) return;
    await api.revokeIcsFeed();
    this._icsFeedUrl = null;
    const el = document.getElementById('ics-feed-url-display');
    if (el) el.textContent = 'Sin enlace activo';
    this.showToast('Enlace revocado', 'success');
  };

  proto.printSchedulePdf = function () {
    document.body.classList.add('print-schedule-mode');
    const cleanup = () => {
      document.body.classList.remove('print-schedule-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  proto.exportFullData = async function () {
    try {
      const data = await api.exportFull();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `amellify-completo-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Exportación completa descargada', 'success');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  };

  proto.runAutoBackupIfDue = async function () {
    try {
      const r = await api.autoBackup();
      if (r.created) this.showToast(`Respaldo automático: ${r.file}`, 'success');
    } catch {
      /* silencioso */
    }
  };

  proto.showIcsUrlImport = function () {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:480px">
        <div class="modal-header">
          <h2>${icon('calendar', 'icon-sm')} Importar calendario (.ics URL)</h2>
          <button class="modal-close" onclick="this.closest('.modal').remove()">${icon('x')}</button>
        </div>
        <div class="modal-body">
          <p class="muted">Pega la URL pública de un calendario ICS (Google, Apple, etc.)</p>
          <input type="url" id="ics-url-input" class="form-input" placeholder="https://..." style="width:100%">
          <div id="ics-url-preview" class="import-preview" hidden></div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-primary" id="ics-url-preview-btn">${icon('eye', 'icon-sm')} Vista previa</button>
            <button class="btn btn-secondary" id="ics-url-confirm-btn" hidden>${icon('check', 'icon-sm')} Importar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    let previewData = null;
    modal.querySelector('#ics-url-preview-btn')?.addEventListener('click', async () => {
      const url = modal.querySelector('#ics-url-input')?.value?.trim();
      if (!url) return;
      try {
        const data = await api.previewIcsUrl(url);
        previewData = data.preview;
        const prev = modal.querySelector('#ics-url-preview');
        prev.hidden = false;
        prev.innerHTML = `
          <p><strong>${data.events}</strong> eventos · <strong>${previewData.courses?.length || 0}</strong> materias · <strong>${previewData.exams?.length || 0}</strong> exámenes</p>`;
        modal.querySelector('#ics-url-confirm-btn').hidden = false;
      } catch (e) {
        this.showToast(e.message, 'error');
      }
    });
    modal.querySelector('#ics-url-confirm-btn')?.addEventListener('click', async () => {
      if (!previewData) return;
      try {
        const r = await api.confirmIcsUrlImport(previewData);
        modal.remove();
        this._skipNextSocketSync = true;
        await this.fetchCourses();
        await this.loadAcademicData?.();
        this.renderAll();
        this.showAlert(
          `${r.imported} materias · ${r.examsAdded || 0} exámenes`,
          'success'
        );
      } catch (e) {
        this.showToast(e.message, 'error');
      }
    });
  };

  proto.connectGoogleCalendar = async function () {
    try {
      const st = await api.googleStatus();
      if (!st.configured) {
        this.showAlert(
          'Para OAuth configura GOOGLE_CLIENT_ID en el servidor. Mientras tanto, usa «Copiar enlace ICS» y añádelo en Google Calendar → Añadir calendario → Desde URL.',
          'info'
        );
        return;
      }
      const { url } = await api.googleAuthUrl();
      window.location.href = url;
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  };

  proto.disconnectGoogleCalendar = async function () {
    await api.googleDisconnect();
    this.showToast('Google Calendar desconectado', 'success');
  };

  proto.enablePushNotifications = async function () {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      this.showToast('Push no soportado en este navegador', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      this.showToast('Permiso de notificaciones denegado', 'error');
      return;
    }
    const { publicKey, configured } = await api.getVapidPublic();
    if (!publicKey) {
      this.showToast(
        configured
          ? 'Clave VAPID no disponible'
          : 'Push en servidor: define VAPID_PUBLIC_KEY en .env',
        'info'
      );
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await api.pushSubscribe(sub.toJSON());
    this.settings.pushEnabled = true;
    this.saveSettingsToServer?.();
    this.showToast('Notificaciones push activadas', 'success');
  };

  proto.disablePushNotifications = async function () {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.pushUnsubscribe({ endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    this.settings.pushEnabled = false;
    this.saveSettingsToServer?.();
    this.showToast('Push desactivado', 'success');
  };

  proto.loadIcsFeedDisplay = async function () {
    const el = document.getElementById('ics-feed-url-display');
    if (!el) return;
    try {
      const st = await api.getIcsFeedStatus();
      if (st.active) {
        const data = await api.createIcsFeed(false);
        this._icsFeedUrl = data.url;
        el.textContent = data.url;
      } else {
        this._icsFeedUrl = null;
        el.textContent = 'Sin enlace activo';
      }
    } catch {
      el.textContent = 'Genera un enlace para verlo aquí';
    }
  };

  proto.showIcsFeedQr = async function () {
    let url = this._icsFeedUrl;
    if (!url) {
      const data = await api.createIcsFeed(false);
      url = data.url;
      this._icsFeedUrl = url;
      const el = document.getElementById('ics-feed-url-display');
      if (el) el.textContent = url;
    }
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:320px;text-align:center">
        <div class="modal-header">
          <h2>${icon('grid', 'icon-sm')} Código QR del calendario</h2>
          <button class="modal-close" onclick="this.closest('.modal').remove()">${icon('x')}</button>
        </div>
        <div class="modal-body">
          <img src="${escapeHtml(qrSrc)}" width="180" height="180" alt="QR del feed ICS" class="ics-feed-qr">
          <p class="muted" style="margin-top:12px;font-size:12px;word-break:break-all">${escapeHtml(url)}</p>
        </div>
      </div>`;
    document.body.appendChild(modal);
  };

  proto._renderIcsFeedBlock = function () {
    return `
      <div class="settings-section">
        <h3 class="settings-section-title">${icon('link', 'icon-sm')} Calendario suscribible (ICS)</h3>
        <p class="settings-field-hint">Añade este enlace en Google Calendar, Apple Calendar u Outlook.</p>
        <p id="ics-feed-url-display" class="settings-ics-url muted">Genera un enlace para verlo aquí</p>
        <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.copyIcsFeedUrl()">${icon('copy', 'icon-sm')} Copiar enlace</button>
        <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.showIcsFeedQr()">${icon('grid', 'icon-sm')} Mostrar QR</button>
        <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.rotateIcsFeed()">${icon('refresh', 'icon-sm')} Regenerar enlace</button>
        <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.revokeIcsFeed()">${icon('ban', 'icon-sm')} Revocar enlace</button>
      </div>`;
  };

  proto._renderProductivityDatosExtras = function () {
    return `
      ${this._renderIcsFeedBlock()}
      <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.printSchedulePdf()">${icon('file-text', 'icon-sm')} Exportar PDF / Imprimir</button>
      <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportFullData()">${icon('download', 'icon-sm')} Exportar paquete completo</button>
      <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.showIcsUrlImport()">${icon('upload', 'icon-sm')} Importar desde URL .ics</button>
      <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.connectGoogleCalendar()">${icon('calendar', 'icon-sm')} Google Calendar (OAuth)</button>
    `;
  };

  proto._renderProductivityNotifExtras = function () {
    const s = this.settings;
    const taskDays = s.notifyTaskDaysBefore ?? 1;
    const examDays = s.notifyExamDaysBefore ?? 3;
    const dndStart = s.dndStart || '22:00';
    const dndEnd = s.dndEnd || '08:00';
    return `
      <div class="settings-field">
        <label>${icon('check', 'icon-sm')} Recordatorio de tareas (días antes)</label>
        <select class="form-select" onchange="app.setNotifyTaskDays(Number(this.value))">
          ${[1, 2, 3, 7].map((d) => `<option value="${d}" ${taskDays === d ? 'selected' : ''}>${d} día${d > 1 ? 's' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="settings-field">
        <label>${icon('calendar', 'icon-sm')} Recordatorio de exámenes (días antes)</label>
        <select class="form-select" onchange="app.setNotifyExamDays(Number(this.value))">
          ${[1, 2, 3, 7, 14].map((d) => `<option value="${d}" ${examDays === d ? 'selected' : ''}>${d} días</option>`).join('')}
        </select>
      </div>
      <div class="settings-field">
        <label>${icon('moon', 'icon-sm')} No molestar</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="time" class="form-input" value="${dndStart}" onchange="app.setDndHours(this.value, app.settings.dndEnd)">
          <span>—</span>
          <input type="time" class="form-input" value="${dndEnd}" onchange="app.setDndHours(app.settings.dndStart, this.value)">
        </div>
      </div>
      ${this._settingsToggleBtn(s.dndEnabled !== false ? 'Desactivar no molestar' : 'Activar no molestar', 'moon', 'app.toggleDnd()')}
      <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.enablePushNotifications()">${icon('bell', 'icon-sm')} Activar push PWA</button>
      <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.disablePushNotifications()">${icon('bell-off', 'icon-sm')} Desactivar push</button>
    `;
  };

  proto.setNotifyTaskDays = function (n) {
    this.settings.notifyTaskDaysBefore = n;
    this.saveSettingsToServer?.();
    this.refreshNotifications?.();
  };

  proto.setNotifyExamDays = function (n) {
    this.settings.notifyExamDaysBefore = n;
    this.saveSettingsToServer?.();
    this.refreshNotifications?.();
  };

  proto.setDndHours = function (start, end) {
    this.settings.dndStart = start;
    this.settings.dndEnd = end;
    this.saveSettingsToServer?.();
    this.refreshNotifications?.();
  };

  proto.toggleDnd = function () {
    this.settings.dndEnabled = this.settings.dndEnabled === false;
    this.saveSettingsToServer?.();
    this.openSettingsModal?.('notificaciones');
  };

  const _bindSettingsTabEvents = proto._bindSettingsTabEvents;
  proto._bindSettingsTabEvents = function (modal, tab) {
    _bindSettingsTabEvents?.call(this, modal, tab);
    if (tab === 'datos') this.loadIcsFeedDisplay?.();
  };

  proto.showOfflineBanner = function (offline) {
    let el = document.getElementById('offline-banner');
    if (!offline) {
      el?.remove();
      return;
    }
    if (el) return;
    el = document.createElement('div');
    el.id = 'offline-banner';
    el.className = 'offline-banner';
    el.innerHTML = `${icon('wifi-off', 'icon-sm')} Sin conexión — mostrando datos guardados`;
    document.body.prepend(el);
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}
