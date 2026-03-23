/**
 * main.js — Entry Point & Boot Sequence
 * AleXim OS — Hacking Narrative Game
 *
 * Orchestrates: boot animation → desktop reveal → subsystem init → welcome.
 */

// ─── Boot log messages ────────────────────────────────────────────
const BOOT_LOG = [
  '[  OK  ] Loading kernel modules...',
  '[  OK  ] Initializing memory subsystem...',
  '[  OK  ] Mounting encrypted partitions...',
  '[  OK  ] Starting network drivers...',
  '[  OK  ] Loading AleXim security layer...',
  '[  OK  ] Decrypting user profile...',
  '[  OK  ] Starting window compositor...',
  '[  OK  ] Applying sandboxed process isolation...',
  '[  OK  ] Loading anonymization layer...',
  '[  OK  ] AleXim OS — ready.',
];

// ═════════════════════════════════════════════════════════════════
// AGREGADO: Referencias a sistemas de juego globales
// ═════════════════════════════════════════════════════════════════
let GameSystems = {
  connector: null,
  karma: null,
  news: null,
  missions: null
};

// ═════════════════════════════════════════════════════════════════
// AGREGADO: Setup de eventos globales del mundo del juego
// ═════════════════════════════════════════════════════════════════
function setupGlobalEventListeners() {
  
  // Evento: Hackeo completado - actualiza UI de heat y noticias
  window.addEventListener('world-event', (e) => {
    if (e.detail.type === 'HACK_COMPLETED') {
      const data = e.detail.data;
      
      // Actualizar heat en UI si existe
      if (window.UI && data.worldChanges) {
        const heat = WorldConnector.getHeatLevel ? WorldConnector.getHeatLevel() : 0;
        document.body.style.setProperty('--heat-level', heat + '%');
        
        // Alerta visual si heat alto
        if (heat > 75) {
          UI.notify('⚠ NIVEL DE ALERTA ELEVADO - Heat crítico', 'error', 6000);
        }
      }
      
      // Mostrar noticia si se generó
      if (data.news && window.UI) {
        UI.notify(`📰 ${data.news.headline}`, 'warning', 8000);
      }
    }
  });
  
  // Evento: Cambio de Karma - efectos narrativos
  window.addEventListener('karma-flag', (e) => {
    const flag = e.detail.flag;
    console.log('[Karma] Flag desbloqueada:', flag);
    
    switch(flag) {
      case 'dark_path':
        UI.notify('Tu reputación en el underworld crece...', 'error', 5000);
        document.body.classList.add('karma-dark');
        break;
      case 'hacktivist':
        UI.notify('Los activistas te ven como un aliado', 'info', 5000);
        break;
      case 'compromised':
        UI.notify('⚠ IDENTIDAD COMPROMETIDA - Evacúa inmediatamente', 'error', 10000);
        AudioSystem.busted();
        break;
    }
  });
  
  // Evento: Nueva noticia generada
  window.addEventListener('news-update', (e) => {
    const news = e.detail.news;
    if (news.category === 'crime' || news.severity === 'critical') {
      UI.notify(`🔴 ${news.headline}`, 'error', 7000);
    }
  });
  
  // Evento: Contenido desbloqueado
  window.addEventListener('content-unlocked', (e) => {
    const contentId = e.detail.contentId;
    if (contentId.startsWith('mission_')) {
      UI.notify(`📋 Nueva misión disponible: ${contentId}`, 'info', 6000);
    }
  });
}

// ─── Boot sequence ────────────────────────────────────────────────

async function _runBoot() {
  const logEl  = document.getElementById('boot-log');
  const barEl  = document.getElementById('boot-progress');
  const total  = BOOT_LOG.length;

  AudioSystem.boot();

  for (let i = 0; i < total; i++) {
    await _wait(180 + Math.random() * 120);

    const line = document.createElement('div');
    line.className   = 'boot-line';
    line.textContent = BOOT_LOG[i];
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;

    barEl.style.width = ((i + 1) / total * 100) + '%';
  }

  await _wait(600);
}

// ─── Desktop reveal ───────────────────────────────────────────────

async function _showDesktop() {
  const boot    = document.getElementById('boot-screen');
  const desktop = document.getElementById('os-desktop');

  // Fade out boot
  boot.style.transition = 'opacity 0.5s';
  boot.style.opacity    = '0';
  await _wait(500);
  boot.style.display    = 'none';

  // Fade in desktop
  desktop.classList.remove('hidden');
  desktop.style.opacity    = '0';
  desktop.style.transition = 'opacity 0.4s';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => { desktop.style.opacity = '1'; })
  );

  await _wait(400);
}

// ─── Main entry point ─────────────────────────────────────────────

async function init() {

  // 1. Audio
  AudioSystem.init();

  // BUG E FIX: mostrar menú PRIMERO (inmediato, sin esperar sistemas)
  // Los sistemas se inicializan en paralelo durante la interacción del menú
  // Boot animation (~2.5s) da tiempo suficiente para que terminen

  // Arrancar init de sistemas en background (sin await)
  const _systemsReady = initializeGameSystems();

  // ─── MENÚ PRINCIPAL ──────────────────────────────────────────
  // Aparece de inmediato — sin pantalla en blanco
  const menuResult = await MainMenu.show();

  // Esperar que los sistemas terminen antes de continuar
  // (en la mayoría de los casos ya habrán terminado durante la interacción del menú)
  await _systemsReady;

  // Update menu status indicator if still visible
  const _sysStatusEl = document.getElementById('menu-sys-status');
  if (_sysStatusEl) {
    _sysStatusEl.textContent = 'sistemas OK';
    _sysStatusEl.style.color = 'var(--accent)';
  }

  // FIX B: Re-dispatch ecosystem events after systems are confirmed ready.
  // The initial dispatch inside worldPopulation fires before AleXimOS.init(),
  // so apps that were already open (or opened fast) may have missed the data.
  // These are caught by the init()-time listeners we added in aleximOS.js.
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('nodo-social-update'));
    window.dispatchEvent(new CustomEvent('darkforum-update'));
  }, 200);
  const isNewGame  = menuResult.mode === 'new';
  const playerAlias = menuResult.alias;

  // Si nueva partida: resetear estado y guardar alias
  if (isNewGame) {
    // Limpiar save anterior si existe
    localStorage.removeItem('alexim_os_v4_save');
    localStorage.removeItem('alexim_tutorial_done');

    // BUG D FIX: reset in-memory GameState flags for tutorial
    // (localStorage alone isn't enough — GameState._state persists in memory)
    if (typeof GameState !== 'undefined') {
      GameState.setFlag('tutorial_done', false);
      GameState.setFlag('first_scan',    false);
      GameState.setFlag('first_connect', false);
      GameState.setFlag('first_download',false);
    }

    // Aplicar alias elegido usando la API oficial
    if (playerAlias) {
      GameState.setAlias(playerAlias);
    }
  }

  // 3. Boot animation (boot log diferente según modo)
  if (isNewGame) {
    // Reemplazar última línea del boot log para nueva partida
    BOOT_LOG[BOOT_LOG.length - 1] = `[  OK  ] Bienvenido, ${playerAlias ?? 'operador'}.`;
  }
  await _runBoot();

  // 4. Show the desktop
  await _showDesktop();

  // 5. Init OS subsystems
  AleXimOS.init();
  UI.init();

  // Restaurar tema guardado
  { const t = localStorage.getItem('alexim_theme'); if (t && t !== 'default') AleXimOS._applyTheme(t); }

  // 6. Cargar save si es modo continuar
  if (!isNewGame && window.SaveSystem?.hasSave?.()) {
    const info = SaveSystem.getInfo();
    if (info) {
      await _wait(200);
      SaveSystem.load();
    }
  }

  // Wire HUD systems
  if (window.InventorySystem) {
    InventorySystem.on('added', UI.updateHUD);
    InventorySystem.on('sold',  UI.updateHUD);
  }
  if (window.ReputationSystem) {
    ReputationSystem.on('heat',       UI.updateHUD);
    ReputationSystem.on('reputation', UI.updateHUD);
  }

  setupGlobalEventListeners();

  // 7. React to busted event
  GameState.on('busted', () => {
    AudioSystem.busted();
    UI.dialog(
      '⚠ SISTEMA COMPROMETIDO',
      'La UEC trazó tu actividad.<br><br>' +
      'Limpiando logs y reduciendo sospecha...',
      [{
        text: 'Contramedidas (−$300 CR)',
        style: 'primary',
        action: () => {
          GameState.reduceSuspicion(100);
          GameState.spendMoney(300);
          UI.notify('Contramedidas aplicadas.', 'warning');
        },
      }]
    );
  });

  // 8. Abrir terminal y conectar GameLoop
  // FIX C: dispatch ecosystem refresh now that desktop is live and listeners are registered
  window.dispatchEvent(new CustomEvent('nodo-social-update'));
  window.dispatchEvent(new CustomEvent('darkforum-update'));
  await _wait(500);
  const termWin = AleXimOS.openApp('terminal');
  if (termWin?.terminal && typeof GameLoop !== 'undefined') {
    GameLoop.attach(termWin.terminal);
    window.dispatchEvent(new CustomEvent('gameloop-ready'));

    await _wait(350);
    const t = termWin.terminal;

    if (isNewGame) {
      // ── Nueva partida: mensaje de bienvenida narrativo ─────
      const alias = playerAlias ?? 'operador';
      t.printBlank();
      t.printHTML(`<span style="color:var(--accent);font-family:var(--font-hud);letter-spacing:2px;">CANAL SEGURO ESTABLECIDO</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(44)}</span>`);
      t.printBlank();
      t.printHTML(`  <span style="color:var(--text-muted)">Alias activo:  </span><span style="color:var(--cyan)">${alias}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Sistema:       </span><span style="color:var(--text-normal)">AleXim OS v10.1</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Localización:  </span><span style="color:var(--text-dim)">Argentina — encubierta</span>`);
      t.printBlank();
      t.printHTML(`  <span style="color:var(--text-dim)">Todo lo que hagas desde acá deja rastros.</span>`);
      t.printHTML(`  <span style="color:var(--text-dim)">La UEC monitorea la red. Los rivales también.</span>`);
      t.printBlank();

      // ── Iniciar tutorial guiado ────────────────────────────
      await _wait(600);
      if (window.TutorialSystem && !TutorialSystem.isDone()) {
        TutorialSystem.start(t);
      }

    } else {
      // ── Partida cargada: mensaje de retorno ───────────────
      const alias = localStorage.getItem('alexim_alias') ?? GameState.getAlias();
      await _wait(300);
      UI.notify(`Bienvenido de vuelta, ${alias}.`, 'info', 4000);
      await _wait(1800);
      UI.notify('▶ Escribí help para ver todos los comandos.', 'warning', 5000);
    }
  }

  // 9. Auto-save periódico
  setInterval(() => {
    GameState.save();
  }, 120_000);

  // 10. Sincronización periódica
  setInterval(() => {
    if (window.WorldConnector) {
      const state = WorldConnector.getWorldState ? WorldConnector.getWorldState() : null;
      if (state && state.currentHeat > 80 && Math.random() > 0.7) {
        UI.notify('⚠ Advertencia: Tu firma digital es demasiado visible', 'warning', 5000);
      }
    }
  }, 30000);

  const finalAlias = playerAlias ?? localStorage.getItem('alexim_alias') ?? 'ghost_0x1';
  console.log(`[AleXim] Boot complete. Welcome, ${finalAlias}.`);
}

// ═════════════════════════════════════════════════════════════════
// AGREGADO: Función de inicialización de sistemas de juego
// ═════════════════════════════════════════════════════════════════
async function initializeGameSystems() {
  console.log('[GameSystems] Inicializando subsistemas v4...');
  try {
    // 1. Balance config (sin init)
    if (window.BalanceConfig) console.log('→ BalanceConfig OK');

    // v10 — LocalSystem: inicializar ANTES de los otros sistemas
    if (window.LocalSystem) {
      LocalSystem.init();
      console.log('→ LocalSystem OK');
    }

    // 2. Karma + Reputation
    if (window.KarmaSystem)       { GameSystems.karma     = KarmaSystem;      console.log('→ KarmaSystem OK'); }
    if (window.ReputationSystem)  {                                             console.log('→ ReputationSystem OK'); }

    // 3. Inventory + DarkMarket
    if (window.InventorySystem)   {                                             console.log('→ InventorySystem OK'); }
    if (window.DarkMarketSystem)  {
      DarkMarketSystem.on('offer_accepted', () => { if(typeof UI!=='undefined') UI.updateHUD?.(); });
      console.log('→ DarkMarketSystem OK');
    }

    // 4. Economy System
    if (window.EconomySystem) {
      EconomySystem.init();
      console.log('→ EconomySystem OK');
    }

    // 5. Pursuit System
    if (window.PursuitSystem) {
      PursuitSystem.init();
      // Trigger trace on high heat breach fail
      console.log('→ PursuitSystem OK');
    }

    // 6. Node Generator
    if (window.NodeGenerator)     { console.log('→ NodeGenerator OK'); }

    // 7. Event System
    if (window.EventSystem) {
      EventSystem.init();
      console.log('→ EventSystem OK');
    }

    // 8. Mission Engine
    if (window.MissionEngine) {
      MissionEngine.init();
      GameSystems.missions = MissionEngine;
      console.log('→ MissionEngine OK');
    }

    // 9. Save System
    if (window.SaveSystem) {
      // Auto-load if save exists
      if (SaveSystem.hasSave()) {
        const info = SaveSystem.getInfo();
        console.log(`[SaveSystem] Guardado encontrado: ${info?.date}`);
      }
      SaveSystem.startAutosave(2);
      console.log('→ SaveSystem OK');
    }

    // 10. Legacy systems
    if (window.MissionSystem && MissionSystem.init) {
      try { await MissionSystem.init(); GameSystems.missionLegacy = MissionSystem; } catch(e) {}
    }
    if (window.NewsSystem && NewsSystem.init) {
      try { await NewsSystem.init(); GameSystems.news = NewsSystem; console.log('→ NewsSystem OK'); } catch(e) {}
    }
    if (window.WorldConnector)    { GameSystems.connector = WorldConnector;    console.log('→ WorldConnector OK'); }

    // 11. Ecosistema digital procedural (personas, relaciones, NodoSocial, DarkForum)
    if (window.WorldPopulation) {
      await WorldPopulation.init();
      console.log('→ WorldPopulation OK');
    }

    // v8 — Sistema Adversarial (después de alexim-ready para que GameLoop esté listo)
    if (window.AdversarialSystem) {
      // Inicia con delay para que la terminal esté disponible
      setTimeout(() => {
        AdversarialSystem.init();
        console.log('→ AdversarialSystem OK');
      }, 3500);
    }

    window.dispatchEvent(new CustomEvent('alexim-ready'));
    console.log('[GameSystems] ✓ Todos los sistemas operativos v8.');

  } catch (error) {
    console.error('[GameSystems] Error de inicialización:', error);
  }
}

// ─── Utilities ────────────────────────────────────────────────────

function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Mobile Quick-Command Helper ──────────────────────────────────
/**
 * MobileCmds — injects commands into the active terminal from the
 * mobile quick-command bar. Works on any screen size.
 */
const MobileCmds = (() => {

  function _getTerminal() {
    return GameLoop?.getTerminal() ?? null;
  }

  function _inject(cmd) {
    const t = _getTerminal();
    if (!t) { console.warn('[MobileCmds] No terminal activa.'); return; }
    // Simulate pressing Enter on the given command
    t._echoPrompt(cmd);
    t._execute(cmd);
    // Focus input after a tick so keyboard stays dismissed on mobile
    setTimeout(() => t._inputEl?.focus(), 50);
  }

  return {
    /** Send a full command directly (no args needed). */
    send(cmd) { _inject(cmd); },

    /**
     * Prompt the user for an argument and inject the combined command.
     * Falls back to filling the terminal input field on mobile.
     */
    prompt(baseCmd) {
      const t = _getTerminal();
      if (!t) return;

      const hints = {
        download: 'Nombre del archivo (ej: clientes_2025.csv)',
        connect:  'IP del nodo (ej: 192.168.1.1)',
        sell:     'Nombre del archivo a vender (ej: clientes_2025.csv)',
        accept:   'ID de la oferta (ej: off_abc123)',
        reject:   'ID de la oferta (ej: off_abc123)',
      };

      const hint = hints[baseCmd] ?? 'Argumento';

      // On mobile, just pre-fill the input field for the user
      if (t._inputEl) {
        t._inputEl.value = baseCmd + ' ';
        t._inputEl.focus();
        // Move cursor to end
        const len = t._inputEl.value.length;
        t._inputEl.setSelectionRange(len, len);
      }
    },
  };
})();

// ─── Start ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Fix #1 — pantalla completa en el primer gesto del usuario (requerido por navegadores)
  const _tryFS = () => {
    const el  = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) req.call(el).catch(() => {});
  };
  document.addEventListener('click',   _tryFS, { once: true });
  document.addEventListener('keydown', _tryFS, { once: true });

  init();
});

// Fix #5 — Ledger: hook GameState.addMoney y spendMoney para registrar movimientos
(function _wireLedger() {
  window.addEventListener('alexim-ready', () => {
    if (!window.LedgerSystem || typeof GameState === 'undefined') return;

    // Patch: intercept buy (from AleXimOS._buy)
    const origBuy = AleXimOS._buy?.bind(AleXimOS);
    if (origBuy) {
      AleXimOS._buy = function(id, price) {
        origBuy(id, price);
        LedgerSystem.onBuy(price, id);
      };
    }

    // Patch: intercept DarkMarket acceptOffer
    if (window.DarkMarketSystem) {
      const origAccept = DarkMarketSystem.acceptOffer.bind(DarkMarketSystem);
      DarkMarketSystem.acceptOffer = function(offerId) {
        const res = origAccept(offerId);
        if (res.ok) LedgerSystem.onSale(res.amount, `Venta DarkMarket`);
        return res;
      };
    }

    // Hook mission completion
    if (window.MissionEngine) {
      MissionEngine.on('completed', ({ mission, reward }) => {
        if (reward > 0) LedgerSystem.onMissionReward(reward, mission.title);
      });
    }

    // Hook PursuitSystem bust penalty
    if (window.PursuitSystem) {
      PursuitSystem.on('busted', () => {
        const loss = Math.floor((typeof GameState !== 'undefined' ? GameState.getMoney() : 0) * 0.40);
        if (loss > 0) LedgerSystem.onPenalty(loss, 'Operativo policial UEC');
      });
    }
  });
})();