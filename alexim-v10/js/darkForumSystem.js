/**
 * darkForumSystem.js — Foros Clandestinos del DarkMarket
 * AleXim OS — Hacking Narrative Game
 *
 * Genera y gestiona los posts del foro underground del DarkMarket.
 * Reacciona a hackeos del jugador, eventos mundiales y estado del mercado.
 *
 * API:
 *   DarkForumSystem.init()
 *   DarkForumSystem.getPosts(limit)           → ForumPost[]
 *   DarkForumSystem.getThread(postId)         → ForumPost + replies[]
 *   DarkForumSystem.injectHackEvent(node)     → void
 *   DarkForumSystem.injectMarketEvent(type)   → void
 */

window.DarkForumSystem = (() => {
  'use strict';

  const _posts     = [];
  const _threads   = new Map();  // postId → replies[]
  let _listeners   = {};
  let _uidCounter  = 0;

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }
  function _uid()        { return 'dfp_' + (++_uidCounter) + '_' + Math.random().toString(36).slice(2,5); }
  function _rnd(arr)     { return arr[Math.floor(Math.random() * arr.length)]; }
  function _rndInt(a,b)  { return Math.floor(Math.random() * (b-a+1)) + a; }

  // ─── Identidades de foro ───────────────────────────────────────

  const FORUM_HANDLES = [
    'z3r0_day','n0xt4l','phant0m_ba','crypt0cr4ck','b1nary_ghost',
    'sombra_net','el_0rador','dark_gaucho','anon_pampa','r00tkit_ar',
    'null_byte_9x','bit_wolf','haxor_sur','underground_ba','cr4wler_99',
    'syn_fl00d','xpl0it_arg','d4ta_pirate','el_viejo_nodo','byte_bandit',
    'shadow_pmp','0x41_arg','kernel_panic_ar','netshad0w','ghostnet_ar',
  ];

  const FLAIR = {
    elite:  { label:'[ELITE]',  color:'var(--danger)' },
    vet:    { label:'[VET]',    color:'var(--warn)' },
    newbie: { label:'[NEW]',    color:'var(--text-muted)' },
    mod:    { label:'[MOD]',    color:'var(--accent)' },
    cop:    { label:'[???]',    color:'var(--text-dim)' },
  };

  // ─── Plantillas de posts iniciales ────────────────────────────

  const STATIC_POSTS = [
    {
      handle: 'z3r0_day', flair:'elite', tag:'VENTA',
      title:  'DB completa hospital La Plata — 14k registros',
      body:   'Dump fresco. Historias clínicas, medicamentos, datos de contacto. Precio por volumen. Solo cripto. PM serios.',
      replies:[
        { handle:'null_byte_9x', body:'Verificado. El mismo vendió una DB de Rosario el mes pasado. Confiable.' },
        { handle:'phantomghost', body:'Qué precio para el lote completo?' },
        { handle:'z3r0_day',     body:'1.8 ETH o equivalente en USDT. Sin regateo.' },
      ],
    },
    {
      handle: 'el_viejo_nodo', flair:'vet', tag:'INFO',
      title:  'Tutorial: evadir el nuevo WAF de AFIP',
      body:   'La actualización del miércoles cambió las reglas. Comparto el bypass que encontré. No es perfecto pero funciona para sec2. Leer bien los comentarios.',
      replies:[
        { handle:'b1nary_ghost', body:'Ya lo probé. Funciona en el 70% de los casos.' },
        { handle:'xpl0it_arg',   body:'Gracias viejo. Llevaba días peleando con eso.' },
      ],
    },
    {
      handle: 'crypt0cr4ck', flair:'vet', tag:'MERCADO',
      title:  'Análisis semanal: qué vale más esta semana',
      body:   'Gov docs siguen en alza por el escándalo político. Med records bajaron por sobreoferta. Las credentials de fintech siguen siendo el activo más líquido del mercado. Mi recomendación: enfocarse en fintech esta semana.',
      replies:[
        { handle:'sombra_net',   body:'Confirmo lo de gov docs. Tuve 3 compradores en las últimas 24h.' },
        { handle:'dark_gaucho',  body:'Alguien tiene demand activa para datos de ANSES?' },
        { handle:'crypt0cr4ck',  body:'No por ahora. Mucha oferta, poca demanda. Esperen.' },
      ],
    },
    {
      handle: 'anon_pampa', flair:'newbie', tag:'PREGUNTA',
      title:  'Primera vez acá. Cómo arranco?',
      body:   'Tengo acceso a una red corporativa. ¿Qué me conviene bajar primero? ¿Cómo funciona el mercado acá?',
      replies:[
        { handle:'el_viejo_nodo', body:'Lee el sticky primero. Y nunca, NUNCA, vendas antes de tener VPN activa. RIP a los que no leen.' },
        { handle:'z3r0_day',      body:'El consejo del viejo es bueno. También: descarga logs de red antes que nada. Bajo heat, buen precio inicial.' },
        { handle:'crypt0cr4ck',   body:'Y no vendas todo junto. Satura el mercado y bajas tu propio precio.' },
      ],
    },
    {
      handle: 'netshad0w', flair:'vet', tag:'ALERTA',
      title:  'CUIDADO: Perfil falso de posible UEC en circulación',
      body:   'Un perfil nuevo está contactando gente para "negocios". Demasiado amable, ofrece precio fijo sin negociar. Todas las señales de agente encubierto. No respondan.',
      replies:[
        { handle:'byte_bandit',  body:'Gracias por el aviso. Vi ese perfil. Muy sospechoso el tipo.' },
        { handle:'null_byte_9x', body:'Reportarlo y ignorar. Siempre hay uno en cada forum.' },
        { handle:'netshad0w',    body:'Exacto. No es el primero, no será el último. Stay safe.' },
      ],
    },
    {
      handle: 'r00tkit_ar', flair:'elite', tag:'VENTA',
      title:  'Credenciales bancarias bulk — Banco Galicia, Macro, Brubank',
      body:   '500 pares user/pass verificados. 40% con saldo > $50k pesos. Metodología propia, tasa de éxito 85%. Precio final único, no se divide.',
      replies:[
        { handle:'ghost_pamp',  body:'Tienen fecha de dump? Las viejas de más de 2 semanas no sirven.' },
        { handle:'r00tkit_ar',  body:'Todas de ayer y anteayer. Están calientes.' },
      ],
    },
    {
      handle: 'kernel_panic_ar', flair:'mod', tag:'REGLAS',
      title:  'Recordatorio de reglas del foro',
      body:   'No scams. No beefing público. Los disputas se resuelven con los mods. Los rippers se banean sin aviso. Los que traen heat policial también. Moderar esto es trabajo no pago, respeten.',
      replies:[
        { handle:'xpl0it_arg',  body:'Bancamos. El último scammer se bancó un ban de por vida.' },
        { handle:'sombra_net',  body:'+1. Foro limpio = todos ganamos.' },
      ],
    },
    {
      handle: 'dark_gaucho', flair:'vet', tag:'DEBATE',
      title:  'Debate: ¿vale la pena hackear hospitales?',
      body:   'El dinero es real pero el heat es alto y encima algunos acá tienen familia que usa esos sistemas. Yo personalmente ya no toco médicos. Debate abierto.',
      replies:[
        { handle:'z3r0_day',      body:'Yo tampoco. No por moral, sino porque la presión policial post-filtración médica es enorme. No vale.' },
        { handle:'b1nary_ghost',  body:'Banco la postura. Hay suficiente objetivo corporativo sin afectar salud.' },
        { handle:'crypt0cr4ck',   body:'Los médicos pagan 3x. Cada uno decide con su conciencia.' },
        { handle:'el_viejo_nodo', body:'En 12 años en esto, nunca toqué un hospital. No es miedo, es principio.' },
      ],
    },
  ];

  // ─── Plantillas reactivas al jugador ──────────────────────────

  const HACK_REACTIONS = {
    CORPORATE: [
      (org,h) => ({ tag:'INFO',   title:`Reporte: hackeo a ${org}`, body:`Confirmado hackeo a ${org}. Datos en circulación. Precios para ese tipo subiendo. Quién tiene material?` }),
      (org,h) => ({ tag:'VENTA',  title:`Material fresco de ${org}`, body:`Tengo datos recién salidos de ${org}. Contáctenme para precio. Solo serios. @${h}` }),
      (org,h) => ({ tag:'ALERTA', title:`Sospechoso activo en ${org}`, body:`Alguien está moviendo bastante material de ${org}. Si el operador es nuevo, cuidado con cómo mueven eso, la empresa ya sabe del breach.` }),
    ],
    BANK: [
      (org,h) => ({ tag:'HOT',    title:`🔥 BANCO HACKEADO: ${org}`, body:`Material de ${org} en el mercado. Esto va a levantar mucho heat. Trabajen rápido o guárdenlo. Los bancos activan la UEC al instante.` }),
      (org,h) => ({ tag:'VENTA',  title:`Cuentas de ${org} disponibles`, body:`Tengo acceso verificado a cuentas de ${org}. Saldo > $100k promedio. Precio por cuenta. DM.` }),
    ],
    GOVERNMENT: [
      (org,h) => ({ tag:'🔥HOT',  title:`GOBIERNO HACKEADO — ${org}`, body:`El operativo contra ${org} es real. Tengo confirmación de múltiples fuentes. Este material va a hacer estallar la prensa. Precios al máximo.` }),
      (org,h) => ({ tag:'INFO',   title:`Documentos de ${org} en circulación`, body:`Alguien tuvo los huevos de hackear ${org}. El material ya está circulando. UEC activa, mucho cuidado.` }),
    ],
    RESEARCH: [
      (org,h) => ({ tag:'VENTA',  title:`Investigación de ${org} disponible`, body:`Datos de investigación de ${org}. Compradores internacionales. Alta demanda, buen precio. Solo crypto.` }),
    ],
    DEFAULT: [
      (org,h) => ({ tag:'INFO',   title:`Hackeo reportado: ${org}`, body:`Alguien pasó por ${org} hace poco. Material en el mercado. Usual actividad post-breach.` }),
    ],
  };

  const MARKET_EVENTS = {
    financial_crisis: [
      { tag:'HOT',    title:'Crisis financiera: precios al máximo', body:'Con la crisis económica, los datos financieros valen el doble o más. Si tienen material en stock, es hora de venderlo.' },
    ],
    political_scandal: [
      { tag:'DEBATE', title:'El escándalo político beneficia el mercado', body:'Gov docs están por las nubes. Si tienen material gubernamental durmiendo, este es el momento.' },
    ],
    health_crisis: [
      { tag:'ALERTA', title:'Cuidado con el heat post-crisis sanitaria', body:'La UEC está activa por el tema de salud. Los que tienen medical records: esperen o vendan muy discreto.' },
    ],
  };

  // ─── Creación de posts ─────────────────────────────────────────

  function _createPost(data) {
    const postId   = _uid();
    const handle   = data.handle || _rnd(FORUM_HANDLES);
    const flairKey = data.flair  || _rnd(['vet','vet','newbie','newbie','elite']);
    const post = {
      id:        postId,
      handle,
      flair:     FLAIR[flairKey] || FLAIR.vet,
      tag:       data.tag    || 'INFO',
      title:     data.title,
      body:      data.body,
      replies:   data.replies || [],
      votes:     _rndInt(5, 280),
      views:     _rndInt(50, 2000),
      timestamp: data.timestamp || (Date.now() - _rndInt(0, 86400000)),
      isNew:     false,
    };
    _posts.unshift(post);
    if (_posts.length > 200) _posts.pop();
    _threads.set(postId, post.replies);
    window.dispatchEvent(new CustomEvent('darkforum-update', { detail: post }));
    _notify('post_added', post);
    return post;
  }

  // ─── Generar foro inicial ──────────────────────────────────────

  function _generateInitialForum() {
    STATIC_POSTS.forEach(p => {
      _createPost({
        ...p,
        timestamp: Date.now() - _rndInt(3600000, 604800000),  // 1h–7d atrás
      });
    });
    _posts.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ─── Posts periódicos ──────────────────────────────────────────

  function _startPeriodicPosts() {
    setInterval(() => {
      if (Math.random() > 0.4) return; // 60% de chance cada tick
      const handle  = _rnd(FORUM_HANDLES);
      const generic = [
        { tag:'INFO',   title:'Tip del día: siempre VPN antes de scan', body:'Básico pero lo digo igual porque sigo viendo operadores descuidados. El heat se acumula más rápido de lo que creen.' },
        { tag:'DEBATE', title:'¿Cuál es el mejor tipo de dato para vender?', body:'Mi ranking personal: 1) Gov docs en tiempo de escándalo 2) Financial en crisis 3) Medical para compradores correctos. El resto es volumen.' },
        { tag:'VENTA',  title:'Servicio de limpieza de heat — precios razonables', body:'Si su heat está alto y no quieren pagar el cleaner, tengo contactos. PM con niveles actuales y presupuesto.' },
        { tag:'INFO',   title:'Nuevo nodo detectado en la red', body:'Hay un nodo nuevo activo que no estaba en los mapas habituales. Alguien que lo explore y reporte. El primero que llega, se lleva el material.' },
        { tag:'ALERTA', title:'Actividad inusual de la UEC esta semana', body:'Según mis fuentes, la Unidad Especial estuvo activa rastreando operaciones grandes. Si hicieron algo gordo esta semana, bajen el perfil.' },
      ];
      _createPost({ ..._rnd(generic), handle, timestamp: Date.now(), isNew: true });
    }, _rndInt(120000, 300000)); // cada 2-5 min
  }

  // ─── API Pública ───────────────────────────────────────────────

  const API = {

    on(ev, cb) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(cb);
    },

    init() {
      _generateInitialForum();
      _startPeriodicPosts();

      // Escuchar breaches de red
      window.addEventListener('alexim-breach', e => {
        const node = e.detail?.node;
        if (node) API.injectHackEvent(node);
      });

      // Escuchar eventos económicos
      window.addEventListener('economy-event', e => {
        const type = e.detail?.type;
        if (type) API.injectMarketEvent(type);
      });

      console.log(`[DarkForumSystem] Foro inicializado. ${_posts.length} posts.`);
    },

    getPosts(limit = 50) {
      return _posts.slice(0, limit);
    },

    getThread(postId) {
      const post = _posts.find(p => p.id === postId);
      if (!post) return null;
      return { ...post, replies: _threads.get(postId) || [] };
    },

    getNewPosts() {
      return _posts.filter(p => p.isNew);
    },

    clearNew() {
      _posts.forEach(p => { p.isNew = false; });
    },

    /**
     * Inyecta post cuando el jugador hackea un nodo.
     * Llamado por network.js o worldConnector.
     */
    injectHackEvent(node) {
      if (!node) return;
      const orgName  = node.hostname || 'entidad desconocida';
      const nodeType = node.type || 'DEFAULT';
      const reactions = HACK_REACTIONS[nodeType] || HACK_REACTIONS.DEFAULT;
      const tpl      = _rnd(reactions);
      const data     = tpl(orgName, _rnd(FORUM_HANDLES));

      setTimeout(() => {
        _createPost({ ...data, handle: _rnd(FORUM_HANDLES), timestamp: Date.now(), isNew: true });
      }, _rndInt(15000, 60000)); // delay realista: 15-60 segundos
    },

    /**
     * Inyecta post cuando ocurre un evento económico/mundial.
     */
    injectMarketEvent(eventType) {
      const posts = MARKET_EVENTS[eventType];
      if (!posts) return;
      const data = _rnd(posts);
      setTimeout(() => {
        _createPost({ ...data, handle: _rnd(FORUM_HANDLES), timestamp: Date.now(), isNew: true });
      }, _rndInt(30000, 90000));
    },

    /**
     * Añade una respuesta a un thread existente.
     */
    addReply(postId, replyBody) {
      const replies = _threads.get(postId);
      if (!replies) return;
      replies.push({ handle: _rnd(FORUM_HANDLES), body: replyBody, timestamp: Date.now() });
      window.dispatchEvent(new CustomEvent('darkforum-update', { detail: { postId } }));
    },

    count() { return _posts.length; },
  };

  return API;
})();
