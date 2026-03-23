/**
 * tutorialSystem.js — Tutorial Guiado Paso a Paso
 * AleXim Mobile v2.4.1
 *
 * Tutorial interactivo que aparece solo la primera vez.
 * Cada paso espera que el jugador ejecute el comando correcto
 * antes de avanzar. No hay botón "next" — el progreso es orgánico.
 *
 * Pasos:
 *   1. scan            — descubrir la red
 *   2. connect         — conectarse al router
 *   3. recon           — reconocer el objetivo
 *   4. bypass          — primera capa de seguridad
 *   5. ls + download   — robar datos
 *   (bonus) sell       — vender en el mercado negro
 *
 * API:
 *   TutorialSystem.start(terminal) — inicia si no fue completado
 *   TutorialSystem.isDone()        — true si tutorial_done está en GameState
 *   TutorialSystem.skip()          — saltear con comando 'skip tutorial'
 */

window.TutorialSystem = (() => {
  'use strict';

  // ─── Estado ──────────────────────────────────────────────────
  let _active       = false;
  let _step         = 0;
  let _multiSubStep = 0;   // BUG C FIX: track ls/download substep in closure, not on STEPS
  let _term         = null;
  let _origExec     = null;   // referencia al _execute original del terminal
  let _listeners    = {};

  // ─── Helper: qué herramienta de FIREWALL tiene el jugador ─────
  // FIX 2: en vez de hardcodear firewall_bypass, detectar dinámicamente
  function _getBestFirewallTool() {
    const priority = ['phantom', 'brutex', 'vpn', 'shieldwall'];
    for (const id of priority) {
      if (typeof GameState !== 'undefined' && GameState.hasSoftware(id)) return id;
      if (window.LocalSystem?.isActive?.(id)) return id;
    }
    return 'phantom'; // fallback
  }

  // ─── Pasos del tutorial ───────────────────────────────────────
  const STEPS = [
    {
      id: 'scan',
      title: 'PASO 1 / 6 — RECONOCIMIENTO DE RED',
      intro: [
        `Estás dentro del sistema. Nadie sabe que sos vos.`,
        `Tu primer movimiento: descubrir qué hay en la red local.`,
      ],
      prompt: `Escaneá la red:  <span style="color:var(--cyan)">scan</span>`,
      hint: 'scan',
      validate: (cmd) => cmd.trim().toLowerCase() === 'scan',
      success: `Red escaneada. Encontraste el router de la red local.`,
    },
    {
      id: 'connect',
      title: 'PASO 2 / 6 — PRIMERA CONEXIÓN',
      intro: [
        `El router es el primer escalón. Tenés que conectarte a él.`,
      ],
      prompt: `Conectate al router:  <span style="color:var(--cyan)">connect 192.168.1.1</span>`,
      hint: 'connect 192.168.1.1',
      // FIX 3: validate correct IP, not just any connect command
      validate: (cmd) => {
        const parts = cmd.trim().toLowerCase().split(/\s+/);
        return parts[0] === 'connect' && (!parts[1] || parts[1] === '192.168.1.1');
      },
      success: `Conexión establecida. Ves las capas de seguridad del router.`,
    },
    {
      id: 'recon',
      title: 'PASO 3 / 6 — RECONOCIMIENTO DEL OBJETIVO',
      intro: [
        `Antes de atacar, reconocés el sistema.`,
        `<span style="color:var(--text-dim)">recon</span> te muestra puertos, OS y capas de seguridad.`,
      ],
      prompt: `Analizá el router:  <span style="color:var(--cyan)">recon 192.168.1.1</span>`,
      hint: 'recon',
      validate: (cmd) => cmd.trim().toLowerCase().startsWith('recon'),
      success: `Análisis completo. El router tiene un FIREWALL como primera capa.`,
    },
    {
      id: 'bypass',
      title: 'PASO 4 / 6 — BYPASS DE SEGURIDAD',
      // FIX: intro y prompt se calculan dinámicamente según herramientas disponibles
      get intro() {
        const tool = _getBestFirewallTool();
        // Get display name if available
        const cat = window.LocalSystem?.getCatalog?.();
        const toolName = cat && cat[tool] ? cat[tool].name : tool;
        return [
          `Acá empieza el trabajo real.`,
          `Tu herramienta: <span style="color:var(--accent)">${toolName}</span>  <span style="color:var(--text-dim)">(id: <span style="color:var(--cyan)">${tool}</span>)</span>`,
          `El id es exactamente lo que escribís en la terminal.`,
          `<span style="color:var(--text-dim)">Si falla, intentalo de nuevo — las probabilidades son buenas.</span>`,
        ];
      },
      get prompt() {
        const tool = _getBestFirewallTool();
        return `Bypasseá el FIREWALL:  <span style="color:var(--cyan)">bypass FIREWALL ${tool}</span>`;
      },
      get hint() { return `bypass FIREWALL ${_getBestFirewallTool()}`; },
      validate: (cmd) => cmd.trim().toLowerCase().startsWith('bypass'),
      success: `¡Acceso obtenido! Estás dentro del router.`,
      waitForBreach: true,
    },
    {
      id: 'ls_download',
      title: 'PASO 5 / 6 — EXTRACCIÓN DE DATOS',
      intro: [
        `Estás dentro. Ahora explorás los archivos disponibles.`,
        `<span style="color:var(--warn)">Todo lo que descargues queda en tu inventario — no te pagan hasta que vendas.</span>`,
      ],
      prompt: `Listá los archivos:  <span style="color:var(--cyan)">ls</span>  — después:  <span style="color:var(--cyan)">download [nombre_archivo]</span>`,
      hint: 'ls',
      validate: (cmd) => cmd.trim().toLowerCase() === 'ls' || cmd.trim().toLowerCase().startsWith('download'),
      successCmds: {
        'ls': null,   // ls avanza la instrucción pero no el paso
        'download': `Datos robados. Guardados en tu inventario. Ahora los podés vender.`,
      },
      // Paso especial: ls primero, luego download
      multiStage: true,
      subStep: 0,   // 0 = esperando ls, 1 = esperando download
    },
    {
      id: 'sell',
      title: 'PASO 6 / 6 — MERCADO NEGRO',
      intro: [
        `Los datos valen nada hasta que encontrás un comprador.`,
        `Listás el archivo en el DarkMarket y esperás ofertas.`,
        `<span style="color:var(--text-dim)">Cuando llegue una oferta, la aceptás con: accept [offer-id]</span>`,
      ],
      prompt: `Listá para venta:  <span style="color:var(--cyan)">sell [nombre_archivo]</span>  — después esperá ofertas con  <span style="color:var(--cyan)">offers</span>`,
      hint: 'sell',
      // FIX 6: verify a listing was actually created (not just that 'sell' was typed)
      validate: (cmd) => {
        if (!cmd.trim().toLowerCase().startsWith('sell')) return false;
        const listings = window.DarkMarketSystem?.getListings?.() ?? [];
        return listings.length > 0;
      },
      success: `Perfecto. Ahora esperás que lleguen compradores. El dinero llega cuando aceptás la oferta.`,
    },
  ];

  // ─── Helpers de print ─────────────────────────────────────────
  function _sep() {
    _term.printHTML(`<span style="color:var(--bg-elevated)">${'─'.repeat(52)}</span>`);
  }

  function _box(title) {
    _term.printBlank();
    _term.printHTML(
      `<span style="color:var(--warn);font-family:var(--font-hud);letter-spacing:2px;font-size:11px;">${title}</span>`
    );
    _sep();
  }

  function _intro(lines) {
    lines.forEach(l => {
      _term.printHTML(`  <span style="color:var(--text-normal)">${l}</span>`);
    });
  }

  function _showPrompt(text) {
    _term.printBlank();
    _term.printHTML(`  <span style="color:var(--text-dim)">→ </span>${text}`);
    _term.printBlank();
  }

  function _success(msg) {
    _term.printBlank();
    _term.printHTML(
      `<span style="color:var(--accent)">✓ ${msg}</span>`
    );
    _term.printBlank();
  }

  function _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ─── Mostrar un paso ──────────────────────────────────────────
  async function _showStep(stepIdx) {
    const step = STEPS[stepIdx];
    if (!step) return;

    await _wait(400);
    _box(step.title);
    _intro(step.intro);

    // FIX 9: for bypass step, show installed FIREWALL tools
    if (step.id === 'bypass') {
      const firewallTools = ['phantom','brutex','vpn','shieldwall'];
      const available = firewallTools.filter(id =>
        (typeof GameState !== 'undefined' && GameState.hasSoftware(id)) ||
        window.LocalSystem?.isActive?.(id)
      );
      if (available.length > 0) {
          const cat2 = window.LocalSystem?.getCatalog?.() ?? {};
          _term.printBlank();
          _term.printHTML(`<span style="color:var(--text-dim)">Herramientas disponibles para FIREWALL:</span>`);
          available.forEach(id => {
            const dname = cat2[id]?.name ?? id;
            _term.printHTML(
              `  <span style="color:var(--accent)">●</span>  ` +
              `<span style="color:var(--text-bright)">${dname}</span>` +
              `  <span style="color:var(--text-dim)">id: </span>` +
              `<span style="color:var(--cyan)">${id}</span>` +
              `  <span style="color:var(--text-dim)">→ escribí: </span>` +
              `<span style="color:var(--warn)">bypass FIREWALL ${id}</span>`
            );
          });
          _term.printBlank();
        }
    }

    _showPrompt(step.prompt);

    // Hint visual en el prompt de la terminal
    if (_term._inputEl && step.hint) {
      _term._inputEl.placeholder = (typeof step.hint === 'function' ? step.hint() : step.hint) + '...';
    }
  }

  // ─── Interceptar comandos ────────────────────────────────────
  function _hookTerminal(terminal) {
    _origExec = terminal._execute.bind(terminal);

    terminal._execute = function(input) {
      const cmd = (input || '').trim().toLowerCase();

      // Comando skip
      if (cmd === 'skip tutorial') {
        _finish(true);
        return;
      }

      // Ejecutar el comando normal primero
      _origExec(input);

      // Luego verificar progreso del tutorial
      if (_active) {
        setTimeout(() => _checkProgress(input), 300);
      }
    };
  }

  // ─── Verificar si el comando avanza el tutorial ───────────────
  function _checkProgress(input) {
    if (!_active || _step >= STEPS.length) return;

    const step = STEPS[_step];
    const cmd  = (input || '').trim().toLowerCase();

    // Paso especial de ls + download
    // BUG C FIX: use _multiSubStep closure variable instead of mutating STEPS object
    if (step.multiStage) {
      // FIX 4: accept any ls variant (ls, ls -la, ls /, etc.)
      if (_multiSubStep === 0 && (cmd === 'ls' || cmd.startsWith('ls '))) {
        _multiSubStep = 1;
        _term.printBlank();
        _term.printHTML(`  <span style="color:var(--text-dim)">Bien. Ahora descargá uno de los archivos:</span>`);
        _showPrompt(`<span style="color:var(--cyan)">download [nombre_archivo]</span>`);
        return;
      }
      if (_multiSubStep >= 1 && cmd.startsWith('download')) {
        // FIX 5: verify download actually added something to inventory
        const invCount = window.InventorySystem?.count?.() ?? 0;
        if (invCount > 0) {
          _success(step.successCmds['download']);
          _advanceStep();
        } else {
          // Command ran but nothing was downloaded (wrong filename, locked file, etc.)
          // Don't advance — let the player try again
          setTimeout(() => {
            const newCount = window.InventorySystem?.count?.() ?? 0;
            if (newCount > 0) {
              _success(step.successCmds['download']);
              _advanceStep();
            }
            // else: silently wait, player will try another file
          }, 500);
        }
        return;
      }
      return;
    }

    // Paso con waitForBreach: avanza solo cuando el nodo queda breacheado
    // BUG B FIX: solo registrar UN listener por step, no uno por cada bypass escrito
    if (step.waitForBreach) {
      if (!step.validate(input)) return;

      // FIX 8: if player used a tool they don't have, give adaptive hint with display name
      const usedTool = (input || '').trim().split(/\s+/)[2];
      if (usedTool && typeof GameState !== 'undefined' && !GameState.hasSoftware(usedTool)) {
        const bestTool = _getBestFirewallTool();
        const cat3 = window.LocalSystem?.getCatalog?.() ?? {};
        const bestName = cat3[bestTool]?.name ?? bestTool;
        setTimeout(() => {
          if (!_active) return;
          _term.printBlank();
          _term.printHTML(`  <span style="color:var(--warn)">⚠ No tenés <span style="color:var(--cyan)">${usedTool}</span> instalado.</span>`);
          _term.printHTML(
            `  <span style="color:var(--text-dim)">Usá: </span>` +
            `<span style="color:var(--text-bright)">${bestName}</span>` +
            `  <span style="color:var(--text-dim)">→ </span>` +
            `<span style="color:var(--warn)">bypass FIREWALL ${bestTool}</span>`
          );
          _term.printBlank();
        }, 350);
        return;
      }

      // Si el listener ya fue registrado para este paso, no registrar otro
      if (step._breachListenerActive) return;
      step._breachListenerActive = true;

      const onBreach = () => {
        window.removeEventListener('alexim-breach', onBreach);
        step._breachListenerActive = false;
        if (!_active) return;
        _success(step.success);
        _advanceStep();
      };
      window.addEventListener('alexim-breach', onBreach);

      // Si ya está breacheado (bypass exitoso en el mismo tick), avanzar
      setTimeout(() => {
        if (_active && _step === STEPS.indexOf(step)) {
          const node = window.NetworkSystem?.getCurrentNode?.();
          if (node && window.NetworkSystem?.isBreached?.(node.ip)) {
            window.removeEventListener('alexim-breach', onBreach);
            step._breachListenerActive = false;
            _success(step.success);
            _advanceStep();
          }
        }
      }, 2000);
      return;
    }

    // Validación normal
    if (step.validate(input)) {
      if (step.success) _success(step.success);
      _advanceStep();
    }
  }

  // ─── Avanzar al siguiente paso ────────────────────────────────
  function _advanceStep() {
    _step++;
    _multiSubStep = 0;  // BUG C FIX: reset substep on every step advance
    if (_step >= STEPS.length) {
      _finish(false);
    } else {
      _showStep(_step);
    }
  }

  // ─── Fin del tutorial ─────────────────────────────────────────
  async function _finish(skipped) {
    _active       = false;
    _multiSubStep = 0;

    // Clean up any pending breach listeners
    STEPS.forEach(s => { s._breachListenerActive = false; });

    // Restaurar _execute original
    if (_term && _origExec) {
      _term._execute = _origExec;
      _origExec = null;
    }

    // Restaurar placeholder
    if (_term?._inputEl) {
      _term._inputEl.placeholder = '';
    }

    // Marcar como completado
    if (typeof GameState !== 'undefined') {
      GameState.setFlag('tutorial_done', true);
    }
    localStorage.setItem('alexim_tutorial_done', '1');

    if (skipped) {
      _term.printBlank();
      _term.printHTML(`<span style="color:var(--text-dim)">Tutorial salteado. Escribí <span style="color:var(--cyan)">help</span> para ver todos los comandos.</span>`);
      _term.printBlank();
      return;
    }

    await _wait(300);
    _term.printBlank();
    _sep();
    _term.printHTML(`<span style="color:var(--accent);font-family:var(--font-hud);letter-spacing:2px;">★ TUTORIAL COMPLETADO</span>`);
    _sep();
    _term.printBlank();
    _term.printHTML(`  <span style="color:var(--text-normal)">Ya sabés lo básico. El resto es tuyo.</span>`);
    _term.printBlank();
    _term.printHTML(`  <span style="color:var(--text-dim)">El mundo está lleno de nodos. La UEC te está buscando.</span>`);
    _term.printHTML(`  <span style="color:var(--text-dim)">Las decisiones que tomás tienen consecuencias reales.</span>`);
    _term.printBlank();
    _term.printHTML(`  <span style="color:var(--text-muted)">Escribí <span style="color:var(--cyan)">help</span> para ver todos los comandos.</span>`);
    _term.printHTML(`  <span style="color:var(--text-muted)">Escribí <span style="color:var(--cyan)">sysinfo</span> para ver el estado de tu sistema.</span>`);
    _term.printBlank();

    AudioSystem?.success?.();
    UI?.notify?.('★ Tutorial completado — el juego es tuyo', 'success', 6000);

    _notify('completed', {});
  }

  // ─── Notify ──────────────────────────────────────────────────
  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  // ─── API Pública ──────────────────────────────────────────────
  const API = {

    on(ev, cb) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(cb);
    },

    isDone() {
      return !!(
        localStorage.getItem('alexim_tutorial_done') ||
        (typeof GameState !== 'undefined' && GameState.getFlag('tutorial_done'))
      );
    },

    /**
     * Inicia el tutorial guiado en la terminal dada.
     * Solo arranca si no fue completado antes.
     */
    start(terminal) {
      if (!terminal) return;
      if (this.isDone()) return;
      if (_active) return;

      _term         = terminal;
      _step         = 0;
      _multiSubStep = 0;  // reset substep state
      _active       = true;

      // Reset any leftover breach listener flags from previous runs
      STEPS.forEach(s => { s._breachListenerActive = false; });

      _hookTerminal(terminal);

      // Registrar comando skip
      terminal.registerCommand('skip', (args, t) => {
        if (args[0] === 'tutorial') {
          _finish(true);
        } else {
          t.printLine('Uso: skip tutorial', 'muted');
        }
      }, 'Saltear el tutorial.');

      _showStep(0);
    },

    /** Forzar salto (llamable desde consola en testing) */
    skip() {
      if (_active) _finish(true);
    },

    /** Forzar completado (para testing) */
    forceComplete() {
      _step = STEPS.length;
      _finish(false);
    },

    isActive() { return _active; },
  };

  return API;
})();
