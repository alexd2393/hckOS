/**
 * saveSystem.js — Sistema de Guardado Completo
 * AleXim OS — Hacking Narrative Game
 *
 * Guarda y carga el estado completo del juego en localStorage.
 * Incluye: dinero, inventario, herramientas, reputación, heat,
 * red descubierta, misiones, eventos activos.
 *
 * API:
 *   SaveSystem.save()    → { ok, timestamp }
 *   SaveSystem.load()    → { ok, data } | { ok: false }
 *   SaveSystem.hasSave() → boolean
 *   SaveSystem.reset()   → void
 *   SaveSystem.getInfo() → { timestamp, money, rep, heat }
 */

window.SaveSystem = (() => {
  'use strict';

  const SAVE_KEY   = 'alexim_os_v4_save';
  const SAVE_VERSION = 4;

  // ─── Serializar estado completo ───────────────────────────────
  function _collectState() {
    const state = {
      version:   SAVE_VERSION,
      timestamp: Date.now(),
      playTime:  0,
    };

    // GameState
    if (typeof GameState !== 'undefined') {
      state.gameState = {
        money:      GameState.getMoney(),
        suspicion:  GameState.getSuspicion(),
        vpnActive:  GameState.isVpnActive(),
        software:   GameState.getSoftware(),
        narrative:  GameState.getNarrative(),
        day:        GameState.getNarrative()?.day ?? 1,
      };
    }

    // ReputationSystem
    if (window.ReputationSystem) {
      state.reputation = {
        rep:  ReputationSystem.getReputation(),
        heat: ReputationSystem.getHeat(),
      };
    }

    // InventorySystem
    if (window.InventorySystem) {
      state.inventory = InventorySystem.getInventory();
    }

    // NetworkSystem — nodos descubiertos y comprometidos
    if (window.NetworkSystem) {
      state.network = {
        knownNodes: NetworkSystem.getKnownNodes().map(n => n.ip),
        breached:   NetworkSystem.getKnownNodes()
          .filter(n => NetworkSystem.isBreached(n.ip))
          .map(n => n.ip),
        tutorialDone: NetworkSystem.isTutorialComplete(),
      };
    }

    // MissionEngine — activas y completadas
    if (window.MissionEngine) {
      state.missions = {
        active:    MissionEngine.getActive().map(m => m.id),
        completed: MissionEngine.getCompleted(),
      };
    }

    // KarmaSystem
    if (window.KarmaSystem) {
      try { state.karma = KarmaSystem._debug?.(); } catch(e) {}
    }

    // LedgerSystem — historial de transacciones MP
    if (window.LedgerSystem) {
      state.ledger = LedgerSystem.getAll();
    }

    // v10 — LocalSystem: RAM, storage, anonimato, herramientas
    if (window.LocalSystem) {
      state.localSystem = LocalSystem.serialize();
    }

    return state;
  }

  // ─── Restaurar estado ─────────────────────────────────────────
  function _applyState(state) {
    if (state.version !== SAVE_VERSION) {
      console.warn('[SaveSystem] Versión de guardado incompatible. Ignorando.');
      return false;
    }

    // GameState
    if (state.gameState && typeof GameState !== 'undefined') {
      const gs = state.gameState;
      // Ajustar dinero al guardado
      const diff = gs.money - GameState.getMoney();
      if (diff > 0) GameState.addMoney(diff);
      else if (diff < 0) GameState.spendMoney(-diff);

      if (gs.vpnActive && !GameState.isVpnActive()) GameState.toggleVpn();

      // Restaurar software
      if (gs.software) {
        Object.entries(gs.software).forEach(([id, sw]) => {
          if (sw.installed && !GameState.hasSoftware(id)) {
            GameState.installSoftware(id);
            for (let i = 1; i < (sw.level ?? 1); i++) {
              GameState.upgradeSoftware(id);
            }
          }
        });
      }
    }

    // ReputationSystem
    if (state.reputation && window.ReputationSystem) {
      const { rep, heat } = state.reputation;
      if (rep  > 0) ReputationSystem.addReputation(rep,  'restore');
      if (heat > 0) ReputationSystem.addHeat(heat, 'restore');
    }

    // InventorySystem
    if (state.inventory && window.InventorySystem) {
      state.inventory.forEach(item => {
        if (!item.sold) InventorySystem.addData(item);
      });
    }

    // NetworkSystem — revelar nodos conocidos
    if (state.network && window.NetworkSystem) {
      // addNodes existe gracias al patch en network.js
      const savedIps = state.network.knownNodes ?? [];
      savedIps.forEach(ip => NetworkSystem._revealNode?.(ip));

      // Restaurar comprometidos
      const breachedIps = state.network.breached ?? [];
      breachedIps.forEach(ip => NetworkSystem._restoreBreached?.(ip));
    }

    // v10 — LocalSystem: restaurar estado de herramientas y recursos
    if (state.localSystem && window.LocalSystem) {
      LocalSystem.restore(state.localSystem);
    }

    // EXTRA FIX: restaurar narrative flags (incluyendo tutorial_done)
    if (state.gameState?.narrative?.flags && typeof GameState !== 'undefined') {
      Object.entries(state.gameState.narrative.flags).forEach(([key, val]) => {
        if (val) GameState.setFlag(key, val);
      });
      // Sincronizar tutorial_done con localStorage para que TutorialSystem.isDone() funcione
      if (state.gameState.narrative.flags.tutorial_done) {
        localStorage.setItem('alexim_tutorial_done', '1');
      }
    }

    // LedgerSystem — restaurar historial de transacciones MP
    if (state.ledger && window.LedgerSystem && Array.isArray(state.ledger)) {
      state.ledger
        .slice()
        .reverse()  // revertir para mantener orden cronológico (getAll() devuelve newest-first)
        .forEach(entry => {
          LedgerSystem.record(entry.type, entry.amount, entry.desc);
        });
    }

    return true;
  }

  // ─── API pública ───────────────────────────────────────────────
  const API = {

    save() {
      try {
        const state = _collectState();
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        console.log(`[SaveSystem] Guardado OK — ${new Date(state.timestamp).toLocaleTimeString('es-AR')}`);
        if (window.UI) UI.notify('💾 Partida guardada', 'success', 2000);
        return { ok: true, timestamp: state.timestamp };
      } catch (e) {
        console.error('[SaveSystem] Error al guardar:', e);
        return { ok: false, error: e.message };
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return { ok: false, message: 'Sin guardado previo.' };
        const state = JSON.parse(raw);
        const ok    = _applyState(state);
        if (ok) {
          console.log('[SaveSystem] Cargado OK');
          _notify_local('loaded', state);
          return { ok: true, data: state };
        }
        return { ok: false, message: 'Guardado incompatible.' };
      } catch (e) {
        console.error('[SaveSystem] Error al cargar:', e);
        return { ok: false, error: e.message };
      }
    },

    hasSave() {
      return !!localStorage.getItem(SAVE_KEY);
    },

    getInfo() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        return {
          timestamp: s.timestamp,
          date:      new Date(s.timestamp).toLocaleString('es-AR'),
          money:     s.gameState?.money ?? 0,
          rep:       s.reputation?.rep  ?? 0,
          heat:      s.reputation?.heat ?? 0,
          version:   s.version,
        };
      } catch(e) { return null; }
    },

    reset() {
      localStorage.removeItem(SAVE_KEY);
      if (window.UI) UI.notify('🗑️ Guardado eliminado. Reiniciando...', 'warning', 3000);
      setTimeout(() => location.reload(), 2500);
    },

    /** Autosave cada N minutos. */
    startAutosave(intervalMinutes = 2) {
      setInterval(() => {
        API.save();
      }, intervalMinutes * 60000);
      console.log(`[SaveSystem] Autosave cada ${intervalMinutes} min activado.`);
    },
  };

  function _notify_local(ev, data) {
    // Simple local notifier — not using the full listener pattern
    if (ev === 'loaded' && window.UI) {
      const info = API.getInfo();
      if (info) {
        UI.notify(`📂 Partida cargada — ${info.date}`, 'info', 5000);
      }
    }
  }

  return API;
})();
