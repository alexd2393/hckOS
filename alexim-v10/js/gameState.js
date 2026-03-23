/**
 * gameState.js — Global Game State Manager
 * AleXim OS — Hacking Narrative Game
 *
 * Singleton module exposing the full game state and mutation API.
 * Other modules read state via getters and write via named methods,
 * never by touching the private _state object directly.
 *
 * Event system: GameState.on(event, callback) for reactive UI updates.
 */

const GameState = (() => {

  // ─── Private State ────────────────────────────────────────────
  let _state = {

    player: {
      name:       'Ghost',
      alias:      'ghost_0x1',
      money:       500,
      reputation:  0,
    },

    // 0–100: triggers a "busted" event at 100
    suspicion: 0,

    vpnActive: false,

    // ── Installed software ─────────────────────────────────────
    software: {
      scanner: {
        installed: true,  level: 1,
        name: 'NetScan',  desc: 'Basic network scanner — reveals hosts and open ports.',
      },
      cryptbreak: {
        installed: false, level: 0,
        name: 'CryptBreak', desc: 'Descifra archivos encriptados para poder descargarlos.',
      },
      vpn: {
        installed: false, level: 0,
        name: 'GhostVPN',  desc: 'Enmascara tu identidad. Reduce heat. Bypassea FIREWALL, PROXY, IDS.',
      },
      brutex: {
        installed: false, level: 0,
        name: 'BruteX',    desc: 'Fuerza bruta de credenciales. Bypassea FIREWALL y AUTH.',
      },
      shieldwall: {
        installed: false, level: 0,
        name: 'ShieldWall', desc: 'Firewall personal. Bloquea rastreos activos entrantes.',
      },
      // v10.3: firewall_bypass viene pre-instalado — es el kit básico del sistema
      phantom: {
        installed: true, level: 1,
        name: 'Phantom v1', desc: 'Evasión de firewall básica. Pre-instalada en el sistema.',
      },
    },

    // ── Mission tracking ───────────────────────────────────────
    missions: {
      current:   null,
      completed: [],
      available: ['intro_mission'],
      flags:     {},
    },

    // ── Simulated filesystem ───────────────────────────────────
    filesystem: {
      '/home/ghost': {
        'readme.txt': {
          type: 'file',
          content: 'Welcome to AleXim OS 2.4.1.\nStay hidden. Stay careful.\nUse the Terminal to get started.',
        },
        'notes.txt': {
          type: 'file',
          content: 'TODO:\n  - Find a contact in the underground.\n  - Upgrade scanner to level 2.\n  - Investigate corp-server-01.',
        },
      },
      '/home/ghost/downloads': {},
      '/home/ghost/tools':     {},
      '/home/ghost/.config': {
        'alexim.conf': {
          type: 'file',
          content: '[system]\ntheme=dark\naudio=on\nautosave=true\n\n[network]\ndefault_iface=eth0\ntimeout=30',
        },
      },
      '/var/log': {
        'system.log': {
          type: 'file',
          content: '[INFO]  Boot complete — AleXim OS 2.4.1\n[INFO]  Network interface eth0 up\n[WARN]  Anomalous packet burst detected on 10.0.0.0/8\n[INFO]  Firewall rules loaded',
        },
      },
      '/tmp': {},
    },

    currentPath: '/home/ghost',

    // ── Network ────────────────────────────────────────────────
    network: {
      connectedTo:  null,
      knownTargets: [
        { ip: '192.168.1.1',  hostname: 'router.local',    open: false, scanned: false, services: ['22/ssh', '80/http'] },
        { ip: '10.0.0.42',    hostname: 'corp-server-01',  open: false, scanned: false, services: ['22/ssh', '443/https', '3306/mysql'] },
        { ip: '172.16.0.7',   hostname: 'unknown',         open: false, scanned: false, services: ['8080/http-alt'] },
        { ip: '10.0.0.99',    hostname: 'darknode-relay',  open: false, scanned: false, services: ['9050/tor'] },
      ],
    },

    // ── Narrative / story ──────────────────────────────────────
    narrative: {
      day: 1,
      contacts: {
        nexus: {
          known: false, name: 'Nexus',
          trust: 0, lastSeen: null,
          messages: [],
        },
        shadow: {
          known: false, name: 'Shadow',
          trust: 0, lastSeen: null,
          messages: [],
        },
      },
      events: [],
      flags: {
        tutorial_done:    false,
        first_scan:       false,
        first_connect:    false,
        first_download:   false,
        first_decrypt:    false,
        nexus_contacted:  false,
        corp_breach:      false,
      },
    },
  };

  // ─── Event Listeners ──────────────────────────────────────────
  const _listeners = {};

  function _notify(event, data) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(data); }
      catch (e) { console.error(`[GameState] Listener error on "${event}":`, e); }
    });
  }

  // ─── Public API ───────────────────────────────────────────────
  return {

    // ── Generic access ────────────────────────────────────────
    /**
     * Deep-read any state value by dot-path, e.g. 'player.money'.
     * Returns undefined if path does not exist.
     */
    get(key) {
      return key.split('.').reduce((obj, k) => (obj ?? {})[k], _state);
    },

    /** Returns a shallow clone of the root state (for debugging). */
    snapshot() { return JSON.parse(JSON.stringify(_state)); },

    // ── Player / money ────────────────────────────────────────
    getMoney()       { return _state.player.money; },
    getAlias()       { return localStorage.getItem('alexim_alias') || _state.player.alias; },
    setAlias(alias)   {
      if (!alias?.trim()) return;
      _state.player.alias = alias.trim();
      localStorage.setItem('alexim_alias', alias.trim());
      _notify('alias', alias.trim());
    },
    getReputation()  { return _state.player.reputation; },

    addMoney(amount) {
      _state.player.money += amount;
      _notify('money', _state.player.money);
      return _state.player.money;
    },

    spendMoney(amount) {
      if (_state.player.money < amount) return false;
      _state.player.money -= amount;
      _notify('money', _state.player.money);
      return true;
    },

    // ── Suspicion ─────────────────────────────────────────────
    getSuspicion() { return _state.suspicion; },

    addSuspicion(amount) {
      // VPN halves suspicion gain
      const effective = _state.vpnActive ? Math.floor(amount / 2) : amount;
      _state.suspicion = Math.min(100, _state.suspicion + effective);
      _notify('suspicion', _state.suspicion);
      if (_state.suspicion >= 100) _notify('busted', {});
      return _state.suspicion;
    },

    reduceSuspicion(amount) {
      _state.suspicion = Math.max(0, _state.suspicion - amount);
      _notify('suspicion', _state.suspicion);
      return _state.suspicion;
    },

    // ── VPN ───────────────────────────────────────────────────
    isVpnActive()  { return _state.vpnActive; },
    toggleVpn()    {
      _state.vpnActive = !_state.vpnActive;
      _notify('vpn', _state.vpnActive);
      return _state.vpnActive;
    },

    // ── Software ──────────────────────────────────────────────
    getSoftware()     { return _state.software; },
    hasSoftware(id)   { return !!_state.software[id]?.installed; },

    installSoftware(id) {
      if (!_state.software[id]) return false;
      _state.software[id].installed = true;
      _state.software[id].level     = 1;
      _notify('software', { id, software: _state.software[id] });
      return true;
    },

    upgradeSoftware(id) {
      if (!_state.software[id]?.installed) return false;
      _state.software[id].level++;
      _notify('software', { id, software: _state.software[id] });
      return true;
    },

    // ── Filesystem ────────────────────────────────────────────
    getFilesystem()    { return _state.filesystem; },
    getCurrentPath()   { return _state.currentPath; },

    getDir(path) {
      return _state.filesystem[path] ?? null;
    },

    addFile(path, name, content) {
      if (!_state.filesystem[path]) _state.filesystem[path] = {};
      _state.filesystem[path][name] = { type: 'file', content };
      _notify('filesystem', { path, name });
    },

    deleteFile(path, name) {
      if (!_state.filesystem[path]?.[name]) return false;
      delete _state.filesystem[path][name];
      _notify('filesystem', { path, name, deleted: true });
      return true;
    },

    setPath(path) {
      if (_state.filesystem[path] === undefined) return false;
      _state.currentPath = path;
      _notify('path', path);
      return true;
    },

    // ── Network ───────────────────────────────────────────────
    getNetwork()    { return _state.network; },
    isConnected()   { return !!_state.network.connectedTo; },
    getConnection() { return _state.network.connectedTo; },

    scanTarget(ip) {
      const t = _state.network.knownTargets.find(h => h.ip === ip);
      if (!t) return null;
      t.scanned = true;
      _notify('network', _state.network);
      return t;
    },

    connectTo(ip) {
      const t = _state.network.knownTargets.find(h => h.ip === ip);
      if (!t) return null;
      _state.network.connectedTo = t;
      _notify('network', _state.network);
      return t;
    },

    disconnect() {
      _state.network.connectedTo = null;
      _notify('network', _state.network);
    },

    // ── Missions ──────────────────────────────────────────────
    getMissions()       { return _state.missions; },
    getMissionFlag(f)   { return !!_state.missions.flags[f]; },

    setMissionFlag(flag, value = true) {
      _state.missions.flags[flag] = value;
      _notify('mission', { flag, value });
    },

    completeMission(id) {
      _state.missions.completed.push(id);
      _state.missions.current = null;
      _notify('mission', { completed: id });
    },

    // ── Narrative flags ───────────────────────────────────────
    getNarrative()      { return _state.narrative; },
    getFlag(key)        { return _state.narrative.flags[key]; },

    setFlag(key, value = true) {
      _state.narrative.flags[key] = value;
      _notify('flag', { key, value });
    },

    advanceDay() {
      _state.narrative.day++;
      _notify('day', _state.narrative.day);
      return _state.narrative.day;
    },

    unlockContact(id) {
      if (!_state.narrative.contacts[id]) return false;
      _state.narrative.contacts[id].known = true;
      _notify('contact', { id });
      return true;
    },

    addMessage(contactId, sender, text) {
      const c = _state.narrative.contacts[contactId];
      if (!c) return false;
      c.messages.push({ sender, text, time: Date.now() });
      _notify('message', { contactId, sender, text });
      return true;
    },

    // ── Event system ──────────────────────────────────────────
    on(event, callback) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(callback);
    },

    off(event, callback) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(cb => cb !== callback);
    },

    // ── Persistence ───────────────────────────────────────────
    save() {
      try {
        localStorage.setItem('alexim_save_v1', JSON.stringify(_state));
        return true;
      } catch (e) {
        console.error('[GameState] Save failed:', e);
        return false;
      }
    },

    load() {
      try {
        const raw = localStorage.getItem('alexim_save_v1');
        if (!raw) return false;
        _state = JSON.parse(raw);
        _notify('load', _state);
        return true;
      } catch (e) {
        console.error('[GameState] Load failed:', e);
        return false;
      }
    },

    reset() {
      localStorage.removeItem('alexim_save_v1');
      location.reload();
    },
  };

})();
