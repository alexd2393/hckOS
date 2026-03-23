/**
 * hackingEngine.js — Motor de Hacking Multi-Etapa
 * AleXim Mobile v8 — Hacking Engine
 *
 * Convierte el hacking en una secuencia estratégica inspirada en Uplink/Hacknet:
 *
 *  FASE 1 → RECON     : recon [ip] / portscan [ip] / fingerprint [ip]
 *  FASE 2 → BYPASS    : bypass [capa] [herramienta] (reemplaza a breach)
 *  FASE 3 → TRAVERSE  : traverse [nodo-interno] (navegar dentro del servidor)
 *  FASE 4 → EXTRACT   : ls / download [archivo]  (igual que antes)
 *  FASE 5 → WIPE      : wipelog (borrar huellas → reduce heat)
 *
 * Integración:
 *   - SecurityLayerSystem: gestiona las capas por nodo
 *   - NetworkSystem: breach se llama solo cuando todas las capas están OK
 *   - PursuitSystem: trace sigue activo en paralelo
 *   - GameLoop: los comandos nuevos se registran aquí y sobreescriben/complementan
 *
 * API:
 *   HackingEngine.getPhase(ip)           → 'recon'|'bypass'|'inside'|'done'
 *   HackingEngine.getSessionLog()        → string[] (log de la sesión actual)
 *   HackingEngine.canWipeLog(ip)         → boolean
 *   HackingEngine.wipeLog(ip)            → { ok, heatReduced }
 *   HackingEngine.getInternalNodes(ip)   → InternalNode[]
 *   HackingEngine.setCurrentInternal(ip, nodeId) → void
 *   HackingEngine.getCurrentInternal(ip) → InternalNode|null
 */

window.HackingEngine = (() => {
  'use strict';

  // ─── Estado por sesión ────────────────────────────────────────
  const _sessions = new Map();   // ip → HackSession
  let _listeners  = {};

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function _rndInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  // ─── Nodos internos por tipo de servidor ─────────────────────
  const INTERNAL_NODES = {
    BANK: [
      { id:'web',     label:'Servidor Web',      icon:'🌐', dataTypes:['network_logs','emails'],            security:1 },
      { id:'mail',    label:'Servidor de Mail',   icon:'📧', dataTypes:['emails','credentials'],             security:2 },
      { id:'db',      label:'Base de Clientes',   icon:'🗄', dataTypes:['customer_database','credentials'],  security:3 },
      { id:'finance', label:'Motor de Pagos',     icon:'💳', dataTypes:['financial_data','crypto_wallet_data'], security:4 },
      { id:'backup',  label:'Backup Cifrado',     icon:'💾', dataTypes:['financial_data','customer_database'], security:3 },
    ],
    GOVERNMENT: [
      { id:'web',     label:'Portal Ciudadano',   icon:'🌐', dataTypes:['network_logs'],                    security:1 },
      { id:'citizens',label:'Padrón Electoral',   icon:'🗳', dataTypes:['customer_database','government_documents'], security:3 },
      { id:'docs',    label:'Documentos Reservados', icon:'📂', dataTypes:['government_documents','emails'], security:4 },
      { id:'finance', label:'Tesorería Digital',  icon:'💰', dataTypes:['financial_data','government_documents'], security:4 },
      { id:'intranet',label:'Intranet Ministerial',icon:'🔗', dataTypes:['emails','government_documents'], security:3 },
    ],
    HOSPITAL: [
      { id:'web',     label:'Portal Pacientes',   icon:'🌐', dataTypes:['network_logs'],                    security:1 },
      { id:'patients',label:'Historias Clínicas', icon:'🏥', dataTypes:['medical_records','customer_database'], security:3 },
      { id:'admin',   label:'Administración',     icon:'📋', dataTypes:['emails','credentials','financial_data'], security:2 },
      { id:'lab',     label:'Laboratorio',        icon:'🔬', dataTypes:['medical_records','research_data'], security:3 },
    ],
    CORPORATE: [
      { id:'web',     label:'Sitio Web',          icon:'🌐', dataTypes:['network_logs'],                    security:1 },
      { id:'mail',    label:'Servidor de Mail',   icon:'📧', dataTypes:['emails','credentials'],             security:2 },
      { id:'crm',     label:'CRM / Clientes',     icon:'👥', dataTypes:['customer_database'],               security:2 },
      { id:'finance', label:'Finanzas',           icon:'📊', dataTypes:['financial_data'],                  security:3 },
    ],
    RESEARCH: [
      { id:'web',     label:'Portal Investigación',icon:'🌐', dataTypes:['network_logs'],                   security:1 },
      { id:'data',    label:'Base de Datos',       icon:'🔬', dataTypes:['research_data','government_documents'], security:3 },
      { id:'mail',    label:'Correo Académico',    icon:'📧', dataTypes:['emails','credentials'],            security:2 },
    ],
    DEFAULT: [
      { id:'web',     label:'Servidor Web',        icon:'🌐', dataTypes:['network_logs'],                   security:1 },
      { id:'db',      label:'Base de Datos',        icon:'🗄', dataTypes:['customer_database','credentials'], security:2 },
      { id:'mail',    label:'Mail',                 icon:'📧', dataTypes:['emails'],                         security:2 },
    ],
  };

  // ─── Crear sesión de hacking ───────────────────────────────────
  function _getOrCreate(ip) {
    if (!_sessions.has(ip)) {
      const node = window.NetworkSystem?.getKnownNodes?.().find(n => n.ip === ip);
      const internalDefs = INTERNAL_NODES[node?.type] ?? INTERNAL_NODES.DEFAULT;
      _sessions.set(ip, {
        ip,
        phase:        'recon',     // recon → bypass → inside → done
        reconDone:    false,
        logEntries:   [],          // acciones del jugador en este nodo
        logWiped:     false,
        internalNodes: internalDefs.map(n => ({ ...n, accessed: false })),
        currentInternal: null,
        startedAt:    null,
        bypassCount:  0,
      });
    }
    return _sessions.get(ip);
  }

  // ─── Registro de log de sesión ────────────────────────────────
  function _logAction(ip, msg) {
    const sess = _sessions.get(ip);
    if (!sess) return;
    sess.logEntries.push({ ts: Date.now(), msg });
    if (sess.logEntries.length > 50) sess.logEntries.shift();
  }

  // ─── API Pública ──────────────────────────────────────────────
  const API = {

    on(ev, cb) { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); },

    /**
     * Inicializar sesión de hacking para un IP.
     * Llamado en `connect`.
     */
    startSession(ip) {
      const sess = _getOrCreate(ip);
      sess.startedAt = Date.now();
      // Construir capas de seguridad
      const node = window.NetworkSystem?.getKnownNodes?.().find(n => n.ip === ip);
      if (node && window.SecurityLayerSystem) SecurityLayerSystem.buildForNode(node);
      _notify('session_start', { ip, sess });
      return sess;
    },

    getPhase(ip) {
      const sess = _sessions.get(ip);
      if (!sess) return 'recon';
      return sess.phase;
    },

    /**
     * Ejecutar reconocimiento en un nodo.
     * Devuelve info detallada de puertos, OS, capas de seguridad.
     */
    recon(ip, hasScanner) {
      const sess = _getOrCreate(ip);
      sess.reconDone = true;
      const reconInfo = window.SecurityLayerSystem?.getReconInfo?.(ip, hasScanner) ?? null;
      _logAction(ip, `RECON ejecutado desde sesión local`);
      _notify('recon', { ip, reconInfo });
      return reconInfo;
    },

    /**
     * Intentar bypasear la siguiente capa con una herramienta.
     * Devuelve el resultado del bypass.
     */
    async bypassLayer(ip, toolId) {
      const sess = _getOrCreate(ip);
      if (sess.phase === 'inside' || sess.phase === 'done') {
        return { ok: false, message: 'Ya estás dentro del servidor. Usá ls, traverse o wipelog.' };
      }
      if (sess.phase === 'ready') {
        return { ok: false, message: 'Todas las capas bypaseadas. Ejecutá breach para entrar.' };
      }
      sess.phase = 'bypass';

      const toolLevel = _getToolLevel(toolId);
      const result    = await window.SecurityLayerSystem?.bypass?.(ip, toolId, toolLevel);

      if (!result) return { ok: false, message: 'SecurityLayerSystem no disponible.' };

      if (result.ok) {
        sess.bypassCount++;
        _logAction(ip, `BYPASS ${result.layer.id} con ${toolId} — ${result.success ? 'OK' : 'FAIL'}`);

        if (result.success && result.fullyBypassed) {
          // Todas las capas pasadas → marcar como listo para breach
          // El breach real ocurre cuando el jugador ejecuta 'breach' explícitamente
          sess.phase = 'ready';  // nuevo estado: capas OK, esperando breach
        }
      }

      return result;
    },

    /**
     * Listar nodos internos disponibles en el servidor comprometido.
     */
    getInternalNodes(ip) {
      const sess = _sessions.get(ip);
      return sess?.internalNodes ?? [];
    },

    /**
     * Navegar a un nodo interno específico.
     */
    traverseTo(ip, nodeId) {
      const sess = _sessions.get(ip);
      if (!sess || sess.phase !== 'inside') return { ok: false, message: 'No estás dentro del servidor.' };
      const target = sess.internalNodes.find(n => n.id === nodeId);
      if (!target) return { ok: false, message: `Nodo interno no encontrado: ${nodeId}` };
      sess.currentInternal = target;
      target.accessed = true;
      _logAction(ip, `TRAVERSE → ${target.label} [${nodeId}]`);
      _notify('traverse', { ip, node: target });
      return { ok: true, node: target };
    },

    /** True si todas las capas están bypaseadas pero aún no se hizo breach */
    isReadyToBreach(ip) {
      return _sessions.get(ip)?.phase === 'ready';
    },

    getCurrentInternal(ip) {
      return _sessions.get(ip)?.currentInternal ?? null;
    },

    /** Clear traverse context (called on disconnect or reconnect) */
    clearInternal(ip) {
      const sess = _sessions.get(ip);
      if (sess) sess.currentInternal = null;
    },

    /**
     * Borrar el log de actividad del servidor actual.
     * Reduce el heat y la probabilidad de investigación futura.
     * Costo: requiere log_wiper o acceso root (todas las capas bypaseadas).
     */
    wipeLog(ip) {
      const sess = _sessions.get(ip);
      if (!sess) return { ok: false, message: 'Sin sesión activa.' };
      if (sess.phase !== 'inside') return { ok: false, message: 'Tenés que estar dentro del servidor.' };
      if (sess.logWiped) return { ok: false, message: 'El log ya fue borrado en esta sesión.' };

      const hasWiper    = typeof GameState !== 'undefined' && GameState.hasSoftware('logwipe');
      const heatReduce  = hasWiper ? 18 : 8;
      const totalTime   = Date.now() - (sess.startedAt ?? Date.now());
      const extraReduce = totalTime < 120000 ? 5 : 0;  // bonus si fue rápido

      if (typeof ReputationSystem !== 'undefined') {
        ReputationSystem.addHeat(-(heatReduce + extraReduce), 'log_wiped');
      }
      sess.logWiped = true;
      sess.logEntries.push({ ts: Date.now(), msg: `LOG BORRADO — operación limpia` });

      _notify('log_wiped', { ip, heatReduced: heatReduce + extraReduce });
      return { ok: true, heatReduced: heatReduce + extraReduce, hadWiper: hasWiper };
    },

    canWipeLog(ip) {
      const sess = _sessions.get(ip);
      return !!sess && sess.phase === 'inside' && !sess.logWiped;
    },

    getSessionLog(ip) {
      return _sessions.get(ip)?.logEntries ?? [];
    },

    getSession(ip) { return _sessions.get(ip) ?? null; },

    /**
     * Finalizar sesión (al desconectar).
     * Si no se borró el log, sube el heat residual.
     */
    endSession(ip) {
      const sess = _sessions.get(ip);
      if (!sess || sess.phase === 'recon') return;

      if (sess.phase === 'inside' && !sess.logWiped) {
        // Dejaste rastros — consecuencias
        const heat = 4 + sess.bypassCount * 2;
        if (typeof ReputationSystem !== 'undefined') ReputationSystem.addHeat(heat, 'session_traces_left');
        _notify('traces_left', { ip, heat });
      }
      _sessions.delete(ip);
    },

    /** Para el Network Map — cuántas capas tiene un nodo y cuántas están bypaseadas */
    getLayerProgress(ip) {
      const stack    = window.SecurityLayerSystem?.getStack?.(ip) ?? [];
      const bypassed = stack.filter(l => l.bypassed).length;
      return { total: stack.length, bypassed, layers: stack };
    },

    reset() { _sessions.clear(); },
  };

  // ─── Helper: obtener nivel de herramienta del jugador ─────────
  function _getToolLevel(toolId) {
    if (typeof GameState === 'undefined') return 1;
    const sw = GameState.getSoftware?.() ?? {};
    return sw[toolId]?.level ?? 1;
  }

  return API;
})();
