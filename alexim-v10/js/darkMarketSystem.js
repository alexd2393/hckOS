/**
 * darkMarketSystem.js — DarkMarket: Mercado Negro de Datos
 * AleXim OS — Hacking Narrative Game
 *
 * El jugador lista datos robados → compradores aparecen tras un delay →
 * el jugador acepta / rechaza / espera.
 *
 * El dinero se acredita SOLO cuando se acepta una oferta.
 *
 * Flujo:
 *   1. listDataForSale(lootId)  → pone el item en venta
 *   2. generateOffers()          → job interno, crea ofertas después de delay
 *   3. Ofertas llegan como mensajes al buzón del jugador
 *   4. acceptOffer(offerId)      → acredita dinero, marca loot como vendido
 *   5. rejectOffer(offerId)      → elimina oferta
 *
 * API:
 *   DarkMarketSystem.listDataForSale(lootId)  → boolean
 *   DarkMarketSystem.getListings()            → listing[]
 *   DarkMarketSystem.getOffers()              → offer[]
 *   DarkMarketSystem.acceptOffer(offerId)     → { ok, amount }
 *   DarkMarketSystem.rejectOffer(offerId)     → boolean
 *   DarkMarketSystem.on(event, cb)
 */

window.DarkMarketSystem = (() => {
  'use strict';

  // ─── Compradores ficticios ──────────────────────────────────────────
  const BUYERS = [
    { id: 'broker_17',       alias: 'broker_17',       type: 'financial', repRequired: 0  },
    { id: 'datavendor_9x',   alias: 'datavendor_9x',   type: 'any',       repRequired: 0  },
    { id: 'shadow_mkt',      alias: 'shadow_mkt',      type: 'government',repRequired: 20 },
    { id: 'nexus_trade',     alias: 'nexus_trade',     type: 'any',       repRequired: 10 },
    { id: 'meddata_ar',      alias: 'meddata_ar',      type: 'medical',   repRequired: 5  },
    { id: 'cred_exchange',   alias: 'cred_exchange',   type: 'credentials',repRequired: 0 },
    { id: 'cryptopawn',      alias: 'cryptopawn',      type: 'financial', repRequired: 15 },
    { id: 'phantom_buyer',   alias: 'phantom_buyer',   type: 'any',       repRequired: 30 },
    { id: 'info_market_ba',  alias: 'info_market_ba',  type: 'any',       repRequired: 0  },
    { id: 'dark_analytics',  alias: 'dark_analytics',  type: 'customer',  repRequired: 8  },
  ];

  // Cuántos compradores interesan según tipo de dato
  const TYPE_BUYER_MAP = {
    financial_data:       ['broker_17', 'cryptopawn', 'datavendor_9x', 'phantom_buyer'],
    customer_database:    ['datavendor_9x', 'dark_analytics', 'info_market_ba', 'nexus_trade'],
    medical_records:      ['meddata_ar', 'datavendor_9x', 'phantom_buyer'],
    emails:               ['datavendor_9x', 'info_market_ba', 'nexus_trade'],
    government_documents: ['shadow_mkt', 'phantom_buyer', 'nexus_trade'],
    credentials:          ['cred_exchange', 'datavendor_9x', 'broker_17'],
    crypto_wallet_data:   ['cryptopawn', 'broker_17', 'phantom_buyer'],
    network_logs:         ['datavendor_9x', 'info_market_ba'],
    research_data:        ['dark_analytics', 'datavendor_9x'],
  };

  // ─── State ─────────────────────────────────────────────────────────
  let _listings  = new Map();   // lootId → { loot, listedAt, offers[] }
  let _offers    = new Map();   // offerId → offer
  let _listeners = {};
  let _timers    = [];          // setTimeout refs para limpieza

  function _notify(event, data) {
    (_listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function _uid() {
    return 'off_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5);
  }

  // ─── Calcular precio de oferta ──────────────────────────────────────
  function _calcOfferPrice(loot, buyer) {
    const base     = loot.valueEstimate;
    const repBonus = window.ReputationSystem
      ? 1 + (ReputationSystem.getReputation() / 200)
      : 1;
    const buyerFactor = 0.55 + Math.random() * 0.85;  // v4: más varianza (0.55–1.40)
    const sensBonus   = loot.sensitivity >= 8 ? 1.2 : 1.0;
    // EconomySystem multiplier (supply/demand, events)
    const econMult    = window.EconomySystem?.getMultiplier?.(loot.dataType) ?? 1.0;

    return Math.floor(base * repBonus * buyerFactor * sensBonus * econMult);
  }

  // ─── Generar compradores para un listing ──────────────────────────
  function _scheduleBuyersForListing(lootId) {
    const listing = _listings.get(lootId);
    if (!listing) return;
    const loot = listing.loot;

    const potentialBuyers = (TYPE_BUYER_MAP[loot.dataType] ?? ['datavendor_9x'])
      .map(bid => BUYERS.find(b => b.id === bid))
      .filter(Boolean)
      .filter(b => {
        const rep = window.ReputationSystem ? ReputationSystem.getReputation() : 0;
        return rep >= b.repRequired;
      });

    if (potentialBuyers.length === 0) {
      // Nadie interesado — notificar después de un rato
      const tid = setTimeout(() => {
        _notify('no_buyers', { lootId, loot });
        _addMessage({
          from:    'darkmarket',
          subject: `Sin compradores: ${loot.filename}`,
          body:    `Nadie ofreció por "${loot.filename}". Intentá de nuevo más tarde o bajá la sensibilidad del paquete.`,
          type:    'system',
        });
      }, 25000 + Math.random() * 15000);
      _timers.push(tid);
      return;
    }

    // Número de compradores: 1 a min(3, potentialBuyers.length)
    const numBuyers = 1 + Math.floor(Math.random() * Math.min(3, potentialBuyers.length));
    const chosen    = potentialBuyers
      .sort(() => Math.random() - 0.5)
      .slice(0, numBuyers);

    chosen.forEach((buyer, i) => {
      // Cada comprador llega en un momento diferente (15s–120s)
      const delay = 12000 + Math.random() * 90000 + i * 8000;
      const tid = setTimeout(() => {
        const offerId = _uid();
        const amount  = _calcOfferPrice(loot, buyer);
        const expiresAt = Date.now() + 180000; // 3 min para decidir

        const offer = {
          id:        offerId,
          lootId,
          buyer:     buyer.alias,
          amount,
          expiresAt,
          status:    'pending',
        };

        _offers.set(offerId, offer);

        // Agregar a la lista de ofertas del listing
        listing.offers.push(offerId);

        _notify('offer_received', { offer, loot });

        // Mensaje en la app de mensajes
        _addMessage({
          from:    buyer.alias,
          subject: `Oferta por ${loot.filename}`,
          body:    [
            `Te contacto por el archivo: ${loot.filename}`,
            `Tipo: ${loot.dataType.replace(/_/g,' ')}  |  Sensibilidad: ${loot.sensitivity}/10`,
            `Mi oferta: $${amount.toLocaleString('es-AR')} CR`,
            `Oferta válida por 3 minutos.`,
            `→ Usá:  accept ${offerId}   o   reject ${offerId}`,
          ].join('\n'),
          type:    'offer',
          offerId,
          amount,
          lootId,
        });

        if (window.UI) {
          UI.notify(`💰 ${buyer.alias} ofrece $${amount.toLocaleString('es-AR')} por ${loot.filename}`, 'warning', 8000);
        }
        if (window.AudioSystem) AudioSystem.notification();

        // Auto-expirar la oferta
        setTimeout(() => {
          const o = _offers.get(offerId);
          if (o && o.status === 'pending') {
            o.status = 'expired';
            _notify('offer_expired', { offer: o });
          }
        }, 180000);

      }, delay);
      _timers.push(tid);
    });
  }

  // ─── Cola de mensajes (se integra con la app Messages) ────────────
  const _messageQueue = [];

  function _addMessage(msg) {
    const full = {
      id:        'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      from:      msg.from,
      subject:   msg.subject,
      body:      msg.body,
      type:      msg.type ?? 'info',
      offerId:   msg.offerId   ?? null,
      lootId:    msg.lootId    ?? null,
      amount:    msg.amount    ?? 0,
      read:      false,
      receivedAt: Date.now(),
    };
    _messageQueue.push(full);
    _notify('message', full);
    // También emitir CustomEvent para que la app Messages se actualice
    window.dispatchEvent(new CustomEvent('darkmarket-message', { detail: full }));
  }

  // ─── API Pública ───────────────────────────────────────────────────
  const API = {

    on(event, cb) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(cb);
    },

    /**
     * Lista un ítem del inventario en el DarkMarket.
     */
    listDataForSale(lootId) {
      if (!window.InventorySystem) return { ok: false, message: 'InventorySystem no disponible.' };

      const loot = InventorySystem.getData(lootId);
      if (!loot)         return { ok: false, message: 'Ítem no encontrado en inventario.' };
      if (loot.sold)     return { ok: false, message: 'Este ítem ya fue vendido.' };
      if (_listings.has(lootId)) return { ok: false, message: 'Ítem ya está listado.' };

      InventorySystem.listForSale(lootId);

      const listing = { loot, listedAt: Date.now(), offers: [] };
      _listings.set(lootId, listing);

      _notify('listed', { lootId, loot });
      _scheduleBuyersForListing(lootId);

      _addMessage({
        from:    'darkmarket',
        subject: `Listado: ${loot.filename}`,
        body:    `"${loot.filename}" ya está en el mercado. Esperá ofertas de compradores (puede tardar unos minutos). Si no hay interés, el archivo seguirá en tu inventario.`,
        type:    'system',
      });

      return { ok: true, message: `${loot.filename} listado en DarkMarket. Esperando compradores...` };
    },

    getListings() {
      return Array.from(_listings.values());
    },

    getOffers(status = 'pending') {
      return Array.from(_offers.values())
        .filter(o => status === 'all' || o.status === status);
    },

    getMessages()             { return [..._messageQueue]; },
    getUnreadMessages()       { return _messageQueue.filter(m => !m.read); },
    markMessageRead(id)       {
      const m = _messageQueue.find(m => m.id === id);
      if (m) m.read = true;
    },

    /**
     * Acepta una oferta → acredita dinero → marca loot como vendido.
     */
    acceptOffer(offerId) {
      const offer = _offers.get(offerId);
      if (!offer)                     return { ok: false, message: `Oferta ${offerId} no encontrada.` };
      if (offer.status !== 'pending') return { ok: false, message: `Oferta ${offerId} ya no está activa (${offer.status}).` };

      const loot = InventorySystem.getData(offer.lootId);
      if (!loot) return { ok: false, message: 'Ítem del inventario no encontrado.' };

      // Acreditar dinero
      if (typeof GameState !== 'undefined') {
        GameState.addMoney(offer.amount);
      }

      // Registrar en LedgerSystem (MP Wallet)
      if (window.LedgerSystem) {
        LedgerSystem.onSale(offer.amount, loot.filename);
      }

      // Marcar todo como vendido/aceptado
      offer.status = 'accepted';
      InventorySystem.markSold(offer.lootId);
      _listings.delete(offer.lootId);

      // Registrar venta en EconomySystem (saturación)
      if (window.EconomySystem) EconomySystem.recordSale(loot.dataType);

      // Cancelar otras ofertas pendientes del mismo loot
      _offers.forEach(o => {
        if (o.lootId === offer.lootId && o.id !== offerId && o.status === 'pending') {
          o.status = 'cancelled';
        }
      });

      // Reputación +
      if (window.ReputationSystem) {
        const repGain = Math.floor(loot.sensitivity * 1.5);
        ReputationSystem.addReputation(repGain, `sale_${loot.dataType}`);
      }

      _notify('offer_accepted', { offer, loot, amount: offer.amount });

      if (window.UI) {
        UI.notify(`✓ Venta completada: +$${offer.amount.toLocaleString('es-AR')} CR de ${offer.buyer}`, 'success', 7000);
      }
      if (window.AudioSystem) AudioSystem.success();

      // Posible noticia si dato muy sensible
      if (loot.sensitivity >= 8 && window.NewsSystem) {
        NewsSystem.reportPlayerAction('DATA_SOLD_HIGH_VALUE', {
          target:   loot.origin,
          dataType: loot.dataType,
          amount:   offer.amount,
        });
      }

      return { ok: true, amount: offer.amount, message: `Venta aceptada: +$${offer.amount.toLocaleString('es-AR')} CR` };
    },

    /**
     * Rechaza una oferta — el comprador se va, pero el loot sigue listado.
     */
    rejectOffer(offerId) {
      const offer = _offers.get(offerId);
      if (!offer || offer.status !== 'pending') return false;
      offer.status = 'rejected';
      _notify('offer_rejected', { offer });
      return true;
    },

    /**
     * Retira un ítem del mercado sin venderlo.
     */
    delist(lootId) {
      if (!_listings.has(lootId)) return false;
      _listings.delete(lootId);
      InventorySystem.unlistFromSale(lootId);
      // Cancelar ofertas pendientes
      _offers.forEach(o => {
        if (o.lootId === lootId && o.status === 'pending') o.status = 'cancelled';
      });
      _notify('delisted', { lootId });
      return true;
    },

    /** Genera una oferta inmediata de prueba (solo para desarrollo). */
    _debugForceOffer(lootId) {
      const listing = _listings.get(lootId);
      if (!listing) return;
      const buyer = BUYERS[0];
      const offerId = _uid();
      const offer = { id: offerId, lootId, buyer: buyer.alias, amount: 9999, expiresAt: Date.now() + 120000, status: 'pending' };
      _offers.set(offerId, offer);
      listing.offers.push(offerId);
      _addMessage({ from: buyer.alias, subject: `DEBUG oferta`, body: `Oferta debug: $9999\n→ accept ${offerId}`, type: 'offer', offerId, amount: 9999, lootId });
      _notify('offer_received', { offer, loot: listing.loot });
    },
  };

  return API;
})();
