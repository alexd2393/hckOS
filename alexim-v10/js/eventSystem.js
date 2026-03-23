/**
 * eventSystem.js — Sistema de Eventos Dinámicos del Mundo
 * AleXim OS — Hacking Narrative Game
 *
 * Genera eventos que afectan al mundo del juego:
 *   - Escándalos políticos argentinos
 *   - Crisis económicas
 *   - Avances tecnológicos
 *   - Guerras y conflictos
 *   - Peleas entre partidos políticos
 *
 * API:
 *   EventSystem.init()
 *   EventSystem.trigger(eventId)    → void
 *   EventSystem.getActiveEvents()   → event[]
 *   EventSystem.getEventHistory()   → event[]
 *   EventSystem.on(event, cb)
 */

window.EventSystem = (() => {
  'use strict';

  let _activeEvents  = [];
  let _history       = [];
  let _listeners     = {};

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  // ═══════════════════════════════════════════════════════════════
  // CATÁLOGO DE EVENTOS — Argentina y el mundo
  // ═══════════════════════════════════════════════════════════════

  const EVENT_CATALOG = {

    // ── Política argentina ──────────────────────────────────────

    kirchner_vialidad: {
      id: 'kirchner_vialidad',
      category: 'politica',
      severity: 9,
      title: '⚖️ Juicio a Cristina Kirchner: sentencia en caso Vialidad',
      body:  'La ex presidenta Cristina Fernández de Kirchner fue condenada por el caso de corrupción en la obra pública de Vialidad. La condena por 6 años de prisión e inhabilitación para ejercer cargos electivos genera divisiones profundas en la sociedad. Kirchneristas salen a las calles. Sectores anti-K festejan. Los documentos internos del caso son el bien más cotizado en el mercado underground.',
      tag:   'POLITICA',
      effects: {
        economy: { triggerEvent: 'kirchner_corruption' },
        heat:    { heatModifier: 5 },
        nodes:   { unlockType: 'government', count: 1 },
        news:    { generateCount: 3 },
      },
      reactions: [
        'Los kirchneristas convocaron a marcha en Plaza de Mayo. Ruta 3 bloqueada.',
        'Sectores del peronismo piden amnistía. Gobierno rechaza.',
        'Organizaciones de DDHH piden juzgamiento también para sus socios.',
        '"La persecución judicial es un lawfare" — afirman sus defensores.',
        'Mercados reaccionan negativamente. El dólar blue sube $50.',
      ],
    },

    milei_shock: {
      id: 'milei_shock',
      category: 'politica',
      severity: 8,
      title: '💥 Gobierno libertario aplica shock económico total',
      body:  'El presidente Milei firma decreto de desregulación masiva. Cierre de ministerios, despidos estatales masivos y devaluación del 60%. La anarcocapitalismo aplicado genera caos y oportunidades: el sistema de ANSES, AFIP y organismos estatales está momentáneamente vulnerable.',
      tag:   'ECONOMIA',
      effects: {
        economy: { triggerEvent: 'financial_crisis' },
        nodes:   { unlockType: 'government', count: 2 },
      },
      reactions: [
        'PARO NACIONAL: sindicatos paralizan el país.',
        'Bitcoin sube 25% en Argentina ante caída del peso.',
        'Hackivistas atacan el sitio del gobierno nacional.',
        'El FMI celebra las medidas. La calle arde.',
      ],
    },

    peronismo_vs_libertarios: {
      id: 'peronismo_vs_libertarios',
      category: 'politica',
      severity: 6,
      title: '🗳️ Choque: Peronismo K vs. Libertarios en el Congreso',
      body:  'Sesión de Congreso termina en escándalo. Diputados libertarios y kirchneristas se acusan mutuamente de corrupción. Denuncias cruzadas de espionaje ilegal y manejo de fondos reservados. Los documentos internos de ambos bloques están circulando en el underground.',
      tag:   'POLITICA',
      effects: {
        economy: { triggerEvent: 'political_scandal' },
      },
      reactions: [
        'Peronismo acusa: "Están usando los servicios de inteligencia para perseguirnos".',
        'Libertarios contraatacan: "El kirchnerismo destruyó la república".',
        'UCR intenta mediar, sin éxito.',
        'Redes sociales arden con capturas de pantalla y audios filtrados.',
      ],
    },

    ucr_escandalo: {
      id: 'ucr_escandalo',
      category: 'politica',
      severity: 5,
      title: '🔵 UCR: Escándalo interno por desvío de fondos',
      body:  'Dirigentes de la Unión Cívica Radical son imputados por malversación de fondos partidarios. Documentos contables filtrados muestran pagos irregulares. El partido histórico enfrenta su mayor crisis interna en décadas.',
      tag:   'POLITICA',
      effects: {
        nodes: { unlockType: 'government', count: 1 },
      },
      reactions: [
        'Renuncias en cascada en el bloque radical.',
        'Candidatos radicales se alejan del escándalo.',
        '"El partido de Alem y Yrigoyen no merece esto" — dicen sus bases.',
      ],
    },

    comunistas_protesta: {
      id: 'comunistas_protesta',
      category: 'politica',
      severity: 4,
      title: '🔴 Izquierda y socialistas toman el centro porteño',
      body:  'El Frente de Izquierda y Trabajadores convoca a manifestación masiva contra el ajuste. Organizaciones socialistas, comunistas y trotskistas se unen en el mayor acto de la izquierda en años. El gobierno endurece la respuesta.',
      tag:   'POLITICA',
      effects: {},
      reactions: [
        'PTS, PO y MST marcharon juntos por primera vez en 15 años.',
        'El gobierno amenaza con aplicar el protocolo anti-manifestaciones.',
        'Redes alternativas de comunicación surgen ante el bloqueo informativo.',
      ],
    },

    // ── Economía ────────────────────────────────────────────────

    inflacion_record: {
      id: 'inflacion_record',
      category: 'economia',
      severity: 7,
      title: '📈 Inflación mensual supera el 20%: record histórico',
      body:  'El INDEC confirma inflación mensual del 21.3%. La canasta básica aumentó 380% en el año. Ahorristas desesperados buscan criptomonedas y activos dolarizados. El mercado negro de datos financieros está en ebullición.',
      tag:   'ECONOMIA',
      effects: {
        economy: { triggerEvent: 'financial_crisis' },
      },
      reactions: [
        'Supermercados desabastecidos: acaparadores compran antes del remarque.',
        'ZeroCoin se convierte en el refugio digital de los argentinos.',
        'El dólar blue superó los $2000.',
      ],
    },

    crypto_boom_arg: {
      id: 'crypto_boom_arg',
      category: 'economia',
      severity: 6,
      title: '₿ Argentina lidera adopción de criptomonedas en Latinoamérica',
      body:  'Según nuevos datos, el 38% de los argentinos posee algún activo cripto. Las fintech locales procesaron más de $4000M en cripto el último mes. La demanda de datos de wallets en el underground está en su máximo histórico.',
      tag:   'MERCADO',
      effects: {
        economy: { triggerEvent: 'tech_boom' },
      },
      reactions: [
        'AFIP anuncia fiscalización de tenencias cripto.',
        'Mercado negro de seed phrases: el artículo más buscado esta semana.',
      ],
    },

    // ── Tecnología ───────────────────────────────────────────────

    ia_vigilancia: {
      id: 'ia_vigilancia',
      category: 'tecnologia',
      severity: 7,
      title: '🤖 El gobierno despliega IA de vigilancia en redes digitales',
      body:  'El Ministerio de Seguridad anunció el despliegue de un sistema de inteligencia artificial para detectar actividad criminal en internet. El sistema analiza en tiempo real millones de paquetes de datos. Los hackers reportan mayor dificultad para operar sin ser detectados.',
      tag:   'TECH',
      effects: {
        heat:  { globalHeatModifier: 3 },
      },
      reactions: [
        'Organizaciones de derechos digitales denuncian vigilancia masiva.',
        'El mercado de VPNs y proxies explotó: demanda +400%.',
        'Foros underground migraron a redes cifradas de segunda capa.',
      ],
    },

    apagon_internet: {
      id: 'apagon_internet',
      category: 'tecnologia',
      severity: 8,
      title: '🔌 Apagón de internet: falla en infraestructura crítica',
      body:  'Una falla en el backbone de telecomunicaciones afectó a 12 provincias. Hospitales, bancos y el Estado operan en modo emergencia. La infraestructura de ISPs está momentáneamente expuesta.',
      tag:   'TECH',
      effects: {
        nodes: { unlockType: 'logistics', count: 2 },
        heat:  { heatModifier: -5 },  // es más fácil operar en el caos
      },
      reactions: [
        'ARSAT activa protocolos de emergencia.',
        'El gobierno culpa a "hackers extranjeros" sin aportar pruebas.',
        'Oportunidad histórica: la atención de seguridad está dispersa.',
      ],
    },

    // ── Internacional ────────────────────────────────────────────

    guerra_fria_digital: {
      id: 'guerra_fria_digital',
      category: 'mundial',
      severity: 9,
      title: '🌐 Guerra fría digital: EEUU vs China escala en Latinoamérica',
      body:  'Operaciones de ciberespionaje entre potencias globales se intensifican en la región. Argentina, nodo de telecomunicaciones del Cono Sur, se convierte en campo de batalla digital. El gobierno recibe presiones de ambos bloques. Filtraciones de ambos lados circulan en el underground latinoamericano.',
      tag:   'MUNDIAL',
      effects: {
        economy: { triggerEvent: 'political_scandal' },
        nodes:   { unlockType: 'government', count: 3 },
      },
      reactions: [
        'La embajada de EEUU desmiente espionaje. Wikileaks filtró lo contrario.',
        'China ofrece tecnología de vigilancia a cambio de acceso a infraestructura.',
        'El underground celebra: el caos genera oportunidades.',
      ],
    },

    ransomware_global: {
      id: 'ransomware_global',
      category: 'mundial',
      severity: 8,
      title: '💀 Ataque ransomware global infecta hospitales y bancos latinoamericanos',
      body:  'Un nuevo ransomware de origen desconocido paralizó sistemas en 23 países. En Argentina, 4 hospitales y 2 bancos regionales fueron afectados. La Unidad Cibercrimen está desbordada. Paradójicamente, esto genera una ventana de oportunidad para operadores silenciosos.',
      tag:   'BREACH',
      effects: {
        heat:  { heatModifier: -8 },
        nodes: { unlockType: 'hospital', count: 1 },
      },
      reactions: [
        'La UEC está totalmente enfocada en el ransomware. Calor policial reducido temporalmente.',
        'Hospitales pagan rescates en ZeroCoin y Bitcoin.',
        'El creador del ransomware ofrece "llave de descifrado" por $5M.',
      ],
    },
  };

  // ─── Generadores de noticias de víctimas ──────────────────────
  const VICTIM_TESTIMONIALS = [
    {
      type: 'medical_records',
      testimonials: [
        '"Me robaron mis historiales médicos. Ahora tengo miedo de que sepan sobre mi tratamiento de salud mental. Mi empleador podría enterarse." — María, 34, Buenos Aires',
        '"Mis estudios oncológicos están circulando en foros. No sé quién los tiene. Tengo terror de ser discriminada." — Claudia, 52, Rosario',
        '"Mi hijo tiene diabetes. Los datos de su insulina y visitas al médico están robados. Somos blancos fáciles ahora." — Padre anónimo, Córdoba',
      ],
    },
    {
      type: 'financial_data',
      testimonials: [
        '"Vaciaron mi cuenta. Ahorros de 10 años. Tenía que pagar la operación de mi madre." — Roberto, 41, Mendoza',
        '"Robaron los fondos del comedor comunitario. 200 pibes sin comer por esto." — Coordinadora de comedor, La Matanza',
        '"Mis datos bancarios aparecieron en el mercado negro. Tuve que cambiar todo y vivir meses con miedo." — Empleado, Santa Fe',
      ],
    },
    {
      type: 'customer_database',
      testimonials: [
        '"Empezaron a llamarme de números desconocidos. Saben mi nombre, dirección, todo. No me siento segura en casa." — Ana, 28, La Plata',
        '"Mi negocio familiar quebró porque filtraron nuestra lista de clientes a la competencia." — Comerciante, Tucumán',
        '"Me mandaron fotos mías de mi propia casa. Alguien sabe dónde vivo." — Víctor, 45, Salta',
      ],
    },
    {
      type: 'government_documents',
      testimonials: [
        '"Los documentos filtrados mostraron que el Estado tenía información de mi militancia política. Tengo miedo." — Activista anónimo',
        '"Mi padre fue mencionado en documentos de inteligencia filtrados. Recibimos amenazas." — Familiar de funcionario',
      ],
    },
  ];

  // ─── API pública ───────────────────────────────────────────────
  const API = {

    on(ev, cb) { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); },

    init() {
      // Lanzar un evento grande cada 10-25 minutos de juego
      const _schedule = () => {
        const delay = 600000 + Math.random() * 900000;
        setTimeout(() => {
          const keys = Object.keys(EVENT_CATALOG);
          const key  = keys[Math.floor(Math.random() * keys.length)];
          API.trigger(key);
          _schedule();
        }, delay);
      };
      // Primer evento más rápido (2-5 min)
      setTimeout(() => {
        API.trigger('kirchner_vialidad');
        _schedule();
      }, 120000 + Math.random() * 180000);

      console.log('[EventSystem] Inicializado.');
    },

    trigger(eventId) {
      const ev = EVENT_CATALOG[eventId];
      if (!ev) return false;

      const activeEvent = { ...ev, triggeredAt: Date.now() };
      _activeEvents.push(activeEvent);
      _history.push(activeEvent);
      if (_history.length > 30) _history.shift();

      _notify('event', activeEvent);

      // Notificar en UI
      if (window.UI) {
        UI.notify(`${ev.tag === 'BREACH' ? '🔴' : ev.tag === 'POLITICA' ? '🗳️' : '🌐'} ${ev.title}`, 'warning', 12000);
      }

      // Publicar en NewsSystem
      if (window.NewsSystem) {
        // Publicar noticia principal
        NewsSystem._injectEvent?.(ev) ?? NewsSystem.reportPlayerAction('DATA_BREACH', { target: ev.title, sensitivity: ev.severity });

        // Publicar reacciones
        const reactions = ev.reactions ?? [];
        const count = Math.min(2, reactions.length);
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            NewsSystem._injectReaction?.(reactions[i], ev.tag)
              ?? NewsSystem.reportPlayerAction('DATA_BREACH', { target: reactions[i], sensitivity: 5 });
          }, (i + 1) * 30000);
        }
      }

      // Aplicar efectos económicos
      if (ev.effects?.economy?.triggerEvent && window.EconomySystem) {
        EconomySystem.triggerEvent(ev.effects.economy.triggerEvent);
      }

      // Desbloquear nodos nuevos
      if (ev.effects?.nodes && window.NodeGenerator && window.NetworkSystem) {
        const { unlockType, count } = ev.effects.nodes;
        for (let i = 0; i < (count ?? 1); i++) {
          const net = NodeGenerator.generateNetwork(unlockType);
          if (window.NetworkSystem.addNodes) NetworkSystem.addNodes(net.all);
        }
        if (window.UI) UI.notify(`🌐 ${count ?? 1} nueva(s) organización(es) descubierta(s) en la red.`, 'info', 6000);
      }

      // Modificar heat global
      if (ev.effects?.heat?.heatModifier && window.ReputationSystem) {
        const mod = ev.effects.heat.heatModifier;
        if (mod > 0) ReputationSystem.addHeat(mod, 'world_event');
        else         ReputationSystem.reduceHeat(-mod, 'world_event');
      }

      // Mostrar en terminal
      if (window.GameLoop) {
        const t = GameLoop.getTerminal?.();
        if (t) {
          t.printBlank?.();
          t.printHTML?.(`<span style="color:var(--warn);font-family:var(--font-hud);">🌐 EVENTO MUNDIAL: ${ev.title}</span>`);
          t.printHTML?.(`<span style="color:var(--text-muted)">${ev.body.slice(0, 160)}...</span>`);
          t.printBlank?.();
        }
      }

      // Expirar evento después de 15 min
      setTimeout(() => {
        _activeEvents = _activeEvents.filter(e => e.id !== eventId);
        _notify('event_expired', activeEvent);
      }, 900000);

      return true;
    },

    getActiveEvents()  { return [..._activeEvents]; },
    getEventHistory()  { return [..._history]; },
    getCatalog()       { return EVENT_CATALOG; },

    /**
     * Devuelve un testimonio aleatorio de víctima para un tipo de dato.
     */
    getVictimTestimonial(dataType) {
      const pool = VICTIM_TESTIMONIALS.find(v => v.type === dataType);
      if (!pool) return null;
      const t = pool.testimonials;
      return t[Math.floor(Math.random() * t.length)];
    },
  };

  return API;
})();
