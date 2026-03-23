/**
 * socialContentGenerator.js — Generador de Contenido para NodoSocial
 * AleXim OS — Hacking Narrative Game
 *
 * Genera publicaciones procedurales de ciudadanos argentinos.
 * Reacciona a los hackeos del jugador con posts de víctimas.
 *
 * API:
 *   SocialContentGenerator.init()
 *   SocialContentGenerator.getFeed(limit)         → Post[]
 *   SocialContentGenerator.getPostsFor(personId)  → Post[]
 *   SocialContentGenerator.generateVictimPost(person, dataType) → Post
 *   SocialContentGenerator.injectPoliceProfile()  → Person (agente encubierto)
 */

window.SocialContentGenerator = (() => {
  'use strict';

  const _posts    = [];   // todos los posts
  const _byPerson = new Map();
  let   _feedTimer = null;
  let   _listeners = {};

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }
  function _rnd(arr)         { return arr[Math.floor(Math.random() * arr.length)]; }
  function _rndInt(a, b)     { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function _timeAgo(msAgo)   {
    const m = Math.floor(msAgo / 60000);
    if (m < 1)  return 'ahora';
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    return `hace ${Math.floor(h/24)}d`;
  }

  // ─── Plantillas de publicaciones normales ─────────────────────

  const TEMPLATES_NORMAL = [
    // Vida cotidiana
    p => `Otro lunes en ${p.city} 😮‍💨 alguien que me mande un café`,
    p => `Después de ${_rndInt(5,15)} años en ${p.job.toLowerCase()}, sigo aprendiendo algo nuevo todos los días`,
    p => `Fin de semana de asado con la familia en ${p.city} ❤️🔥`,
    p => `Se me rompió el celular justo antes de cobrar. Perfecto timing 😭`,
    p => `Buenos días desde ${p.city}. El mate ya está listo.`,
    p => `Recordatorio de que la inflación en Argentina no da respiro. Otro mes a pulmón`,
    p => `Cumpleaños de mi mamá hoy. 65 años y más activa que yo 🎂`,
    p => `Por fin cerré el proyecto. ${p.job} mode ON desde el lunes`,

    // Trabajo
    p => `Buscamos ${_rnd(['desarrolladores','diseñadores','vendedores'])} para ${p.orgName || 'nuestra empresa'} en ${p.city}. DM abiertos. CV a ${p.email}`,
    p => `Reunión de equipo a las 9. El wifi de la oficina haciéndose el muerto 🙄`,
    p => `Orgullosa/o de anunciar que llevo ya 3 años en ${p.orgName || 'la empresa'}. Gracias a todo el equipo ✨`,
    p => `Alerta: el sistema de ${p.orgName || 'la empresa'} caído desde las 8am. IT diciendo que "están trabajando en ello" 🙃`,

    // Política argentina
    p => `No importa quién gobierne, la clase media siempre la paga 😤 #Argentina`,
    p => `El dólar otra vez. Esta gente no aprende. #EconomíaArgentina`,
    p => `El peronismo o no el peronismo... mientras tanto el alquiler no baja`,
    p => `Con Milei o sin Milei, el bolsillo sigue igual de flaco`,
    p => `Paro general la semana que viene. Preparense. #CGT`,

    // Banco / finanzas
    p => p.bankAccount ? `El banco me cobró comisión hasta por respirar este mes 😤` : `Sigo sin cuenta bancaria, el efectivo sigue siendo el rey`,
    p => `Cuidado con las estafas por WhatsApp haciéndose pasar por el banco. A mi hermano le vaciaron la cuenta así`,
    p => `Al fin pude ahorrar algo en dólares. Pequeño logro en este país 🙌`,
    p => p.cryptoWallet ? `Metiendo algunas sats en la billetera cripto. A largo plazo, gente 📈` : `No entiendo nada de cripto pero todos me dicen que compre`,

    // Vida social con datos útiles
    p => `Abrimos nuestro local en ${p.city}! Reservas al ${p.phone} 🎉`,
    p => `Alquilo departamento en ${p.city}, zona ${_rnd(['centro','palermo','belgrano','once','flores','recoleta','caballito'])}. Contacto: ${p.personalEmail}`,
    p => `¿Alguien conoce un buen ${_rnd(['mecánico','plomero','electricista','contador','abogado'])} en ${p.city}? Pregunto para un amigo`,
    p => `Viajé a ${_rnd(['Mendoza','Bariloche','Salta','Mar del Plata','Iguazú','El Calafate'])} el fin de semana. Qué hermoso país cuando no pensás en la economía`,
  ];

  const TEMPLATES_POLITICA = [
    p => `Hoy en el Congreso: otro día, otra discusión. Mientras tanto nosotros sobreviviendo #Política`,
    p => `La inflación llegó al supermercado antes que el sueldo. Como siempre #ArgentinaRota`,
    p => `¿Alguien más siente que vota cada 4 años para lo mismo? Pregunto por un amigo`,
    p => `El kirchnerismo dice X. El macrismo dice Y. El sueldo sigue siendo Z (negativo)`,
  ];

  // ─── Plantillas de víctimas (post-hackeo) ─────────────────────

  const VICTIM_TEMPLATES = {
    financial_data: [
      p => `URGENTE: me acaban de vaciar la cuenta del ${p.orgName || 'banco'}. Estoy en shock. Era la plata del alquiler. ¿Alguien sabe qué hacer? 😭`,
      p => `Me robaron los datos financieros. Compras que yo no hice. El banco dice que "no corresponde reintegro". No tengo palabras.`,
      p => `ALERTA para clientes de ${p.orgName || 'la entidad'}: hay una filtración masiva. A mi me vaciaron la caja de ahorro. Denuncien todo.`,
    ],
    credentials: [
      p => `Me hackearon todas las cuentas. Email, Instagram, el homebanking. Cambien sus contraseñas si usaban ${p.orgName || 'el mismo servicio'}.`,
      p => `Alguien entró a mis cuentas desde una IP de otro país. Estoy bloqueando todo. Cuídense.`,
      p => `Me suplantaron la identidad online. Enviaron mails a mis contactos pidiendo plata en mi nombre. Esto es un infierno.`,
    ],
    medical_records: [
      p => `Filtran datos médicos del ${p.orgName || 'hospital'}. Mi historia clínica, medicamentos, todo expuesto. Esto es una violación brutal a la privacidad.`,
      p => `Me avisaron que mis datos del ${p.orgName || 'sanatorio'} están en la dark web. No dormí en toda la noche.`,
      p => `Pacientes de ${p.orgName || 'la clínica'}: cuiden sus datos. Hay una filtración activa. Contacten a la administración.`,
    ],
    customer_database: [
      p => `Recibo phishing usando datos exactos míos: nombre, dirección, teléfono. Alguien filtró la base de ${p.orgName || 'la empresa'}.`,
      p => `Me llaman por mi nombre y saben todo de mí. La base de datos de ${p.orgName || 'la empresa'} está en manos de criminales.`,
      p => `Cuidado con llamadas de supuestos empleados de ${p.orgName || 'la compañía'}. Los datos de clientes fueron robados.`,
    ],
    government_documents: [
      p => `Filtran documentos internos del gobierno. Esto va a explotar. #Escándalo`,
      p => `La información de mis trámites en ${p.orgName || 'el organismo'} está comprometida. ¿Qué hacemos los ciudadanos?`,
      p => `Mi DNI, domicilio y datos tributarios en la dark web. El Estado no protege a nadie. Qué vergüenza.`,
    ],
    default: [
      p => `Fui víctima de un ciberataque. Por favor, si trabajás en ${p.orgName || 'el sector digital'}, denuncien esto.`,
      p => `Me robaron datos personales. Teléfono, mail, dirección. Si me escriben desde mi nombre, no soy yo.`,
      p => `Alerta a todos los contactos: hackeo masivo en ${p.orgName || 'la empresa donde trabajo'}.`,
    ],
  };

  // Plantillas de policías encubiertos
  const COP_POSTS = [
    h => `Nuevo en el mundillo. Buscando gente para negocios digitales. $$ sin preguntas. DM. #underworld #hacker`,
    h => `Tengo acceso a herramientas especiales. Primeras 5 consultas gratis. Precio por misión. Escribime.`,
    h => `Escuché del hackeo a ${h || 'esa entidad'}. Conozco gente que paga bien por esa info. Serios.`,
  ];

  // ─── Crear un post ─────────────────────────────────────────────

  function _createPost(person, templateFn, type = 'normal', extraData = {}) {
    const postId = 'post_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,5);
    const content = templateFn(person);
    const post = {
      id:        postId,
      personId:  person.id,
      author:    person.fullName,
      handle:    person.socialMedia?.handle || `@${person.name.toLowerCase()}`,
      city:      person.city,
      content,
      type,      // normal | victim | cop | political
      timestamp: Date.now() - _rndInt(0, 7200000),  // hasta 2h atrás
      likes:     _rndInt(0, 340),
      comments:  _rndInt(0, 45),
      shares:    _rndInt(0, 20),
      read:      false,
      ...extraData,
    };

    _posts.unshift(post);
    if (_posts.length > 500) _posts.pop();

    if (!_byPerson.has(person.id)) _byPerson.set(person.id, []);
    _byPerson.get(person.id).unshift(post);

    window.dispatchEvent(new CustomEvent('nodo-social-update', { detail: post }));
    return post;
  }

  // ─── Generar feed inicial ──────────────────────────────────────

  function _generateInitialFeed() {
    const people = window.PersonGenerator?.getAll?.() || [];
    if (people.length === 0) return;

    // Intentar con personas que tienen NodoSocial activo
    let active = people.filter(p => p.socialMedia?.nodoSocial);
    // Fallback: si nadie tiene nodoSocial, usar todos
    if (active.length === 0) active = people;

    const sample = active.sort(() => Math.random() - 0.5).slice(0, Math.min(30, active.length));

    sample.forEach(person => {
      const numPosts = _rndInt(1, 3);
      for (let i = 0; i < numPosts; i++) {
        const tpl = _rnd([...TEMPLATES_NORMAL, ...TEMPLATES_POLITICA]);
        _createPost(person, tpl, 'normal');
      }
    });

    // Mezclar timestamps para que el feed parezca orgánico
    _posts.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ─── Generar posts periódicos ──────────────────────────────────

  function _startLiveFeed() {
    _feedTimer = setInterval(() => {
      const people = window.PersonGenerator?.getAll?.() || [];
      const active = people.filter(p => p.socialMedia?.nodoSocial && !p.victimized);
      if (active.length === 0) return;

      const person = _rnd(active);
      const tpl    = _rnd(TEMPLATES_NORMAL);
      _createPost(person, tpl, 'normal');
    }, _rndInt(25000, 90000)); // nuevo post cada 25-90 segundos
  }

  // ─── API Pública ───────────────────────────────────────────────

  const API = {

    on(ev, cb) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(cb);
    },

    init() {
      _generateInitialFeed();
      _startLiveFeed();

      // Reaccionar a victimizaciones
      if (window.PersonGenerator) {
        PersonGenerator.on('victimized', ({ person, dataType }) => {
          API.generateVictimPost(person, dataType);
        });
      }

      // Reaccionar a heat alto → policía crea perfil falso
      if (window.ReputationSystem) {
        ReputationSystem.on('heat', heat => {
          if (heat > 75 && Math.random() > 0.7) {
            API.injectPoliceProfile();
          }
        });
      }

      console.log(`[SocialContentGenerator] Feed inicializado. ${_posts.length} posts.`);

      // Notificar a la app NodoSocial que puede renderizarse ahora
      window.dispatchEvent(new CustomEvent('nodosocial-ready', { detail: { count: _posts.length } }));
    },

    getFeed(limit = 50) {
      return _posts.slice(0, limit);
    },

    getPostsFor(personId) {
      return _byPerson.get(personId) || [];
    },

    getUnread(limit = 20) {
      return _posts.filter(p => !p.read).slice(0, limit);
    },

    markRead(postId) {
      const p = _posts.find(p => p.id === postId);
      if (p) p.read = true;
    },

    /**
     * Genera post de víctima reactivo al hackeo del jugador.
     */
    generateVictimPost(person, dataType) {
      if (!person.socialMedia?.nodoSocial) return null;

      const templates = VICTIM_TEMPLATES[dataType] || VICTIM_TEMPLATES.default;
      const post = _createPost(person, _rnd(templates), 'victim', {
        timestamp: Date.now(),
        likes:     _rndInt(80, 800),   // más engagement que post normal
        comments:  _rndInt(30, 200),
      });

      // Notificar al jugador
      if (window.UI) {
        setTimeout(() => {
          UI.notify(`📢 ${person.fullName} publicó en NodoSocial sobre el hackeo`, 'warning', 8000);
        }, _rndInt(15000, 60000));
      }

      // Subir heat si hay muchas víctimas
      if (window.ReputationSystem) {
        ReputationSystem.addHeat(3, 'social_victim_post');
      }

      return post;
    },

    /**
     * Inyecta un perfil policial encubierto al feed cuando heat > 75.
     * El agente intenta hacer contacto con el jugador.
     */
    injectPoliceProfile() {
      const fakePerson = {
        id:       'cop_' + Date.now().toString(36),
        fullName: _rnd(['Marco Vidal','Diego Salazar','Ramiro Fuentes','Esteban Coria','Luis Mendez']),
        name:     _rnd(['Marco','Diego','Ramiro','Esteban','Luis']),
        city:     _rnd(['Buenos Aires','Córdoba','Rosario']),
        socialMedia: { nodoSocial: true, handle: `@${Math.random().toString(36).slice(2,10)}` },
        orgName:  'UEC - Encubierto',
        isCop:    true,
      };

      const lastHackedOrg = window.NetworkSystem?.getKnownNodes?.()
        ?.filter(n => window.NetworkSystem.isBreached?.(n.ip))
        ?.slice(-1)?.[0]?.hostname || 'esa entidad';

      const tpl = _rnd(COP_POSTS);
      const post = _createPost(fakePerson, () => tpl(lastHackedOrg), 'cop', {
        timestamp: Date.now(),
        likes:     _rndInt(5, 30),
      });

      if (window.UI) {
        setTimeout(() => {
          UI.notify('⚠ Actividad sospechosa en NodoSocial — posible agente encubierto', 'error', 10000);
        }, 30000);
      }

      return post;
    },

    /**
     * Inyecta un post específico (por sistemas externos).
     */
    injectPost(person, content, type = 'event') {
      return _createPost(person, () => content, type, { timestamp: Date.now() });
    },

    getTimeAgo: _timeAgo,
    count()    { return _posts.length; },
  };

  return API;
})();
