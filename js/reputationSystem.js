/**
 * reputationSystem.js — Sistema de Reputación y Calor Policial
 * AleXim Mobile — Hacking Narrative Game
 *
 * Dos variables ocultas al jugador:
 *
 *   reputation (0–100)
 *     Aumenta con misiones exitosas y ventas de datos.
 *     Define qué trabajos recibe el jugador.
 *     Thresholds: desconocido | principiante | conocido | veterano | leyenda
 *
 *   heat (0–100)
 *     Aumenta con hackeos fallidos, datos sensibles robados, apariciones en noticias.
 *     A >60: misiones trampa empiezan a llegar.
 *     A >80: eventos de rastreo activo.
 *     A 100: BUSTED — integra con GameState.
 *
 * API:
 *   ReputationSystem.addReputation(amount, reason)
 *   ReputationSystem.addHeat(amount, reason)
 *   ReputationSystem.reduceHeat(amount, reason)
 *   ReputationSystem.getReputation()
 *   ReputationSystem.getHeat()
 *   ReputationSystem.getTier()         → 'desconocido' | 'principiante' | ...
 *   ReputationSystem.getHeatLevel()    → 'bajo' | 'moderado' | 'alto' | 'crítico'
 *   ReputationSystem.shouldSendTrap()  → boolean (heat > 60 + random)
 *   ReputationSystem.on(event, cb)
 */

window.ReputationSystem = (() => {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────
  let _rep       = 0;
  let _heat      = 0;
  let _listeners = {};
  let _history   = [];   // { type, amount, reason, ts }

  // ─── Thresholds ────────────────────────────────────────────────────
  const REP_TIERS = [
    { min: 0,  max: 10,  label: 'desconocido',  jobQuality: 1 },
    { min: 10, max: 30,  label: 'principiante', jobQuality: 2 },
    { min: 30, max: 60,  label: 'conocido',     jobQuality: 3 },
    { min: 60, max: 85,  label: 'veterano',     jobQuality: 4 },
    { min: 85, max: 101, label: 'leyenda',      jobQuality: 5 },
  ];

  const HEAT_LEVELS = [
    { min: 0,  max: 30,  label: 'bajo',     color: 'var(--accent)'  },
    { min: 30, max: 60,  label: 'moderado', color: 'var(--warn)'    },
    { min: 60, max: 80,  label: 'alto',     color: 'var(--danger)'  },
    { min: 80, max: 101, label: 'crítico',  color: 'var(--danger)'  },
  ];

  function _notify(event, data) {
    (_listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function _log(type, amount, reason) {
    _history.push({ type, amount, reason, ts: Date.now() });
    if (_history.length > 200) _history.shift();
  }

  function _checkHeatConsequences(prev, next) {
    // Cruzar umbral 60 → posible alerta
    if (prev < 60 && next >= 60) {
      _notify('heat_threshold', { level: 'alto', heat: next });
      if (window.UI) UI.notify('⚠ Calor policial ALTO — reducí actividad o usá VPN', 'warning', 7000);
    }
    // Cruzar umbral 80 → rastreo activo
    if (prev < 80 && next >= 80) {
      _notify('heat_threshold', { level: 'crítico', heat: next });
      if (window.UI) UI.notify('🚨 RASTREO ACTIVO — Unidad Cibercrimen te sigue la pista', 'error', 9000);
      if (window.AudioSystem) AudioSystem.warning();
    }
    // 100 → BUSTED
    if (next >= 100) {
      _notify('busted', {});
      if (typeof GameState !== 'undefined') {
        // Trigger the GameState busted event too
        GameState.addSuspicion(100);
      }
    }
  }

  function _checkRepConsequences(prev, next) {
    const prevTier = REP_TIERS.find(t => prev >= t.min && prev < t.max);
    const nextTier = REP_TIERS.find(t => next >= t.min && next < t.max);
    if (prevTier && nextTier && prevTier.label !== nextTier.label) {
      _notify('tier_change', { from: prevTier.label, to: nextTier.label });
      if (window.UI) {
        UI.notify(`📈 Reputación: ahora sos ${nextTier.label.toUpperCase()} en el underground`, 'info', 6000);
      }
    }
  }

  // ─── API pública ───────────────────────────────────────────────────
  const API = {

    on(event, cb) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(cb);
    },

    addReputation(amount, reason = '') {
      const prev = _rep;
      _rep = Math.min(100, _rep + Math.max(0, amount));
      _log('rep+', amount, reason);
      _notify('reputation', { value: _rep, delta: amount, reason });
      _checkRepConsequences(prev, _rep);
      // Sync con GameState si existe
      if (typeof GameState !== 'undefined' && GameState.setReputation) {
        GameState.setReputation(_rep);
      }
      return _rep;
    },

    addHeat(amount, reason = '') {
      // VPN reduce heat gain a la mitad
      const vpnActive = (typeof GameState !== 'undefined') ? GameState.isVpnActive() : false;
      const effective = vpnActive ? Math.floor(amount / 2) : amount;
      const prev = _heat;
      _heat = Math.min(100, _heat + Math.max(0, effective));
      _log('heat+', effective, reason);
      _notify('heat', { value: _heat, delta: effective, reason });
      _checkHeatConsequences(prev, _heat);
      // Sync suspicion con GameState
      if (typeof GameState !== 'undefined') {
        GameState.addSuspicion(Math.floor(effective / 3));
      }
      // v10: heat alto degrada el anonimato (más actividad = más rastro digital)
      if (window.LocalSystem && effective > 0 && !reason.startsWith('restore')) {
        LocalSystem.degradeAnonymity(effective * 0.08, reason);
      }
      return _heat;
    },

    reduceHeat(amount, reason = '') {
      const prev = _heat;
      _heat = Math.max(0, _heat - Math.max(0, amount));
      _log('heat-', amount, reason);
      _notify('heat', { value: _heat, delta: -amount, reason });
      return _heat;
    },

    getReputation()   { return _rep; },
    getHeat()         { return _heat; },

    getTier() {
      return REP_TIERS.find(t => _rep >= t.min && _rep < t.max) ?? REP_TIERS[0];
    },

    getHeatLevel() {
      return HEAT_LEVELS.find(t => _heat >= t.min && _heat < t.max) ?? HEAT_LEVELS[0];
    },

    getJobQuality() {
      return API.getTier().jobQuality;
    },

    /**
     * Determina si debe enviarse una misión trampa.
     * Probabilidad aumenta con heat. Solo aplica cuando heat > 60.
     */
    shouldSendTrap() {
      if (_heat < 60) return false;
      const chance = (_heat - 60) / 80; // 0 at 60, 0.5 at 100
      return Math.random() < chance;
    },

    /**
     * Consecuencias de aceptar una misión trampa.
     */
    trapTriggered() {
      this.addHeat(35, 'trap_mission');
      _notify('trapped', { heat: _heat });
      if (window.UI) {
        UI.notify('🚔 ¡TRAMPA POLICIAL! La Unidad Cibercrimen rastreó tu conexión', 'error', 10000);
      }
      if (window.AudioSystem) AudioSystem.busted();
    },

    getHistory(n = 20) { return _history.slice(-n); },

    debug() {
      return { reputation: _rep, heat: _heat, tier: API.getTier().label, heatLevel: API.getHeatLevel().label };
    },
  };

  return API;
})();
