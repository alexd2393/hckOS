/**
 * pursuitSystem.js — Sistema de Persecución Policial
 * AleXim OS — Hacking Narrative Game
 *
 * Convierte el heat en un sistema real de cinco niveles con
 * eventos, rastreos activos y mecánicas de escape.
 *
 * Niveles:
 *   0–20   INACTIVO     actividad normal
 *   20–40  VIGILANCIA   noticias mencionan incidentes
 *   40–60  INVESTIGACIÓN patrulla digital activa
 *   60–80  RASTREO      dispositivo desconocido intentando seguirte
 *   80–100 REDADA       intento de arresto inminente
 *
 * API:
 *   PursuitSystem.getLevel()        → { name, heat, color, ... }
 *   PursuitSystem.startTrace()      → void  (activa el contador)
 *   PursuitSystem.cancelTrace()     → void  (el jugador escapó)
 *   PursuitSystem.isTraceActive()   → boolean
 *   PursuitSystem.getTraceSeconds() → number (segundos restantes)
 *   PursuitSystem.payCleaner()      → { ok, message }
 *   PursuitSystem.on(event, cb)
 */

window.PursuitSystem = (() => {
  'use strict';

  const BC = () => window.BalanceConfig?.pursuit ?? {};
  const RS = () => window.ReputationSystem;
  const GS = () => (typeof GameState !== 'undefined' ? GameState : null);

  // ─── Niveles ───────────────────────────────────────────────────
  const LEVELS = [
    {
      name: 'INACTIVO',     min: 0,  max: 20,
      color: 'var(--accent)', icon: '●',
      desc: 'Sin actividad policial detectada. Podés operar libremente.',
    },
    {
      name: 'VIGILANCIA',   min: 20, max: 40,
      color: 'var(--accent)', icon: '◉',
      desc: 'Incidentes mencionados en medios. Presencia policial digital baja.',
    },
    {
      name: 'INVESTIGACIÓN',min: 40, max: 60,
      color: 'var(--warn)',   icon: '⚠',
      desc: 'Unidad Cibercrimen abrió expediente. Evitá operaciones de alto riesgo.',
    },
    {
      name: 'RASTREO',      min: 60, max: 80,
      color: 'var(--danger)', icon: '⚡',
      desc: 'TRACE ACTIVO — Dispositivo desconocido está siguiendo tus conexiones.',
    },
    {
      name: 'REDADA',       min: 80, max: 101,
      color: 'var(--danger)', icon: '🚨',
      desc: '¡ALERTA MÁXIMA! Intento de arresto inminente. Cortá conexiones YA.',
    },
  ];

  // ─── Mensajes de alerta por nivel ─────────────────────────────
  const LEVEL_ALERTS = {
    VIGILANCIA: [
      '⚠ Tu actividad fue notada. Noticias mencionan "incidentes digitales" en tu área.',
      '⚠ La Unidad Cibercrimen revisó logs de ISPs. Por ahora, sin resultado.',
    ],
    INVESTIGACIÓN: [
      '🔍 ALERTA: La UEC abrió expediente sobre ataques recientes. Reducí actividad.',
      '🔍 El Ministerio de Seguridad autorizó monitoreo preventivo de conexiones sospechosas.',
    ],
    RASTREO: [
      '⚡ TRACE INICIADO — Dispositivo desconocido intentando seguir tu ruta de conexión.',
      '⚡ ADVERTENCIA: Paquetes de rastreo detectados en tu nodo. Cortá la conexión.',
    ],
    REDADA: [
      '🚨 OPERATIVO POLICIAL — La UEC coordinó una redada. Evacuá AHORA.',
      '🚨 ARRESTADO INMINENTE — Se detectó tu ubicación aproximada. CORTÁ TODO.',
    ],
  };

  // ─── State ─────────────────────────────────────────────────────
  let _listeners     = {};
  let _traceActive   = false;
  let _traceDeadline = 0;        // timestamp cuando expira el trace
  let _traceTimer    = null;
  let _decayTimer    = null;
  let _prevLevelName = 'INACTIVO';
  let _alertCooldown = 0;        // evitar spam de alertas

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function _currentHeat() {
    return RS()?.getHeat() ?? 0;
  }

  function _getLevel(heat) {
    return LEVELS.find(l => heat >= l.min && heat < l.max) ?? LEVELS[4];
  }

  // ─── Inicio de rastreo ─────────────────────────────────────────
  function _startTrace() {
    if (_traceActive) return;
    _traceActive   = true;
    const timeout  = (BC().traceToBustMs ?? 120000);
    _traceDeadline = Date.now() + timeout;

    _notify('trace_started', { deadline: _traceDeadline });
    _pushTerminalMsg('⚡ TRACE INICIADO — Un dispositivo desconocido está rastreando tus conexiones.', 'error');
    _pushTerminalMsg('⚡ Tenés 2 minutos para cortar la conexión (disconnect) o serás identificado.', 'warning');

    if (window.AudioSystem) AudioSystem.warning();

    _traceTimer = setTimeout(() => {
      if (_traceActive) _bust();
    }, timeout);
  }

  function _cancelTrace(reason = 'disconnect') {
    if (!_traceActive) return;
    _traceActive = false;
    clearTimeout(_traceTimer);
    _traceDeadline = 0;

    const heatCut = BC().disconnectHeatReduction ?? 8;
    RS()?.reduceHeat(heatCut, 'trace_escaped');
    _notify('trace_cancelled', { reason });
    _pushTerminalMsg(`✓ Rastreo evitado. Calor policial reducido -${heatCut}%.`, 'success');
    if (window.AudioSystem) AudioSystem.success();
  }

  function _bust() {
    _traceActive = false;
    clearTimeout(_traceTimer);
    _notify('busted', {});
    _pushTerminalMsg('🚨 IDENTIFICADO — La UEC tiene tu dirección. Reiniciando con penalización...', 'error');
    if (window.AudioSystem) AudioSystem.busted();

    // Penalización: pierde 40% del dinero, heat se resetea a 50
    const gs = GS();
    if (gs) {
      const loss = Math.floor(gs.getMoney() * 0.40);
      gs.spendMoney(loss);
      // Registrar penalización en LedgerSystem (MP Wallet)
      if (window.LedgerSystem && loss > 0) {
        LedgerSystem.onPenalty(loss, 'Operativo policial UEC');
      }
      _pushTerminalMsg(`💸 Perdiste $${loss.toLocaleString('es-AR')} CR en el operativo policial.`, 'error');
    }
    RS()?.reduceHeat(50, 'bust_reset');
    if (window.UI) UI.dialog(
      '🚨 DETENIDO POR LA UEC',
      'La Unidad Especial de Cibercrimen rastreó tus conexiones.<br><br>' +
      'Perdiste el 40% de tu saldo como penalización.<br>' +
      'Tu calor policial se redujo, pero tu reputación cayó.<br><br>' +
      'Siguás libre solo porque borraron las evidencias a tiempo.',
      [{ text: 'Continuar', style: 'primary', action: () => {
        RS()?.addReputation?.(-10, 'busted');
      }}]
    );
  }

  // ─── Mensajes en terminal ──────────────────────────────────────
  function _pushTerminalMsg(msg, type = 'warning') {
    const t = window.GameLoop?.getTerminal?.();
    if (t) {
      t.printBlank?.();
      t.printLine?.(msg, type);
    }
    if (window.UI) UI.notify(msg, type, 8000);
  }

  // ─── Decay pasivo de heat ──────────────────────────────────────
  function _startDecay() {
    _decayTimer = setInterval(() => {
      const heat = _currentHeat();
      if (heat <= 0) return;
      const vpnOn = GS()?.isVpnActive?.() ?? false;
      const BC    = window.BalanceConfig?.heat ?? {};
      const decay = vpnOn
        ? (BC.vpnDecayPerMinute ?? 3) / 4      // cada 15s ÷ 4 = por min
        : (BC.passiveDecayPerMinute ?? 1.5) / 4;
      RS()?.reduceHeat(decay, 'passive_decay');
    }, 15000);  // cada 15 segundos
  }

  // ─── Check periódico de nivel ─────────────────────────────────
  function _startLevelCheck() {
    setInterval(() => {
      const heat  = _currentHeat();
      const level = _getLevel(heat);

      // Detectar cambio de nivel
      if (level.name !== _prevLevelName) {
        _prevLevelName = level.name;
        _notify('level_change', { level });
        const alerts = LEVEL_ALERTS[level.name];
        if (alerts) {
          const msg = alerts[Math.floor(Math.random() * alerts.length)];
          _pushTerminalMsg(msg, level.name === 'REDADA' ? 'error' : 'warning');
        }
      }

      // Trace triggers
      const bc  = BC();
      const now = Date.now();
      if (!_traceActive && now > _alertCooldown) {
        const chance = (window.BalanceConfig?.pursuit?.tracePingChance ?? {})[
          level.name === 'RASTREO' ? 'high' : level.name === 'REDADA' ? 'critical' : 'low'
        ] ?? 0;
        if (Math.random() < chance) {
          _alertCooldown = now + 60000;  // 1 minuto de cooldown
          if (level.name === 'RASTREO' || level.name === 'REDADA') {
            _startTrace();
          } else {
            // Solo alerta sin trace
            const alerts = LEVEL_ALERTS[level.name];
            if (alerts) _pushTerminalMsg(alerts[0], 'warning');
          }
        }
      }
    }, BC().traceCheckInterval ?? 8000);
  }

  // ─── API pública ───────────────────────────────────────────────
  const API = {

    on(ev, cb) { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); },

    init() {
      _startDecay();
      _startLevelCheck();

      // Cancelar trace automáticamente al desconectar
      if (window.NetworkSystem) {
        NetworkSystem.on('disconnect', () => {
          if (_traceActive) _cancelTrace('disconnect');
        });
      }

      console.log('[PursuitSystem] Inicializado.');
    },

    getLevel(heat) {
      return _getLevel(heat ?? _currentHeat());
    },

    getLevels() { return LEVELS; },

    startTrace()           { _startTrace(); },
    cancelTrace(reason)    { _cancelTrace(reason); },
    isTraceActive()        { return _traceActive; },
    getTraceSeconds()      {
      if (!_traceActive) return 0;
      return Math.max(0, Math.round((_traceDeadline - Date.now()) / 1000));
    },

    /**
     * Pagar un limpiador para reducir el heat.
     */
    payCleaner() {
      const cost   = window.BalanceConfig?.pursuit?.cleanerCost ?? 2000;
      const reduce = window.BalanceConfig?.pursuit?.cleanerHeatReduce ?? 25;
      const gs     = GS();
      if (!gs) return { ok: false, message: 'GameState no disponible.' };
      if (!gs.spendMoney(cost)) {
        return { ok: false, message: `Fondos insuficientes. El limpiador cobra $${cost.toLocaleString('es-AR')} CR.` };
      }
      RS()?.reduceHeat(reduce, 'cleaner');
      if (window.LedgerSystem) LedgerSystem.onBuy(cost, 'Limpiador policial (-' + reduce + '% heat)');
      _notify('cleaner_hired', { cost, reduce });
      return { ok: true, message: `Limpiador contratado. -${reduce}% calor policial.` };
    },

    /**
     * Descripción de texto del nivel actual para la terminal.
     */
    getStatusText() {
      const heat  = _currentHeat();
      const level = _getLevel(heat);
      const trace = _traceActive
        ? ` [RASTREO ACTIVO — ${API.getTraceSeconds()}s restantes]`
        : '';
      return `${level.icon} ${level.name} (${heat}%)${trace}`;
    },
  };

  return API;
})();
