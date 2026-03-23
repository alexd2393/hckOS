/**
 * localSystem_commands.js — Comandos de Terminal para LocalSystem
 * AleXim OS v10
 *
 * Registra los siguientes comandos en el GameLoop:
 *
 *   sysinfo                   — recursos del sistema (RAM, storage, anonimato)
 *   install [tool]            — instala una herramienta descargada
 *   unload [tool]             — descarga una herramienta de la RAM
 *   upgrade [tool] [axis]     — mejora un eje de una herramienta
 *   repair [tool]             — repara una herramienta quemada
 *   upgrade-ram               — compra más RAM
 *   upgrade-storage           — compra más almacenamiento
 *
 * También parchea el comando 'tools' existente para mostrar el estado local,
 * y el flujo de compra (_buy en aleximOS) para usar receiveBinary().
 *
 * Se carga DESPUÉS de gameLoop.js y aleximOS.js, ANTES de main.js.
 */

(function () {
  'use strict';

  // ─── BUG #1 FIX: alexim-ready dispara ANTES de GameLoop.attach()
  // Solución dual: escuchar 'gameloop-ready' (disparado justo después de attach)
  // Y también escuchar 'alexim-ready' con retry como fallback.
  function _waitAndInit(attempts) {
    const t = window.GameLoop?.getTerminal?.();
    if (t) {
      _registerLocalCommands();
      _patchBuyFlow();
      _hookLocalSystemEvents();
      console.log('[LocalSystem_CMD] Comandos registrados.');
      return;
    }
    if (attempts > 0) {
      setTimeout(function() { _waitAndInit(attempts - 1); }, 400);
    } else {
      console.error('[LocalSystem_CMD] No se pudo obtener terminal después de varios intentos.');
    }
  }

  // Primario: gameloop-ready se dispara justo después de GameLoop.attach() en main.js
  window.addEventListener('gameloop-ready', function () {
    _waitAndInit(5);
  });

  // Fallback: alexim-ready con delay largo (por si gameloop-ready no llega)
  window.addEventListener('alexim-ready', function () {
    setTimeout(function() { _waitAndInit(20); }, 1500);
  });

  // ─── Helper de escape ─────────────────────────────────────────
  function _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Barra de recurso visual ──────────────────────────────────
  function _resBar(pct, color) {
    const filled = Math.round(pct / 5);
    const empty  = 20 - filled;
    return `<span style="color:${color}">${'█'.repeat(filled)}</span>` +
           `<span style="color:var(--text-dim)">${'░'.repeat(empty)}</span>` +
           ` <span style="color:var(--text-bright)">${pct}%</span>`;
  }

  // ─── Barra de eje de herramienta ──────────────────────────────
  function _axisBar(current, max, color) {
    return `<span style="color:${color}">${'●'.repeat(current)}</span>` +
           `<span style="color:var(--text-dim)">${'○'.repeat(max - current)}</span>`;
  }

  // ─── Color de burn ────────────────────────────────────────────
  function _burnColor(burn) {
    if (burn >= 80) return 'var(--danger)';
    if (burn >= 50) return 'var(--warn)';
    return 'var(--accent)';
  }

  // ─── Registrar comandos en el GameLoop ───────────────────────
  let _commandsRegistered = false;  // EXTRA FIX: prevent double-register
  function _registerLocalCommands() {
    const terminal = window.GameLoop?.getTerminal?.();
    if (!terminal) return;
    if (_commandsRegistered) return;
    _commandsRegistered = true;

    // ── sysinfo ────────────────────────────────────────────────
    terminal.registerCommand('sysinfo', (args, t) => {
      const LS = window.LocalSystem;
      if (!LS) { t.printLine('LocalSystem no disponible.', 'error'); return; }

      const ram     = LS.getRam();
      const stor    = LS.getStorage();
      const anon    = LS.getAnonymity();
      const tools   = LS.getLocalTools();
      const active  = tools.filter(t => t.status === 'active');
      const binary  = tools.filter(t => t.status === 'binary');
      const unloaded= tools.filter(t => t.status === 'unloaded');

      const anonColor = anon < 20 ? 'var(--danger)' : anon < 50 ? 'var(--warn)' : 'var(--accent)';
      const ramColor  = ram.pct > 85 ? 'var(--danger)' : ram.pct > 60 ? 'var(--warn)' : 'var(--accent)';
      const storColor = stor.pct > 85 ? 'var(--danger)' : stor.pct > 60 ? 'var(--warn)' : 'var(--accent)';

      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);letter-spacing:2px;">🖥 SISTEMA LOCAL — ghost_0x1@AleXim</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(52)}</span>`);

      t.printBlank();
      t.printHTML(`  <span style="color:var(--text-muted)">RAM         </span>${_resBar(ram.pct, ramColor)} <span style="color:var(--text-dim)">${ram.used}/${ram.max} GB</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">STORAGE     </span>${_resBar(stor.pct, storColor)} <span style="color:var(--text-dim)">${stor.used.toFixed(1)}/${stor.max} GB</span>`);
      t.printHTML(`  <span style="color:var(--text-muted)">ANONIMATO   </span>${_resBar(anon, anonColor)}`);

      // Advertencias de recursos
      if (ram.pct > 85)  t.printHTML(`  <span style="color:var(--warn)">⚠ RAM casi llena — descargá herramientas con unload [tool]</span>`);
      if (stor.pct > 85) t.printHTML(`  <span style="color:var(--warn)">⚠ Storage casi lleno — vendé datos en el DarkMarket</span>`);
      if (anon < 20)     t.printHTML(`  <span style="color:var(--danger)">🔴 Anonimato crítico — esperá o activá VPN</span>`);

      // Herramientas activas
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">HERRAMIENTAS ACTIVAS (${active.length}) — RAM usada: ${ram.used} GB</span>`);
      if (active.length === 0) {
        t.printHTML(`  <span style="color:var(--text-dim)">Ninguna herramienta activa. Usá install [tool] para activar.</span>`);
      } else {
        active.forEach(tool => {
          const burnCol = _burnColor(tool.burn ?? 0);
          const ramStr  = `${LS.getCatalog()[tool.id]?.ram ?? '?'} GB`;
          t.printHTML(
            `  ${_esc(tool.icon)} <span style="color:var(--accent);min-width:160px;display:inline-block;">${_esc(tool.name)}</span>` +
            `  <span style="color:var(--text-dim)">${ramStr} RAM</span>` +
            `  <span style="color:${burnCol}">Desgaste: ${Math.round(tool.burn ?? 0)}%</span>`
          );
          t.printHTML(
            `     SPD ${_axisBar(tool.axes.speed,   LS.getCatalog()[tool.id]?.maxAxes?.speed ?? 3, 'var(--cyan)')}` +
            `  SIL ${_axisBar(tool.axes.stealth, LS.getCatalog()[tool.id]?.maxAxes?.stealth ?? 3, 'var(--accent)')}` +
            `  PWR ${_axisBar(tool.axes.power,   LS.getCatalog()[tool.id]?.maxAxes?.power ?? 3, 'var(--warn)')}`
          );
        });
      }

      // Descargadas / binarios
      if (unloaded.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">DESCARGADAS (${unloaded.length}) — disponibles para activar:</span>`);
        unloaded.forEach(tool => {
          t.printHTML(`  ${_esc(tool.icon)} <span style="color:var(--text-muted)">${_esc(tool.name)}</span>  <span style="color:var(--text-dim)">→ install ${_esc(tool.id)}</span>`);
        });
      }

      if (binary.length > 0) {
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">BINARIOS (${binary.length}) — descargados, sin instalar:</span>`);
        binary.forEach(tool => {
          t.printHTML(`  ${_esc(tool.icon)} <span style="color:var(--text-muted)">${_esc(tool.name)}</span>  <span style="color:var(--text-dim)">→ install ${_esc(tool.id)}</span>`);
        });
      }

      // Upgrades de hardware disponibles
      t.printBlank();
      // BUG #2 FIX: use public getHardwareInfo() instead of private _state
      const hwInfo = LS.getHardwareInfo();
      t.printHTML(`<span style="color:var(--text-dim)">UPGRADES HARDWARE:</span>`);
      const ramStr  = hwInfo.ram.nextCost
        ? `$${hwInfo.ram.nextCost.toLocaleString('es-AR')} CR → upgrade-ram confirm`
        : '<span style="color:var(--text-dim)">MAX</span>';
      const storStr = hwInfo.storage.nextCost
        ? `$${hwInfo.storage.nextCost.toLocaleString('es-AR')} CR → upgrade-storage confirm`
        : '<span style="color:var(--text-dim)">MAX</span>';
      t.printHTML(`  <span style="color:var(--text-dim)">RAM      +2 GB    — </span>${ramStr}`);
      t.printHTML(`  <span style="color:var(--text-dim)">Storage  +20 GB   — </span>${storStr}`);
      t.printBlank();
      t.printHTML(`<span style="color:var(--text-dim)">install [id]  ·  unload [id]  ·  upgrade [id] [speed|stealth|power]  ·  repair [id]</span>`);

    }, 'Muestra recursos del sistema: RAM, storage y anonimato.');

    // ── install ────────────────────────────────────────────────
    terminal.registerCommand('install', async (args, t) => {
      const LS = window.LocalSystem;
      if (!LS) { t.printLine('LocalSystem no disponible.', 'error'); return; }

      const toolId = args[0];
      if (!toolId) {
        // Listar herramientas disponibles para instalar
        const catalog   = LS.getCatalog();
        const available = LS.getLocalTools().filter(t => t.status === 'binary' || t.status === 'unloaded');

        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">⚙ HERRAMIENTAS DISPONIBLES PARA INSTALAR</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(44)}</span>`);

        if (available.length === 0) {
          t.printHTML(`  <span style="color:var(--text-dim)">No tenés herramientas pendientes.</span>`);
          t.printHTML(`  <span style="color:var(--text-dim)">Comprá herramientas en DarkMarket → Tools.</span>`);
        } else {
          available.forEach(tool => {
            const def = catalog[tool.id];
            const depsOk = def.deps.every(d => LS.isActive(d));
            const depsStr = def.deps.length > 0
              ? `Deps: ${def.deps.map(d => {
                  const active = LS.isActive(d);
                  return `<span style="color:${active ? 'var(--accent)' : 'var(--danger)'}">${catalog[d]?.name ?? d}</span>`;
                }).join(', ')}`
              : '';
            t.printHTML(
              `  ${_esc(tool.icon)} <span style="color:${depsOk ? 'var(--text-bright)' : 'var(--text-dim)'}">` +
              `${_esc(tool.name)}</span>` +
              `  <span style="color:var(--text-dim)">${def.ram} GB RAM</span>` +
              (depsStr ? `  ${depsStr}` : '') +
              `  <span style="color:var(--text-dim)">→ install ${_esc(tool.id)}</span>`
            );
          });
        }
        return;
      }

      const def = LS.getCatalog()[toolId];
      if (!def) { t.printLine(`Herramienta desconocida: ${toolId}`, 'error'); return; }

      t.lock();
      t.printBlank();
      t.printHTML(`<span style="color:var(--cyan)">⚙ INSTALANDO — ${_esc(def.icon)} ${_esc(def.name)}</span>`);
      t.printHTML(`<span style="color:var(--text-dim)">  ${_esc(def.desc)}</span>`);

      // Animación de instalación
      const steps = [
        'Verificando dependencias...',
        'Cargando módulos en memoria...',
        'Compilando configuración...',
        'Enlazando librerías del sistema...',
        'Verificando integridad del binario...',
      ];
      for (const step of steps.slice(0, 2 + def.deps.length)) {
        await _wait(300 + Math.random() * 400);
        t.printHTML(`<span style="color:var(--text-dim)">  ${_esc(step)}</span>`);
      }

      const result = LS.installTool(toolId);
      t.unlock();
      t.printBlank();

      if (result.ok) {
        AudioSystem?.success?.();
        t.printHTML(`<span style="color:var(--accent)">✓ ${_esc(def.name)} instalada y activa</span>`);
        t.printHTML(`  <span style="color:var(--text-dim)">${_esc(result.message)}</span>`);
        const ram = LS.getRam();
        t.printHTML(`  <span style="color:var(--text-muted)">RAM: </span>${_resBar(ram.pct, ram.pct > 80 ? 'var(--warn)' : 'var(--accent)')} <span style="color:var(--text-dim)">${ram.used}/${ram.max} GB</span>`);
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-dim)">  SPD ${_axisBar(1, def.maxAxes.speed, 'var(--cyan)')}</span>  <span style="color:var(--text-dim)">SIL ${_axisBar(1, def.maxAxes.stealth, 'var(--accent)')}</span>  <span style="color:var(--text-dim)">PWR ${_axisBar(1, def.maxAxes.power, 'var(--warn)')}</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">Mejorá los ejes con: upgrade ${_esc(toolId)} [speed|stealth|power]</span>`);
        UI?.notify?.(`✓ ${def.name} activa — ${ram.used}/${ram.max} GB RAM`, 'success', 5000);
      } else {
        AudioSystem?.error?.();
        t.printHTML(`<span style="color:var(--danger)">✗ ${_esc(result.message)}</span>`);
        if (result.missingDep) {
          const depDef = LS.getCatalog()[result.missingDep];
          t.printHTML(`<span style="color:var(--text-dim)">  → install ${_esc(result.missingDep)}  primero</span>`);
          if (!LS.hasBinary(result.missingDep)) {
            t.printHTML(`<span style="color:var(--text-dim)">  → ${_esc(depDef?.name ?? result.missingDep)} no está en tu sistema. Comprala en DarkMarket → Tools</span>`);
          }
        }
        if (result.ramNeeded) {
          const _hwi = LS.getHardwareInfo?.();
          const _ramCost = _hwi?.ram?.nextCost ?? 1000;
          t.printHTML(`<span style="color:var(--text-dim)">  → upgrade-ram para ampliar memoria ($${_ramCost.toLocaleString('es-AR')} CR)</span>`);
        }
      }

    }, 'Instala una herramienta descargada, cargándola en RAM.', 'install [tool]');

    // ── unload ─────────────────────────────────────────────────
    terminal.registerCommand('unload', (args, t) => {
      const LS = window.LocalSystem;
      if (!LS) { t.printLine('LocalSystem no disponible.', 'error'); return; }

      const toolId = args[0];
      if (!toolId) {
        const active = LS.getActiveTools();
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-muted)">Uso: unload [tool] — descarga una herramienta de la RAM</span>`);
        if (active.length > 0) {
          t.printHTML(`<span style="color:var(--text-dim)">Activas: ${active.map(a => _esc(a.id)).join(', ')}</span>`);
        }
        return;
      }

      const result = LS.unloadTool(toolId);
      if (result.ok) {
        const def = LS.getCatalog()[toolId];
        t.printHTML(`<span style="color:var(--accent)">✓ ${_esc(def?.name ?? toolId)} descargada</span>`);
        const ram = LS.getRam();
        t.printHTML(`  <span style="color:var(--text-dim)">RAM libre: ${(ram.max - ram.used).toFixed(1)} GB. Reinstalar: install ${_esc(toolId)}</span>`);
      } else {
        AudioSystem?.error?.();
        t.printLine(result.message, 'error');
      }
    }, 'Descarga una herramienta de la RAM (libera memoria).', 'unload [tool]');

    // ── upgrade [tool] [axis] ──────────────────────────────────
    terminal.registerCommand('upgrade', (args, t) => {
      const LS = window.LocalSystem;
      if (!LS) { t.printLine('LocalSystem no disponible.', 'error'); return; }

      const toolId = args[0];
      const axis   = args[1];

      // Sin args: mostrar todas las herramientas mejorables
      if (!toolId) {
        const active = LS.getActiveTools();
        t.printBlank();
        t.printHTML(`<span style="color:var(--cyan);font-family:var(--font-hud);">⬆ MEJORAS DE HERRAMIENTAS</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">${'─'.repeat(44)}</span>`);
        t.printHTML(`<span style="color:var(--text-dim)">Uso: upgrade [tool] [speed|stealth|power]</span>`);

        if (active.length === 0) {
          t.printHTML(`  <span style="color:var(--text-dim)">No hay herramientas activas. Instalá primero.</span>`);
          return;
        }

        active.forEach(tool => {
          const def = LS.getCatalog()[tool.id];
          if (!def) return;
          t.printBlank();
          t.printHTML(`  ${_esc(tool.icon)} <span style="color:var(--text-bright)">${_esc(def.name)}</span>`);
          ['speed', 'stealth', 'power'].forEach(ax => {
            const cur   = tool.axes[ax];
            const max   = def.maxAxes[ax];
            const cost  = cur < max ? def.upgradeCosts[ax][cur - 1] : null;
            const axCol = ax === 'speed' ? 'var(--cyan)' : ax === 'stealth' ? 'var(--accent)' : 'var(--warn)';
            const label = ax === 'speed' ? 'SPD' : ax === 'stealth' ? 'SIL' : 'PWR';
            t.printHTML(
              `     <span style="color:${axCol}">${label}</span> ${_axisBar(cur, max, axCol)}` +
              (cost
                ? `  <span style="color:var(--warn)">$${cost.toLocaleString('es-AR')} CR</span>  <span style="color:var(--text-dim)">→ upgrade ${_esc(tool.id)} ${ax}</span>`
                : `  <span style="color:var(--text-dim)">MAX</span>`)
            );
          });
        });
        return;
      }

      // upgrade [tool] sin axis: mostrar ejes disponibles
      if (!axis) {
        const def  = LS.getCatalog()[toolId];
        const tool = LS.getToolState(toolId);
        if (!def || !tool) { t.printLine(`Herramienta no encontrada: ${toolId}`, 'error'); return; }
        t.printBlank();
        t.printHTML(`  ${_esc(def.icon)} <span style="color:var(--text-bright)">${_esc(def.name)}</span> — ejes mejorables:`);
        ['speed', 'stealth', 'power'].forEach(ax => {
          const cur   = tool.axes[ax];
          const max   = def.maxAxes[ax];
          const cost  = cur < max ? def.upgradeCosts[ax][cur - 1] : null;
          const axCol = ax === 'speed' ? 'var(--cyan)' : ax === 'stealth' ? 'var(--accent)' : 'var(--warn)';
          t.printHTML(
            `  <span style="color:${axCol}">${ax.padEnd(8)}</span>` +
            ` ${_axisBar(cur, max, axCol)}` +
            (cost
              ? `  <span style="color:var(--warn)">$${cost.toLocaleString('es-AR')} CR</span>  <span style="color:var(--text-dim)">${_esc(def.upgradeEffects[ax])}</span>`
              : `  <span style="color:var(--text-dim)">MAX</span>`)
          );
        });
        return;
      }

      const result = LS.upgradeTool(toolId, axis);
      t.printBlank();
      if (result.ok) {
        AudioSystem?.success?.();
        const def  = LS.getCatalog()[toolId];
        const axCol = axis === 'speed' ? 'var(--cyan)' : axis === 'stealth' ? 'var(--accent)' : 'var(--warn)';
        t.printHTML(`<span style="color:var(--accent)">⬆ UPGRADE APLICADO</span>`);
        t.printHTML(`  ${_esc(def?.icon)} <span style="color:var(--text-bright)">${_esc(def?.name)}</span>`);
        t.printHTML(`  <span style="color:${axCol}">${_esc(axis.toUpperCase())} → Lv.${result.newLevel}</span>  <span style="color:var(--warn)">-$${result.cost.toLocaleString('es-AR')} CR</span>`);
        t.printHTML(`  <span style="color:var(--text-dim)">${_esc(result.effect)}</span>`);
        UI?.notify?.(`⬆ ${def?.name} [${axis}] Lv.${result.newLevel}`, 'success', 5000);
        UI?.updateHUD?.();
      } else {
        AudioSystem?.error?.();
        t.printLine(result.message, 'error');
      }
    }, 'Mejora un eje de una herramienta (speed/stealth/power).', 'upgrade [tool] [axis]');

    // ── repair ─────────────────────────────────────────────────
    terminal.registerCommand('repair', (args, t) => {
      const LS = window.LocalSystem;
      if (!LS) { t.printLine('LocalSystem no disponible.', 'error'); return; }

      const toolId = args[0];
      if (!toolId) {
        const degraded = LS.getLocalTools().filter(t => (t.burn ?? 0) >= 40);
        t.printBlank();
        t.printHTML(`<span style="color:var(--text-muted)">Uso: repair [tool] — repara una herramienta con desgaste</span>`);
        if (degraded.length > 0) {
          t.printHTML(`<span style="color:var(--warn)">Herramientas con desgaste:</span>`);
          degraded.forEach(tool => {
            const def  = LS.getCatalog()[tool.id];
            const cost = Math.floor((def?.price ?? 500) * 0.3 + tool.burn * 5);
            t.printHTML(`  ${_esc(tool.icon)} <span style="color:var(--text-muted)">${_esc(def?.name)}</span>  <span style="color:${_burnColor(tool.burn)}">${Math.round(tool.burn)}% desgaste</span>  <span style="color:var(--warn)">$${cost.toLocaleString('es-AR')} CR</span>`);
          });
        } else {
          t.printHTML(`  <span style="color:var(--accent)">✓ Todas tus herramientas están en buen estado.</span>`);
        }
        return;
      }

      const result = LS.repairTool(toolId);
      if (result.ok) {
        AudioSystem?.success?.();
        const def = LS.getCatalog()[toolId];
        t.printHTML(`<span style="color:var(--accent)">✓ ${_esc(def?.name ?? toolId)} reparada — desgaste 0%</span>`);
        t.printHTML(`  <span style="color:var(--warn)">-$${result.cost.toLocaleString('es-AR')} CR</span>`);
        UI?.updateHUD?.();
      } else {
        AudioSystem?.error?.();
        t.printLine(result.message, 'error');
      }
    }, 'Repara una herramienta con desgaste acumulado.', 'repair [tool]');

    // ── upgrade-ram ────────────────────────────────────────────
    terminal.registerCommand('upgrade-ram', (args, t) => {
      const LS = window.LocalSystem;
      if (!LS) { t.printLine('LocalSystem no disponible.', 'error'); return; }
      // Show cost preview if no confirm
      const hw = LS.getHardwareInfo();
      if (!hw.ram.nextCost) {
        t.printLine('RAM ya está al máximo (' + hw.ram.max + ' GB).', 'muted');
        return;
      }
      if (!args[0] || args[0] !== 'confirm') {
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">💾 UPGRADE RAM</span>`);
        t.printHTML(`  <span style="color:var(--text-muted)">Actual: </span><span style="color:var(--accent)">${hw.ram.max} GB</span>  <span style="color:var(--text-muted)">→ </span><span style="color:var(--cyan)">${hw.ram.max + 2} GB</span>`);
        t.printHTML(`  <span style="color:var(--text-muted)">Costo:  </span><span style="color:var(--warn)">$${hw.ram.nextCost.toLocaleString('es-AR')} CR</span>`);
        t.printHTML(`  <span style="color:var(--text-dim)">→ upgrade-ram confirm  para comprar</span>`);
        return;
      }
      const result = LS.upgradeRam();
      if (result.ok) {
        AudioSystem?.success?.();
        t.printHTML(`<span style="color:var(--accent)">✓ RAM ampliada → ${result.newMax} GB</span>`);
        t.printHTML(`  <span style="color:var(--warn)">-$${result.cost.toLocaleString('es-AR')} CR</span>`);
        const hw2 = LS.getHardwareInfo();
        if (hw2.ram.nextCost) t.printHTML(`  <span style="color:var(--text-dim)">Siguiente upgrade: $${hw2.ram.nextCost.toLocaleString('es-AR')} CR</span>`);
        UI?.updateHUD?.();
        UI?.notify?.('✓ RAM → ' + result.newMax + ' GB', 'success', 4000);
      } else {
        AudioSystem?.error?.();
        t.printLine(result.message, 'error');
      }
    }, 'Amplía la RAM del sistema para cargar más herramientas.', 'upgrade-ram [confirm]');

    // ── upgrade-storage ────────────────────────────────────────
    terminal.registerCommand('upgrade-storage', (args, t) => {
      const LS = window.LocalSystem;
      if (!LS) { t.printLine('LocalSystem no disponible.', 'error'); return; }
      const hw = LS.getHardwareInfo();
      if (!hw.storage.nextCost) {
        t.printLine('Storage ya está al máximo (' + hw.storage.max + ' GB).', 'muted');
        return;
      }
      if (!args[0] || args[0] !== 'confirm') {
        t.printBlank();
        t.printHTML(`<span style="color:var(--warn)">💽 UPGRADE STORAGE</span>`);
        t.printHTML(`  <span style="color:var(--text-muted)">Actual: </span><span style="color:var(--accent)">${hw.storage.max} GB</span>  <span style="color:var(--text-muted)">→ </span><span style="color:var(--cyan)">${hw.storage.max + 20} GB</span>`);
        t.printHTML(`  <span style="color:var(--text-muted)">Costo:  </span><span style="color:var(--warn)">$${hw.storage.nextCost.toLocaleString('es-AR')} CR</span>`);
        t.printHTML(`  <span style="color:var(--text-dim)">→ upgrade-storage confirm  para comprar</span>`);
        return;
      }
      const result = LS.upgradeStorage();
      if (result.ok) {
        AudioSystem?.success?.();
        t.printHTML(`<span style="color:var(--accent)">✓ Almacenamiento ampliado → ${result.newMax} GB</span>`);
        t.printHTML(`  <span style="color:var(--warn)">-$${result.cost.toLocaleString('es-AR')} CR</span>`);
        UI?.updateHUD?.();
        UI?.notify?.('✓ Storage → ' + result.newMax + ' GB', 'success', 4000);
      } else {
        AudioSystem?.error?.();
        t.printLine(result.message, 'error');
      }
    }, 'Amplía el almacenamiento para guardar más datos robados.', 'upgrade-storage [confirm]');
  }

  // ─── Parchear el flujo de compra de aleximOS ──────────────────
  let _buyPatched = false;  // EXTRA FIX: prevent double-patch
  function _patchBuyFlow() {
    if (typeof AleXimOS === 'undefined') return;
    if (_buyPatched) return;
    const origBuy = AleXimOS._buy?.bind(AleXimOS);
    if (!origBuy) return;
    _buyPatched = true;

    AleXimOS._buy = function (softwareId, price) {
      const LS  = window.LocalSystem;
      const def = LS?.getCatalog?.()?.[softwareId];

      // Si no es una herramienta gestionada por LocalSystem, flujo original
      if (!LS || !def) {
        origBuy(softwareId, price);
        return;
      }

      // Verificar fondos
      if (!GameState.spendMoney(price)) {
        AudioSystem?.error?.();
        UI?.notify?.(`Fondos insuficientes — se necesitan $${price} CR`, 'error');
        return;
      }

      // Entregar como binario (no instalar automáticamente)
      LS.receiveBinary(softwareId);
      AudioSystem?.success?.();

      if (window.LedgerSystem) LedgerSystem.onBuy(price, `${def.name} (binario)`);

      // Notificación en terminal con instrucción de install
      const term = window.GameLoop?.getTerminal?.();
      if (term) {
        term.printBlank();
        term.printHTML(`<span style="color:var(--accent)">📦 Binario recibido: ${_esc(def.icon)} ${_esc(def.name)}</span>`);
        term.printHTML(`  <span style="color:var(--text-dim)">Guardado en /home/ghost/tools/${_esc(softwareId)}.bin</span>`);
        if (def.deps.length > 0) {
          const allDepsActive = def.deps.every(d => LS.isActive(d));
          if (!allDepsActive) {
            const missing = def.deps.filter(d => !LS.isActive(d)).map(d => LS.getCatalog()[d]?.name ?? d);
            term.printHTML(`  <span style="color:var(--warn)">⚠ Deps requeridas: ${missing.map(m => _esc(m)).join(', ')}</span>`);
          }
        }
        term.printHTML(`  <span style="color:var(--text-muted)">→ </span><span style="color:var(--cyan)">install ${_esc(softwareId)}</span><span style="color:var(--text-dim)"> para activarla (necesita ${def.ram} GB RAM)</span>`);
        term.printBlank();
      }

      UI?.notify?.(`📦 ${def.name} descargada → install ${softwareId}`, 'info', 7000);

      // Refresh DarkMarket si está abierto
      const dm = AleXimOS.getOpenWindow?.('darkmarket');
      if (dm) AleXimOS.openApp?.('darkmarket');
    };

    console.log('[LocalSystem_CMD] _buy parchado para entrega de binarios.');
  }

  // ─── Hooks de eventos del sistema ─────────────────────────────
  let _hooksApplied = false;  // BUG #6 FIX: guard against double-wrap
  function _hookLocalSystemEvents() {
    const LS = window.LocalSystem;
    if (!LS) return;
    if (_hooksApplied) return;
    _hooksApplied = true;

    // Cada operación de red degrada el anonimato levemente
    window.addEventListener('alexim-breach', () => {
      LS.degradeAnonymity(3, 'breach');
    });

    window.addEventListener('alexim-download', (e) => {
      const sensitivity = e.detail?.loot?.sensitivity ?? 3;
      LS.degradeAnonymity(sensitivity * 0.5, 'download');
    });

    // El wipelog recupera algo de anonimato
    if (window.HackingEngine) {
      HackingEngine.on('log_wiped', ({ heatReduced }) => {
        LS.recoverAnonymity(heatReduced * 0.3);
      });
    }

    // Usar una herramienta en bypass registra desgaste
    if (window.SecurityLayerSystem) {
      // Hook post-bypass para registrar uso
      const origBypass = SecurityLayerSystem.bypass?.bind(SecurityLayerSystem);
      if (origBypass) {
        SecurityLayerSystem.bypass = async function (ip, toolId, toolLevel) {
          const result = await origBypass(ip, toolId, toolLevel);
          if (result?.ok) LS.recordUsage(toolId, result.success);
          return result;
        };
      }
    }

    // Cuando la identidad queda expuesta, los agentes de la UEC se activan más
    LS.on('identity_exposed', () => {
      if (window.AdversarialSystem) {
        const agents = AdversarialSystem.getAgents().filter(a => a.type === 'police');
        agents.forEach(a => {
          a.heatThreshold = Math.max(a.heatThreshold - 20, 20);
        });
      }
      if (window.ReputationSystem) ReputationSystem.addHeat(15, 'identity_exposed');
    });

    // Integrar con bypassLayer de HackingEngine para usar multiplicadores
    if (window.HackingEngine) {
      const origBypassLayer = HackingEngine.bypassLayer?.bind(HackingEngine);
      if (origBypassLayer) {
        HackingEngine.bypassLayer = async function(ip, toolId) {
          // Aplicar bonus de LocalSystem antes del bypass
          const LS2 = window.LocalSystem;
          if (LS2) {
            // Los multiplicadores se aplican dentro de SecurityLayerSystem via el bypass parchado
          }
          return origBypassLayer(ip, toolId);
        };
      }
    }

    // Actualizar el HUD del sistema local
    LS.on('tool_installed',  () => _updateLocalHUD());
    LS.on('tool_unloaded',   () => _updateLocalHUD());
    LS.on('hardware_upgraded', () => _updateLocalHUD());
    LS.on('anonymity',       () => _updateAnonHUD());

    console.log('[LocalSystem_CMD] Hooks de eventos conectados.');
  }

  // ─── Mini-HUD de anonimato en top bar ─────────────────────────
  function _updateLocalHUD() {
    const LS  = window.LocalSystem;
    if (!LS) return;
    const ram = LS.getRam();
    // Actualizar el elemento de RAM si existe en el HUD (se añade en el patch de aleximOS)
    const el = document.getElementById('hud-ram-fill');
    if (el) {
      const color = ram.pct > 85 ? 'var(--danger)' : ram.pct > 60 ? 'var(--warn)' : 'var(--cyan)';
      el.style.width  = ram.pct + '%';
      el.style.background = `var(${color.replace('var(', '').replace(')', '')})`;
    }
    const label = document.getElementById('hud-ram-pct');
    if (label) label.textContent = `RAM ${ram.used}/${ram.max}G`;
  }

  function _updateAnonHUD() {
    const LS   = window.LocalSystem;
    if (!LS) return;
    const anon  = LS.getAnonymity();
    const el    = document.getElementById('hud-anon-fill');
    const label = document.getElementById('hud-anon-pct');
    if (el) {
      const color = anon < 20 ? 'danger' : anon < 50 ? 'warn' : 'accent';
      el.style.width      = anon + '%';
      el.className        = `heat-fill ${anon < 20 ? 'critico' : anon < 50 ? 'alto' : 'bajo'}`;
    }
    if (label) {
      const tag = anon >= 80 ? '● ANON' : anon >= 50 ? '◐ EXPUESTO' : anon >= 20 ? '▲ RIESGO' : '🔴 QUEMADO';
      label.textContent = `${tag} ${anon}%`;
      label.style.color = anon < 20 ? 'var(--danger)' : anon < 50 ? 'var(--warn)' : 'var(--accent)';
    }
  }

  // Exponer actualizador para que aleximOS lo llame
  window._localSystemUpdateHUD = _updateLocalHUD;
  window._localSystemUpdateAnonHUD = _updateAnonHUD;

})();
