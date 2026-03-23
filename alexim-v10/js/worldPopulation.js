/**
 * worldPopulation.js — Orquestador del Ecosistema Digital
 * AleXim OS — Hacking Narrative Game
 *
 * Conecta PersonGenerator, RelationshipSystem, SocialContentGenerator
 * y DarkForumSystem con los sistemas existentes del juego.
 *
 * Escucha eventos del juego y dispara reacciones en el ecosistema.
 *
 * API:
 *   WorldPopulation.init()
 *   WorldPopulation.onHack(node, dataType)     → void
 *   WorldPopulation.onNewNode(node)            → void
 *   WorldPopulation.getVictimsOf(ip)           → Person[]
 *   WorldPopulation.getStats()                 → object
 */

window.WorldPopulation = (() => {
  'use strict';

  let _initialized = false;
  let _listeners   = {};

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }
  function _rndInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  // ─── Inicialización en cadena ──────────────────────────────────

  async function _bootEcosystem() {
    // Pequeño delay para asegurar que NetworkSystem y nodos estáticos estén listos
    await new Promise(r => setTimeout(r, 500));

    // 1. Generar personas vinculadas a los nodos conocidos
    if (window.PersonGenerator) {
      PersonGenerator.init();

      // Si NetworkSystem aún no tiene nodos propios (tutorial pendiente),
      // generar algunas personas "flotantes" para poblar NodoSocial igualmente
      if (PersonGenerator.count() < 10) {
        PersonGenerator.generate(25);  // personas genéricas sin org específica
      }

      // Escuchar nuevos nodos generados proceduralmente
      PersonGenerator.on('persons_added', ({ node, persons }) => {
        if (window.RelationshipSystem) RelationshipSystem.rebuild();
        // Generar posts para las nuevas personas
        if (window.SocialContentGenerator) {
          persons.filter(p => p.socialMedia?.nodoSocial).forEach(p => {
            SocialContentGenerator.injectPost?.(p, null, 'normal');
          });
        }
      });
    }

    // Micro-pausa para que PersonGenerator termine de poblar
    await new Promise(r => setTimeout(r, 200));

    // 2. Construir red de relaciones
    if (window.RelationshipSystem) {
      RelationshipSystem.init();
    }

    // 3. Generar feed inicial de NodoSocial (ahora PersonGenerator ya tiene gente)
    if (window.SocialContentGenerator) {
      SocialContentGenerator.init();
      // Si aún genera 0 posts (sin personas con nodoSocial), crear posts de muestra
      if (SocialContentGenerator.count() === 0 && window.PersonGenerator) {
        const people = PersonGenerator.getAll().slice(0, 15);
        people.forEach(p => {
          SocialContentGenerator.injectPost?.(p, null, 'normal');
        });
      }
    }

    // 4. Generar foro del DarkMarket
    if (window.DarkForumSystem) {
      DarkForumSystem.init();
    }

    // Notificar a la app NodoSocial si está abierta
    window.dispatchEvent(new CustomEvent('nodosocial-ready', { detail: { count: window.SocialContentGenerator?.count?.() || 0 } }));
    window.dispatchEvent(new CustomEvent('nodo-social-update'));
    window.dispatchEvent(new CustomEvent('darkforum-update'));

    // FIX D: re-notify after 3s to catch apps opened after boot animation
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('nodo-social-update'));
      window.dispatchEvent(new CustomEvent('darkforum-update'));
    }, 3000);

    console.log(`[WorldPopulation] Ecosistema digital activo:
  → ${window.PersonGenerator?.count?.() || 0} ciudadanos
  → ${window.RelationshipSystem?.nodeCount?.() || 0} relaciones
  → ${window.SocialContentGenerator?.count?.() || 0} posts en NodoSocial
  → ${window.DarkForumSystem?.count?.() || 0} posts en foro underground`);
  }

  // ─── Reacción a hackeos ────────────────────────────────────────

  function _handleHack(node, dataType) {
    if (!node) return;

    // 1. Victimizar personas de ese nodo
    const victims = window.PersonGenerator?.victimizeByIp?.(node.ip, dataType) || [];

    // 2. Posts en NodoSocial de las víctimas (con delay realista)
    victims.forEach((person, i) => {
      setTimeout(() => {
        window.SocialContentGenerator?.generateVictimPost?.(person, dataType);
      }, _rndInt(20000, 120000) * (i + 1));
    });

    // 3. Post en el foro underground
    window.DarkForumSystem?.injectHackEvent?.(node);

    // 4. Generar noticia dinámica con nombre de víctima real
    if (window.NewsSystem && victims.length > 0) {
      const victim = victims[0];
      const newsMap = {
        financial_data:       `Filtración masiva afecta a clientes de ${node.hostname} en ${victim.city}`,
        medical_records:      `Datos médicos de pacientes de ${node.hostname} expuestos en internet`,
        credentials:          `Robo de credenciales en ${node.hostname}: usuarios deben cambiar contraseñas`,
        customer_database:    `Base de datos de ${node.hostname} comprometida: miles de afectados`,
        government_documents: `Documentos reservados de ${node.hostname} filtrados en la dark web`,
        crypto_wallet_data:   `Billeteras cripto de ${node.hostname} vaciadas en ataque coordinado`,
        default:              `Ciberataque a ${node.hostname}: datos de usuarios comprometidos`,
      };
      const headline = newsMap[dataType] || newsMap.default;

      setTimeout(() => {
        const news = {
          id:      'wp_news_' + Date.now(),
          time:    new Date().toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }),
          tag:     'CIBERSEGURIDAD',
          title:   headline,
          body:    `${victim.fullName}, empleado/a de ${node.hostname}, confirmó que sus datos fueron expuestos. "No sé qué hacer", declaró. La empresa no emitió comunicado oficial. Se esperan denuncias judiciales.`,
          dynamic: true,
          read:    false,
          ts:      Date.now(),
        };
        window.NewsSystem?._injectNews?.(news);
      }, _rndInt(30000, 90000));
    }

    // 5. Si hay muchas víctimas → investigación policial emergente
    const totalVictims = window.PersonGenerator?.getForIp?.(node.ip)?.filter(p => p.victimized).length || 0;
    if (totalVictims >= 3 && window.ReputationSystem) {
      setTimeout(() => {
        ReputationSystem.addHeat(5, 'victim_complaints');
        if (window.UI) {
          UI.notify('📰 Víctimas del hackeo denunciaron a la UEC. +5% heat', 'warning', 8000);
        }
      }, _rndInt(60000, 180000));
    }

    _notify('hack_processed', { node, victims, dataType });
  }

  // ─── Conectar con eventos existentes del juego ─────────────────

  function _hookGameEvents() {

    // Cuando se descarga un archivo → victimizar personas del nodo
    window.addEventListener('alexim-download', e => {
      const { node, dataType } = e.detail || {};
      if (node && dataType) _handleHack(node, dataType);
    });

    // Cuando se breachea un nodo → post en el foro
    window.addEventListener('alexim-breach', e => {
      const node = e.detail?.node;
      if (node) window.DarkForumSystem?.injectHackEvent?.(node);
    });

    // Cuando se generan nuevos nodos → generar personas para ellos
    window.addEventListener('alexim-new-nodes', e => {
      const nodes = e.detail?.nodes || [];
      nodes.forEach(node => {
        const newPeople = window.PersonGenerator?.onNewNode?.(node) || [];
        if (newPeople.length > 0 && window.RelationshipSystem) {
          RelationshipSystem.rebuild();
        }
      });
    });

    // Eventos económicos → el foro reacciona
    window.addEventListener('economy-event', e => {
      const type = e.detail?.type;
      if (type) window.DarkForumSystem?.injectMarketEvent?.(type);
    });

    // Si el heat sube mucho → post de alerta en el foro
    if (window.ReputationSystem) {
      ReputationSystem.on('heat', heat => {
        if (heat > 70 && Math.random() > 0.7) {
          setTimeout(() => {
            window.DarkForumSystem?._createPost?.({
              handle: 'netshad0w',
              tag:    'ALERTA',
              title:  'Alerta: UEC activa en la red',
              body:   `La Unidad Especial está movida hoy. Alguien hizo algo grande. Bajen el perfil todos por un rato.`,
              timestamp: Date.now(),
              isNew: true,
            });
          }, _rndInt(10000, 45000));
        }
      });
    }
  }

  // ─── FIX #9: Integración con AdversarialSystem ───────────────
  // Conecta las acciones de agentes enemigos al ecosistema humano

  function _hookAdversarialEvents() {
    window.addEventListener('adversarial-log', (e) => {
      const entry = e.detail;
      if (!entry) return;

      // Acciones de UEC → reacción del ecosistema humano
      if (entry.action === 'publish_alert' || entry.action === 'leak_identity') {
        // Generar posts de ciudadanos alarmados en NodoSocial
        if (window.SocialContentGenerator) {
          setTimeout(() => {
            const people = window.PersonGenerator?.getAll?.() ?? [];
            const concerned = people.filter(p => !p.victimized).slice(0, 2);
            concerned.forEach(p => {
              SocialContentGenerator.injectPost?.(p, '¿Vieron lo de la UEC? Algo gordo está pasando en la red.', 'event');
            });
          }, _rndInt(5000, 15000));
        }
      }

      // Rivals comprometiendo nodos → DarkForum se activa
      if (entry.action === 'compromise_node' || entry.action === 'taunt') {
        if (window.DarkForumSystem) {
          setTimeout(() => {
            DarkForumSystem.injectPost?.(`👾 El underground está en movimiento. Alguien se está moviendo rápido esta noche.`, 'hacking');
          }, _rndInt(8000, 20000));
        }
      }

      // Honeypot activado → alerta en el ecosistema
      if (entry.action === 'honeypot_triggered') {
        if (window.DarkForumSystem) {
          DarkForumSystem.injectPost?.('⚠ AVISO: la UEC plantó trampas. Scaneen todo antes de conectarse a IPs nuevas.', 'security');
        }
      }
    });

    // Agente policial activado → ciudadanos reactivos
    window.addEventListener('alexim-ready', () => {
      if (window.AdversarialSystem) {
        AdversarialSystem.on('agent_activated', ({ agent }) => {
          if (agent.type !== 'police') return;
          const people = window.PersonGenerator?.getAll?.() ?? [];
          const victim  = people.find(p => p.victimized);
          if (victim && window.SocialContentGenerator) {
            setTimeout(() => {
              SocialContentGenerator.injectPost?.(victim,
                `Escuché que la UEC está activa. Espero que atrapen a los que me hackearon.`, 'victim');
            }, _rndInt(10000, 30000));
          }
        });
      }
    });
  }

  // ─── API Pública ───────────────────────────────────────────────

  const API = {

    on(ev, cb) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(cb);
    },

    async init() {
      if (_initialized) return;
      _initialized = true;
      await _bootEcosystem();
      _hookGameEvents();
      _hookAdversarialEvents(); // FIX #9: conectar AdversarialSystem al ecosistema
      console.log('[WorldPopulation] Inicializado y conectado.');
    },

    onHack(node, dataType) {
      _handleHack(node, dataType);
    },

    onNewNode(node) {
      const newPeople = window.PersonGenerator?.onNewNode?.(node) || [];
      if (newPeople.length > 0 && window.RelationshipSystem) {
        RelationshipSystem.rebuild();
      }
      return newPeople;
    },

    getVictimsOf(ip) {
      return window.PersonGenerator?.getForIp?.(ip)?.filter(p => p.victimized) || [];
    },

    getStats() {
      return {
        people:    window.PersonGenerator?.count?.()    || 0,
        relations: window.RelationshipSystem?.nodeCount?.() || 0,
        posts:     window.SocialContentGenerator?.count?.() || 0,
        forum:     window.DarkForumSystem?.count?.()    || 0,
      };
    },

    isReady() { return _initialized; },
  };

  return API;
})();
