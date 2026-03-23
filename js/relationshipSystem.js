/**
 * relationshipSystem.js — Red de Relaciones Humanas
 * AleXim Mobile — Hacking Narrative Game
 *
 * Genera redes familiares y sociales entre las personas del mundo.
 * Las relaciones crean consecuencias en cadena: hackear a una persona
 * puede afectar a su familia.
 *
 * API:
 *   RelationshipSystem.build()              → void (construye la red)
 *   RelationshipSystem.getFamily(personId)  → { spouse, children, parents, siblings }
 *   RelationshipSystem.getFriends(personId) → Person[]
 *   RelationshipSystem.getCoworkers(id)     → Person[]
 *   RelationshipSystem.getNetwork(id)       → { family, friends, coworkers }
 */

window.RelationshipSystem = (() => {
  'use strict';

  // Grafo de relaciones: personId → { family:{}, friends:[], coworkers:[] }
  const _graph = new Map();
  let _built   = false;
  let _listeners = {};

  function _notify(ev, data) {
    (_listeners[ev] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function _rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _rndInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  function _getOrCreate(id) {
    if (!_graph.has(id)) {
      _graph.set(id, { family: { spouse: null, children: [], parents: [], siblings: [] }, friends: [], coworkers: [] });
    }
    return _graph.get(id);
  }

  // ─── Construcción de la red ────────────────────────────────────

  function _buildFamilies(people) {
    // Agrupar por rango de edad para emparejamientos plausibles
    const adults  = people.filter(p => p.age >= 25 && p.age <= 55);
    const shuffled = [...adults].sort(() => Math.random() - 0.5);

    // Crear parejas (aprox 60% de adultos)
    const paired = new Set();
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      if (Math.random() > 0.4 && !paired.has(shuffled[i].id) && !paired.has(shuffled[i+1].id)) {
        const a = shuffled[i];
        const b = shuffled[i+1];
        _getOrCreate(a.id).family.spouse = { id: b.id, name: b.fullName };
        _getOrCreate(b.id).family.spouse = { id: a.id, name: a.fullName };
        paired.add(a.id);
        paired.add(b.id);

        // Hijos opcionales
        if (Math.random() > 0.45) {
          const numKids = _rndInt(1, 3);
          for (let k = 0; k < numKids; k++) {
            // Hijo/a como persona generada on-the-fly
            const kidName = _rnd(['Sofía','Valentina','Lucía','Tomás','Mateo','Franco',
              'Juliana','Florencia','Agustín','Emilia','Máximo','Renata']);
            const kidAge  = _rndInt(4, 20);
            const kid     = { id: 'kid_' + Math.random().toString(36).slice(2,8), name: kidName, age: kidAge };
            _getOrCreate(a.id).family.children.push(kid);
            _getOrCreate(b.id).family.children.push(kid);
          }
        }
      }
    }
  }

  function _buildCoworkers(people) {
    // Agrupar por org
    const byOrg = new Map();
    people.forEach(p => {
      if (!p.orgName) return;
      if (!byOrg.has(p.orgName)) byOrg.set(p.orgName, []);
      byOrg.get(p.orgName).push(p);
    });

    byOrg.forEach(orgPeople => {
      orgPeople.forEach(p => {
        const colleagues = orgPeople.filter(c => c.id !== p.id);
        const coworkers  = colleagues
          .sort(() => Math.random() - 0.5)
          .slice(0, _rndInt(1, Math.min(4, colleagues.length)))
          .map(c => ({ id: c.id, name: c.fullName, job: c.job }));
        _getOrCreate(p.id).coworkers = coworkers;
      });
    });
  }

  function _buildFriendships(people) {
    // Amigos: misma ciudad, sin relación laboral existente
    const byCity = new Map();
    people.forEach(p => {
      if (!byCity.has(p.city)) byCity.set(p.city, []);
      byCity.get(p.city).push(p);
    });

    byCity.forEach(cityPeople => {
      cityPeople.forEach(p => {
        const potentialFriends = cityPeople.filter(c => c.id !== p.id);
        const numFriends = _rndInt(1, Math.min(5, potentialFriends.length));
        const friends = potentialFriends
          .sort(() => Math.random() - 0.5)
          .slice(0, numFriends)
          .map(f => ({ id: f.id, name: f.fullName }));
        _getOrCreate(p.id).friends = friends;
      });
    });
  }

  // ─── API Pública ───────────────────────────────────────────────

  const API = {

    on(ev, cb) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(cb);
    },

    init() {
      if (!window.PersonGenerator) return;
      API.build();
      console.log(`[RelationshipSystem] Red social construida. ${_graph.size} nodos.`);
    },

    build() {
      if (_built) return;
      const people = window.PersonGenerator?.getAll?.() || [];
      if (people.length === 0) return;
      _buildFamilies(people);
      _buildCoworkers(people);
      _buildFriendships(people);
      _built = true;
      _notify('built', { nodes: _graph.size });
    },

    /** Reconstruir al agregar nuevas personas */
    rebuild() {
      _built = false;
      _graph.clear();
      API.build();
    },

    getFamily(personId) {
      return _graph.get(personId)?.family || { spouse: null, children: [], parents: [], siblings: [] };
    },

    getFriends(personId) {
      return (_graph.get(personId)?.friends || [])
        .map(f => window.PersonGenerator?.getById?.(f.id))
        .filter(Boolean);
    },

    getCoworkers(personId) {
      return (_graph.get(personId)?.coworkers || [])
        .map(c => window.PersonGenerator?.getById?.(c.id))
        .filter(Boolean);
    },

    getNetwork(personId) {
      const node = _graph.get(personId);
      if (!node) return null;
      return {
        family:    node.family,
        friends:   API.getFriends(personId),
        coworkers: API.getCoworkers(personId),
      };
    },

    /**
     * Retorna texto narrativo de la red de una persona para la app IdentityProfiler.
     */
    getSummaryText(person) {
      const net    = API.getNetwork(person.id);
      if (!net) return 'Sin datos relacionales.';
      const lines  = [];
      if (net.family.spouse)
        lines.push(`▸ Pareja: ${net.family.spouse.name}`);
      if (net.family.children.length > 0)
        lines.push(`▸ Hijos: ${net.family.children.map(c => c.name + ' (' + c.age + ')').join(', ')}`);
      if (net.coworkers.length > 0)
        lines.push(`▸ Compañeros de trabajo: ${net.coworkers.slice(0,3).map(c => c.fullName).join(', ')}`);
      if (net.friends.length > 0)
        lines.push(`▸ Contactos sociales: ${net.friends.slice(0,3).map(f => f.fullName).join(', ')}`);
      return lines.join('\n') || 'Perfil social limitado.';
    },

    isBuilt() { return _built; },
    nodeCount() { return _graph.size; },
  };

  return API;
})();
