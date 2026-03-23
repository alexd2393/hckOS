/**
 * terminal.js — Terminal Emulator
 * AleXim OS — Hacking Narrative Game
 *
 * Instantiate with: new Terminal(containerElement)
 *
 * Features:
 *  - Command registry — register any command from any module
 *  - History navigation with ArrowUp/ArrowDown
 *  - Tab autocomplete (commands + filenames)
 *  - Async / lock support for long-running commands
 *  - Typed output lines with colour classes
 */

class Terminal {

  /**
   * @param {HTMLElement} containerEl — element that will contain the terminal
   */
  constructor(containerEl) {
    this._uid       = Math.random().toString(36).slice(2, 8);
    this.container  = containerEl;
    this.commands   = {};      // { name: { handler, help, usage } }
    this.history    = [];      // command history (newest first)
    this.histIdx    = -1;      // current history navigation index
    this.isLocked   = false;   // true while async command is running

    this._outputEl  = null;
    this._inputEl   = null;
    this._promptEl  = null;

    this._buildDOM();
    this._bindEvents();
    this._registerBuiltins();

    this.printLine('AleXim Terminal  v1.0', 'system');
    this.printLine('Type "help" for available commands.', 'muted');
    this.printBlank();
    this._updatePrompt();
  }

  // ═══════════════════════════════════════════════════════════════
  // DOM
  // ═══════════════════════════════════════════════════════════════

  _buildDOM() {
    this.container.innerHTML = `
      <div class="terminal-inner">
        <div class="terminal-output" id="to-${this._uid}"></div>
        <div class="terminal-input-line">
          <span class="terminal-prompt" id="tp-${this._uid}">$ </span>
          <input
            class="terminal-input"
            id="ti-${this._uid}"
            type="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          >
        </div>
      </div>
    `;
    this._outputEl = this.container.querySelector(`#to-${this._uid}`);
    this._inputEl  = this.container.querySelector(`#ti-${this._uid}`);
    this._promptEl = this.container.querySelector(`#tp-${this._uid}`);
    setTimeout(() => this._inputEl.focus(), 50);
  }

  _bindEvents() {
    this._inputEl.addEventListener('keydown', e => {
      if (this.isLocked) { e.preventDefault(); return; }

      switch (e.key) {

        case 'Enter': {
          const raw = this._inputEl.value.trim();
          this._inputEl.value = '';
          this.histIdx = -1;
          if (!raw) { this._echoPrompt(''); this.printBlank(); break; }
          if (this.history[0] !== raw) this.history.unshift(raw);
          if (this.history.length > 100) this.history.pop();
          this._echoPrompt(raw);
          this._execute(raw);
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (this.histIdx < this.history.length - 1) {
            this.histIdx++;
            this._inputEl.value = this.history[this.histIdx];
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (this.histIdx > 0) {
            this.histIdx--;
            this._inputEl.value = this.history[this.histIdx];
          } else {
            this.histIdx = -1;
            this._inputEl.value = '';
          }
          break;
        }

        case 'Tab': {
          e.preventDefault();
          this._autocomplete();
          break;
        }

        case 'l':
          if (e.ctrlKey) { e.preventDefault(); this.clear(); }
          break;

        default:
          AudioSystem.keyClick();
          break;
      }
    });

    // Click anywhere inside terminal to focus input
    this.container.addEventListener('click', () => this._inputEl.focus());
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTOCOMPLETE
  // ═══════════════════════════════════════════════════════════════

  _autocomplete() {
    const line  = this._inputEl.value;
    const parts = line.trimStart().split(/\s+/);

    if (parts.length <= 1) {
      // Complete command name
      const partial  = parts[0] || '';
      const matches  = Object.keys(this.commands).filter(c => c.startsWith(partial));
      if (matches.length === 1) {
        this._inputEl.value = matches[0] + ' ';
      } else if (matches.length > 1) {
        this.printLine(matches.join('   '), 'muted');
      }
    } else {
      // Complete filename in current directory
      const partial = parts[parts.length - 1];
      const dir     = GameState.getDir(GameState.getCurrentPath()) ?? {};
      const matches = Object.keys(dir).filter(n => n.startsWith(partial));
      if (matches.length === 1) {
        parts[parts.length - 1] = matches[0];
        this._inputEl.value = parts.join(' ');
      } else if (matches.length > 1) {
        this.printLine(matches.join('   '), 'muted');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Append a plain-text line.
   * type: 'normal' | 'system' | 'success' | 'error' | 'warning' | 'muted'
   */
  printLine(text, type = 'normal') {
    const el = document.createElement('div');
    el.className = `term-line term-${type}`;
    el.textContent = text;
    this._outputEl.appendChild(el);
    this._scroll();
    return el;
  }

  /** Append a line that renders HTML (use sparingly). */
  printHTML(html, extraClass = '') {
    const el = document.createElement('div');
    el.className = `term-line ${extraClass}`;
    el.innerHTML = html;
    this._outputEl.appendChild(el);
    this._scroll();
    return el;
  }

  /** Append a blank spacer line. */
  printBlank() {
    const el = document.createElement('div');
    el.className = 'term-line term-blank';
    this._outputEl.appendChild(el);
    this._scroll();
  }

  /** Print multiple lines from an array of {text, type} objects, with optional delay. */
  async printLines(lines, delayMs = 40) {
    for (const { text, type = 'normal' } of lines) {
      if (delayMs > 0) await _delay(delayMs);
      this.printLine(text, type);
    }
  }

  /** Print a horizontal rule. */
  printRule(char = '─', len = 44) {
    this.printLine(char.repeat(len), 'muted');
  }

  /** Clear all output. */
  clear() {
    this._outputEl.innerHTML = '';
  }

  // ═══════════════════════════════════════════════════════════════
  // COMMAND REGISTRY
  // ═══════════════════════════════════════════════════════════════

  /**
   * Register a new command.
   * @param {string}   name    - command name (lowercase, no spaces)
   * @param {Function} handler - (args: string[], term: Terminal) => void | Promise<void>
   * @param {string}   help    - short one-line description
   * @param {string}   [usage] - usage hint shown by help
   */
  registerCommand(name, handler, help = '', usage = '') {
    this.commands[name.toLowerCase()] = { handler, help, usage };
  }

  // ═══════════════════════════════════════════════════════════════
  // LOCK / UNLOCK (for async commands)
  // ═══════════════════════════════════════════════════════════════

  lock()   {
    this.isLocked = true;
    this._inputEl.disabled = true;
    this._promptEl.style.opacity = '0.3';
  }

  unlock() {
    this.isLocked = false;
    this._inputEl.disabled = false;
    this._promptEl.style.opacity = '';
    this._inputEl.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  _execute(input) {
    const parts = input.trim().split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    if (this.commands[cmd]) {
      try {
        const result = this.commands[cmd].handler(args, this);
        if (result instanceof Promise) {
          result
            .catch(err => {
              this.printLine(`[ERROR] ${err.message}`, 'error');
              this.unlock();
            })
            .finally(() => this.printBlank());
          return; // don't print blank here — wait for promise
        }
      } catch (err) {
        this.printLine(`[ERROR] ${err.message}`, 'error');
      }
    } else {
      AudioSystem.error();
      this.printLine(`Command not found: ${cmd}`, 'error');
      this.printLine('Type "help" for available commands.', 'muted');
    }

    this.printBlank();
    this._updatePrompt();
  }

  _echoPrompt(cmd) {
    const path = GameState.getCurrentPath().replace('/home/ghost', '~');
    const el   = document.createElement('div');
    el.className = 'term-line term-input-echo';
    el.innerHTML =
      `<span class="term-prompt-echo">ghost@alexim:${_escHtml(path)}$</span>` +
      (cmd ? ` <span class="term-cmd-text">${_escHtml(cmd)}</span>` : '');
    this._outputEl.appendChild(el);
    this._scroll();
  }

  _updatePrompt() {
    const path = GameState.getCurrentPath().replace('/home/ghost', '~');
    this._promptEl.textContent = `ghost@alexim:${path}$ `;
  }

  _scroll() {
    this._outputEl.scrollTop = this._outputEl.scrollHeight;
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILT-IN COMMANDS
  // ═══════════════════════════════════════════════════════════════

  _registerBuiltins() {

    // ── help ──────────────────────────────────────────────────────
    this.registerCommand('help', (args, t) => {
      t.printLine('Available commands', 'system');
      t.printRule();
      const sorted = Object.keys(t.commands).sort();
      sorted.forEach(name => {
        const { help, usage } = t.commands[name];
        t.printHTML(
          `<span class="term-cmd-name">${name.padEnd(14)}</span>` +
          `<span class="term-muted">${_escHtml(help)}</span>` +
          (usage ? ` <span style="color:var(--text-dim)"> — ${_escHtml(usage)}</span>` : '')
        );
      });
    }, 'List all available commands');

    // ── clear ─────────────────────────────────────────────────────
    this.registerCommand('clear', (args, t) => {
      t.clear();
    }, 'Clear terminal output');

    // ── pwd ───────────────────────────────────────────────────────
    this.registerCommand('pwd', (args, t) => {
      t.printLine(GameState.getCurrentPath());
    }, 'Print working directory');

    // ── whoami ────────────────────────────────────────────────────
    this.registerCommand('whoami', (args, t) => {
      t.printLine(GameState.getAlias(), 'success');
      t.printLine('Anonymous. Untraceable. Allegedly.', 'muted');
    }, 'Display current user identity');

    // ── date ──────────────────────────────────────────────────────
    this.registerCommand('date', (args, t) => {
      t.printLine(new Date().toString(), 'muted');
    }, 'Display current date and time');

    // ── echo ──────────────────────────────────────────────────────
    this.registerCommand('echo', (args, t) => {
      t.printLine(args.join(' '));
    }, 'Print text to terminal', 'echo <text...>');

    // ── ls ────────────────────────────────────────────────────────
    this.registerCommand('ls', (args, t) => {
      // Resolve target path
      let rawPath = args[0] ?? '';
      let path;
      if (!rawPath) {
        path = GameState.getCurrentPath();
      } else if (rawPath.startsWith('/')) {
        path = rawPath;
      } else if (rawPath === '..') {
        const parts = GameState.getCurrentPath().split('/').filter(Boolean);
        parts.pop();
        path = '/' + parts.join('/') || '/';
      } else if (rawPath === '~') {
        path = '/home/ghost';
      } else {
        path = GameState.getCurrentPath() + '/' + rawPath;
      }

      const fs   = GameState.getFilesystem();
      const dir  = GameState.getDir(path);

      if (!dir && !Object.keys(fs).some(k => k.startsWith(path + '/'))) {
        AudioSystem.error();
        t.printLine(`ls: no se puede acceder a '${path}': No existe el directorio`, 'error');
        return;
      }

      // Gather immediate subdirectories
      const subdirs = Object.keys(fs)
        .filter(k => {
          if (k === path) return false;
          const rel = k.startsWith(path + '/') ? k.slice(path.length + 1) : null;
          return rel && !rel.includes('/');
        })
        .map(k => k.split('/').pop());

      // Gather files in dir
      const fileEntries = dir ? Object.entries(dir) : [];

      if (subdirs.length === 0 && fileEntries.length === 0) {
        t.printLine('(directorio vacío)', 'muted');
        return;
      }

      // Header with path
      t.printHTML(`<span style="color:var(--cyan)">${_escHtml(path)}:</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">total ${subdirs.length + fileEntries.length}</span>`);

      // Subdirectories first (blue, drwxr-xr-x style)
      subdirs.sort().forEach(name => {
        t.printHTML(
          `<span style="color:var(--text-dim)">drwxr-xr-x  </span>` +
          `<span style="color:var(--cyan);font-weight:bold;">${_escHtml(name)}/</span>`
        );
      });

      // Files
      fileEntries.sort(([a],[b]) => a.localeCompare(b)).forEach(([name, entry]) => {
        const isHidden = name.startsWith('.');
        const size     = entry.size ?? entry.content?.length ?? 0;
        const sizeStr  = typeof size === 'string' ? size : _formatSize(size);
        const ext      = name.split('.').pop()?.toLowerCase();
        const color    = isHidden
          ? 'var(--text-dim)'
          : ext === 'enc' || ext === 'db' || ext === 'sql'
            ? 'var(--warn)'
            : 'var(--text-bright)';

        t.printHTML(
          `<span style="color:var(--text-dim)">-rw-r--r--  </span>` +
          `<span style="color:var(--text-muted);min-width:50px;display:inline-block;">${_escHtml(sizeStr)}</span>` +
          `<span style="color:${color}">${_escHtml(name)}</span>`
        );
      });
    }, 'Lista el contenido del directorio', 'ls [ruta]');

    // ── cd ────────────────────────────────────────────────────────
    this.registerCommand('cd', (args, t) => {
      if (!args[0] || args[0] === '~') {
        GameState.setPath('/home/ghost');
        t._updatePrompt();
        return;
      }

      let target = args[0];
      if (target === '..') {
        const parts = GameState.getCurrentPath().split('/').filter(Boolean);
        parts.pop();
        target = '/' + parts.join('/') || '/home/ghost';
      } else if (target === '-') {
        target = '/home/ghost';
      } else if (!target.startsWith('/')) {
        target = GameState.getCurrentPath() + '/' + target;
      }

      // Normalize double slashes
      target = target.replace(/\/+/g, '/');

      if (!GameState.setPath(target)) {
        // Also check if it's a valid path that exists in the filesystem keys
        const fs = GameState.getFilesystem();
        if (fs[target] !== undefined || Object.keys(fs).some(k => k.startsWith(target + '/'))) {
          // Path exists as a key but getDir returned null — create the mapping
          GameState._ensureDir?.(target);
          GameState.setPath(target);
          t._updatePrompt();
          return;
        }
        AudioSystem.error();
        t.printLine(`cd: ${args[0]}: No existe el directorio`, 'error');
        return;
      }
      t._updatePrompt();
    }, 'Cambia el directorio actual', 'cd <ruta>');

    // ── cat ───────────────────────────────────────────────────────
    this.registerCommand('cat', (args, t) => {
      if (!args[0]) { t.printLine('Uso: cat <archivo>', 'warning'); return; }
      const dir = GameState.getDir(GameState.getCurrentPath());
      if (!dir || !dir[args[0]]) {
        AudioSystem.error();
        t.printLine(`cat: ${args[0]}: No existe el archivo`, 'error');
        return;
      }
      const f = dir[args[0]];
      if (f.type !== 'file') { t.printLine(`cat: ${args[0]}: Es un directorio`, 'error'); return; }
      f.content.split('\n').forEach(line => t.printLine(line));
    }, 'Muestra el contenido de un archivo', 'cat <archivo>');

    // ── status ────────────────────────────────────────────────────
    this.registerCommand('status', (args, t) => {
      const net  = GameState.getNetwork();
      const susp = GameState.getSuspicion();
      t.printLine('══ SYSTEM STATUS ══', 'system');
      t.printLine(`Alias      : ${GameState.getAlias()}`);
      t.printLine(`Credits    : $${GameState.getMoney().toLocaleString()}`, 'success');
      t.printLine(`Suspicion  : ${susp}%`, susp > 50 ? 'error' : susp > 25 ? 'warning' : 'normal');
      t.printLine(`VPN        : ${GameState.isVpnActive() ? 'ACTIVE' : 'OFF'}`, GameState.isVpnActive() ? 'success' : 'muted');
      t.printLine(`Connected  : ${net.connectedTo?.hostname ?? 'None'}`, net.connectedTo ? 'success' : 'muted');
      t.printLine(`Day        : ${GameState.getNarrative().day}`);
      t.printRule();
      t.printLine('Installed software:', 'system');
      const sw = GameState.getSoftware();
      Object.entries(sw).forEach(([, s]) => {
        if (s.installed) {
          t.printHTML(
            `  <span class="term-success">✓</span> ` +
            `<span class="term-normal">${s.name.padEnd(14)}</span>` +
            `<span class="term-muted">Lv.${s.level}</span>`
          );
        }
      });
    }, 'Show player and system status');

    // ── scan ──────────────────────────────────────────────────────
    this.registerCommand('scan', async (args, t) => {
      if (!GameState.hasSoftware('scanner')) {
        AudioSystem.error();
        t.printLine('ERROR: NetScan not installed.', 'error');
        return;
      }

      const targets = GameState.getNetwork().knownTargets;

      if (args[0]) {
        // Specific IP
        const match = targets.find(h => h.ip === args[0] || h.hostname === args[0]);
        if (!match) {
          AudioSystem.error();
          t.printLine(`scan: no known host at ${args[0]}`, 'error');
          return;
        }
        t.printLine(`Scanning ${match.ip}...`, 'system');
        AudioSystem.scan();
        t.lock();
        await _delay(900);
        GameState.scanTarget(match.ip);
        t.printLine(`Host     : ${match.hostname}`, 'normal');
        t.printLine(`IP       : ${match.ip}`, 'normal');
        t.printLine(`Services : ${match.services.join(', ')}`, 'normal');
        AudioSystem.success();
        GameState.addSuspicion(2);
        GameState.setFlag('first_scan', true);
        t.unlock();
        t._updatePrompt();
        return;
      }

      // Full sweep
      t.printLine('Starting network sweep...', 'system');
      t.printLine(`Target range: 0.0.0.0/0`, 'muted');
      AudioSystem.scan();
      t.lock();
      await _delay(400);
      t.printLine('PING sweep...', 'muted');
      await _delay(300);

      for (const host of targets) {
        await _delay(500 + Math.random() * 200);
        GameState.scanTarget(host.ip);
        t.printHTML(
          `<span class="term-success">[FOUND]</span> ` +
          `<span class="term-normal">${host.ip.padEnd(16)}</span>` +
          `<span class="term-muted">${host.hostname}</span>`
        );
      }

      await _delay(200);
      t.printLine(`Scan complete — ${targets.length} host(s) found.`, 'success');
      GameState.addSuspicion(3);
      GameState.setFlag('first_scan', true);
      AudioSystem.success();
      t.unlock();
      t._updatePrompt();
    }, 'Scan network or specific host', 'scan [ip]');

    // ── connect ───────────────────────────────────────────────────
    this.registerCommand('connect', async (args, t) => {
      if (!args[0]) { t.printLine('Usage: connect <ip>', 'warning'); return; }

      const targets = GameState.getNetwork().knownTargets;
      const target  = targets.find(h => h.ip === args[0] || h.hostname === args[0]);

      if (!target) {
        AudioSystem.error();
        t.printLine(`connect: unknown host "${args[0]}". Run scan first.`, 'error');
        return;
      }
      if (!target.scanned) {
        AudioSystem.warning();
        t.printLine(`connect: host not yet scanned. Run: scan ${args[0]}`, 'warning');
        return;
      }

      t.printLine(`Connecting to ${args[0]} (${target.hostname})...`, 'system');
      t.lock();
      AudioSystem.dataTransfer();
      await _delay(400);
      t.printLine('Handshake...', 'muted');
      await _delay(600);
      GameState.connectTo(args[0]);
      t.printLine(`Connected to ${target.hostname}`, 'success');
      t.printLine('Access level: guest/limited', 'muted');
      GameState.addSuspicion(5);
      GameState.setFlag('first_connect', true);
      AudioSystem.connect();
      t.unlock();
      t._updatePrompt();
    }, 'Connect to a remote host', 'connect <ip>');

    // ── disconnect ────────────────────────────────────────────────
    this.registerCommand('disconnect', (args, t) => {
      const conn = GameState.getConnection();
      if (!conn) { t.printLine('Not connected.', 'muted'); return; }
      const host = conn.hostname;
      GameState.disconnect();
      t.printLine(`Disconnected from ${host}.`, 'success');
    }, 'Disconnect from current host');

    // ── download ──────────────────────────────────────────────────
    this.registerCommand('download', async (args, t) => {
      if (!args[0]) { t.printLine('Usage: download <filename>', 'warning'); return; }
      if (!GameState.isConnected()) {
        AudioSystem.error();
        t.printLine('ERROR: Not connected to any host.', 'error');
        return;
      }
      const conn = GameState.getConnection();
      const file = args[0];

      t.printLine(`Downloading ${file} from ${conn.hostname}...`, 'system');
      t.lock();
      AudioSystem.dataTransfer();

      let progress = 0;
      const bar    = t.printLine('[░░░░░░░░░░░░░░░░░░░░] 0%', 'normal');

      await new Promise(resolve => {
        const iv = setInterval(() => {
          progress += Math.floor(Math.random() * 12) + 6;
          if (progress >= 100) { progress = 100; clearInterval(iv); resolve(); }
          const filled = Math.round(progress / 5);
          bar.textContent = `[${'█'.repeat(filled)}${'░'.repeat(20 - filled)}] ${progress}%`;
        }, 120);
      });

      const size = (Math.random() * 500 + 20).toFixed(1);
      GameState.addFile(
        '/home/ghost/downloads',
        file,
        `[SOURCE]  ${conn.ip} (${conn.hostname})\n[SIZE]    ${size} KB\n[CONTENT] (binary data)`
      );
      t.printLine(`✓ Saved to ~/downloads/${file}  (${size} KB)`, 'success');
      GameState.addSuspicion(3);
      GameState.setFlag('first_download', true);
      AudioSystem.success();
      t.unlock();
      t._updatePrompt();
    }, 'Download a file from connected host', 'download <filename>');

    // ── decrypt ───────────────────────────────────────────────────
    this.registerCommand('decrypt', async (args, t) => {
      if (!args[0]) { t.printLine('Usage: decrypt <filename>', 'warning'); return; }

      if (!GameState.hasSoftware('cryptbreak')) {
        AudioSystem.error();
        t.printLine('ERROR: CryptBreak not installed.', 'error');
        t.printLine('Purchase it in the Tools app.', 'muted');
        return;
      }

      const dir = GameState.getDir('/home/ghost/downloads');
      if (!dir || !dir[args[0]]) {
        AudioSystem.error();
        t.printLine(`decrypt: ${args[0]}: file not found in ~/downloads`, 'error');
        return;
      }

      t.printLine(`Decrypting ${args[0]}...`, 'system');
      AudioSystem.decrypt();
      t.lock();

      const HEX = '0123456789ABCDEF';
      const rndHex = (n) => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('');

      for (let i = 0; i < 7; i++) {
        await _delay(130);
        t.printLine(rndHex(32) + '  ' + rndHex(16), 'muted');
      }

      await _delay(300);
      const out = args[0].replace(/\.enc$/, '.txt');
      t.printLine('Decryption successful!', 'success');
      t.printLine(`Output: ~/downloads/${out}`, 'normal');
      GameState.addFile('/home/ghost/downloads', out, `[DECRYPTED]\n${args[0]} contents revealed.`);
      GameState.setFlag('first_decrypt', true);
      AudioSystem.success();
      t.unlock();
      t._updatePrompt();
    }, 'Decrypt an encrypted file', 'decrypt <filename>');

    // ── vpn ───────────────────────────────────────────────────────
    this.registerCommand('vpn', (args, t) => {
      if (!GameState.hasSoftware('vpn')) {
        AudioSystem.error();
        t.printLine('ERROR: GhostVPN not installed.', 'error');
        return;
      }
      const active = GameState.toggleVpn();
      if (active) {
        t.printLine('VPN enabled — routing through anonymous nodes.', 'success');
        t.printLine('Suspicion gain halved.', 'muted');
        AudioSystem.success();
      } else {
        t.printLine('VPN disabled.', 'warning');
        AudioSystem.warning();
      }
    }, 'Toggle VPN on/off (requires GhostVPN)');

    // ── save ──────────────────────────────────────────────────────
    this.registerCommand('save', (args, t) => {
      if (GameState.save()) {
        t.printLine('Game saved.', 'success');
        AudioSystem.success();
      } else {
        t.printLine('Save failed.', 'error');
        AudioSystem.error();
      }
    }, 'Save game state to local storage');

  } // end _registerBuiltins

}

// ─── Utility ───────────────────────────────────────────────────────

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _formatSize(bytes) {
  if (typeof bytes === 'string') return bytes;
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024*1024)  return Math.round(bytes/1024) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}
