/**
 * localSystem.js — Sistema Local del Operador
 * AleXim Mobile v2.4.1 — Local Machine Management
 *
 * Gestiona los recursos de la máquina del jugador:
 *
 *  RAM        — limita herramientas activas simultáneas
 *  STORAGE    — limita cuánto loot podés guardar sin vender
 *  ANONYMITY  — se degrada con cada operación, se recupera con tiempo/VPN
 *
 * Flujo de herramientas (nuevo):
 *  1. buy [tool]       → llega como binario en /home/ghost/tools/ (no instalada)
 *  2. install [tool]   → la instala: consume RAM, verifica deps
 *  3. unload [tool]    → la desactiva (libera RAM, queda instalada)
 *  4. upgrade [tool]   → mejora un eje: speed / stealth / power
 *
 * API:
 *   LocalSystem.getRam()           → { used, max, pct }
 *   LocalSystem.getStorage()       → { used, max, pct }
 *   LocalSystem.getAnonymity()     → 0-100
 *   LocalSystem.getLocalTools()    → Tool[]
 *   LocalSystem.hasBinary(id)      → boolean  (descargado pero no instalado)
 *   LocalSystem.isActive(id)       → boolean  (instalado Y cargado en RAM)
 *   LocalSystem.installTool(id)    → { ok, message }
 *   LocalSystem.unloadTool(id)     → { ok, message }
 *   LocalSystem.upgradeTool(id, axis) → { ok, message, cost }
 *   LocalSystem.receiveBinary(id)  → void  (llamado por _buy en aleximOS)
 *   LocalSystem.degradeAnonymity(amount, reason) → void
 *   LocalSystem.recoverAnonymity(amount)          → void
 *   LocalSystem.getStats()         → resumen completo
 */

window.LocalSystem = (() => {
  'use strict';

  // ─── Configuración de recursos ────────────────────────────────
  const CONFIG = {
    ram: {
      base:       4,    // GB base
      perUpgrade: 2,    // GB extra por upgrade de hardware
      maxUpgrades: 4,
    },
    storage: {
      base:       20,   // GB base
      perUpgrade: 20,
      maxUpgrades: 5,
    },
    anonymity: {
      base:          100,
      decayPerOp:    1,     // decay pasivo por operación de red
      recoverPerMin: 0.5,   // recuperación pasiva por minuto
      vpnMultiplier: 0.4,   // con VPN activa, el decay es 40% del normal
    },
  };

  // ─── Catálogo completo de herramientas ────────────────────────
  // Cada tool tiene: ram (GB), deps, axes (speed/stealth/power), etc.
  const TOOL_CATALOG = {

    // ── Herramientas base (ya en gameState) ──────────────────────
    scanner: {
      id: 'scanner', name: 'NetScan', icon: '📡',
      category: 'recon',
      desc: 'Escáner de red. Revela hosts, puertos y servicios activos.',
      ram: 0.5,
      deps: [],
      repRequired: 0,
      price: 0,       // viene instalado
      burnRate: 0.2,  // se "quema" lentamente con el uso
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 3, stealth: 3, power: 3 },
      upgradeCosts: { speed: [200, 400], stealth: [300, 600], power: [250, 500] },
      upgradeEffects: {
        speed:   'Recon más rápido. -30% tiempo por nivel.',
        stealth: 'Menos heat al escanear. -20% heat por nivel.',
        power:   'Más detalle en recon. Más vulnerabilidades detectadas.',
      },
      bypassBonus: {},
    },

    phantom: {
      id: 'phantom', name: 'Phantom v1', icon: '🔥',
      category: 'bypass',
      desc: 'Especializado en evadir firewalls. Alta efectividad en Sec 1-2.',
      ram: 0.8,
      deps: ['scanner'],
      repRequired: 0,
      price: 800,
      burnRate: 0.5,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 3, stealth: 3, power: 3 },
      upgradeCosts: { speed: [400, 800], stealth: [500, 1000], power: [450, 900] },
      upgradeEffects: {
        speed:   '-25% tiempo de bypass por nivel.',
        stealth: '-15% heat generado por nivel.',
        power:   '+10% success rate por nivel.',
      },
      bypassBonus: { FIREWALL: 0.10 },
    },

    proxyx: {
      id: 'proxyx', name: 'ProxyX', icon: '🔀',
      category: 'bypass',
      desc: 'Cadena de proxies para evadir detección. Bypassea PROXY e IDS.',
      ram: 1.0,
      deps: ['phantom'],
      repRequired: 10,
      price: 1500,
      burnRate: 0.4,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 3, stealth: 3, power: 3 },
      upgradeCosts: { speed: [600, 1200], stealth: [700, 1400], power: [650, 1300] },
      upgradeEffects: {
        speed:   '-20% tiempo de bypass proxy/IDS por nivel.',
        stealth: '-25% heat en IDS por nivel. Crucial para no triggear alertas.',
        power:   '+12% success rate contra PROXY e IDS por nivel.',
      },
      bypassBonus: { PROXY: 0.12, IDS: 0.08 },
    },

    ghostwalk: {
      id: 'ghostwalk', name: 'GhostWalk', icon: '👁',
      category: 'bypass',
      desc: 'Evasión especializada de IDS. Hace tu tráfico indistinguible del legítimo.',
      ram: 1.2,
      deps: ['proxyx'],
      repRequired: 25,
      price: 3000,
      burnRate: 0.3,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 3, stealth: 4, power: 3 },
      upgradeCosts: { speed: [1000, 2000], stealth: [1200, 2400, 4000], power: [1100, 2200] },
      upgradeEffects: {
        speed:   '-15% tiempo contra IDS por nivel.',
        stealth: '-35% heat en IDS por nivel. Nivel 4: IDS casi no te detecta.',
        power:   '+15% success rate contra IDS por nivel.',
      },
      bypassBonus: { IDS: 0.20 },
    },

    brutex: {
      id: 'brutex', name: 'BruteX', icon: '💥',
      category: 'bypass',
      desc: 'Fuerza bruta de credenciales. Lento pero seguro contra AUTH.',
      ram: 1.5,
      deps: ['scanner'],
      repRequired: 0,
      price: 500,
      burnRate: 0.8,   // se quema más rápido — muy agresivo
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 4, stealth: 2, power: 3 },
      upgradeCosts: { speed: [300, 600, 1200], stealth: [800, 1600], power: [400, 800] },
      upgradeEffects: {
        speed:   '-30% tiempo de ataque por nivel. Nivel 4: ataques en paralelo.',
        stealth: '-10% heat por nivel. Límite bajo — bruteforce es inherentemente ruidoso.',
        power:   '+12% success rate por nivel.',
      },
      bypassBonus: { FIREWALL: 0.05, AUTH: 0.15 },
    },

    hashcrack: {
      id: 'hashcrack', name: 'HashCrack', icon: '🔑',
      category: 'bypass',
      desc: 'Crackeador de hashes con diccionarios argentinos incluidos.',
      ram: 1.0,
      deps: ['brutex'],
      repRequired: 15,
      price: 2000,
      burnRate: 0.4,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 3, stealth: 3, power: 4 },
      upgradeCosts: { speed: [700, 1400], stealth: [900, 1800], power: [800, 1600, 3200] },
      upgradeEffects: {
        speed:   '-20% tiempo de crackeo por nivel.',
        stealth: '-20% heat en AUTH por nivel.',
        power:   '+15% success rate por nivel. Nivel 4: diccionario corporativo AR.',
      },
      bypassBonus: { AUTH: 0.22 },
    },

    vpn: {
      id: 'vpn', name: 'GhostVPN', icon: '🌀',
      category: 'opsec',
      desc: 'VPN multicapa. Reduce heat en todas las operaciones. Siempre activa.',
      ram: 0.5,
      deps: [],
      repRequired: 0,
      price: 350,
      burnRate: 0.1,   // casi no se quema
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 2, stealth: 4, power: 2 },
      upgradeCosts: { speed: [500, 1000], stealth: [600, 1200, 2400], power: [700, 1400] },
      upgradeEffects: {
        speed:   'Menor latencia de red. -10% tiempo de operaciones.',
        stealth: '-15% de todo el heat generado por nivel. Nivel 4: VPN quantum.',
        power:   'Más nodos de salida. +5% chance bypass en todas las capas.',
      },
      bypassBonus: { FIREWALL: 0.04, PROXY: 0.06, IDS: 0.04 },
    },

    cryptbreak: {
      id: 'cryptbreak', name: 'CryptBreak', icon: '🔓',
      category: 'extract',
      desc: 'Descifra archivos encriptados para poder descargarlos.',
      ram: 0.8,
      deps: ['scanner'],
      repRequired: 0,
      price: 200,
      burnRate: 0.3,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 3, stealth: 2, power: 4 },
      upgradeCosts: { speed: [300, 600], stealth: [500, 1000], power: [400, 800, 1600] },
      upgradeEffects: {
        speed:   '-25% tiempo de descifrado por nivel.',
        stealth: '-10% heat al descargar archivos encriptados.',
        power:   '+15% success rate en ENCRYPTION por nivel. Nivel 4: cifrado AES.',
      },
      bypassBonus: { ENCRYPTION: 0.20 },
    },

    quantumcrack: {
      id: 'quantumcrack', name: 'QuantumCrack', icon: '💎',
      category: 'bypass',
      desc: 'Herramienta de élite para cifrado fuerte. Solo para objetivos Sec 5.',
      ram: 2.0,
      deps: ['cryptbreak', 'ghostwalk'],
      repRequired: 50,
      price: 12000,
      burnRate: 0.2,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 2, stealth: 3, power: 4 },
      upgradeCosts: { speed: [3000, 6000], stealth: [4000, 8000], power: [5000, 10000, 20000] },
      upgradeEffects: {
        speed:   '-20% tiempo contra ENCRYPTION por nivel.',
        stealth: '-20% heat en ENCRYPTION por nivel.',
        power:   '+20% success rate en ENCRYPTION por nivel. Nivel 4: zero-day.',
      },
      bypassBonus: { ENCRYPTION: 0.25 },
    },

    logwipe: {
      id: 'logwipe', name: 'LogWipe', icon: '🧹',
      category: 'opsec',
      desc: 'Borra logs de actividad en servidores objetivo. Reduce heat masivamente.',
      ram: 0.5,
      deps: ['vpn'],
      repRequired: 20,
      price: 1200,
      burnRate: 0.4,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 3, stealth: 3, power: 3 },
      upgradeCosts: { speed: [500, 1000], stealth: [600, 1200], power: [700, 1400] },
      upgradeEffects: {
        speed:   '-30% tiempo de wipelog por nivel.',
        stealth: 'Wipelog genera menos heat por nivel.',
        power:   '-8% heat adicional en wipelog por nivel.',
      },
      bypassBonus: {},
    },

    shieldwall: {
      id: 'shieldwall', name: 'ShieldWall', icon: '🛡',
      category: 'defense',
      desc: 'Firewall personal. Bloquea rastreos activos entrantes de la UEC.',
      ram: 0.5,
      deps: [],
      repRequired: 0,
      price: 150,
      burnRate: 0.1,
      axes: { speed: 1, stealth: 1, power: 1 },
      maxAxes: { speed: 2, stealth: 2, power: 4 },
      upgradeCosts: { speed: [200, 400], stealth: [300, 600], power: [250, 500, 1000] },
      upgradeEffects: {
        speed:   'Firewall más reactivo. -10% delay en bloquear traces.',
        stealth: 'Menos visible para la UEC. -8% chance de ser detectado.',
        power:   '+20% chance de bloquear trace activo por nivel.',
      },
      bypassBonus: {},
    },
  };

  // ─── Estado ────────────────────────────────────────────────────
  let _state = {
    ram:        { max: CONFIG.ram.base, upgrades: 0 },
    storage:    { max: CONFIG.storage.base, upgrades: 0 },
    anonymity:  100,
    // herramientas: id → { status: 'binary'|'active'|'unloaded', burn: 0-100, axes }
    tools: {},
  };

  let _listeners   = {};
  let _recoveryInt = null;

  // ─── Helpers ───────────────────────────────────────────────────
  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }
  function _rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  // ─── RAM usada ────────────────────────────────────────────────
  function _ramUsed() {
    return Object.entries(_state.tools)
      .filter(([, t]) => t.status === 'active')
      .reduce((sum, [id]) => sum + (TOOL_CATALOG[id]?.ram ?? 0), 0);
  }

  // ─── Storage usado ────────────────────────────────────────────
  function _storageUsed() {
    const inv = window.InventorySystem?.getInventory?.() ?? [];
    return inv.filter(i => !i.sold).reduce((sum, i) => {
      // Convertir tamaño de archivo a GB aproximado
      const sz = i.size ?? '1 MB';
      const match = sz.match(/([\d.]+)\s*(KB|MB|GB)/i);
      if (!match) return sum + 0.001;
      const val  = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      return sum + (unit === 'GB' ? val : unit === 'MB' ? val / 1024 : val / (1024 * 1024));
    }, 0);
  }

  // ─── Iniciar recuperación pasiva de anonimato ─────────────────
  // BUG #4 FIX: guard against double-start and premature start during module load
  function _startRecovery() {
    if (_recoveryInt) return;  // ya está corriendo
    if (typeof window === 'undefined') return;  // no browser env (Node testing)
    _recoveryInt = setInterval(function() {
      const vpnActive = typeof GameState !== 'undefined' && GameState.isVpnActive?.();
      // Con VPN la recuperación es más rápida
      const rate = CONFIG.anonymity.recoverPerMin * (vpnActive ? 2 : 1);
      if (_state.anonymity < 100) {
        _state.anonymity = Math.min(100, _state.anonymity + rate);
        _notify('anonymity', _state.anonymity);
      }
    }, 60000); // cada minuto
  }

  // ─── API Pública ──────────────────────────────────────────────
  const API = {

    on(ev, cb) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(cb);
    },

    init() {
      _startRecovery();
      // Sincronizar con GameState: herramientas ya instaladas → marcar como active
      if (typeof GameState !== 'undefined') {
        const sw = GameState.getSoftware();
        Object.entries(sw).forEach(([id, s]) => {
          if (s.installed && TOOL_CATALOG[id]) {
            if (!_state.tools[id]) {
              _state.tools[id] = {
                status: 'active',
                burn:   0,
                axes:   { ...TOOL_CATALOG[id].axes },
              };
            }
          }
        });
      }
      console.log('[LocalSystem] Sistema local iniciado.');
    },

    // ── Recursos ─────────────────────────────────────────────────

    getRam() {
      const used = _ramUsed();
      const max  = _state.ram.max;
      return { used: parseFloat(used.toFixed(1)), max, pct: Math.round(used / max * 100) };
    },

    getStorage() {
      const used = _storageUsed();
      const max  = _state.storage.max;
      return { used: parseFloat(used.toFixed(2)), max, pct: Math.round(used / max * 100) };
    },

    getAnonymity() { return Math.round(_state.anonymity); },

    // ── Herramientas ──────────────────────────────────────────────

    getCatalog()         { return TOOL_CATALOG; },
    getToolDef(id)       { return TOOL_CATALOG[id] ?? null; },
    hasBinary(id)        { return !!_state.tools[id]; },
    isActive(id)         { return _state.tools[id]?.status === 'active'; },
    getToolState(id)     { return _state.tools[id] ?? null; },

    getLocalTools() {
      return Object.entries(_state.tools).map(([id, t]) => ({
        ...TOOL_CATALOG[id],
        ...t,
        id,
      })).filter(t => TOOL_CATALOG[t.id]);
    },

    getActiveTools() {
      return this.getLocalTools().filter(t => t.status === 'active');
    },

    /**
     * Recibe un binario de herramienta (llamado cuando el jugador compra).
     * La herramienta queda en estado 'binary' — disponible pero NO activa.
     */
    receiveBinary(id) {
      if (!TOOL_CATALOG[id]) return;
      // BUG #7 FIX: if tool is already active (pre-installed like scanner), don't overwrite
      if (_state.tools[id]) {
        if (_state.tools[id].status === 'active') return; // ya activa, no tocar
        return; // ya tiene el binario
      }
      _state.tools[id] = { status: 'binary', burn: 0, axes: { ...TOOL_CATALOG[id].axes } };

      // Agregar al filesystem local
      if (typeof GameState !== 'undefined') {
        GameState.addFile('/home/ghost/tools', `${id}.bin`,
          `# Binario: ${TOOL_CATALOG[id].name}\n# Estado: DESCARGADO — ejecutá: install ${id}\n# Deps: ${TOOL_CATALOG[id].deps.join(', ') || 'ninguna'}`
        );
      }

      _notify('binary_received', { id, tool: TOOL_CATALOG[id] });
      console.log(`[LocalSystem] Binario recibido: ${id}`);
    },

    /**
     * Instala una herramienta: la carga en RAM y la activa.
     * Verifica dependencias y recursos.
     */
    installTool(id) {
      const def = TOOL_CATALOG[id];
      if (!def) return { ok: false, message: `Herramienta desconocida: ${id}` };

      const toolState = _state.tools[id];
      if (!toolState) return { ok: false, message: `No tenés el binario de ${def.name}. Compralo primero.` };
      if (toolState.status === 'active') return { ok: false, message: `${def.name} ya está activa.` };

      // Verificar dependencias
      for (const dep of def.deps) {
        if (!this.isActive(dep)) {
          const depDef = TOOL_CATALOG[dep];
          return {
            ok: false,
            message: `${def.name} requiere ${depDef?.name ?? dep} activa. Instalá las dependencias primero.`,
            missingDep: dep,
          };
        }
      }

      // Verificar RAM
      const ram = this.getRam();
      if (ram.used + def.ram > ram.max) {
        return {
          ok: false,
          message: `RAM insuficiente. ${def.name} necesita ${def.ram} GB — tenés ${(ram.max - ram.used).toFixed(1)} GB libres.`,
          ramNeeded: def.ram,
          ramFree: ram.max - ram.used,
        };
      }

      // Instalar
      toolState.status = 'active';

      // Sincronizar con GameState para compatibilidad con sistemas existentes
      if (typeof GameState !== 'undefined' && GameState.getSoftware()[id] !== undefined) {
        GameState.installSoftware(id);
        // Sincronizar nivel de ejes
        const level = Math.round((toolState.axes.speed + toolState.axes.stealth + toolState.axes.power) / 3);
        if (GameState.getSoftware()[id]) {
          GameState.getSoftware()[id].level = level;
        }
      }

      _notify('tool_installed', { id, tool: def, ram: this.getRam() });
      return { ok: true, message: `${def.name} instalada y activa. RAM usada: ${this.getRam().used}/${this.getRam().max} GB` };
    },

    /**
     * Descarga una herramienta de la RAM (sigue disponible para reinstalar).
     */
    unloadTool(id) {
      const def  = TOOL_CATALOG[id];
      const tool = _state.tools[id];
      if (!tool || tool.status !== 'active') return { ok: false, message: `${def?.name ?? id} no está activa.` };

      // Verificar que ninguna tool activa depende de esta
      const dependents = Object.entries(_state.tools)
        .filter(([tid, t]) => t.status === 'active' && TOOL_CATALOG[tid]?.deps.includes(id))
        .map(([tid]) => TOOL_CATALOG[tid]?.name ?? tid);

      if (dependents.length > 0) {
        return {
          ok: false,
          message: `No podés descargar ${def?.name}: ${dependents.join(', ')} depende de ella.`,
        };
      }

      tool.status = 'unloaded';
      _notify('tool_unloaded', { id, ram: this.getRam() });
      return { ok: true, message: `${def?.name ?? id} descargada. RAM liberada.` };
    },

    /**
     * Mejora un eje de una herramienta instalada.
     * axis: 'speed' | 'stealth' | 'power'
     * Costo variable según nivel actual del eje.
     */
    upgradeTool(id, axis) {
      const def  = TOOL_CATALOG[id];
      const tool = _state.tools[id];
      if (!def || !tool) return { ok: false, message: `No tenés ${id}.` };
      if (tool.status !== 'active') return { ok: false, message: `${def.name} debe estar activa para mejorar.` };
      if (!['speed', 'stealth', 'power'].includes(axis)) return { ok: false, message: `Eje inválido: ${axis}` };

      const current = tool.axes[axis];
      const max     = def.maxAxes[axis];
      if (current >= max) return { ok: false, message: `${def.name} ya está al máximo en ${axis} (${max}).` };

      const costs = def.upgradeCosts[axis];
      const cost  = costs[current - 1];
      if (!cost) return { ok: false, message: `Sin datos de costo para este nivel.` };

      if (typeof GameState !== 'undefined' && !GameState.spendMoney(cost)) {
        return { ok: false, message: `Fondos insuficientes. Necesitás $${cost.toLocaleString('es-AR')} CR.` };
      }

      tool.axes[axis]++;
      const effect = def.upgradeEffects[axis];

      // Sincronizar nivel general en GameState
      if (typeof GameState !== 'undefined' && GameState.getSoftware()[id]) {
        const avgLevel = Math.round((tool.axes.speed + tool.axes.stealth + tool.axes.power) / 3);
        GameState.getSoftware()[id].level = avgLevel;
      }

      if (window.LedgerSystem) LedgerSystem.onBuy(cost, `${def.name} — upgrade ${axis} Lv.${tool.axes[axis]}`);

      _notify('tool_upgraded', { id, axis, level: tool.axes[axis], cost });
      return {
        ok:     true,
        cost,
        axis,
        newLevel: tool.axes[axis],
        effect,
        message: `${def.name} [${axis}] → Lv.${tool.axes[axis]}. ${effect}`,
      };
    },

    /**
     * Registra desgaste (burn) de una herramienta después de usarla.
     * Cuando burn llega a 100, la herramienta se vuelve inestable.
     */
    recordUsage(id, success) {
      const tool = _state.tools[id];
      const def  = TOOL_CATALOG[id];
      if (!tool || !def) return;
      const burnIncrement = success ? def.burnRate : def.burnRate * 2;
      tool.burn = Math.min(100, tool.burn + burnIncrement);
      if (tool.burn >= 80) _notify('tool_degraded', { id, burn: tool.burn });
    },

    /**
     * Calcula los bonus de bypass de las herramientas activas para una capa.
     * Esto se integra con SecurityLayerSystem.
     */
    getBypassBonus(toolId, layerId) {
      const tool    = _state.tools[toolId];
      const def     = TOOL_CATALOG[toolId];
      if (!tool || !def || tool.status !== 'active') return 0;

      const baseBonus  = def.bypassBonus[layerId] ?? 0;
      const powerLevel = tool.axes.power;
      const burnPenalty = tool.burn >= 80 ? 0.5 : 1.0;  // herramienta quemada = menos efectiva

      return baseBonus * powerLevel * burnPenalty;
    },

    /**
     * Calcula el multiplicador de heat de stealth para una herramienta.
     * Mayor stealth = menos heat generado.
     */
    getStealthMultiplier(toolId) {
      const tool = _state.tools[toolId];
      const def  = TOOL_CATALOG[toolId];
      if (!tool || !def || tool.status !== 'active') return 1.0;
      // Stealth 1→ 1.0x, 2→ 0.85x, 3→ 0.70x, 4→ 0.55x
      return Math.max(0.4, 1.0 - (tool.axes.stealth - 1) * 0.15);
    },

    /**
     * Calcula el multiplicador de tiempo de speed para una herramienta.
     */
    getSpeedMultiplier(toolId) {
      const tool = _state.tools[toolId];
      const def  = TOOL_CATALOG[toolId];
      if (!tool || !def || tool.status !== 'active') return 1.0;
      // Speed 1→ 1.0x, 2→ 0.75x, 3→ 0.55x, 4→ 0.40x
      return Math.max(0.3, 1.0 - (tool.axes.speed - 1) * 0.25);
    },

    // ── Anonimato ─────────────────────────────────────────────────

    degradeAnonymity(amount, reason = '') {
      const vpnActive = typeof GameState !== 'undefined' && GameState.isVpnActive?.();
      const vpnTool   = this.isActive('vpn');
      const stealthBonus = vpnTool ? this.getStealthMultiplier('vpn') : 1.0;
      const effective = amount
        * (vpnActive ? CONFIG.anonymity.vpnMultiplier : 1.0)
        * stealthBonus;
      _state.anonymity = Math.max(0, _state.anonymity - effective);
      _notify('anonymity', _state.anonymity);

      if (_state.anonymity <= 20 && _state.anonymity > 15) {
        if (typeof UI !== 'undefined')
          UI.notify('⚠ Anonimato crítico — tus operaciones son rastreables', 'error', 8000);
      }
      if (_state.anonymity <= 0) {
        _notify('identity_exposed', {});
        if (typeof UI !== 'undefined')
          UI.notify('🔴 IDENTIDAD EXPUESTA — La UEC tiene tu firma digital', 'error', 12000);
      }
    },

    recoverAnonymity(amount) {
      _state.anonymity = Math.min(100, _state.anonymity + amount);
      _notify('anonymity', _state.anonymity);
    },

    // ── Hardware upgrades ─────────────────────────────────────────

    upgradeRam() {
      const cost = 1000 * Math.pow(2, _state.ram.upgrades);
      if (_state.ram.upgrades >= CONFIG.ram.maxUpgrades)
        return { ok: false, message: 'RAM al máximo.' };
      if (typeof GameState !== 'undefined' && !GameState.spendMoney(cost))
        return { ok: false, message: `Fondos insuficientes ($${cost.toLocaleString('es-AR')} CR).` };
      _state.ram.upgrades++;
      _state.ram.max += CONFIG.ram.perUpgrade;
      if (window.LedgerSystem) LedgerSystem.onBuy(cost, `Hardware: RAM +${CONFIG.ram.perUpgrade}GB`);
      _notify('hardware_upgraded', { type: 'ram', max: _state.ram.max });
      return { ok: true, newMax: _state.ram.max, cost };
    },

    upgradeStorage() {
      const cost = 500 * Math.pow(2, _state.storage.upgrades);
      if (_state.storage.upgrades >= CONFIG.storage.maxUpgrades)
        return { ok: false, message: 'Almacenamiento al máximo.' };
      if (typeof GameState !== 'undefined' && !GameState.spendMoney(cost))
        return { ok: false, message: `Fondos insuficientes ($${cost.toLocaleString('es-AR')} CR).` };
      _state.storage.upgrades++;
      _state.storage.max += CONFIG.storage.perUpgrade;
      if (window.LedgerSystem) LedgerSystem.onBuy(cost, `Hardware: Storage +${CONFIG.storage.perUpgrade}GB`);
      _notify('hardware_upgraded', { type: 'storage', max: _state.storage.max });
      return { ok: true, newMax: _state.storage.max, cost };
    },

    // ── Reparación de herramienta quemada ─────────────────────────

    repairTool(id) {
      const tool = _state.tools[id];
      const def  = TOOL_CATALOG[id];
      if (!tool || !def) return { ok: false, message: 'Herramienta no encontrada.' };
      const cost = Math.floor(def.price * 0.3 + tool.burn * 5);
      if (typeof GameState !== 'undefined' && !GameState.spendMoney(cost))
        return { ok: false, message: `Reparación cuesta $${cost.toLocaleString('es-AR')} CR.` };
      tool.burn = 0;
      _notify('tool_repaired', { id });
      return { ok: true, cost };
    },

    // ── Estado serializable para SaveSystem ─────────────────────

    getStats() {
      return {
        ram:        this.getRam(),
        storage:    this.getStorage(),
        anonymity:  this.getAnonymity(),
        tools:      this.getLocalTools(),
        toolCount:  Object.keys(_state.tools).length,
        activeCount: Object.values(_state.tools).filter(t => t.status === 'active').length,
      };
    },

    /** BUG #2 FIX: expone upgrade counts sin acceder a _state desde fuera del closure */
    getHardwareInfo() {
      return {
        ram: {
          max:      _state.ram.max,
          upgrades: _state.ram.upgrades,
          maxUpgrades: CONFIG.ram.maxUpgrades,
          nextCost: _state.ram.upgrades < CONFIG.ram.maxUpgrades
            ? 1000 * Math.pow(2, _state.ram.upgrades)
            : null,
        },
        storage: {
          max:      _state.storage.max,
          upgrades: _state.storage.upgrades,
          maxUpgrades: CONFIG.storage.maxUpgrades,
          nextCost: _state.storage.upgrades < CONFIG.storage.maxUpgrades
            ? 500 * Math.pow(2, _state.storage.upgrades)
            : null,
        },
      };
    },

    // Para SaveSystem
    serialize()     { return JSON.parse(JSON.stringify(_state)); },
    restore(saved)  {
      if (saved) {
        _state = { ...saved };
        _notify('restored', _state);
      }
    },

    reset() {
      _state = {
        ram:       { max: CONFIG.ram.base, upgrades: 0 },
        storage:   { max: CONFIG.storage.base, upgrades: 0 },
        anonymity: 100,
        tools:     {},
      };
    },
  };

  return API;
})();
