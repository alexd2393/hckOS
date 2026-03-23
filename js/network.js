/**
 * network.js — NetworkSystem v2
 * AleXim Mobile — Hacking Narrative Game
 */

window.NetworkSystem = (() => {

  const NODE_CATALOG = [
    {
      ip:'192.168.1.1', hostname:'router.local', org:'Red Local',
      type:'ROUTER', location:'Buenos Aires, AR', security:1,
      visible:true, tutorial:true,
      desc:'Router doméstico sin actualizar. Primer paso obligatorio.',
      connections:['190.210.100.3'],
      files:[
        { name:'router.log',       size:'48 KB',  reward:20,  locked:false, dataType:'network_logs',     sensitivity:2, desc:'Logs de tráfico de la red local.' },
        { name:'dhcp_leases.txt',  size:'2 KB',   reward:10,  locked:false, dataType:'network_logs',     sensitivity:1, desc:'Lista de dispositivos con MACs.' },
        { name:'admin_backup.cfg', size:'12 KB',  reward:80,  locked:true,  dataType:'credentials',      sensitivity:4, desc:'Credenciales del admin. Requiere CryptBreak.' },
      ],
    },
    {
      ip:'190.210.100.3', hostname:'srv-admin.telenet-ar.com', org:'TeleNet Argentina S.A.',
      type:'ISP', location:'Córdoba, AR', security:2,
      visible:false, tutorial:true,
      desc:'Gateway del ISP. Hackearlo desbloquea el scan global.',
      connections:['200.58.82.22','190.12.64.5','10.44.0.7'],
      files:[
        { name:'clientes_2025.csv',    size:'4.2 MB', reward:350, locked:false, dataType:'customer_database', sensitivity:8, desc:'Padrón de 2.3M clientes con DNI y domicilio.' },
        { name:'logs_trafico_q2.tar',  size:'18 MB',  reward:500, locked:false, dataType:'network_logs',      sensitivity:6, desc:'Logs de navegación de usuarios Q2 2025.' },
        { name:'vpn_internal.key',     size:'4 KB',   reward:900, locked:true,  dataType:'credentials',       sensitivity:9, desc:'Clave privada VPN corporativa.' },
        { name:'backups_factu.enc',    size:'22 MB',  reward:700, locked:true,  dataType:'financial_data',    sensitivity:7, desc:'Backup de facturación cifrado.' },
      ],
    },
    {
      ip:'10.44.0.7', hostname:'darknode-relay-bsas', org:'Anonymous Collective AR',
      type:'DARKNET', location:'Buenos Aires, AR', security:1, visible:false,
      connections:['200.45.128.10','200.0.0.220'],
      desc:'Relay anónimo del underground local.',
      files:[
        { name:'contacto.txt',         size:'1 KB',   reward:50,  locked:false, dataType:'credentials',       sensitivity:3, desc:'Datos de contacto de NEXUS (encriptados).' },
        { name:'mercado_negro.onion',  size:'3 KB',   reward:120, locked:false, dataType:'credentials',       sensitivity:5, desc:'Direcciones de mercados underground activos.' },
        { name:'identidades.zip',      size:'890 KB', reward:600, locked:true,  dataType:'customer_database', sensitivity:7, desc:'120 identidades falsas verificadas.' },
      ],
    },
    {
      ip:'200.58.82.22', hostname:'db.info24ar.net', org:'Info24 Argentina',
      type:'MEDIA', location:'Rosario, AR', security:1, visible:false,
      connections:['190.12.64.5'],
      desc:'Base de datos del portal de noticias más leído del interior.',
      files:[
        { name:'articulos_borrador.sql',     size:'800 KB', reward:80,  locked:false, dataType:'emails',                sensitivity:4, desc:'Notas no publicadas con filtraciones.' },
        { name:'fuentes_protegidas.enc',     size:'120 KB', reward:800, locked:true,  dataType:'government_documents',  sensitivity:9, desc:'Identidades de fuentes anónimas periodísticas.' },
        { name:'publicidad_contratos.xlsx',  size:'2 MB',   reward:200, locked:false, dataType:'financial_data',        sensitivity:5, desc:'Contratos con el estado y empresas.' },
      ],
    },
    {
      ip:'190.12.64.5', hostname:'mail.megacorp-arg.com.ar', org:'MegaCorp Argentina S.A.',
      type:'CORPORATE', location:'Buenos Aires, AR', security:2, visible:false,
      connections:['186.19.200.44','200.45.128.10'],
      desc:'Servidor de correo corporativo de multinacional.',
      files:[
        { name:'mails_directorio.mbox',    size:'140 MB', reward:700,  locked:false, dataType:'emails',               sensitivity:7, desc:'Correspondencia interna del directorio.' },
        { name:'proyectos_secretos.zip',   size:'55 MB',  reward:1200, locked:true,  dataType:'government_documents', sensitivity:8, desc:'Proyectos y acuerdos reservados.' },
        { name:'nomina_ejecutivos.xlsx',   size:'3 MB',   reward:300,  locked:false, dataType:'financial_data',       sensitivity:6, desc:'Sueldos y bonos del management.' },
        { name:'licitaciones_estado.pdf',  size:'8 MB',   reward:950,  locked:true,  dataType:'government_documents', sensitivity:9, desc:'Licitaciones con sobreprecio documentado.' },
      ],
    },
    {
      ip:'186.19.200.44', hostname:'data.conicet-digital.gob.ar', org:'CONICET',
      type:'RESEARCH', location:'Mendoza, AR', security:3, visible:false,
      connections:['200.0.0.220'],
      desc:'Servidor de datos del organismo científico estatal.',
      files:[
        { name:'genoma_proyecto_alpha.fasta',    size:'2.1 GB', reward:1500, locked:true,  dataType:'medical_records',      sensitivity:9,  desc:'Secuencias genómicas — proyecto Alpha.' },
        { name:'informe_cyberdefensa_2025.pdf',  size:'4 MB',   reward:1100, locked:true,  dataType:'government_documents', sensitivity:10, desc:'Vulnerabilidades en infraestructura crítica.' },
        { name:'investigadores_padron.csv',      size:'600 KB', reward:250,  locked:false, dataType:'customer_database',    sensitivity:5,  desc:'Datos del padrón de investigadores.' },
      ],
    },
    {
      ip:'200.45.128.10', hostname:'bna-core01.bancacion.gob.ar', org:'Banco de la Nación Argentina',
      type:'BANK', location:'Buenos Aires, AR', security:4, visible:false,
      connections:['200.0.0.220'],
      desc:'Core bancario del banco estatal. Objetivo de alto valor.',
      files:[
        { name:'transacciones_q3_2025.enc', size:'900 MB', reward:3000, locked:true,  dataType:'financial_data',    sensitivity:10, desc:'14M de transacciones del trimestre.' },
        { name:'cuentas_funcionarios.sql',  size:'45 MB',  reward:2500, locked:true,  dataType:'financial_data',    sensitivity:9,  desc:'Cuentas de 8.000 funcionarios públicos.' },
        { name:'claves_swift.enc',          size:'8 KB',   reward:5000, locked:true,  dataType:'crypto_wallet_data',sensitivity:10, desc:'Credenciales SWIFT para transferencias internacionales.' },
        { name:'auditoria_interna.pdf',     size:'12 MB',  reward:800,  locked:false, dataType:'financial_data',    sensitivity:7,  desc:'Informe de auditoría interna sin clasificar.' },
      ],
    },
    {
      ip:'200.0.0.220', hostname:'intranet.mininterior.gob.ar', org:'Ministerio del Interior',
      type:'GOVERNMENT', location:'Buenos Aires, AR', security:5, visible:false,
      connections:[],
      desc:'Intranet del Ministerio del Interior. Seguridad máxima.',
      files:[
        { name:'padron_electoral_2025.sql',  size:'8.4 GB', reward:4000, locked:true,  dataType:'customer_database',    sensitivity:10, desc:'Padrón electoral con datos biométricos.' },
        { name:'informe_inteligencia.enc',   size:'200 MB', reward:6000, locked:true,  dataType:'government_documents', sensitivity:10, desc:'Informes de inteligencia sobre grupos.' },
        { name:'protocolo_ciberdefensa.pdf', size:'18 MB',  reward:3500, locked:true,  dataType:'government_documents', sensitivity:9,  desc:'Protocolos de respuesta a ciberataques.' },
        { name:'agenda_reservada.dat',       size:'2 MB',   reward:2000, locked:false, dataType:'government_documents', sensitivity:8,  desc:'Agenda no pública del ministro Q4 2025.' },
      ],
    },
  ];

  let _knownNodes = [], _currentNode = null, _breachedIps = new Set();
  let _listeners = {}, _scanDone = false;
  let _tutorial = { routerBreached:false, ispVisible:false, ispBreached:false };

  function _notify(ev, data) { (_listeners[ev]||[]).forEach(cb=>{try{cb(data)}catch(e){}}); }
  function _nodeOf(ip) { return _knownNodes.find(n=>n.ip===ip)??null; }
  function _cat(ip)    { return NODE_CATALOG.find(n=>n.ip===ip)??null; }
  function _add(node)  { if(!_knownNodes.find(n=>n.ip===node.ip)){_knownNodes.push({...node});return true;}return false; }
  function _wait(ms)   { return new Promise(r=>setTimeout(r,ms)); }

  // ─── Breach chance usando BalanceConfig ─────────────────────────
  function _breachChance(sec) {
    const BC = window.BalanceConfig?.breach ?? {};
    const baseChances = BC.baseChance ?? { 1:0.90, 2:0.65, 3:0.42, 4:0.22, 5:0.08 };
    let chance = baseChances[Math.min(5, sec)] ?? 0.08;

    if (typeof GameState !== 'undefined') {
      const sw = GameState.getSoftware();
      const toolBonus = BC.toolBonus ?? {};
      if (sw.scanner?.installed)    chance += (toolBonus.scanner?.perLevel   ?? 0.04) * sw.scanner.level;
      if (sw.bruteforce?.installed) chance += (toolBonus.bruteforce?.perLevel ?? 0.12) * sw.bruteforce.level;
      if (sw.decryptor?.installed)  chance += (toolBonus.decryptor?.perLevel  ?? 0.02) * sw.decryptor.level;
    }
    return Math.min(0.97, chance);
  }

  // ─── Breach time usando BalanceConfig ───────────────────────────
  function _breachTime(sec) {
    const BC    = window.BalanceConfig?.breach ?? {};
    const times = BC.baseTimeMs ?? { 1:1200, 2:2800, 3:5000, 4:9000, 5:16000 };
    const base  = times[Math.min(5, sec)] ?? 5000;
    const var_  = BC.timeVariance ?? 0.3;
    return base * (1 - var_ + Math.random() * var_ * 2);
  }

  const LEGACY_MISSIONS = {
    intro_mission:{ id:'intro_mission', title:'Primer Contacto', client:'??? (Desconocido)', available:true, completed:false,
      objective:'Hackeá el router local y luego el servidor del ISP', desc:'Demostrá que podés trabajar.',
      reward:300, suspicion:5, unlocks:['isp_leak','media_job'], targetIp:'190.210.100.3', targetFile:'clientes_2025.csv' },
    isp_leak:{ id:'isp_leak', title:'Fuga de Clientes', client:'NEXUS', available:false, completed:false,
      objective:'Descargar "clientes_2025.csv" del servidor TeleNet', desc:'Un competidor paga bien por la base de clientes.',
      reward:800, suspicion:12, unlocks:['corp_espionage'], targetIp:'190.210.100.3', targetFile:'clientes_2025.csv' },
    media_job:{ id:'media_job', title:'Silenciar la Prensa', client:'Anónimo', available:false, completed:false,
      objective:'Descargar "fuentes_protegidas.enc" de Info24AR', desc:'Conseguí las fuentes antes de que las publiquen.',
      reward:1200, suspicion:10, unlocks:['corp_espionage'], targetIp:'200.58.82.22', targetFile:'fuentes_protegidas.enc' },
    corp_espionage:{ id:'corp_espionage', title:'Espionaje Corporativo', client:'NEXUS', available:false, completed:false,
      objective:'Descargar "licitaciones_estado.pdf" de MegaCorp', desc:'MegaCorp roba licitaciones. Alguien paga.',
      reward:2000, suspicion:18, unlocks:['bank_heist'], targetIp:'190.12.64.5', targetFile:'licitaciones_estado.pdf' },
    bank_heist:{ id:'bank_heist', title:'El Gran Robo', client:'SHADOW', available:false, completed:false,
      objective:'Descargar "auditoria_interna.pdf" del Banco Nación', desc:'El pez gordo. Primer paso: el informe de auditoría.',
      reward:3500, suspicion:25, unlocks:[], targetIp:'200.45.128.10', targetFile:'auditoria_interna.pdf' },
  };

  const LEGACY_NEWS = [
    {id:'n01',time:'03:47',tag:'BREACH', title:'Hackeo masivo expone 4M de registros del ANSES',body:'Grupo desconocido publicó base de datos en foros underground.'},
    {id:'n02',time:'01:12',tag:'LEY',    title:'Cibercrimen extiende vigilancia a IPs residenciales',body:'Por decreto, autorizaron inspección de paquetes en ISPs nacionales.'},
    {id:'n03',time:'22:55',tag:'MERCADO',title:'ZeroCoin sube 340% en el mercado paralelo argentino',body:'Criptomoneda anónima rompe récords ante inestabilidad del peso.'},
    {id:'n04',time:'14:00',tag:'LEY',    title:'Cuatro ISPs retienen logs de usuarios 90 días',body:'TeleNet y otros tres recibieron notificación bajo nuevo marco de cibercrimen.'},
    {id:'n05',time:'08:20',tag:'TECH',   title:'Se filtran fragmentos del kernel de AleXim Mobile 2.5',body:'Código fuente parcial publicado en foros privados del underground.'},
  ];

  const API = {
    on(ev,cb){if(!_listeners[ev])_listeners[ev]=[];_listeners[ev].push(cb);},
    off(ev,cb){if(_listeners[ev])_listeners[ev]=_listeners[ev].filter(x=>x!==cb);},
    getKnownNodes()      { return [..._knownNodes]; },
    getNode(ip)          { return _nodeOf(ip); },
    getCurrentNode()     { return _currentNode; },
    isConnected()        { return _currentNode!==null; },
    isBreached(ip)       { return _breachedIps.has(ip); },
    isTutorialComplete() { return _tutorial.ispBreached; },
    getDiscovered()      { return _knownNodes; },
    init()               { },

    async scan() {
      // FIX #3: chequear scanner DESPUÉS del tutorial para no bloquear el primer scan
      await _wait(300);
      const newNodes=[];

      // Tutorial stage 0: sólo router (permitido siempre — es el tutorial)
      if(!_tutorial.routerBreached && !_tutorial.ispBreached) {
        if(!_scanDone){const r=_cat('192.168.1.1');if(r&&_add(r))newNodes.push({...r});_scanDone=true;}
        _notify('scan',{nodes:_knownNodes,newNodes});
        return{ok:true,nodes:_knownNodes,newNodes};
      }
      // Tutorial stage 1: router + ISP
      if(_tutorial.routerBreached && !_tutorial.ispBreached) {
        const isp=_cat('190.210.100.3');if(isp&&_add(isp))newNodes.push({...isp});
        _notify('scan',{nodes:_knownNodes,newNodes});
        return{ok:true,nodes:_knownNodes,newNodes};
      }
      // Stage 2: scan global — ahora sí requerimos scanner
      if(typeof GameState!=='undefined'){
        if(!GameState.hasSoftware('scanner')) return{ok:false,message:'NetScan no instalado.',nodes:[]};
        GameState.addSuspicion(2);
      }
      if(_currentNode && _breachedIps.has(_currentNode.ip)) return API.scanFromNode(_currentNode.ip);
      let dc=0.20;
      if(typeof GameState!=='undefined'){const lv=GameState.getSoftware()?.scanner?.level??1;dc=0.10+lv*0.12;}
      NODE_CATALOG.filter(n=>!_nodeOf(n.ip)).forEach(n=>{if(Math.random()<dc&&_add(n))newNodes.push({...n});});
      if(typeof ReputationSystem!=='undefined') ReputationSystem.addHeat(2,'global_scan');
      _notify('scan',{nodes:_knownNodes,newNodes});
      return{ok:true,nodes:_knownNodes,newNodes};
    },

    async scanFromNode(fromIp) {
      const from=_nodeOf(fromIp)??_cat(fromIp);
      if(!from) return{ok:false,message:'Nodo no encontrado.',nodes:[]};
      if(!_breachedIps.has(fromIp)) return{ok:false,message:'Nodo no comprometido.',nodes:[]};
      await _wait(400);
      const newNodes=[];
      (from.connections??[]).forEach(ip=>{const c=_cat(ip);if(c&&_add(c))newNodes.push({...c});});
      if(typeof GameState!=='undefined') GameState.addSuspicion(3);
      if(typeof ReputationSystem!=='undefined') ReputationSystem.addHeat(3,'node_scan');
      _notify('scan',{nodes:_knownNodes,newNodes,fromNode:from});
      return{ok:true,nodes:_knownNodes,newNodes,fromNode:from};
    },

    connect(ip) {
      const node=_nodeOf(ip);
      if(!node) return{ok:false,node:null,message:`IP desconocida: ${ip}. Ejecutá scan primero.`};
      _currentNode=node;
      _notify('connect',{node});
      if(typeof GameState!=='undefined'){GameState.addSuspicion(2);GameState.connectTo(ip);}
      return{ok:true,node,message:`Conectado a ${node.hostname} (${node.ip})`};
    },

    disconnect() {
      const prev=_currentNode; _currentNode=null;
      if(typeof GameState!=='undefined') GameState.disconnect();
      _notify('disconnect',{node:prev});
    },

    async breach(ip) {
      const node=ip?_nodeOf(ip):_currentNode;
      if(!node) return{ok:false,message:'No hay nodo objetivo. Usá connect [ip] primero.'};
      if(_breachedIps.has(node.ip)) return{ok:true,already:true,message:`${node.hostname} ya está comprometido.`};
      const chance=_breachChance(node.security);
      await _wait(_breachTime(node.security));
      const success=Math.random()<chance;
      const BC = window.BalanceConfig?.breach ?? {};
      if(success){
        _breachedIps.add(node.ip);
        if(node.ip==='192.168.1.1'){
          _tutorial.routerBreached=true;
          const isp=_cat('190.210.100.3');if(isp)_add(isp);
        }
        if(node.ip==='190.210.100.3'){
          _tutorial.ispBreached=true;_tutorial.ispVisible=true;
          if(typeof UI!=='undefined') UI.notify('🌐 Red global desbloqueada — ejecutá scan para más nodos','success',8000);
          // Spawn primer nodo generado cuando se completa el tutorial
          if(window.NodeGenerator && window.NodeGenerator.spawnNetwork) {
            setTimeout(()=>NodeGenerator.spawnNetwork('fintech'), 5000);
            setTimeout(()=>NodeGenerator.spawnNetwork('logistics'), 12000);
          }
        }
        const heatGain=(BC.heatOnSuccess??4)*node.security;
        const repGain=(BC.repOnSuccess??2)*node.security;
        if(typeof GameState!=='undefined'){GameState.addSuspicion(BC.suspicionOnSuccess??3);GameState.setFlag('breached_'+node.ip.replace(/\./g,'_'));}
        if(typeof ReputationSystem!=='undefined'){ReputationSystem.addHeat(heatGain,'breach_'+node.type);ReputationSystem.addReputation(repGain,'breach_'+node.hostname);}
        _notify('breach',{node,success:true});
        // Evento global para DarkForum y WorldPopulation
        window.dispatchEvent(new CustomEvent('alexim-breach', { detail: { node } }));
        return{ok:true,success:true,node,message:`Acceso obtenido — ${node.hostname}`};
      } else {
        const heatFail=(BC.heatOnFail??5)*node.security;
        if(typeof GameState!=='undefined') GameState.addSuspicion(BC.suspicionOnFail??8);
        if(typeof ReputationSystem!=='undefined') ReputationSystem.addHeat(heatFail,'breach_failed');
        // Rastreo si heat alto
        if(typeof PursuitSystem!=='undefined'){
          const heat=ReputationSystem?.getHeat?.()??0;
          if(heat>60 && Math.random()<0.3) PursuitSystem.startTrace();
        }
        _notify('breach',{node,success:false});
        return{ok:false,success:false,node,message:`Breach fallido — ${node.hostname} rechazó la conexión.`};
      }
    },

    getFiles(ip) {
      const node=ip?_nodeOf(ip):_currentNode;
      if(!node||!_breachedIps.has(node.ip)) return null;
      return node.files.map(f=>({...f}));
    },

    async download(filename,ip) {
      const node=ip?_nodeOf(ip):_currentNode;
      if(!node) return{ok:false,message:'No conectado a ningún nodo.'};
      if(!_breachedIps.has(node.ip)) return{ok:false,message:'Nodo no comprometido. Ejecutá breach primero.'};
      const file=node.files.find(f=>f.name===filename);
      if(!file) return{ok:false,message:`Archivo no encontrado: ${filename}`};
      if(file.locked && typeof GameState!=='undefined' && !GameState.hasSoftware('cryptbreak'))
        return{ok:false,message:'Archivo encriptado. Necesitás CryptBreak para descargarlo.'};
      await _wait(400+Math.random()*600);

      // LOOT — no dinero directo
      let loot=null;
      if(typeof InventorySystem!=='undefined') loot=InventorySystem.addData({file,node});

      if(typeof GameState!=='undefined'){
        const heatBC=window.BalanceConfig?.heat ?? {};
        const heatGain = file.sensitivity>=8
          ? (heatBC.onHighSensData??5) + (heatBC.onDownload??2)
          : (heatBC.onDownload??2);
        GameState.addSuspicion(2);
        if(typeof ReputationSystem!=='undefined') ReputationSystem.addHeat(heatGain,'download');
        GameState.addFile('/home/ghost/downloads',file.name,
          `[ORIGEN]   ${node.ip} — ${node.hostname}\n[TIPO]     ${file.dataType} (sens:${file.sensitivity}/10)\n[TAMAÑO]   ${file.size}\n[VALOR EST.] ~$${loot?.valueEstimate??'?'} CR en mercado\n[DESC]     ${file.desc}`
        );
        API._checkMissionProgress(node.ip,file.name,file.reward??0);
        // Check MissionEngine
        if(typeof MissionEngine!=='undefined') MissionEngine.checkDownloadCompletes(node.ip, file.name);
        // Disparar evento para WorldPopulation (consecuencias humanas)
        window.dispatchEvent(new CustomEvent('alexim-download', { detail: { node, file, dataType: file.dataType, loot } }));
      }
      _notify('download',{node,file,loot});
      return{ok:true,file,loot,reward:0,message:`Descargado: ${filename} → inventario (~$${loot?.valueEstimate??'?'} CR est.)`};
    },

    // ── Métodos para NodeGenerator y SaveSystem ─────────────────
    addNodes(nodes) {
      if(!Array.isArray(nodes)) return;
      nodes.forEach(n => _add(n));
      _notify('scan', { nodes: _knownNodes, newNodes: nodes });
    },

    _revealNode(ip) {
      const n = _cat(ip);
      if(n) _add(n);
    },

    _restoreBreached(ip) {
      _breachedIps.delete(ip);
      // FIX #2: era .add() — debe ELIMINAR el breach para que los agentes puedan revocar acceso
    },

    /** FIX #4: Método público para que HackingEngine marque un nodo como breacheado
     *  sin acceder a los privados del closure (_breachedIps, _notify). */
    forceBreached(ip) {
      const node = _nodeOf(ip);
      if (!node) return;
      if (_breachedIps.has(ip)) return; // ya breacheado
      _breachedIps.add(ip);
      // Actualizar flags de tutorial
      if (ip === '192.168.1.1') _tutorial.routerBreached = true;
      if (ip === '190.210.100.3') { _tutorial.ispBreached = true; _tutorial.ispVisible = true; }
      _notify('breach', { node, success: true });
    },

    _checkMissionProgress(ip,filename,reward){
      Object.values(LEGACY_MISSIONS).forEach(m=>{
        if(!m.available||m.completed) return;
        if(m.targetIp===ip&&m.targetFile===filename){
          m.completed=true;
          if(typeof GameState!=='undefined'){GameState.addMoney(m.reward);GameState.setFlag('mission_done_'+m.id);}
          if(typeof ReputationSystem!=='undefined') ReputationSystem.addReputation(15,'mission_'+m.id);
          (m.unlocks||[]).forEach(nid=>{if(LEGACY_MISSIONS[nid])LEGACY_MISSIONS[nid].available=true;});
          _notify('missionComplete',{mission:m});
          if(typeof UI!=='undefined') UI.notify(`✓ MISIÓN COMPLETADA: ${m.title} (+${m.reward} CR)`,'success',7000);
        }
      });
    },

    getMission(id)          { return LEGACY_MISSIONS[id]??null; },
    getMissions()           { return LEGACY_MISSIONS; },
    getActiveMissions()     { return Object.values(LEGACY_MISSIONS).filter(m=>m.available&&!m.completed); },
    getCompletedMissions()  { return Object.values(LEGACY_MISSIONS).filter(m=>m.completed); },
    getNews()               { return LEGACY_NEWS; },
  };

  return API;
})();
