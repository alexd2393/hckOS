/**
 * personGenerator.js — Generador Procedural de Ciudadanos Digitales Argentinos
 * AleXim OS — Hacking Narrative Game
 *
 * Genera ciudadanos con perfiles completos conectados a las organizaciones del juego.
 * Cada partida genera un mundo diferente.
 *
 * API:
 *   PersonGenerator.generate(count)         → Person[]
 *   PersonGenerator.getForOrg(orgName)       → Person[]
 *   PersonGenerator.getById(id)              → Person
 *   PersonGenerator.getAll()                 → Person[]
 *   PersonGenerator.generateForNode(node)    → Person[]
 */

window.PersonGenerator = (() => {
  'use strict';

  // ─── Datos de Argentina ────────────────────────────────────────

  const NOMBRES_M = [
    'Martín','Carlos','Diego','Lucas','Nicolás','Sebastián','Facundo',
    'Alejandro','Gonzalo','Federico','Matías','Pablo','Damián','Hernán',
    'Gustavo','Roberto','Eduardo','Ricardo','Mario','Claudio','Ignacio',
    'Santiago','Tomás','Agustín','Ramiro','Ezequiel','Leandro','Marcelo',
    'Fernando','Cristian','Rodrigo','Emanuel','Gerardo','Daniel','Julio',
  ];
  const NOMBRES_F = [
    'Lucía','María','Valentina','Florencia','Camila','Daniela','Sofía',
    'Natalia','Paula','Jimena','Verónica','Gabriela','Claudia','Patricia',
    'Mariana','Agustina','Romina','Celeste','Valeria','Alejandra','Sabrina',
    'Vanesa','Micaela','Paola','Susana','Carolina','Elisa','Rocío','Noelia',
    'Silvina','Lorena','Graciela','Elena','Beatriz','Magalí','Tamara',
  ];
  const APELLIDOS = [
    'González','Rodríguez','García','Fernández','López','Martínez','Pérez',
    'Gómez','Sánchez','Romero','Sosa','Torres','Álvarez','Ruiz','Ramírez',
    'Flores','Acosta','Medina','Aguilar','Suárez','Herrera','Molina','Pereyra',
    'Cabrera','Ríos','Leiva','Gutiérrez','Benítez','Castro','Morales','Ortiz',
    'Silva','Ramos','Vega','Figueroa','Luna','Delgado','Reyes','Ponce','Bravo',
    'Varela','Montes','Leguizamón','Quiroga','Salgado','Blanco','Mansilla',
  ];
  const CIUDADES = [
    { name:'Buenos Aires',   area:'CABA',      code:'011' },
    { name:'Córdoba',        area:'Córdoba',    code:'0351' },
    { name:'Rosario',        area:'Santa Fe',   code:'0341' },
    { name:'Mendoza',        area:'Mendoza',    code:'0261' },
    { name:'La Plata',       area:'Buenos Aires',code:'0221' },
    { name:'Mar del Plata',  area:'Buenos Aires',code:'0223' },
    { name:'Tucumán',        area:'Tucumán',    code:'0381' },
    { name:'Salta',          area:'Salta',      code:'0387' },
    { name:'Santa Fe',       area:'Santa Fe',   code:'0342' },
    { name:'San Juan',       area:'San Juan',   code:'0264' },
    { name:'Resistencia',    area:'Chaco',      code:'0362' },
    { name:'Neuquén',        area:'Neuquén',    code:'0299' },
    { name:'Bahía Blanca',   area:'Buenos Aires',code:'0291' },
    { name:'Posadas',        area:'Misiones',   code:'0376' },
    { name:'Paraná',         area:'Entre Ríos', code:'0343' },
  ];

  // Profesiones por tipo de organización
  const JOBS_BY_ORG = {
    bank:       ['Analista Financiero','Cajero','Gerente de Sucursal','Asesor de Inversiones','Desarrollador Backend','Especialista en Compliance','Oficial de Crédito','Analista de Riesgo'],
    hospital:   ['Médico Clínico','Enfermero/a','Administrador Hospitalario','Médico Cirujano','Radiólogo','Farmacéutico','Recepcionista','Técnico en Laboratorio','Kinesiólogo'],
    university: ['Docente','Investigador','Administrativo','Secretario Académico','Rector Auxiliar','Coordinador IT','Bibliotecario','Técnico de Sistemas'],
    logistics:  ['Repartidor','Supervisor de Depósito','Coordinador Logístico','Chofer','Analista de Operaciones','Despachante','Encargado de Turno'],
    fintech:    ['Desarrollador Full Stack','Product Manager','Analista de Datos','DevOps Engineer','Diseñador UX','Growth Hacker','Customer Success','Compliance Officer'],
    government: ['Funcionario Público','Administrativo','Director de Área','Asesor Técnico','Coordinador','Inspector','Secretario de Despacho'],
    media:      ['Periodista','Editor Digital','Community Manager','Camarógrafo','Presentador','Corrector','Analista SEO','Fotógrafo'],
    startup:    ['CEO','CTO','Desarrollador Frontend','Diseñadora UX','Marketing Manager','Inversor Ángel','Scrum Master','Data Scientist'],
    generic:    ['Comerciante','Maestro','Contador','Abogado','Arquitecto','Psicólogo','Dentista','Plomero','Electricista','Empleado Administrativo','Vendedor','Autónomo'],
  };

  const INTERESES = [
    'fútbol','política','cocina','viajes','música','lectura','cine','tecnología',
    'fitness','gaming','fotografía','arte','teatro','yoga','running','ciclismo',
    'Boca','River','San Lorenzo','Racing','Independiente','Estudiantes',
  ];

  const DOMINIOS_EMAIL = [
    'gmail.com','hotmail.com','outlook.com','yahoo.com.ar','fibertel.com.ar',
    'speedy.com.ar','arnet.com.ar','personal.com.ar','icloud.com',
  ];

  // ─── Estado interno ────────────────────────────────────────────
  let _people     = new Map();   // id → Person
  let _byOrg      = new Map();   // orgName → Person[]
  let _byCity     = new Map();   // city → Person[]
  let _listeners  = {};
  let _uidCounter = 0;

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function _uid() {
    return 'per_' + (++_uidCounter) + '_' + Math.random().toString(36).slice(2,5);
  }

  function _rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _rndInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // ─── Generación de datos individuales ─────────────────────────

  function _genPhone(code) {
    const n1 = _rndInt(1000, 9999);
    const n2 = _rndInt(1000, 9999);
    return `${code} ${n1}-${n2}`;
  }

  function _genEmail(name, surname, domain) {
    const normalizado = (s) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,'.');
    const variants = [
      `${normalizado(name)}.${normalizado(surname)}`,
      `${normalizado(name)}${normalizado(surname).slice(0,3)}`,
      `${normalizado(surname)}.${normalizado(name).slice(0,1)}`,
      `${normalizado(name)}${_rndInt(10,999)}`,
    ];
    return `${_rnd(variants)}@${domain}`;
  }

  function _securityLevel(job) {
    const high = ['Desarrollador','DevOps','CTO','Analista de Datos','Especialista'];
    const mid  = ['Gerente','Director','Manager','Coordinador','Oficial'];
    const str  = job.toLowerCase();
    if (high.some(k => str.includes(k.toLowerCase()))) return _rndInt(3,5);
    if (mid.some(k  => str.includes(k.toLowerCase()))) return _rndInt(2,4);
    return _rndInt(1,3);
  }

  // ─── Generador principal ───────────────────────────────────────

  function _createPerson(overrides = {}) {
    const isMale  = Math.random() > 0.5;
    const name    = isMale ? _rnd(NOMBRES_M) : _rnd(NOMBRES_F);
    const surname = _rnd(APELLIDOS);
    const city    = _rnd(CIUDADES);
    const age     = _rndInt(18, 65);
    const domain  = _rnd(DOMINIOS_EMAIL);

    // Determinar org y profesión
    const orgType  = overrides.orgType  || _rnd(Object.keys(JOBS_BY_ORG));
    const jobPool  = JOBS_BY_ORG[orgType] || JOBS_BY_ORG.generic;
    const job      = overrides.job      || _rnd(jobPool);
    const orgName  = overrides.orgName  || null;
    const secLevel = _securityLevel(job);

    // NSE basado en edad, trabajo y nivel de seguridad
    const nse = Math.min(5, Math.floor((secLevel + (age > 35 ? 1 : 0) + _rndInt(0,1))));

    const person = {
      id:           _uid(),
      name,
      surname,
      fullName:     `${name} ${surname}`,
      age,
      gender:       isMale ? 'M' : 'F',
      city:         city.name,
      province:     city.area,
      job,
      orgType,
      orgName,      // nombre de la organización (llenado por worldPopulation)
      orgIp:        overrides.orgIp || null,
      email:        _genEmail(name, surname, orgName ? orgName.split(' ')[0].toLowerCase().replace(/[^a-z]/g,'') + '.com.ar' : domain),
      personalEmail:_genEmail(name, surname, domain),
      phone:        _genPhone(city.code),
      nse,          // nivel socioeconómico 1-5
      securityLevel: secLevel,
      bankAccount:  Math.random() > 0.15,
      cryptoWallet: Math.random() > 0.7,
      socialMedia: {
        nodoSocial: Math.random() > 0.2,
        handle:     `@${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}_${surname.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,4)}${_rndInt(10,99)}`,
      },
      interests:    Array.from({length:_rndInt(2,4)}, () => _rnd(INTERESES)).filter((v,i,a)=>a.indexOf(v)===i),
      victimized:   false,   // true si el jugador robó sus datos
      victimPosts:  [],      // posts reactivos que generó
      _meta: {
        created: Date.now(),
      },
    };

    return person;
  }

  // ─── Conectar con organizaciones del NetworkSystem ─────────────

  function _populateOrgs() {
    if (!window.NetworkSystem) return;
    const nodes = NetworkSystem.getKnownNodes?.() || [];

    nodes.forEach(node => {
      if (!node.hostname || node.type === 'ROUTER') return;

      const orgType = _nodeTypeToOrgType(node.type);
      const count   = _rndInt(3, 8);

      for (let i = 0; i < count; i++) {
        const person = _createPerson({
          orgType,
          orgName: node.hostname,
          orgIp:   node.ip,
        });
        _storePerson(person);
      }
    });
  }

  function _nodeTypeToOrgType(type) {
    const map = {
      BANK:       'bank',
      GOVERNMENT: 'government',
      CORPORATE:  'startup',
      RESEARCH:   'university',
      MEDIA:      'media',
      ISP:        'fintech',
      DARKNET:    'generic',
    };
    return map[type] || 'generic';
  }

  function _storePerson(person) {
    _people.set(person.id, person);

    if (person.orgName) {
      if (!_byOrg.has(person.orgName)) _byOrg.set(person.orgName, []);
      _byOrg.get(person.orgName).push(person);
    }
    if (!_byCity.has(person.city)) _byCity.set(person.city, []);
    _byCity.get(person.city).push(person);
  }

  // ─── API Pública ───────────────────────────────────────────────

  const API = {

    on(ev, cb) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(cb);
    },

    init() {
      // Generar ciudadanos "flotantes" (sin org asignada)
      for (let i = 0; i < 40; i++) {
        _storePerson(_createPerson());
      }
      // Conectar con nodos del NetworkSystem
      _populateOrgs();

      console.log(`[PersonGenerator] ${_people.size} ciudadanos generados.`);
    },

    /**
     * Genera personas para un nodo específico y las guarda.
     */
    generateForNode(node) {
      if (!node) return [];
      const orgType = _nodeTypeToOrgType(node.type);
      const count   = _rndInt(3, 7);
      const result  = [];
      for (let i = 0; i < count; i++) {
        const p = _createPerson({ orgType, orgName: node.hostname, orgIp: node.ip });
        _storePerson(p);
        result.push(p);
      }
      _notify('persons_added', { node, persons: result });
      return result;
    },

    generate(count = 10, overrides = {}) {
      const result = [];
      for (let i = 0; i < count; i++) {
        const p = _createPerson(overrides);
        _storePerson(p);
        result.push(p);
      }
      return result;
    },

    getById(id)         { return _people.get(id) || null; },
    getAll()            { return Array.from(_people.values()); },
    getForOrg(orgName)  { return _byOrg.get(orgName) || []; },
    getForCity(city)    { return _byCity.get(city) || []; },
    getForIp(ip)        {
      return Array.from(_people.values()).filter(p => p.orgIp === ip);
    },

    /**
     * Marca a personas de un nodo como victimizadas.
     * Dispara reacciones: posts, noticias, aumento de heat.
     */
    victimizeByIp(ip, dataType) {
      const victims = API.getForIp(ip);
      const affected = victims.slice(0, _rndInt(2, Math.min(5, victims.length)));
      affected.forEach(p => {
        p.victimized = true;
        _notify('victimized', { person: p, dataType });
      });
      return affected;
    },

    count() { return _people.size; },

    /** Repoblar cuando se generan nuevos nodos */
    onNewNode(node) {
      return API.generateForNode(node);
    },
  };

  return API;
})();
