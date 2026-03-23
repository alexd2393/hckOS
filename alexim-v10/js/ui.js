/**
 * ui.js — UI Utilities
 * AleXim OS — Hacking Narrative Game
 *
 * Handles:
 *  - HUD updates (money, suspicion, network status)
 *  - Clock
 *  - Notification toasts
 *  - Modal dialogs
 *  - Text-effect helpers (glitch, typewriter)
 */

const UI = (() => {

  let _clockInterval = null;
  let _traceCountdownTimer = null;

  function _pad(n) { return String(n).padStart(2, '0'); }

  // ─── Clock ────────────────────────────────────────────────────

  function _tick() {
    const now  = new Date();
    const time = `${_pad(now.getHours())}:${_pad(now.getMinutes())}:${_pad(now.getSeconds())}`;
    const el   = document.getElementById('top-clock');
    if (el) el.textContent = time;
    const el2  = document.getElementById('taskbar-clock');
    if (el2) el2.textContent = time;
  }

  // ─── HUD ──────────────────────────────────────────────────────

  function _updateHUD() {
    // Money
    const moneyEl = document.getElementById('hud-money');
    if (moneyEl) moneyEl.textContent = GameState.getMoney().toLocaleString('es-AR');

    // Suspicion bar (legacy OS bar)
    const pct    = GameState.getSuspicion();
    const barEl  = document.getElementById('hud-susp-bar');
    const pctEl  = document.getElementById('hud-susp-pct');
    if (barEl) {
      barEl.style.width = pct + '%';
      barEl.classList.remove('warning', 'danger');
      if      (pct >= 70) barEl.classList.add('danger');
      else if (pct >= 40) barEl.classList.add('warning');
    }
    if (pctEl) pctEl.textContent = pct + '%';

    // Network status
    const netDot   = document.querySelector('.net-dot');
    const netLabel = document.getElementById('hud-net-label');
    // Use NetworkSystem if available, fallback to GameState
    const conn     = window.NetworkSystem
      ? NetworkSystem.getCurrentNode()
      : GameState.getConnection();
    if (netDot && netLabel) {
      if (conn) {
        netDot.classList.add('online');
        netLabel.textContent = (conn.hostname ?? '').slice(0, 14);
      } else {
        netDot.classList.remove('online');
        netLabel.textContent = GameState.isVpnActive() ? 'VPN ON' : 'OFFLINE';
      }
    }

    // Heat bar (v4 — ReputationSystem)
    if (window.ReputationSystem && window.PursuitSystem) {
      const heat      = ReputationSystem.getHeat();
      const heatLevel = PursuitSystem.getLevel(heat);
      const heatFillEl = document.getElementById('hud-heat-fill');
      const heatPctEl  = document.getElementById('hud-heat-pct');
      if (heatFillEl) {
        heatFillEl.style.width = heat + '%';
        heatFillEl.className   = 'heat-fill ' + (heatLevel?.name ?? 'INACTIVO').toLowerCase().replace('ó','o').replace('ó','o').replace('ó','o');
        // Normalize accent chars for CSS class
        const lvlClass = {
          'INACTIVO':'bajo','VIGILANCIA':'bajo','INVESTIGACIÓN':'moderado',
          'RASTREO':'alto','REDADA':'critico'
        }[heatLevel?.name] ?? 'bajo';
        heatFillEl.className = 'heat-fill ' + lvlClass;
      }
      if (heatPctEl) {
        heatPctEl.textContent = heatLevel?.icon + ' ' + (heatLevel?.name ?? '') + ' ' + heat + '%';
        heatPctEl.style.color = heatLevel?.color ?? 'var(--accent)';
      }
    }

    // Inventory count (v3)
    const invEl = document.getElementById('hud-inv-count');
    if (invEl && window.InventorySystem) {
      const n = InventorySystem.count();
      invEl.textContent = n;
      invEl.style.color = n > 0 ? 'var(--warn)' : 'var(--text-dim)';
    }
  }

  // ─── Notifications ────────────────────────────────────────────

  /**
   * Display a toast notification.
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} type
   * @param {number} duration  - ms before auto-dismiss (0 = sticky)
   */
  function notify(message, type = 'info', duration = 4000) {
    AudioSystem.notification();

    const area = document.getElementById('notification-area');
    if (!area) return;

    const icons = { info: 'ℹ', success: '✓', warning: '⚠', error: '✗' };

    const el = document.createElement('div');
    el.className = `notification notification-${type}`;
    el.innerHTML = `
      <span class="notif-icon">${icons[type] ?? 'ℹ'}</span>
      <span class="notif-msg">${_escapeHtml(message)}</span>
      <button class="notif-close" title="Dismiss">×</button>
    `;

    el.querySelector('.notif-close').addEventListener('click', () => _dismissNotif(el));
    area.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));

    if (duration > 0) {
      setTimeout(() => _dismissNotif(el), duration);
    }

    return el;
  }

  function _dismissNotif(el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }

  // ─── Dialog ───────────────────────────────────────────────────

  /**
   * Show a modal dialog.
   * @param {string} title
   * @param {string} message
   * @param {Array<{text:string, style?:string, action?:Function}>} buttons
   * @returns {HTMLElement} overlay element
   */
  function dialog(title, message, buttons = [{ text: 'OK' }]) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box anim-slide-up">
        <div class="dialog-title">${_escapeHtml(title)}</div>
        <div class="dialog-message">${message}</div>
        <div class="dialog-buttons">
          ${buttons.map((b, i) =>
            `<button class="dialog-btn ${b.style ?? ''}" data-i="${i}">${_escapeHtml(b.text)}</button>`
          ).join('')}
        </div>
      </div>
    `;

    overlay.querySelectorAll('.dialog-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.i);
        if (buttons[idx]?.action) buttons[idx].action();
        overlay.remove();
      });
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  // ─── Text effects ─────────────────────────────────────────────

  const _GLITCH_CHARS = '!@#$%^&*()_+=[]{}|;,<>?/\\ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  /**
   * Animate an element's text with a glitch-reveal effect.
   * @param {HTMLElement} el
   * @param {string}      finalText
   * @param {number}      duration   - ms
   * @param {Function}    [callback]
   */
  function glitchText(el, finalText, duration = 700, callback = null) {
    let start = null;
    const len = finalText.length;

    function frame(ts) {
      if (!start) start = ts;
      const t       = Math.min((ts - start) / duration, 1);
      const revealed = Math.floor(t * len);
      let result    = '';
      for (let i = 0; i < len; i++) {
        result += (i < revealed)
          ? finalText[i]
          : _GLITCH_CHARS[Math.floor(Math.random() * _GLITCH_CHARS.length)];
      }
      el.textContent = result;
      if (t < 1) requestAnimationFrame(frame);
      else {
        el.textContent = finalText;
        if (callback) callback();
      }
    }
    requestAnimationFrame(frame);
  }

  /**
   * Typewriter effect — appends chars one by one.
   * @param {HTMLElement} el
   * @param {string}      text
   * @param {number}      speed    - ms per character
   * @param {Function}    [callback]
   * @returns {number} interval id (can be cleared to stop early)
   */
  function typeText(el, text, speed = 30, callback = null) {
    let i = 0;
    el.textContent = '';
    const iv = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) {
        clearInterval(iv);
        if (callback) callback();
      }
    }, speed);
    return iv;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  function _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Public API ───────────────────────────────────────────────
  return {

    /** Call once after the desktop is visible. */
    init() {
      _tick();
      _clockInterval = setInterval(_tick, 1000);

      // React to GameState changes
      GameState.on('money',     _updateHUD);
      GameState.on('suspicion', _updateHUD);
      GameState.on('network',   _updateHUD);
      GameState.on('vpn',       _updateHUD);

      // React to InventorySystem changes (v3)
      if (window.InventorySystem) {
        InventorySystem.on('added',  _updateHUD);
        InventorySystem.on('sold',   _updateHUD);
        InventorySystem.on('removed',_updateHUD);
      } else {
        window.addEventListener('alexim-ready', () => {
          if (window.InventorySystem) {
            InventorySystem.on('added',  _updateHUD);
            InventorySystem.on('sold',   _updateHUD);
            InventorySystem.on('removed',_updateHUD);
          }
        });
      }

      // React to ReputationSystem heat changes
      if (window.ReputationSystem) {
        ReputationSystem.on('heat', () => _updateHUD());
      }

      // Wire PursuitSystem trace bar (v4)
      window.addEventListener('alexim-ready', () => {
        if (!window.PursuitSystem) return;

        PursuitSystem.on('trace_started', () => {
          const bar = document.getElementById('pursuit-trace-bar');
          if (bar) bar.classList.replace('hidden', 'visible');
          // Live countdown
          _traceCountdownTimer = setInterval(() => {
            const sec = PursuitSystem.getTraceSeconds();
            const el  = document.getElementById('trace-countdown');
            if (el) el.textContent = sec + 's';
            if (sec <= 0) clearInterval(_traceCountdownTimer);
          }, 1000);
        });

        PursuitSystem.on('trace_cancelled', () => {
          const bar = document.getElementById('pursuit-trace-bar');
          if (bar) bar.classList.replace('visible', 'hidden');
          clearInterval(_traceCountdownTimer);
        });

        PursuitSystem.on('busted', () => {
          const bar = document.getElementById('pursuit-trace-bar');
          if (bar) bar.classList.replace('visible', 'hidden');
          clearInterval(_traceCountdownTimer);
          _updateHUD();
        });

        PursuitSystem.on('level_change', () => _updateHUD());
      });

      _updateHUD();
    },

    updateHUD: _updateHUD,

    notify,
    dialog,
    glitchText,
    typeText,

    escapeHtml: _escapeHtml,
  };

})();
