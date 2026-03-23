/**
 * inventorySystem.js — Inventario de Datos Robados
 * AleXim OS — Hacking Narrative Game
 *
 * Almacena los archivos robados como objetos de "loot".
 * El dinero NO se otorga al descargar — solo al vender en DarkMarket.
 *
 * Estructura de un loot:
 * {
 *   id, filename, dataType, sensitivity (1-10),
 *   origin (hostname), size, sizeBytes,
 *   encrypted, valueEstimate, listedForSale,
 *   acquiredAt
 * }
 *
 * API pública:
 *   InventorySystem.addData(dataObject)   → loot
 *   InventorySystem.getInventory()        → loot[]
 *   InventorySystem.getData(id)           → loot | null
 *   InventorySystem.removeData(id)        → boolean
 *   InventorySystem.listForSale(id)       → boolean
 *   InventorySystem.unlistFromSale(id)    → boolean
 *   InventorySystem.on(event, cb)
 */

window.InventorySystem = (() => {
  'use strict';

  // ─── Mapeo de tipo de dato → precio base y noticias que genera ────
  const DATA_TYPE_META = {
    financial_data:       { label: 'Datos Financieros',      baseValue: 900,  heatGain: 8,  newsEvent: 'FINANCIAL_THEFT'    },
    customer_database:    { label: 'Base de Clientes',        baseValue: 500,  heatGain: 5,  newsEvent: 'DATA_BREACH'        },
    medical_records:      { label: 'Registros Médicos',       baseValue: 800,  heatGain: 12, newsEvent: 'MEDICAL_DATA_THEFT' },
    emails:               { label: 'Correos Corporativos',    baseValue: 400,  heatGain: 4,  newsEvent: 'CORPORATE_ESPIONAGE'},
    government_documents: { label: 'Documentos Estatales',    baseValue: 1400, heatGain: 18, newsEvent: 'GOVERNMENT_BREACH' },
    credentials:          { label: 'Credenciales',            baseValue: 650,  heatGain: 6,  newsEvent: 'DATA_BREACH'        },
    crypto_wallet_data:   { label: 'Wallets Cripto',          baseValue: 1800, heatGain: 9,  newsEvent: 'FINANCIAL_THEFT'    },
    network_logs:         { label: 'Logs de Red',             baseValue: 200,  heatGain: 2,  newsEvent: 'DATA_BREACH'        },
    research_data:        { label: 'Datos de Investigación',  baseValue: 700,  heatGain: 7,  newsEvent: 'DATA_BREACH'        },
  };

  // ─── State ─────────────────────────────────────────────────────────
  let _inventory   = [];   // loot[]
  let _listeners   = {};

  function _notify(event, data) {
    (_listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  // ─── Tamaño → multiplicador de valor ──────────────────────────────
  function _sizeMultiplier(sizeStr) {
    const s = String(sizeStr).toLowerCase();
    const n = parseFloat(s);
    if (s.includes('gb'))       return 3.0;
    if (s.includes('mb')) {
      if (n >= 100) return 2.5;
      if (n >= 10)  return 1.8;
      return 1.2;
    }
    if (s.includes('kb')) {
      if (n >= 500) return 1.0;
      return 0.7;
    }
    return 0.5;
  }

  // ─── Calcular valueEstimate ────────────────────────────────────────
  function _calcValue(dataType, sensitivity, sizeStr) {
    const meta = DATA_TYPE_META[dataType] ?? DATA_TYPE_META['credentials'];
    const base = meta.baseValue;
    const mult = _sizeMultiplier(sizeStr);
    const sens = Math.max(1, Math.min(10, sensitivity));
    const raw  = base * (sens / 5) * mult;
    // Variación aleatoria ±15%
    return Math.floor(raw * (0.85 + Math.random() * 0.30));
  }

  // ─── Convertir un archivo de NetworkSystem a un objeto loot ───────
  function _fileToLoot(file, node) {
    const dataType    = file.dataType    ?? 'credentials';
    const sensitivity = file.sensitivity ?? Math.ceil(Math.random() * 6 + 2);
    const sizeStr     = file.size        ?? '100 KB';

    return {
      id:            `loot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      filename:      file.name,
      dataType,
      sensitivity,
      origin:        node?.hostname ?? 'unknown',
      originIp:      node?.ip       ?? '0.0.0.0',
      size:          sizeStr,
      encrypted:     file.locked ?? false,
      valueEstimate: _calcValue(dataType, sensitivity, sizeStr),
      listedForSale: false,
      sold:          false,
      acquiredAt:    Date.now(),
      // Extra metadata for news/karma
      _meta:         DATA_TYPE_META[dataType] ?? DATA_TYPE_META['credentials'],
    };
  }

  // ─── API pública ───────────────────────────────────────────────────
  const API = {

    on(event, cb) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(cb);
    },

    /**
     * Agrega datos robados al inventario.
     * Puede recibir un objeto loot ya construido, o un {file, node} para convertir.
     */
    addData(input) {
      let loot;
      if (input && input.filename && input.dataType) {
        // Ya es un loot object
        loot = input;
      } else if (input && input.file && input.node) {
        loot = _fileToLoot(input.file, input.node);
      } else {
        console.warn('[InventorySystem] addData: input inválido', input);
        return null;
      }

      _inventory.push(loot);
      _notify('added', loot);

      // Notificar a ReputationSystem para sumar heat
      if (window.ReputationSystem) {
        ReputationSystem.addHeat(loot._meta.heatGain, `download_${loot.dataType}`);
      }

      // Disparar noticia dinámica en NewsSystem
      if (window.NewsSystem) {
        NewsSystem.reportPlayerAction(loot._meta.newsEvent, {
          target:     loot.origin,
          dataType:   loot.dataType,
          sensitivity: loot.sensitivity,
          filename:   loot.filename,
        });
      }

      console.log(`[Inventory] +1 loot: ${loot.filename} (${loot.dataType}, ~$${loot.valueEstimate})`);
      return loot;
    },

    /** Convertir file + node directamente (shortcut para network.js) */
    createLoot(file, node) {
      return _fileToLoot(file, node);
    },

    getInventory()  { return [..._inventory]; },
    getData(id)     { return _inventory.find(l => l.id === id) ?? null; },

    getByFilename(filename) {
      return _inventory.filter(l => l.filename === filename && !l.sold);
    },

    removeData(id) {
      const idx = _inventory.findIndex(l => l.id === id);
      if (idx === -1) return false;
      _inventory.splice(idx, 1);
      _notify('removed', { id });
      return true;
    },

    listForSale(id) {
      const loot = _inventory.find(l => l.id === id);
      if (!loot || loot.sold) return false;
      loot.listedForSale = true;
      _notify('listed', loot);
      return true;
    },

    unlistFromSale(id) {
      const loot = _inventory.find(l => l.id === id);
      if (!loot) return false;
      loot.listedForSale = false;
      _notify('unlisted', loot);
      return true;
    },

    markSold(id) {
      const loot = _inventory.find(l => l.id === id);
      if (!loot) return false;
      loot.sold          = true;
      loot.listedForSale = false;
      _notify('sold', loot);
      return true;
    },

    getTypeMeta(dataType) {
      return DATA_TYPE_META[dataType] ?? DATA_TYPE_META['credentials'];
    },

    getAllTypeMeta() { return { ...DATA_TYPE_META }; },

    /** Retorna el total de valor estimado del inventario no vendido. */
    getTotalValue() {
      return _inventory
        .filter(l => !l.sold)
        .reduce((sum, l) => sum + l.valueEstimate, 0);
    },

    /** Retorna cuántos items listos para venta hay. */
    getListedCount() {
      return _inventory.filter(l => l.listedForSale && !l.sold).length;
    },

    count()   { return _inventory.filter(l => !l.sold).length; },
    isEmpty() { return this.count() === 0; },

    /** FIX #5: Elimina un item del inventario por id (usado por AdversarialSystem al confiscar). */
    removeItem(id) {
      const idx = _inventory.findIndex(i => i.id === id);
      if (idx === -1) return false;
      _inventory.splice(idx, 1);
      _notify('removed', { id });
      if (typeof UI !== 'undefined') UI.updateHUD?.();
      return true;
    },
  };

  return API;
})();
