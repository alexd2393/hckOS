/**
 * mobileOS.js — AleXim Mobile: Mejoras táctiles y gestos
 * 
 * - Swipe derecha para cerrar ventana (gesto de volver)
 * - Back button del sistema Android
 * - Notch / safe area awareness
 * - Prevención de zoom accidental
 * - Teclado virtual: scroll automático al input
 * - Botón "Volver" en navbar mobile
 */

window.MobileOS = (() => {
  'use strict';

  // ─── Swipe-to-close en ventanas ────────────────────────────────
  function _initSwipeBack() {
    let startX = 0, startY = 0, isSwiping = false, targetWin = null;

    document.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      isSwiping = false;
      targetWin = e.target.closest('.os-window');
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!targetWin) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      // Solo swipe horizontal significativo desde el borde izquierdo
      if (!isSwiping && startX < 40 && dx > 10 && dy < 60) {
        isSwiping = true;
      }

      if (isSwiping && dx > 0) {
        targetWin.style.transform = `translateX(${dx}px)`;
        targetWin.style.opacity = String(Math.max(0.3, 1 - dx / 300));
      }
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!targetWin || !isSwiping) {
        if (targetWin) {
          targetWin.style.transform = '';
          targetWin.style.opacity = '';
        }
        targetWin = null;
        return;
      }

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;

      if (dx > 100) {
        // Swipe suficiente → cerrar ventana
        const winId = targetWin.id;
        targetWin.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
        targetWin.style.transform = 'translateX(100%)';
        targetWin.style.opacity = '0';
        setTimeout(() => {
          if (typeof AleXimOS !== 'undefined') AleXimOS.closeWindow(winId);
        }, 190);
      } else {
        // Swipe insuficiente → volver a posición
        targetWin.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        targetWin.style.transform = '';
        targetWin.style.opacity = '';
        setTimeout(() => {
          if (targetWin) { targetWin.style.transition = ''; }
        }, 210);
      }
      targetWin = null;
      isSwiping = false;
    }, { passive: true });
  }

  // ─── Botón físico "Atrás" de Android ───────────────────────────
  function _initAndroidBack() {
    // Pushstate trick para interceptar botón atrás
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => {
      // Cerrar la ventana más reciente si hay alguna abierta
      if (typeof AleXimOS !== 'undefined') {
        const wins = document.querySelectorAll('.os-window');
        if (wins.length > 0) {
          const topWin = wins[wins.length - 1];
          AleXimOS.closeWindow(topWin.id);
          // Repush para seguir capturando el back
          history.pushState(null, '', location.href);
        }
      }
    });
  }

  // ─── Botón "Volver" en navbar ───────────────────────────────────
  function _initBackBtn() {
    const btn = document.getElementById('mobile-back-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (typeof AleXimOS !== 'undefined') {
        const wins = document.querySelectorAll('.os-window');
        if (wins.length > 0) {
          const topWin = wins[wins.length - 1];
          AleXimOS.closeWindow(topWin.id);
        }
      }
    });
  }

  // ─── Scroll automático al input del terminal ────────────────────
  function _initKeyboardScroll() {
    // Cuando aparece el teclado virtual, hacer scroll al input activo
    const meta = document.querySelector('meta[name=viewport]');
    const origContent = meta ? meta.content : '';

    window.addEventListener('focusin', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350); // delay para que el teclado suba primero
      }
    });

    window.addEventListener('focusout', () => {
      // Pequeño delay para evitar flickers
      setTimeout(() => window.scrollTo(0, 0), 100);
    });
  }

  // ─── Prevenir zoom con doble-tap ───────────────────────────────
  function _preventDoubleTapZoom() {
    let lastTap = 0;
    document.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
      }
      lastTap = now;
    }, { passive: false });
  }

  // ─── Vibración táctil en acciones importantes ───────────────────
  function vibrate(pattern = [10]) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ─── Reloj en formato móvil (HH:MM) ────────────────────────────
  function _initMobileClock() {
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const el = document.getElementById('top-clock');
      if (el) el.textContent = `${h}:${m}`;
    }
    updateClock();
    setInterval(updateClock, 10000);
  }

  // ─── Detección de orientación ───────────────────────────────────
  function _initOrientationHandler() {
    function onOrient() {
      const isLandscape = window.innerWidth > window.innerHeight;
      document.body.classList.toggle('landscape', isLandscape);
      // En landscape, mostrar cmdbar más compacto
    }
    window.addEventListener('resize', onOrient);
    onOrient();
  }

  // ─── Agregar estilos extra inline para mobile ───────────────────
  function _injectMobileStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Notch / safe area */
      #top-bar {
        padding-top: env(safe-area-inset-top, 0px);
        height: calc(var(--topbar-h) + env(safe-area-inset-top, 0px));
      }

      /* Win-close muestra flecha en lugar de punto rojo */
      .win-close { overflow: visible; }
      .win-close::before {
        content: '‹';
        font-size: 26px;
        font-weight: 200;
        color: var(--cyan);
        line-height: 1;
        display: block;
        margin-top: -2px;
      }

      /* Tap states más visibles */
      .d-icon:active { transform: scale(0.9); }
      .mobile-cmd-btn:active { transform: scale(0.95); }
      .mobile-nav-btn:active { transform: scale(0.88); }

      /* Terminal input más grande en mobile */
      .terminal-input-row { padding: 8px 6px; }
      .terminal-prompt    { font-size: 13px; }
      .terminal-input     { font-size: 14px !important; min-height: 44px; }

      /* Landscape: grid de 6 columnas */
      @media (orientation: landscape) and (max-height: 500px) {
        #desktop-icons { grid-template-columns: repeat(8, 1fr); padding: 6px 10px; }
        .d-icon { min-height: 60px; padding: 6px 4px 4px; }
        .d-icon-gfx { font-size: 22px; }
        #mobile-navbar { height: 44px; }
        #mobile-cmdbar { bottom: 44px; }
      }

      /* Scrollbar invisible en todos lados */
      * { scrollbar-width: none; }
      *::-webkit-scrollbar { display: none; }

      /* Feedback visual en botones de cmdbar */
      .mobile-cmd-btn:active {
        box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
      }

      /* Ventana con bordes redondeados arriba en mobile */
      .os-window {
        border-top-left-radius: 16px !important;
        border-top-right-radius: 16px !important;
      }

      /* Indicador de handle en titlebar (como bottom sheet) */
      .win-titlebar::before {
        content: '';
        display: block;
        position: absolute;
        top: 6px; left: 50%;
        transform: translateX(-50%);
        width: 36px; height: 4px;
        background: rgba(0, 212, 255, 0.2);
        border-radius: 2px;
      }
      .win-titlebar { position: relative; }
    `;
    document.head.appendChild(style);
  }

  // ─── Init ──────────────────────────────────────────────────────
  function init() {
    _injectMobileStyles();
    _initSwipeBack();
    _initAndroidBack();
    _initBackBtn();
    _initKeyboardScroll();
    _preventDoubleTapZoom();
    _initMobileClock();
    _initOrientationHandler();
    console.log('[MobileOS] Touch layer initialized.');
  }

  // Exponer vibrate para usar en otros sistemas
  return { init, vibrate };

})();

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', MobileOS.init);
} else {
  MobileOS.init();
}
