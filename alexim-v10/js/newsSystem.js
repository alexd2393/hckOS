/**
 * newsSystem.js — Sistema de Noticias Dinámicas — Argentina
 * AleXim OS — Hacking Narrative Game
 *
 * - Sin crashes: datos inline siempre disponibles
 * - Noticias dinámicas según acciones del jugador
 * - Ambientado en Argentina
 */

window.NewsSystem = (() => {
  'use strict';

  const CITIES = ['Buenos Aires','Rosario','Córdoba','Mendoza','La Plata','Mar del Plata','Tucumán','Salta','Santa Fe','Bahía Blanca'];
  const _city = () => CITIES[Math.floor(Math.random()*CITIES.length)];
  const _time = () => `${String(Math.floor(Math.random()*24)).padStart(2,'0')}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}`;

  const EVENT_TEMPLATES = {
    FINANCIAL_THEFT:     [()=>`Robo digital en sector financiero expone clientes en ${_city()}`, ()=>`Millonaria sustracción en billetera virtual afecta a usuarios de ${_city()}`],
    DATA_BREACH:         [()=>`Filtración masiva compromete a miles de usuarios en ${_city()}`,  ()=>`Brecha de seguridad expone DNI y domicilios en ${_city()}`],
    MEDICAL_DATA_THEFT:  [()=>`Robo de historiales clínicos en hospital privado de ${_city()}`,  ()=>`Datos médicos de pacientes de ${_city()} comprometidos`],
    CORPORATE_ESPIONAGE: [()=>`Empresa de ${_city()} denuncia robo de correos corporativos`,     ()=>`Espionaje industrial: documentos internos de firma argentina filtrados`],
    GOVERNMENT_BREACH:   [()=>`Hackeo a organismo estatal compromete documentos clasificados`,    ()=>`Ataque a infraestructura del gobierno genera alerta máxima`],
    DATA_SOLD_HIGH_VALUE:[()=>`Datos de alto valor aparecen en circulación en el mercado negro`,  ()=>`Operativo rastrea filtración activa de información sensible`],
    BREACH_DETECTED:     [()=>`Empresa de ${_city()} reporta intrusión tras actividad anómala`,  ()=>`Alerta de seguridad en organización de ${_city()} tras ataque externo`],
    HACKER_PROFILE:      [()=>`Unidad Cibercrimen perfila operador desconocido muy activo`,       ()=>`Fiscalía investiga serie de ataques a entidades de ${_city()}`],
    ISP_BREACH:          [()=>`Proveedor de internet confirma acceso no autorizado a sus sistemas`,()=>`TeleNet Argentina bajo investigación tras detectar fuga interna`],
    BANK_BREACH:         [()=>`Banco estatal activa protocolo de emergencia tras detectar intrusión`,()=>`Autoridades confirman ciberataque a infraestructura bancaria nacional`],
  };

  const EVENT_TAG = { FINANCIAL_THEFT:'MERCADO', DATA_BREACH:'BREACH', MEDICAL_DATA_THEFT:'BREACH', CORPORATE_ESPIONAGE:'BREACH', GOVERNMENT_BREACH:'GOB', DATA_SOLD_HIGH_VALUE:'MERCADO', BREACH_DETECTED:'BREACH', HACKER_PROFILE:'LEY', ISP_BREACH:'BREACH', BANK_BREACH:'BREACH' };

  const EVENT_BODY = {
    FINANCIAL_THEFT:     'Autoridades investigan la desaparición de fondos. El sector refuerza controles.',
    DATA_BREACH:         'Expertos confirman acceso no autorizado. Se recomienda cambiar contraseñas.',
    MEDICAL_DATA_THEFT:  'Especialistas advierten sobre fraudes de identidad. El hospital abrió consultas.',
    CORPORATE_ESPIONAGE: 'La empresa denunció penalmente el hecho y contrató forense digital.',
    GOVERNMENT_BREACH:   'El gobierno minimizó el alcance. Organismos de inteligencia están al tanto.',
    DATA_SOLD_HIGH_VALUE:'Datos de alta sensibilidad circulan activamente entre compradores especializados.',
    BREACH_DETECTED:     'Los sistemas comprometidos fueron aislados. La organización coopera con las autoridades.',
    HACKER_PROFILE:      'Analistas señalan un operador experimentado con acceso a herramientas avanzadas.',
    ISP_BREACH:          'El proveedor notificó a la Secretaría de Comunicaciones. Millones de usuarios afectados.',
    BANK_BREACH:         'El Banco Central emitió comunicación de alerta a todas las entidades financieras.',
  };

  const BG_STATIC = [
    {tag:'BREACH', title:'Hackeo masivo expone 4M de registros del ANSES',                      body:'Grupo desconocido publicó base de datos en foros underground.'},
    {tag:'LEY',    title:'Cibercrimen extiende vigilancia a IPs residenciales',                  body:'Ministerio autorizó inspección profunda de paquetes en ISPs nacionales.'},
    {tag:'MERCADO',title:'ZeroCoin sube 340% en el mercado paralelo argentino',                  body:'Criptomoneda anónima rompe récords ante inestabilidad del peso.'},
    {tag:'BREACH', title:'Filtración en hospital privado de Rosario expone 40.000 historiales',  body:'Registros médicos aparecieron en foro del mercado negro.'},
    {tag:'LEY',    title:'Arrestado hacker de 22 años por vulnerar sistema de becas universitarias',body:'La UEC lo detuvo en Lanús. Enfrenta hasta 8 años de prisión.'},
    {tag:'BREACH', title:'MegaCorp Argentina denuncia robo de documentos internos',              body:'La empresa confirmó acceso no autorizado y coopera con las autoridades.'},
    {tag:'LEY',    title:'Cuatro ISPs reciben orden de retener logs 90 días',                    body:'TeleNet y otros tres notificados bajo el nuevo marco de cibercrimen.'},
    {tag:'TECH',   title:'CONICET detecta intento de intrusión en servidores de datos científicos',body:'Sistemas aislados preventivamente. Origen del ataque bajo investigación.'},
    {tag:'MERCADO',title:'Pack de identidades falsas verificadas cotiza a CR 3.000 en la darknet',body:'El precio se triplicó luego del nuevo sistema biométrico del RENAPER.'},
    {tag:'LEY',    title:'Interpol desmantela red de cibercrimen con nexos en Argentina',        body:'18 detenidos en operativo conjunto. Se decomisaron equipos y criptos.'},
  ];

  let _feed = BG_STATIC.map((n,i)=>({...n,id:'bg_'+i,time:_time(),read:false,dynamic:false,ts:Date.now()-(BG_STATIC.length-i)*120000}));
  let _listeners = {};

  function _notify(ev,data){(_listeners[ev]||[]).forEach(cb=>{try{cb(data)}catch(e){}});}

  const API = {
    on(ev,cb){if(!_listeners[ev])_listeners[ev]=[];_listeners[ev].push(cb);},

    async init(){
      try{
        const r=await fetch('./data/news.json');
        if(r.ok){const d=await r.json();if(d.background)d.background.forEach((n,i)=>{if(!_feed.find(f=>f.title===n.title))_feed.push({...n,id:'ext_'+i,time:_time(),read:false,dynamic:false,ts:Date.now()-i*60000});});}
      }catch(e){/*silencioso*/}
      setInterval(()=>API._genBackground(),300000);
      console.log('[NewsSystem] OK — '+_feed.length+' noticias');
    },

    reportPlayerAction(eventType, ctx={}){
      const tpls=EVENT_TEMPLATES[eventType];
      if(!tpls) return null;
      const sensitivity=ctx.sensitivity??5;
      if(Math.random()>sensitivity/10) return null;
      const title=tpls[Math.floor(Math.random()*tpls.length)]();
      const body=EVENT_BODY[eventType]??'Incidente de ciberseguridad bajo investigación.';
      const tag=EVENT_TAG[eventType]??'TECH';
      const news={id:'dyn_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),time:_time(),tag,title,body,dynamic:true,read:false,ts:Date.now()};
      _feed.unshift(news);
      if(_feed.length>60)_feed.pop();
      _notify('news',news);
      window.dispatchEvent(new CustomEvent('news-update',{detail:{news}}));
      return news;
    },

    report(eventType,ctx={}){ return API.reportPlayerAction(eventType,ctx); },

    generateKarmaNews(state){
      const map={
        MONSTER:      {tag:'LEY',    title:"El 'Fantasma Digital' deja rastro de devastación en servidores argentinos",body:"Autoridades confirman que el hacker escaló operaciones más allá del lucro."},
        WHISTLEBLOWER:{tag:'GOB',    title:"Misterioso informante filtra documentos clasificados del estado",           body:"Hacker ético expuso corrupción. El público debate si es héroe o criminal."},
        EXPOSED:      {tag:'LEY',    title:"¿El Fantasma Digital fue identificado por la Unidad Cibercrimen?",          body:"Fuentes indican que las autoridades están cerca de una captura."},
        CRIMINAL:     {tag:'BREACH', title:"Ola de ataques coordinados sacude la infraestructura digital argentina",   body:"Analistas apuntan a un único operador. El Ministerio activa emergencia."},
      };
      const d=map[state]; if(!d) return;
      const news={...d,id:'karma_'+Date.now(),time:_time(),dynamic:true,read:false,ts:Date.now()};
      _feed.unshift(news);
      _notify('news',news);
      window.dispatchEvent(new CustomEvent('news-update',{detail:{news}}));
    },

    _genBackground(){
      const pool=[
        {tag:'MERCADO',title:`Dólar cripto: ZeroCoin toca nuevo máximo en Argentina`,body:'Analistas vinculan el aumento con mayor actividad en mercados anónimos.'},
        {tag:'LEY',    title:`Nueva resolución endurece penas por robo de datos`,    body:'Penas de hasta 12 años para quienes roben bases de datos sensibles.'},
        {tag:'BREACH', title:`Empresa de ${_city()} reporta ataque a sus sistemas`,  body:'Sin confirmación del alcance. Clientes notificados preventivamente.'},
        {tag:'LEY',    title:`Foro underground cierra por presión judicial`,          body:'Usuarios identificados en Argentina, México y España.'},
      ];
      const item=pool[Math.floor(Math.random()*pool.length)];
      const news={...item,id:'bg_dyn_'+Date.now(),time:_time(),dynamic:true,read:false,ts:Date.now()};
      _feed.unshift(news); if(_feed.length>60)_feed.pop();
      _notify('news',news);
    },

    // ── Métodos de inyección para EventSystem ─────────────────────
    _injectEvent(ev) {
      const TAG_MAP = { BREACH:'BREACH', LEY:'LEY', MERCADO:'MERCADO', TECH:'TECH', POLITICA:'POLITICA', MUNDIAL:'MUNDIAL', ECONOMIA:'ECONOMIA', VICTIMAS:'VICTIMAS' };
      const news = {
        id:      `event_${ev.id}_${Date.now()}`,
        time:    _time(),
        tag:     TAG_MAP[ev.tag] ?? 'TECH',
        title:   ev.title,
        body:    ev.body,
        dynamic: true,
        read:    false,
        ts:      Date.now(),
      };
      _feed.unshift(news);
      if (_feed.length > 80) _feed.pop();
      _notify('news', news);
      window.dispatchEvent(new CustomEvent('news-update', { detail: { news } }));
    },

    _injectReaction(text, tag) {
      const news = {
        id:      `react_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
        time:    _time(),
        tag:     tag ?? 'POLITICA',
        title:   text.slice(0, 80),
        body:    text,
        dynamic: true,
        read:    false,
        ts:      Date.now(),
      };
      _feed.unshift(news);
      _notify('news', news);
      window.dispatchEvent(new CustomEvent('news-update', { detail: { news } }));
    },

    _injectNews(news) {
      _feed.unshift({ ...news, dynamic: true });
      if (_feed.length > 80) _feed.pop();
      _notify('news', news);
      window.dispatchEvent(new CustomEvent('news-update', { detail: { news } }));
    },

    getNews(n=20){ return _feed.slice(0,n); },
    getAll()     { return[..._feed]; },
    get(f={}){let l=_feed;if(f.unreadOnly)l=l.filter(n=>!n.read);if(f.category)l=l.filter(n=>n.tag===f.category);return l.slice(0,f.limit??20);},
    markRead(id) { const n=_feed.find(n=>n.id===id);if(n)n.read=true; },
    impact()     { return _feed.filter(n=>n.dynamic).length; },
  };

  return API;
})();
