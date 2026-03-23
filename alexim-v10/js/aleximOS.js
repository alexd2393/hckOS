/**
 * aleximOS.js — AleXim OS Core
 * AleXim OS — Hacking Narrative Game
 *
 * Responsibilities:
 *  - App registry (define and register applications)
 *  - Window lifecycle: create, focus, minimize, restore, close, maximize
 *  - Draggable windows
 *  - Taskbar integration
 *  - App content renderers (Files, Messages, Network, Tools, NewsFeed)
 *
 * Usage:
 *   AleXimOS.openApp('terminal')
 *   AleXimOS.registerApp('myApp', { title, icon, width, height, onOpen })
 */

const AleXimOS = (() => {

  // ─── State ────────────────────────────────────────────────────
  let _windows  = {};   // winId → WindowData
  let _zBase    = 100;  // z-index counter
  let _activeId = null; // currently focused window id

  // ─── App Definitions ──────────────────────────────────────────
  const _apps = {

    terminal: {
      title:  'Terminal',
      icon:   '⌨',
      width:  720, height: 460,
      singleton: true,
      onOpen(contentEl, win) {
        contentEl.classList.add('terminal-app-content');
        const t = new Terminal(contentEl);
        win.terminal = t;
        // FIX #7: siempre adjuntar GameLoop a la terminal que se abre
        if (typeof GameLoop !== 'undefined') {
          GameLoop.attach(t);
        }
      },
    },

    files: {
      title:  'Files',
      icon:   '📁',
      width:  620, height: 440,
      onOpen(contentEl) {
        _renderFiles(contentEl, GameState.getCurrentPath());
      },
    },

    messages: {
      title:  'Messages',
      icon:   '💬',
      width:  560, height: 480,
      onOpen(contentEl) {
        _renderMessages(contentEl);
      },
    },

    network: {
      title:  'Mapa de Red',
      icon:   '🌐',
      width:  660, height: 460,
      onOpen(contentEl) {
        _renderNetwork(contentEl);
        // Re-render on both GameState and NetworkSystem changes
        GameState.on('network', () => {
          const win = AleXimOS.getOpenWindow('network');
          if (win) _renderNetwork(win.contentEl);
        });
        if (window.NetworkSystem) {
          NetworkSystem.on('breach', () => {
            const win = AleXimOS.getOpenWindow('network');
            if (win) _renderNetwork(win.contentEl);
          });
          NetworkSystem.on('scan', () => {
            const win = AleXimOS.getOpenWindow('network');
            if (win) _renderNetwork(win.contentEl);
          });
          NetworkSystem.on('connect', () => {
            const win = AleXimOS.getOpenWindow('network');
            if (win) _renderNetwork(win.contentEl);
          });
        }
      },
    },

    // ── Fix #4: ⚙ = Ajustes (ya no Tools) ─────────────────────
    settings: {
      title:  'Ajustes del Sistema',
      icon:   '⚙',
      width:  500, height: 480,
      singleton: true,
      onOpen(contentEl) { _renderSettings(contentEl); },
    },

    // ── Fix #1: Noticias = CrónicaDigital (diario digital) ──────
    cronica: {
      title:  'CrónicaDigital — Noticias',
      icon:   '📰',
      width:  700, height: 580,
      singleton: true,
      onOpen(contentEl) {
        _renderCronica(contentEl);
        window.addEventListener('news-update', () => {
          const win = AleXimOS.getOpenWindow('cronica');
          if (win) _renderCronica(win.contentEl);
        });
      },
    },

    // ── Fix #3: DarkMarket = mercado negro + tools + underground reddit ─
    darkmarket: {
      title:  'DarkMarket Underground',
      icon:   '💰',
      width:  720, height: 560,
      singleton: true,
      onOpen(contentEl) {
        _renderDarkMarket(contentEl);
        window.addEventListener('darkmarket-message', () => {
          const win = AleXimOS.getOpenWindow('darkmarket');
          if (win) _renderDarkMarket(win.contentEl);
        });
      },
    },

    // ── Fix #6: Nuevas apps ─────────────────────────────────────
    // ── Fix #6 — MP (estilo MercadoPago) ──────────────────────────
    mp: {
      title:  'MP',
      icon:   '💳',
      width:  400, height: 560,
      singleton: true,
      onOpen(contentEl) {
        _renderMP(contentEl);
        window.addEventListener('ledger-update', () => {
          const w = AleXimOS.getOpenWindow('mp');
          if (w) _renderMP(w.contentEl);
        });
        GameState.on('money', () => {
          const w = AleXimOS.getOpenWindow('mp');
          if (w) _renderMP(w.contentEl);
        });
      },
    },

    // ── Fix #5 — Mi PC (monitor + inventario + calor + VPN) ───────
    mipc: {
      title:  'Mi PC',
      icon:   '🖥️',
      width:  560, height: 500,
      singleton: true,
      onOpen(contentEl) {
        _renderMiPC(contentEl);
        const win = AleXimOS.getOpenWindow('mipc');
        if (win) win._monInterval = setInterval(() => _renderMiPC(contentEl), 2000);
      },
    },

    logviewer: {
      title:  'Visor de Logs del Sistema',
      icon:   '🗒️',
      width:  640, height: 480,
      onOpen(contentEl) { _renderLogViewer(contentEl); },
    },

    // ── NodoSocial — red social argentina simulada ─────────────
    nodosocial: {
      title:  'NodoSocial',
      icon:   '📱',
      width:  520, height: 600,
      singleton: true,
      onOpen(contentEl) {
        _renderNodoSocial(contentEl);
        // FIX E: if opened before data arrived, poll until posts exist
        const posts = window.SocialContentGenerator?.getFeed?.(1) || [];
        if (posts.length === 0) {
          let attempts = 0;
          const poll = setInterval(() => {
            attempts++;
            const p = window.SocialContentGenerator?.getFeed?.(1) || [];
            if (p.length > 0 || attempts > 20) {
              clearInterval(poll);
              const w = AleXimOS.getOpenWindow('nodosocial');
              if (w && p.length > 0) _renderNodoSocial(w.contentEl);
            }
          }, 400);
        }
      },
    },

    // ── PeopleSearch — buscador de ciudadanos ──────────────────
    peoplesearch: {
      title:  'PeopleSearch',
      icon:   '🔍',
      width:  560, height: 520,
      singleton: true,
      onOpen(contentEl) { _renderPeopleSearch(contentEl); },
    },

    // ── IdentityProfiler — perfil completo de una persona ──────
    identityprofiler: {
      title:  'Identity Profiler',
      icon:   '🪪',
      width:  540, height: 580,
      singleton: true,
      onOpen(contentEl) { _renderIdentityProfiler(contentEl, null); },
    },

    // ── DarkForum — foro underground del DarkMarket ─────────────
    darkforum: {
      title:  'DarkForum Underground',
      icon:   '☠',
      width:  680, height: 560,
      singleton: true,
      onOpen(contentEl) {
        _renderDarkForum(contentEl);
        // FIX F: if opened before data arrived, poll until posts exist
        const posts = window.DarkForumSystem?.getPosts?.(1) || [];
        if (posts.length === 0) {
          let attempts = 0;
          const poll = setInterval(() => {
            attempts++;
            const p = window.DarkForumSystem?.getPosts?.(1) || [];
            if (p.length > 0 || attempts > 20) {
              clearInterval(poll);
              const w = AleXimOS.getOpenWindow('darkforum');
              if (w && p.length > 0) _renderDarkForum(w.contentEl);
            }
          }, 400);
        }
      },
    },

    // ── Notas — bloc de notas persistente ──────────────────────
    notes: {
      title:  'Notas',
      icon:   '📝',
      width:  500, height: 480,
      singleton: true,
      onOpen(contentEl) { _renderNotes(contentEl); },
    },

    // ── v8 — Sistema Adversarial ────────────────────────────────
    threatmonitor: {
      title:  'Threat Monitor',
      icon:   '☣',
      width:  660, height: 540,
      singleton: true,
      onOpen(contentEl) {
        _renderThreatMonitor(contentEl);
        window.addEventListener('adversarial-log', () => {
          const w = AleXimOS.getOpenWindow('threatmonitor');
          if (w) _renderThreatMonitor(w.contentEl);
        });
      },
    },

  };

  // ═══════════════════════════════════════════════════════════════
  // WINDOW MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  function _createWindow(appId) {
    const app = _apps[appId];
    if (!app) { console.warn(`[AleXimOS] Unknown app: ${appId}`); return null; }

    const winId    = `win-${appId}-${Date.now()}`;
    const cascade  = Object.keys(_windows).length;
    const left     = 110 + cascade * 22;
    const top      = 50  + cascade * 18;

    const el = document.createElement('div');
    el.className = 'os-window';
    el.id        = winId;
    el.style.cssText = [
      `width:${app.width  || 600}px`,
      `height:${app.height || 400}px`,
      `left:${left}px`,
      `top:${top}px`,
      `z-index:${++_zBase}`,
    ].join(';');

    el.innerHTML = `
      <div class="win-titlebar" id="tb-${winId}">
        <div class="win-controls">
          <button class="win-btn win-close"    title="Close"    onclick="AleXimOS.closeWindow('${winId}')"></button>
          <button class="win-btn win-minimize" title="Minimize" onclick="AleXimOS.minimizeWindow('${winId}')"></button>
          <button class="win-btn win-maximize" title="Maximize" onclick="AleXimOS.toggleMaximize('${winId}')"></button>
        </div>
        <div class="win-title">${app.icon} ${app.title}</div>
        <div class="win-title-spacer"></div>
      </div>
      <div class="win-content" id="wc-${winId}"></div>
    `;

    document.getElementById('windows-container').appendChild(el);

    const contentEl = document.getElementById(`wc-${winId}`);

    /** @type {WindowData} */
    const winData = {
      id:        winId,
      appId,
      el,
      contentEl,
      minimized:  false,
      maximized:  false,
      terminal:   null,     // set by terminal app
      _savedRect: null,     // for maximize/restore
    };

    _windows[winId] = winData;

    // Initialize app content
    if (app.onOpen) app.onOpen(contentEl, winData);

    // Wire up dragging
    _makeDraggable(el, el.querySelector(`#tb-${winId}`));

    // Focus on any click inside
    el.addEventListener('mousedown', () => _focus(winId), true);

    // Add taskbar button
    _taskbarAdd(winId, app);

    AudioSystem.windowOpen();
    _focus(winId);

    return winData;
  }

  function _focus(winId) {
    if (!_windows[winId]) return;
    _activeId = winId;
    Object.values(_windows).forEach(w => {
      w.el.classList.toggle('focused', w.id === winId);
    });
    _windows[winId].el.style.zIndex = ++_zBase;
    // Highlight taskbar button
    document.querySelectorAll('.taskbar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`task-${winId}`)?.classList.add('active');
  }

  function _makeDraggable(winEl, handle) {
    let ox = 0, oy = 0, sl = 0, st = 0;

    handle.addEventListener('mousedown', e => {
      // Don't drag when clicking control buttons
      if (e.target.classList.contains('win-btn')) return;
      const win = Object.values(_windows).find(w => w.el === winEl);
      if (win?.maximized) return;

      ox = e.clientX; oy = e.clientY;
      sl = parseInt(winEl.style.left)  || 0;
      st = parseInt(winEl.style.top)   || 0;

      const onMove = e => {
        winEl.style.left = (sl + e.clientX - ox) + 'px';
        winEl.style.top  = Math.max(40, st + e.clientY - oy) + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // ─── Taskbar ──────────────────────────────────────────────────

  function _taskbarAdd(winId, app) {
    const bar = document.getElementById('taskbar-apps');
    const btn = document.createElement('button');
    btn.className   = 'taskbar-btn';
    btn.id          = `task-${winId}`;
    btn.textContent = `${app.icon} ${app.title}`;
    btn.title       = app.title;
    btn.addEventListener('click', () => {
      const win = _windows[winId];
      if (!win) return;
      if (win.minimized) {
        AleXimOS.restoreWindow(winId);
      } else if (_activeId === winId) {
        AleXimOS.minimizeWindow(winId);
      } else {
        _focus(winId);
      }
    });
    bar.appendChild(btn);
  }

  // ═══════════════════════════════════════════════════════════════
  // APP CONTENT RENDERERS
  // ═══════════════════════════════════════════════════════════════

  function _renderFiles(el, path) {
    const dir = GameState.getDir(path) ?? {};
    el.className = 'app-files';

    // Get subdirs from filesystem
    const fs      = GameState.getFilesystem();
    const subdirs = Object.keys(fs)
      .filter(p => p !== path && p.startsWith(path + '/') && !p.slice(path.length + 1).includes('/'));

    const allEntries = [
      ...subdirs.map(p => ({ name: p.split('/').pop(), type: 'dir', path: p })),
      ...Object.entries(dir).map(([name, entry]) => ({ name, type: entry.type, content: entry.content })),
    ];

    el.innerHTML = `
      <div class="files-toolbar">
        <button class="files-btn" onclick="AleXimOS._filesNav('/home/ghost', this)">⌂</button>
        <button class="files-btn" onclick="AleXimOS._filesNav('${_escAttr(_parentPath(path))}', this)">↑ Up</button>
        <span class="files-path">${_escHtml(path)}</span>
      </div>
      <div class="files-grid" id="files-grid">
        ${allEntries.length === 0
          ? '<div class="files-empty">Empty directory</div>'
          : allEntries.map(e => `
              <div class="file-item" data-type="${e.type}" data-name="${_escAttr(e.name)}" data-path="${_escAttr(e.path ?? '')}">
                <div class="file-icon">${e.type === 'dir' ? '📁' : '📄'}</div>
                <div class="file-name">${_escHtml(e.name)}</div>
              </div>
            `).join('')
        }
      </div>
    `;

    // Double-click to open dir
    el.querySelectorAll('.file-item[data-type="dir"]').forEach(item => {
      item.addEventListener('dblclick', () => {
        const p = item.dataset.path || (path + '/' + item.dataset.name);
        _renderFiles(el, p);
        GameState.setPath(p);
      });
    });
  }

  function _renderMessages(el) {
    el.className = 'app-messages';
    const DM   = window.DarkMarketSystem;

    // Merge all messages: DarkMarket + MissionEngine
    const dmMsgs = DM ? DM.getMessages() : [];
    // Patch: MissionEngine dispatches via darkmarket-message with missionId
    const allMsgs = [...dmMsgs].sort((a, b) => b.receivedAt - a.receivedAt);

    const unread  = allMsgs.filter(m => !m.read).length;
    const hasOffers = DM ? DM.getOffers('pending').length > 0 : false;

    // Contacts sidebar: each unique sender
    const senders = {};
    allMsgs.forEach(m => {
      if (!senders[m.from]) senders[m.from] = { name: m.from, msgs: [], type: m.type };
      senders[m.from].msgs.push(m);
    });
    // Ensure these built-in contacts always appear
    if (!senders['darkmarket']) senders['darkmarket'] = { name: 'DarkMarket', msgs: [], type: 'system' };
    if (!senders['NEXUS'])      senders['NEXUS']      = { name: 'NEXUS',      msgs: [], type: 'mission' };
    if (!senders['SHADOW'])     senders['SHADOW']     = { name: 'SHADOW',     msgs: [], type: 'mission' };

    const contactIcon = (name, type) => {
      if (type === 'offer')   return '💰';
      if (type === 'mission') return '🎯';
      if (type === 'system')  return '🔧';
      return name[0]?.toUpperCase() ?? '?';
    };

    // Determine active contact (first with messages, or first sender)
    const firstContact = Object.keys(senders)[0] ?? 'darkmarket';

    el.innerHTML = `
      <div class="messages-sidebar">
        <div class="messages-title">MENSAJES${unread > 0 ? ` <span style="color:var(--danger);font-size:10px;">(${unread} sin leer)</span>` : ''}</div>
        ${Object.entries(senders).map(([id, c]) => {
          const lastMsg = c.msgs[0];
          const hasUnread = c.msgs.some(m => !m.read);
          const icon = contactIcon(c.name, c.msgs[0]?.type ?? c.type);
          return `
            <div class="contact-item ${hasUnread ? 'contact-unread' : ''}" data-sender="${_escAttr(id)}" style="cursor:pointer;">
              <div class="contact-avatar" style="${hasUnread ? 'color:var(--warn);border-color:var(--warn);' : ''}">${icon}</div>
              <div class="contact-info">
                <div class="contact-name">${_escHtml(c.name)}</div>
                <div class="contact-status" style="color:${hasUnread ? 'var(--warn)' : 'var(--text-dim)'};">
                  ${lastMsg ? _escHtml(lastMsg.subject.slice(0, 28)) : 'Sin mensajes'}
                </div>
              </div>
              ${hasUnread ? `<div class="contact-badge">${c.msgs.filter(m=>!m.read).length}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
      <div class="messages-content" id="msg-content">
        ${_buildConversation(senders[firstContact]?.msgs ?? [], firstContact, el)}
      </div>
    `;

    // Bind contact switching
    el.querySelectorAll('[data-sender]').forEach(item => {
      item.addEventListener('click', () => {
        el.querySelectorAll('[data-sender]').forEach(x => x.classList.remove('active'));
        item.classList.add('active');
        const sender = item.dataset.sender;
        const msgs   = senders[sender]?.msgs ?? [];
        // Mark as read
        msgs.forEach(m => { m.read = true; DM?.markMessageRead?.(m.id); });
        el.querySelector('#msg-content').innerHTML = _buildConversation(msgs, sender, el);
        _bindOfferButtons(el);
        _bindMissionButtons(el);
        // Remove unread indicator
        item.classList.remove('contact-unread');
        const badge = item.querySelector('.contact-badge');
        if (badge) badge.remove();
        // Update global badge
        _updateMsgBadge();
      });
    });

    // Activate first contact
    const firstItem = el.querySelector('[data-sender]');
    if (firstItem) firstItem.classList.add('active');

    _bindOfferButtons(el);
    _bindMissionButtons(el);

    // Live refresh when new message arrives
    window.addEventListener('darkmarket-message', () => {
      const w = AleXimOS.getOpenWindow('messages');
      if (w) _renderMessages(w.contentEl);
    }, { once: true });
  }

  function _buildConversation(msgs, senderName, parentEl) {
    if (!msgs || msgs.length === 0) {
      const hints = {
        'darkmarket': 'Listá datos en DarkMarket para recibir ofertas de compradores.',
        'NEXUS':      'NEXUS te contactará cuando completes misiones de bajo nivel.',
        'SHADOW':     'SHADOW sólo aparece cuando sos lo suficientemente conocido.',
      };
      return `<div class="messages-empty">
        <div style="font-size:36px;margin-bottom:10px;">💬</div>
        <div style="color:var(--text-muted);font-size:13px;">${_escHtml(senderName)}</div>
        <div class="messages-hint">${hints[senderName] ?? 'Sin mensajes todavía.'}</div>
      </div>`;
    }

    const tagCol = { offer:'var(--warn)', mission:'var(--cyan)', system:'var(--accent)', info:'var(--text-muted)' };
    return `
      <div class="msg-header-bar">
        <span style="font-family:var(--font-hud);letter-spacing:1px;color:var(--text-bright);">${_escHtml(senderName)}</span>
        <span style="font-size:10px;color:var(--text-dim);">${msgs.length} mensaje(s)</span>
      </div>
      <div class="dm-messages">
        ${msgs.map(m => `
          <div class="dm-msg ${m.read ? '' : 'dm-unread'}" data-offer="${m.offerId ?? ''}" data-mission="${m.missionId ?? ''}">
            <div class="dm-msg-header">
              <span class="dm-from" style="color:${tagCol[m.type] ?? 'var(--accent)'};">
                ${m.type === 'mission' ? '🎯' : m.type === 'offer' ? '💰' : '💬'} ${_escHtml(m.from)}
              </span>
              <span style="color:var(--text-dim);font-size:10px;">${new Date(m.receivedAt).toLocaleString('es-AR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</span>
            </div>
            <div style="color:var(--text-bright);font-size:12px;font-weight:600;margin:4px 0;">${_escHtml(m.subject)}</div>
            <div style="color:var(--text-muted);font-size:11px;white-space:pre-wrap;line-height:1.6;">${_escHtml(m.body)}</div>
            ${m.type === 'offer' && m.offerId ? `
              <div class="dm-actions" style="margin-top:8px;display:flex;gap:8px;">
                <button class="dm-accept-btn shop-btn buy-btn" data-offer="${_escHtml(m.offerId)}" data-amount="${m.amount ?? 0}" style="padding:4px 16px;font-size:11px;">
                  ✓ Aceptar $${(m.amount ?? 0).toLocaleString('es-AR')}
                </button>
                <button class="dm-reject-btn shop-btn" data-offer="${_escHtml(m.offerId)}" style="padding:4px 16px;font-size:11px;border:1px solid var(--danger);color:var(--danger);">
                  ✗ Rechazar
                </button>
              </div>` : ''}
            ${m.type === 'mission' && m.missionId ? `
              <div class="dm-actions" style="margin-top:8px;display:flex;gap:8px;">
                <button class="dm-mission-accept shop-btn buy-btn" data-mission="${_escHtml(m.missionId)}" style="padding:4px 16px;font-size:11px;">
                  ✓ Aceptar trabajo
                </button>
                <button class="dm-mission-reject shop-btn" data-mission="${_escHtml(m.missionId)}" style="padding:4px 16px;font-size:11px;border:1px solid var(--text-dim);color:var(--text-muted);">
                  ✗ Rechazar
                </button>
              </div>` : ''}
          </div>
        `).join('')}
      </div>`;
  }

  function _bindMissionButtons(el) {
    el.querySelectorAll('.dm-mission-accept').forEach(btn => {
      btn.onclick = () => {
        if (!window.MissionEngine) return;
        const res = MissionEngine.accept(btn.dataset.mission);
        if (res.ok) {
          btn.textContent = '✓ Trabajo aceptado';
          btn.disabled = true;
          btn.style.opacity = '0.6';
          btn.nextElementSibling?.remove();
          if (typeof UI !== 'undefined') UI.notify(`🎯 Trabajo aceptado: ${res.mission.title}`, 'success', 5000);
        } else {
          if (typeof UI !== 'undefined') UI.notify(res.message ?? 'Error', 'error', 4000);
        }
      };
    });
    el.querySelectorAll('.dm-mission-reject').forEach(btn => {
      btn.onclick = () => {
        window.MissionEngine?.reject(btn.dataset.mission);
        btn.closest('.dm-actions')?.remove();
      };
    });
  }

  function _renderDMMessages(msgs) {
    if (!msgs || msgs.length === 0) {
      return `<div class="messages-empty">
        <div style="font-size:28px">📨</div>
        <div>Sin mensajes del DarkMarket.</div>
        <div class="messages-hint">Listá datos con "sell [archivo]" en la terminal para recibir ofertas.</div>
      </div>`;
    }
    const tagCol = { offer:'var(--warn)', system:'var(--cyan)', info:'var(--text-muted)' };
    return `<div class="dm-messages">` + msgs.map(m => `
      <div class="dm-msg ${m.read ? '' : 'dm-unread'}" data-offer="${m.offerId ?? ''}">
        <div class="dm-msg-header">
          <span class="dm-from" style="color:${tagCol[m.type] ?? 'var(--accent)'};">${_escHtml(m.from)}</span>
          <span class="dm-time" style="color:var(--text-dim);font-size:10px;">${new Date(m.receivedAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <div class="dm-subject" style="color:var(--text-bright);font-size:12px;margin:3px 0;">${_escHtml(m.subject)}</div>
        <div class="dm-body" style="color:var(--text-muted);font-size:11px;white-space:pre-wrap;line-height:1.5;">${_escHtml(m.body)}</div>
        ${m.type === 'offer' && m.offerId ? `
          <div class="dm-actions" style="margin-top:8px;display:flex;gap:8px;">
            <button class="dm-accept-btn" data-offer="${_escHtml(m.offerId)}" data-amount="${m.amount ?? 0}"
              style="padding:4px 14px;background:var(--accent-dim);border:none;border-radius:3px;color:#000;font-family:var(--font-mono);font-size:11px;cursor:pointer;">
              ✓ Aceptar $${(m.amount ?? 0).toLocaleString('es-AR')}
            </button>
            <button class="dm-reject-btn" data-offer="${_escHtml(m.offerId)}"
              style="padding:4px 14px;background:var(--bg-surface);border:1px solid var(--danger);border-radius:3px;color:var(--danger);font-family:var(--font-mono);font-size:11px;cursor:pointer;">
              ✗ Rechazar
            </button>
          </div>
        ` : ''}
      </div>
    `).join('') + `</div>`;
  }

  function _bindOfferButtons(el) {
    const DM = window.DarkMarketSystem;
    if (!DM) return;
    el.querySelectorAll('.dm-accept-btn').forEach(btn => {
      btn.onclick = () => {
        const res = DM.acceptOffer(btn.dataset.offer);
        if (res.ok) {
          btn.textContent = '✓ Vendido';
          btn.disabled    = true;
          btn.style.opacity = '0.5';
          btn.nextElementSibling?.remove();
        }
      };
    });
    el.querySelectorAll('.dm-reject-btn').forEach(btn => {
      btn.onclick = () => {
        DM.rejectOffer(btn.dataset.offer);
        btn.closest('.dm-actions')?.remove();
      };
    });
  }

  function _renderNetwork(el) {
    el.className = 'app-network';

    // Use NetworkSystem nodes if available, fallback to GameState
    const NS   = window.NetworkSystem;
    const tgts = NS ? NS.getKnownNodes() : (GameState.getNetwork().knownTargets ?? []);
    const conn = NS ? NS.getCurrentNode() : GameState.getNetwork().connectedTo;

    const nodeHTML = tgts.map((t, i) => {
      const angle  = (i / Math.max(tgts.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const cx     = 250 + Math.cos(angle) * 115;
      const cy     = 160 + Math.sin(angle) * 105;
      const active = conn?.ip === t.ip;
      const breach = NS ? NS.isBreached(t.ip) : false;
      const cls    = active ? 'net-active' : breach ? 'net-scanned' : 'net-unknown';
      return `
        <line x1="250" y1="160" x2="${cx}" y2="${cy}" class="net-line ${breach ? 'scanned' : ''}"/>
        <circle cx="${cx}" cy="${cy}" r="15" class="net-node ${cls}"/>
        <text x="${cx}" y="${cy + 28}" class="net-label net-small" text-anchor="middle">${_escHtml(t.hostname ?? t.ip)}</text>
        <text x="${cx}" y="${cy + 40}" class="net-label net-ip" text-anchor="middle">${_escHtml(t.ip)}</text>
      `;
    }).join('');

    el.innerHTML = `
      <div class="network-header">
        <span>Network Topology</span>
        <span class="net-connected">
          ${conn
            ? `🟢 Conectado: ${_escHtml(conn.hostname)}`
            : '🔴 Offline'}
        </span>
      </div>
      <div class="network-canvas">
        <svg viewBox="0 0 500 320" class="network-svg">
          ${nodeHTML}
          <circle cx="250" cy="160" r="22" class="net-node net-local"/>
          <text x="250" y="165" class="net-label" text-anchor="middle"
            dominant-baseline="middle" style="font-size:10px;">YOU</text>
        </svg>
      </div>
      <div class="network-legend">
        <span><span class="legend-dot local"></span> Vos</span>
        <span><span class="legend-dot unknown"></span> Desconocido</span>
        <span><span class="legend-dot scanned"></span> Comprometido</span>
        <span><span class="legend-dot active"></span> Conectado</span>
        <span style="margin-left:auto;color:var(--text-dim);font-size:10px;">
          ${tgts.length} nodo(s) conocidos
        </span>
      </div>
    `;
  }

  function _renderTools(el) {
    el.className = 'app-tools';
    const sw = GameState.getSoftware();
    const INV = window.InventorySystem;
    const RS  = window.ReputationSystem;

    // v10: shopItems ahora viene del catálogo de LocalSystem
    const LS = window.LocalSystem;
    const catalog = LS?.getCatalog?.() ?? {};
    const repLevel = window.ReputationSystem?.getReputation?.() ?? 0;
    const shopItems = Object.values(catalog)
      .filter(t => t.price > 0 && t.repRequired <= repLevel)
      .sort((a, b) => a.price - b.price);
    // Fallback si LocalSystem no está listo
    const shopItemsFallback = [
      { id: 'cryptbreak',  price: 200, name: 'CryptBreak v1',  desc: 'Descifra archivos encriptados.', icon: '🔓', ram: 0.8, deps: [] },
      { id: 'vpn',        price: 350, name: 'GhostVPN',        desc: 'Reduce el calor policial.',      icon: '🌀', ram: 0.5, deps: [] },
      { id: 'brutex', price: 500, name: 'BruteX',          desc: 'Fuerza bruta de credenciales.',  icon: '💥', ram: 1.5, deps: [] },
      { id: 'shieldwall',   price: 150, name: 'ShieldWall',       desc: 'Bloquea rastreos entrantes.',    icon: '🛡', ram: 0.5, deps: [] },
    ];
    const itemsToShow = shopItems.length > 0 ? shopItems : shopItemsFallback;

    const invItems = INV ? INV.getInventory().filter(i => !i.sold) : [];
    const invHTML  = invItems.length === 0
      ? `<div style="padding:16px;color:var(--text-muted);font-size:12px;">Inventario vacío.<br>Hackeá nodos y descargá archivos para acumular datos.</div>`
      : invItems.map(i => {
          const meta    = INV.getTypeMeta(i.dataType);
          const sensCol = i.sensitivity >= 8 ? 'var(--danger)' : i.sensitivity >= 5 ? 'var(--warn)' : 'var(--accent)';
          return `
            <div class="installed-item">
              <div class="installed-name" style="color:var(--warn);">${_escHtml(i.filename)}</div>
              <div style="font-size:11px;color:var(--text-muted);">${_escHtml(meta?.label ?? i.dataType)}</div>
              <div style="display:flex;gap:12px;margin-top:4px;font-size:11px;">
                <span>Sens: <span style="color:${sensCol}">${i.sensitivity}/10</span></span>
                <span>Valor: <span style="color:var(--warn)">~$${i.valueEstimate.toLocaleString('es-AR')} CR</span></span>
                <span style="color:${i.listedForSale ? 'var(--accent)' : 'var(--text-dim)'}">${i.listedForSale ? '🔴 En venta' : '○ Sin listar'}</span>
              </div>
            </div>`;
        }).join('');

    el.innerHTML = `
      <div class="tools-tabs">
        <button class="tools-tab active" data-tab="shop">Mercado</button>
        <button class="tools-tab" data-tab="installed">Instalado</button>
        <button class="tools-tab" data-tab="inventory">Inventario</button>
      </div>
      <div class="tools-content">

        <div id="panel-shop">
          <div class="shop-balance">
            Saldo: <span class="shop-money" id="shop-bal">$${GameState.getMoney().toLocaleString('es-AR')}</span> CR
            ${RS ? `&nbsp;&nbsp;<span style="color:var(--text-dim);font-size:11px;">Calor: <span style="color:${RS.getHeat()>=60?'var(--danger)':'var(--accent)'}">${RS.getHeat()}%</span> | Rango: <span style="color:var(--cyan)">${RS.getTier().label}</span></span>` : ''}
          </div>
          <div class="shop-grid">
            ${itemsToShow.map(item => {
              const inst     = LS?.isActive?.(item.id) || sw[item.id]?.installed;
              const hasBin   = LS?.hasBinary?.(item.id);
              const depsOk   = (item.deps ?? []).every(d => LS?.isActive?.(d));
              const depsStr  = (item.deps ?? []).length > 0
                ? item.deps.map(d => {
                    const active = LS?.isActive?.(d);
                    const dname  = catalog[d]?.name ?? d;
                    return '<span style="color:' + (active ? 'var(--accent)' : 'var(--text-dim)') + ';font-size:9px;">' + dname + '</span>';
                  }).join(' + ')
                : '';
              return `
                <div class="shop-item ${inst ? 'installed' : hasBin ? 'has-binary' : ''}" id="si-${item.id}">
                  <div class="shop-item-name">${item.icon} ${_escHtml(item.name)}</div>
                  <div class="shop-item-desc">${_escHtml(item.desc)}</div>
                  ${item.ram ? `<div style="font-size:9px;color:var(--text-dim);margin-top:2px;">RAM: ${item.ram} GB${depsStr ? ' · Deps: ' + depsStr : ''}</div>` : ''}
                  <div class="shop-item-footer">
                    <span class="shop-price">$${item.price} CR</span>
                    ${inst
                      ? '<span class="shop-btn installed-badge">✓ Activa</span>'
                      : hasBin
                        ? `<button class="shop-btn local-install-hint" data-toolid="${_escHtml(item.id)}" style="background:var(--bg-mid);color:var(--warn);border:1px solid var(--warn);">📦 install ${_escHtml(item.id)}</button>`
                        : `<button class="shop-btn buy-btn" onclick="AleXimOS._buy('${item.id}', ${item.price})">Comprar</button>`
                    }
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div id="panel-installed" style="display:none">
          ${(function() {
            const LS2 = window.LocalSystem;
            const activeTools = LS2?.getActiveTools?.() ?? [];
            if (activeTools.length === 0) {
              return '<div style="padding:16px;color:var(--text-muted)">Sin herramientas activas.<br><span style="color:var(--text-dim);font-size:11px;">Comprá en Mercado e instalá con: install [tool]</span></div>';
            }
            const axDot2 = (cur, max, col) =>
              '<span style="color:' + col + '">' + '●'.repeat(cur) + '</span>' +
              '<span style="color:var(--text-dim)">' + '○'.repeat(max - cur) + '</span>';
            return activeTools.map(function(tool) {
              const cat2 = LS2.getCatalog()[tool.id];
              if (!cat2) return '';
              const burnCol2 = tool.burn >= 80 ? 'var(--danger)' : tool.burn >= 50 ? 'var(--warn)' : 'var(--text-dim)';
              const repairCost = Math.floor((cat2.price || 500) * 0.3 + (tool.burn||0) * 5);
              return '<div class="installed-item">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<div class="installed-name">' + _escHtml(tool.icon) + ' ' + _escHtml(tool.name) + '</div>' +
                (tool.burn >= 40 ? '<button onclick="GameLoop.getTerminal()?.printLine(\'repair ' + tool.id + '\', \'muted\')" style="font-size:9px;padding:2px 8px;background:var(--bg-mid);color:var(--warn);border:1px solid var(--warn);border-radius:3px;cursor:pointer;">reparar ~$' + repairCost + '</button>' : '') +
                '</div>' +
                '<div class="installed-desc">' + _escHtml(cat2.desc) + '</div>' +
                '<div style="display:flex;gap:12px;margin-top:4px;font-size:10px;">' +
                '<span style="color:var(--text-dim)">SPD ' + axDot2(tool.axes.speed, cat2.maxAxes.speed, 'var(--cyan)') + '</span>' +
                '<span style="color:var(--text-dim)">SIL ' + axDot2(tool.axes.stealth, cat2.maxAxes.stealth, 'var(--accent)') + '</span>' +
                '<span style="color:var(--text-dim)">PWR ' + axDot2(tool.axes.power, cat2.maxAxes.power, 'var(--warn)') + '</span>' +
                '<span style="color:' + burnCol2 + ';margin-left:auto;">⚙ ' + Math.round(tool.burn||0) + '%</span>' +
                '</div>' +
                '<div style="font-size:9px;color:var(--text-dim);margin-top:2px;">upgrade ' + _escHtml(tool.id) + ' [speed|stealth|power]</div>' +
                '</div>';
            }).join('');
          })()}
        </div>

        <div id="panel-inventory" style="display:none">
          <div class="shop-balance">
            Items robados: <span class="shop-money">${invItems.length}</span>
            &nbsp;&nbsp;Valor total: <span class="shop-money">~$${(INV?.getTotalValue()??0).toLocaleString('es-AR')} CR</span>
          </div>
          ${invHTML}
          ${invItems.length > 0 ? `<div style="padding:8px 12px;font-size:11px;color:var(--text-dim);">Usá <span style="color:var(--cyan)">sell [archivo]</span> en la terminal para listar en DarkMarket.</div>` : ''}
        </div>

      </div>
    `;

    el.querySelectorAll('.tools-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panels = { shop:'panel-shop', installed:'panel-installed', inventory:'panel-inventory' };
        Object.entries(panels).forEach(([key, id]) => {
          const p = document.getElementById(id);
          if (p) p.style.display = tab.dataset.tab === key ? '' : 'none';
        });
      });
    });

    // Live balance update
    GameState.on('money', () => {
      const b = document.getElementById('shop-bal');
      if (b) b.textContent = '$' + GameState.getMoney().toLocaleString('es-AR');
    });

    // BUG #5 FIX: event delegation for install hint buttons (avoids onclick with template literals)
    el.addEventListener('click', function(e) {
      const btn = e.target.closest('.local-install-hint');
      if (!btn) return;
      const toolId = btn.dataset.toolid;
      if (!toolId) return;
      const term = window.GameLoop?.getTerminal?.();
      if (term) {
        term.printBlank?.();
        term.printHTML?.(`<span style="color:var(--text-dim)">→ escribí: </span><span style="color:var(--cyan)">install ${_escHtml(toolId)}</span><span style="color:var(--text-dim)"> en la terminal</span>`);
      }
      UI?.notify?.(`→ install ${_escHtml(toolId)} en la terminal`, 'info', 4000);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // FIX #1 — CRÓNICADIGITAL — Diario digital con layout de periódico
  // ═══════════════════════════════════════════════════════════════

  function _renderCronica(el) {
    el.className = 'app-cronica';
    const NS     = window.NewsSystem;
    const items  = NS ? NS.getNews(40) : [];
    const now    = new Date().toLocaleString('es-AR', { dateStyle:'full', timeStyle:'short' });

    const TAG_CSS  = { BREACH:'tag-breach', LEY:'tag-law', MERCADO:'tag-market', TECH:'tag-tech', GOB:'tag-tech', POLITICA:'tag-politica', MUNDIAL:'tag-mundial', ECONOMIA:'tag-economia', VICTIMAS:'tag-victimas' };
    const TAG_ICON = { BREACH:'🔴', LEY:'⚖️', MERCADO:'📈', TECH:'💻', GOB:'🏛️', POLITICA:'🗳️', MUNDIAL:'🌐', ECONOMIA:'💸', VICTIMAS:'😢' };

    if (items.length === 0) {
      el.innerHTML = `
        <div class="cronica-header">
          <div class="cronica-logo">CrónicaDigital</div>
          <div class="cronica-date">${now}</div>
          <div class="cronica-tagline">La información que el poder no quiere que veas</div>
        </div>
        <div class="cronica-empty">
          <div style="font-size:48px;margin-bottom:12px;">📰</div>
          <div style="color:var(--text-muted)">Sin noticias todavía.</div>
          <div style="color:var(--text-dim);font-size:11px;margin-top:6px;">Las noticias se generan dinámicamente cuando operás en la red.</div>
        </div>`;
      return;
    }

    // Mark all as read when opened
    items.forEach(n => NS.markRead?.(n.id));

    const featured = items[0];
    const secondary = items.slice(1, 4);
    const rest = items.slice(4, 20);

    el.innerHTML = `
      <div class="cronica-header">
        <div class="cronica-logo">CrónicaDigital</div>
        <div class="cronica-date">${now}</div>
        <div class="cronica-tagline">La información que el poder no quiere que veas · Argentina</div>
      </div>

      <div class="cronica-body">

        <!-- NOTA DESTACADA -->
        <div class="cronica-featured" id="cronica-featured-${featured.id}" data-news-id="${featured.id}">
          <div class="cronica-feat-img">
            ${_newsPlaceholderImg(featured.tag)}
          </div>
          <div class="cronica-feat-content">
            <div class="cronica-feat-meta">
              <span class="feed-tag ${TAG_CSS[featured.tag] ?? 'tag-tech'}">${TAG_ICON[featured.tag] ?? '📰'} ${_escHtml(featured.tag)}</span>
              <span class="cronica-time">${_escHtml(featured.time)}</span>
              ${featured.dynamic ? '<span class="feed-new-badge">NUEVO</span>' : ''}
            </div>
            <div class="cronica-feat-headline">${_escHtml(featured.title)}</div>
            <div class="cronica-feat-body">${_escHtml(featured.body)}</div>
            <button class="cronica-read-btn" onclick="AleXimOS._openNewsArticle(${JSON.stringify(featured).replace(/"/g,"'")})">Leer nota completa →</button>
          </div>
        </div>

        <!-- GRILLA SECUNDARIA -->
        <div class="cronica-grid">
          ${secondary.map(n => `
            <div class="cronica-card" onclick="AleXimOS._openNewsArticle(${JSON.stringify(n).replace(/"/g,"'")})">
              <div class="cronica-card-img">${_newsPlaceholderImg(n.tag, true)}</div>
              <div class="cronica-card-body">
                <span class="feed-tag ${TAG_CSS[n.tag] ?? 'tag-tech'} cronica-tag-small">${_escHtml(n.tag)}</span>
                <div class="cronica-card-headline">${_escHtml(n.title)}</div>
                <div class="cronica-card-time">${_escHtml(n.time)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- LISTA DE NOTICIAS -->
        <div class="cronica-list-header">ÚLTIMAS NOTICIAS</div>
        <div class="cronica-list">
          ${rest.map(n => `
            <div class="cronica-list-item" onclick="AleXimOS._openNewsArticle(${JSON.stringify(n).replace(/"/g,"'")})">
              <span class="feed-tag ${TAG_CSS[n.tag] ?? 'tag-tech'} cronica-tag-tiny">${_escHtml(n.tag)}</span>
              <span class="cronica-list-title">${_escHtml(n.title)}</span>
              <span class="cronica-list-time">${_escHtml(n.time)}</span>
            </div>
          `).join('')}
        </div>

      </div>`;
  }

  // Placeholder image SVG por categoría
  function _newsPlaceholderImg(tag, small) {
    const colors = { BREACH:'#ff3366', LEY:'#ffaa00', MERCADO:'#00ff88', TECH:'#00d4ff', GOB:'#8866ff', POLITICA:'#cc44ff', MUNDIAL:'#44aaff', ECONOMIA:'#ff8800', VICTIMAS:'#ff6699' };
    const icons  = { BREACH:'⚠', LEY:'⚖', MERCADO:'📈', TECH:'💻', GOB:'🏛', POLITICA:'🗳', MUNDIAL:'🌐', ECONOMIA:'💸', VICTIMAS:'😢' };
    const c = colors[tag] ?? '#00d4ff';
    const i = icons[tag]  ?? '📰';
    const h = small ? 60 : 140;
    return `<div style="width:100%;height:${h}px;background:linear-gradient(135deg,${c}22,${c}08);display:flex;align-items:center;justify-content:center;border-bottom:2px solid ${c}44;font-size:${small?24:48}px;border-radius:4px 4px 0 0;">${i}</div>`;
  }

  // ─── Abrir artículo completo en una ventana modal ─────────────
  function _openNewsArticle(news) {
    const TAG_CSS = { BREACH:'tag-breach', LEY:'tag-law', MERCADO:'tag-market', TECH:'tag-tech', GOB:'tag-tech', POLITICA:'tag-politica', MUNDIAL:'tag-mundial', ECONOMIA:'tag-economia', VICTIMAS:'tag-victimas' };
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="cronica-article-modal">
        <div class="cronica-article-header">
          <div class="cronica-article-meta">
            <span class="feed-tag ${TAG_CSS[news.tag] ?? 'tag-tech'}">${_escHtml(news.tag)}</span>
            <span style="color:var(--text-dim);font-size:11px;margin-left:8px;">${_escHtml(news.time)}</span>
            <button class="dialog-btn" onclick="this.closest('.dialog-overlay').remove()" style="margin-left:auto;padding:4px 12px;">✕ Cerrar</button>
          </div>
          <h2 class="cronica-article-title">${_escHtml(news.title)}</h2>
          <div class="cronica-article-source">CrónicaDigital — Redacción Underground</div>
        </div>
        <div class="cronica-article-body">
          ${_newsPlaceholderImg(news.tag)}
          <p class="cronica-article-text">${_escHtml(news.body)}</p>
          <p class="cronica-article-text" style="color:var(--text-dim);font-style:italic;">Esta nota fue generada dinámicamente por actividad en la red. Los eventos son ficticios y forman parte del universo narrativo de AleXim OS.</p>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  // ═══════════════════════════════════════════════════════════════
  // FIX #4 — AJUSTES DEL SISTEMA
  // ═══════════════════════════════════════════════════════════════

  function _renderSettings(el) {
    el.className = 'app-tools';
    const themes = [
      { id:'default',  name:'Ghost Green',  accent:'#00ff88', cyan:'#00d4ff', bg:'#04080f', desc:'El tema original. Verde hacker.' },
      { id:'red',      name:'Blood Red',     accent:'#ff3355', cyan:'#ff6688', bg:'#0f0408', desc:'Rojo oscuro. Peligro constante.' },
      { id:'blue',     name:'Deep Ocean',    accent:'#4488ff', cyan:'#00ccff', bg:'#04080f', desc:'Azul profundo. Calma calculada.' },
      { id:'purple',   name:'Void Purple',   accent:'#aa44ff', cyan:'#cc88ff', bg:'#060408', desc:'Violeta oscuro. El vacío digital.' },
      { id:'amber',    name:'Amber Alert',   accent:'#ffaa00', cyan:'#ffcc44', bg:'#0f0900', desc:'Ámbar. Alta alerta permanente.' },
      { id:'white',    name:'Clean Room',    accent:'#00dd88', cyan:'#00aacc', bg:'#0a0f14', desc:'Más luminoso. Espacio limpio.' },
    ];
    const currentTheme = localStorage.getItem('alexim_theme') ?? 'default';

    el.innerHTML = `
      <div class="tools-tabs">
        <button class="tools-tab active" data-tab="themes">Temas</button>
        <button class="tools-tab" data-tab="system">Sistema</button>
        <button class="tools-tab" data-tab="about">Acerca de</button>
      </div>
      <div class="tools-content">

        <div id="panel-themes">
          <div class="shop-balance">Tema actual: <span class="shop-money" id="current-theme-name">${themes.find(t=>t.id===currentTheme)?.name ?? 'Default'}</span></div>
          <div class="settings-themes-grid">
            ${themes.map(th => `
              <div class="settings-theme-card ${th.id === currentTheme ? 'active' : ''}" onclick="AleXimOS._applyTheme('${th.id}')">
                <div class="settings-theme-preview" style="background:${th.bg};border:2px solid ${th.id===currentTheme?th.accent:'transparent'};">
                  <div style="color:${th.accent};font-size:14px;font-family:monospace;padding:6px;">ghost_0x1@alexim</div>
                  <div style="background:${th.accent}22;margin:4px;padding:3px 6px;border-left:2px solid ${th.accent};color:${th.accent};font-size:10px;">$ scan</div>
                  <div style="color:${th.cyan};font-size:9px;padding:4px 6px;">Found: 192.168.1.1</div>
                </div>
                <div class="settings-theme-name">${_escHtml(th.name)}</div>
                <div class="settings-theme-desc">${_escHtml(th.desc)}</div>
                ${th.id === currentTheme ? '<div class="settings-theme-active">✓ Activo</div>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div id="panel-system" style="display:none">
          <div class="installed-item">
            <div class="installed-name">Alias del operador</div>
            <div style="display:flex;gap:8px;margin-top:6px;">
              <input id="alias-input" type="text" value="${typeof GameState!=='undefined'?GameState.getAlias():'ghost_0x1'}"
                style="flex:1;background:var(--bg-surface);border:1px solid var(--bg-elevated);color:var(--text-bright);padding:4px 8px;border-radius:3px;font-family:var(--font-mono);font-size:12px;">
              <button class="shop-btn buy-btn" onclick="AleXimOS._saveAlias(document.getElementById('alias-input').value)">Guardar</button>
            </div>
          </div>
          <div class="installed-item">
            <div class="installed-name">Audio del sistema</div>
            <button class="shop-btn buy-btn" onclick="AudioSystem.toggle();this.textContent=AudioSystem.isMuted()?'🔇 Desactivado':'🔊 Activado';">
              ${typeof AudioSystem!=='undefined'&&AudioSystem.isMuted()?'🔇 Desactivado':'🔊 Activado'}
            </button>
          </div>
          <div class="installed-item">
            <div class="installed-name">Guardado</div>
            <div style="display:flex;gap:8px;margin-top:6px;">
              <button class="shop-btn buy-btn" onclick="SaveSystem?.save();UI?.notify('💾 Guardado','success',2000)">💾 Guardar ahora</button>
              <button class="shop-btn" style="border:1px solid var(--danger);color:var(--danger);" onclick="if(confirm('¿Eliminar partida y reiniciar?'))SaveSystem?.reset()">🗑️ Reiniciar</button>
            </div>
          </div>
        </div>

        <div id="panel-about" style="display:none">
          <div style="padding:20px;text-align:center;">
            <div style="font-family:var(--font-hud);font-size:32px;color:var(--cyan);letter-spacing:4px;margin-bottom:8px;">AleXim OS</div>
            <div style="color:var(--text-muted);font-size:12px;">v2.4.1 — Kernel 5.17.0-alex-secure</div>
            <div style="color:var(--text-dim);font-size:11px;margin-top:12px;">Sistema operativo ficticio para simulación de hacking narrativo.</div>
            <div style="color:var(--text-dim);font-size:10px;margin-top:8px;">Ambientado en Argentina · Loop jugable completo</div>
            <div style="color:var(--accent);font-size:11px;margin-top:16px;">Desarrollado con ❤ y JavaScript puro</div>
          </div>
        </div>

      </div>`;

    el.querySelectorAll('.tools-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.tools-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        ['themes','system','about'].forEach(p => {
          const panel = document.getElementById('panel-' + p);
          if (panel) panel.style.display = tab.dataset.tab === p ? '' : 'none';
        });
      });
    });
  }

  // ─── Aplicar tema ─────────────────────────────────────────────
  function _applyTheme(themeId) {
    const themes = {
      default: { accent:'#00ff88', 'accent-dim':'#00cc6a', cyan:'#00d4ff', 'cyan-dim':'#009fbe', 'bg-deep':'#04080f', 'bg-dark':'#080d15', 'bg-mid':'#0d1520' },
      red:     { accent:'#ff3355', 'accent-dim':'#cc1133', cyan:'#ff6688', 'cyan-dim':'#cc4466', 'bg-deep':'#0f0408', 'bg-dark':'#150608', 'bg-mid':'#1a0810' },
      blue:    { accent:'#4488ff', 'accent-dim':'#2266dd', cyan:'#00ccff', 'cyan-dim':'#0099cc', 'bg-deep':'#040810', 'bg-dark':'#080d18', 'bg-mid':'#0d1525' },
      purple:  { accent:'#aa44ff', 'accent-dim':'#8822dd', cyan:'#cc88ff', 'cyan-dim':'#aa66dd', 'bg-deep':'#060408', 'bg-dark':'#0a080f', 'bg-mid':'#100a18' },
      amber:   { accent:'#ffaa00', 'accent-dim':'#cc8800', cyan:'#ffcc44', 'cyan-dim':'#cc9922', 'bg-deep':'#0f0900', 'bg-dark':'#150d00', 'bg-mid':'#1a1200' },
      white:   { accent:'#00dd88', 'accent-dim':'#00aa66', cyan:'#00aacc', 'cyan-dim':'#008899', 'bg-deep':'#0a0f14', 'bg-dark':'#0e141a', 'bg-mid':'#131c24' },
    };
    const t = themes[themeId] ?? themes.default;
    const root = document.documentElement;
    Object.entries(t).forEach(([k, v]) => root.style.setProperty('--' + k, v));
    localStorage.setItem('alexim_theme', themeId);
    // Update UI
    const nameEl = document.getElementById('current-theme-name');
    if (nameEl) nameEl.textContent = themeId;
    document.querySelectorAll('.settings-theme-card').forEach(c => {
      c.classList.toggle('active', c.getAttribute('onclick')?.includes(themeId));
    });
    if (typeof UI !== 'undefined') UI.notify(`🎨 Tema aplicado: ${themeId}`, 'success', 2000);
  }

  function _saveAlias(alias) {
    if (!alias?.trim()) return;
    // GameState doesn't expose setAlias — we store in localStorage and show it
    localStorage.setItem('alexim_alias', alias.trim());
    if (typeof UI !== 'undefined') UI.notify('Alias actualizado: ' + alias.trim(), 'success', 2000);
  }

  // ═══════════════════════════════════════════════════════════════
  // FIX #6 — NUEVAS APPS
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // FIX #6 — MP (estilo MercadoPago, referencia visual únicamente)
  // ═══════════════════════════════════════════════════════════════

  function _renderMP(el) {
    el.className = 'app-mp';
    const gs      = typeof GameState !== 'undefined' ? GameState : null;
    const money   = gs?.getMoney?.() ?? 0;
    const ledger  = window.LedgerSystem;
    const acct    = ledger?.getAccountNumber?.() ?? 'MP-00000000';
    const entries = ledger?.getAll?.() ?? [];

    el.innerHTML = `
      <div class="mp-app">

        <!-- Header bar azul MP -->
        <div class="mp-header">
          <div class="mp-logo">mp</div>
          <div class="mp-header-right">
            <div class="mp-alias">${_escHtml(gs?.getAlias?.() ?? 'ghost_0x1')}</div>
            <div class="mp-account">${_escHtml(acct)}</div>
          </div>
        </div>

        <!-- Saldo disponible -->
        <div class="mp-balance-section">
          <div class="mp-balance-label">Saldo disponible</div>
          <div class="mp-balance-amount">
            <span class="mp-currency">CR$</span>
            <span class="mp-balance-num">${money.toLocaleString('es-AR')}</span>
          </div>
          <div class="mp-balance-sub">CryptoRupias · Mercado underground AR</div>
        </div>

        <!-- Acciones rápidas -->
        <div class="mp-actions">
          <button class="mp-action-btn" onclick="AleXimOS.openApp('darkmarket')">
            <span class="mp-action-icon">📤</span>
            <span>Vender datos</span>
          </button>
          <button class="mp-action-btn" onclick="AleXimOS.openApp('darkmarket')">
            <span class="mp-action-icon">🛒</span>
            <span>Comprar tools</span>
          </button>
          <button class="mp-action-btn" onclick="AleXimOS.openApp('messages')">
            <span class="mp-action-icon">💬</span>
            <span>Mensajes</span>
          </button>
        </div>

        <!-- Movimientos -->
        <div class="mp-movements-header">
          <span>Tus movimientos</span>
          <span style="font-size:11px;color:var(--text-dim);">${entries.length} transacciones</span>
        </div>

        <div class="mp-movements-list">
          ${entries.length === 0
            ? `<div class="mp-empty">
                <div style="font-size:32px;margin-bottom:8px;">📋</div>
                <div>Sin movimientos todavía.</div>
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Vendé datos o comprá herramientas para ver tus transacciones.</div>
              </div>`
            : entries.map(e => {
                const isIn   = e.type === 'in';
                const date   = new Date(e.ts).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
                return `
                  <div class="mp-movement-row">
                    <div class="mp-movement-icon ${isIn ? 'mp-icon-in' : 'mp-icon-out'}">
                      ${isIn ? '↓' : '↑'}
                    </div>
                    <div class="mp-movement-info">
                      <div class="mp-movement-desc">${_escHtml(e.desc)}</div>
                      <div class="mp-movement-date">${date}</div>
                    </div>
                    <div class="mp-movement-amount ${isIn ? 'mp-amount-in' : 'mp-amount-out'}">
                      ${isIn ? '+' : '-'}CR$ ${e.amount.toLocaleString('es-AR')}
                    </div>
                  </div>`;
              }).join('')
          }
        </div>

      </div>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // FIX #5 — MI PC (inventario + reputación + calor + VPN + monitor)
  // ═══════════════════════════════════════════════════════════════

  function _renderMiPC(el) {
    el.className = 'app-tools';
    const gs  = typeof GameState !== 'undefined' ? GameState : null;
    const NS  = window.NetworkSystem;
    const RS  = window.ReputationSystem;
    const INV = window.InventorySystem;
    const PS  = window.PursuitSystem;

    const money   = gs?.getMoney?.() ?? 0;
    const heat    = RS?.getHeat?.() ?? 0;
    const rep     = RS?.getReputation?.() ?? 0;
    const vpn     = gs?.isVpnActive?.() ?? false;
    const invCnt  = INV?.count?.() ?? 0;
    const invVal  = INV?.getTotalValue?.() ?? 0;
    const known   = NS?.getKnownNodes?.() ?? [];
    const breached= known.filter(n => NS?.isBreached?.(n.ip));
    const heatLevel = PS?.getLevel?.(heat);

    const cpu = 15 + Math.floor(Math.random() * 30) + (breached.length * 8);
    const ram = 28 + Math.floor(Math.random() * 20) + (breached.length * 5);
    const netAct = NS?.isConnected?.() ? 80 + Math.random() * 15 : Math.random() * 8;

    const bar = (val, col) => {
      const w = Math.round(Math.min(100, val));
      return `<div style="background:var(--bg-surface);height:6px;border-radius:3px;overflow:hidden;flex:1;">
        <div style="width:${w}%;height:100%;background:${col};border-radius:3px;transition:width 0.5s;"></div></div>`;
    };

    el.innerHTML = `
      <div class="tools-tabs">
        <button class="tools-tab active" data-tab="estado">Estado</button>
        <button class="tools-tab" data-tab="local">Sistema Local</button>
        <button class="tools-tab" data-tab="inventario">Inventario</button>
        <button class="tools-tab" data-tab="monitor">Monitor</button>
      </div>
      <div class="tools-content">

        <!-- TAB ESTADO -->
        <div id="panel-estado">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 0;">

            <div class="wallet-stat-card">
              <div style="font-size:9px;color:var(--text-dim);letter-spacing:1.5px;margin-bottom:4px;">CALOR POLICIAL</div>
              <div style="font-family:var(--font-hud);font-size:22px;color:${heat>60?'var(--danger)':heat>30?'var(--warn)':'var(--accent)'};">${heat}%</div>
              <div style="font-size:10px;color:var(--text-muted);">${heatLevel?.name ?? 'INACTIVO'}</div>
              <div style="margin-top:6px;">${bar(heat, heat>60?'var(--danger)':heat>30?'var(--warn)':'var(--accent)')}</div>
            </div>

            <div class="wallet-stat-card">
              <div style="font-size:9px;color:var(--text-dim);letter-spacing:1.5px;margin-bottom:4px;">REPUTACIÓN</div>
              <div style="font-family:var(--font-hud);font-size:22px;color:var(--cyan);">${rep}%</div>
              <div style="font-size:10px;color:var(--text-muted);">${RS?.getTier?.().label ?? 'desconocido'}</div>
              <div style="margin-top:6px;">${bar(rep, 'var(--cyan)')}</div>
            </div>

            <div class="wallet-stat-card">
              <div style="font-size:9px;color:var(--text-dim);letter-spacing:1.5px;margin-bottom:4px;">VPN</div>
              <div style="font-family:var(--font-hud);font-size:22px;color:${vpn?'var(--accent)':'var(--text-dim)'};">${vpn?'ACTIVA':'INACTIVA'}</div>
              <div style="font-size:10px;color:var(--text-muted);">${vpn?'Calor policial reducido 50%':'Vulnerable a rastreo'}</div>
            </div>

            <div class="wallet-stat-card">
              <div style="font-size:9px;color:var(--text-dim);letter-spacing:1.5px;margin-bottom:4px;">RED</div>
              <div style="font-family:var(--font-hud);font-size:22px;color:var(--accent);">${breached.length}/${known.length}</div>
              <div style="font-size:10px;color:var(--text-muted);">nodos comprometidos</div>
            </div>

          </div>
        </div>

        <!-- TAB SISTEMA LOCAL v10 -->
        <div id="panel-local" style="display:none;padding:4px 0;">
          ${(function() {
            const LS = window.LocalSystem;
            if (!LS) return '<div style="padding:16px;color:var(--text-muted);">LocalSystem no disponible.</div>';
            const ram   = LS.getRam();
            const stor  = LS.getStorage();
            const anon  = LS.getAnonymity();
            const tools = LS.getActiveTools();
            const binaries = LS.getLocalTools().filter(t => t.status === 'binary' || t.status === 'unloaded');
            const anonCol = anon < 20 ? 'var(--danger)' : anon < 50 ? 'var(--warn)' : 'var(--accent)';
            const ramCol  = ram.pct > 85 ? 'var(--danger)' : ram.pct > 60 ? 'var(--warn)' : 'var(--cyan)';
            const storCol = stor.pct > 85 ? 'var(--danger)' : stor.pct > 60 ? 'var(--warn)' : 'var(--accent)';
            const bBar = (pct, col) => {
              const w = Math.round(Math.min(100, pct));
              return '<div style="background:var(--bg-surface);height:6px;border-radius:3px;overflow:hidden;flex:1;">' +
                '<div style="width:' + w + '%;height:100%;background:' + col + ';border-radius:3px;transition:width 0.5s;"></div></div>';
            };
            const axDot = (cur, max, col) => '<span style="color:' + col + '">' + '●'.repeat(cur) + '</span>' +
              '<span style="color:var(--text-dim)">' + '○'.repeat(max - cur) + '</span>';
            let html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:4px 0;">';
            html += '<div class="wallet-stat-card">' +
              '<div style="font-size:9px;color:var(--text-dim);letter-spacing:1.5px;margin-bottom:4px;">RAM</div>' +
              '<div style="font-family:var(--font-hud);font-size:20px;color:' + ramCol + ';">' + ram.used + '/' + ram.max + 'G</div>' +
              '<div style="margin-top:4px;">' + bBar(ram.pct, ramCol) + '</div></div>';
            html += '<div class="wallet-stat-card">' +
              '<div style="font-size:9px;color:var(--text-dim);letter-spacing:1.5px;margin-bottom:4px;">STORAGE</div>' +
              '<div style="font-family:var(--font-hud);font-size:20px;color:' + storCol + ';">' + stor.used.toFixed(1) + '/' + stor.max + 'G</div>' +
              '<div style="margin-top:4px;">' + bBar(stor.pct, storCol) + '</div></div>';
            html += '<div class="wallet-stat-card">' +
              '<div style="font-size:9px;color:var(--text-dim);letter-spacing:1.5px;margin-bottom:4px;">ANONIMATO</div>' +
              '<div style="font-family:var(--font-hud);font-size:20px;color:' + anonCol + ';">' + anon + '%</div>' +
              '<div style="margin-top:4px;">' + bBar(anon, anonCol) + '</div></div>';
            html += '</div>';
            if (tools.length > 0) {
              html += '<div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;margin:8px 0 4px;">HERRAMIENTAS ACTIVAS (' + tools.length + ')</div>';
              tools.forEach(function(tool) {
                const cat = LS.getCatalog()[tool.id];
                if (!cat) return;
                const burnCol = tool.burn >= 80 ? 'var(--danger)' : tool.burn >= 50 ? 'var(--warn)' : 'var(--accent)';
                html += '<div class="installed-item" style="padding:6px 8px;">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                  '<span>' + _escHtml(tool.icon) + ' <span style="color:var(--text-bright);font-size:12px;">' + _escHtml(tool.name) + '</span></span>' +
                  '<span style="color:' + burnCol + ';font-size:10px;">⚙ ' + Math.round(tool.burn || 0) + '%</span></div>' +
                  '<div style="display:flex;gap:10px;margin-top:4px;font-size:10px;">' +
                  '<span style="color:var(--text-dim)">SPD ' + axDot(tool.axes.speed, cat.maxAxes.speed, 'var(--cyan)') + '</span>' +
                  '<span style="color:var(--text-dim)">SIL ' + axDot(tool.axes.stealth, cat.maxAxes.stealth, 'var(--accent)') + '</span>' +
                  '<span style="color:var(--text-dim)">PWR ' + axDot(tool.axes.power, cat.maxAxes.power, 'var(--warn)') + '</span>' +
                  '<span style="color:var(--text-dim);margin-left:auto;">' + cat.ram + ' GB</span></div></div>';
              });
            }
            if (binaries.length > 0) {
              html += '<div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;margin:8px 0 4px;">PENDIENTES DE INSTALACIÓN (' + binaries.length + ')</div>';
              binaries.forEach(function(tool) {
                const cat = LS.getCatalog()[tool.id];
                const status = tool.status === 'binary' ? '📦 binario' : '○ descargada';
                html += '<div style="padding:4px 8px;color:var(--text-muted);font-size:11px;">' +
                  _escHtml(tool.icon) + ' ' + _escHtml(cat?.name ?? tool.id) + ' <span style="color:var(--text-dim)">' + status + ' → install ' + _escHtml(tool.id) + '</span></div>';
              });
            }
            if (tools.length === 0 && binaries.length === 0) {
              html += '<div style="padding:16px;color:var(--text-muted);font-size:12px;">Sin herramientas. Comprá en DarkMarket e instalá con: install [tool]</div>';
            }
            return html;
          })()}
        </div>

        <!-- TAB INVENTARIO -->
        <div id="panel-inventario" style="display:none">
          <div class="shop-balance">
            Datos robados: <span class="shop-money">${invCnt}</span> items ·
            Valor estimado: <span class="shop-money">~CR$ ${invVal.toLocaleString('es-AR')}</span>
          </div>
          ${INV && INV.count() > 0
            ? INV.getInventory().filter(i=>!i.sold).map(item => {
                const meta = INV.getTypeMeta(item.dataType);
                const sensCol = item.sensitivity >= 8 ? 'var(--danger)' : item.sensitivity >= 5 ? 'var(--warn)' : 'var(--accent)';
                return `<div class="installed-item">
                  <div style="display:flex;justify-content:space-between;">
                    <span style="color:var(--text-bright);font-size:12px;">${_escHtml(item.filename)}</span>
                    <span style="color:${sensCol};font-size:11px;">Sens: ${item.sensitivity}/10</span>
                  </div>
                  <div style="color:var(--text-muted);font-size:10px;">${_escHtml(meta?.label ?? item.dataType)}</div>
                  <div style="color:${item.listedForSale?'var(--accent)':'var(--text-dim)'};font-size:10px;">${item.listedForSale?'🔴 En venta':'Sin listar'}</div>
                </div>`;
              }).join('')
            : '<div style="padding:16px;color:var(--text-muted);font-size:12px;">Sin datos robados. Hackeá nodos y descargá archivos.</div>'
          }
        </div>

        <!-- TAB MONITOR -->
        <div id="panel-monitor" style="display:none;padding:8px;">
          <div style="font-size:11px;color:var(--text-dim);letter-spacing:1px;margin-bottom:8px;">RECURSOS DEL SISTEMA</div>
          ${[['CPU', cpu, 'var(--cyan)'], ['RAM', ram, 'var(--accent)'], ['RED', netAct.toFixed(0), 'var(--warn)']].map(([lbl, val, col]) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="color:var(--text-muted);min-width:36px;font-size:11px;">${lbl}</span>
              ${bar(val, col)}
              <span style="color:${col};min-width:36px;text-align:right;font-size:11px;">${Math.round(val)}%</span>
            </div>`).join('')}
          <div style="margin-top:12px;font-size:11px;color:var(--text-dim);letter-spacing:1px;margin-bottom:6px;">PROCESOS</div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">alexim-kernel <span style="color:var(--accent)">PID:1</span></div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">terminal.sh <span style="color:var(--accent)">PID:${100+Math.floor(Math.random()*50)}</span></div>
          ${NS?.isConnected?.() ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--warn);">net-tunnel → ${_escHtml(NS.getCurrentNode()?.hostname??'')}</div>` : ''}
          ${breached.length > 0 ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--danger);">breach-session [${breached.length} nodo(s)]</div>` : ''}
        </div>

      </div>`;

    el.querySelectorAll('.tools-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.tools-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        ['estado','local','inventario','monitor'].forEach(p => {
          const panel = document.getElementById('panel-'+p);
          if (panel) panel.style.display = tab.dataset.tab === p ? '' : 'none';
        });
      });
    });
  }

  function _renderLogViewer(el) {
    el.className = 'app-files';
    const gs  = typeof GameState !== 'undefined' ? GameState : null;
    const log = gs?.getDir?.('/var/log') ?? {};
    const entries = Object.entries(log);

    el.innerHTML = `
      <div class="files-toolbar">
        <span style="color:var(--cyan);font-size:12px;font-family:var(--font-hud);">/var/log</span>
      </div>
      <div style="padding:12px;font-family:var(--font-mono);font-size:12px;overflow-y:auto;flex:1;">
        ${entries.length === 0
          ? '<div style="color:var(--text-muted)">Sin logs disponibles.</div>'
          : entries.map(([name, f]) => `
              <div style="margin-bottom:16px;">
                <div style="color:var(--cyan);margin-bottom:4px;">── ${_escHtml(name)} ──</div>
                ${f.content.split('\n').map(line => {
                  const col = line.includes('[WARN]') ? 'var(--warn)' : line.includes('[ERROR]') ? 'var(--danger)' : line.includes('[OK]') ? 'var(--accent)' : 'var(--text-muted)';
                  return `<div style="color:${col}">${_escHtml(line)}</div>`;
                }).join('')}
              </div>
            `).join('')
        }
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // DARKMARKET APP
  // ═══════════════════════════════════════════════════════════════

  function _renderDarkMarket(el) {
    el.className = 'app-tools';
    const DM  = window.DarkMarketSystem;
    const INV = window.InventorySystem;
    const GS  = typeof GameState !== 'undefined' ? GameState : null;
    const ES  = window.EconomySystem;

    const offers   = DM ? DM.getOffers('pending')  : [];
    const listings = DM ? DM.getListings()          : [];
    const invItems = INV ? INV.getInventory().filter(i => !i.sold && !i.listedForSale) : [];

    // ── Underground Reddit posts (ficticios, procedurales) ─────────
    const FORUM_POSTS = [
      { user:'n3xus_ar',    time:'hace 2h', votes:847,  tag:'🔧 TOOLS',   title:'[RELEASE] BruteX v3.2 — 60% más rápido en SHA-256. Link en DM.', comments:34, hot:true },
      { user:'ghost_0x1',   time:'hace 4h', votes:512,  tag:'💰 MARKET',  title:'Vendí base de datos de TeleNet por 8k CR. Tips para maximizar precio.', comments:19, hot:false },
      { user:'shadow_mkt',  time:'hace 6h', votes:1203, tag:'⚠️ ALERTA',  title:'AVISO: hay 2 nuevas cuentas de la UEC infiltradas en el foro. Cuidado.', comments:67, hot:true },
      { user:'darknode_ba', time:'hace 9h', votes:389,  tag:'🌐 NOTICIAS', title:'TeleNet levantó su seguridad. Nivel 3 → 4. Eviten por ahora.', comments:12, hot:false },
      { user:'cred_x',      time:'hace 12h',votes:654,  tag:'🔧 TOOLS',   title:'Tutorial completo: usar scanfrom para descubrir redes internas', comments:45, hot:false },
      { user:'phantom_ar',  time:'hace 1d', votes:2341, tag:'💰 MARKET',  title:'Los datos médicos del CONICET están pagando 3x el precio normal esta semana', comments:88, hot:true },
      { user:'anonima_2025',time:'hace 1d', votes:445,  tag:'⚠️ ALERTA',  title:'Kirchner y el gobierno nuevo. Documentos gubernamentales en máxima demanda.', comments:23, hot:false },
      { user:'broker_17',   time:'hace 2d', votes:891,  tag:'💰 MARKET',  title:'Pago premium por datos del Banco Nación. Contactar por este canal.', comments:31, hot:true },
    ];

    // ── Software para venta en el mercado ─────────────────────────
    const sw = GS?.getSoftware?.() ?? {};
    const SHOP_ITEMS = [
      // ── Herramientas base ────────────────────────────────────────
      { id:'cryptbreak',        price:200,  name:'CryptBreak v1',    desc:'Descifra archivos encriptados. Bypasea capa ENCRYPTION.',   icon:'🔓', tier:'Básico'   },
      { id:'vpn',              price:350,  name:'GhostVPN',          desc:'Reduce calor policial 50%. Bypasea FIREWALL/PROXY/IDS.',    icon:'🌀', tier:'Básico'   },
      { id:'brutex',       price:500,  name:'BruteX',            desc:'Fuerza bruta. Bypasea FIREWALL y AUTH.',                   icon:'💥', tier:'Avanzado' },
      { id:'shieldwall',         price:150,  name:'ShieldWall',         desc:'Bloquea rastreos entrantes.',                              icon:'🛡',  tier:'Básico'   },
      { id:'scanner',          price:800,  name:'NetScan Pro',       desc:'Scan avanzado. Revela vulnerabilidades en recon.',         icon:'🔭', tier:'Avanzado', upgradeOnly:true },
      { id:'fisherman',         price:450,  name:'SocialHook',        desc:'Ingeniería social. Bypasea AUTH con credenciales robadas.', icon:'🎣', tier:'Avanzado' },
      // ── Nuevas herramientas v8 (hacking engine) ─────────────────
      { id:'phantom',  price:650,  name:'FW-Ghost v2',       desc:'Especializado en bypass de FIREWALL. Muy silencioso.',     icon:'👻', tier:'Avanzado' },
      { id:'proxyx',   price:750,  name:'ProxyChain AR',     desc:'Cadena de proxies. Bypasea PROXY e IDS. Reduce ruido 30%.', icon:'🔀', tier:'Avanzado' },
      { id:'ghostwalk',      price:900,  name:'Phantom Packet',    desc:'Evasión de IDS. El más silencioso. Reduce ruido 50%.',     icon:'👁‍🗨', tier:'Élite'    },
      { id:'hashcrack', price:600,  name:'HashSlayer',        desc:'Crackeador de contraseñas. Bypasea AUTH con alta efectividad.', icon:'💀', tier:'Avanzado' },
      { id:'logwipe',        price:400,  name:'EraserX',           desc:'Borra logs de actividad. wipelog reduce heat -18% (vs -8% sin él).', icon:'🧹', tier:'Básico' },
    ];

    function _offerRow(o) {
      const loot  = INV?.getData(o.lootId);
      const exp   = Math.max(0, Math.round((o.expiresAt - Date.now()) / 1000));
      const col   = exp < 60 ? 'var(--danger)' : 'var(--text-dim)';
      return `<div class="installed-item dm-offer-row" style="border-left:3px solid var(--warn);padding-left:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--accent);font-family:var(--font-hud);font-size:11px;">${_escHtml(o.buyer)}</span>
          <span style="color:${col};font-size:10px;">⏱ ${exp}s</span>
        </div>
        <div style="color:var(--text-muted);font-size:11px;margin:2px 0;">${loot ? _escHtml(loot.filename) : 'archivo'}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
          <span style="color:var(--warn);font-family:var(--font-hud);">$${o.amount.toLocaleString('es-AR')} CR</span>
          <button class="shop-btn buy-btn dm-acc" data-id="${_escHtml(o.id)}" data-amt="${o.amount}" style="padding:3px 12px;font-size:11px;">✓ Aceptar</button>
          <button class="shop-btn dm-rej" data-id="${_escHtml(o.id)}" style="padding:3px 12px;font-size:11px;background:var(--bg-surface);border:1px solid var(--danger);color:var(--danger);">✗ Rechazar</button>
        </div>
      </div>`;
    }

    function _invRow(item) {
      const meta = INV.getTypeMeta(item.dataType);
      const econMult = ES?.getMultiplier?.(item.dataType) ?? 1.0;
      const adjVal = Math.floor(item.valueEstimate * econMult);
      const change = econMult > 1.05 ? `<span style="color:var(--accent);font-size:9px;">↑ ${Math.round((econMult-1)*100)}%</span>` : econMult < 0.95 ? `<span style="color:var(--danger);font-size:9px;">↓ ${Math.round((1-econMult)*100)}%</span>` : '';
      return `<div class="installed-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="color:var(--text-bright);font-size:12px;">${_escHtml(item.filename)}</div>
            <div style="color:var(--text-muted);font-size:10px;">${_escHtml(meta?.label ?? item.dataType)} · Sensibilidad: ${item.sensitivity}/10</div>
          </div>
          <div style="text-align:right;">
            <div style="color:var(--warn);font-size:12px;">~$${adjVal.toLocaleString('es-AR')} CR ${change}</div>
          </div>
        </div>
        <button class="shop-btn buy-btn dm-sell-btn" data-id="${_escHtml(item.id)}" style="margin-top:6px;padding:3px 14px;font-size:11px;">💰 Listar en DarkMarket</button>
      </div>`;
    }

    el.innerHTML = `
      <div class="tools-tabs">
        <button class="tools-tab active" data-tab="offers">
          💰 Ofertas${offers.length > 0 ? ` <span style="color:var(--warn);font-weight:bold;">(${offers.length})</span>` : ''}
        </button>
        <button class="tools-tab" data-tab="stock">📦 Mis Datos${invItems.length > 0 ? ` (${invItems.length})` : ''}</button>
        <button class="tools-tab" data-tab="tools">🔧 Herramientas</button>
        <button class="tools-tab" data-tab="forum">💬 Underground</button>
      </div>
      <div class="tools-content">

        <!-- TAB: OFERTAS + VENTAS ACTIVAS -->
        <div id="dm-panel-offers">
          ${offers.length > 0 ? `
            <div style="padding:8px 12px 0;font-size:10px;color:var(--text-dim);letter-spacing:1px;">OFERTAS PENDIENTES</div>
            ${offers.map(_offerRow).join('')}` : ''}
          ${listings.length > 0 ? `
            <div style="padding:8px 12px 0;font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-top:8px;">EN ESPERA DE COMPRADORES</div>
            ${listings.map(l => {
              const elapsed = Math.round((Date.now() - l.listedAt) / 1000);
              return `<div class="installed-item" style="border-left:3px solid var(--cyan);padding-left:10px;">
                <div style="color:var(--text-bright);font-size:12px;">${_escHtml(l.loot.filename)}</div>
                <div style="color:var(--text-dim);font-size:10px;">Esperando compradores · ${elapsed}s en mercado</div>
                <button class="shop-btn dm-delist" data-id="${_escHtml(l.loot.id)}" style="margin-top:4px;padding:2px 10px;font-size:10px;background:transparent;border:1px solid var(--text-dim);color:var(--text-muted);">✕ Retirar</button>
              </div>`;
            }).join('')}` : ''}
          ${offers.length === 0 && listings.length === 0 ? `
            <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">
              Sin ofertas activas.<br>
              <span style="color:var(--text-dim);">Andá a "Mis Datos" para listar archivos robados.</span>
            </div>` : ''}
        </div>

        <!-- TAB: INVENTARIO PARA VENDER -->
        <div id="dm-panel-stock" style="display:none">
          ${ES ? `<div style="padding:6px 12px;font-size:10px;color:var(--text-dim);">
            Precios ajustados por demanda del mercado. ${ES.getActiveDemand().length > 0 ? `<span style="color:var(--warn)">⚡ ${ES.getActiveDemand().length} demanda(s) activa(s)</span>` : ''}
          </div>` : ''}
          ${invItems.length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">Inventario vacío.<br><span style="color:var(--text-dim);">Hackeá nodos y descargá archivos.</span></div>`
            : invItems.map(_invRow).join('')}
        </div>

        <!-- TAB: HERRAMIENTAS (FIX #3 — unificado) -->
        <div id="dm-panel-tools" style="display:none">
          <div style="padding:8px 12px;font-size:11px;color:var(--text-muted);">
            Saldo: <span style="color:var(--warn);font-family:var(--font-hud);">$${GS ? GS.getMoney().toLocaleString('es-AR') : 0} CR</span>
          </div>
          <div class="shop-grid">
            ${SHOP_ITEMS.map(item => {
              const inst   = sw[item.id]?.installed;
              const level  = sw[item.id]?.level ?? 0;
              const canUpg = inst && level < 3;
              return `<div class="shop-item ${inst ? 'installed' : ''}" id="si-${item.id}">
                <div class="shop-item-name">${item.icon} ${_escHtml(item.name)}
                  <span style="font-size:9px;color:var(--text-dim);margin-left:4px;">[${_escHtml(item.tier)}]</span>
                </div>
                <div class="shop-item-desc">${_escHtml(item.desc)}</div>
                ${inst ? `<div style="font-size:10px;color:var(--cyan);margin:2px 0;">Nivel ${level}/3</div>` : ''}
                <div class="shop-item-footer">
                  <span class="shop-price">$${item.price} CR</span>
                  ${!inst
                    ? `<button class="shop-btn buy-btn" onclick="AleXimOS._buy('${item.id}',${item.price})">Comprar</button>`
                    : canUpg
                      ? `<button class="shop-btn buy-btn" style="background:var(--cyan-dim);border-color:var(--cyan);" onclick="AleXimOS._upgrade('${item.id}',${item.price*2})">⬆ Mejorar $${item.price*2}</button>`
                      : `<span class="shop-btn installed-badge">✓ Máx</span>`
                  }
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- TAB: UNDERGROUND FORUM — powered by DarkForumSystem -->
        <div id="dm-panel-forum" style="display:none">
          ${(() => {
            const DF     = window.DarkForumSystem;
            const posts  = DF ? DF.getPosts(12) : [];
            const tagCol = { 'VENTA':'var(--danger)', 'HOT':'var(--danger)', 'ALERTA':'var(--warn)', 'DEBATE':'var(--cyan)', 'INFO':'var(--accent)', 'PREGUNTA':'var(--text-muted)', 'REGLAS':'var(--text-dim)', 'MERCADO':'var(--warn)' };
            if (posts.length === 0) return `<div style="padding:20px;color:var(--text-muted);text-align:center;">Foro cargando... Volvé en unos segundos.</div>`;
            return `<div style="padding:6px 12px 0;font-size:10px;color:var(--text-dim);letter-spacing:1px;">DarkForum Underground · ${posts.length} posts activos</div>` +
              posts.map(p => {
                const tc = tagCol[p.tag] || 'var(--text-muted)';
                return `<div class="forum-post${p.isNew?' forum-post-hot':''}">
                  <div class="forum-votes">
                    <span style="color:var(--accent);font-size:14px;font-family:var(--font-hud);">▲</span>
                    <span class="forum-vote-count">${p.votes||0}</span>
                  </div>
                  <div class="forum-content">
                    <div class="forum-tag" style="color:${tc};border-color:${tc};">${_escHtml(p.tag)}</div>
                    <div class="forum-title">${_escHtml(p.title)}</div>
                    <div class="forum-meta">
                      <span style="color:var(--accent);">u/${_escHtml(p.handle)}</span>
                      <span style="color:var(--text-dim);">${p.flair?.label||''}</span>
                      <span style="color:var(--text-muted);">💬 ${p.replies?.length||0}</span>
                      ${p.isNew?'<span style="color:var(--warn);">🔥 NUEVO</span>':''}
                    </div>
                    <div style="color:var(--text-muted);font-size:11px;margin-top:4px;line-height:1.5;">${_escHtml((p.body||'').slice(0,140))}${(p.body||'').length>140?'…':''}</div>
                  </div>
                </div>`;
              }).join('') +
              `<div style="padding:8px 12px;font-size:10px;color:var(--cyan);cursor:pointer;" onclick="AleXimOS.openApp('darkforum')">→ Ver foro completo en DarkForum ↗</div>`;
          })()}
        </div>

      </div>`;

    // Tab switching
    el.querySelectorAll('.tools-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panels = { offers:'dm-panel-offers', stock:'dm-panel-stock', tools:'dm-panel-tools', forum:'dm-panel-forum' };
        Object.entries(panels).forEach(([key, id]) => {
          const p = document.getElementById(id);
          if (p) p.style.display = tab.dataset.tab === key ? '' : 'none';
        });
      });
    });

    el.querySelectorAll('.dm-acc').forEach(btn => {
      btn.onclick = () => {
        const res = DM.acceptOffer(btn.dataset.id);
        if (res.ok) { UI.notify(`✓ Venta: +$${Number(btn.dataset.amt).toLocaleString('es-AR')} CR`, 'success'); _renderDarkMarket(el); }
      };
    });
    el.querySelectorAll('.dm-rej').forEach(btn => {
      btn.onclick = () => { DM.rejectOffer(btn.dataset.id); _renderDarkMarket(el); };
    });
    el.querySelectorAll('.dm-delist').forEach(btn => {
      btn.onclick = () => { DM.delist(btn.dataset.id); _renderDarkMarket(el); };
    });
    el.querySelectorAll('.dm-sell-btn').forEach(btn => {
      btn.onclick = () => {
        const res = DM.listDataForSale(btn.dataset.id);
        if (res.ok) { UI.notify(res.message, 'success'); _renderDarkMarket(el); }
        else UI.notify(res.message, 'error');
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  function _escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');


    function _offerRow(o) {
      const loot    = INV?.getData(o.lootId);
      const expires = Math.max(0, Math.round((o.expiresAt - Date.now()) / 1000));
      const expCol  = expires < 60 ? 'var(--danger)' : 'var(--text-dim)';
      return `
        <div class="installed-item dm-offer-row" style="border-left:3px solid var(--warn);padding-left:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:var(--accent);font-family:var(--font-hud);font-size:11px;">${_escHtml(o.buyer)}</span>
            <span style="color:${expCol};font-size:10px;">Expira: ${expires}s</span>
          </div>
          <div style="color:var(--text-muted);font-size:11px;margin:2px 0;">${loot ? _escHtml(loot.filename) : 'archivo'}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
            <span style="color:var(--warn);font-family:var(--font-hud);">$${o.amount.toLocaleString('es-AR')} CR</span>
            <button class="shop-btn buy-btn dm-acc" data-id="${_escHtml(o.id)}" data-amt="${o.amount}"
              style="padding:3px 12px;font-size:11px;">✓ Aceptar</button>
            <button class="shop-btn dm-rej" data-id="${_escHtml(o.id)}"
              style="padding:3px 12px;font-size:11px;background:var(--bg-surface);border:1px solid var(--danger);color:var(--danger);">✗ Rechazar</button>
          </div>
        </div>`;
    }

    function _listingRow(l) {
      const elapsed = Math.round((Date.now() - l.listedAt) / 1000);
      return `
        <div class="installed-item" style="border-left:3px solid var(--cyan);padding-left:10px;">
          <div style="color:var(--text-bright);font-size:12px;">${_escHtml(l.loot.filename)}</div>
          <div style="color:var(--text-dim);font-size:10px;">En espera de compradores — ${elapsed}s en mercado</div>
          <button class="shop-btn dm-delist" data-id="${_escHtml(l.loot.id)}"
            style="margin-top:5px;padding:2px 10px;font-size:10px;background:transparent;border:1px solid var(--text-dim);color:var(--text-muted);">Retirar</button>
        </div>`;
    }

    function _invRow(item) {
      const meta = INV.getTypeMeta(item.dataType);
      return `
        <div class="installed-item">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-bright);font-size:12px;">${_escHtml(item.filename)}</span>
            <span style="color:var(--warn);font-size:11px;">~$${item.valueEstimate.toLocaleString('es-AR')} CR</span>
          </div>
          <div style="color:var(--text-muted);font-size:11px;">${_escHtml(meta?.label ?? item.dataType)} — Sens: ${item.sensitivity}/10</div>
          <button class="shop-btn buy-btn dm-sell-btn" data-id="${_escHtml(item.id)}"
            style="margin-top:5px;padding:3px 14px;font-size:11px;">💰 Listar en venta</button>
        </div>`;
    }

    el.innerHTML = `
      <div class="tools-tabs">
        <button class="tools-tab active" data-tab="offers">Ofertas ${offers.length > 0 ? `<span style="color:var(--warn)">(${offers.length})</span>` : ''}</button>
        <button class="tools-tab" data-tab="market">En Venta ${listings.length > 0 ? `(${listings.length})` : ''}</button>
        <button class="tools-tab" data-tab="stock">Inventario ${invItems.length > 0 ? `(${invItems.length})` : ''}</button>
      </div>
      <div class="tools-content">

        <div id="dm-panel-offers">
          ${offers.length === 0
            ? `<div style="padding:16px;color:var(--text-muted);font-size:12px;">Sin ofertas pendientes.<br>Listá datos en "En Venta" para recibir compradores.</div>`
            : offers.map(_offerRow).join('')}
        </div>

        <div id="dm-panel-market" style="display:none">
          ${listings.length === 0
            ? `<div style="padding:16px;color:var(--text-muted);font-size:12px;">Nada en venta.<br>Abrí el tab "Inventario" para listar un archivo.</div>`
            : listings.map(_listingRow).join('')}
        </div>

        <div id="dm-panel-stock" style="display:none">
          ${invItems.length === 0
            ? `<div style="padding:16px;color:var(--text-muted);font-size:12px;">Sin datos disponibles para vender.<br>Hackeá nodos y descargá archivos para acumular datos.</div>`
            : invItems.map(_invRow).join('')}
        </div>

      </div>
    `;

    // Tab switching
    el.querySelectorAll('.tools-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panels = { offers:'dm-panel-offers', market:'dm-panel-market', stock:'dm-panel-stock' };
        Object.entries(panels).forEach(([key, id]) => {
          const p = document.getElementById(id); if (p) p.style.display = tab.dataset.tab === key ? '' : 'none';
        });
      });
    });

    // Accept buttons
    el.querySelectorAll('.dm-acc').forEach(btn => {
      btn.onclick = () => {
        const res = DM.acceptOffer(btn.dataset.id);
        if (res.ok) {
          UI.notify(`✓ Venta: +$${Number(btn.dataset.amt).toLocaleString('es-AR')} CR`, 'success');
          _renderDarkMarket(el);
        }
      };
    });

    // Reject buttons
    el.querySelectorAll('.dm-rej').forEach(btn => {
      btn.onclick = () => { DM.rejectOffer(btn.dataset.id); _renderDarkMarket(el); };
    });

    // Delist buttons
    el.querySelectorAll('.dm-delist').forEach(btn => {
      btn.onclick = () => { DM.delist(btn.dataset.id); _renderDarkMarket(el); };
    });

    // Sell from inventory buttons
    el.querySelectorAll('.dm-sell-btn').forEach(btn => {
      btn.onclick = () => {
        const res = DM.listDataForSale(btn.dataset.id);
        if (res.ok) { UI.notify(res.message, 'success'); _renderDarkMarket(el); }
        else         UI.notify(res.message, 'error');
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  function _escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _parentPath(path) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return '/home/ghost';
    parts.pop();
    return '/' + parts.join('/');
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {

    /** Initialize the OS core. */
    init() {
      console.log('[AleXimOS] Kernel initialized.');

      // FIX: Register ecosystem event listeners at init time, not at app-open time.
      // WorldPopulation fires nodosocial-ready and darkforum-update during boot,
      // BEFORE any app is opened. Without this, the first open always shows empty.
      const _refreshNodo = () => {
        const w = AleXimOS.getOpenWindow('nodosocial');
        if (w) _renderNodoSocial(w.contentEl);
      };
      const _refreshForum = () => {
        const w = AleXimOS.getOpenWindow('darkforum');
        if (w) _renderDarkForum(w.contentEl);
      };
      window.addEventListener('nodosocial-ready',   _refreshNodo);
      window.addEventListener('nodo-social-update', _refreshNodo);
      window.addEventListener('new_post',           _refreshNodo);
      window.addEventListener('darkforum-update',   _refreshForum);
    },

    /**
     * Open an application by id.
     * If singleton and already open, focus it instead of creating a new one.
     */
    openApp(appId) {
      const app = _apps[appId];
      if (!app) { console.warn(`[AleXimOS] App not registered: ${appId}`); return null; }

      if (app.singleton !== false) {
        // Look for existing (open or minimized) window
        const existing = Object.values(_windows).find(w => w.appId === appId);
        if (existing) {
          if (existing.minimized) AleXimOS.restoreWindow(existing.id);
          else _focus(existing.id);
          return existing;
        }
      }
      return _createWindow(appId);
    },

    /** Close and destroy a window. */
    closeWindow(winId) {
      const win = _windows[winId];
      if (!win) return;
      win.el.remove();
      document.getElementById(`task-${winId}`)?.remove();
      delete _windows[winId];
      if (_activeId === winId) _activeId = null;
    },

    /** Minimize (hide) a window. */
    minimizeWindow(winId) {
      const win = _windows[winId];
      if (!win) return;
      win.el.style.display = 'none';
      win.minimized = true;
      document.getElementById(`task-${winId}`)?.classList.add('minimized');
      document.getElementById(`task-${winId}`)?.classList.remove('active');
    },

    /** Restore a minimized window. */
    restoreWindow(winId) {
      const win = _windows[winId];
      if (!win) return;
      win.el.style.display = '';
      win.minimized = false;
      document.getElementById(`task-${winId}`)?.classList.remove('minimized');
      _focus(winId);
    },

    /** Toggle maximize / restore. */
    toggleMaximize(winId) {
      const win = _windows[winId];
      if (!win) return;
      if (win.maximized) {
        win.el.classList.remove('maximized');
        if (win._savedRect) {
          const r = win._savedRect;
          win.el.style.cssText += `;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
        }
        win.maximized = false;
      } else {
        win._savedRect = {
          left:   parseInt(win.el.style.left),
          top:    parseInt(win.el.style.top),
          width:  win.el.offsetWidth,
          height: win.el.offsetHeight,
        };
        win.el.classList.add('maximized');
        win.maximized = true;
      }
    },

    /**
     * Return the open WindowData for a given appId (first match), or null.
     */
    getOpenWindow(appId) {
      return Object.values(_windows).find(w => w.appId === appId && !w.minimized) ?? null;
    },

    /** Return all current windows. */
    getWindows() { return { ..._windows }; },

    /**
     * Register a new app at runtime.
     * @param {string} id
     * @param {{ title, icon, width?, height?, singleton?, onOpen }} config
     */
    registerApp(id, config) {
      _apps[id] = config;
    },

    /** Navigate the Files app to a new path. */
    _filesNav(path, btnEl) {
      const win = Object.values(_windows).find(w => w.appId === 'files');
      if (win) _renderFiles(win.contentEl, path);
      GameState.setPath(path);
    },

    /** Purchase software from the DarkMarket. */
    _buy(softwareId, price) {
      if (!GameState.spendMoney(price)) {
        AudioSystem.error();
        UI.notify(`Fondos insuficientes — se necesitan $${price} CR`, 'error');
        return;
      }
      GameState.installSoftware(softwareId);
      AudioSystem.success();
      const sw = GameState.getSoftware()[softwareId];
      UI.notify(`✓ ${sw.name} instalado!`, 'success');
      // Registrar compra en LedgerSystem (MP Wallet)
      if (window.LedgerSystem) LedgerSystem.onBuy(price, sw.name);
      // Refresh DarkMarket if open
      const dm = AleXimOS.getOpenWindow('darkmarket');
      if (dm) _renderDarkMarket(dm.contentEl);
    },

    /** Upgrade installed software. */
    _upgrade(softwareId, price) {
      if (!GameState.spendMoney(price)) {
        AudioSystem.error();
        UI.notify(`Fondos insuficientes — se necesitan $${price} CR`, 'error');
        return;
      }
      GameState.upgradeSoftware(softwareId);
      AudioSystem.success();
      const sw = GameState.getSoftware()[softwareId];
      UI.notify(`⬆ ${sw.name} mejorado a Nivel ${sw.level}!`, 'success');
      // Registrar upgrade en LedgerSystem (MP Wallet)
      if (window.LedgerSystem) LedgerSystem.onBuy(price, `${sw.name} (Upgrade Nv.${sw.level})`);
      const dm = AleXimOS.getOpenWindow('darkmarket');
      if (dm) _renderDarkMarket(dm.contentEl);
    },

    /** Open a news article modal. */
    _openNewsArticle(news) { _openNewsArticle(news); },

    /** Apply a color theme. */
    _applyTheme(themeId)   { _applyTheme(themeId); },

    /** Save player alias. */
    _saveAlias(alias)      { _saveAlias(alias); },

    /** Fix #5 — refreshes the network map if it's open */
    refreshNetworkMap() {
      const win = AleXimOS.getOpenWindow('network');
      if (win) _renderNetwork(win.contentEl);
    },

    /** Fix #4 — refresh messages app if open */
    refreshMessages() {
      const win = AleXimOS.getOpenWindow('messages');
      if (win) _renderMessages(win.contentEl);
    },

    /** Abre IdentityProfiler con una persona específica */
    openProfile(personId) {
      AleXimOS.openApp('identityprofiler');
      setTimeout(() => {
        const win = AleXimOS.getOpenWindow('identityprofiler');
        if (win) _renderIdentityProfiler(win.contentEl, personId);
      }, 80);
    },

  };

  // ── Private helpers exposed via public API ───────────────────────
  function _updateMsgBadge() {
    const badge = document.getElementById('messages-app-badge');
    if (!badge || !window.DarkMarketSystem) return;
    const unread = DarkMarketSystem.getUnreadMessages?.()?.length ?? 0;
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERER: NodoSocial
  // ═══════════════════════════════════════════════════════════════
  // Alias para los renderers nuevos
  function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _renderNodoSocial(el) {
    const posts = window.SocialContentGenerator?.getFeed?.(60) || [];
    const timeAgo = window.SocialContentGenerator?.getTimeAgo || (ms => '');

    const typeColor = { normal:'var(--text-normal)', victim:'var(--danger)', cop:'var(--warn)', political:'var(--cyan)', event:'var(--accent)' };

    el.className = 'app-tools';
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-dark);">
        <div style="padding:10px 14px;border-bottom:1px solid var(--bg-mid);display:flex;align-items:center;gap:8px;">
          <span style="color:var(--accent);font-size:18px;font-weight:bold;">NodoSocial</span>
          <span style="color:var(--text-muted);font-size:11px;">Red Social Argentina — ${posts.length} publicaciones</span>
        </div>
        <div style="overflow-y:auto;flex:1;padding:10px 12px;display:flex;flex-direction:column;gap:10px;">
          ${posts.length === 0
            ? `<div style="color:var(--text-muted);padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;">
                <div style="font-size:32px;">🌐</div>
                <div>El mundo aún se está generando...</div>
                <div style="font-size:11px;color:var(--text-dim);">Puede tardar 2-3 segundos al inicio.</div>
                <button onclick="window.dispatchEvent(new CustomEvent('nodo-social-update'))" class="shop-btn buy-btn" style="padding:6px 18px;font-size:11px;margin-top:4px;">🔄 Recargar feed</button>
              </div>`
            : posts.map(p => {
              const border = p.type === 'victim' ? 'var(--danger)' : p.type === 'cop' ? 'var(--warn)' : 'var(--bg-mid)';
              const ts     = timeAgo(Date.now() - p.timestamp);
              return `
                <div style="background:var(--bg-surface);border:1px solid ${border};border-radius:6px;padding:10px 12px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                    <span style="color:var(--accent);font-size:12px;font-weight:bold;">${p.handle}</span>
                    <div style="display:flex;gap:8px;align-items:center;">
                      ${p.type !== 'normal' ? `<span style="color:${typeColor[p.type]||'var(--text-muted)'};font-size:10px;text-transform:uppercase;">[${p.type}]</span>` : ''}
                      <span style="color:var(--text-dim);font-size:11px;">${ts}</span>
                    </div>
                  </div>
                  <div style="color:var(--text-normal);font-size:12px;line-height:1.5;white-space:pre-wrap;">${_esc(p.content)}</div>
                  <div style="margin-top:6px;display:flex;gap:14px;">
                    <span style="color:var(--text-dim);font-size:11px;">❤ ${p.likes}</span>
                    <span style="color:var(--text-dim);font-size:11px;">💬 ${p.comments}</span>
                    <span style="color:var(--text-dim);font-size:11px;">🔁 ${p.shares}</span>
                    ${p.city ? `<span style="color:var(--text-dim);font-size:11px;">📍 ${p.city}</span>` : ''}
                  </div>
                </div>`;
            }).join('')}
        </div>
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERER: PeopleSearch
  // ═══════════════════════════════════════════════════════════════
  function _renderPeopleSearch(el, query) {
    query = (query || '').trim();
    const all = window.PersonGenerator?.getAll?.() || [];

    const results = query.length >= 2
      ? all.filter(p =>
          p.fullName.toLowerCase().includes(query.toLowerCase()) ||
          p.city.toLowerCase().includes(query.toLowerCase()) ||
          (p.orgName  || '').toLowerCase().includes(query.toLowerCase()) ||
          (p.job      || '').toLowerCase().includes(query.toLowerCase()) ||
          (p.socialMedia?.handle || '').toLowerCase().includes(query.toLowerCase())
        ).slice(0, 30)
      : [];

    el.className = 'app-tools';
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-dark);">

        <!-- Header + buscador -->
        <div style="padding:10px 14px;border-bottom:1px solid var(--bg-mid);">
          <div style="color:var(--accent);font-weight:bold;margin-bottom:8px;">
            PeopleSearch
            <span style="color:var(--text-dim);font-size:10px;font-weight:normal;">${all.length} registros</span>
          </div>
          <div style="display:flex;gap:6px;">
            <input id="ps-query" type="text"
              placeholder="Nombre, ciudad, empresa, @handle..."
              value="${_esc(query)}"
              style="flex:1;background:var(--bg-mid);border:1px solid var(--bg-elevated);color:var(--text-bright);
                     padding:7px 12px;border-radius:4px;font-family:var(--font-mono);font-size:12px;outline:none;" />
            <button id="ps-btn"
              style="background:var(--accent);color:var(--bg-deep);border:none;padding:7px 16px;
                     border-radius:4px;font-size:14px;cursor:pointer;flex-shrink:0;font-weight:bold;">🔍</button>
          </div>
        </div>

        <!-- Resultados -->
        <div style="overflow-y:auto;flex:1;padding:8px 12px;display:flex;flex-direction:column;gap:5px;">
          ${results.length === 0
            ? query.length >= 2
              ? `<div style="color:var(--text-muted);padding:24px;text-align:center;">
                   Sin resultados para "<span style='color:var(--warn)'>${_esc(query)}</span>"
                   <div style='font-size:10px;color:var(--text-dim);margin-top:6px;'>
                     Probá con nombre parcial, ciudad, empresa o @handle de NodoSocial
                   </div>
                 </div>`
              : `<div style="padding:40px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;">
                   <div style="font-size:32px;">🔍</div>
                   <div style="color:var(--text-muted);font-size:13px;">Buscá por nombre, ciudad, empresa o @handle</div>
                   <div style="color:var(--text-dim);font-size:11px;">${all.length} personas en la base de datos</div>
                   <div style="color:var(--text-dim);font-size:10px;">Escribí 2 o más caracteres y presioná Enter o 🔍</div>
                 </div>`
            : results.map(p => `
              <div onclick="AleXimOS.openProfile('${p.id}')"
                   style="cursor:pointer;background:var(--bg-surface);border:1px solid var(--bg-mid);
                          border-radius:5px;padding:9px 12px;display:flex;justify-content:space-between;
                          align-items:center;"
                   onmouseover="this.style.borderColor='var(--accent)'"
                   onmouseout="this.style.borderColor='var(--bg-mid)'">
                <div>
                  <div style="color:var(--text-bright);font-weight:bold;font-size:12px;">
                    ${_esc(p.fullName)}
                    ${p.victimized ? '<span style="color:var(--danger);font-size:10px;margin-left:6px;">[VÍCTIMA]</span>' : ''}
                  </div>
                  <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">
                    ${_esc(p.job)} · ${_esc(p.orgName || 'Sin organización')}
                  </div>
                  <div style="color:var(--text-dim);font-size:11px;">
                    ${_esc(p.city)} · ${p.age} años
                    ${p.socialMedia?.nodoSocial ? '· <span style="color:var(--accent)">📱 ' + _esc(p.socialMedia.handle) + '</span>' : ''}
                  </div>
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:10px;">
                  ${p.bankAccount    ? '<div style="color:var(--warn);font-size:10px;">🏦 Banco</div>'  : ''}
                  ${p.cryptoWallet  ? '<div style="color:var(--warn);font-size:10px;">₿ Cripto</div>' : ''}
                  ${p.victimized    ? '<div style="color:var(--danger);font-size:10px;">⚠ Víctima</div>' : ''}
                </div>
              </div>`).join('')}
        </div>
      </div>`;

    // Wire events INSIDE the function, after innerHTML is set
    const btn   = el.querySelector('#ps-btn');
    const input = el.querySelector('#ps-query');

    function _doSearch() {
      const v = (input?.value || '').trim();
      if (v.length >= 2) {
        _renderPeopleSearch(el, v);
      }
    }

    if (btn)   btn.addEventListener('click', _doSearch);
    if (input) {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') _doSearch(); });
      // Autofocus on first open (no query yet)
      if (!query) setTimeout(() => input.focus(), 60);
    }
  }

  window._renderPeopleSearchDyn = _renderPeopleSearch;


  // ═══════════════════════════════════════════════════════════════
  // RENDERER: IdentityProfiler — perfil forense de una persona
  // ═══════════════════════════════════════════════════════════════
  function _renderIdentityProfiler(el, personId) {
    const person = personId ? window.PersonGenerator?.getById?.(personId) : null;
    el.className = 'app-tools';

    if (!person) {
      el.innerHTML = `
        <div style="padding:32px 20px;color:var(--text-muted);text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;">
          <div style="font-size:28px;">🪪</div>
          <div style="font-size:13px;">Identity Profiler</div>
          <div style="font-size:11px;color:var(--text-dim);">Abrí desde PeopleSearch haciendo clic en un ciudadano.</div>
          <div style="margin-top:8px;font-size:11px;color:var(--text-dim);">O ingresá un ID:</div>
          <input type="text" id="ip-direct-id" placeholder="ID de persona..."
            style="background:var(--bg-mid);border:1px solid var(--bg-surface);color:var(--text-bright);
                   padding:6px 10px;border-radius:4px;font-size:11px;font-family:var(--font-mono);width:200px;" />
        </div>`;
      const inp = el.querySelector('#ip-direct-id');
      if (inp) inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') AleXimOS.openProfile(inp.value.trim());
      });
      return;
    }

    const network = window.RelationshipSystem?.getNetwork?.(person.id);
    const posts   = window.SocialContentGenerator?.getPostsFor?.(person.id) || [];
    const relSumm = window.RelationshipSystem?.getSummaryText?.(person) || '';

    // Build note text for the save button
    const noteBody = [
      'Tel: ' + person.phone,
      'Email corp: ' + person.email,
      'Email pers: ' + person.personalEmail,
      'Ciudad: ' + person.city + ', ' + person.province,
      'Empresa: ' + (person.orgName || '-'),
      'Handle: ' + (person.socialMedia?.nodoSocial ? person.socialMedia.handle : 'no activo'),
      'NSE: ' + person.nse + '/5  Seg: ' + person.securityLevel + '/5',
    ].join('\n');

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-dark);overflow-y:auto;">

        <!-- Header -->
        <div style="padding:14px 16px;border-bottom:1px solid var(--bg-mid);background:var(--bg-surface);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div>
              <div style="color:var(--text-bright);font-size:15px;font-weight:bold;">${_esc(person.fullName)}</div>
              <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">
                ${_esc(person.job)} · ${_esc(person.orgName || 'Sin organización')}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">
              <button id="ip-save-notes"
                style="background:var(--bg-elevated);color:var(--accent);border:1px solid var(--accent);
                       padding:3px 10px;border-radius:3px;font-size:10px;cursor:pointer;white-space:nowrap;">
                📝 Guardar en Notas
              </button>
              ${person.victimized
                ? `<span style="background:var(--danger);color:#fff;padding:3px 8px;border-radius:3px;font-size:10px;font-weight:bold;">VÍCTIMA CONFIRMADA</span>`
                : `<span style="background:var(--bg-mid);color:var(--text-muted);padding:3px 8px;border-radius:3px;font-size:10px;">Sin incidentes</span>`}
            </div>
          </div>
        </div>

        <!-- Datos personales grid -->
        <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:6px;border-bottom:1px solid var(--bg-mid);">
          ${[
            ['Ciudad',       person.city + ', ' + person.province],
            ['Edad',         person.age + ' años'],
            ['Teléfono',     person.phone],
            ['Email corp',   person.email],
            ['Email pers',   person.personalEmail],
            ['NSE',          person.nse + '/5'],
            ['Seg. digital', '█'.repeat(person.securityLevel) + '░'.repeat(5 - person.securityLevel)],
            ['Banco',        person.bankAccount  ? '✓ Sí' : '✗ No'],
            ['Cripto',       person.cryptoWallet ? '✓ Wallet' : '✗ No'],
            ['NodoSocial',   person.socialMedia?.nodoSocial ? person.socialMedia.handle : 'No activo'],
          ].map(([k, v]) => `
            <div style="background:var(--bg-surface);padding:7px 9px;border-radius:4px;">
              <div style="color:var(--text-dim);font-size:10px;margin-bottom:2px;">${k}</div>
              <div style="color:var(--text-bright);font-size:11px;word-break:break-all;">${_esc(String(v))}</div>
            </div>`).join('')}
        </div>

        <!-- Red social -->
        ${relSumm ? `
        <div style="padding:12px 16px;border-bottom:1px solid var(--bg-mid);">
          <div style="color:var(--accent);font-size:11px;font-weight:bold;margin-bottom:6px;">RED SOCIAL</div>
          <div style="color:var(--text-normal);font-size:11px;line-height:1.7;white-space:pre-wrap;">${_esc(relSumm)}</div>
        </div>` : ''}

        <!-- Intereses -->
        ${person.interests?.length ? `
        <div style="padding:10px 16px;border-bottom:1px solid var(--bg-mid);">
          <div style="color:var(--accent);font-size:11px;font-weight:bold;margin-bottom:6px;">INTERESES</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">
            ${person.interests.map(i =>
              `<span style="background:var(--bg-mid);color:var(--text-muted);padding:2px 7px;border-radius:10px;font-size:10px;">${_esc(i)}</span>`
            ).join('')}
          </div>
        </div>` : ''}

        <!-- Posts en NodoSocial -->
        ${posts.length > 0 ? `
        <div style="padding:12px 16px;">
          <div style="color:var(--accent);font-size:11px;font-weight:bold;margin-bottom:8px;">
            PUBLICACIONES EN NODOSOCIAL (${posts.length})
          </div>
          ${posts.slice(0, 5).map(p => `
            <div style="background:var(--bg-surface);border-left:3px solid ${p.type === 'victim' ? 'var(--danger)' : 'var(--bg-elevated)'};
                        padding:8px 10px;margin-bottom:6px;border-radius:0 4px 4px 0;">
              <div style="color:var(--text-normal);font-size:11px;line-height:1.5;">${_esc(p.content)}</div>
              <div style="color:var(--text-dim);font-size:10px;margin-top:3px;">❤ ${p.likes} · 💬 ${p.comments}</div>
            </div>`).join('')}
        </div>` : ''}

      </div>`;

    // Wire "Guardar en Notas" button
    const saveBtn = el.querySelector('#ip-save-notes');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        window._notesAppend?.(person.fullName, noteBody);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERER: DarkForum
  // ═══════════════════════════════════════════════════════════════
  function _renderDarkForum(el) {
    const posts = window.DarkForumSystem?.getPosts?.(40) || [];

    const tagColor = {
      'VENTA':  'var(--danger)',  'HOT':    'var(--danger)',  '🔥HOT': 'var(--danger)',
      'ALERTA': 'var(--warn)',    'DEBATE': 'var(--cyan)',
      'INFO':   'var(--accent)',  'PREGUNTA':'var(--text-muted)',
      'REGLAS': 'var(--text-dim)','MERCADO':'var(--warn)',
    };

    el.className = 'app-tools';
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-dark);">
        <div style="padding:10px 14px;border-bottom:1px solid var(--bg-mid);display:flex;align-items:center;gap:10px;">
          <span style="color:var(--danger);font-size:15px;font-weight:bold;">☠ DarkForum Underground</span>
          <span style="color:var(--text-muted);font-size:11px;">${posts.length} posts · Solo para operadores verificados</span>
        </div>
        <div style="overflow-y:auto;flex:1;padding:8px 12px;display:flex;flex-direction:column;gap:8px;">
          ${posts.length === 0
            ? `<div style="color:var(--text-muted);padding:20px;text-align:center;">Foro cargando...</div>`
            : posts.map(p => {
              const tc = tagColor[p.tag] || 'var(--text-muted)';
              return `
                <div id="dfp-${p.id}" style="background:var(--bg-surface);border:1px solid ${p.isNew?'var(--accent)':'var(--bg-mid)'};border-radius:5px;overflow:hidden;">
                  <div style="padding:8px 12px;cursor:pointer;"
                       onclick="document.getElementById('dft-${p.id}').style.display=document.getElementById('dft-${p.id}').style.display==='none'?'block':'none'">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                      <span style="color:${tc};font-size:10px;font-weight:bold;background:${tc}22;padding:1px 6px;border-radius:3px;">${_esc(p.tag)}</span>
                      <span style="color:${p.flair?.color||'var(--text-muted)'};font-size:10px;">${p.flair?.label||''}</span>
                      <span style="color:var(--accent);font-size:11px;font-weight:bold;">${_esc(p.handle)}</span>
                      ${p.isNew?'<span style="background:var(--accent);color:var(--bg-dark);font-size:9px;padding:1px 5px;border-radius:3px;">NUEVO</span>':''}
                    </div>
                    <div style="color:var(--text-bright);font-size:12px;font-weight:bold;">${_esc(p.title)}</div>
                    <div style="display:flex;gap:12px;margin-top:4px;">
                      <span style="color:var(--text-dim);font-size:10px;">▲ ${p.votes}</span>
                      <span style="color:var(--text-dim);font-size:10px;">👁 ${p.views}</span>
                      <span style="color:var(--text-dim);font-size:10px;">💬 ${p.replies?.length||0}</span>
                    </div>
                  </div>
                  <div id="dft-${p.id}" style="display:none;padding:0 12px 10px;border-top:1px solid var(--bg-mid);">
                    <div style="color:var(--text-normal);font-size:12px;line-height:1.6;padding:8px 0;white-space:pre-wrap;">${_esc(p.body)}</div>
                    ${(p.replies||[]).length>0?`
                    <div style="margin-top:8px;display:flex;flex-direction:column;gap:5px;">
                      ${p.replies.map(r=>`
                        <div style="background:var(--bg-mid);border-left:3px solid var(--bg-surface);padding:6px 8px;border-radius:0 4px 4px 0;">
                          <span style="color:var(--accent);font-size:10px;font-weight:bold;">${_esc(r.handle)}</span>
                          <div style="color:var(--text-normal);font-size:11px;margin-top:2px;">${_esc(r.body)}</div>
                        </div>`).join('')}
                    </div>` : ''}
                  </div>
                </div>`;
            }).join('')}
        </div>
      </div>`;

    // Limpiar badge de nuevos
    setTimeout(() => window.DarkForumSystem?.clearNew?.(), 1000);
  }

  // ═══════════════════════════════════════════════════════════════
  // v8 — THREAT MONITOR
  // ═══════════════════════════════════════════════════════════════

  function _renderThreatMonitor(el) {
    el.className = 'app-tools';
    const AS      = window.AdversarialSystem;
    const agents  = AS ? AS.getAgents() : [];
    const log     = AS ? AS.getLog().slice(0, 30) : [];
    const heat    = window.ReputationSystem?.getHeat?.() ?? 0;

    const typeLabel  = { police:'UEC / Policía', rival:'Hacker Rival', ids:'IDS Defensivo' };
    const typeColor  = { police:'var(--danger)', rival:'var(--warn)', ids:'var(--cyan)' };
    const stateColor = { idle:'var(--text-dim)', passive:'var(--text-dim)', hunting:'var(--warn)', active:'var(--danger)' };
    const stateLabel = { idle:'Inactivo', passive:'Pasivo', hunting:'🎯 Rastreando', active:'⚡ Atacando', scanning:'🔍 Escaneando' };
    const sevColor   = { normal:'var(--text-dim)', warning:'var(--warn)', critical:'var(--danger)' };

    el.innerHTML = `
      <div class="tools-tabs">
        <button class="tools-tab active" data-tab="agents">Agentes (${agents.length})</button>
        <button class="tools-tab" data-tab="log">Log (${log.length})</button>
        <button class="tools-tab" data-tab="honeypots">Trampas</button>
      </div>
      <div class="tools-content">

        <!-- AGENTES -->
        <div id="tm-panel-agents">
          <div style="padding:6px 4px 10px;font-size:10px;color:var(--text-dim);letter-spacing:1px;">
            HEAT ACTUAL: <span style="color:${heat>60?'var(--danger)':heat>35?'var(--warn)':'var(--accent)'};">${heat}%</span>
            &nbsp;·&nbsp; ${agents.filter(a=>a.state==='hunting'||a.state==='active').length} AGENTES ACTIVOS
          </div>
          ${agents.map(a => `
            <div class="installed-item" style="border-left:3px solid ${typeColor[a.type]??'var(--text-dim)'};padding-left:10px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                <div>
                  <span style="font-size:16px;margin-right:8px;">${a.icon}</span>
                  <span style="color:var(--text-bright);font-weight:600;font-size:12px;">${_esc(a.name)}</span>
                  <span style="color:var(--text-dim);font-size:10px;margin-left:6px;">${_esc(a.handle)}</span>
                </div>
                <span style="color:${stateColor[a.state]??'var(--text-dim)'};font-size:10px;font-family:var(--font-hud);">
                  ${stateLabel[a.state] ?? a.state}
                </span>
              </div>
              <div style="font-size:10px;color:var(--text-muted);">${a.portrait ? _esc(a.portrait) : ''}</div>
              <div style="display:flex;gap:10px;margin-top:5px;font-size:10px;color:var(--text-dim);">
                <span>Tipo: <span style="color:${typeColor[a.type]};">${typeLabel[a.type]??a.type}</span></span>
                <span>Nivel: <span style="color:var(--accent);">${a.level}/5</span></span>
                ${a.heatThreshold>0 ? `<span>Activa cuando heat &gt; <span style="color:var(--warn);">${a.heatThreshold}%</span></span>` : ''}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">
                ${a.actions.map(act => `<span style="background:var(--bg-mid);color:var(--text-dim);padding:1px 6px;border-radius:3px;font-size:9px;">${act}</span>`).join('')}
              </div>
            </div>`).join('')}
        </div>

        <!-- LOG -->
        <div id="tm-panel-log" style="display:none;">
          ${log.length === 0
            ? '<div style="padding:20px;color:var(--text-muted);text-align:center;">Sin actividad enemiga registrada aún.</div>'
            : log.map(e => {
                const agent = agents.find(a => a.id === e.agentId);
                const time  = new Date(e.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
                return `
                  <div style="padding:8px 6px;border-bottom:1px solid var(--bg-surface);">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                      <span style="color:${sevColor[e.severity]??'var(--text-dim)'};font-size:10px;min-width:52px;">[${e.action}]</span>
                      <span style="color:${typeColor[agent?.type??'ids']??'var(--text-dim)'};font-size:10px;">${agent?.icon ?? '?'} ${_esc(agent?.name ?? e.agentId)}</span>
                      <span style="color:var(--text-dim);font-size:10px;margin-left:auto;">${time}</span>
                    </div>
                    <div style="color:var(--text-normal);font-size:11px;line-height:1.5;">${_esc(e.description)}</div>
                  </div>`;
              }).join('')}
        </div>

        <!-- HONEYPOTS -->
        <div id="tm-panel-honeypots" style="display:none;padding:8px;">
          <div style="font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-bottom:10px;">NODOS TRAMPA DETECTADOS</div>
          ${AS && [...AS.isHoneypot('_list') ? [] : []].length === 0
            ? '<div style="color:var(--text-muted);font-size:12px;">Sin honeypots conocidos. Usá scan frecuente para detectarlos.</div>'
            : ''}
          <div style="font-size:12px;color:var(--text-muted);line-height:1.7;margin-top:8px;">
            <span style="color:var(--warn);">⚠ Cómo detectar honeypots:</span><br>
            • IPs en rangos inusuales (10.x.x.x con archivos muy atractivos)<br>
            • Seguridad nivel 1 con datos de alto valor (financial_data, credentials)<br>
            • Nodos aparecidos justo después de que tu heat subió<br>
            • Si conectás a uno → trace inmediato + heat +30%
          </div>
          <div style="margin-top:14px;font-size:10px;color:var(--text-dim);letter-spacing:1px;">NODOS COMPROMETIDOS POR RIVALES</div>
          ${(() => {
            const status = AS?.getRivalStatus?.();
            if (!status || status.compromisedByRival.length === 0) {
              return '<div style="color:var(--text-muted);font-size:12px;margin-top:6px;">Ninguno todavía.</div>';
            }
            return status.compromisedByRival.map(ip => {
              const node = window.NetworkSystem?.getKnownNodes?.().find(n => n.ip === ip);
              return `<div style="padding:5px 0;border-bottom:1px solid var(--bg-surface);">
                <span style="color:var(--warn);">💀 ${_esc(node?.hostname ?? ip)}</span>
                <span style="color:var(--text-dim);font-size:10px;margin-left:8px;">Archivos robados por rival</span>
              </div>`;
            }).join('');
          })()}
        </div>

      </div>`;

    // Tab switching
    el.querySelectorAll('.tools-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ['agents','log','honeypots'].forEach(p => {
          const panel = document.getElementById(`tm-panel-${p}`);
          if (panel) panel.style.display = tab.dataset.tab === p ? '' : 'none';
        });
      });
    });
  }

})();

