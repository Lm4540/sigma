/* SIGMA — UI utilities */
'use strict';

window.sigma = (() => {
  // Toast notifications
  const toast = (message, type = 'default', duration = 3500) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast${type === 'error' ? ' error' : type === 'success' ? ' success' : ''}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => el.remove(), 200);
    }, duration);
  };

  // Cerrar modales al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // Cerrar modales con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Sidebar toggle (mobile)
  const sidebarToggle  = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebar        = document.querySelector('.sidebar');
  const openSidebar  = () => { sidebar?.classList.add('open'); sidebarOverlay?.classList.add('open'); };
  const closeSidebar = () => { sidebar?.classList.remove('open'); sidebarOverlay?.classList.remove('open'); };
  sidebarToggle?.addEventListener('click', () => sidebar?.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay?.addEventListener('click', closeSidebar);
  // Cerrar sidebar al navegar (mobile SPA-like)
  document.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', closeSidebar));

  /**
   * Reemplaza confirm() nativo con un modal accesible.
   * @param {string} message  — pregunta principal
   * @param {object} opts
   *   title        {string}  — encabezado del modal (opcional)
   *   confirmText  {string}  — texto del botón de aceptar (default: 'Confirmar')
   *   cancelText   {string}  — texto del botón de cancelar (default: 'Cancelar')
   *   danger       {boolean} — botón de confirmar en rojo (default: false)
   * @returns {Promise<boolean>}
   */
  const confirm = (message, opts = {}) => new Promise((resolve) => {
    const {
      title       = '',
      confirmText = 'Confirmar',
      cancelText  = 'Cancelar',
      danger      = false,
    } = opts;

    const overlay = document.createElement('div');
    overlay.className = `modal-overlay confirm-dialog${danger ? ' danger' : ''} open`;
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="confirm-icon">${danger ? '⚠️' : '❓'}</div>
        ${title ? `<div class="confirm-title">${title}</div>` : ''}
        <p class="confirm-message">${message}</p>
        <div class="modal-footer">
          <button class="btn btn-ghost confirm-cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} confirm-ok">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('.confirm-ok').addEventListener('click',     () => close(true));
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter')  { e.preventDefault(); close(true); }
    });
    // Foco inicial en el botón de confirmar para accesibilidad
    requestAnimationFrame(() => overlay.querySelector('.confirm-ok')?.focus());
  });

  // Confirmar antes de navegar a logout
  document.querySelectorAll('a[href="/logout"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const ok = await confirm('¿Cerrar sesión?', { confirmText: 'Cerrar sesión', cancelText: 'Cancelar' });
      if (ok) window.location.href = el.href;
    });
  });

  // Registro Service Worker + Push subscription
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');

        // Solicitar permiso y registrar suscripción push si hay VAPID key
        const { publicKey } = await fetch('/api/push-vapid-key').then(r => r.json()).catch(() => ({}));
        if (publicKey && Notification.permission !== 'denied') {
          const permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
          if (permission === 'granted') {
            const existing = await reg.pushManager.getSubscription();
            const sub = existing || await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: _urlBase64ToUint8Array(publicKey),
            });
            fetch('/api/push-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sub.toJSON()),
            }).catch(() => {});
          }
        }
      } catch (_) {}
    });
  }

  function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  // Socket.io — recibir gestiones en tiempo real (solo si está disponible)
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('collection:new', (data) => {
      toast(`Nueva gestión registrada (cliente #${data.clientId})`, 'default');
    });
  }

  return { toast, confirm };
})();
