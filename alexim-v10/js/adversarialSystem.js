/**
 * adversarialSystem.js — Sistema de Agentes Adversariales
 * AleXim OS v8 — Enemies that fight back
 *
 * Tres clases de enemigos IA que reaccionan a las acciones del jugador:
 *
 *  1. UEC (Unidad Especial de Cibercrimen) — Policía digital
 *     Activa rastreo, planta honeypots, te contraataca cuando el heat es alto.
 *
 *  2. Hackers Rivales — Competidores del underground
 *     Comprometen nodos antes que vos, roban del DarkMarket, interfieren misiones.
 *
 *  3. IDS (Intrusion Detection System) — Defensas activas de nodos Sec 4-5
 *     Contraataca cuando detecta un breach. Puede bloquearte el nodo temporalmente.
 *
 * API pública:
 *   AdversarialSystem.init()
 *   AdversarialSystem.getAgents()          → Agent[]
 *   AdversarialSystem.getActive()          → Agent[]   (state !== 'idle')
 *   AdversarialSystem.getLog()             → LogEntry[]
 *   AdversarialSystem.on(event, cb)
 *   AdversarialSystem.isHoneypot(ip)       → boolean
 *   AdversarialSystem.getRivalStatus()     → { compromisedByRival: string[] }
 */

window.AdversarialSystem = (() => {
  'use strict';

  // ─── Estado interno ────────────────────────────────────────────
  let _agents      = [];
  let _log         = [];          // historial de acciones enemigas
  let _honeypots   = new Set();   // IPs de nodos trampa
  let _rivalNodes  = new Set();   // IPs comprometidos por rivales
  let _listeners   = {};
  let _initialized = false;
  let _tickInterval = null;

  // ─── Helpers ───────────────────────────────────────────────────
  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }
  function _rnd(a, b)  { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function _pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
  function _heat()     { return window.ReputationSystem?.getHeat?.() ?? 0; }
  function _money()    { return typeof GameState !== 'undefined' ? GameState.getMoney() : 0; }

  function _log_entry(agentId, action, description, severity = 'normal') {
    const entry = { ts: Date.now(), agentId, action, description, severity, read: false };
    _log.unshift(entry);
    if (_log.length > 80) _log.pop();
    _notify('log', entry);
    return entry;
  }

  // ─── Definición de agentes ─────────────────────────────────────

  const AGENT_CATALOG = {

    // ── UEC — Unidad Especial de Cibercrimen ─────────────────────
    uec_rivas: {
      id:          'uec_rivas',
      type:        'police',
      name:        'Agente Rivas',
      handle:      'UEC-AR-07',
      icon:        '👮',
      level:       3,
      heatThreshold: 55,
      portrait:    'Detective de la UEC. Especialista en rastreo de tráfico cifrado. Fue hacker antes de entrar al Estado.',
      actions:     ['trace', 'honeypot', 'freeze_node', 'leak_identity'],
      state:       'idle',
      cooldown:    0,
    },

    uec_mendez: {
      id:          'uec_mendez',
      type:        'police',
      name:        'Lic. Méndez',
      handle:      'UEC-AR-12',
      icon:        '🕵️',
      level:       4,
      heatThreshold: 72,
      portrait:    'Analista forense digital. Solo se activa en casos de alta prioridad. Muy difícil de evadir.',
      actions:     ['trace', 'counter_breach', 'steal_inventory', 'publish_alert'],
      state:       'idle',
      cooldown:    0,
    },

    // ── Hackers Rivales ──────────────────────────────────────────
    rival_phantom: {
      id:          'rival_phantom',
      type:        'rival',
      name:        'phantom_ba',
      handle:      '@phantom_ba',
      icon:        '💀',
      level:       2,
      heatThreshold: 0,   // siempre activo
      portrait:    'Hacker oportunista de Buenos Aires. Escanea los mismos nodos que vos. Compite por el mercado.',
      actions:     ['compromise_node', 'undercut_market', 'steal_loot'],
      state:       'scanning',
      cooldown:    0,
    },

    rival_zerox: {
      id:          'rival_zerox',
      type:        'rival',
      name:        'z3r0x_ar',
      handle:      '@z3r0x_ar',
      icon:        '🐉',
      level:       4,
      heatThreshold: 0,
      portrait:    'Operador elite. Trabaja para clientes anónimos. Si hackea un nodo antes que vos, cobra el triple.',
      actions:     ['compromise_node', 'deny_access', 'taunt'],
      state:       'scanning',
      cooldown:    0,
    },

    // ── IDS — Sistemas de Defensa Activa ────────────────────────
    ids_bancario: {
      id:          'ids_bancario',
      type:        'ids',
      name:        'BankShield IDS v4.2',
      handle:      'IDS-BANK',
      icon:        '🛡',
      level:       4,
      heatThreshold: 0,
      portrait:    'Sistema de detección de intrusiones del sector bancario. Se activa automáticamente ante cualquier breach.',
      actions:     ['counter_breach', 'lock_node', 'trace'],
      state:       'passive',
      targetOrgTypes: ['bank'],
      cooldown:    0,
    },

    ids_gobierno: {
      id:          'ids_gobierno',
      type:        'ids',
      name:        'SIGEN-CyberDef',
      handle:      'IDS-GOV',
      icon:        '🏛',
      level:       5,
      heatThreshold: 0,
      portrait:    'Defensa cibernética del Estado argentino. El más agresivo. Hackear gobierno activa respuesta inmediata.',
      actions:     ['counter_breach', 'lock_node', 'trace', 'publish_alert'],
      state:       'passive',
      targetOrgTypes: ['government'],
      cooldown:    0,
    },
  };

  // ─── Plantillas de mensajes por acción ────────────────────────
  const ACTION_MESSAGES = {

    trace: [
      '{name} inició rastreo de paquetes desde {ip}. Tenés 2 minutos para desconectar.',
      '{name} detectó tu firma de red. Trace activo.',
      'UEC trazó tu último nodo comprometido. {name} está en camino.',
    ],

    honeypot: [
      '{name} desplegó un nodo trampa en la red. Cuidado con IPs desconocidas.',
      'Señal de honeypot detectada. {name} está cazando operadores imprudentes.',
      'La UEC plantó un servidor cebo en el segmento {ip}. No conectes sin scanear.',
    ],

    freeze_node: [
      '{name} congeló acceso al nodo {target}. No podés descargarte nada por 3 minutos.',
      'El nodo {target} fue aislado remotamente por {name}. Buscá otro objetivo.',
    ],

    counter_breach: [
      '⚔ {name} intentó acceder a tu sistema. Ataque rechazado, pero heat +{n}%.',
      '{name} contraatacó. Detectaron tu IP real. Heat subiendo.',
      'IDS activo: {name} lanzó exploit de rastreo contra tu sesión.',
    ],

    steal_inventory: [
      '⚠ Durante el operativo, {name} comprometió {count} archivo(s) de tu inventario.',
      '{name} usó el bust para confiscar datos. Perdiste {count} loot(s).',
    ],

    leak_identity: [
      '🔴 {name} filtró tu alias "{alias}" al foro policial. Esperá más agentes.',
      'Tu identidad fue expuesta por {name}. Nuevos agentes en lista de targets.',
    ],

    publish_alert: [
      '📢 {name} publicó una alerta pública sobre tus operaciones. Heat global +10%.',
      'La UEC emitió boletín de búsqueda. Tu reputación en el foro cae -15 pts.',
    ],

    compromise_node: [
      '💀 {name} comprometió {target} antes que vos. Los archivos ya no están.',
      '🐉 {name} hackeó {target}. Si querés los datos, vas a tener que negociar.',
    ],

    undercut_market: [
      '{name} inundó el mercado con {dtype}. Precio cayó 30% por saturación.',
      'Rival vendió bulk de {dtype}. EconomySystem registra saturación máxima.',
    ],

    deny_access: [
      '{name} cambió las credenciales de {target}. Tu breach expiró.',
      'El nodo {target} fue re-asegurado por {name}. Tenés que hacer breach de nuevo.',
    ],

    taunt: [
      '[DarkForum] @{handle}: "Alguien anda lento hoy. Me llevé todo de {target} 😂"',
      '[DarkForum] @{handle}: "Gracias por escanear el camino. El resto lo hice yo."',
      '[NodoSocial] @{handle}: "Otro día, otra cuenta bancaria vaciada antes que nadie."',
    ],

    lock_node: [
      '🛡 {name} bloqueó tu acceso al nodo {target}. Cooldown 4 minutos.',
      'IDS detectó intrusión y selló el nodo. Breach inválido. Perdiste el acceso.',
    ],

    steal_loot: [
      '{name} robó {count} archivo(s) de tu inventario aprovechando la distracción.',
    ],
  };

  function _fillMsg(template, ctx) {
    return template
      .replace('{name}',   ctx.agentName ?? 'Agente desconocido')
      .replace('{handle}', ctx.agentHandle ?? '???')
      .replace('{ip}',     ctx.ip ?? 'x.x.x.x')
      .replace('{target}', ctx.target ?? 'nodo desconocido')
      .replace('{n}',      ctx.n ?? '8')
      .replace('{count}',  ctx.count ?? '1')
      .replace('{alias}',  ctx.alias ?? 'ghost_0x1')
      .replace('{dtype}',  ctx.dtype ?? 'datos');
  }

  // ─── Acciones individuales ─────────────────────────────────────

  const ACTION_HANDLERS = {

    // UEC: activa trace policial
    trace(agent) {
      if (window.PursuitSystem?.isTraceActive?.()) return; // ya hay trace
      const msg = _fillMsg(_pick(ACTION_MESSAGES.trace), { agentName: agent.name, ip: '200.45.x.x' });
      _log_entry(agent.id, 'trace', msg, 'critical');
      _termPrint(`<span style="color:var(--danger)">👮 [${agent.name}] ${_escT(msg)}</span>`);
      AudioSystem?.warning?.();
      if (typeof UI !== 'undefined') UI.notify(`👮 ${agent.name}: Trace iniciado`, 'error', 8000);
      // Activar trace vía PursuitSystem con un pequeño delay narrativo
      setTimeout(() => {
        window.PursuitSystem?.startTrace?.();
      }, 3000 + _rnd(0, 5000));
    },

    // UEC: despliega honeypot (nodo trampa)
    honeypot(agent) {
      const honeypotIp = `10.${_rnd(0,254)}.${_rnd(0,254)}.${_rnd(1,250)}`;
      const honeypotNode = {
        ip:       honeypotIp,
        hostname: `srv-${_rnd(100,999)}.red-interna.ar`,
        type:     'HONEYPOT',
        security: 1,
        org:      'Red Interna',
        files: [
          { name: 'datos_bancarios_2025.csv', size: '2.1 MB', dataType: 'financial_data', sensitivity: 9, locked: false, reward: 0, _isHoneypot: true },
          { name: 'credenciales_empleados.db', size: '800 KB', dataType: 'credentials',    sensitivity: 8, locked: false, reward: 0, _isHoneypot: true },
        ],
        _isHoneypot: true,
        _agentId:    agent.id,
      };
      _honeypots.add(honeypotIp);
      window.NetworkSystem?.addNodes?.([honeypotNode]);
      const msg = _fillMsg(_pick(ACTION_MESSAGES.honeypot), { agentName: agent.name, ip: honeypotIp });
      _log_entry(agent.id, 'honeypot', msg, 'warning');
      // Aviso sutil — no revelar que es trampa
      _termPrint(`<span style="color:var(--text-dim)">🔎 [SCAN] Nuevo nodo detectado en la red: ${honeypotIp}</span>`);
      if (typeof UI !== 'undefined') UI.notify(`🔎 Nuevo nodo en la red: ${honeypotIp}`, 'info', 5000);
    },

    // UEC/IDS: bloquea el nodo actual temporalmente
    freeze_node(agent) {
      const node = window.NetworkSystem?.getCurrentNode?.();
      if (!node) return;
      const msg = _fillMsg(_pick(ACTION_MESSAGES.freeze_node), { agentName: agent.name, target: node.hostname });
      _log_entry(agent.id, 'freeze_node', msg, 'critical');
      _termPrint(`<span style="color:var(--danger)">🧊 [${agent.name}] ${_escT(msg)}</span>`);
      AudioSystem?.error?.();
      // Congelar acceso: desconectar al jugador y bloquear el nodo por N min
      window.NetworkSystem?.disconnect?.();
      _termPrint(`<span style="color:var(--warn)">Desconectado forzosamente. Cooldown en ${node.hostname}: 3 minutos.</span>`);
      // Marcar como congelado
      node._frozenUntil = Date.now() + 3 * 60 * 1000;
      if (typeof UI !== 'undefined') UI.notify(`🧊 Nodo bloqueado por ${agent.name}`, 'error', 8000);
    },

    // UEC contraataca tu sesión
    counter_breach(agent) {
      const heatHit = agent.level * 5 + _rnd(3, 8);
      const msg     = _fillMsg(_pick(ACTION_MESSAGES.counter_breach), { agentName: agent.name, n: heatHit });
      _log_entry(agent.id, 'counter_breach', msg, 'critical');
      _termPrint(`<span style="color:var(--danger)">⚔ [${agent.name}] CONTRAATAQUE — ${_escT(msg)}</span>`);
      AudioSystem?.busted?.();
      window.ReputationSystem?.addHeat?.(heatHit, 'counter_breach');
      if (typeof UI !== 'undefined') UI.notify(`⚔ Contraataque de ${agent.name} — Heat +${heatHit}%`, 'error', 9000);
    },

    // UEC confisca parte del inventario en bust
    steal_inventory(agent) {
      const inv = window.InventorySystem?.getInventory?.() ?? [];
      const unlisted = inv.filter(i => !i.listedForSale && !i.sold);
      if (unlisted.length === 0) return;
      const toSteal = unlisted.slice(0, Math.min(2, unlisted.length));
      toSteal.forEach(item => window.InventorySystem?.removeItem?.(item.id));
      const msg = _fillMsg(_pick(ACTION_MESSAGES.steal_inventory), { agentName: agent.name, count: toSteal.length });
      _log_entry(agent.id, 'steal_inventory', msg, 'critical');
      _termPrint(`<span style="color:var(--danger)">🚔 [${agent.name}] ${_escT(msg)}</span>`);
      window.LedgerSystem?.onPenalty?.(0, `Confiscación UEC: ${toSteal.length} archivo(s)`);
    },

    // UEC publica tu alias
    leak_identity(agent) {
      const alias = typeof GameState !== 'undefined' ? GameState.getAlias() : 'ghost_0x1';
      const msg   = _fillMsg(_pick(ACTION_MESSAGES.leak_identity), { agentName: agent.name, alias });
      _log_entry(agent.id, 'leak_identity', msg, 'critical');
      _termPrint(`<span style="color:var(--danger)">🔴 [${agent.name}] ${_escT(msg)}</span>`);
      AudioSystem?.busted?.();
      // Sube el threshold de otros agentes — más fácil que te encuentren
      _agents.forEach(a => { if (a.type === 'police') a.heatThreshold = Math.max(a.heatThreshold - 10, 30); });
      if (typeof UI !== 'undefined') UI.notify(`🔴 Tu alias fue filtrado por ${agent.name}`, 'error', 10000);
      window.ReputationSystem?.addHeat?.(8, 'identity_leaked');
      // Publicar en NodoSocial
      if (window.SocialContentGenerator) {
        SocialContentGenerator.injectPost?.(null, `ALERTA UEC: Operador identificado como "${alias}" activo en la región. Denuncias al 0800-CYBER-AR.`, 'cop');
      }
    },

    // UEC publica alerta pública
    publish_alert(agent) {
      const msg = _fillMsg(_pick(ACTION_MESSAGES.publish_alert), { agentName: agent.name });
      _log_entry(agent.id, 'publish_alert', msg, 'warning');
      _termPrint(`<span style="color:var(--warn)">📢 [${agent.name}] ${_escT(msg)}</span>`);
      window.ReputationSystem?.addHeat?.(10, 'public_alert');
      window.ReputationSystem?.addReputation?.(-15, 'public_alert_penalty');
      if (window.NewsSystem) {
        NewsSystem._injectNews?.({ id: 'adv_alert_'+Date.now(), time: _timeNow(), tag: 'BREACH',
          title: `🚨 La UEC emitió alerta por operador activo en Argentina`,
          body:  `La Unidad Especial de Cibercrimen informó sobre un operador de alto nivel comprometiendo infraestructura crítica. Se solicita colaboración ciudadana.`,
          dynamic: true, read: false, ts: Date.now() });
      }
    },

    // RIVAL: compromete un nodo antes que el jugador
    compromise_node(agent) {
      const NS    = window.NetworkSystem;
      if (!NS) return;
      const nodes = NS.getKnownNodes().filter(n =>
        !NS.isBreached(n.ip) &&
        !_honeypots.has(n.ip) &&
        !_rivalNodes.has(n.ip) &&
        n.security <= agent.level
      );
      if (nodes.length === 0) return;
      const target = _pick(nodes);
      _rivalNodes.add(target.ip);
      target._compromisedByRival = agent.id;
      // Vaciar archivos del nodo — el rival se los llevó
      if (target.files) target.files = target.files.map(f => ({ ...f, _stolenByRival: true, size: '0 B' }));
      const msg = _fillMsg(_pick(ACTION_MESSAGES.compromise_node), { agentName: agent.name, target: target.hostname });
      _log_entry(agent.id, 'compromise_node', msg, 'warning');
      _termPrint(`<span style="color:var(--warn)">💀 [${agent.handle}] ${_escT(msg)}</span>`);
      AudioSystem?.warning?.();
      if (typeof UI !== 'undefined') UI.notify(`💀 ${agent.name} comprometió ${target.hostname} primero`, 'warning', 7000);
      // Comentar en DarkForum
      if (window.DarkForumSystem) {
        DarkForumSystem.addReply?.('static_1', _fillMsg(_pick(ACTION_MESSAGES.taunt), { handle: agent.name, target: target.hostname }));
      }
    },

    // RIVAL: satura el mercado
    undercut_market(agent) {
      const types  = ['customer_database','credentials','financial_data','emails','network_logs'];
      const dtype  = _pick(types);
      const msg    = _fillMsg(_pick(ACTION_MESSAGES.undercut_market), { agentName: agent.name, dtype });
      _log_entry(agent.id, 'undercut_market', msg, 'normal');
      window.EconomySystem?.recordSale?.(dtype);
      window.EconomySystem?.recordSale?.(dtype);  // satura x2
      _termPrint(`<span style="color:var(--text-muted)">📉 [${agent.handle}] ${_escT(msg)}</span>`);
    },

    // RIVAL: revoca breach (re-asegura el nodo)
    deny_access(agent) {
      const NS = window.NetworkSystem;
      if (!NS) return;
      const breached = NS.getKnownNodes().filter(n => NS.isBreached(n.ip) && n.security <= agent.level - 1);
      if (breached.length === 0) return;
      const target = _pick(breached);
      NS._restoreBreached?.(target.ip);
      const msg = _fillMsg(_pick(ACTION_MESSAGES.deny_access), { agentName: agent.name, target: target.hostname });
      _log_entry(agent.id, 'deny_access', msg, 'warning');
      _termPrint(`<span style="color:var(--warn)">🔒 [${agent.handle}] ${_escT(msg)}</span>`);
      if (typeof UI !== 'undefined') UI.notify(`🔒 ${agent.name} revocó tu breach en ${target.hostname}`, 'warning', 6000);
    },

    // RIVAL: taunt en foro/red social
    taunt(agent) {
      const NS = window.NetworkSystem;
      const node = _pick(NS?.getKnownNodes?.() ?? [{ hostname: 'srv-desconocido' }]);
      const msg  = _fillMsg(_pick(ACTION_MESSAGES.taunt), { handle: agent.name, target: node?.hostname ?? 'un nodo' });
      _log_entry(agent.id, 'taunt', msg, 'normal');
      _termPrint(`<span style="color:var(--text-dim)">💬 ${_escT(msg)}</span>`);
      if (window.DarkForumSystem) DarkForumSystem.injectHackEvent?.(node ?? { hostname: 'srv-desconocido', type: 'CORPORATE' });
    },

    // IDS: bloquea el nodo hackeado
    lock_node(agent) {
      const NS = window.NetworkSystem;
      const node = NS?.getCurrentNode?.();
      if (!node) return;
      // Comprobar que el IDS aplica a este tipo de nodo
      if (agent.targetOrgTypes && !agent.targetOrgTypes.some(t => node.type?.toLowerCase().includes(t.toLowerCase()))) return;
      const msg = _fillMsg(_pick(ACTION_MESSAGES.lock_node), { agentName: agent.name, target: node.hostname });
      _log_entry(agent.id, 'lock_node', msg, 'critical');
      _termPrint(`<span style="color:var(--danger)">🛡 [${agent.name}] ${_escT(msg)}</span>`);
      AudioSystem?.error?.();
      NS.disconnect?.();
      NS._restoreBreached?.(node.ip);
      node._lockedUntil = Date.now() + 4 * 60 * 1000;
      window.ReputationSystem?.addHeat?.(agent.level * 3, 'ids_lock');
      if (typeof UI !== 'undefined') UI.notify(`🛡 ${agent.name} bloqueó ${node.hostname}`, 'error', 9000);
    },
  };

  // ─── Lógica de decisión de cada agente ────────────────────────

  function _tickAgent(agent) {
    const now  = Date.now();
    if (now < agent.cooldown) return;
    const heat = _heat();

    // Estado de los agentes policiales
    if (agent.type === 'police') {
      const wasIdle = agent.state === 'idle';
      agent.state = heat >= agent.heatThreshold ? 'hunting' : 'idle';
      if (wasIdle && agent.state === 'hunting') {
        _termPrint(`<span style="color:var(--danger)">⚠ [UEC] ${_escT(agent.name)} entró en modo activo — Calor: ${heat}%</span>`);
        AudioSystem?.warning?.();
        if (typeof UI !== 'undefined') UI.notify(`👮 ${agent.name} activado — Heat ${heat}%`, 'error', 7000);
        _notify('agent_activated', { agent });
      }
      if (agent.state !== 'hunting') return;
    }

    // Rivales: siempre activos, pero con probabilidad baja
    if (agent.type === 'rival') {
      if (Math.random() > 0.4) return; // 60% chance de no hacer nada en cada tick
    }

    // IDS: solo actúa si el jugador está conectado a un nodo de su tipo
    if (agent.type === 'ids') {
      const node = window.NetworkSystem?.getCurrentNode?.();
      if (!node) return;
      if (agent.targetOrgTypes && !agent.targetOrgTypes.some(t => (node.type ?? '').toLowerCase().includes(t))) return;
      if (!window.NetworkSystem?.isBreached?.(node.ip)) return;
    }

    // Elegir y ejecutar una acción aleatoria del catálogo del agente
    const available = agent.actions.filter(a => ACTION_HANDLERS[a]);
    if (available.length === 0) return;

    // Nivel 5 puede hacer cualquier cosa, niveles bajos tienen restricciones
    const weighted = available.filter(a => {
      if (heat < 40 && ['steal_inventory','leak_identity'].includes(a)) return false;
      if (heat < 60 && ['counter_breach','publish_alert'].includes(a)) return false;
      return true;
    });

    const action = _pick(weighted.length > 0 ? weighted : available);
    ACTION_HANDLERS[action]?.(agent);

    // Cooldown entre acciones: más alto = más peligroso = actúa más seguido
    const baseCooldown = 60000 - agent.level * 8000;  // 60s-20s
    agent.cooldown = now + baseCooldown + _rnd(0, 20000);
  }

  // ─── Reacciones a eventos del juego ────────────────────────────

  function _onBreach(node) {
    // IDS de banco o gobierno reaccionan inmediatamente
    _agents.filter(a => a.type === 'ids').forEach(ids => {
      if (!ids.targetOrgTypes) return;
      const matches = ids.targetOrgTypes.some(t => (node.type ?? '').toLowerCase().includes(t));
      if (!matches) return;
      const delay = _rnd(8000, 25000);
      setTimeout(() => {
        if (!window.NetworkSystem?.isBreached?.(node.ip)) return;
        const action = _pick(ids.actions.filter(a => ACTION_HANDLERS[a]));
        _termPrint(`<span style="color:var(--warn)">🛡 [IDS] ${_escT(ids.name)} detectó intrusión en ${node.hostname}</span>`);
        setTimeout(() => ACTION_HANDLERS[action]?.(ids), 3000);
        ids.cooldown = Date.now() + 45000;
      }, delay);
    });

    // Honeypot: si el jugador conecta a un nodo trampa → trace inmediato
    if (_honeypots.has(node.ip)) {
      _termPrint(`<span style="color:var(--danger)">🪤 ¡HONEYPOT! Conectaste a un nodo trampa de la UEC. Trace activado.</span>`);
      AudioSystem?.busted?.();
      window.ReputationSystem?.addHeat?.(30, 'honeypot_triggered');
      setTimeout(() => window.PursuitSystem?.startTrace?.(), 1500);
      // Notificar al agente que lo plantó
      const agentId = window.NetworkSystem?.getKnownNodes?.()?.find(n => n.ip === node.ip)?._agentId;
      const trapAgent = _agents.find(a => a.id === agentId) ?? _agents.find(a => a.type === 'police');
      if (trapAgent) _log_entry(trapAgent.id, 'honeypot_triggered', `${trapAgent.name} atrapó al jugador en el honeypot ${node.ip}`, 'critical');
    }
  }

  function _onDownload({ node, dataType }) {
    // Rivales roban del inventario con probabilidad baja si el heat es alto
    if (_heat() < 50) return;
    const rival = _agents.find(a => a.type === 'rival' && a.actions.includes('steal_loot'));
    if (!rival || Math.random() > 0.15) return;
    const inv = window.InventorySystem?.getInventory?.()?.filter(i => !i.sold && !i.listedForSale) ?? [];
    if (inv.length === 0) return;
    setTimeout(() => {
      const item = inv[0];
      if (!item) return;
      window.InventorySystem?.removeItem?.(item.id);
      const msg = _fillMsg(_pick(ACTION_MESSAGES.steal_loot), { agentName: rival.name, count: 1 });
      _log_entry(rival.id, 'steal_loot', msg, 'warning');
      _termPrint(`<span style="color:var(--warn)">🥷 [${rival.handle}] ${_escT(msg)}</span>`);
      if (typeof UI !== 'undefined') UI.notify(`🥷 ${rival.name} robó un archivo de tu inventario`, 'warning', 7000);
    }, _rnd(15000, 45000));
  }

  function _onBust() {
    // En bust, UEC de nivel alto puede confiscar inventario
    const uec = _agents.filter(a => a.type === 'police' && a.state === 'hunting' && a.actions.includes('steal_inventory'));
    if (uec.length > 0 && Math.random() > 0.4) {
      setTimeout(() => ACTION_HANDLERS.steal_inventory(_pick(uec)), 1500);
    }
  }

  // ─── Helpers de terminal ───────────────────────────────────────

  function _termPrint(html) {
    const t = window.GameLoop?.getTerminal?.();
    if (t) t.printHTML(html);
  }
  function _escT(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function _timeNow() {
    return new Date().toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
  }

  // ─── API Pública ───────────────────────────────────────────────
  const API = {

    on(ev, cb) { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); },

    init() {
      if (_initialized) return;
      _initialized = true;

      // Poblar agentes desde el catálogo
      _agents = Object.values(AGENT_CATALOG).map(def => ({ ...def }));

      // Escuchar eventos del juego
      window.addEventListener('alexim-breach', e => _onBreach(e.detail?.node ?? {}));
      window.addEventListener('alexim-download', e => _onDownload(e.detail ?? {}));

      if (window.PursuitSystem) {
        PursuitSystem.on('busted', () => _onBust());
      }

      // FIX: tick fijo cada 8s — los cooldowns POR AGENTE controlan cuándo actúan
      // El intervalo original era random/compartido, causando que todos los agentes
      // actuaran en clusters en vez de intercalados
      _tickInterval = setInterval(() => {
        _agents.forEach(agent => {
          try { _tickAgent(agent); } catch(err) { console.warn(`[AdversarialSystem] Tick error (${agent.id}):`, err); }
        });
      }, 8000);

      console.log(`[AdversarialSystem] ${_agents.length} agentes adversariales activos.`);
      _notify('ready', { agents: _agents });
    },

    getAgents()   { return [..._agents]; },
    getActive()   { return _agents.filter(a => a.state !== 'idle' && a.state !== 'passive'); },
    getLog()      { return [..._log]; },
    isHoneypot(ip){ return _honeypots.has(ip); },

    getRivalStatus() {
      return {
        compromisedByRival: [..._rivalNodes],
        rivalCount: _agents.filter(a => a.type === 'rival').length,
      };
    },

    /** Forzar acción de un agente (para testing: AdversarialSystem.forceAction('uec_rivas','trace')) */
    forceAction(agentId, action) {
      const agent = _agents.find(a => a.id === agentId);
      if (!agent || !ACTION_HANDLERS[action]) return false;
      ACTION_HANDLERS[action](agent);
      return true;
    },

    reset() {
      if (_tickInterval) clearInterval(_tickInterval);
      _agents = []; _log = []; _honeypots.clear(); _rivalNodes.clear();
      _initialized = false;
    },
  };

  return API;
})();
