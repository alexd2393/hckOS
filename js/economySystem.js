/**
 * economySystem.js — Economía Dinámica del DarkMarket
 * AleXim Mobile — Hacking Narrative Game
 *
 * Los precios del mercado negro fluctúan según:
 *   - Saturación: muchos ítems del mismo tipo → precio baja
 *   - Eventos del mundo: crisis, escándalos → precio sube/baja
 *   - Demanda activa: compradores buscando cierto tipo → precio sube
 *   - Reputación del vendedor
 *
 * API:
 *   EconomySystem.getMultiplier(dataType)  → number (0.3 – 3.0)
 *   EconomySystem.recordSale(dataType)     → void
 *   EconomySystem.triggerEvent(eventId)    → void
 *   EconomySystem.getMarketStatus()        → { type, mult, trend }[]
 *   EconomySystem.getActiveDemand()        → demand[] | null
 *   EconomySystem.on(event, cb)
 */

window.EconomySystem = (() => {
  'use strict';

  // ─── Historial de ventas por tipo ─────────────────────────────
  let _salesHistory = {};          // { dataType: count }
  let _eventMults   = {};          // { dataType: multiplier }
  let _activeDemands = [];         // [{ dataType, bonus, expiresAt, label }]
  let _listeners    = {};

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  // ─── Eventos económicos programables ──────────────────────────
  const ECONOMIC_EVENTS = {
    financial_crisis: {
      label: '💸 Crisis Financiera Argentina',
      desc:  'Colapso bancario genera demanda masiva de datos financieros en el mercado negro.',
      effects: { financial_data: 2.2, crypto_wallet_data: 1.8, customer_database: 0.7 },
      durationMs: 600000,  // 10 min
    },
    political_scandal: {
      label: '📋 Escándalo Político',
      desc:  'Filtración de documentos estatales cotiza muy alto en el underground.',
      effects: { government_documents: 2.5, emails: 1.6, customer_database: 0.8 },
      durationMs: 480000,
    },
    health_crisis: {
      label: '🏥 Alerta Sanitaria Nacional',
      desc:  'Historial médico de pacientes cotiza en alza en mercados internacionales.',
      effects: { medical_records: 2.8, customer_database: 1.3, financial_data: 0.9 },
      durationMs: 540000,
    },
    tech_boom: {
      label: '💻 Boom Tecnológico',
      desc:  'Startups paganmucho por credenciales y datos de clientes de la competencia.',
      effects: { credentials: 1.9, customer_database: 1.7, research_data: 2.0, emails: 1.4 },
      durationMs: 420000,
    },
    election_season: {
      label: '🗳️ Temporada Electoral',
      desc:  'Partidos políticos compran datos de votantes. Documentos gubernamentales al máximo.',
      effects: { government_documents: 3.0, customer_database: 2.1, emails: 1.8 },
      durationMs: 720000,
    },
    crypto_crash: {
      label: '📉 Crash de Criptomonedas',
      desc:  'Wallets cripto perdieron valor. Compradores pagan más por otros datos.',
      effects: { crypto_wallet_data: 0.3, financial_data: 1.5, credentials: 1.6 },
      durationMs: 360000,
    },
    vpn_crackdown: {
      label: '🔒 Operativo Anti-Privacidad',
      desc:  'El gobierno bloquea VPNs. Logs de red y credenciales en alta demanda.',
      effects: { network_logs: 2.5, credentials: 1.8, government_documents: 1.4 },
      durationMs: 300000,
    },
    kirchner_corruption: {
      label: '⚖️ Juicio Cristina Kirchner — Vialidad',
      desc:  'El caso de corrupción en la obra pública dispara demanda de documentos gubernamentales.',
      effects: { government_documents: 3.5, emails: 2.2, financial_data: 1.7 },
      durationMs: 900000,  // 15 min
    },
  };

  // ─── Demandas activas (buscadas por compradores específicos) ──
  const DEMAND_POOL = [
    { dataType: 'financial_data',       bonus: 0.30, label: '📈 Alta demanda: datos financieros — broker_17 paga +30%' },
    { dataType: 'credentials',          bonus: 0.40, label: '🔑 Urgente: credenciales corporativas — bonus +40%' },
    { dataType: 'medical_records',      bonus: 0.35, label: '💊 Demanda especial: historiales médicos — +35%' },
    { dataType: 'government_documents', bonus: 0.50, label: '📋 Exclusivo: documentos gubernamentales — +50%' },
    { dataType: 'customer_database',    bonus: 0.25, label: '📊 Buscado: bases de clientes — dark_analytics paga +25%' },
    { dataType: 'emails',               bonus: 0.30, label: '📧 Correos corporativos en demanda — +30%' },
    { dataType: 'crypto_wallet_data',   bonus: 0.45, label: '💰 Wallets cripto: compradores urgentes — +45%' },
    { dataType: 'research_data',        bonus: 0.35, label: '🔬 Investigación científica buscada — +35%' },
  ];

  // ─── Disparar una demanda aleatoria ───────────────────────────
  function _spawnDemand() {
    const duration = 180000 + Math.random() * 300000;  // 3–8 min
    const d = DEMAND_POOL[Math.floor(Math.random() * DEMAND_POOL.length)];
    const active = {
      ...d,
      expiresAt: Date.now() + duration,
      id: 'dem_' + Date.now(),
    };
    _activeDemands.push(active);

    _notify('demand_active', active);
    if (window.UI) UI.notify(active.label, 'warning', 10000);
    if (window.GameLoop) {
      const t = GameLoop.getTerminal?.();
      if (t) {
        t.printBlank?.();
        t.printHTML?.(`<span style="color:var(--warn)">📢 MERCADO: ${active.label}</span>`);
      }
    }

    // Auto-expirar
    setTimeout(() => {
      _activeDemands = _activeDemands.filter(x => x.id !== active.id);
      _notify('demand_expired', active);
    }, duration);
  }

  // ─── Saturación de mercado ────────────────────────────────────
  function _saturationMult(dataType) {
    const bc    = window.BalanceConfig?.market ?? {};
    const count = _salesHistory[dataType] ?? 0;
    const thr   = bc.saturationThreshold ?? 3;
    const pen   = bc.saturationPenalty   ?? 0.15;
    if (count <= thr) return 1.0;
    const excess = count - thr;
    return Math.max(0.30, 1.0 - excess * pen);
  }

  // ─── API pública ───────────────────────────────────────────────
  const API = {

    on(ev, cb) { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); },

    init() {
      // Spawn demanda aleatoria cada 4-10 min
      const _scheduleDemand = () => {
        const delay = 240000 + Math.random() * 360000;
        setTimeout(() => { _spawnDemand(); _scheduleDemand(); }, delay);
      };
      _scheduleDemand();

      // Evento económico aleatorio cada 8-20 min
      const _scheduleEvent = () => {
        const delay = 480000 + Math.random() * 720000;
        setTimeout(() => {
          const keys = Object.keys(ECONOMIC_EVENTS);
          const key  = keys[Math.floor(Math.random() * keys.length)];
          API.triggerEvent(key);
          _scheduleEvent();
        }, delay);
      };
      _scheduleEvent();

      console.log('[EconomySystem] Inicializado.');
    },

    /**
     * Obtiene el multiplicador final de precio para un tipo de dato.
     * Combina: saturación + eventos activos + demandas activas.
     */
    getMultiplier(dataType) {
      const satMult    = _saturationMult(dataType);
      const eventMult  = _eventMults[dataType] ?? 1.0;
      const now        = Date.now();
      const demandBonus = _activeDemands
        .filter(d => d.dataType === dataType && d.expiresAt > now)
        .reduce((sum, d) => sum + d.bonus, 0);

      return satMult * eventMult * (1 + demandBonus);
    },

    /**
     * Registrar una venta completada (para la saturación del mercado).
     */
    recordSale(dataType) {
      _salesHistory[dataType] = (_salesHistory[dataType] ?? 0) + 1;
      _notify('sale_recorded', { dataType, count: _salesHistory[dataType] });

      // Si hay muchas ventas del mismo tipo, notificar caída de precio
      const bc  = window.BalanceConfig?.market ?? {};
      const cnt = _salesHistory[dataType];
      if (cnt === (bc.saturationThreshold ?? 3) + 1) {
        if (window.UI) UI.notify(`📉 Mercado saturado: ${dataType.replace(/_/g,' ')} — precio en baja`, 'warning', 6000);
        if (window.GameLoop) {
          const t = GameLoop.getTerminal?.();
          if (t) t.printHTML?.(`<span style="color:var(--warn)">📉 Saturación del mercado: precio de "${dataType.replace(/_/g,' ')}" cayó.</span>`);
        }
      }
    },

    /**
     * Disparar un evento económico específico por ID.
     */
    triggerEvent(eventId) {
      const ev = ECONOMIC_EVENTS[eventId];
      if (!ev) return false;

      // Aplicar multiplicadores
      Object.entries(ev.effects).forEach(([type, mult]) => {
        _eventMults[type] = mult;
      });

      _notify('event_triggered', { eventId, event: ev });

      // Notificar
      if (window.UI) UI.notify(`🌐 ${ev.label}: ${ev.desc.slice(0, 80)}`, 'warning', 12000);
      if (window.GameLoop) {
        const t = GameLoop.getTerminal?.();
        if (t) {
          t.printBlank?.();
          t.printHTML?.(`<span style="color:var(--warn)">🌐 EVENTO ECONÓMICO: ${ev.label}</span>`);
          t.printHTML?.(`<span style="color:var(--text-muted)">${ev.desc}</span>`);
        }
      }

      // NewsSystem
      if (window.NewsSystem) {
        NewsSystem.reportPlayerAction('ECONOMIC_EVENT', { target: ev.label, sensitivity: 7 });
      }

      // Revertir después de la duración
      setTimeout(() => {
        Object.keys(ev.effects).forEach(type => { delete _eventMults[type]; });
        _notify('event_expired', { eventId });
        if (window.UI) UI.notify(`📊 Evento terminado: ${ev.label}`, 'info', 4000);
      }, ev.durationMs);

      return true;
    },

    /**
     * Estado del mercado para mostrar en UI.
     */
    getMarketStatus() {
      const types = [
        'financial_data','customer_database','medical_records','emails',
        'government_documents','credentials','crypto_wallet_data','research_data',
      ];
      return types.map(type => {
        const mult  = API.getMultiplier(type);
        const trend = mult > 1.3 ? '↑↑' : mult > 1.05 ? '↑' : mult < 0.7 ? '↓↓' : mult < 0.95 ? '↓' : '→';
        return { type, mult: Math.round(mult * 100), trend };
      });
    },

    getActiveDemand() {
      const now = Date.now();
      return _activeDemands.filter(d => d.expiresAt > now);
    },

    getEventCatalog() { return ECONOMIC_EVENTS; },
  };

  return API;
})();
