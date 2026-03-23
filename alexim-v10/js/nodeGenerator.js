/**
 * nodeGenerator.js — Generador Procedural de Nodos
 * AleXim OS — Hacking Narrative Game
 *
 * Genera organizaciones ficticias argentinas con redes internas de servidores.
 * Cada organización tiene 2-5 servidores con roles distintos.
 *
 * API:
 *   NodeGenerator.generate(type, count)  → Node[]
 *   NodeGenerator.generateNetwork(type)  → { parent, children }
 *   NodeGenerator.getOrgTypes()          → string[]
 */

window.NodeGenerator = (() => {
  'use strict';

  // ─── Generadores de IP únicos ──────────────────────────────────
  const _usedIPs = new Set([
    '192.168.1.1','190.210.100.3','10.44.0.7','200.58.82.22',
    '190.12.64.5','186.19.200.44','200.45.128.10','200.0.0.220',
  ]);

  function _genIP() {
    let ip;
    do {
      const b = Math.floor(Math.random() * 200) + 50;
      const c = Math.floor(Math.random() * 250) + 1;
      const d = Math.floor(Math.random() * 250) + 1;
      ip = `${b}.${c}.${d}.${Math.floor(Math.random() * 250) + 2}`;
    } while (_usedIPs.has(ip));
    _usedIPs.add(ip);
    return ip;
  }

  // ─── Nombres de organizaciones argentinas ─────────────────────
  const ORG_NAMES = {
    bank: [
      'Banco Patagonia','Banco Galicia Digital','Macro Financiero AR',
      'Credicoop Online','Santander Argentina','BBVA Argentina','HSBC AR',
      'Banco Ciudad','Banco Provincia','Brubank AR','Naranja X',
    ],
    hospital: [
      'Hospital Italiano','Clínica del Sol BA','Sanatorio Güemes',
      'Hospital Austral','Centro Médico Palermo','Clínica Santa Isabel Rosario',
      'Hospital Privado Córdoba','Sanatorio Allende','Instituto Fleni',
    ],
    university: [
      'UBA – Sistemas','UTN Facultad Regional','UNLP Digital',
      'Universidad Austral','UADE Informática','UNSAM Campus Virtual',
      'Universidad Di Tella','UNC Córdoba Digital','UNR Rosario IT',
    ],
    logistics: [
      'LogiAR Express','CargaNet Argentina','TransPampa Digital',
      'Andreani Logística','OCA Digital','AerVans Carga','FuturoCargo AR',
      'QuickDelivery SA','Correo Argentino Digital','DHL Argentina',
    ],
    fintech: [
      'MercadoPago Infraestructura','Ualá Core','Lemon Cash AR',
      'Prex Argentina','Pomelo Fintech','Bind Payments','Bitso AR',
      'TiendaNube Payments','PayWay Argentina','GetNet Latam',
    ],
    government: [
      'AFIP – Sistema Tributario','ANSES Plataforma Digital','Renaper Online',
      'Ministerio de Economía IT','PAMI Digital','Municipalidad BA – CRM',
      'Sec. Comunicaciones AR','INTI Tecnología','CONAE Sistemas',
    ],
    media: [
      'Infobae Digital','Clarín Online','La Nación IT',
      'Télam Plataforma','TN Digital','Página 12 CMS',
      'Radio La Red Online','Canal 13 AR Streaming','El Destape Digital',
    ],
    startup: [
      'ZonaProp Tech','Properati AR','Properati Dev',
      'Auth0 Buenos Aires','Globant Studio','Despegar Core',
      'OLX Argentina IT','OpenQBO AR','Ripio Exchange',
    ],
  };

  // ─── Tipos de servidores internos por org ─────────────────────
  const SERVER_ROLES = {
    bank: [
      { role:'web',      suffix:'www',      security:1, fileTypes:['network_logs','emails'] },
      { role:'customers',suffix:'db-clientes',security:3, fileTypes:['customer_database','financial_data'] },
      { role:'payments', suffix:'gateway',  security:4, fileTypes:['financial_data','crypto_wallet_data'] },
      { role:'mail',     suffix:'mail',     security:2, fileTypes:['emails','credentials'] },
      { role:'backups',  suffix:'backup',   security:3, fileTypes:['financial_data','customer_database'] },
    ],
    hospital: [
      { role:'web',      suffix:'www',      security:1, fileTypes:['network_logs'] },
      { role:'patients', suffix:'historiales',security:3, fileTypes:['medical_records','customer_database'] },
      { role:'admin',    suffix:'admin',    security:2, fileTypes:['emails','credentials','financial_data'] },
      { role:'lab',      suffix:'laboratorio',security:3, fileTypes:['medical_records','research_data'] },
    ],
    university: [
      { role:'web',      suffix:'portal',   security:1, fileTypes:['network_logs','emails'] },
      { role:'students', suffix:'alumnos',  security:2, fileTypes:['customer_database','credentials'] },
      { role:'research', suffix:'investigacion',security:3, fileTypes:['research_data','government_documents'] },
      { role:'finance',  suffix:'tesoreria',security:3, fileTypes:['financial_data','emails'] },
    ],
    logistics: [
      { role:'web',      suffix:'web',      security:1, fileTypes:['network_logs'] },
      { role:'tracking', suffix:'tracking', security:2, fileTypes:['customer_database','network_logs'] },
      { role:'clients',  suffix:'clientes', security:2, fileTypes:['customer_database','financial_data'] },
      { role:'ops',      suffix:'operaciones',security:3, fileTypes:['emails','credentials'] },
    ],
    fintech: [
      { role:'api',      suffix:'api',      security:2, fileTypes:['credentials','financial_data'] },
      { role:'users',    suffix:'usuarios', security:3, fileTypes:['customer_database','crypto_wallet_data'] },
      { role:'core',     suffix:'core',     security:4, fileTypes:['financial_data','crypto_wallet_data'] },
      { role:'fraud',    suffix:'antifraude',security:3, fileTypes:['financial_data','credentials'] },
    ],
    government: [
      { role:'web',      suffix:'web',      security:1, fileTypes:['network_logs','government_documents'] },
      { role:'citizens', suffix:'ciudadanos',security:3, fileTypes:['customer_database','government_documents'] },
      { role:'internal', suffix:'intranet', security:4, fileTypes:['government_documents','emails'] },
      { role:'finance',  suffix:'finanzas', security:4, fileTypes:['financial_data','government_documents'] },
    ],
    media: [
      { role:'web',      suffix:'web',      security:1, fileTypes:['network_logs','emails'] },
      { role:'cms',      suffix:'cms',      security:2, fileTypes:['emails','credentials'] },
      { role:'sources',  suffix:'fuentes',  security:3, fileTypes:['government_documents','emails'] },
    ],
    startup: [
      { role:'api',      suffix:'api',      security:2, fileTypes:['credentials','customer_database'] },
      { role:'db',       suffix:'db',       security:3, fileTypes:['customer_database','financial_data'] },
      { role:'analytics',suffix:'analytics',security:2, fileTypes:['customer_database','research_data'] },
    ],
  };

  // ─── Generadores de archivos por tipo ─────────────────────────
  const FILE_TEMPLATES = {
    network_logs:         [
      { name:'access.log',   sensitivity:2, size:'120 KB' },
      { name:'firewall.log', sensitivity:3, size:'340 KB' },
      { name:'traffic_q3.tar',sensitivity:4,size:'8 MB' },
    ],
    credentials:          [
      { name:'shadow.db',    sensitivity:7, size:'4 KB' },
      { name:'admin_pass.txt',sensitivity:8,size:'1 KB' },
      { name:'ldap_dump.sql',sensitivity:7,size:'12 KB' },
    ],
    emails:               [
      { name:'inbox_directivos.mbox',sensitivity:6,size:'45 MB' },
      { name:'correos_internos.pst', sensitivity:5,size:'22 MB' },
      { name:'adjuntos_confidenciales.zip',sensitivity:7,size:'180 MB'},
    ],
    customer_database:    [
      { name:'clientes.csv', sensitivity:7, size:'3.2 MB' },
      { name:'usuarios.sql', sensitivity:8, size:'15 MB' },
      { name:'padron_2025.db',sensitivity:9,size:'140 MB' },
    ],
    financial_data:       [
      { name:'transacciones.csv',sensitivity:8,size:'55 MB' },
      { name:'balances_q3.xlsx', sensitivity:9,size:'4 MB' },
      { name:'cuentas.enc',      sensitivity:9,size:'90 MB',locked:true},
    ],
    medical_records:      [
      { name:'historiales_pacientes.db',sensitivity:9,size:'280 MB'},
      { name:'estudios_labs.zip',sensitivity:8,size:'1.4 GB' },
      { name:'diagnosticos_2025.sql',sensitivity:10,size:'340 MB',locked:true},
    ],
    government_documents: [
      { name:'resolucion_interna.pdf',sensitivity:8,size:'2 MB' },
      { name:'expedientes_2025.zip', sensitivity:9,size:'18 MB' },
      { name:'doc_clasificado.enc',  sensitivity:10,size:'6 MB',locked:true},
    ],
    crypto_wallet_data:   [
      { name:'wallet_keys.json', sensitivity:10,size:'2 KB',locked:true},
      { name:'crypto_addresses.txt',sensitivity:8,size:'40 KB'},
      { name:'seed_phrases.enc', sensitivity:10,size:'1 KB',locked:true},
    ],
    research_data:        [
      { name:'proyecto_alpha.pdf',sensitivity:7,size:'4 MB' },
      { name:'datos_experimentales.zip',sensitivity:8,size:'2.1 GB'},
      { name:'informe_tecnico.docx',sensitivity:6,size:'8 MB' },
    ],
  };

  const CITIES = ['Buenos Aires','Rosario','Córdoba','Mendoza','La Plata','Tucumán','Salta','Santa Fe'];

  function _pickCity() { return CITIES[Math.floor(Math.random() * CITIES.length)]; }

  function _genFiles(fileTypes, security) {
    const files = [];
    fileTypes.forEach(ft => {
      const tpls   = FILE_TEMPLATES[ft] ?? [];
      const tpl    = tpls[Math.floor(Math.random() * tpls.length)];
      if (!tpl) return;

      // Calcular valor con balance config
      const bc   = window.BalanceConfig?.loot ?? {};
      const base = bc.baseValue?.[ft] ?? 500;
      const mult = bc.sensitivityMult?.[tpl.sensitivity] ?? 1.0;
      const econ = window.EconomySystem?.getMultiplier?.(ft) ?? 1.0;
      const rand = 0.85 + Math.random() * 0.30;
      const val  = Math.floor(base * mult * econ * rand);

      files.push({
        name:         tpl.name,
        size:         tpl.size,
        reward:       val,
        locked:       !!tpl.locked,
        dataType:     ft,
        sensitivity:  tpl.sensitivity,
        desc:         `Archivo de ${ft.replace(/_/g,' ')} del servidor comprometido.`,
      });
    });
    return files;
  }

  function _genServer(orgName, orgDomain, role, city) {
    const ip     = _genIP();
    const suffix = role.suffix;
    const host   = `${suffix}.${orgDomain}`;
    const sec    = Math.max(1, Math.min(5, role.security + Math.floor(Math.random() * 2 - 0.5)));
    const files  = _genFiles(role.fileTypes, sec);

    return {
      ip,
      hostname:  host,
      org:       orgName,
      type:      'CORPORATE',
      location:  city,
      security:  sec,
      visible:   false,
      generated: true,
      connections: [],
      desc:      `Servidor ${role.role.toUpperCase()} de ${orgName} en ${city}.`,
      files,
    };
  }

  // ─── API pública ───────────────────────────────────────────────
  const API = {

    getOrgTypes() { return Object.keys(ORG_NAMES); },

    /**
     * Genera una red completa para un tipo de organización.
     * Devuelve { parent, children } listos para agregar a NetworkSystem.
     */
    generateNetwork(orgType) {
      const type    = orgType ?? API.getOrgTypes()[Math.floor(Math.random() * API.getOrgTypes().length)];
      const names   = ORG_NAMES[type] ?? ORG_NAMES.startup;
      const name    = names[Math.floor(Math.random() * names.length)];
      const city    = _pickCity();
      const domain  = name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 20) + '.com.ar';

      const roles = SERVER_ROLES[type] ?? SERVER_ROLES.startup;
      // Tomar 2-4 roles (el primero siempre es el servidor público)
      const numServers = 2 + Math.floor(Math.random() * Math.min(3, roles.length - 1));
      const picked     = [roles[0], ...roles.slice(1).sort(() => Math.random()-0.5).slice(0, numServers - 1)];

      const servers = picked.map(role => _genServer(name, domain, role, city));

      // Conectar: el primer servidor es el "front" visible
      const parent = servers[0];
      parent.visible = false;  // se descubre por scan
      parent.connections = servers.slice(1).map(s => s.ip);

      // Los internos referencian al padre
      servers.slice(1).forEach(s => { s.connections = [parent.ip]; });

      return { parent, children: servers.slice(1), all: servers, orgName: name, orgType: type };
    },

    /**
     * Genera N organizaciones de un tipo dado (o aleatorio).
     */
    generate(type, count = 1) {
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(API.generateNetwork(type));
      }
      return result;
    },

    /**
     * Agrega una red generada al NetworkSystem y la devuelve.
     */
    spawnNetwork(orgType) {
      if (!window.NetworkSystem?.addNodes) return null;
      const net = API.generateNetwork(orgType);
      NetworkSystem.addNodes(net.all);
      // Notify ecosystem so WorldPopulation can generate persons for new nodes
      window.dispatchEvent(new CustomEvent('alexim-new-nodes', { detail: { nodes: net.all } }));
      return net;
    },
  };

  return API;
})();
