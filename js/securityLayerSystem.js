/**
 * securityLayerSystem.js — Capas de Seguridad por Nodo
 * AleXim Mobile v8 — Hacking Engine
 *
 * Cada nodo tiene un stack de capas de seguridad que el jugador
 * debe atravesar en orden antes de poder descargar archivos.
 *
 * Capas disponibles (ordenadas por dificultad ascendente):
 *   FIREWALL     — filtrado de paquetes, primer obstáculo
 *   PROXY        — ofusca tráfico, introduce latencia
 *   IDS          — detección de intrusos, sube heat si es detectado
 *   AUTH         — autenticación de credenciales
 *   ENCRYPTION   — cifrado de disco (solo nodos Sec 4-5)
 *
 * API:
 *   SecurityLayerSystem.getStack(ip)           → Layer[]
 *   SecurityLayerSystem.getNextLayer(ip)       → Layer | null (null = todo bypaseado)
 *   SecurityLayerSystem.bypass(ip, layerId, toolId) → { ok, layer, heatCost, noise }
 *   SecurityLayerSystem.isFullyBypassed(ip)    → boolean
 *   SecurityLayerSystem.reset(ip)              → void
 *   SecurityLayerSystem.buildForNode(node)     → Layer[]
 *   SecurityLayerSystem.getReconInfo(ip)       → ReconInfo (lo que se puede saber sin hackear)
 */

window.SecurityLayerSystem = (() => {
  'use strict';

  // ─── Definición de capas ───────────────────────────────────────
  const LAYER_DEFS = {

    FIREWALL: {
      id:     'FIREWALL',
      name:   'Firewall',
      icon:   '🔥',
      desc:   'Filtrado de paquetes. Primer obstáculo. Bloquea conexiones no autorizadas.',
      tools:  ['phantom', 'brutex', 'vpn'],
      noiseBase:   3,     // heat generado al intentar bypass exitoso
      noiseFail:   8,     // heat generado al fallar
      timeBase:    1500,  // ms base de bypass
    },

    PROXY: {
      id:     'PROXY',
      name:   'Proxy Inverso',
      icon:   '🔀',
      desc:   'Redirige el tráfico. Dificulta el rastreo pero también el acceso.',
      tools:  ['proxyx', 'vpn', 'phantom'],
      noiseBase:   2,
      noiseFail:   5,
      timeBase:    2000,
    },

    IDS: {
      id:     'IDS',
      name:   'IDS — Intrusion Detection',
      icon:   '👁',
      desc:   'Detecta patrones anómalos. Si te detecta, alerta al sysadmin y sube el heat fuerte.',
      tools:  ['ghostwalk', 'proxyx', 'vpn'],
      noiseBase:   5,
      noiseFail:   18,   // detección = fuerte subida de heat
      timeBase:    3000,
    },

    AUTH: {
      id:     'AUTH',
      name:   'Servidor de Autenticación',
      icon:   '🔑',
      desc:   'Credenciales requeridas. Necesitás crackearlas o tener info previa.',
      tools:  ['hashcrack', 'brutex', 'fisherman'],
      noiseBase:   6,
      noiseFail:   12,
      timeBase:    4000,
    },

    ENCRYPTION: {
      id:     'ENCRYPTION',
      name:   'Cifrado de Disco',
      icon:   '🔒',
      desc:   'Los datos están cifrados. Solo CryptBreak puede abrir archivos individuales.',
      tools:  ['cryptbreak', 'quantumcrack'],
      noiseBase:   4,
      noiseFail:   6,
      timeBase:    5000,
    },
  };

  // ─── Stacks por nivel de seguridad ────────────────────────────
  const STACKS_BY_SEC = {
    1: ['FIREWALL'],
    2: ['FIREWALL', 'PROXY'],
    3: ['FIREWALL', 'PROXY', 'IDS'],
    4: ['FIREWALL', 'PROXY', 'IDS', 'AUTH'],
    5: ['FIREWALL', 'PROXY', 'IDS', 'AUTH', 'ENCRYPTION'],
  };

  // ─── Herramientas y sus capacidades ───────────────────────────
  const TOOL_POWER = {
    // Nativas del juego (ya existentes como software)
    shieldwall:         { bypasses: ['FIREWALL'],            speedMult: 0.85, successBonus: 0.10 },
    brutex:       { bypasses: ['FIREWALL','AUTH'],     speedMult: 0.70, successBonus: 0.15 },
    vpn:              { bypasses: ['FIREWALL','PROXY','IDS'], speedMult: 1.00, successBonus: 0.08, noiseReduce: 0.40 },
    cryptbreak:        { bypasses: ['ENCRYPTION'],          speedMult: 0.90, successBonus: 0.20 },
    fisherman:         { bypasses: ['AUTH'],                speedMult: 1.20, successBonus: 0.12 },
    quantumcrack:      { bypasses: ['ENCRYPTION'],          speedMult: 0.80, successBonus: 0.25 },
    scanner:          { bypasses: [],                      speedMult: 1.00, successBonus: 0.04, recon: true },
    // Nuevas herramientas v8
    phantom:  { bypasses: ['FIREWALL'],            speedMult: 0.60, successBonus: 0.20 },
    proxyx:   { bypasses: ['PROXY','IDS'],         speedMult: 0.75, successBonus: 0.18, noiseReduce: 0.30 },
    ghostwalk:      { bypasses: ['IDS'],                 speedMult: 0.80, successBonus: 0.25, noiseReduce: 0.50 },
    hashcrack: { bypasses: ['AUTH'],                speedMult: 0.65, successBonus: 0.22 },
    logwipe:        { bypasses: [],                      speedMult: 1.00, successBonus: 0.00, wipesLog: true },
  };

  // ─── Estado: ip → Layer[] ──────────────────────────────────────
  const _stacks = new Map();      // ip → Layer[]
  const _reconCache = new Map();  // ip → ReconInfo

  // ─── Construir un layer con estado ────────────────────────────
  function _makeLayer(layerId, sec) {
    const def = LAYER_DEFS[layerId];
    if (!def) return null;
    const secMult = 0.7 + sec * 0.15;   // nivel de seguridad afecta dificultad
    return {
      id:         def.id,
      name:       def.name,
      icon:       def.icon,
      desc:       def.desc,
      tools:      [...def.tools],
      noiseBase:  Math.round(def.noiseBase  * secMult),
      noiseFail:  Math.round(def.noiseFail  * secMult),
      timeMs:     Math.round(def.timeBase   * secMult),
      bypassed:   false,
      bypassedWith: null,
      bypassedAt:   null,
    };
  }

  // ─── Construir stack para un nodo ─────────────────────────────
  function _buildStack(node) {
    const sec    = Math.min(5, Math.max(1, node.security ?? 1));
    const ids    = STACKS_BY_SEC[sec] ?? ['FIREWALL'];
    return ids.map(id => _makeLayer(id, sec));
  }

  // ─── Calcular probabilidad de bypass ─────────────────────────
  function _calcChance(layer, toolId, toolLevel) {
    const tp = TOOL_POWER[toolId];
    if (!tp) return 0.15;                                    // sin tool = muy baja
    if (!tp.bypasses.includes(layer.id)) return 0.20;       // tool incorrecta = mala
    const base    = 0.55 + (toolLevel ?? 1) * 0.10;
    const bonus   = tp.successBonus;
    // VPN reduce el calor pero no mejora mucho la chance
    const vpnBonus = toolId === 'vpn' ? 0 : 0;
    return Math.min(0.95, base + bonus + vpnBonus);
  }

  // ─── API Pública ──────────────────────────────────────────────
  const API = {

    /**
     * Construye y almacena el stack de capas para un nodo.
     * Se llama cuando el jugador hace `connect` o `recon`.
     */
    buildForNode(node) {
      if (!node?.ip) return [];
      if (_stacks.has(node.ip)) return _stacks.get(node.ip);
      const stack = _buildStack(node);
      _stacks.set(node.ip, stack);
      return stack;
    },

    /**
     * Retorna el stack completo de un nodo (capas con estado).
     */
    getStack(ip) {
      return _stacks.get(ip) ?? [];
    },

    /**
     * Retorna la próxima capa no bypasseada, o null si todo está limpio.
     */
    getNextLayer(ip) {
      const stack = _stacks.get(ip) ?? [];
      return stack.find(l => !l.bypassed) ?? null;
    },

    /**
     * ¿El nodo tiene todas las capas bypaseadas?
     */
    isFullyBypassed(ip) {
      const stack = _stacks.get(ip) ?? [];
      return stack.length > 0 && stack.every(l => l.bypassed);
    },

    /**
     * Intentar bypasear la próxima capa del nodo.
     * @param {string} ip
     * @param {string} toolId  — herramienta a usar
     * @param {number} toolLevel — nivel de la herramienta
     * @returns {{ ok, layer, success, heatCost, timeCost, noise, message }}
     */
    async bypass(ip, toolId, toolLevel = 1) {
      const stack = _stacks.get(ip);
      if (!stack) return { ok: false, message: 'Stack no inicializado. Hacé recon primero.' };

      const layer = stack.find(l => !l.bypassed);
      if (!layer) return { ok: false, message: 'Todas las capas están bypaseadas.' };

      const tp = TOOL_POWER[toolId];

      // v10: tiempo de bypass con varianza + multiplicador de speed de LocalSystem
      const variance  = 0.8 + Math.random() * 0.4;
      const localSpeedMult = window.LocalSystem?.getSpeedMultiplier?.(toolId) ?? 1.0;
      const timeCost  = Math.round(layer.timeMs * variance * (tp?.speedMult ?? 1.0) * localSpeedMult);

      // Simular tiempo de espera
      await new Promise(r => setTimeout(r, timeCost));

      const chance  = _calcChance(layer, toolId, toolLevel);

      // v10: aplicar bonus de bypass de LocalSystem (ejes power y stealth)
      const LS = window.LocalSystem;
      const localBonus  = LS?.getBypassBonus?.(toolId, layer.id) ?? 0;
      // BUG #3 FIX: speedMult ya se calcula arriba como localSpeedMult — eliminada variable muerta
      const stealthMult = LS?.getStealthMultiplier?.(toolId) ?? 1.0;

      // Phishing bonus: si el jugador preparó un ataque con 'phish' para este nodo
      let phishBonus = 0;
      if (layer.id === 'AUTH' && window.HackingEngine) {
        const sess = HackingEngine.getSession(ip);
        if (sess?._phishBonus) {
          phishBonus = sess._phishBonus;
          // Consume el bonus (un solo uso)
          delete sess._phishBonus;
          delete sess._phishTarget;
        }
      }
      const adjustedChance = Math.min(0.97, chance + localBonus + phishBonus);
      const success = Math.random() < adjustedChance;

      // Noise/Heat con reducción por VPN, proxy_redirect y stealth de LocalSystem
      const noiseReduce = tp?.noiseReduce ?? 0;
      const vpnActive   = typeof GameState !== 'undefined' && GameState.isVpnActive?.();
      const vpnMult     = vpnActive ? 0.5 : 1.0;
      const heatCost    = success
        ? Math.round(layer.noiseBase * (1 - noiseReduce) * vpnMult * stealthMult)
        : Math.round(layer.noiseFail * vpnMult * stealthMult);

      if (success) {
        layer.bypassed     = true;
        layer.bypassedWith = toolId;
        layer.bypassedAt   = Date.now();
      }

      // Aplicar heat
      if (typeof ReputationSystem !== 'undefined') {
        ReputationSystem.addHeat(heatCost, `layer_${layer.id.toLowerCase()}_${success ? 'ok' : 'fail'}`);
      }

      // IDS fallido = alerta adicional
      if (!success && layer.id === 'IDS') {
        if (typeof UI !== 'undefined') UI.notify('👁 IDS activado — sistema alertado', 'error', 7000);
        if (window.PursuitSystem && Math.random() > 0.5) PursuitSystem.startTrace?.();
      }

      const nextLayer = stack.find(l => !l.bypassed);
      const fullyBypassed = !nextLayer;

      return {
        ok:       true,
        success,
        layer,
        heatCost,
        timeCost,
        fullyBypassed,
        nextLayer:  nextLayer ?? null,
        message:  success
          ? `✓ ${layer.name} bypaseado con ${toolId}`
          : `✗ ${layer.name} rechazó el ataque con ${toolId}`,
      };
    },

    /**
     * Info de reconocimiento que se obtiene sin hackear.
     * Varía según si se tiene `scanner` instalado.
     */
    getReconInfo(ip, hasScanner = false) {
      if (_reconCache.has(ip) && !hasScanner) return _reconCache.get(ip);

      const stack = _stacks.get(ip) ?? [];
      const node  = window.NetworkSystem?.getKnownNodes?.().find(n => n.ip === ip);
      if (!node) return null;

      // Sin scanner: info básica
      const basic = {
        ip,
        hostname:     node.hostname,
        type:         node.type,
        security:     node.security,
        layerCount:   stack.length,
        layerNames:   stack.map(l => l.id),    // nombres de capas
        ping:         `${20 + Math.floor(Math.random() * 80)}ms`,
        os:           _guessOS(node.type),
        openPorts:    _genPorts(node.security, hasScanner),
        vulnerabilities: hasScanner ? _genVulns(node.security) : [],
        bannerGrab:   hasScanner ? `${node.hostname} — ${_guessOS(node.type)} — v${_rndVer()}` : null,
      };

      _reconCache.set(ip, basic);
      return basic;
    },

    /** Reset de capas (si el nodo se re-asegura) */
    reset(ip) {
      _stacks.delete(ip);
      _reconCache.delete(ip);
    },

    getTool(toolId) { return TOOL_POWER[toolId] ?? null; },
    getAllTools()   { return { ...TOOL_POWER }; },
    getLayerDefs() { return { ...LAYER_DEFS }; },
  };

  // ─── Helpers ───────────────────────────────────────────────────
  function _rndInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function _rndVer()     { return `${_rndInt(1,9)}.${_rndInt(0,9)}.${_rndInt(0,9)}`; }

  function _guessOS(type) {
    const oses = { BANK:'Ubuntu 22.04 LTS', GOVERNMENT:'CentOS 7', HOSPITAL:'Windows Server 2019',
      CORPORATE:'Debian 11', RESEARCH:'Fedora 38', MEDIA:'Ubuntu 20.04', ROUTER:'RouterOS 7.x', ISP:'Cisco IOS-XE' };
    return oses[type] ?? 'Linux 5.x';
  }

  function _genPorts(sec, detailed) {
    const common = [22, 80, 443];
    const extra  = sec >= 2 ? [3306, 5432] : [];
    const high   = sec >= 3 ? [8080, 8443, 9200] : [];
    const vhigh  = sec >= 4 ? [27017, 6379, 11211] : [];
    const all    = [...common, ...extra, ...(detailed ? [...high, ...vhigh] : [])];
    return all.map(p => ({
      port:    p,
      service: _portService(p),
      state:   'open',
    }));
  }

  function _portService(p) {
    const m = { 22:'SSH', 80:'HTTP', 443:'HTTPS', 3306:'MySQL', 5432:'PostgreSQL',
      8080:'HTTP-Alt', 8443:'HTTPS-Alt', 9200:'Elasticsearch', 27017:'MongoDB',
      6379:'Redis', 11211:'Memcached' };
    return m[p] ?? 'unknown';
  }

  function _genVulns(sec) {
    const pool = [
      { id:'CVE-2023-44487', name:'HTTP/2 Rapid Reset', severity:'HIGH' },
      { id:'CVE-2021-44228', name:'Log4Shell (Log4j)',   severity:'CRITICAL' },
      { id:'CVE-2022-22963', name:'Spring4Shell',        severity:'HIGH' },
      { id:'CVE-2023-23397', name:'Outlook NTLM Leak',   severity:'MEDIUM' },
      { id:'CVE-2023-20198', name:'Cisco IOS XE privesc',severity:'CRITICAL' },
      { id:'CVE-2022-42889', name:'Text4Shell',          severity:'HIGH' },
      { id:'CVE-2023-34362', name:'MOVEit SQL Injection',severity:'CRITICAL' },
      { id:'CVE-2024-3400',  name:'PAN-OS Cmd Injection',severity:'CRITICAL' },
    ];
    // Servidores menos seguros tienen más vulns conocidas
    const count = Math.max(0, 5 - sec);
    return pool.slice(0, count);
  }

  return API;
})();
