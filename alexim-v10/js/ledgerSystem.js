/**
 * ledgerSystem.js — Registro de Movimientos Financieros
 * AleXim OS — para la app MP (Wallet)
 *
 * Registra todas las transacciones: ingresos y egresos con descripción.
 * API:
 *   LedgerSystem.record(type, amount, description)
 *   LedgerSystem.getAll()   → entry[]
 *   LedgerSystem.getBalance() → number
 */
window.LedgerSystem = (() => {
  const _entries = [];   // { id, ts, type:'in'|'out', amount, desc }
  const _accountNumber = 'MP-' + Math.floor(10000000 + Math.random() * 90000000);

  function _add(type, amount, desc) {
    _entries.unshift({
      id:   'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
      ts:   Date.now(),
      type,   // 'in' | 'out'
      amount: Math.abs(amount),
      desc,
    });
    if (_entries.length > 200) _entries.pop();
    window.dispatchEvent(new CustomEvent('ledger-update'));
  }

  return {
    record(type, amount, desc) { _add(type, amount, desc); },
    getAll()   { return [..._entries]; },
    getAccountNumber() { return _accountNumber; },
    // Hook helpers called by other systems
    onSale(amount, filename) {
      _add('in', amount, `Venta de datos: ${filename}`);
    },
    onBuy(amount, itemName) {
      _add('out', amount, `Compra de herramienta: ${itemName}`);
    },
    onMissionReward(amount, missionTitle) {
      _add('in', amount, `Recompensa: ${missionTitle}`);
    },
    onPenalty(amount, reason) {
      _add('out', amount, `Penalización: ${reason}`);
    },
  };
})();
