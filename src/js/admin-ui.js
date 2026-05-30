/** Gestión de usuarios (solo administradores) */
import { adminApi, getCurrentUser, isAdmin } from './api.js';
import { escapeHtml, icon } from './utils.js';

const ROLE_LABELS = { admin: 'Administrador', user: 'Usuario' };

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function roleBadge(role) {
  const key = role === 'admin' ? 'admin' : 'user';
  return `<span class="admin-role-badge admin-role-badge--${key}">${ROLE_LABELS[key]}</span>`;
}

export function renderAdminUsersPanel({ users = [], loading = false, error = '' } = {}) {
  const rows =
    users.length === 0 && !loading
      ? `<tr><td colspan="5" class="admin-users-empty">No hay usuarios registrados.</td></tr>`
      : users
          .map(
            (u) => `
        <tr data-user-id="${u.id}">
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.name || '—')}</td>
          <td>${roleBadge(u.role)}</td>
          <td>${formatDate(u.created_at)}</td>
          <td class="admin-users-actions">
            <button type="button" class="btn btn-icon btn-secondary" data-edit-user="${u.id}" aria-label="Editar ${escapeHtml(u.email)}">
              ${icon('edit', 'icon-sm')}
            </button>
            <button type="button" class="btn btn-icon btn-secondary btn-danger-icon" data-delete-user="${u.id}" aria-label="Eliminar ${escapeHtml(u.email)}">
              ${icon('trash', 'icon-sm')}
            </button>
          </td>
        </tr>`
          )
          .join('');

  return `
    <div class="settings-section admin-users-section">
      <div class="admin-users-header">
        <h3 class="settings-section-title">${icon('shield', 'icon-sm')} Usuarios del sistema</h3>
        <button type="button" class="btn btn-primary btn-small" data-create-user>
          ${icon('plus', 'icon-sm')} Crear usuario
        </button>
      </div>
      ${error ? `<p class="admin-users-error" role="alert">${icon('warning', 'icon-sm')} ${escapeHtml(error)}</p>` : ''}
      ${
        loading
          ? `<p class="admin-users-loading">${icon('clock', 'icon-sm')} Cargando usuarios…</p>`
          : `
        <div class="admin-users-table-wrap glass">
          <table class="admin-users-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Creado</th>
                <th><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`
      }
    </div>
  `;
}

function renderUserModal(mode, user = {}) {
  const isCreate = mode === 'create';
  const title = isCreate ? 'Crear usuario' : 'Editar usuario';
  const submitLabel = isCreate ? 'Crear' : 'Guardar cambios';

  return `
    <div class="admin-user-modal" id="admin-user-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="admin-user-modal-backdrop" data-close-user-modal></div>
      <div class="admin-user-modal-panel glass-strong">
        <header class="admin-user-modal-header">
          <h3>${icon(isCreate ? 'plus' : 'edit', 'icon-sm')} ${title}</h3>
          <button type="button" class="btn btn-icon btn-secondary" data-close-user-modal aria-label="Cerrar">
            ${icon('x')}
          </button>
        </header>
        <form id="admin-user-form" class="settings-form">
          ${
            isCreate
              ? `
            <div class="settings-field">
              <label for="admin-user-email">Correo electrónico</label>
              <input type="email" id="admin-user-email" name="email" class="form-input" required autocomplete="off">
            </div>
            <div class="settings-field">
              <label for="admin-user-password">Contraseña</label>
              <input type="password" id="admin-user-password" name="password" class="form-input" required minlength="8" autocomplete="new-password">
              <p class="settings-field-hint">Mínimo 8 caracteres.</p>
            </div>`
              : `<input type="hidden" name="userId" value="${user.id}">`
          }
          <div class="settings-field">
            <label for="admin-user-name">Nombre</label>
            <input type="text" id="admin-user-name" name="name" class="form-input" value="${escapeHtml(user.name || '')}" required autocomplete="name">
          </div>
          <div class="settings-field">
            <label for="admin-user-role">Rol</label>
            <select id="admin-user-role" name="role" class="form-select">
              <option value="user" ${user.role !== 'admin' ? 'selected' : ''}>Usuario</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </div>
          <footer class="admin-user-modal-footer">
            <button type="button" class="btn btn-secondary" data-close-user-modal>Cancelar</button>
            <button type="submit" class="btn btn-primary">${icon('check', 'icon-sm')} ${submitLabel}</button>
          </footer>
        </form>
      </div>
    </div>
  `;
}

function closeUserModal() {
  document.getElementById('admin-user-modal')?.remove();
}

function openUserModal(mode, user, app) {
  closeUserModal();
  const wrap = document.createElement('div');
  wrap.innerHTML = renderUserModal(mode, user);
  const modal = wrap.firstElementChild;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('admin-user-modal--open'));

  modal.querySelectorAll('[data-close-user-modal]').forEach((el) => {
    el.addEventListener('click', closeUserModal);
  });

  modal.querySelector('#admin-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn?.setAttribute('disabled', '');

    try {
      if (mode === 'create') {
        await adminApi.createUser({
          email: fd.get('email'),
          password: fd.get('password'),
          name: fd.get('name'),
          role: fd.get('role'),
        });
        app.showToast('Usuario creado', 'success');
      } else {
        await adminApi.updateUser(user.id, {
          name: fd.get('name'),
          role: fd.get('role'),
        });
        app.showToast('Usuario actualizado', 'success');
      }
      closeUserModal();
      await refreshAdminUsersPanel(app);
    } catch (err) {
      app.showToast(err.message || 'Error al guardar usuario', 'error');
    } finally {
      submitBtn?.removeAttribute('disabled');
    }
  });

  modal.querySelector('input:not([type="hidden"])')?.focus();
}

export async function refreshAdminUsersPanel(app) {
  const panel = document.getElementById('settings-content');
  if (!panel || !isAdmin(getCurrentUser())) return;

  panel.innerHTML = renderAdminUsersPanel({ loading: true });
  bindAdminUsersEvents(app, panel);

  try {
    const { users } = await adminApi.listUsers();
    panel.innerHTML = renderAdminUsersPanel({ users });
    bindAdminUsersEvents(app, panel);
  } catch (err) {
    panel.innerHTML = renderAdminUsersPanel({ error: err.message || 'No se pudo cargar la lista' });
    bindAdminUsersEvents(app, panel);
  }
}

export function bindAdminUsersEvents(app, root = document) {
  root.querySelector('[data-create-user]')?.addEventListener('click', () => {
    openUserModal('create', {}, app);
  });

  root.querySelectorAll('[data-edit-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.editUser);
      try {
        const { users } = await adminApi.listUsers();
        const user = users.find((u) => u.id === id);
        if (!user) throw new Error('Usuario no encontrado');
        openUserModal('edit', user, app);
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    });
  });

  root.querySelectorAll('[data-delete-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.deleteUser);
      const row = btn.closest('tr');
      const email = row?.querySelector('td')?.textContent?.trim() || 'este usuario';
      if (!confirm(`¿Eliminar la cuenta ${email}?\n\nEsta acción no se puede deshacer.`)) return;

      try {
        await adminApi.deleteUser(id);
        app.showToast('Usuario eliminado', 'success');
        await refreshAdminUsersPanel(app);
      } catch (err) {
        app.showToast(err.message || 'No se pudo eliminar', 'error');
      }
    });
  });
}

export function installAdminUI(AmellifyApp) {
  const proto = AmellifyApp.prototype;

  proto.getSettingsTabs = function (user) {
    const tabs = [
      { id: 'cuenta', label: 'Cuenta', icon: 'user' },
      { id: 'apariencia', label: 'Apariencia', icon: 'palette' },
      { id: 'horario', label: 'Horario', icon: 'calendar' },
      { id: 'notificaciones', label: 'Notificaciones', icon: 'bell' },
      { id: 'calculadora', label: 'Calculadora', icon: 'calculator' },
      { id: 'privacidad', label: 'Privacidad', icon: 'shield' },
      { id: 'datos', label: 'Datos', icon: 'folder' },
    ];
    if (isAdmin(user)) {
      tabs.splice(1, 0, { id: 'usuarios', label: 'Usuarios', icon: 'user' });
    }
    return tabs;
  };

  const _buildSettingsTabContent = proto._buildSettingsTabContent;
  proto._buildSettingsTabContent = function (tab, user) {
    if (tab === 'usuarios') {
      if (!isAdmin(user)) {
        return `<p class="muted">No tienes permisos para ver esta sección.</p>`;
      }
      return renderAdminUsersPanel({ loading: true });
    }
    return _buildSettingsTabContent.call(this, tab, user);
  };

  const _bindSettingsTabEvents = proto._bindSettingsTabEvents;
  proto._bindSettingsTabEvents = function (modal, tab) {
    _bindSettingsTabEvents.call(this, modal, tab);
    if (tab === 'usuarios' && isAdmin(getCurrentUser())) {
      refreshAdminUsersPanel(this);
    }
  };

  const _onAuthenticated = proto.onAuthenticated;
  proto.onAuthenticated = async function (user) {
    await _onAuthenticated.call(this, user);
    if (isAdmin(user)) {
      this.showToast('Sesión de administrador — gestión de usuarios disponible en Configuración', 'info');
    }
  };
}
