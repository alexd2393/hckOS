/**
 * balanceConfig.js — Configuración de Balance del Juego
 * AleXim OS — Hacking Narrative Game
 *
 * Todos los valores numéricos del juego viven aquí.
 * Para rebalancear el juego, solo editar este archivo.
 */

window.BalanceConfig = {

  // ═══════════════════════════════════════════════════════════════
  // HACKING — PROBABILIDADES Y TIEMPOS
  // ═══════════════════════════════════════════════════════════════

  breach: {
    // Tiempo base de breach en ms por nivel de seguridad
    baseTimeMs:      { 1: 1200, 2: 2800, 3: 5000, 4: 9000, 5: 16000 },
    timeVariance:    0.3,      // ±30% variación aleatoria

    // Probabilidad base SIN herramientas instaladas
    baseChance:      { 1: 0.90, 2: 0.65, 3: 0.42, 4: 0.22, 5: 0.08 },

    // Bonus de herramientas al breach chance
    toolBonus: {
      scanner:    { perLevel: 0.04 },   // nivel 1-3
      brutex: { perLevel: 0.12 },   // nivel 1-3
      vpn:        { perLevel: 0.00 },   // no afecta breach
      shieldwall:   { perLevel: 0.00 },
      cryptbreak:  { perLevel: 0.02 },
    },

    // Costo en heat por breach exitoso (multiplicado por security level)
    heatOnSuccess:   4,
    heatOnFail:      6,   // fallar es más visible
    suspicionOnSuccess: 3,
    suspicionOnFail:    8,
  },

  // ═══════════════════════════════════════════════════════════════
  // DATOS — VALOR DE LOOT
  // ═══════════════════════════════════════════════════════════════

  loot: {
    // Valor base CR por tipo (antes de multiplicadores)
    baseValue: {
      network_logs:         120,
      credentials:          480,
      emails:               360,
      customer_database:    640,
      financial_data:       900,
      medical_records:      820,
      government_documents: 1200,
      crypto_wallet_data:   1600,
      research_data:        700,
    },

    // Multiplicador por sensibilidad (1-10)
    sensitivityMult: [0, 0.3, 0.4, 0.55, 0.7, 0.85, 1.0, 1.2, 1.5, 1.9, 2.5],

    // Multiplicador por tamaño
    sizeMult: {
      tiny:   0.5,   // < 10 KB
      small:  0.7,   // 10 KB – 1 MB
      medium: 1.0,   // 1 MB – 50 MB
      large:  1.4,   // 50 MB – 500 MB
      huge:   2.0,   // > 500 MB
    },

    // Varianza aleatoria ±%
    variance: 0.20,
  },

  // ═══════════════════════════════════════════════════════════════
  // ECONOMÍA DEL DARKMARKET
  // ═══════════════════════════════════════════════════════════════

  market: {
    // Factor mínimo y máximo de oferta sobre valueEstimate
    offerMin:    0.55,
    offerMax:    1.40,

    // Bonus de reputación (hasta +40%)
    repBonusMax: 0.40,

    // Cuántos ítems del mismo tipo bajan el precio (saturación)
    saturationThreshold: 3,
    saturationPenalty:   0.15,  // -15% por ítem extra sobre el umbral

    // Eventos del mercado: multiplicador sobre valueEstimate por tipo
    // (se usa desde EconomySystem)
    eventMultiplierDefault: 1.0,

    // Tiempo mínimo/máximo de llegada de oferta en ms
    offerDelayMin: 15000,
    offerDelayMax: 90000,

    // Tiempo de expiración de oferta
    offerExpireMs: 180000,  // 3 minutos
  },

  // ═══════════════════════════════════════════════════════════════
  // CALOR POLICIAL (HEAT)
  // ═══════════════════════════════════════════════════════════════

  heat: {
    // Acciones y su costo en heat
    onScan:          2,
    onScanFromNode:  3,
    onBreachSuccess: 4,    // × security level
    onBreachFail:    5,    // × security level
    onDownload:      2,
    onHighSensData:  5,    // sensitivity >= 8
    onSellHighValue: 3,    // venta > $3000

    // VPN reduce heat gain a la mitad
    vpnHeatMultiplier: 0.5,

    // Reducción natural por inactividad (por minuto de juego sin acciones)
    passiveDecayPerMinute: 1.5,

    // Reducción con herramienta VPN activa (por minuto)
    vpnDecayPerMinute: 3.0,

    // Heat mínimo tras reducción (no puede bajar de esto sin pagar)
    heatFloor: 0,
  },

  // ═══════════════════════════════════════════════════════════════
  // REPUTACIÓN
  // ═══════════════════════════════════════════════════════════════

  reputation: {
    onBreachSuccess:   2,   // × security level
    onMissionComplete: 15,
    onSaleComplete:    3,   // × sensitivity / 5
    onTrapAccepted:   -20,
  },

  // ═══════════════════════════════════════════════════════════════
  // HERRAMIENTAS — PRECIOS Y NIVELES
  // ═══════════════════════════════════════════════════════════════

  tools: {
    scanner:     { prices: [0, 0, 800, 2500],   maxLevel: 3 },
    cryptbreak:   { prices: [0, 200, 1200, 4000], maxLevel: 3 },
    brutex:  { prices: [0, 500, 2000, 6000], maxLevel: 3 },
    vpn:         { prices: [0, 350, 1500, 4500], maxLevel: 3 },
    shieldwall:    { prices: [0, 150, 900, 2800],  maxLevel: 3 },
    // Nuevas herramientas
    fisherman:    { prices: [0, 600, 2200, 0],    maxLevel: 2 },
    quantumcrack: { prices: [0, 1200, 0, 0],      maxLevel: 1 },
    spoofing:    { prices: [0, 800, 3000, 0],    maxLevel: 2 },
  },

  // ═══════════════════════════════════════════════════════════════
  // PROGRESIÓN Y ECONOMÍA GENERAL
  // ═══════════════════════════════════════════════════════════════

  economy: {
    startingMoney: 500,

    // Misiones: recompensa base por tier de dificultad
    missionReward: { 1: 400, 2: 900, 3: 1800, 4: 3500, 5: 7000 },

    // Máximo de dinero que el jugador debería tener en cada tier de rep
    softCap: {
      desconocido:  3000,
      principiante: 12000,
      conocido:     40000,
      veterano:     120000,
      leyenda:      Infinity,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PERSECUCIÓN POLICIAL
  // ═══════════════════════════════════════════════════════════════

  pursuit: {
    // Intervalos de check (ms) para escalar el rastreo
    traceCheckInterval: 8000,

    // Probabilidad de que el sistema de rastreo envíe un ping al jugador
    tracePingChance: { low: 0.05, moderate: 0.15, high: 0.35, critical: 0.65 },

    // Tiempo máximo de trace antes de bust (ms) si no hace nada
    traceToBustMs: 120000,  // 2 minutos para actuar

    // Reducción de heat por cortarconexión durante rastreo
    disconnectHeatReduction: 8,

    // Cost en CR de contratar un "limpiador" (reduce heat)
    cleanerCost:        2000,
    cleanerHeatReduce:  25,
  },
};
