/**
 * missionEngine.js — Motor de Misiones Avanzado
 * AleXim Mobile — Hacking Narrative Game
 *
 * Genera misiones dinámicas según la reputación del jugador.
 * Incluye misiones trampa de la policía y decisiones morales.
 *
 * API:
 *   MissionEngine.getAvailable()          → mission[]
 *   MissionEngine.accept(missionId)        → { ok, mission }
 *   MissionEngine.complete(missionId)      → { ok, reward }
 *   MissionEngine.abandon(missionId)       → { ok }
 *   MissionEngine.getActive()             → mission[]
 *   MissionEngine.on(event, cb)
 */

window.MissionEngine = (() => {
  'use strict';

  let _available  = [];
  let _active     = [];
  let _completed  = [];
  let _listeners  = {};

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  // ─── Pool de misiones procedurales ────────────────────────────
  const MISSION_TEMPLATES = [

    // ── Tier 1 (rep 0+) ──────────────────────────────────────
    {
      id:       'tutorial_isp',
      tier:     1,
      title:    'Prueba de fuego',
      client:   'GhostMarket',
      clientIcon: '👤',
      isTrap:   false,
      desc:     'Nuevo en el negocio. Un contacto anónimo te pide que demuestres que podés hackear el servidor de un ISP y bajar logs de tráfico. Nada espectacular, solo para demostrar que servís.',
      objective:'Descargar logs_trafico_q2.tar del servidor TeleNet',
      targetIp: '190.210.100.3',
      targetFile:'logs_trafico_q2.tar',
      reward:    600,
      heatCost:  8,
      repGain:   12,
      morality:  'neutral',
      unlocks:   ['corp_leak_01','medical_theft_01'],
      minRep:    0,
    },

    // ── Tier 2 (rep 15+) ─────────────────────────────────────
    {
      id:       'corp_leak_01',
      tier:     2,
      title:    'Espionaje Corporativo — MegaCorp',
      client:   'NEXUS',
      clientIcon: '🔵',
      isTrap:   false,
      desc:     'MegaCorp Argentina ganó contratos del Estado mediante sobornos. Un cliente —que no quiere revelar su identidad— quiere los documentos internos. Paga bien y dice que es "por el bien del país". Vos decidís si le creés.',
      objective:'Descargar licitaciones_estado.pdf de MegaCorp',
      targetIp: '190.12.64.5',
      targetFile:'licitaciones_estado.pdf',
      reward:    1800,
      heatCost:  14,
      repGain:   20,
      morality:  'grey',   // puede ser hacktivismo o simplemente robo
      unlocks:   ['bank_job_01','gov_infiltration_01'],
      minRep:    15,
    },

    {
      id:       'medical_theft_01',
      tier:     2,
      title:    'Datos Médicos — CONICET',
      client:   'meddata_ar',
      clientIcon: '💊',
      isTrap:   false,
      desc:     'Un broker internacional quiere datos de investigación médica clasificada del CONICET. El material se venderá a laboratorios extranjeros. La operación es limpia, el dinero no. Implica robar datos de pacientes de ensayos clínicos.',
      objective:'Descargar genoma_proyecto_alpha.fasta de CONICET',
      targetIp: '186.19.200.44',
      targetFile:'genoma_proyecto_alpha.fasta',
      reward:    2400,
      heatCost:  18,
      repGain:   15,
      morality:  'dark',   // es éticamente cuestionable
      moralMessage: 'Pacientes de ensayos clínicos fueron expuestos sin consentimiento.',
      unlocks:   ['bank_job_01'],
      minRep:    15,
    },

    // ── Tier 3 (rep 35+) ─────────────────────────────────────
    {
      id:       'bank_job_01',
      tier:     3,
      title:    'El Banco — Nación Core',
      client:   'SHADOW',
      clientIcon: '⚫',
      isTrap:   false,
      desc:     'SHADOW quiere los registros de transacciones del Banco Nación. "Hay funcionarios lavando plata ahí adentro", dice. El material tiene valor político y criminal. La operación puede arruinar o salvar carreras políticas dependiendo de quién lo use.',
      objective:'Descargar transacciones_q3_2025.enc del Banco Nación',
      targetIp: '200.45.128.10',
      targetFile:'transacciones_q3_2025.enc',
      reward:    4200,
      heatCost:  28,
      repGain:   30,
      morality:  'grey',
      unlocks:   ['gov_classified_01'],
      minRep:    35,
    },

    {
      id:       'gov_infiltration_01',
      tier:     3,
      title:    'Infiltración Gubernamental',
      client:   'Contacto Anónimo',
      clientIcon: '❓',
      isTrap:   false,
      desc:     'Un informante dentro del Ministerio del Interior te contacta. Quiere que robes la agenda reservada del ministro para exponerla públicamente. Dice ser un periodista. Puede ser verdad. O puede ser un montaje.',
      objective:'Descargar agenda_reservada.dat del Ministerio del Interior',
      targetIp: '200.0.0.220',
      targetFile:'agenda_reservada.dat',
      reward:    3000,
      heatCost:  30,
      repGain:   25,
      morality:  'whistleblower',
      unlocks:   [],
      minRep:    35,
    },

    // ── Tier 4 (rep 60+) ─────────────────────────────────────
    {
      id:       'gov_classified_01',
      tier:     4,
      title:    'Protocolo Clasificado',
      client:   'SHADOW',
      clientIcon: '⚫',
      isTrap:   false,
      desc:     'SHADOW paga su mejor precio. Quiere el protocolo de ciberdefensa del estado. "Tenemos compradores en el extranjero." Sin preguntas. Sin moral. Solo la operación más peligrosa de tu carrera.',
      objective:'Descargar protocolo_ciberdefensa.pdf del Ministerio del Interior',
      targetIp: '200.0.0.220',
      targetFile:'protocolo_ciberdefensa.pdf',
      reward:    8000,
      heatCost:  45,
      repGain:   35,
      morality:  'dark',
      moralMessage: 'Vendiste información de seguridad nacional. La consecuencia puede ser catastrófica.',
      unlocks:   [],
      minRep:    60,
    },

    // ── MISIONES TRAMPA (la policía haciéndose pasar por cliente) ──
    {
      id:       'trap_01',
      tier:     2,
      title:    'Trabajo Urgente — Datos Financieros',
      client:   'broker_nuevo',
      clientIcon: '🔴',
      isTrap:   true,
      trapLevel: 1,
      desc:     'Un nuevo cliente te contacta. Dice ser broker_nuevo y ofrece buen dinero por datos financieros de una fintech. El pago es el doble del mercado. La urgencia parece extraña. Algo no cierra.',
      objective:'Descargar claves_swift.enc del Banco Nación',
      targetIp: '200.45.128.10',
      targetFile:'claves_swift.enc',
      reward:    0,    // jamás llega el pago
      heatCost:  0,    // el costo real es el trap penalty
      repGain:  -20,
      morality:  'trap',
      trapMessage: 'Era la UEC. Te tendieron una trampa. Tu calor policial explotó.',
      minRep:    10,
    },

    {
      id:       'trap_02',
      tier:     3,
      title:    'Filtración Política Urgente',
      client:   'periodista_independiente',
      clientIcon: '🔴',
      isTrap:   true,
      trapLevel: 2,
      desc:     'Un supuesto periodista independiente quiere documentos del gobierno "para publicar". Paga muy bien. La dirección de contacto tiene formato inusual. Los metadatos del mensaje son sospechosos.',
      objective:'Descargar informe_inteligencia.enc del Ministerio',
      targetIp: '200.0.0.220',
      targetFile:'informe_inteligencia.enc',
      reward:    0,
      heatCost:  0,
      repGain:  -30,
      morality:  'trap',
      trapMessage: 'Operativo policial encubierto. Grabaron toda la sesión. Tu trace level al máximo.',
      minRep:    30,
    },
  ];

  // ─── Detectar si una misión es trampa y disparar consecuencias ─
  function _activateTrap(mission) {
    const t = GameLoop?.getTerminal?.();
    if (t) {
      t.printBlank?.();
      t.printHTML?.(`<span style="color:var(--danger)">🚨 ${mission.trapMessage}</span>`);
    }
    if (window.UI) UI.notify(`🚨 TRAMPA POLICIAL: ${mission.trapMessage}`, 'error', 12000);
    if (window.ReputationSystem) {
      ReputationSystem.addHeat(50, 'trap_mission');
      ReputationSystem.addReputation(-20, 'trap_mission');
    }
    if (window.PursuitSystem) PursuitSystem.startTrace();
    if (window.AudioSystem) AudioSystem.busted();
    _notify('trap_triggered', { mission });
  }

  // ─── Recompensa con multiplicadores ───────────────────────────
  function _calcReward(mission) {
    const base     = mission.reward;
    const repBonus = window.ReputationSystem
      ? 1 + ReputationSystem.getReputation() / 200
      : 1;
    return Math.floor(base * repBonus);
  }

  // ─── Mensaje moral tras completar misión ──────────────────────
  function _showMoralConsequence(mission) {
    if (!mission.moralMessage) return;
    const t = GameLoop?.getTerminal?.();
    if (t) {
      t.printBlank?.();
      t.printHTML?.(`<span style="color:var(--danger)">⚠ CONSECUENCIA MORAL: ${mission.moralMessage}</span>`);
    }

    // Testimonio de víctima
    if (window.EventSystem) {
      // Mapear tipo de archivo a tipo de dato
      const fileToData = {
        'genoma_proyecto_alpha.fasta':   'medical_records',
        'transacciones_q3_2025.enc':    'financial_data',
        'clientes_2025.csv':            'customer_database',
        'protocolo_ciberdefensa.pdf':   'government_documents',
      };
      const dataType = fileToData[mission.targetFile];
      if (dataType) {
        const testimonial = EventSystem.getVictimTestimonial(dataType);
        if (testimonial && window.NewsSystem) {
          // Inyectar como noticia
          setTimeout(() => {
            const news = {
              id:      'victim_' + Date.now(),
              time:    new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
              tag:     'VICTIMAS',
              title:   '😢 Víctimas del hackeo hablan: "Nos destruyeron la vida"',
              body:    testimonial,
              dynamic: true,
              read:    false,
              ts:      Date.now(),
            };
            NewsSystem._injectNews?.(news);
          }, 20000);
        }
      }
    }

    // Karma
    if (window.KarmaSystem && mission.morality === 'dark') {
      KarmaSystem.recordAction('MASS_SURVEILLANCE_THEFT', { mission: mission.id });
    }
  }

  // ─── Generar pool disponible según reputación ─────────────────
  function _refreshAvailable() {
    const rep = window.ReputationSystem?.getReputation?.() ?? 0;
    const sendTrap = window.ReputationSystem?.shouldSendTrap?.() ?? false;

    _available = MISSION_TEMPLATES
      .filter(m => {
        if (m.minRep > rep) return false;
        if (m.isTrap && !sendTrap) return false;
        if (_completed.includes(m.id)) return false;
        if (_active.find(a => a.id === m.id)) return false;
        return true;
      })
      .map(m => ({ ...m }));
  }

  // ─── API pública ───────────────────────────────────────────────
  const API = {

    on(ev, cb) { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); },

    init() {
      _refreshAvailable();
      // Refrescar disponibles cada 5 min
      setInterval(_refreshAvailable, 300000);

      // Enviar misiones como mensajes vía DarkMarket
      setInterval(() => {
        _refreshAvailable();
        const available = _available.filter(m => !m._messageSent);
        if (available.length > 0 && window.DarkMarketSystem) {
          const m = available[Math.floor(Math.random() * available.length)];
          m._messageSent = true;

          const isTrap = m.isTrap;
          const body = [
            `${isTrap ? '⚠️' : '📋'} Trabajo disponible`,
            `─────────────────────`,
            `Título: ${m.title}`,
            `Cliente: ${m.clientIcon} ${m.client}`,
            `Pago: $${m.reward.toLocaleString('es-AR')} CR`,
            ``,
            m.desc,
            ``,
            `Objetivo: ${m.objective}`,
            `Calor estimado: +${m.heatCost}%`,
            ``,
            `→ Usá:  accept-mission ${m.id}   para aceptar`,
            `→ Usá:  reject-mission ${m.id}   para rechazar`,
          ].join('\n');

          window.dispatchEvent(new CustomEvent('darkmarket-message', {
            detail: {
              id:         'mission_msg_' + m.id,
              from:       m.client,
              subject:    m.title,
              body,
              type:       isTrap ? 'offer' : 'mission',
              missionId:  m.id,
              read:       false,
              receivedAt: Date.now(),
            }
          }));
        }
      }, 180000 + Math.random() * 120000);  // cada 3-5 min

      console.log('[MissionEngine] Inicializado.');
    },

    getAvailable()     { _refreshAvailable(); return [..._available]; },
    getActive()        { return [..._active]; },
    getCompleted()     { return [..._completed]; },

    accept(missionId) {
      _refreshAvailable();
      const mission = _available.find(m => m.id === missionId);
      if (!mission) return { ok: false, message: `Misión ${missionId} no disponible.` };

      // Trampa: se activa al aceptar
      if (mission.isTrap) {
        _activateTrap(mission);
        return { ok: false, message: 'Era una trampa. Ver terminal.' };
      }

      _active.push({ ...mission, acceptedAt: Date.now() });
      _available = _available.filter(m => m.id !== missionId);

      _notify('accepted', mission);
      return { ok: true, mission };
    },

    /**
     * Intentar completar una misión según el archivo descargado.
     * Llamado automáticamente por network.js download().
     */
    checkDownloadCompletes(ip, filename) {
      _active.forEach(m => {
        if (m.targetIp === ip && m.targetFile === filename) {
          API.complete(m.id);
        }
      });
    },

    complete(missionId) {
      const mission = _active.find(m => m.id === missionId);
      if (!mission) return { ok: false };

      const reward = _calcReward(mission);
      _active      = _active.filter(m => m.id !== missionId);
      _completed.push(missionId);

      // Acreditar recompensa
      if (typeof GameState !== 'undefined' && reward > 0) {
        GameState.addMoney(reward);
        // Registrar en LedgerSystem (MP Wallet)
        if (window.LedgerSystem) {
          LedgerSystem.onMissionReward(reward, mission.title);
        }
      }
      if (window.ReputationSystem && mission.repGain > 0) {
        ReputationSystem.addReputation(mission.repGain, `mission_${missionId}`);
      }

      // Desbloquear siguientes misiones
      _refreshAvailable();

      // Consecuencias morales
      _showMoralConsequence(mission);

      _notify('completed', { mission, reward });

      if (window.UI) {
        UI.notify(`✓ MISIÓN COMPLETADA: ${mission.title} (+$${reward.toLocaleString('es-AR')} CR)`, 'success', 8000);
      }

      const t = GameLoop?.getTerminal?.();
      if (t) {
        t.printBlank?.();
        t.printHTML?.(`<span style="color:var(--accent)">╔═══════════════════════════════════╗</span>`);
        t.printHTML?.(`<span style="color:var(--accent)">║  ✓ MISIÓN COMPLETADA              ║</span>`);
        t.printHTML?.(`<span style="color:var(--accent)">║  ${mission.title.padEnd(33)}║</span>`);
        t.printHTML?.(`<span style="color:var(--accent)">║  Recompensa: +$${String(reward.toLocaleString('es-AR') + ' CR').padEnd(17)}║</span>`);
        t.printHTML?.(`<span style="color:var(--accent)">╚═══════════════════════════════════╝</span>`);
        t.printBlank?.();
      }

      return { ok: true, reward, mission };
    },

    abandon(missionId) {
      const mission = _active.find(m => m.id === missionId);
      if (!mission) return { ok: false };
      _active = _active.filter(m => m.id !== missionId);
      if (window.ReputationSystem) ReputationSystem.addReputation(-5, `abandon_${missionId}`);
      _notify('abandoned', mission);
      return { ok: true };
    },

    reject(missionId) {
      _available = _available.filter(m => m.id !== missionId);
      return { ok: true };
    },
  };

  return API;
})();
