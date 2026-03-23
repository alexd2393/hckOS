/**
 * gameLoop.js — Loop Jugable Principal
 * AleXim OS — Hacking Narrative Game
 *
 * Este módulo registra todos los comandos del loop jugable en la instancia
 * activa de Terminal, y conecta la lógica de juego con NetworkSystem + GameState.
 *
 * Uso:
 *   GameLoop.attach(terminalInstance)
 *
 * Comandos expuestos:
 *   help | scan | connect [ip] | breach | ls | download [archivo]
 *   disconnect | missions | news | tools | status | clear | whoami
 */

const GameLoop = (() => {

  // ─── Referencia a la terminal activa ─────────────────────────
  let _term = null;

  // ─── Alias cortos ─────────────────────────────────────────────
  const NS = () => window.NetworkSystem;
  const GS = () => (typeof GameState !== 'undefined' ? GameState : null);

  function _wait(ms)  { return new Promise(r => setTimeout(r, ms)); }
  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Escape HTML ──────────────────────────────────────────────
  function _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Colores por tipo de nodo ─────────────────────────────────
  const NODE_COLORS = {
    ROUTER:     '#a0c8ff',
    DARKNET:    '#cc88ff',
    ISP:        '#88ccff',
    CORPORATE:  '#ffcc66',
    BANK:       '#ff8844',
    GOVERNMENT: '#ff4466',
    RESEARCH:   '#44ffcc',
    MEDIA:      '#aaffaa',
  };

  // ─── Barra de nivel de seguridad ─────────────────────────────
  function _secBar(level) {
    const filled = Math.round(level);
    const empty  = 5 - filled;
    const colors = ['#44ff88','#aaff44','#ffcc00','#ff8800','#ff3366'];
    const col    = colors[Math.min(filled - 1, 4)];
    return (
      `<span style="color:${col}">` +
      '█'.repeat(filled) +
      `</span><span style="color:var(--text-dim)">` +
      '░'.repeat(empty) +
      `</span>`
    );
  }

  // ─── Tabla de nodos ───────────────────────────────────────────
  function _printNodeTable(nodes, t) {
    t.printHTML(
      `<span style="color:var(--text-dim)">` +
      `${'IP'.padEnd(18)}${'HOSTNAME'.padEnd(28)}${'TIPO'.padEnd(12)}SEGURIDAD` +
      `</span>`
    );
    t.printHTML(
      `<span style="color:var(--text-dim)">${'─'.repeat(70)}</span>`
    );

    nodes.forEach(n => {
      const col     = NODE_COLORS[n.type] ?? '#aaaaaa';
      const breached = NS()?.isBreached(n.ip);
      const current  = NS()?.getCurrentNode()?.ip === n.ip;
      const tag      = current ? ' ◄' : breached ? ' ✓' : '';
      const tagCol   = current ? 'var(--cyan)' : 'var(--accent)';

      t.printHTML(
        `<span style="color:var(--text-normal)">${n.ip.padEnd(18)}</span>` +
        `<span style="color:${col}">${(n.hostname).padEnd(28)}</span>` +
        `<span style="color:var(--text-muted)">${n.type.padEnd(12)}</span>` +
        _secBar(n.security) +
        (tag ? ` <span style="color:${tagCol}">${tag}</span>` : '')
      );
    });
  }

  // ─── Animación de breach ──────────────────────────────────────
  async function _breachAnimation(t, node) {
    const stages = [
      { text: `Analizando vector de ataque → ${node.hostname}...`,   delay: 200 },
      { text: `Probando exploits conocidos (CVE-2024-**)...`,         delay: 300 },
      { text: `Inyectando payload en puerto ${node.files?.length > 2 ? '443' : '22'}...`, delay: 400 },
      { text: `Escalando privilegios...`,                             delay: 350 },
    ];

    t.lock();

    for (const stage of stages) {
      await _wait(stage.delay + Math.random() * 150);
      t.printLine(stage.text, 'muted');
    }

    // Fake hex stream
    const HEX = '0123456789ABCDEF';
    const rnd  = (n) => Array.from({length: n}, () => HEX[Math.floor(Math.random()*16)]).join('');
    for (let i = 0; i < 4; i++) {
      await _wait(80 + Math.random() * 60);
      t.printHTML(
        `<span style="color:var(--text-dim);font-size:11px;">` +
        `${rnd(8)} ${rnd(8)} ${rnd(8)} ${rnd(8)}  ${rnd(4)} ${rnd(4)} ${rnd(4)}` +
        `</span>`
      );
    }

    await _wait(300 + node.security * 200);
  }

  // ─── Animación de download ───────────────────────────────────
  async function _downloadAnimation(t, filename) {
    const bar = t.printLine('[░░░░░░░░░░░░░░░░░░░░] 0%', 'normal');
    let progress = 0;

    return new Promise(resolve => {
      const speed = 80 + Math.random() * 60;
      const iv = setInterval(() => {
        progress += Math.floor(Math.random() * 14) + 5;
        if (progress >= 100) { progress = 100; clearInterval(iv); resolve(); }
        const filled = Math.round(progress / 5);
        bar.innerHTML =
          `<span style="color:var(--accent)">` +
          `[${'█'.repeat(filled)}${'░'.repeat(20-filled)}]</span>` +
          ` <span style="color:var(--text-bright)">${progress}%</span>` +
          ` <span style="color:var(--text-dim)">${filename}</span>`;
      }, speed);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // REGISTRO DE COMANDOS
  // ════════════════════════════════════════════════════════════════

  function _registerCommands(t) {

    // ── help (override — versión mejorada) ──────────────────────
    t.commands['help'] = {
      help: 'Muestra todos los comandos disponibles.',
      usage: '',
      handler(args, t) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">AleXim OS — COMANDOS DISPONIBLES</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(54)}</span>`);

        const sections = [
          {
            title: '🌡 PERSECUCIÓN POLICIAL',
            cmds: [
              ['heat',              'Muestra calor policial, reputación y estado.'],
              ['cleaner [confirm]', 'Contrata un limpiador para reducir el calor.'],
            ],
          },
          {
            title: '🌐 RED',
            cmds: [
              ['scan',              'Escanea la red. Sin acceso ISP: solo red local.'],
              ['scanfrom',          'Escanea desde el nodo actual comprometido.'],
              ['connect [ip]',      'Conecta al nodo con esa IP.'],
              ['disconnect',        'Cierra la conexión. Avisa si dejaste rastros.'],
            ],
          },
          {
            title: '⚡ HACKING (v8 — Por Capas)',
            cmds: [
              ['recon [ip]',             'Reconocimiento: puertos, OS, capas, vulnerabilidades.'],
              ['bypass [CAPA] [tool]',   'Atraviesa una capa. Herramientas: phantom proxyx ghostwalk brutex hashcrack vpn'],
              ['traverse [nodo-id?]',    'Navega subsistemas internos. Después, ls muestra sus archivos específicos.'],
              ['back',                   'Salir del subsistema (volver a raíz del servidor).'],
              ['wipelog',                'Borra huellas de actividad. Reduce el heat.'],
              ['breach',                 'Modo simple (legacy). Ahora redirige al nuevo sistema.'],
            ],
          },
          {
            title: '📁 DATOS ROBADOS',
            cmds: [
              ['ls',                'Lista archivos del nodo comprometido.'],
              ['download [arch]',   'Roba un archivo y lo guarda en el inventario.'],
              ['inventory',         'Muestra el inventario de datos robados.'],
            ],
          },
          {
            title: '💰 DARKMARKET',
            cmds: [
              ['sell [arch]',       'Lista datos en el DarkMarket para buscar compradores.'],
              ['offers',            'Muestra las ofertas de compradores pendientes.'],
              ['market',            'Estado del mercado: precios y demanda activa.'],
              ['accept [offer-id]', 'Acepta una oferta y cobra el dinero.'],
              ['reject [offer-id]', 'Rechaza una oferta.'],
            ],
          },
          {
            title: '🎯 MISIONES Y MUNDO',
            cmds: [
              ['missions',           'Misiones del loop básico.'],
              ['missions2',          'Misiones avanzadas con moralidad y trampas.'],
              ['accept-mission [id]','Acepta una misión avanzada.'],
              ['reject-mission [id]','Rechaza una misión.'],
              ['events',             'Eventos mundiales activos e historial.'],
              ['news',               'Feed de noticias DarkWire.'],
            ],
          },
          {
            title: '🖥 SISTEMA LOCAL (v10)',
            cmds: [
              ['sysinfo',                  'RAM, storage, anonimato y herramientas activas.'],
              ['install [tool]',           'Instala un binario descargado, cargándolo en RAM.'],
              ['unload [tool]',            'Descarga una herramienta de la RAM (libera memoria).'],
              ['upgrade [tool] [axis]',    'Mejora speed / stealth / power de una herramienta.'],
              ['repair [tool]',            'Repara desgaste acumulado por uso intensivo.'],
              ['upgrade-ram [confirm]',    'Compra más RAM. Sin confirm muestra el costo.'],
              ['upgrade-storage [confirm]','Amplía storage. Sin confirm muestra el costo.'],
            ],
          },
          {
            title: '☣ AGENTES ADVERSARIALES',
            cmds: [
              ['agents',        'Estado de todos los agentes enemigos activos.'],
              ['scan-threats',  'Escanea amenazas: agentes, rivales y trampas.'],
            ],
          },
          {
            title: '⚙ SISTEMA',
            cmds: [
              ['tools',             'Herramientas instaladas.'],
              ['status',            'Estado completo del jugador.'],
              ['save',              'Guarda la partida.'],
              ['load [confirm]',    'Carga una partida guardada.'],
              ['clear',             'Limpia la terminal.'],
              ['whoami',            'Identidad del operador.'],
            ],
          },
        ];

        sections.forEach(sec => {
          t.printBlank();
          t.printHTML(`<span style="color:var(--warn);font-family:var(--font-ui);font-weight:600;">${sec.title}</span>`);
          sec.cmds.forEach(([name, desc]) => {
            t.printHTML(
              `  <span style="color:var(--accent);min-width:160px;display:inline-block;">${name.padEnd(24)}</span>` +
              `<span style="color:var(--text-muted)">${desc}</span>`
            );
          });
        });

        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">Flujo de juego: scan → connect [ip] → breach → ls → download [arch] → sell [arch] → offers → accept [id]</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">Sistema local:  sysinfo → install [tool] → upgrade [tool] [axis]</span>`);
      },
    };

    // ── scan ────────────────────────────────────────────────────
    t.registerCommand('scan', async (args, t) => {

      if (!NS()) { t.printLine('ERROR: NetworkSystem no disponible.', 'error'); return; }

      const gs = GS();
      if (gs && !gs.hasSoftware('scanner')) {
        AudioSystem.error();
        t.printLine('ERROR: NetScan no está instalado. Compralo en Tools.', 'error');
        return;
      }

      t.printBlank();
      t.printLine('Escaneando red...', 'system');
      t.lock();

      // Animación de scan
      const dots = t.printLine('Escaneando ·', 'muted');
      let d = 0;
      const dotIv = setInterval(() => {
        d = (d + 1) % 4;
        dots.textContent = 'Escaneando ' + '·'.repeat(d + 1);
      }, 300);

      AudioSystem.scan();
      const result = await NS().scan();
      clearInterval(dotIv);
      dots.remove();

      if (!result.ok) {
        t.printLine(`scan: ${result.message}`, 'error');
        t.unlock();
        return;
      }

      const { nodes, newNodes } = result;

      t.printBlank();
      if (nodes.length === 0) {
        t.printLine('No se detectaron hosts activos.', 'muted');
      } else {
        _printNodeTable(nodes, t);
        t.printBlank();
        t.printLine(`${nodes.length} host(s) detectados.`, 'success');
        if (newNodes.length > 0) {
          t.printLine(`${newNodes.length} nodo(s) nuevo(s) descubiertos.`, 'warning');
        }
        t.printLine('Leyenda: ✓ = comprometido   ◄ = nodo actual', 'muted');
      }

      AudioSystem.success();
      t.unlock();
      t._updatePrompt?.();

      // FIX #5 — actualizar mapa de red si está abierto
      if (nodes.length > 0) AleXimOS.refreshNetworkMap?.();

    }, 'Escanea la red en busca de nodos activos.');

    // ── connect ─────────────────────────────────────────────────
    t.registerCommand('connect', (args, t) => {
      if (!NS()) { t.printLine('NetworkSystem no disponible.', 'error'); return; }

      const ip = args[0];
      if (!ip) {
        t.printLine('Uso: connect [ip]', 'warning');
        const nodes = NS().getKnownNodes();
        if (nodes.length > 0) {
          t.printLine('Nodos conocidos:', 'muted');
          nodes.forEach(n => {
            t.printHTML(
              `  <span style="color:var(--cyan)">${n.ip}</span>` +
              `  <span style="color:var(--text-dim)">${n.hostname}</span>`
            );
          });
        } else {
          t.printLine('Sin nodos conocidos — ejecutá scan primero.', 'muted');
        }
        return;
      }

      const res = NS().connect(ip);
      if (!res.ok) {
        AudioSystem.error();
        t.printLine(`connect: ${res.message}`, 'error');
        return;
      }

      const n   = res.node;
      const col = NODE_COLORS[n.type] ?? '#aaaaaa';

      t.printBlank();
      t.printHTML(
        `<span style="color:var(--accent)">▶</span> <span style="color:${col}">${_esc(n.hostname)}</span>` +
        `  <span style="color:var(--text-dim)">${_esc(n.ip)}  ·  Seg ${n.security}/5  ·  ${_esc(n.type)}</span>`
      );

      // v8: iniciar sesión en HackingEngine
      if (window.HackingEngine) {
        HackingEngine.startSession(ip);
        const layers = window.SecurityLayerSystem?.getStack?.(ip) ?? [];
        if (!NS().isBreached(ip) && layers.length > 0) {
          const layerNames = layers.map(l => `${l.icon} ${l.id}`).join('  ');
          t.printHTML(`<span style="color:var(--text-dim)">Capas: ${layerNames}  ·  recon ${ip} para analizar</span>`);
        } else if (NS().isBreached(ip)) {
          t.printHTML(`<span style="color:var(--accent)">✓ Comprometido — ls · traverse · wipelog</span>`);
        }
      } else if (NS().isBreached(ip)) {
        t.printHTML(`<span style="color:var(--accent)">✓ Comprometido — ls · traverse</span>`);
      }

      AudioSystem.connect();
      UI.updateHUD?.();

    }, 'Conecta al nodo con esa IP.', 'connect [ip]');

    // ── disconnect ───────────────────────────────────────────────
    t.registerCommand('disconnect', (args, t) => {
      if (!NS()) { t.printLine('NetworkSystem no disponible.', 'error'); return; }

      const cur = NS().getCurrentNode();
      if (!cur) { t.printLine('No estás conectado a ningún nodo.', 'muted'); return; }

      // FIX 4b: clear traverse context before disconnect
      if (cur?.ip && window.HackingEngine) HackingEngine.clearInternal(cur.ip);

      // v8: finalizar sesión de hacking (puede añadir heat si dejaste log)
      if (window.HackingEngine) {
        const canWipe = HackingEngine.canWipeLog(cur.ip);
        if (canWipe) {
          t.printHTML(`<span style="color:var(--warn)">⚠ Dejaste rastros en ${_esc(cur.hostname)}. Usá wipelog antes para reducir el heat.</span>`);
        }
        HackingEngine.endSession(cur.ip);
      }

      NS().disconnect();
      t.printLine(`Desconectado de ${cur.hostname}.`, 'success');
      UI.updateHUD?.();

    }, 'Cierra la conexión actual.');

    // ── breach (legacy — ahora redirige al sistema de capas) ─────
    t.registerCommand('breach', async (args, t) => {
      // Si HackingEngine no está disponible, usar el sistema viejo
      if (!window.HackingEngine || !window.SecurityLayerSystem) {
        if (!NS()) { t.printLine('NetworkSystem no disponible.', 'error'); return; }
        const node = NS().getCurrentNode();
        if (!node) { AudioSystem.error(); t.printLine('breach: conectate primero.', 'error'); return; }
        if (NS().isBreached(node.ip)) { t.printLine('Ya comprometido. Usá ls.', 'warning'); return; }
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">⚡ BREACH (modo simple)</span> → <span style="color:var(--text-bright)">${_esc(node.hostname)}</span>`);
        await _breachAnimation(t, node);
        AudioSystem.dataTransfer();
        const res = await NS().breach(node.ip);
        t.unlock();
        if (res.success) { AudioSystem.success(); t.printHTML(`<span style="color:var(--accent)">█ ACCESO OBTENIDO █</span>`); t.printLine('Usá ls para ver archivos.','muted'); UI.notify(`Breach: ${node.hostname}`,'success'); AleXimOS.refreshNetworkMap?.(); }
        else { AudioSystem.error(); t.printHTML(`<span style="color:var(--danger)">✗ BREACH FALLIDO</span>`); t.printLine('Probá con bypass [capa] [herramienta].','muted'); UI.notify(`Fallido: ${node.hostname}`,'warning'); }
        UI.updateHUD?.();
        return;
      }

      // Con HackingEngine activo: breach es el paso final después de bypass
      const node = NS()?.getCurrentNode?.();
      if (!node) { t.printLine('Conectate primero con connect [ip].', 'warning'); return; }
      if (NS().isBreached(node.ip)) { t.printLine('Ya comprometido. Usá ls o traverse.', 'muted'); return; }

      // Verificar si todas las capas están bypaseadas
      const readyToBreach = window.HackingEngine?.isReadyToBreach?.(node.ip);
      if (!readyToBreach) {
        // Mostrar estado de capas pendientes
        const stack = SecurityLayerSystem.getStack(node.ip);
        const pendingLayers = stack.filter(l => !l.bypassed);
        if (pendingLayers.length > 0) {
          t.printBlank();
          t.printHTML(`<span style="color:var(--warn)">⚡ Capas de seguridad pendientes en ${_esc(node.hostname)}:</span>`);
          pendingLayers.forEach(l => {
            t.printHTML(`  ${l.icon} <span style="color:var(--text-bright)">${_esc(l.name)}</span>  <span style="color:var(--text-dim)">→ bypass ${l.id} ${l.tools[0]}</span>`);
          });
          t.printBlank();
        } else {
          t.printLine('Ejecutá bypass [CAPA] [herramienta] para atravesar las capas primero.', 'warning');
        }
        return;
      }

      // Todas las capas OK → breach real con animación
      t.lock();
      t.printBlank();
      t.printHTML(`<span style="color:var(--warn)">⚡ BREACH</span> → <span style="color:var(--cyan)">${_esc(node.hostname)}</span>`);
      AudioSystem.dataTransfer?.();
      await _breachAnimation(t, node);
      t.unlock();

      // Ejecutar breach en NetworkSystem
      const ns = window.NetworkSystem;
      if (ns && !ns.isBreached(node.ip)) {
        ns.forceBreached(node.ip);
        window.dispatchEvent(new CustomEvent('alexim-breach', {
          detail: { node: ns.getKnownNodes().find(n => n.ip === node.ip) },
        }));
      }
      // Actualizar fase en HackingEngine
      if (window.HackingEngine) {
        const sess = HackingEngine.getSession(node.ip);
        if (sess) sess.phase = 'inside';
      }

      AudioSystem.success?.();
      t.printHTML(`<span style="color:var(--accent)">▓▓▓ ACCESO OBTENIDO — ${_esc(node.hostname)} ▓▓▓</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">ls · traverse · download · wipelog</span>`);
      UI.notify?.(`✓ Breach: ${node.hostname}`, 'success', 5000);
      UI.updateHUD?.();
      setTimeout(() => { AleXimOS.refreshNetworkMap?.(); }, 600);
      return;

    }, 'Ingresar al sistema tras completar todos los bypass. Usa bypass primero.');

    // ── recon ─────────────────────────────────────────────────────
    t.registerCommand('recon', async (args, t) => {
      if (!NS()) { t.printLine('NetworkSystem no disponible.', 'error'); return; }
      const ip   = args[0] ?? NS().getCurrentNode()?.ip;
      if (!ip) { t.printLine('Uso: recon [ip]', 'warning'); return; }
      const node = NS().getKnownNodes().find(n => n.ip === ip);
      if (!node) { t.printLine(`IP desconocida: ${ip}. Hacé scan primero.`, 'error'); return; }

      t.lock();
      t.lock();
      t.printBlank();
      AudioSystem.scan?.();

      if (window.HackingEngine) HackingEngine.startSession(ip);

      // Simular tiempo de recon
      const reconTime = 1500 + node.security * 400;
      for (let i = 0; i < 3; i++) {
        await _delay(reconTime / 3);
        const steps = ['Escaneando puertos...', 'Identificando OS...', 'Analizando seguridad...'];
        t.printHTML(`<span style="color:var(--text-dim)">  ${steps[i]}</span>`);
      }

      const hasScanner = typeof GameState !== 'undefined' && GameState.hasSoftware('scanner');
      const info       = window.HackingEngine?.recon?.(ip, hasScanner)
                      ?? window.SecurityLayerSystem?.getReconInfo?.(ip, hasScanner);

      t.unlock();
      t.printBlank();

      if (!info) { t.printLine('Recon fallido.', 'error'); return; }

      // ── Línea de resumen compacta ──────────────────────────────
      t.printHTML(
        `<span style="color:var(--text-bright);font-weight:bold;">${_esc(info.hostname)}</span>` +
        `  <span style="color:var(--text-dim)">${_esc(info.ip)}  ·  ${_esc(info.type)}  ·  Seg ${info.security}/5  ·  ${_esc(info.os)}</span>`
      );

      // ── Capas de seguridad (compacto, una línea por capa) ──────
      const stack = window.SecurityLayerSystem?.getStack?.(ip) ?? [];
      if (stack.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">SEGURIDAD:</span>`);
        stack.forEach(l => {
          const status = l.bypassed
            ? `<span style="color:var(--accent)">✓</span>`
            : `<span style="color:var(--warn)">▶</span>`;
          const toolHint = !l.bypassed ? `  <span style="color:var(--text-dim)">[${l.tools.join('|').slice(0,24)}]</span>` : '';
          t.printHTML(`  ${status} ${l.icon} <span style="color:var(--text-muted)">${l.name}</span>${toolHint}`);
        });
      }

      // ── Puertos (solo si scanner activo, muy compacto) ─────────
      if (hasScanner && info.openPorts?.length > 0) {
        const portStr = info.openPorts.map(p => p.port).join('  ');
        t.printHTML(`<span style="color:var(--text-dim)">Puertos: ${portStr}</span>`);
      }

      // ── CVEs (solo si hay, compacto) ───────────────────────────
      if (hasScanner && info.vulnerabilities?.length > 0) {
        const critical = info.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
        const high     = info.vulnerabilities.filter(v => v.severity === 'HIGH').length;
        t.printHTML(
          `<span style="color:var(--danger)">CVEs: ${info.vulnerabilities.length}</span>` +
          (critical ? `  <span style="color:var(--danger)">${critical} CRITICAL</span>` : '') +
          (high     ? `  <span style="color:var(--warn)">${high} HIGH</span>` : '')
        );
      }

      t.printBlank();
      if (!NS().isBreached(ip)) {
        const nextLayer = stack.find(l => !l.bypassed);
        if (nextLayer) {
          t.printHTML(`<span style="color:var(--text-dim)">→ bypass ${nextLayer.id} ${nextLayer.tools[0]}</span>`);
        }
      } else {
        t.printHTML(`<span style="color:var(--accent)">✓ Comprometido — ls · traverse</span>`);
      }

      AudioSystem.success?.();
      ReputationSystem?.addHeat?.(1, 'recon');

      AudioSystem.success?.();
      ReputationSystem?.addHeat?.(1, 'recon');

    }, 'Reconocimiento de un nodo objetivo.', 'recon [ip]');

    // ── bypass ────────────────────────────────────────────────────
    t.registerCommand('bypass', async (args, t) => {
      if (!window.HackingEngine || !window.SecurityLayerSystem) {
        t.printLine('HackingEngine no disponible.', 'error'); return;
      }
      const node = NS()?.getCurrentNode?.();
      if (!node) { t.printLine('Conectate primero con connect [ip].', 'warning'); return; }
      if (NS().isBreached(node.ip)) { t.printLine('Nodo ya comprometido. Usá ls o traverse.','muted'); return; }

      // Sin args: mostrar estado de capas y opciones
      if (args.length === 0) {
        const stack    = SecurityLayerSystem.getStack(node.ip);
        const nextLayer= stack.find(l => !l.bypassed);
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">🛡 CAPAS DE SEGURIDAD — ${_esc(node.hostname)}</span>`);
        stack.forEach((l,i) => {
          const st = l.bypassed ? `<span style="color:var(--accent)">✓</span>` : i===stack.indexOf(nextLayer)?`<span style="color:var(--warn)">◄ siguiente</span>`:`<span style="color:var(--text-dim)">espera</span>`;
          t.printHTML(`  ${l.icon} <span style="color:var(--text-bright)">${l.name}</span>  ${st}`);
          if (!l.bypassed) t.printHTML(`     <span style="color:var(--text-dim)">bypass ${l.id} [${l.tools.join('|')}]</span>`);
        });
        return;
      }

      // bypass [CAPA] [herramienta]
      const layerId = args[0]?.toUpperCase();
      const toolId  = args[1];

      if (!toolId) {
        const stack = SecurityLayerSystem.getStack(node.ip);
        const layer = stack.find(l => l.id === layerId && !l.bypassed);
        if (layer) {
          t.printHTML(`<span style="color:var(--text-muted)">Herramientas para ${layer.name}: </span><span style="color:var(--cyan)">${layer.tools.join(' · ')}</span>`);
        } else { t.printLine(`Uso: bypass [CAPA] [herramienta]`, 'warning'); }
        return;
      }

      // FIX #10: validación de herramienta corregida - lógica anterior era siempre true
      const hasTool = typeof GameState !== 'undefined' && GameState.hasSoftware(toolId);
      if (!hasTool) {
        t.printHTML(`<span style="color:var(--danger)">✗ No tenés <span style="color:var(--warn)">${_esc(toolId)}</span> instalado.</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">  Comprá herramientas en la app DarkMarket → Tools.</span>`);
        return;
      }


      t.lock();
      t.printBlank();
      t.printHTML(
        `<span style="color:var(--warn)">⚡ bypass</span>` +
        ` <span style="color:var(--cyan)">${layerId}</span>` +
        ` <span style="color:var(--text-dim)">← ${_esc(toolId)}</span>`
      );

      // Una sola pausa de suspense — sin líneas de texto intermedias
      AudioSystem.dataTransfer?.();
      await _delay(1200 + node.security * 300 + Math.random() * 600);
      const res = await HackingEngine.bypassLayer(node.ip, toolId);
      t.unlock();

      if (!res.ok) { AudioSystem.error?.(); t.printLine(res.message, 'error'); return; }

      if (res.success) {
        AudioSystem.success?.();
        t.printHTML(`<span style="color:var(--accent)">✓ ${_esc(res.layer.name)}</span>  <span style="color:var(--text-dim)">+${res.heatCost}% heat</span>`);

        if (res.fullyBypassed) {
          // Todas las capas OK — ahora el jugador debe ejecutar breach
          t.printBlank();
          t.printHTML(`<span style="color:var(--warn)">◉ Todas las capas de seguridad neutralizadas.</span>`);
          t.printHTML(`<span style="color:var(--text-dim)">→ Ejecutá </span><span style="color:var(--cyan)">breach</span><span style="color:var(--text-dim)"> para ingresar al sistema.</span>`);
          t.printBlank();
        } else {
          t.printHTML(`<span style="color:var(--text-dim)">→ bypass ${res.nextLayer?.id} ${res.nextLayer?.tools?.[0]}</span>`);
        }
      } else {
        AudioSystem.error?.();
        t.printHTML(`<span style="color:var(--danger)">✗ ${_esc(res.layer.name)} — rechazado</span>  <span style="color:var(--text-dim)">+${res.heatCost}% heat</span>`);
      }
      UI.updateHUD?.();


    }, 'Bypasea una capa de seguridad del nodo actual.', 'bypass [CAPA] [herramienta]');

    // ── traverse ──────────────────────────────────────────────────
    t.registerCommand('traverse', (args, t) => {
      if (!window.HackingEngine) { t.printLine('HackingEngine no disponible.', 'error'); return; }
      const node = NS()?.getCurrentNode?.();
      if (!node) { t.printLine('No conectado a ningún nodo.', 'warning'); return; }
      if (!NS().isBreached(node.ip)) { t.printLine('Necesitás acceso completo. Completá el bypass primero.', 'warning'); return; }

      const internals = HackingEngine.getInternalNodes(node.ip);
      const nodeId    = args[0];

      if (!nodeId) {
        // Listar nodos internos
        t.printBlank();
        t.printHTML(`<span style="color:var(--cyan)">🔗 RED INTERNA — ${_esc(node.hostname)}</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(48)}</span>`);
        internals.forEach(n => {
          const accessed = n.accessed ? '<span style="color:var(--accent)">● accedido</span>' : '<span style="color:var(--text-dim)">○ sin acceder</span>';
          t.printHTML(
            `  ${n.icon} <span style="color:var(--text-bright);min-width:120px;display:inline-block;">${_esc(n.label)}</span>` +
            `  <span style="color:var(--text-dim)">[${_esc(n.id)}]</span>  ${accessed}`
          );
          t.printHTML(`     <span style="color:var(--text-dim)">Datos: ${n.dataTypes.join(', ')} · Seg: ${n.security}/5</span>`);
        });
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">→ traverse [id]  para navegar a un nodo interno</span>`);
        return;
      }

      const res = HackingEngine.traverseTo(node.ip, nodeId);
      if (!res.ok) { AudioSystem.error?.(); t.printLine(res.message, 'error'); return; }

      AudioSystem.connect?.();
      t.printBlank();
      t.printHTML(`<span style="color:var(--accent)">▶ Conectado a:</span> ${res.node.icon} <span style="color:var(--text-bright)">${_esc(res.node.label)}</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">Datos disponibles: </span><span style="color:var(--warn)">${res.node.dataTypes.join(' · ')}</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">→ ls  para ver archivos en este nodo</span>`);
      ReputationSystem?.addHeat?.(res.node.security * 1.5, 'traverse');

    }, 'Navega entre nodos internos del servidor comprometido.', 'traverse [nodo-id?]');

    // ── back — salir del contexto de nodo interno ─────────────────
    t.registerCommand('back', (args, t) => {
      const node = NS()?.getCurrentNode?.();
      if (!node) { t.printLine('No conectado.', 'muted'); return; }
      const internal = window.HackingEngine?.getCurrentInternal?.(node.ip);
      if (!internal) { t.printLine('Ya estás en la raíz del servidor.', 'muted'); return; }
      HackingEngine.clearInternal(node.ip);
      t.printBlank();
      t.printHTML(
        `<span style="color:var(--text-dim)">↩ Volviste a: </span>` +
        `<span style="color:var(--cyan)">root@${_esc(node.hostname)}:~$</span>`
      );
      t.printHTML(`<span style="color:var(--text-dim)">→ ls  para ver archivos del servidor principal  |  traverse para ver subsistemas</span>`);
      t.printBlank();
    }, 'Volver al directorio raíz del servidor (salir de traverse).', 'back');

    // ── wipelog ───────────────────────────────────────────────────
    t.registerCommand('wipelog', async (args, t) => {
      if (!window.HackingEngine) { t.printLine('HackingEngine no disponible.', 'error'); return; }
      const node = NS()?.getCurrentNode?.();
      if (!node) { t.printLine('No conectado.', 'warning'); return; }
      if (!NS().isBreached(node.ip)) { t.printLine('Necesitás estar dentro del servidor.', 'warning'); return; }
      if (!HackingEngine.canWipeLog(node.ip)) { t.printLine('Log ya borrado o sin sesión activa.', 'muted'); return; }

      const hasWiper = typeof GameState !== 'undefined' && GameState.hasSoftware('logwipe');

      t.lock();
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan)">🧹 BORRANDO LOGS DE ACTIVIDAD — ${_esc(node.hostname)}</span>`);
      if (!hasWiper) t.printHTML(`<span style="color:var(--text-dim)">  (sin logwipe instalado — efectividad reducida)</span>`);

      const steps = ['Identificando entradas de log...','Sobreescribiendo registros...','Verificando integridad...'];
      for (const s of steps) {
        await _delay(600 + Math.random() * 400);
        t.printHTML(`<span style="color:var(--text-dim)">  ${s}</span>`);
      }

      const res = HackingEngine.wipeLog(node.ip);
      t.unlock();

      t.printBlank();
      if (res.ok) {
        AudioSystem.success?.();
        t.printHTML(`<span style="color:var(--accent)">✓ Logs borrados</span>  <span style="color:var(--text-dim)">Heat -${res.heatReduced}%</span>`);
        if (!hasWiper) t.printHTML(`<span style="color:var(--text-dim)">Instalá logwipe para mayor efectividad (-18% vs -8%)</span>`);
        UI.notify(`🧹 Logs borrados en ${node.hostname} — Heat -${res.heatReduced}%`, 'success', 6000);
      } else {
        AudioSystem.error?.();
        t.printLine(res.message, 'error');
      }
      UI.updateHUD?.();

    }, 'Borra los logs de actividad del servidor actual.', 'wipelog');

    // ── ls ───────────────────────────────────────────────────────
    t.registerCommand('ls', (args, t) => {
      // If not connected to any hacked node, delegate to local filesystem ls

      const node = NS()?.getCurrentNode?.();
      const isHacked = node && NS()?.isBreached?.(node.ip);

      if (!node || !isHacked) {
        // Local filesystem ls — same as terminal builtin but don't conflict
        const localPath = args[0]
          ? (args[0].startsWith('/') ? args[0] : GameState.getCurrentPath() + '/' + args[0])
          : GameState.getCurrentPath();
        const fs       = GameState.getFilesystem();
        const dir      = GameState.getDir(localPath);
        const subdirs  = Object.keys(fs)
          .filter(k => k !== localPath && k.startsWith(localPath + '/') && !k.slice(localPath.length+1).includes('/'))
          .map(k => k.split('/').pop());
        const fileEntries = dir ? Object.entries(dir) : [];

        if (subdirs.length === 0 && fileEntries.length === 0) {
          t.printLine('(directorio vacío)', 'muted'); return;
        }
        t.printHTML(`<span style="color:var(--cyan)">${_esc(localPath)}:</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">total ${subdirs.length + fileEntries.length}</span>`);
        subdirs.sort().forEach(n => {
          t.printHTML(`<span style="color:var(--cyan);font-weight:bold;">📁 ${_esc(n)}/</span>`);
        });
        fileEntries.sort(([a],[b])=>a.localeCompare(b)).forEach(([name]) => {
          const ext = name.split('.').pop()?.toLowerCase();
          const col = name.startsWith('.') ? 'var(--text-dim)' : ext==='enc'||ext==='db'||ext==='sql' ? 'var(--warn)' : 'var(--text-bright)';
          t.printHTML(`<span style="color:${col}">  ${_esc(name)}</span>`);
        });
        return;
      }

      // FIX 2: Context-aware ls:
      //   - If traversed to internal node → show that node's dataTypes as files
      //   - Otherwise → show main node's files
      const internalNode = window.HackingEngine?.getCurrentInternal?.(node.ip);

      if (internalNode) {
        // ── TRAVERSE CONTEXT: show internal node files ──────────
        t.printBlank();
        t.printHTML(
          `<span style="color:var(--accent)">root@${_esc(node.hostname)}</span>` +
          `<span style="color:var(--text-dim)">:/</span>` +
          `<span style="color:var(--cyan)">${_esc(internalNode.id)}</span>` +
          `<span style="color:var(--accent)">$</span> <span style="color:var(--text-muted)">ls -la</span>`
        );
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);
        t.printHTML(
          `<span style="color:var(--warn)">📋 system.log</span>` +
          `<span style="color:var(--text-dim)">  ← cat = +calor</span>`
        );
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);

        // Archivos del nodo interno basados en sus dataTypes
        const _FILES_BY_TYPE = {
          financial_data:       [{name:'transacciones_q4.csv', size:'8.2 MB',  locked:false}, {name:'cuentas_offshore.enc', size:'4.1 MB', locked:true}],
          customer_database:    [{name:'clientes_activos.sql', size:'22 MB',   locked:false}, {name:'datos_sensibles.db',   size:'11 MB',  locked:true}],
          credentials:          [{name:'passwords_hash.txt',   size:'340 KB',  locked:false}, {name:'admin_creds.enc',      size:'12 KB',  locked:true}],
          emails:               [{name:'mbox_directorio.tar',  size:'140 MB',  locked:false}, {name:'comunicaciones_priv.enc', size:'28 MB', locked:true}],
          government_documents: [{name:'expedientes_2025.pdf', size:'45 MB',   locked:false}, {name:'docs_clasificados.enc',  size:'18 MB', locked:true}],
          medical_records:      [{name:'historias_clinicas.db',size:'620 MB',  locked:false}, {name:'estudios_lab.enc',     size:'88 MB',  locked:true}],
          network_logs:         [{name:'access_log.txt',       size:'2.4 MB',  locked:false}, {name:'firewall_events.enc',  size:'890 KB', locked:true}],
          research_data:        [{name:'datos_investigacion.zip',size:'380 MB',locked:false}, {name:'patentes_clasificadas.enc',size:'22 MB',locked:true}],
          crypto_wallet_data:   [{name:'wallets_index.json',   size:'88 KB',   locked:false}, {name:'private_keys.enc',     size:'4 KB',   locked:true}],
        };
        const hasDec = GS()?.hasSoftware('cryptbreak');
        let fileCount = 0;
        internalNode.dataTypes.forEach(dtype => {
          const dfiles = _FILES_BY_TYPE[dtype] || [];
          dfiles.forEach(f => {
            const stateCol = f.locked ? (hasDec ? 'var(--warn)' : 'var(--danger)') : 'var(--text-bright)';
                const lockIcon = f.locked ? (hasDec ? ' 🔓' : ' 🔒') : '';
            t.printHTML(
              `<span style="color:${stateCol}">${lockIcon ? lockIcon+' ' : '  '}${_esc(f.name)}</span>` +
              `<span style="color:var(--text-dim)">  ${_esc(f.size ?? '')}</span>`
            );
            fileCount++;
          });
        });
        t.printBlank();
        t.printHTML(
          `<span style="color:var(--text-dim)">→ </span><span style="color:var(--cyan)">download [archivo]</span>` +
          `<span style="color:var(--text-dim)">  para robar  |  </span>` +
          `<span style="color:var(--text-dim)">traverse  para ver otros subsistemas</span>`
        );
        if (!hasDec) {
          t.printLine('🔒 Archivos .enc requieren CryptBreak.', 'muted');
        }

      } else {
        // ── MAIN NODE CONTEXT: show node's own files ─────────────
        const files = NS().getFiles(node.ip);
        if (!files || files.length === 0) {
          t.printLine('Sin archivos disponibles en este nodo.', 'muted');
          return;
        }

        t.printBlank();
        t.printHTML(`<span style="color:var(--accent)">root@${_esc(node.hostname)}:~$</span> <span style="color:var(--text-muted)">ls -la</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">total ${files.length + 5}</span>`);

        // Directorios = nodos internos disponibles
        const internals = window.HackingEngine?.getInternalNodes?.(node.ip) ?? [];
        if (internals.length > 0) {
          internals.forEach(n => {
            t.printHTML(
              `<span style="color:var(--cyan);font-weight:bold;">${n.icon} ${_esc(n.id)}/</span>` +
              `<span style="color:var(--text-dim)">  ← traverse ${_esc(n.id)}</span>`
            );
          });
          t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);
        }

        // system.log
        t.printHTML(
          `<span style="color:var(--warn)">📋 system.log</span>` +
          `<span style="color:var(--text-dim)">  ← cat = +calor</span>`
        );
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);

        const free   = files.filter(f => !f.locked);
        const locked = files.filter(f => f.locked);
        [...free, ...locked].forEach(f => {
          const hasDec   = GS()?.hasSoftware('cryptbreak');
          const stateCol = f.locked ? (hasDec ? 'var(--warn)' : 'var(--danger)') : 'var(--text-bright)';
            const lockIcon = f.locked ? (hasDec ? ' 🔓' : ' 🔒') : '';
          t.printHTML(
            `<span style="color:${stateCol}">${lockIcon ? lockIcon+' ' : '  '}${_esc(f.name)}</span>` +
            `<span style="color:var(--text-dim)">  ${_esc(f.size ?? '')}</span>`
          );
        });

        t.printBlank();
        t.printHTML(
          `<span style="color:var(--text-dim)">→ </span><span style="color:var(--cyan)">download [archivo]</span>` +
          `<span style="color:var(--text-dim)">  |  </span>` +
          `<span style="color:var(--warn)">cat system.log</span><span style="color:var(--text-dim)"> (⚠ +8% calor)  |  </span>` +
          `<span style="color:var(--text-dim)">traverse [id] para explorar subsistemas</span>`
        );
        if (locked.some(f => !GS()?.hasSoftware('cryptbreak'))) {
          t.printLine('🔒 Archivos encriptados requieren CryptBreak.', 'muted');
        }
      } // end else (main node context)

    }, 'Lista archivos del nodo comprometido o directorio local.');

    // ── cat system.log en nodo hackeado — sube calor ─────────────
    const _origCatHandler = t.commands['cat']?.handler;
    t.registerCommand('cat', (args, t) => {
      if (args[0] === 'system.log' && NS()?.isConnected?.() && NS()?.isBreached?.(NS().getCurrentNode()?.ip)) {
        const node2 = NS().getCurrentNode();
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">── ${_esc(node2.hostname)}/logs/system.log ──</span>`);
        const now = new Date().toISOString();
        [
          `[${now}] INFO:  Service started on port 22, 80, 443`,
          `[${now}] INFO:  User 'ghost_0x1' connected from unknown host`,
          `[${now}] WARN:  Anomalous read pattern detected in /data`,
          `[${now}] WARN:  Bulk file access — possible data exfiltration`,
          `[${now}] ERROR: Intrusion detection system triggered`,
          `[${now}] WARN:  Alert sent to security team`,
        ].forEach(l => t.printLine(l, l.includes('ERROR') ? 'error' : l.includes('WARN') ? 'warning' : 'muted'));
        t.printBlank();
        t.printHTML(`<span style="color:var(--danger)">⚠ Leíste el log del sistema — tu actividad está registrada. Calor +8%</span>`);
        if (window.ReputationSystem) ReputationSystem.addHeat(8, 'read_system_log');
        if (typeof GameState !== 'undefined') GameState.addSuspicion(5);
        return;
      }
      if (_origCatHandler) _origCatHandler(args, t);
    }, 'Muestra el contenido de un archivo', 'cat <archivo>');

    // ── download ─────────────────────────────────────────────────
    t.registerCommand('download', async (args, t) => {
      if (!NS()) { t.printLine('NetworkSystem no disponible.', 'error'); return; }

      const filename = args[0];
      if (!filename) {
        t.printLine('Uso: download [nombre_archivo]', 'warning');
        t.printLine('Tip: ejecutá ls para ver archivos disponibles.', 'muted');
        return;
      }

      const node = NS().getCurrentNode();
      if (!node) { AudioSystem.error(); t.printLine('download: no conectado a ningún nodo.', 'error'); return; }
      if (!NS().isBreached(node.ip)) { AudioSystem.error(); t.printLine(`download: ${node.hostname} no comprometido. Ejecutá breach primero.`, 'error'); return; }

      // FIX 3: get files from current context (internal node if traversed, else main node)
      const _internalCtx = window.HackingEngine?.getCurrentInternal?.(node.ip);
      let files;
      if (_internalCtx) {
        // Build synthetic file list for this internal node (same as ls shows)
        const _FILES_BY_TYPE_DL = {
          financial_data:       [{name:'transacciones_q4.csv', size:'8.2 MB',  locked:false, dataType:'financial_data',       reward:400}, {name:'cuentas_offshore.enc', size:'4.1 MB', locked:true,  dataType:'financial_data',       reward:1200}],
          customer_database:    [{name:'clientes_activos.sql', size:'22 MB',   locked:false, dataType:'customer_database',    reward:350}, {name:'datos_sensibles.db',   size:'11 MB',  locked:true,  dataType:'customer_database',    reward:900}],
          credentials:          [{name:'passwords_hash.txt',   size:'340 KB',  locked:false, dataType:'credentials',          reward:300}, {name:'admin_creds.enc',      size:'12 KB',  locked:true,  dataType:'credentials',          reward:800}],
          emails:               [{name:'mbox_directorio.tar',  size:'140 MB',  locked:false, dataType:'emails',               reward:250}, {name:'comunicaciones_priv.enc', size:'28 MB', locked:true,  dataType:'emails',               reward:700}],
          government_documents: [{name:'expedientes_2025.pdf', size:'45 MB',   locked:false, dataType:'government_documents', reward:600}, {name:'docs_clasificados.enc',  size:'18 MB', locked:true,  dataType:'government_documents', reward:1500}],
          medical_records:      [{name:'historias_clinicas.db',size:'620 MB',  locked:false, dataType:'medical_records',      reward:500}, {name:'estudios_lab.enc',     size:'88 MB',  locked:true,  dataType:'medical_records',      reward:1100}],
          network_logs:         [{name:'access_log.txt',       size:'2.4 MB',  locked:false, dataType:'network_logs',         reward:80},  {name:'firewall_events.enc',  size:'890 KB', locked:true,  dataType:'network_logs',         reward:200}],
          research_data:        [{name:'datos_investigacion.zip',size:'380 MB',locked:false, dataType:'research_data',        reward:450}, {name:'patentes_clasificadas.enc',size:'22 MB',locked:true,  dataType:'research_data',        reward:1300}],
          crypto_wallet_data:   [{name:'wallets_index.json',   size:'88 KB',   locked:false, dataType:'crypto_wallet_data',   reward:700}, {name:'private_keys.enc',     size:'4 KB',   locked:true,  dataType:'crypto_wallet_data',   reward:2000}],
        };
        files = [];
        _internalCtx.dataTypes.forEach(dtype => {
          (_FILES_BY_TYPE_DL[dtype] || []).forEach(f => files.push({...f, sensitivity: _internalCtx.security * 2}));
        });
      } else {
        files = NS().getFiles(node.ip) ?? [];
      }
      const target = files.find(f => f.name === filename);
      if (!target) { AudioSystem.error(); t.printLine(`download: archivo no encontrado — "${filename}"`, 'error'); t.printLine('Ejecutá ls para ver los archivos disponibles.', 'muted'); return; }

      if (target.locked && !GS()?.hasSoftware('cryptbreak')) {
        AudioSystem.error();
        t.printHTML(`<span style="color:var(--danger)">✗ Archivo encriptado</span> — necesitás CryptBreak para descargar este archivo.`);
        t.printLine('Instalá CryptBreak desde la app Tools.', 'muted');
        return;
      }

      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan)">Descargando:</span> <span style="color:var(--text-bright)">${_esc(filename)}</span> desde <span style="color:var(--cyan)">${_esc(node.hostname)}</span>...`);

      t.lock();
      AudioSystem.dataTransfer();
      await _downloadAnimation(t, filename);
      const res = await NS().download(filename, node.ip);
      t.unlock();

      if (res.ok) {
        AudioSystem.success();
        t.printBlank();
        t.printHTML(`<span style="color:var(--accent)">✓ Datos robados — guardados en inventario</span>`);
        if (res.loot) {
          const INV = window.InventorySystem;
          const meta = INV?.getTypeMeta?.(res.loot.dataType);
          t.printHTML(
            `  <span style="color:var(--text-muted)">Tipo: </span>` +
            `<span style="color:var(--warn)">${_esc(meta?.label ?? res.loot.dataType)}</span>` +
            `  <span style="color:var(--text-muted)">Sensibilidad: </span>` +
            `<span style="color:var(--accent)">${res.loot.sensitivity}/10</span>`
          );
          t.printHTML(
            `  <span style="color:var(--text-dim)">Valor estimado en mercado: </span>` +
            `<span style="color:var(--warn)">~$${res.loot.valueEstimate.toLocaleString('es-AR')} CR</span>`
          );
          t.printHTML(
            `  <span style="color:var(--text-dim)">→ Usá </span><span style="color:var(--cyan)">sell ${_esc(filename)}</span>` +
            `<span style="color:var(--text-dim)"> para listar en DarkMarket</span>`
          );
        }
        UI.notify(`Datos robados: ${filename} en inventario`, 'success');
        UI.updateHUD?.();
      } else {
        AudioSystem.error();
        t.printLine(`download: ${res.message}`, 'error');
      }

    }, 'Descarga un archivo y lo guarda en el inventario.', 'download [archivo]');

    // ── missions ─────────────────────────────────────────────────
    t.registerCommand('missions', (args, t) => {
      if (!NS()) { t.printLine('NetworkSystem no disponible.', 'error'); return; }

      const active    = NS().getActiveMissions();
      const completed = NS().getCompletedMissions();

      t.printBlank();
      t.printHTML(
        `<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">` +
        `MISIONES</span>`
      );
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(50)}</span>`);

      if (active.length === 0 && completed.length === 0) {
        t.printLine('Sin misiones disponibles todavía.', 'muted');
        t.printLine('Completá la misión de introducción para desbloquear más.', 'muted');
        return;
      }

      if (active.length > 0) {
        t.printBlank();
        t.printHTML(
          `<span style="color:var(--warn)">▶ DISPONIBLES (${active.length})</span>`
        );

        active.forEach((m, i) => {
          t.printBlank();
          t.printHTML(
            `  <span style="color:var(--text-bright);font-weight:bold;">${i+1}. ${_esc(m.title)}</span>` +
            `  <span style="color:var(--text-dim)">— Cliente: ${_esc(m.client)}</span>`
          );
          t.printHTML(
            `  <span style="color:var(--text-normal)">${_esc(m.desc)}</span>`
          );
          t.printHTML(
            `  <span style="color:var(--text-dim)">Objetivo: </span>` +
            `<span style="color:var(--cyan)">${_esc(m.objective)}</span>`
          );
          t.printHTML(
            `  <span style="color:var(--text-dim)">Recompensa: </span>` +
            `<span style="color:var(--warn)">+${m.reward} CR</span>` +
            `  <span style="color:var(--text-dim)">Riesgo sospecha: +${m.suspicion}%</span>`
          );
        });
      }

      if (completed.length > 0) {
        t.printBlank();
        t.printHTML(
          `<span style="color:var(--accent)">✓ COMPLETADAS (${completed.length})</span>`
        );
        completed.forEach(m => {
          t.printHTML(
            `  <span style="color:var(--text-muted)">✓ ${_esc(m.title)}</span>`
          );
        });
      }

      t.printBlank();
      t.printLine('Completá misiones para desbloquear contactos y nuevos objetivos.', 'muted');

    }, 'Muestra misiones disponibles y completadas.');

    // ── news ─────────────────────────────────────────────────────
    t.registerCommand('news', (args, t) => {
      // Fix #1: abrir CrónicaDigital en lugar de volcar en la terminal
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan)">📰 Abriendo CrónicaDigital...</span>`);

      if (typeof AleXimOS !== 'undefined') {
        setTimeout(() => AleXimOS.openApp('cronica'), 200);
      }

      // Show last 3 headlines as preview only
      const items = (window.NewsSystem?.getNews?.(3)) ?? [];
      if (items.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">Últimas noticias:</span>`);
        items.forEach(item => {
          const tagCol = ({BREACH:'var(--danger)',LEY:'var(--warn)',MERCADO:'var(--accent)',TECH:'var(--cyan)',POLITICA:'#c97bff',MUNDIAL:'var(--cyan)'})[item.tag] ?? 'var(--text-dim)';
          t.printHTML(
            `<span style="color:${tagCol}">[${_esc(item.tag)}]</span>` +
            ` <span style="color:var(--text-normal)">${_esc(item.title)}</span>`
          );
        });
        t.printHTML(`<span style="color:var(--text-dim)">→ Ver todas las noticias en CrónicaDigital</span>`);
      }
    }, 'Abre la app CrónicaDigital con las noticias.');

    // ── tools (override — integrado con NetworkSystem) ───────────
    t.registerCommand('tools', (args, t) => {
      const gs = GS();
      if (!gs) { t.printLine('GameState no disponible.', 'error'); return; }

      const sw = gs.getSoftware();

      t.printBlank();
      t.printHTML(
        `<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">` +
        `⚙ HERRAMIENTAS INSTALADAS</span>`
      );
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(50)}</span>`);

      const installed = Object.values(sw).filter(s => s.installed);
      if (installed.length === 0) {
        t.printLine('Sin herramientas instaladas.', 'muted');
      } else {
        installed.forEach(s => {
          t.printHTML(
            `  <span style="color:var(--accent)">✓</span>` +
            `  <span style="color:var(--text-bright)">${_esc(s.name)}</span>` +
            `  <span style="color:var(--cyan);font-family:var(--font-hud);font-size:10px;">Lv.${s.level}</span>`
          );
          t.printHTML(
            `     <span style="color:var(--text-muted)">${_esc(s.desc)}</span>`
          );
        });
      }

      t.printBlank();
      t.printHTML(
        `<span style="color:var(--text-dim)">` +
        `Abrí la app "Tools" (icono ⚙ en el escritorio) para comprar más herramientas.` +
        `</span>`
      );

      const shopItems = Object.entries(sw).filter(([,s]) => !s.installed);
      if (shopItems.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">DISPONIBLES EN MERCADO:</span>`);
        shopItems.forEach(([, s]) => {
          t.printHTML(
            `  <span style="color:var(--text-muted)">○  ${_esc(s.name)} — ${_esc(s.desc)}</span>`
          );
        });
      }

    }, 'Muestra herramientas instaladas y disponibles.');

    // ── status (override — con info de red) ─────────────────────
    t.registerCommand('status', (args, t) => {
      const gs   = GS();
      const susp = gs?.getSuspicion() ?? 0;
      const cur  = NS()?.getCurrentNode();

      t.printBlank();
      t.printHTML(
        `<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">` +
        `══ ESTADO DEL SISTEMA ══</span>`
      );
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(44)}</span>`);

      const RS  = window.ReputationSystem;
      const INV = window.InventorySystem;
      const DM  = window.DarkMarketSystem;

      const rows = [
        ['Alias',        gs?.getAlias() ?? '—',                                              'var(--accent)'],
        ['Créditos',     gs ? `$${gs.getMoney().toLocaleString('es-AR')} CR` : '—',          'var(--warn)'],
        ['VPN',          gs?.isVpnActive() ? 'ACTIVA' : 'INACTIVA',                          gs?.isVpnActive() ? 'var(--accent)' : 'var(--text-muted)'],
        ['Nodo actual',  cur ? cur.hostname : 'Ninguno',                                     cur ? 'var(--cyan)' : 'var(--text-dim)'],
        ['Sospecha OS',  `${susp}%`,                                                         susp > 70 ? 'var(--danger)' : susp > 40 ? 'var(--warn)' : 'var(--accent)'],
      ];

      if (RS) {
        rows.push(
          ['Calor policial', `${RS.getHeat()}% (${RS.getHeatLevel().label})`, RS.getHeat() >= 80 ? 'var(--danger)' : RS.getHeat() >= 50 ? 'var(--warn)' : 'var(--accent)'],
          ['Reputación',     `${RS.getReputation()}% — ${RS.getTier().label}`, 'var(--text-normal)']
        );
      }

      rows.forEach(([label, val, col]) => {
        t.printHTML(`  <span style="color:var(--text-muted);min-width:120px;display:inline-block;">${label.padEnd(16)}</span><span style="color:${col}">${_esc(val)}</span>`);
      });

      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">Software instalado:</span>`);
      if (gs) {
        Object.values(gs.getSoftware()).filter(s => s.installed).forEach(s => {
          t.printHTML(`  <span style="color:var(--accent)">✓</span>  <span style="color:var(--text-normal)">${_esc(s.name)}</span>  <span style="color:var(--text-dim)">Lv.${s.level}</span>`);
        });
      }

      if (INV && INV.count() > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">📦 Inventario: ${INV.count()} item(s) — Valor total: ~$${INV.getTotalValue().toLocaleString('es-AR')} CR</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">  Usá "inventory" para ver detalle, "sell [archivo]" para vender.</span>`);
      }

      if (DM) {
        const pending = DM.getOffers('pending').length;
        const listed  = DM.getListings().length;
        if (pending > 0) t.printHTML(`<span style="color:var(--warn)">💰 ${pending} oferta(s) esperando — ejecutá "offers"</span>`);
        else if (listed > 0) t.printHTML(`<span style="color:var(--text-muted)">🔴 ${listed} archivo(s) en venta — esperando compradores.</span>`);
      }

      const breached = NS()?.getKnownNodes().filter(n => NS().isBreached(n.ip)) ?? [];
      if (breached.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--accent)">Nodos comprometidos (${breached.length}):</span>`);
        breached.forEach(n => {
          t.printHTML(`  <span style="color:var(--accent)">✓</span>  <span style="color:var(--text-muted)">${_esc(n.ip)}</span>  <span style="color:var(--text-dim)">${_esc(n.hostname)}</span>`);
        });
      }

    }, 'Muestra estado completo del jugador y del sistema.');

    // ── whoami (override) ────────────────────────────────────────
    t.registerCommand('whoami', (args, t) => {
      const gs = GS();
      t.printBlank();
      t.printHTML(
        `<span style="color:var(--accent)">ghost_0x1</span>` +
        `<span style="color:var(--text-dim)"> @ </span>` +
        `<span style="color:var(--cyan)">AleXim OS 2.4.1</span>`
      );
      t.printHTML(
        `<span style="color:var(--text-muted)">` +
        `"Anónimo. Imposible de rastrear. Supuestamente."</span>`
      );
      if (gs) {
        t.printHTML(
          `<span style="color:var(--text-dim)">` +
          `Reputación: ${gs.getReputation()} pts  |  ` +
          `Misiones completadas: ${NS()?.getCompletedMissions().length ?? 0}` +
          `</span>`
        );
      }

    }, 'Muestra la identidad actual del operador.');

    // ── scanfrom — scan desde nodo comprometido ───────────────────
    t.registerCommand('scanfrom', async (args, t) => {
      if (!NS()) { t.printLine('NetworkSystem no disponible.', 'error'); return; }
      const node = NS().getCurrentNode();
      if (!node) { t.printLine('scanfrom: no conectado a ningún nodo.', 'error'); return; }
      if (!NS().isBreached(node.ip)) {
        t.printLine(`scanfrom: ${node.hostname} no comprometido. Hackealo primero con breach.`, 'error');
        return;
      }
      t.printBlank();
      t.printHTML(`<span style="color:var(--system)">Escaneando red interna desde </span><span style="color:var(--cyan)">${_esc(node.hostname)}</span>...`);
      t.lock();
      AudioSystem.scan();
      const result = await NS().scanFromNode(node.ip);
      t.unlock();
      if (!result.ok) { t.printLine(`scanfrom: ${result.message}`, 'error'); return; }
      t.printBlank();
      if (result.newNodes.length === 0) {
        t.printLine('No se encontraron nuevos nodos en la red interna.', 'muted');
      } else {
        t.printHTML(`<span style="color:var(--accent)">Nodos descubiertos desde ${_esc(node.hostname)}:</span>`);
        result.newNodes.forEach(n => {
          const col = ({ BANK:'#ff8844', CORPORATE:'#ffcc66', GOVERNMENT:'#ff4466', RESEARCH:'#44ffcc' })[n.type] ?? '#aaa';
          t.printHTML(
            `  <span style="color:var(--text-normal)">${n.ip.padEnd(18)}</span>` +
            `<span style="color:${col}">${_esc(n.hostname)}</span>` +
            `  <span style="color:var(--text-dim)">[${n.type}]</span>`
          );
        });
        t.printLine(`${result.newNodes.length} nodo(s) nuevos agregados a la red conocida.`, 'success');
        AudioSystem.success();
      }
    }, 'Escanea la red interna desde el nodo comprometido actual.');

    // ── inventory ─────────────────────────────────────────────────
    t.registerCommand('inventory', (args, t) => {
      const INV = window.InventorySystem;
      if (!INV) { t.printLine('InventorySystem no disponible.', 'error'); return; }
      const items = INV.getInventory().filter(i => !i.sold);
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">📦 INVENTARIO DE DATOS ROBADOS</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(62)}</span>`);
      if (items.length === 0) {
        t.printLine('Inventario vacío. Descargá archivos desde nodos hackeados.', 'muted');
        return;
      }
      t.printHTML(
        `<span style="color:var(--text-dim)">` +
        `${'ARCHIVO'.padEnd(34)}${'TIPO'.padEnd(20)}SENS  VALOR EST.  ESTADO` +
        `</span>`
      );
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(76)}</span>`);
      items.forEach(i => {
        const meta   = INV.getTypeMeta(i.dataType);
        const listed = i.listedForSale ? ' 🔴listado' : '';
        const sensCol = i.sensitivity >= 8 ? 'var(--danger)' : i.sensitivity >= 5 ? 'var(--warn)' : 'var(--accent)';
        t.printHTML(
          `<span style="color:var(--text-bright)">${i.filename.padEnd(34)}</span>` +
          `<span style="color:var(--text-muted)">${(meta?.label ?? i.dataType).slice(0,18).padEnd(20)}</span>` +
          `<span style="color:${sensCol}">${String(i.sensitivity).padEnd(6)}</span>` +
          `<span style="color:var(--warn)">$${String(i.valueEstimate.toLocaleString('es-AR')).padEnd(13)}</span>` +
          `<span style="color:var(--text-dim)">${_esc(listed)}</span>`
        );
      });
      t.printBlank();
      t.printHTML(
        `<span style="color:var(--text-dim)">Total: ${items.length} item(s)  |  Valor total estimado: </span>` +
        `<span style="color:var(--warn)">$${INV.getTotalValue().toLocaleString('es-AR')} CR</span>`
      );
      t.printHTML(`<span style="color:var(--text-dim)">Usá </span><span style="color:var(--cyan)">sell [nombre_archivo]</span><span style="color:var(--text-dim)"> para listar en el DarkMarket.</span>`);
    }, 'Muestra el inventario de datos robados.');

    // ── sell ──────────────────────────────────────────────────────
    t.registerCommand('sell', (args, t) => {
      const DM  = window.DarkMarketSystem;
      const INV = window.InventorySystem;
      if (!DM || !INV) { t.printLine('DarkMarket no disponible.', 'error'); return; }

      const filename = args[0];
      if (!filename) {
        t.printLine('Uso: sell [nombre_archivo]', 'warning');
        t.printLine('Tip: ejecutá inventory para ver tus datos robados.', 'muted');
        return;
      }

      const matches = INV.getByFilename(filename).filter(i => !i.listedForSale);
      if (matches.length === 0) {
        const existing = INV.getByFilename(filename);
        if (existing.some(i => i.listedForSale)) {
          t.printLine(`"${filename}" ya está listado en el DarkMarket. Esperá ofertas.`, 'warning');
        } else {
          t.printLine(`"${filename}" no está en tu inventario. Descargalo primero.`, 'error');
        }
        return;
      }

      const loot   = matches[0];
      const result = DM.listDataForSale(loot.id);
      t.printBlank();
      if (result.ok) {
        AudioSystem.success();
        t.printHTML(`<span style="color:var(--accent)">✓ Datos listados en DarkMarket</span>`);
        t.printHTML(`  <span style="color:var(--text-muted)">Archivo: </span><span style="color:var(--text-bright)">${_esc(filename)}</span>`);
        const meta = INV.getTypeMeta(loot.dataType);
        t.printHTML(`  <span style="color:var(--text-muted)">Tipo: </span><span style="color:var(--warn)">${_esc(meta?.label ?? loot.dataType)}</span>  <span style="color:var(--text-muted)">Sensibilidad: </span><span style="color:var(--accent)">${loot.sensitivity}/10</span>`);
        t.printHTML(`  <span style="color:var(--text-muted)">Valor estimado: </span><span style="color:var(--warn)">~$${loot.valueEstimate.toLocaleString('es-AR')} CR</span>`);
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">Compradores contactados. Las ofertas llegarán en unos minutos por Mensajes.</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">Usá </span><span style="color:var(--cyan)">offers</span><span style="color:var(--text-dim)"> para ver ofertas recibidas.</span>`);
      } else {
        AudioSystem.error();
        t.printLine(`sell: ${result.message}`, 'error');
      }
    }, 'Lista datos robados en el DarkMarket para buscar compradores.', 'sell [archivo]');

    // ── offers ────────────────────────────────────────────────────
    t.registerCommand('offers', (args, t) => {
      const DM  = window.DarkMarketSystem;
      const INV = window.InventorySystem;
      if (!DM) { t.printLine('DarkMarket no disponible.', 'error'); return; }

      const offers = DM.getOffers('pending');
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">💰 OFERTAS PENDIENTES — DARKMARKET</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);

      if (offers.length === 0) {
        t.printLine('Sin ofertas pendientes.', 'muted');
        t.printLine('Listá datos con "sell [archivo]" para recibir ofertas.', 'muted');
        const listed = DM.getListings();
        if (listed.length > 0) {
          t.printBlank();
          t.printHTML(`<span style="color:var(--text-dim)">Archivos en espera de compradores:</span>`);
          listed.forEach(l => {
            const remaining = Math.round((Date.now() - l.listedAt) / 1000);
            t.printHTML(`  <span style="color:var(--text-muted)">${_esc(l.loot.filename)}</span> <span style="color:var(--text-dim)">(listado hace ${remaining}s)</span>`);
          });
        }
        return;
      }

      offers.forEach(o => {
        const loot    = INV?.getData(o.lootId);
        const expires = Math.max(0, Math.round((o.expiresAt - Date.now()) / 1000));
        const expCol  = expires < 60 ? 'var(--danger)' : 'var(--text-dim)';
        t.printBlank();
        t.printHTML(
          `<span style="color:var(--warn)">★ OFERTA</span>` +
          `  <span style="color:var(--text-dim)">${_esc(o.id)}</span>`
        );
        t.printHTML(
          `  <span style="color:var(--text-muted)">Comprador: </span><span style="color:var(--accent)">${_esc(o.buyer)}</span>` +
          `  <span style="color:var(--text-muted)">Archivo: </span><span style="color:var(--text-bright)">${loot ? _esc(loot.filename) : '???'}</span>`
        );
        t.printHTML(
          `  <span style="color:var(--text-muted)">Oferta: </span><span style="color:var(--warn)">$${o.amount.toLocaleString('es-AR')} CR</span>` +
          `  <span style="${expCol}">Expira en: ${expires}s</span>`
        );
        t.printHTML(
          `  <span style="color:var(--text-dim)">→ </span><span style="color:var(--accent)">accept ${_esc(o.id)}</span>` +
          `  <span style="color:var(--text-dim)">o  </span><span style="color:var(--danger)">reject ${_esc(o.id)}</span>`
        );
      });
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">${offers.length} oferta(s) activa(s). Las ofertas expiran en ~3 minutos.</span>`);
    }, 'Muestra ofertas de compradores pendientes en DarkMarket.');

    // ── accept ────────────────────────────────────────────────────
    t.registerCommand('accept', (args, t) => {
      const DM = window.DarkMarketSystem;
      if (!DM) { t.printLine('DarkMarket no disponible.', 'error'); return; }

      const offerId = args[0];
      if (!offerId) { t.printLine('Uso: accept [offer-id]  — Ejecutá offers para ver IDs.', 'warning'); return; }

      const result = DM.acceptOffer(offerId);
      t.printBlank();
      if (result.ok) {
        AudioSystem.success();
        t.printHTML(`<span style="color:var(--accent)">✓ VENTA COMPLETADA</span>`);
        t.printHTML(`  <span style="color:var(--warn)">+$${result.amount.toLocaleString('es-AR')} CR</span><span style="color:var(--text-dim)"> acreditados.</span>`);
        UI.updateHUD?.();
      } else {
        AudioSystem.error();
        t.printLine(`accept: ${result.message}`, 'error');
      }
    }, 'Acepta una oferta de compra del DarkMarket.', 'accept [offer-id]');

    // ── reject ────────────────────────────────────────────────────
    t.registerCommand('reject', (args, t) => {
      const DM = window.DarkMarketSystem;
      if (!DM) { t.printLine('DarkMarket no disponible.', 'error'); return; }

      const offerId = args[0];
      if (!offerId) { t.printLine('Uso: reject [offer-id]', 'warning'); return; }

      const ok = DM.rejectOffer(offerId);
      if (ok) {
        t.printLine(`Oferta ${offerId} rechazada. El comprador se fue.`, 'muted');
        t.printLine('El archivo sigue listado — pueden aparecer nuevas ofertas.', 'muted');
      } else {
        t.printLine(`reject: oferta no encontrada o ya no activa.`, 'error');
      }
    }, 'Rechaza una oferta de compra.', 'reject [offer-id]');

    // ── heat ──────────────────────────────────────────────────────
    t.registerCommand('heat', (args, t) => {
      const RS = window.ReputationSystem;
      if (!RS) { t.printLine('ReputationSystem no disponible.', 'error'); return; }

      const heat    = RS.getHeat();
      const rep     = RS.getReputation();
      const tier    = RS.getTier();
      const hLvl    = RS.getHeatLevel();

      const heatBar = (val) => {
        const filled = Math.round(val / 5);
        const col    = val >= 80 ? 'var(--danger)' : val >= 50 ? 'var(--warn)' : 'var(--accent)';
        return `<span style="color:${col}">${'█'.repeat(filled)}</span><span style="color:var(--text-dim)">${'░'.repeat(20-filled)}</span> ${val}%`;
      };

      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">🌡 ESTADO OPERACIONAL</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(42)}</span>`);
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-muted)">Calor policial:  </span>${heatBar(heat)}`);
      t.printHTML(`<span style="color:var(--text-dim)">Nivel: </span><span style="color:${hLvl.color ?? 'var(--accent)'}">${hLvl.label.toUpperCase()}</span>`);
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-muted)">Reputación:      </span>${heatBar(rep)}`);
      t.printHTML(`<span style="color:var(--text-dim)">Rango: </span><span style="color:var(--accent)">${tier.label.toUpperCase()}</span>`);
      t.printBlank();

      if (heat >= 80) {
        t.printHTML(`<span style="color:var(--danger)">⚠ RASTREO ACTIVO — Reducí actividad o activá VPN.</span>`);
      } else if (heat >= 60) {
        t.printHTML(`<span style="color:var(--warn)">⚠ Calor elevado. Cuidado con operaciones de alto riesgo.</span>`);
      } else {
        t.printHTML(`<span style="color:var(--accent)">✓ Calor bajo. Podés operar con normalidad.</span>`);
      }

      const gs = GS();
      if (gs) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">Saldo actual: </span><span style="color:var(--warn)">$${gs.getMoney().toLocaleString('es-AR')} CR</span>`);
        const inv = window.InventorySystem;
        if (inv) {
          t.printHTML(`<span style="color:var(--text-dim)">Inventario: </span><span style="color:var(--text-normal)">${inv.count()} item(s)  Valor total: ~$${inv.getTotalValue().toLocaleString('es-AR')} CR</span>`);
        }
        const dm = window.DarkMarketSystem;
        if (dm) {
          const pendOffers = dm.getOffers('pending').length;
          if (pendOffers > 0) t.printHTML(`<span style="color:var(--warn)">💰 ${pendOffers} oferta(s) esperando respuesta — ejecutá "offers"</span>`);
        }
      }
    }, 'Muestra calor policial, reputación y resumen de estado.');

    // ── accept-mission ────────────────────────────────────────────
    t.registerCommand('accept-mission', (args, t) => {
      const ME = window.MissionEngine;
      if (!ME) { t.printLine('MissionEngine no disponible.', 'error'); return; }
      const id = args[0];
      if (!id) { t.printLine('Uso: accept-mission [id]', 'warning'); return; }
      const res = ME.accept(id);
      if (res.ok) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--accent)">✓ Misión aceptada: ${_esc(res.mission.title)}</span>`);
        t.printHTML(`<span style="color:var(--text-muted)">Objetivo: ${_esc(res.mission.objective)}</span>`);
        t.printHTML(`<span style="color:var(--warn)">Pago: $${res.mission.reward.toLocaleString('es-AR')} CR al completar</span>`);
        if (res.mission.morality === 'dark') {
          t.printHTML(`<span style="color:var(--danger)">⚠ Esta operación tiene consecuencias morales serias.</span>`);
        }
      } else {
        AudioSystem.error();
        t.printLine(`accept-mission: ${res.message}`, 'error');
      }
    }, 'Acepta una misión disponible.', 'accept-mission [id]');

    // ── reject-mission ────────────────────────────────────────────
    t.registerCommand('reject-mission', (args, t) => {
      const ME = window.MissionEngine;
      if (!ME) return;
      const id = args[0];
      if (!id) { t.printLine('Uso: reject-mission [id]', 'warning'); return; }
      ME.reject(id);
      t.printLine(`Misión rechazada: ${id}`, 'muted');
    }, 'Rechaza una misión.', 'reject-mission [id]');

    // ── missions2 (MissionEngine) ─────────────────────────────────
    t.registerCommand('missions2', (args, t) => {
      const ME = window.MissionEngine;
      if (!ME) { t.printLine('MissionEngine no disponible.', 'error'); return; }
      const available  = ME.getAvailable();
      const active     = ME.getActive();
      const completed  = ME.getCompleted();
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);">🎯 MISIONES AVANZADAS</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(50)}</span>`);

      if (active.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">▶ ACTIVAS (${active.length})</span>`);
        active.forEach(m => {
          t.printHTML(`  <span style="color:var(--text-bright)">${_esc(m.title)}</span>`);
          t.printHTML(`  <span style="color:var(--text-dim)">Objetivo: ${_esc(m.objective)}</span>`);
        });
      }

      if (available.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--accent)">✦ DISPONIBLES (${available.length})</span>`);
        available.forEach(m => {
          const moral = { dark:'🔴', grey:'🟡', neutral:'⚪', whistleblower:'🔵', trap:'🚨' }[m.morality] ?? '⚪';
          t.printHTML(
            `  ${moral} <span style="color:var(--text-bright)">${_esc(m.title)}</span>` +
            `  <span style="color:var(--text-dim)">[${_esc(m.client)}]</span>`
          );
          t.printHTML(`  <span style="color:var(--text-muted)">${_esc(m.desc.slice(0,100))}...</span>`);
          t.printHTML(
            `  <span style="color:var(--warn)">$${m.reward.toLocaleString('es-AR')} CR</span>` +
            `  <span style="color:var(--text-dim)">| Calor: +${m.heatCost}%</span>` +
            `  <span style="color:var(--text-dim)">→ accept-mission ${_esc(m.id)}</span>`
          );
        });
      } else {
        t.printLine('Sin misiones disponibles ahora. Tu reputación define qué trabajos llegán.', 'muted');
      }

      if (completed.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">Completadas: ${completed.length}</span>`);
      }
    }, 'Muestra misiones del motor avanzado (MissionEngine).');

    // ── market ────────────────────────────────────────────────────
    t.registerCommand('market', (args, t) => {
      const ES = window.EconomySystem;
      if (!ES) { t.printLine('EconomySystem no disponible.', 'error'); return; }
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);">📊 ESTADO DEL MERCADO NEGRO</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);

      const status = ES.getMarketStatus();
      status.forEach(({ type, mult, trend }) => {
        const col = mult > 130 ? 'var(--accent)' : mult > 100 ? 'var(--text-normal)' : mult < 70 ? 'var(--danger)' : 'var(--warn)';
        const trendCol = trend.includes('↑') ? 'var(--accent)' : trend.includes('↓') ? 'var(--danger)' : 'var(--text-dim)';
        t.printHTML(
          `  <span style="color:var(--text-muted)">${type.replace(/_/g,' ').padEnd(24)}</span>` +
          `<span style="color:${col}">${String(mult + '%').padEnd(8)}</span>` +
          `<span style="color:${trendCol}">${trend}</span>`
        );
      });

      const demands = ES.getActiveDemand();
      if (demands.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">🔥 DEMANDAS ACTIVAS:</span>`);
        demands.forEach(d => {
          t.printHTML(`  <span style="color:var(--warn)">${_esc(d.label)}</span>`);
        });
      }
    }, 'Muestra el estado actual del mercado negro.');

    // ── events ────────────────────────────────────────────────────
    t.registerCommand('events', (args, t) => {
      const EV = window.EventSystem;
      if (!EV) { t.printLine('EventSystem no disponible.', 'error'); return; }
      const active  = EV.getActiveEvents();
      const history = EV.getEventHistory().slice(-5);
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);">🌐 EVENTOS MUNDIALES</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(44)}</span>`);

      if (active.length > 0) {
        t.printHTML(`<span style="color:var(--warn)">▶ ACTIVOS (${active.length}):</span>`);
        active.forEach(ev => {
          t.printHTML(`  <span style="color:var(--text-bright)">${_esc(ev.title)}</span>`);
          t.printHTML(`  <span style="color:var(--text-muted)">${_esc(ev.body.slice(0,120))}...</span>`);
        });
      } else {
        t.printLine('Sin eventos activos en este momento.', 'muted');
      }

      if (history.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">Historial reciente:</span>`);
        history.forEach(ev => {
          t.printHTML(`  <span style="color:var(--text-dim)">• ${_esc(ev.title)}</span>`);
        });
      }
    }, 'Muestra eventos mundiales activos e historial.');

    // ── cleaner ───────────────────────────────────────────────────
    t.registerCommand('cleaner', (args, t) => {
      const PS = window.PursuitSystem;
      if (!PS) { t.printLine('PursuitSystem no disponible.', 'error'); return; }
      const cost = window.BalanceConfig?.pursuit?.cleanerCost ?? 2000;
      t.printBlank();
      t.printHTML(`<span style="color:var(--warn)">🧹 CONTRATAR LIMPIADOR</span>`);
      t.printHTML(`<span style="color:var(--text-muted)">Servicio de borrado de rastros digitales.</span>`);
      t.printHTML(`<span style="color:var(--text-muted)">Costo: </span><span style="color:var(--warn)">$${cost.toLocaleString('es-AR')} CR</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">→ Confirmar con: cleaner confirm</span>`);

      if (args[0] === 'confirm') {
        const res = PS.payCleaner();
        if (res.ok) {
          AudioSystem.success();
          t.printBlank();
          t.printHTML(`<span style="color:var(--accent)">✓ ${_esc(res.message)}</span>`);
          UI.updateHUD?.();
        } else {
          AudioSystem.error();
          t.printLine(res.message, 'error');
        }
      }
    }, 'Contrata un limpiador para reducir el calor policial.', 'cleaner [confirm]');

    // ── save y load ───────────────────────────────────────────────
    t.registerCommand('save', (args, t) => {
      const SS = window.SaveSystem;
      if (!SS) {
        // Fallback al GameState save
        if (typeof GameState !== 'undefined') { GameState.save(); t.printLine('Partida guardada.', 'success'); }
        return;
      }
      const res = SS.save();
      t.printLine(res.ok ? 'Partida guardada.' : `Error: ${res.error}`, res.ok ? 'success' : 'error');
    }, 'Guarda la partida.');

    t.registerCommand('load', (args, t) => {
      const SS = window.SaveSystem;
      if (!SS) { t.printLine('SaveSystem no disponible.', 'error'); return; }
      const info = SS.getInfo();
      if (!info) { t.printLine('Sin guardado encontrado.', 'muted'); return; }
      t.printHTML(`<span style="color:var(--text-muted)">Guardado del: </span><span style="color:var(--cyan)">${_esc(info.date)}</span>`);
      t.printHTML(`<span style="color:var(--text-muted)">Saldo: $${info.money?.toLocaleString('es-AR')} CR | Reputación: ${info.rep}% | Calor: ${info.heat}%</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">→ load confirm  para cargar</span>`);
      if (args[0] === 'confirm') {
        const res = SS.load();
        t.printLine(res.ok ? '✓ Partida cargada.' : `Error: ${res.message}`, res.ok ? 'success' : 'error');
        if (res.ok) { UI.updateHUD?.(); AudioSystem.success(); }
      }
    }, 'Carga una partida guardada.', 'load [confirm]');

    // ── whois ─────────────────────────────────────────────────────
    t.registerCommand('whois', (args, t) => {
      const PG = window.PersonGenerator;
      if (!PG || PG.count() === 0) {
        t.printLine('El ecosistema humano aún se está generando. Intentá en unos segundos.', 'muted');
        return;
      }
      const query = args.join(' ');
      if (!query) { t.printLine('Uso: whois [nombre, ciudad o empresa]', 'warning'); return; }

      const all = PG.getAll();
      const q   = query.toLowerCase();
      const results = all.filter(p =>
        p.fullName.toLowerCase().includes(q) ||
        (p.orgName||'').toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.job.toLowerCase().includes(q)
      ).slice(0, 5);

      if (results.length === 0) { t.printLine(`Sin resultados para "${query}".`, 'muted'); return; }

      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);">🔍 WHOIS: ${_esc(query.toUpperCase())}</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(50)}</span>`);
      results.forEach(p => {
        const sec = '█'.repeat(p.securityLevel) + '░'.repeat(5 - p.securityLevel);
        t.printBlank();
        t.printHTML(`  <span style="color:var(--text-bright);font-weight:bold;">${_esc(p.fullName)}</span>  <span style="color:var(--text-dim)">${p.age}a · ${_esc(p.city)}</span>`);
        t.printHTML(`  <span style="color:var(--text-muted)">${_esc(p.job)}</span> <span style="color:var(--text-dim)">@</span> <span style="color:var(--cyan)">${_esc(p.orgName||'?')}</span>`);
        t.printHTML(`  <span style="color:var(--text-dim)">Email: </span><span style="color:var(--warn)">${_esc(p.email)}</span>`);
        t.printHTML(`  <span style="color:var(--text-dim)">Seg: ${sec}  NSE: ${p.nse}/5</span>${p.bankAccount ? '  <span style="color:var(--accent)">🏦</span>' : ''}${p.cryptoWallet ? '  <span style="color:var(--warn)">₿</span>' : ''}${p.victimized ? '  <span style="color:var(--danger)">⚠ VÍCTIMA</span>' : ''}`);
        t.printHTML(`  <span style="color:var(--text-dim)">→ Profiler: </span><span style="color:var(--cyan)" style="cursor:pointer" onclick="AleXimOS.openProfile('${p.id}')">${_esc(p.id)}</span>`);
      });
      if (all.filter(p => p.fullName.toLowerCase().includes(q)).length > 5) {
        t.printLine(`… Más resultados en PeopleSearch.`, 'muted');
      }
    }, 'Busca información sobre una persona en el mundo.', 'whois [nombre/empresa/ciudad]');

    // ── phish — ingeniería social usando datos de persona ─────────
    t.registerCommand('phish', async (args, t) => {
      const PG = window.PersonGenerator;
      if (!PG || PG.count() === 0) {
        t.printLine('El ecosistema humano no está disponible.', 'muted');
        return;
      }

      const node = NS()?.getCurrentNode?.();
      if (!node) {
        t.printLine('Conectate a un nodo objetivo primero.', 'warning');
        t.printLine('Flujo: connect [ip] → recon → phish [persona] → bypass AUTH', 'muted');
        return;
      }

      // Sin args: mostrar ayuda y personas del nodo
      if (!args[0]) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">🎣 PHISHING — Ingeniería Social</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(50)}</span>`);
        t.printHTML(`<span style="color:var(--text-normal)">Usá datos reales de empleados de ${_esc(node.hostname)}</span>`);
        t.printHTML(`<span style="color:var(--text-normal)">para engañar su sistema de autenticación.</span>`);
        t.printBlank();

        // Mostrar personas de esta org
        const all = PG.getAll();
        const orgPeople = all.filter(p => p.orgIp === node.ip || p.orgName === node.hostname).slice(0, 5);

        if (orgPeople.length > 0) {
          t.printHTML(`<span style="color:var(--text-dim)">Empleados detectados en ${_esc(node.hostname)}:</span>`);
          orgPeople.forEach(p => {
            t.printHTML(
              `  <span style="color:var(--cyan)">${_esc(p.fullName)}</span>` +
              `  <span style="color:var(--text-dim)">${_esc(p.job)}  ${_esc(p.email)}</span>`
            );
          });
          t.printBlank();
          t.printHTML(`<span style="color:var(--text-dim)">→ phish [nombre o parte del nombre]  para preparar el ataque</span>`);
        } else {
          t.printHTML(`<span style="color:var(--text-dim)">Sin empleados conocidos en este nodo.</span>`);
          t.printHTML(`<span style="color:var(--text-dim)">Usá whois [empresa] para buscar personas o PeopleSearch.</span>`);
        }
        t.printBlank();
        return;
      }

      // Buscar la persona objetivo
      const query   = args.join(' ').toLowerCase();
      const all     = PG.getAll();
      const targets = all.filter(p =>
        p.fullName.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query)
      ).slice(0, 1);

      if (targets.length === 0) {
        t.printLine(`Sin resultados para "${args.join(' ')}". Probá con whois primero.`, 'muted');
        return;
      }

      const person = targets[0];
      const hasData = person.bankAccount || person.cryptoWallet || person.orgIp;

      t.printBlank();
      t.printHTML(`<span style="color:var(--warn)">🎣 PREPARANDO ATAQUE DE PHISHING</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(50)}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Objetivo:  </span><span style="color:var(--text-bright)">${_esc(person.fullName)}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Email:     </span><span style="color:var(--warn)">${_esc(person.email)}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Teléfono:  </span><span style="color:var(--warn)">${_esc(person.phone)}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Empresa:   </span><span style="color:var(--cyan)">${_esc(person.orgName || 'desconocida')}</span>`);
      t.printBlank();

      t.lock();
      t.printHTML(`<span style="color:var(--text-dim)">Construyendo señuelo personalizado...</span>`);
      await _delay(800 + Math.random() * 600);

      t.printHTML(`<span style="color:var(--text-dim)">Analizando patrones de comportamiento digital...</span>`);
      await _delay(600 + Math.random() * 400);

      // Apply phishing bonus to the current session
      const successBonus = hasData ? 0.25 : 0.12;
      if (window.HackingEngine) {
        const sess = HackingEngine.getSession(node.ip);
        if (sess) {
          sess._phishBonus = (sess._phishBonus || 0) + successBonus;
          sess._phishTarget = person.fullName;
        }
      }

      t.unlock();
      t.printHTML(`<span style="color:var(--accent)">✓ Señuelo listo.</span>  <span style="color:var(--text-dim)">+${Math.round(successBonus * 100)}% éxito en bypass AUTH</span>`);
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">El ataque de ingeniería social está activo en esta sesión.</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">→ bypass AUTH fisherman  para usarlo</span>`);
      t.printBlank();

      ReputationSystem?.addHeat?.(8, 'phishing');
      UI?.updateHUD?.();

    }, 'Ingeniería social: usá datos de empleados para mejorar bypass AUTH.', 'phish [nombre?]');

    // ── feed ──────────────────────────────────────────────────────
    t.registerCommand('feed', (args, t) => {
      const SC = window.SocialContentGenerator;
      if (!SC || SC.count() === 0) {
        t.printLine('NodoSocial aún cargando. Intentá en unos segundos.', 'muted');
        return;
      }
      const posts = SC.getFeed(8);
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);">🌐 NODOSOCIAL — ÚLTIMAS PUBLICACIONES</span>`);
      const typeColor = { victim:'var(--danger)', cop:'var(--warn)', political:'var(--cyan)', event:'var(--accent)' };
      posts.forEach(p => {
        const col  = typeColor[p.type] || 'var(--text-dim)';
        const flag = p.type !== 'normal' ? ` <span style="color:${col}">[${_esc(p.type.toUpperCase())}]</span>` : '';
        t.printHTML(`<span style="color:var(--accent)">${_esc(p.handle)}</span>  <span style="color:var(--text-dim)">${_esc(p.city||'')}</span>${flag}`);
        t.printHTML(`  <span style="color:var(--text-normal)">${_esc((p.content||'').slice(0, 110))}${(p.content||'').length > 110 ? '…' : ''}</span>`);
        t.printBlank();
      });
      t.printHTML(`<span style="color:var(--text-dim)">→ Abrí la app NodoSocial para el feed completo.</span>`);
    }, 'Muestra el feed de NodoSocial en la terminal.');

    // ── people ────────────────────────────────────────────────────
    t.registerCommand('people', (args, t) => {
      const PG = window.PersonGenerator;
      if (!PG) { t.printLine('PersonGenerator no disponible.', 'error'); return; }
      const count  = PG.count();
      const victim = PG.getAll().filter(p => p.victimized).length;
      const DF     = window.DarkForumSystem;
      const SC     = window.SocialContentGenerator;
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);">👤 ECOSISTEMA HUMANO — ESTADÍSTICAS</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(48)}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Ciudadanos generados: </span><span style="color:var(--accent)">${count}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Víctimas confirmadas: </span><span style="color:${victim > 0 ? 'var(--danger)' : 'var(--text-dim)'}">${victim}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Posts en NodoSocial:  </span><span style="color:var(--accent)">${SC?.count?.() ?? 0}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Posts en DarkForum:   </span><span style="color:var(--accent)">${DF?.count?.() ?? 0}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Relaciones sociales:  </span><span style="color:var(--accent)">${window.RelationshipSystem?.nodeCount?.() ?? 0}</span>`);
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">whois [nombre]  ·  phish [nombre]  ·  feed  ·  PeopleSearch  ·  NodoSocial  ·  DarkForum</span>`);
    }, 'Muestra estadísticas del ecosistema humano.');

    // ── agents ─────────────────────────────────────────────────────
    t.registerCommand('agents', (args, t) => {
      const AS = window.AdversarialSystem;
      if (!AS) { t.printLine('AdversarialSystem no disponible.', 'error'); return; }

      const all    = AS.getAgents();
      const active = AS.getActive();
      const heat   = window.ReputationSystem?.getHeat?.() ?? 0;

      t.printBlank();
      t.printHTML(`<span style="color:var(--danger);font-family:var(--font-hud);">☣ AGENTES ADVERSARIALES — THREAT STATUS</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);
      t.printHTML(
        `  <span style="color:var(--text-muted)">Heat actual: </span>` +
        `<span style="color:${heat>60?'var(--danger)':heat>35?'var(--warn)':'var(--accent)'};">${heat}%</span>` +
        `  <span style="color:var(--text-muted)">Agentes activos: </span>` +
        `<span style="color:${active.length>0?'var(--danger)':'var(--accent)'};">${active.length}/${all.length}</span>`
      );
      t.printBlank();

      const typeColor = { police:'var(--danger)', rival:'var(--warn)', ids:'var(--cyan)' };
      const stateLabel = { idle:'● Inactivo', passive:'● Pasivo', hunting:'⚡ Rastreando', active:'⚡ Atacando', scanning:'🔍 Escaneando' };

      all.forEach(a => {
        const col = typeColor[a.type] ?? 'var(--text-dim)';
        const state = stateLabel[a.state] ?? a.state;
        const stateCol = a.state === 'hunting' || a.state === 'active' ? 'var(--danger)' : 'var(--text-dim)';
        t.printHTML(
          `  ${a.icon} <span style="color:${col};min-width:120px;display:inline-block;">${_esc(a.name)}</span>` +
          `  <span style="color:var(--text-dim)">Lv.${a.level}</span>` +
          `  <span style="color:${stateCol};">${state}</span>` +
          (a.heatThreshold > 0 ? `  <span style="color:var(--text-dim)">[activa >heat ${a.heatThreshold}%]</span>` : '')
        );
      });

      const log = AS.getLog().slice(0, 3);
      if (log.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">ÚLTIMAS ACCIONES:</span>`);
        log.forEach(e => {
          const sevCol = e.severity === 'critical' ? 'var(--danger)' : e.severity === 'warning' ? 'var(--warn)' : 'var(--text-dim)';
          t.printHTML(`  <span style="color:${sevCol}">[${_esc(e.action)}]</span> <span style="color:var(--text-muted)">${_esc(e.description.slice(0,80))}</span>`);
        });
      }

      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">→ Abrí Threat Monitor en el escritorio para el panel completo.</span>`);
    }, 'Muestra el estado de los agentes adversariales.');

    // ── scan-threats ───────────────────────────────────────────────
    t.registerCommand('scan-threats', async (args, t) => {
      const AS = window.AdversarialSystem;
      if (!AS) { t.printLine('AdversarialSystem no disponible.', 'error'); return; }

      t.lock();
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan)">⟳ Escaneando amenazas activas...</span>`);
      AudioSystem?.scan?.();
      await new Promise(r => setTimeout(r, 2500));
      t.unlock();

      const rival   = AS.getRivalStatus();
      const log     = AS.getLog();
      const active  = AS.getActive();
      const heat    = window.ReputationSystem?.getHeat?.() ?? 0;

      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Agentes activos:   </span><span style="color:${active.length>0?'var(--danger)':'var(--accent)'};">${active.length}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Nodos rivales:     </span><span style="color:${rival.compromisedByRival.length>0?'var(--warn)':'var(--accent)'};">${rival.compromisedByRival.length}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Acciones enemigas: </span><span style="color:var(--text-bright);">${log.length}</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">Nivel de amenaza:  </span><span style="color:${heat>70?'var(--danger)':heat>40?'var(--warn)':'var(--accent)'}">${heat>70?'🔴 CRÍTICO':heat>40?'🟡 ELEVADO':'🟢 BAJO'}</span>`);

      if (active.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--danger)">⚠ AGENTES EN MODO ACTIVO:</span>`);
        active.forEach(a => t.printHTML(`  ${a.icon} <span style="color:var(--warn)">${_esc(a.name)}</span> — ${_esc(a.state)}`));
      }
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">agents  ·  Threat Monitor para detalle completo</span>`);
    }, 'Escanea amenazas activas: agentes, rivales y trampas.');

  } // end _registerCommands

  // ════════════════════════════════════════════════════════════════
  // EVENTOS DEL NETWORK SYSTEM
  // ════════════════════════════════════════════════════════════════

  function _hookNetworkEvents() {
    if (!NS()) return;

    // Fix #5 — Auto-open and update Network Map on breach/scan/connect
    const _refreshNetworkMap = () => {
      if (typeof AleXimOS === 'undefined') return;
      const win = AleXimOS.getOpenWindow('network');
      if (win) {
        // Re-render if already open
        const NS2 = window.NetworkSystem;
        const el  = win.contentEl;
        if (el && NS2) {
          // Trigger re-render via the existing aleximOS network renderer
          AleXimOS.openApp('network'); // singleton focuses it
        }
      }
    };

    NS().on('breach', ({ node, success }) => {
      if (!success) return;
      // Auto-open Network Map after first successful breach
      if (typeof AleXimOS !== 'undefined') {
        setTimeout(() => {
          const existing = AleXimOS.getOpenWindow('network');
          if (!existing) {
            AleXimOS.openApp('network');
            if (_term) {
              _term.printBlank?.();
              _term.printHTML?.(`<span style="color:var(--text-dim)">🗺 Red actualizada — abrí el Mapa de Red para ver la topología.</span>`);
            }
          } else {
            _refreshNetworkMap();
          }
        }, 800);
      }
    });

    NS().on('scan', () => { setTimeout(_refreshNetworkMap, 200); });
    NS().on('connect', () => { setTimeout(_refreshNetworkMap, 100); });
    NS().on('disconnect', () => { setTimeout(_refreshNetworkMap, 100); });

    // Misiones completadas
    NS().on('missionComplete', ({ mission }) => {
      if (!_term) return;
      _term.printBlank();
      _term.printHTML(`<span style="color:var(--accent)">╔══════════════════════════════════════╗</span>`);
      _term.printHTML(`<span style="color:var(--accent)">║  ✓  MISIÓN COMPLETADA                ║</span>`);
      _term.printHTML(`<span style="color:var(--accent)">║  ${_esc(mission.title).padEnd(36)}║</span>`);
      _term.printHTML(`<span style="color:var(--accent)">║  Recompensa: +${String(mission.reward + ' CR').padEnd(21)}║</span>`);
      _term.printHTML(`<span style="color:var(--accent)">╚══════════════════════════════════════╝</span>`);
      _term.printBlank();
      AudioSystem.success();
    });

    // Fix #4 — Mensajes van a la app Mensajes, NO a la terminal
    window.addEventListener('darkmarket-message', (e) => {
      const msg = e.detail;
      if (!msg) return;
      // Solo notificación del OS — nunca en la terminal
      if (typeof UI !== 'undefined') {
        const icon = msg.type === 'mission' ? '🎯' : msg.type === 'offer' ? '💰' : '💬';
        UI.notify(`${icon} ${_esc(msg.from)}: ${_esc(msg.subject)}`, 'warning', 7000);
      }
      // Badge en ícono de Mensajes
      const badge = document.getElementById('messages-app-badge');
      if (badge) {
        const cur = parseInt(badge.textContent || '0', 10);
        badge.textContent = cur + 1 > 9 ? '9+' : cur + 1;
        badge.style.display = 'flex';
      }
    });

    // Fix #3 — una sola notificación por noticia, con cooldown 8 segundos
    let _lastNewsId = null, _newsCooldown = 0;
    window.addEventListener('news-update', (e) => {
      const news = e.detail?.news;
      if (!news || !news.dynamic) return;
      const now = Date.now();
      if (news.id === _lastNewsId || now < _newsCooldown) return;
      _lastNewsId  = news.id;
      _newsCooldown = now + 8000;
      if (typeof UI !== 'undefined') {
        const emoji = ({BREACH:'🔴',LEY:'⚖️',MERCADO:'📈',GOB:'🏛️',POLITICA:'🗳️',MUNDIAL:'🌐',VICTIMAS:'😢',ECONOMIA:'💸'})[news.tag] ?? '📰';
        UI.notify(`${emoji} ${news.title.slice(0, 65)}${news.title.length > 65 ? '…' : ''}`, 'info', 6000);
      }
      _updateNewsBadge();
    });
  }

  function _updateNewsBadge() {
    const badge = document.getElementById('news-app-badge');
    if (!badge || !window.NewsSystem) return;
    const unread = NewsSystem.get({ unreadOnly: true }).length;
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  function _updateThreatBadge(show) {
    const badge = document.getElementById('threat-badge');
    if (!badge) return;
    badge.style.display = show ? 'flex' : 'none';
  }

  // Hook adversarial log events to update badge + terminal
  window.addEventListener('alexim-ready', () => {
    if (!window.AdversarialSystem) return;
    AdversarialSystem.on('log', entry => {
      // Flash threat badge for warning/critical entries
      if (entry.severity !== 'normal') {
        _updateThreatBadge(true);
        // Auto-hide badge after 30s if player opens the app
        setTimeout(() => {
          if (!AleXimOS.getOpenWindow('threatmonitor')) return;
          _updateThreatBadge(false);
        }, 30000);
      }
    });
    AdversarialSystem.on('agent_activated', ({ agent }) => {
      _updateThreatBadge(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════

  return {

    /**
     * Adjunta el GameLoop a una instancia de Terminal.
     * Registra todos los comandos del loop jugable.
     * @param {Terminal} terminal
     */
    attach(terminal) {
      if (!terminal) { console.error('[GameLoop] Terminal inválida.'); return; }
      _term = terminal;
      _registerCommands(terminal);
      _hookNetworkEvents();
      console.log('[GameLoop] Loop jugable activo.');
    },

    /** Referencia a la terminal activa. */
    getTerminal() { return _term; },
  };

})();
