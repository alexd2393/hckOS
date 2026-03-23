/**
 * mainMenu.js — Menú Principal y Pantalla de Identidad
 * AleXim Mobile v2.4.1
 *
 * Se muestra ANTES del boot animation.
 * Gestiona tres pantallas:
 *
 *   1. MENÚ PRINCIPAL   — Nueva Partida / Continuar / Ajustes
 *   2. IDENTIDAD        — El jugador escribe su alias (solo nueva partida)
 *   3. → boot normal    — Fluye al sistema existente
 *
 * API:
 *   MainMenu.show()           → Promise — resuelve con { mode, alias }
 *   MainMenu.hasSave()        → boolean
 */

window.MainMenu = (() => {
  'use strict';

  // ─── Helpers ──────────────────────────────────────────────────
  function _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Typewriter effect ────────────────────────────────────────
  async function _typeIn(el, text, speed = 28) {
    el.textContent = '';
    for (const ch of text) {
      el.textContent += ch;
      await _wait(speed + Math.random() * 15);
    }
  }

  // ─── Crear la capa del menú ───────────────────────────────────
  function _createLayer() {
    const el = document.createElement('div');
    el.id = 'main-menu-layer';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9000;
      background:var(--bg-deep);
      display:flex; align-items:center; justify-content:center;
      flex-direction:column;
      font-family:var(--font-mono);
      opacity:0; transition:opacity 0.5s ease;
    `;
    document.body.appendChild(el);
    // Force reflow then fade in
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
    return el;
  }

  async function _fadeOut(el) {
    el.style.opacity = '0';
    await _wait(520);
    el.remove();
  }

  // ═══════════════════════════════════════════════════════════════
  // PANTALLA 1 — MENÚ PRINCIPAL
  // ═══════════════════════════════════════════════════════════════

  function _showMainMenu(layer, hasSave, saveInfo) {
    return new Promise(resolve => {

      const menuItems = [
        { key: '1', label: 'NUEVA PARTIDA', action: 'new',      color: 'var(--accent)' },
        hasSave ? { key: '2', label: 'CONTINUAR',    action: 'load',     color: 'var(--cyan)'   } : null,
        { key: hasSave ? '3' : '2', label: 'AJUSTES',      action: 'settings', color: 'var(--text-muted)' },
      ].filter(Boolean);

      layer.innerHTML = `
        <div style="
          display:flex; flex-direction:column; align-items:center;
          gap:0; width:420px;
        ">
          <!-- Logo -->
          <div style="
            font-size:56px;
            animation: boot-pulse 2s ease-in-out infinite;
            margin-bottom:8px;
          ">📱</div>

          <div style="
            font-family:var(--font-hud); font-size:34px; font-weight:900;
            letter-spacing:8px; color:var(--text-bright);
            text-shadow: 0 0 20px var(--cyan-glow);
            margin-bottom:4px;
          ">AleXim</div>

          <div style="
            font-size:10px; color:var(--text-muted);
            letter-spacing:2px; margin-bottom:48px;
          ">Mobile v2.4.1 — Android 14 · AleX-Kernel</div>

          <!-- Menu items -->
          <div id="menu-items" style="
            display:flex; flex-direction:column; align-items:flex-start;
            gap:4px; width:100%;
          ">
            ${menuItems.map((item, i) => `
              <div
                class="menu-item"
                data-action="${item.action}"
                data-idx="${i}"
                style="
                  display:flex; align-items:center; gap:16px;
                  padding:12px 20px; cursor:pointer;
                  border:1px solid transparent;
                  border-radius:var(--radius-sm);
                  transition:all 0.15s ease;
                  width:100%; box-sizing:border-box;
                "
              >
                <span style="
                  font-family:var(--font-hud); font-size:11px;
                  color:var(--text-dim); min-width:16px;
                ">${item.key}</span>
                <span style="
                  font-size:14px; letter-spacing:3px;
                  color:${item.color};
                ">${item.label}</span>
                ${item.action === 'load' && saveInfo ? `
                  <span style="
                    font-size:10px; color:var(--text-dim);
                    margin-left:auto;
                  ">$${(saveInfo.money ?? 0).toLocaleString('es-AR')} CR · heat ${saveInfo.heat ?? 0}%</span>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <!-- Footer -->
          <div style="margin-top:48px; font-size:10px; color:var(--text-dim); letter-spacing:2px; text-align:center;">
            Argentina Underground Digital<br>
            <span id="menu-sys-status" style="color:var(--text-dim);font-size:9px;">
              inicializando sistemas...
            </span><br>
            <span style="color:var(--bg-elevated);">
              Tocá una opción para comenzar
            </span>
          </div>
        </div>
      `;

      // ─── Hover styles ─────────────────────────────────────────
      let _selectedIdx = 0;

      function _highlight(idx) {
        _selectedIdx = idx;
        layer.querySelectorAll('.menu-item').forEach((el, i) => {
          if (i === idx) {
            el.style.background    = 'rgba(0,212,255,0.05)';
            el.style.borderColor   = 'rgba(0,212,255,0.25)';
          } else {
            el.style.background    = 'transparent';
            el.style.borderColor   = 'transparent';
          }
        });
      }

      _highlight(0);

      layer.querySelectorAll('.menu-item').forEach((el, i) => {
        el.addEventListener('mouseenter', () => _highlight(i));
        el.addEventListener('click', () => {
          // BUG A FIX: remove keydown listener before resolving to avoid ghost keypresses
          document.removeEventListener('keydown', _onKey);
          const action = el.dataset.action;
          resolve(action);
        });
      });

      // ─── Keyboard navigation ──────────────────────────────────
      function _onKey(e) {
        const items = layer.querySelectorAll('.menu-item');
        if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          _highlight((_selectedIdx - 1 + items.length) % items.length);
        } else if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          _highlight((_selectedIdx + 1) % items.length);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.removeEventListener('keydown', _onKey);
          resolve(items[_selectedIdx].dataset.action);
        } else if (e.key === '1') {
          document.removeEventListener('keydown', _onKey);
          resolve('new');
        } else if (e.key === '2') {
          document.removeEventListener('keydown', _onKey);
          resolve(hasSave ? 'load' : 'settings');
        } else if (e.key === '3' && hasSave) {
          document.removeEventListener('keydown', _onKey);
          resolve('settings');
        }
      }
      document.addEventListener('keydown', _onKey);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PANTALLA 2 — IDENTIDAD (solo nueva partida)
  // ═══════════════════════════════════════════════════════════════

  function _showIdentityScreen(layer) {
    return new Promise(async resolve => {

      layer.innerHTML = `
        <div style="
          display:flex; flex-direction:column;
          width:480px; gap:0;
          font-family:var(--font-mono);
        ">
          <div id="id-output" style="
            font-size:12px; color:var(--text-muted);
            line-height:1.8; min-height:120px;
          "></div>

          <div style="
            display:flex; align-items:center; gap:8px;
            margin-top:24px;
            border-bottom:1px solid var(--bg-elevated);
            padding-bottom:12px;
          ">
            <span style="color:var(--accent);">ghost@alexim:~$</span>
            <input
              id="alias-field"
              type="text"
              maxlength="20"
              autocomplete="off"
              spellcheck="false"
              placeholder="tu_alias"
              style="
                background:transparent; border:none; outline:none;
                color:var(--text-bright); font-family:var(--font-mono);
                font-size:14px; letter-spacing:2px;
                caret-color:var(--accent); width:240px;
              "
            />
            <span id="cursor-blink" style="
              color:var(--accent); font-size:14px;
              animation:badge-pulse 1s ease infinite;
            ">_</span>
          </div>

          <div id="alias-hint" style="
            font-size:10px; color:var(--text-dim);
            margin-top:8px; letter-spacing:1px;
            min-height:16px;
          ">
            Entre 3 y 20 caracteres · solo letras, números, _ y -
          </div>
        </div>
      `;

      const outputEl = document.getElementById('id-output');
      const inputEl  = document.getElementById('alias-field');
      const hintEl   = document.getElementById('alias-hint');

      // ─── Secuencia de texto typewriter ───────────────────────
      const lines = [
        { text: 'INICIALIZANDO CANAL SEGURO...', color: 'var(--text-dim)', delay: 0 },
        { text: '', color: '', delay: 400 },
        { text: 'Conexión cifrada establecida.', color: 'var(--text-muted)', delay: 600 },
        { text: 'Servidor de anonimato: ONLINE', color: 'var(--text-muted)', delay: 400 },
        { text: '', color: '', delay: 300 },
        { text: 'Identificate. ¿Cuál es tu alias operativo?', color: 'var(--text-bright)', delay: 500 },
      ];

      for (const line of lines) {
        await _wait(line.delay);
        const div = document.createElement('div');
        div.style.color = line.color || 'transparent';
        if (line.text) div.style.cssText += '; animation: boot-line-in 0.1s ease;';
        outputEl.appendChild(div);
        if (line.text) await _typeIn(div, line.text, 22);
        else div.innerHTML = '&nbsp;';
      }

      await _wait(200);
      inputEl.focus();

      // ─── Validación en tiempo real ────────────────────────────
      const VALID_RE = /^[a-zA-Z0-9_\-]{3,20}$/;

      inputEl.addEventListener('input', () => {
        const val = inputEl.value.trim();
        if (!val) {
          hintEl.textContent = 'Entre 3 y 20 caracteres · solo letras, números, _ y -';
          hintEl.style.color = 'var(--text-dim)';
        } else if (!VALID_RE.test(val)) {
          hintEl.textContent = '✗ Alias inválido — solo letras, números, _ y -';
          hintEl.style.color = 'var(--danger)';
        } else {
          hintEl.textContent = `✓ Alias válido: ${val}`;
          hintEl.style.color = 'var(--accent)';
        }
      });

      // ─── Confirm on Enter ─────────────────────────────────────
      inputEl.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        const val = inputEl.value.trim();
        if (!VALID_RE.test(val)) {
          inputEl.style.borderBottom = '1px solid var(--danger)';
          hintEl.textContent = '✗ Alias inválido — entre 3 y 20 caracteres';
          hintEl.style.color = 'var(--danger)';
          setTimeout(() => { inputEl.style.borderBottom = ''; }, 800);
          return;
        }

        // Confirmar alias
        inputEl.disabled = true;
        const confirm = document.createElement('div');
        confirm.style.cssText = 'color:var(--text-dim); margin-top:8px; font-size:11px;';
        outputEl.appendChild(confirm);
        await _typeIn(confirm, `Confirmado. Iniciando sesión cifrada para ${val}...`, 20);
        await _wait(600);

        resolve(val);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PANTALLA AJUSTES — simple, redirige al desktop con aviso
  // ═══════════════════════════════════════════════════════════════

  function _showSettings(layer) {
    return new Promise(resolve => {
      layer.innerHTML = `
        <div style="
          width:420px; font-family:var(--font-mono); text-align:center;
        ">
          <div style="font-size:28px; color:var(--cyan); margin-bottom:16px;">⚙</div>
          <div style="
            font-family:var(--font-hud); font-size:18px;
            letter-spacing:4px; color:var(--text-bright); margin-bottom:24px;
          ">AJUSTES</div>
          <div style="font-size:12px; color:var(--text-muted); line-height:2; margin-bottom:32px;">
            Los ajustes completos están disponibles<br>
            dentro del OS en la app <span style="color:var(--cyan)">Ajustes</span> de la pantalla de inicio.<br><br>
            <span style="color:var(--text-dim);">Presioná cualquier tecla para volver al menú.</span>
          </div>
        </div>
      `;

      const handler = () => {
        document.removeEventListener('keydown', handler);
        layer.removeEventListener('click', handler);
        resolve();
      };
      document.addEventListener('keydown', handler, { once: true });
      layer.addEventListener('click', handler, { once: true });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════

  const API = {

    hasSave() {
      return !!(window.SaveSystem?.hasSave?.());
    },

    /**
     * Muestra el flujo completo del menú.
     * Resuelve con { mode: 'new'|'load', alias: string|null }
     */
    async show() {
      const hasSave  = this.hasSave();
      const saveInfo = hasSave ? window.SaveSystem?.getInfo?.() : null;

      const layer = _createLayer();
      await _wait(100); // espera el fade-in

      let alias = null;
      let mode  = null;

      // Loop del menú (para poder ir a ajustes y volver)
      while (true) {
        const action = await _showMainMenu(layer, hasSave, saveInfo);

        if (action === 'settings') {
          await _wait(100);
          await _showSettings(layer);
          await _wait(100);
          continue; // volver al menú
        }

        mode = action; // 'new' o 'load'
        break;
      }

      // Si es nueva partida → pantalla de identidad
      if (mode === 'new') {
        await _wait(200);
        alias = await _showIdentityScreen(layer);
      }

      // Fade out y salir
      await _fadeOut(layer);

      return { mode, alias };
    },
  };

  return API;
})();
