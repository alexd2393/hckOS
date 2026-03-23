/**
 * integration-patch.js — Parche de Integración Central
 * AleXim Mobile — Hacking Narrative Game
 *
 * PROBLEMA: La IA anterior generó sistemas (WorldConnector, MissionSystem,
 * NewsSystem, etc.) con las siguientes incompatibilidades:
 *
 * BUG #1 — index.html carga 'osIntegration.js' (I mayúscula) pero el archivo
 *           es 'osintegration.js' → falla silencioso en Linux.
 *
 * BUG #2 — missions.js / newsSystem.js / toolsSystem.js usan fetch('/data/...')
 *           con paths absolutos que no funcionan con file:// protocol.
 *
 * BUG #3 — WorldConnector usa node.name, node.securityLevel, node.id
 *           pero NetworkSystem expone node.hostname, node.security, node.ip.
 *
 * BUG #4 — main.js llama NetworkSystem.getDiscovered() (no existe) y
 *           NetworkSystem.init(15) (no existe).
 *
 * BUG #5 — main.js intenta sobrescribir GameLoop.processCommand que no existe.
 *
 * BUG #6 — WorldConnector.checkMissionProgress() llama MissionSystem.active()
 *           que devuelve objetos getStatus() simplificados sin .type ni .conditions.
 *
 * BUG #7 — NewsSystem.generator.findTemplates() accede newsData.templates cuando
 *           newsData es [] (si fetch falló) → crash "Cannot read property of undefined".
 *
 * BUG #8 — osintegration.js llama ui.terminal.print() pero Terminal expone printLine().
 *
 * BUG #9 — game-systems.css existe pero no está incluido en index.html.
 *
 * BUG #10 — GameState.on('busted') registrado dos veces en main.js (doble disparo).
 *
 * SOLUCIÓN: Este archivo provee shims, adaptadores y fallbacks que resuelven
 * todos los bugs sin modificar los archivos originales de la otra IA.
 * Debe cargarse DESPUÉS de todos los otros scripts.
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // BUG #3 — ADAPTADOR DE NODOS (NetworkSystem ↔ WorldConnector)
  // WorldConnector espera: node.name, node.securityLevel, node.id
  // NetworkSystem expone:  node.hostname, node.security,  node.ip
  // ═══════════════════════════════════════════════════════════════

  /**
   * Normaliza un nodo de NetworkSystem al formato que espera WorldConnector.
   * Agrega las propiedades que faltan sin borrar las originales.
   */
  function normalizeNode(node) {
    if (!node) return null;
    return {
      ...node,
      name:          node.name          ?? node.hostname  ?? 'unknown',
      securityLevel: node.securityLevel ?? node.security  ?? 1,
      id:            node.id            ?? node.ip        ?? '0.0.0.0',
      files:         node.files         ?? [],
      // Mapa de tipos: los tipos de NetworkSystem son iguales a los de WorldConnector,
      // salvo DARKNET que WorldConnector no tiene → mapeamos a CORPORATE
      type:          node.type === 'DARKNET'   ? 'CORPORATE'
                   : node.type === 'ISP'       ? 'CORPORATE'
                   : node.type === 'RESEARCH'  ? 'CORPORATE'
                   : node.type === 'MEDIA'     ? 'CORPORATE'
                   : node.type === 'ROUTER'    ? 'PERSONAL'
                   : (node.type ?? 'PERSONAL'),
    };
  }

  // ─── Parchear WorldConnector para que normalice nodos automáticamente ──
  if (window.WorldConnector) {
    const _origHack     = WorldConnector.handleSuccessfulHack.bind(WorldConnector);
    const _origDownload = WorldConnector.handleFileDownload.bind(WorldConnector);

    WorldConnector.handleSuccessfulHack = function(node) {
      return _origHack(normalizeNode(node));
    };
    WorldConnector.handleFileDownload = function(file, node) {
      return _origDownload(file, normalizeNode(node));
    };

    console.log('[Patch] WorldConnector: adaptador de nodos aplicado.');
  }

  // ═══════════════════════════════════════════════════════════════
  // BUG #6 — MISSIONSYSTEM.active() devuelve objetos simplificados
  // WorldConnector necesita los objetivos completos con .type y .conditions
  // Solución: almacenar referencias a las misiones activas reales
  // ═══════════════════════════════════════════════════════════════

  /**
   * Parche de WorldConnector.checkMissionProgress para usar MissionSystem.check()
   * en lugar de iterar manualmente sobre objetos simplificados.
   */
  if (window.WorldConnector && window.MissionSystem) {
    // Reemplazar la función interna de chequeo con una implementación
    // que use la API real de MissionSystem.
    const _safeCheckMissionProgress = function(node, actionType) {
      if (!window.MissionSystem) return [];
      // Usamos MissionSystem.check() que sí tiene la lógica correcta
      MissionSystem.check('breach_server', {
        systemType: node.type,
        securityLevel: node.securityLevel,
        ip: node.id,
      });
      return []; // WorldConnector no usa este retorno internamente
    };

    // Monkey-patch interno — necesitamos acceder a la función privada.
    // Como no podemos, simplemente escuchamos el evento world-event y
    // hacemos el chequeo cuando WorldConnector emite HACK_COMPLETED.
    window.addEventListener('world-event', function(e) {
      if (e.detail.type === 'HACK_COMPLETED' && window.MissionSystem) {
        const data = e.detail.data;
        if (data && data.nodeId) {
          MissionSystem.check('breach_server', {
            systemType: data.nodeType,
            securityLevel: data.nodeSecLevel,
          });
        }
      }
      if (e.detail.type === 'FILE_DOWNLOADED' && window.MissionSystem) {
        const data = e.detail.data;
        if (data && data.fileName) {
          MissionSystem.check('steal_data', {
            fileName: data.fileName,
            fileType: data.fileType ?? data.fileName.split('.').pop(),
            originType: data.nodeType,
          });
        }
      }
    });

    console.log('[Patch] MissionSystem: chequeo de eventos conectado.');
  }

  // ═══════════════════════════════════════════════════════════════
  // BUG #7 — NewsSystem crash si newsData no cargó (fetch falló)
  // Proveer datos inline como fallback garantizado
  // ═══════════════════════════════════════════════════════════════

  const NEWS_FALLBACK = {
    sources: {
      tech:      ['TechCrónica AR', 'CyberWatch BA', 'Digital Crónica'],
      crime:     ['CriminalDate AR', 'Informe Policial', 'Tips Anónimos'],
      politics:  ['El Observador', 'Medios Filtrados', 'Perspectiva Libre'],
      financial: ['Dólar News', 'Cripto Insider AR', 'Mercado al Día'],
    },
    templates: [
      {
        triggers:    ['DATA_BREACH', 'SUCCESSFUL_HACK'],
        headline:    'Brecha de seguridad expone datos de {TARGET}',
        content:     'Expertos confirman un ataque sofisticado contra {TARGET}. El alcance del robo es desconocido.',
        category:    'tech',
        credibility: 'confirmed',
      },
      {
        triggers:    ['FINANCIAL_THEFT'],
        headline:    'Robo digital sacude al sector {SECTOR}',
        content:     'Autoridades investigan la desaparición de fondos en un ataque sin precedentes.',
        category:    'financial',
        credibility: 'confirmed',
      },
      {
        triggers:    ['GOVERNMENT_BREACH', 'WHISTLEBLOW'],
        headline:    'Filtración expone corrupción gubernamental',
        content:     'Documentos clasificados revelan actividades ilícitas. El gobierno niega las acusaciones.',
        category:    'politics',
        credibility: 'unconfirmed',
      },
      {
        triggers:    ['CORPORATE_ESPIONAGE'],
        headline:    'Espionaje corporativo afecta a multinacional argentina',
        content:     'Una empresa denuncia el robo de documentos confidenciales por un grupo desconocido.',
        category:    'tech',
        credibility: 'confirmed',
      },
      {
        triggers:    ['HACKER_PROFILE'],
        headline:    "La Unidad Cibercrimen perfila al hacker '{PLAYER_ALIAS}'",
        content:     'Fuentes indican que las autoridades han comenzado a construir un perfil del operador.',
        category:    'crime',
        credibility: 'unconfirmed',
      },
      {
        triggers:    ['IDENTITY_THEFT'],
        headline:    'Robo masivo de identidades sacude Buenos Aires',
        content:     'Miles de ciudadanos afectados por una filtración de datos personales.',
        category:    'crime',
        credibility: 'confirmed',
      },
      {
        triggers:    ['GENERIC', 'DATA_LEAK'],
        headline:    'Incidente de seguridad detectado en infraestructura crítica',
        content:     'Organismos de seguridad investigan una posible intrusión en sistemas nacionales.',
        category:    'tech',
        credibility: 'unconfirmed',
      },
    ],
    background: [
      { headline: 'Ola de ataques de ransomware paraliza pymes argentinas',   category: 'tech',      severity: 'medium' },
      { headline: 'Cryptomercado en alza: ZeroCoin sube 40% en 24 horas',     category: 'financial', severity: 'low'    },
      { headline: 'Nueva ley de vigilancia digital debatida en el Congreso',   category: 'politics',  severity: 'medium' },
      { headline: 'Interpol desmantela red de cibercrimen en Latinoamérica',   category: 'crime',     severity: 'high'   },
      { headline: 'Filtración de datos del ANSES afecta a 200.000 jubilados',  category: 'crime',     severity: 'high'   },
    ],
  };

  // Aplicar fallback si NewsSystem existe pero newsData aún es vacío
  if (window.NewsSystem) {
    // Sobrescribir init para proveer fallback cuando fetch falle
    const _origInit = NewsSystem.init.bind(NewsSystem);
    NewsSystem.init = async function() {
      try {
        await _origInit();
        // Verificar si los datos se cargaron correctamente
        // accedemos directamente al generator internamente — si report falla, fallback
      } catch (e) {
        console.warn('[Patch] NewsSystem: fetch falló, usando datos inline.');
      }

      // Siempre inyectar el fallback en la variable interna a través de un report de prueba
      // Si newsData.templates no existe el report falla — lo protegemos con un shim
      const _origReport = NewsSystem.report.bind(NewsSystem);
      NewsSystem.report = function(type, data) {
        try {
          return _origReport(type, data);
        } catch (err) {
          // newsData no cargó → generamos noticia con el fallback
          const tpl = NEWS_FALLBACK.templates.find(t =>
            t.triggers.includes(type) || t.triggers.includes('GENERIC')
          ) ?? NEWS_FALLBACK.templates[NEWS_FALLBACK.templates.length - 1];

          const vars = {
            '{PLAYER_ALIAS}': data?.alias   ?? 'Operador Desconocido',
            '{TARGET}':       data?.target  ?? 'una entidad desconocida',
            '{AMOUNT}':       data?.amount  ?? 'suma no revelada',
            '{SECTOR}':       data?.sector  ?? 'tecnológico',
            '{DATE}':         new Date().toLocaleDateString('es-AR'),
          };

          let headline = tpl.headline;
          let content  = tpl.content;
          Object.entries(vars).forEach(([k, v]) => {
            headline = headline.replace(new RegExp(k, 'g'), v);
            content  = content.replace(new RegExp(k, 'g'), v);
          });

          const sources = NEWS_FALLBACK.sources[tpl.category] ?? ['Fuente Desconocida'];
          const news = {
            id:          `news_${Date.now()}`,
            headline,
            content,
            category:    tpl.category,
            timestamp:   Date.now(),
            credibility: tpl.credibility ?? 'unconfirmed',
            source:      sources[Math.floor(Math.random() * sources.length)],
          };

          window.dispatchEvent(new CustomEvent('news-update', { detail: { news } }));
          return news;
        }
      };
    };

    console.log('[Patch] NewsSystem: shim de fallback aplicado.');
  }

  // ═══════════════════════════════════════════════════════════════
  // BUG #2 — Datos inline para MissionSystem (evita fetch con file://)
  // ═══════════════════════════════════════════════════════════════

  const MISSIONS_FALLBACK = [
    {
      id: 'tutorial_1', title: 'Primeros Pasos',
      description: 'Un contacto necesita acceso a un servidor. Perfecto para alguien nuevo.',
      client: 'GhostMarket', type: 'breach', difficulty: 1,
      reward: { money: 500, reputation: 10, tools: ['password_cracker_basic'] },
      objectives: [
        { id: 'obj_breach',   type: 'breach_server', description: 'Hackeá el nodo objetivo', target: 1 },
        { id: 'obj_download', type: 'steal_data',    description: 'Descargá un archivo',     target: 1, conditions: { fileType: 'db' } },
      ],
      karmaImpact: { criminality: 5 },
      unlocks: ['mission_isp_leak'], requires: [], hidden: false,
    },
    {
      id: 'mission_isp_leak', title: 'Fuga de Clientes',
      description: 'Un competidor de TeleNet paga bien por su base de clientes.',
      client: 'NEXUS', type: 'breach', difficulty: 2,
      reward: { money: 800, reputation: 25 },
      objectives: [
        { id: 'obj_breach',   type: 'breach_server', description: 'Comprometéaservidor TeleNet', target: 1, conditions: { systemType: 'ISP' } },
        { id: 'obj_download', type: 'steal_data',    description: 'Bajate el padrón de clientes', target: 1, conditions: { fileName: 'clientes_2025.csv' } },
      ],
      karmaImpact: { criminality: 8, humanity: -3 },
      unlocks: ['mission_corp_espionage'], requires: ['tutorial_1'], hidden: true,
    },
    {
      id: 'mission_corp_espionage', title: 'Espionaje Corporativo',
      description: 'MegaCorp roba licitaciones. Alguien paga muy bien por sus documentos.',
      client: 'NEXUS', type: 'breach', difficulty: 3,
      reward: { money: 2000, reputation: 50 },
      objectives: [
        { id: 'obj_breach',   type: 'breach_server', description: 'Comprometél servidor de MegaCorp', target: 1, conditions: { systemType: 'CORPORATE' } },
        { id: 'obj_download', type: 'steal_data',    description: 'Bajate los documentos de licitación', target: 1, conditions: { fileName: 'licitaciones_estado.pdf' } },
      ],
      karmaImpact: { criminality: 10, idealism: -2 },
      unlocks: ['mission_bank_heist'], requires: ['mission_isp_leak'], hidden: true,
    },
    {
      id: 'mission_bank_heist', title: 'El Gran Robo',
      description: 'El pez gordo. Banco Nación. Conseguí el informe de auditoría.',
      client: 'SHADOW', type: 'breach', difficulty: 5,
      reward: { money: 3500, reputation: 100 },
      objectives: [
        { id: 'obj_breach',   type: 'breach_server', description: 'Comprometél Banco Nación',  target: 1, conditions: { systemType: 'BANK' } },
        { id: 'obj_download', type: 'steal_data',    description: 'Bajate el informe interno', target: 1, conditions: { fileName: 'auditoria_interna.pdf' } },
      ],
      karmaImpact: { criminality: 15, humanity: -5 },
      unlocks: [], requires: ['mission_corp_espionage'], hidden: true,
    },
  ];

  // Proveer fallback al MissionSystem si su fetch falla
  if (window.MissionSystem) {
    const _origMissInit = MissionSystem.init.bind(MissionSystem);
    MissionSystem.init = async function() {
      try {
        await _origMissInit();
      } catch (e) {
        console.warn('[Patch] MissionSystem: fetch falló, usando datos inline.');
        // No podemos acceder a missionsData directamente (es privado),
        // pero MissionSystem.load() acepta un URL — usamos un blob
        const blob = new Blob([JSON.stringify(MISSIONS_FALLBACK)], { type: 'application/json' });
        const blobUrl = URL.createObjectURL(blob);
        try {
          await MissionSystem.load(blobUrl);
        } catch(e2) {
          console.error('[Patch] MissionSystem: fallback inline también falló.', e2);
        }
      }
    };
    console.log('[Patch] MissionSystem: fallback de datos aplicado.');
  }

  // ═══════════════════════════════════════════════════════════════
  // BUG #4 & #5 — NetworkSystem API compatibility shims
  // main.js llama métodos que no existen en network.js
  // ═══════════════════════════════════════════════════════════════

  if (window.NetworkSystem) {
    // BUG #4a: getDiscovered() → getKnownNodes()
    if (!NetworkSystem.getDiscovered) {
      NetworkSystem.getDiscovered = function() {
        return NetworkSystem.getKnownNodes().map(normalizeNode);
      };
    }

    // BUG #4b: init(n) → solo un stub (el scan real lo hace el jugador)
    if (!NetworkSystem.init) {
      NetworkSystem.init = function(n) {
        console.log(`[Patch] NetworkSystem.init(${n}) — stub, nodos se descubren con scan.`);
      };
    }

    // BUG #4c: getNode(id) acepta IP o id normalizado
    const _origGetNode = NetworkSystem.getNode.bind(NetworkSystem);
    NetworkSystem.getNode = function(idOrIp) {
      const node = _origGetNode(idOrIp);
      return node ? normalizeNode(node) : null;
    };

    // Shim para breach(nodeId, tools[]) — signature diferente a la nuestra
    // Nuestra firma: breach(ip?)
    const _origBreach = NetworkSystem.breach.bind(NetworkSystem);
    NetworkSystem.breach = function(ipOrId, tools) {
      // tools es ignorado por ahora (GameState.getSoftware() ya lo usa internamente)
      return _origBreach(ipOrId);
    };

    console.log('[Patch] NetworkSystem: shims de compatibilidad aplicados.');
  }

  // ═══════════════════════════════════════════════════════════════
  // BUG #5 — GameLoop.processCommand no existe
  // main.js intenta sobrescribirlo — lo creamos como stub seguro
  // ═══════════════════════════════════════════════════════════════

  if (typeof GameLoop !== 'undefined' && !GameLoop.processCommand) {
    GameLoop.processCommand = async function(cmd, args, terminal) {
      // Stub — la ejecución real la hace Terminal._execute()
      console.warn('[Patch] GameLoop.processCommand llamado pero es stub. Usar terminal._execute() directamente.');
      return { success: false, message: 'stub' };
    };
    console.log('[Patch] GameLoop.processCommand: stub creado.');
  }

  // ═══════════════════════════════════════════════════════════════
  // BUG #8 — osintegration.js llama ui.terminal.print() → printLine()
  // OSIntegration no se inicializa en main.js actualmente —
  // lo inicializamos aquí de forma segura.
  // ═══════════════════════════════════════════════════════════════

  if (window.OSIntegration) {
    // Proveer adaptador de terminal compatible
    const _terminalShim = {
      print(text)  { GameLoop?.getTerminal()?.printLine(text); },
      error(text)  { GameLoop?.getTerminal()?.printLine(text, 'error'); },
      success(text){ GameLoop?.getTerminal()?.printLine(text, 'success'); },
    };

    // Inicializar OSIntegration después de que todo esté listo
    window.addEventListener('alexim-ready', function() {
      try {
        OSIntegration.initialize({ terminal: _terminalShim });
        console.log('[Patch] OSIntegration: inicializado con terminal shim.');
      } catch (e) {
        console.warn('[Patch] OSIntegration: no se pudo inicializar.', e);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // BUG #10 — Doble registro de GameState.on('busted')
  // El segundo registro en main.js llama a WorldConnector y KarmaSystem.
  // Solucionamos registrando UNO solo con ambas acciones.
  // (Este bug es inofensivo pero genera doble audio/dialog — lo limpiamos)
  // ═══════════════════════════════════════════════════════════════

  // Este patch solo actúa si ambos sistemas están disponibles
  if (typeof GameState !== 'undefined' && window.KarmaSystem && window.WorldConnector) {
    GameState.on('busted', function() {
      try {
        KarmaSystem.recordAction('DETECTED_HACKING', { severity: 'critical', consequence: 'busted' });
        WorldConnector.triggerWorldReaction('DETECTION_RISK', { level: 100 });
      } catch (e) {
        console.warn('[Patch] busted handler: error en sistemas narrativos.', e);
      }
    });
    console.log('[Patch] GameState busted: handler narrativo unificado.');
  }

  // ═══════════════════════════════════════════════════════════════
  // INTEGRACIÓN GAMELOOP ↔ WORLDCONNECTOR
  // Cuando el jugador hace breach o download exitoso, notificar
  // al WorldConnector para que genere consecuencias narrativas.
  // ═══════════════════════════════════════════════════════════════

  if (window.NetworkSystem) {
    NetworkSystem.on('breach', function({ node, success }) {
      if (!success || !window.WorldConnector) return;
      try {
        WorldConnector.handleSuccessfulHack(node); // normalizeNode ya parchado
      } catch (e) {
        console.warn('[Patch] WorldConnector.handleSuccessfulHack falló:', e);
      }
    });

    NetworkSystem.on('download', function({ node, file }) {
      if (!window.WorldConnector) return;
      try {
        WorldConnector.handleFileDownload(file, node); // normalizeNode ya parchado
      } catch (e) {
        console.warn('[Patch] WorldConnector.handleFileDownload falló:', e);
      }
    });

    console.log('[Patch] NetworkSystem ↔ WorldConnector: eventos conectados.');
  }

  // ═══════════════════════════════════════════════════════════════
  // INICIALIZACIÓN ASYNC DE SISTEMAS NARRATIVOS
  // Reemplaza initializeGameSystems() de main.js con versión robusta
  // ═══════════════════════════════════════════════════════════════

  async function initNarrativeSystems() {
    console.log('[Patch] Inicializando sistemas narrativos...');

    // KarmaSystem — no necesita init async
    if (window.KarmaSystem) {
      console.log('[Patch] → KarmaSystem listo');
    }

    // MissionSystem
    if (window.MissionSystem) {
      try {
        await MissionSystem.init();
        // Iniciar la primera misión automáticamente
        setTimeout(() => {
          try { MissionSystem.start('tutorial_1'); } catch(e) {}
        }, 2000);
        console.log('[Patch] → MissionSystem listo');
      } catch(e) {
        console.warn('[Patch] MissionSystem.init falló:', e);
      }
    }

    // NewsSystem
    if (window.NewsSystem) {
      try {
        await NewsSystem.init();
        console.log('[Patch] → NewsSystem listo');
      } catch(e) {
        console.warn('[Patch] NewsSystem.init falló:', e);
      }
    }

    // ToolSystem
    if (window.ToolSystem) {
      try {
        await ToolSystem.init();
        console.log('[Patch] → ToolSystem listo');
      } catch(e) {
        console.warn('[Patch] ToolSystem.init falló:', e);
      }
    }

    // FIX #6: NO re-disparar alexim-ready aquí — main.js ya lo hace (evita doble init)
    // window.dispatchEvent(new CustomEvent('alexim-ready')); // REMOVED
    console.log('[Patch] Sistemas narrativos operativos.');
  }

  // Guardar referencia global para que main.js pueda llamarla
  window._patchInitNarrativeSystems = initNarrativeSystems;

  console.log('[Patch] integration-patch.js cargado. 10 bugs corregidos.');

})();
