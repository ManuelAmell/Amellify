/** Pantallas de autenticación (login, registro, recuperación) */
import { api, setAuthToken, getAuthToken, getRememberPreference, checkServerHealth } from './api.js';
import { icon, getClientOrigin, scorePasswordStrength } from './utils.js';

const VIEWS = ['login', 'register', 'forgot', 'reset'];
const TAB_VIEWS = ['login', 'register'];
const DEV_ADMIN_EMAIL = 'admin@amellify.local';

function isLocalDevHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export class AuthUI {
  constructor({ onAuthenticated, onToast }) {
    this.onAuthenticated = onAuthenticated;
    this.onToast = onToast || (() => {});
    this.view = 'login';
    this.loading = false;
    this.overlay = null;
    this.resetToken = '';
    this.devResetLink = '';
    this.remember = getRememberPreference();
    this.serverOnline = null;
    this.fieldError = '';
  }

  async checkServer() {
    this.serverOnline = await checkServerHealth();
    this.renderServerStatus();
    return this.serverOnline;
  }

  async bootstrap() {
    await this.checkServer();

    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace('#', '');
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl || hash === 'reset-password') {
      this.view = 'reset';
      this.resetToken = tokenFromUrl || '';
      this.show();
      return false;
    }

    const token = getAuthToken();
    if (!token) {
      this.view = 'login';
      this.show();
      return false;
    }

    try {
      const { user } = await api.me();
      setAuthToken(token, user, { remember: getRememberPreference() });
      this.serverOnline = true;
      return true;
    } catch {
      setAuthToken(null);
      this.view = 'login';
      this.show();
      if (!this.serverOnline) {
        this.onToast(
          'No se pudo conectar al servidor. Comprueba que Amellify esté en ejecución.',
          'error'
        );
      }
      return false;
    }
  }

  show() {
    document.getElementById('app-shell')?.setAttribute('hidden', '');
    let el = document.getElementById('auth-screen');
    if (!el) {
      el = document.createElement('div');
      el.id = 'auth-screen';
      document.body.appendChild(el);
    }
    this.overlay = el;
    el.className = 'auth-screen auth-screen--visible';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Autenticación');
    el.innerHTML = this.render();
    this.bindEvents();
    el.removeAttribute('hidden');
    this.checkServer();
  }

  hide() {
    const el = document.getElementById('auth-screen');
    el?.setAttribute('hidden', '');
    el?.classList.remove('auth-screen--visible');
    document.getElementById('app-shell')?.removeAttribute('hidden');
    if (window.location.search.includes('token=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.hash = '';
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }

  setView(view) {
    if (!VIEWS.includes(view)) return;
    this.view = view;
    this.devResetLink = '';
    this.fieldError = '';
    if (this.overlay) {
      this.overlay.innerHTML = this.render();
      this.bindEvents();
      this.overlay.querySelector('.auth-body')?.classList.add('auth-body--enter');
    }
  }

  renderServerStatus() {
    const el = this.overlay?.querySelector('[data-server-status]');
    if (!el) return;
    if (this.serverOnline === null) {
      el.className = 'auth-server-status is-checking';
      el.innerHTML = `${icon('clock', 'icon-sm')} Comprobando servidor…`;
    } else if (this.serverOnline) {
      el.className = 'auth-server-status is-online';
      el.innerHTML = `${icon('check', 'icon-sm')} Servidor disponible`;
    } else {
      el.className = 'auth-server-status is-offline';
      el.innerHTML = `${icon('warning', 'icon-sm')} Servidor no disponible — inicia Amellify en el puerto 3000`;
    }
  }

  render() {
    const titles = {
      login: 'Accede a tu cuenta',
      register: 'Crea tu cuenta gratuita',
      forgot: 'Recuperar contraseña',
      reset: 'Elige una contraseña nueva',
    };

    const showTabs = TAB_VIEWS.includes(this.view);

    return `
      <div class="auth-panel glass-strong auth-panel--pro">
        <div class="auth-brand">
          <div class="auth-brand-icon">${icon('book', 'icon-lg')}</div>
          <h1 class="auth-title">Amellify</h1>
          <p class="auth-subtitle">${titles[this.view]}</p>
        </div>
        <div class="auth-server-status" data-server-status role="status" aria-live="polite"></div>
        ${showTabs ? this.renderTabs() : ''}
        <div class="auth-body auth-body--enter">
          ${this.fieldError ? `<p class="auth-inline-error" role="alert">${icon('warning', 'icon-sm')} ${this.fieldError}</p>` : ''}
          ${this.renderForm()}
        </div>
        ${this.view === 'login' && isLocalDevHost() ? this.renderDevHint() : ''}
      </div>
    `;
  }

  renderTabs() {
    return `
      <nav class="auth-tabs" role="tablist" aria-label="Tipo de acceso">
        <button type="button" role="tab" class="auth-tab ${this.view === 'login' ? 'active' : ''}" data-view="login" aria-selected="${this.view === 'login'}">
          ${icon('user', 'icon-sm')} Iniciar sesión
        </button>
        <button type="button" role="tab" class="auth-tab ${this.view === 'register' ? 'active' : ''}" data-view="register" aria-selected="${this.view === 'register'}">
          ${icon('plus', 'icon-sm')} Crear cuenta
        </button>
      </nav>
    `;
  }

  renderForm() {
    const forms = {
      login: this.renderLoginForm(),
      register: this.renderRegisterForm(),
      forgot: this.renderForgotForm(),
      reset: this.renderResetForm(),
    };
    return forms[this.view];
  }

  renderPasswordField(name, options = {}) {
    const {
      label = 'Contraseña',
      placeholder = 'Mínimo 8 caracteres',
      autocomplete = 'current-password',
      showStrength = false,
      required = true,
      minlength = 8,
    } = options;
    const minLengthAttr =
      typeof minlength === 'number' && minlength > 0 ? `minlength="${minlength}"` : '';

    return `
      <div class="auth-field">
        <label class="auth-label" for="auth-${name}">${icon('lock', 'icon-sm')} ${label}</label>
        <div class="auth-password-wrap">
          <input
            type="password"
            id="auth-${name}"
            name="${name}"
            class="form-input auth-input"
            ${required ? 'required' : ''}
            autocomplete="${autocomplete}"
            placeholder="${placeholder}"
            ${minLengthAttr}
            data-password-field
          >
          <button type="button" class="auth-password-toggle" data-toggle-password aria-label="Mostrar contraseña">
            ${icon('eye', 'icon-sm')}
          </button>
        </div>
        ${showStrength ? this.renderStrengthMeter(name) : ''}
      </div>
    `;
  }

  renderStrengthMeter(fieldName) {
    return `
      <div class="auth-strength" data-strength-for="${fieldName}" aria-live="polite">
        <div class="auth-strength-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span class="auth-strength-fill"></span>
        </div>
        <span class="auth-strength-label"></span>
      </div>
    `;
  }

  renderDevHint() {
    return `
      <aside class="auth-dev-hint glass" aria-label="Ayuda de desarrollo">
        <p class="auth-dev-hint-title">${icon('shield', 'icon-sm')} Desarrollo</p>
        <p class="auth-dev-hint-text">Admin: <strong>${DEV_ADMIN_EMAIL}</strong></p>
        <a class="auth-dev-hint-link" href="README.md" target="_blank" rel="noopener">
          ${icon('file-text', 'icon-sm')} Credenciales en la documentación
        </a>
      </aside>
    `;
  }

  renderLoginForm() {
    return `
      <form id="auth-form" class="auth-form" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="auth-email">${icon('mail', 'icon-sm')} Correo electrónico</label>
          <input type="email" id="auth-email" name="email" class="form-input auth-input" required autocomplete="email" placeholder="${isLocalDevHost() ? DEV_ADMIN_EMAIL : 'tu@correo.com'}" inputmode="email">
        </div>
        ${this.renderPasswordField('password', {
          autocomplete: 'current-password',
          placeholder: 'Tu contraseña',
          minlength: 0,
        })}
        <label class="auth-remember">
          <input type="checkbox" name="remember" ${this.remember ? 'checked' : ''}>
          Mantener sesión iniciada
        </label>
        <p class="auth-field-hint">La sesión dura 7 días. Sin marcar, se cierra al cerrar el navegador.</p>
        <button type="submit" class="btn btn-primary auth-submit" ${this.loading || this.serverOnline === false ? 'disabled' : ''}>
          ${icon('user', 'icon-sm')} Entrar
        </button>
        <div class="auth-links">
          <button type="button" class="auth-link" data-view="forgot">¿Olvidaste tu contraseña?</button>
        </div>
      </form>
    `;
  }

  renderRegisterForm() {
    return `
      <form id="auth-form" class="auth-form" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="auth-name">${icon('user', 'icon-sm')} Nombre</label>
          <input type="text" id="auth-name" name="name" class="form-input auth-input" autocomplete="name" placeholder="Tu nombre">
        </div>
        <div class="auth-field">
          <label class="auth-label" for="auth-reg-email">${icon('mail', 'icon-sm')} Correo electrónico</label>
          <input type="email" id="auth-reg-email" name="email" class="form-input auth-input" required autocomplete="email" placeholder="tu@correo.com" inputmode="email">
        </div>
        ${this.renderPasswordField('password', {
          autocomplete: 'new-password',
          showStrength: true,
        })}
        <button type="submit" class="btn btn-primary auth-submit" ${this.loading || this.serverOnline === false ? 'disabled' : ''}>
          ${icon('check', 'icon-sm')} Registrarme
        </button>
      </form>
    `;
  }

  renderForgotForm() {
    const devBlock = this.devResetLink
      ? `
        <div class="auth-dev-link glass">
          <p class="auth-dev-link-title">${icon('mail', 'icon-sm')} Enlace de desarrollo</p>
          <p class="auth-hint">En localhost no se envía correo. Usa este enlace para restablecer:</p>
          <a class="auth-dev-link-url" href="${this.devResetLink}">${this.devResetLink}</a>
          <button type="button" class="btn btn-secondary auth-dev-copy" data-copy-reset>${icon('copy', 'icon-sm')} Copiar enlace</button>
        </div>
      `
      : '';

    return `
      <form id="auth-form" class="auth-form" novalidate>
        <p class="auth-hint">Introduce tu correo. Si está registrado, recibirás instrucciones para restablecer tu contraseña.</p>
        <div class="auth-field">
          <label class="auth-label" for="auth-forgot-email">${icon('mail', 'icon-sm')} Correo electrónico</label>
          <input type="email" id="auth-forgot-email" name="email" class="form-input auth-input" required autocomplete="email" placeholder="tu@correo.com" inputmode="email">
        </div>
        <button type="submit" class="btn btn-primary auth-submit" ${this.loading || this.serverOnline === false ? 'disabled' : ''}>
          ${icon('mail', 'icon-sm')} Enviar enlace
        </button>
        ${devBlock}
        <div class="auth-links">
          <button type="button" class="auth-link" data-view="login">Volver al inicio de sesión</button>
        </div>
      </form>
    `;
  }

  renderResetForm() {
    return `
      <form id="auth-form" class="auth-form" novalidate>
        <p class="auth-hint">El enlace expira en 1 hora. Elige una contraseña de al menos 8 caracteres.</p>
        <input type="hidden" name="token" value="${this.resetToken || ''}">
        ${this.renderPasswordField('password', {
          label: 'Nueva contraseña',
          autocomplete: 'new-password',
          showStrength: true,
        })}
        ${this.renderPasswordField('password2', {
          label: 'Confirmar contraseña',
          autocomplete: 'new-password',
          showStrength: false,
        })}
        <button type="submit" class="btn btn-primary auth-submit" ${this.loading || this.serverOnline === false ? 'disabled' : ''}>
          ${icon('check', 'icon-sm')} Guardar contraseña
        </button>
        <div class="auth-links">
          <button type="button" class="auth-link" data-view="login">Ir al inicio de sesión</button>
        </div>
      </form>
    `;
  }

  bindEvents() {
    const form = this.overlay?.querySelector('#auth-form');
    form?.addEventListener('submit', (e) => this.handleSubmit(e));

    this.overlay?.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => this.setView(btn.dataset.view));
    });

    this.overlay?.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => this.togglePasswordVisibility(btn));
    });

    this.overlay?.querySelectorAll('[data-password-field]').forEach((input) => {
      input.addEventListener('input', () => this.updateStrengthMeter(input));
    });

    this.overlay?.querySelector('[data-copy-reset]')?.addEventListener('click', () => {
      if (!this.devResetLink) return;
      navigator.clipboard?.writeText(this.devResetLink).then(
        () => this.onToast('Enlace copiado al portapapeles', 'success'),
        () => this.onToast(this.devResetLink, 'info')
      );
    });

    this.renderServerStatus();
    form?.querySelector('input:not([type="hidden"])')?.focus();
  }

  togglePasswordVisibility(btn) {
    const wrap = btn.closest('.auth-password-wrap');
    const input = wrap?.querySelector('input');
    if (!input) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    btn.innerHTML = icon(visible ? 'eye' : 'eye-off', 'icon-sm');
    btn.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  }

  updateStrengthMeter(input) {
    const meter = this.overlay?.querySelector(`[data-strength-for="${input.name}"]`);
    if (!meter) return;
    const { label, level, percent } = scorePasswordStrength(input.value);
    const fill = meter.querySelector('.auth-strength-fill');
    const labelEl = meter.querySelector('.auth-strength-label');
    const bar = meter.querySelector('.auth-strength-bar');
    if (fill) {
      fill.style.width = `${percent}%`;
      fill.dataset.level = level;
    }
    if (labelEl) labelEl.textContent = input.value ? label : '';
    if (bar) bar.setAttribute('aria-valuenow', String(percent));
  }

  validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  showFieldError(msg) {
    this.fieldError = msg;
    const existing = this.overlay?.querySelector('.auth-inline-error');
    if (existing) {
      existing.innerHTML = `${icon('warning', 'icon-sm')} ${msg}`;
    } else {
      const body = this.overlay?.querySelector('.auth-body');
      if (body) {
        const p = document.createElement('p');
        p.className = 'auth-inline-error';
        p.setAttribute('role', 'alert');
        p.innerHTML = `${icon('warning', 'icon-sm')} ${msg}`;
        body.prepend(p);
      }
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.loading) return;

    if (this.serverOnline === false) {
      await this.checkServer();
      if (!this.serverOnline) {
        this.showFieldError('El servidor no está disponible. Inicia Amellify e inténtalo de nuevo.');
        return;
      }
    }

    const fd = new FormData(e.target);

    this.loading = true;
    this.fieldError = '';
    this.overlay.querySelector('.auth-submit')?.setAttribute('disabled', '');

    try {
      if (this.view === 'login') {
        const email = String(fd.get('email') || '').trim();
        const password = String(fd.get('password') || '');
        if (!this.validateEmail(email)) throw new Error('Introduce un correo electrónico válido');
        if (!password) throw new Error('Introduce tu contraseña');

        const remember = fd.get('remember') === 'on';
        this.remember = remember;
        const { token, user } = await api.login({ email, password });
        setAuthToken(token, user, { remember });
        this.hide();
        await this.onAuthenticated?.(user);
      } else if (this.view === 'register') {
        const email = String(fd.get('email') || '').trim();
        const password = String(fd.get('password') || '');
        if (!this.validateEmail(email)) throw new Error('Introduce un correo electrónico válido');
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');

        const { token, user } = await api.register({
          name: fd.get('name'),
          email,
          password,
        });
        setAuthToken(token, user, { remember: true });
        this.hide();
        await this.onAuthenticated?.(user);
      } else if (this.view === 'forgot') {
        const email = String(fd.get('email') || '').trim();
        if (!this.validateEmail(email)) throw new Error('Introduce un correo electrónico válido');

        const result = await api.forgotPassword(email);
        this.onToast(result.message, 'success');
        if (result.devResetToken) {
          const origin = getClientOrigin();
          this.devResetLink = `${origin}/?token=${result.devResetToken}#reset-password`;
          this.overlay.innerHTML = this.render();
          this.bindEvents();
          this.onToast('Enlace de desarrollo disponible abajo', 'info');
        } else {
          this.setView('login');
        }
      } else if (this.view === 'reset') {
        const pw = String(fd.get('password') || '');
        const pw2 = String(fd.get('password2') || '');
        if (pw.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
        if (pw !== pw2) throw new Error('Las contraseñas no coinciden');
        const token = fd.get('token') || this.resetToken;
        if (!token) throw new Error('Enlace de recuperación inválido');

        await api.resetPassword(token, pw);
        this.onToast('Contraseña actualizada. Inicia sesión.', 'success');
        this.resetToken = '';
        this.setView('login');
      }
    } catch (err) {
      this.showFieldError(err.message || 'Error de autenticación');
      this.onToast(err.message || 'Error de autenticación', 'error');
    } finally {
      this.loading = false;
      this.overlay?.querySelector('.auth-submit')?.removeAttribute('disabled');
    }
  }

  async logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    this.view = 'login';
    this.remember = getRememberPreference();
    this.show();
  }
}

export async function logoutUser(authUI) {
  if (authUI) await authUI.logout();
}
