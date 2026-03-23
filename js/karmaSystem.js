/**
 * karmaSystem.js - Sistema de Karma Oculto para AleXim OS
 * Registra decisiones morales del jugador sin mostrar valores explícitos
 * Afecta eventos narrativos, finales y reacciones del mundo
 */

const KarmaSystem = (function() {
    'use strict';

    // Dimensiones de karma (ocultas al jugador)
    const KARMA_DIMENSIONS = {
        CRIMINALITY: 'criminality',      // Nivel de actividad criminal
        HUMANITY: 'humanity',            // Compasión vs frialdad
        LOYALTY: 'loyalty',              // Lealtad a facciones
        SECRECY: 'secrecy',              // Cuidado vs descuido
        IDEALISM: 'idealism'             // Motivaciones (dinero vs justicia)
    };

    // Umbrales para triggers narrativos
    const THRESHOLDS = {
        CRIMINALITY: {
            LOW: 20,      // Hacktivista ético
            MEDIUM: 50,   // Criminal profesional
            HIGH: 80,     // Psicópata digital
            EXTREME: 95   // Monstruo
        },
        HUMANITY: {
            LOW: 30,      // Despiadado
            MEDIUM: 50,   // Pragmático
            HIGH: 70      // Compasivo
        }
    };

    // Base de datos de acciones y sus pesos
    const ACTION_WEIGHTS = {
        // Acciones criminales
        'DATA_THEFT': { criminality: 5, humanity: -2 },
        'FINANCIAL_THEFT': { criminality: 8, humanity: -5, idealism: -3 },
        'SCAM': { criminality: 6, humanity: -8 },
        'MALWARE_DIST': { criminality: 10, humanity: -5 },
        'FRAME_UP': { criminality: 7, humanity: -10 },
        'DESTROY_DATA': { criminality: 4, humanity: -3 },
        
        // Acciones "éticas" (relativas)
        'LEAK_CORRUPTION': { criminality: 3, humanity: 2, idealism: 5 },
        'HELP_VICTIM': { humanity: 5, idealism: 3 },
        'REFUSE_JOB': { loyalty: -2, idealism: 2 },
        'WARN_INNOCENT': { humanity: 3, secrecy: -2 },
        
        // Acciones de gameplay
        'SUCCESSFUL_HACK': { criminality: 1, secrecy: 1 },
        'DETECTED_HACKING': { secrecy: -5 },
        'MISSION_FAILED': { loyalty: -1 },
        'KILL_TRACE': { secrecy: 3 }
    };

    class KarmaEngine {
        constructor() {
            this.values = {
                criminality: 10,  // Empieza con algo de criminalidad (es un juego de hacking)
                humanity: 50,
                loyalty: 50,
                secrecy: 50,
                idealism: 30
            };
            this.history = [];
            this.flags = new Set(); // Banderas narrativas desbloqueadas
            this.narrativeState = 'BEGINNER'; // Estado narrativo actual
        }

        recordAction(actionType, context = {}) {
            const weights = ACTION_WEIGHTS[actionType];
            if (!weights) {
                console.warn(`[Karma] Acción desconocida: ${actionType}`);
                return;
            }

            // Aplicar pesos
            Object.entries(weights).forEach(([dimension, value]) => {
                this.values[dimension] = Math.max(0, Math.min(100, 
                    this.values[dimension] + value
                ));
            });

            // Registrar en historial (con timestamp pero sin mostrar valores)
            this.history.push({
                action: actionType,
                context: context,
                timestamp: Date.now(),
                narrativeImpact: this.calculateNarrativeImpact(weights)
            });

            // Limitar historial
            if (this.history.length > 1000) {
                this.history.shift();
            }

            // Verificar cambios de estado narrativo
            this.checkNarrativeTriggers();
            
            // Sincronizar con otros sistemas
            this.syncWithWorld();
        }

        calculateNarrativeImpact(weights) {
            // Determinar si esta acción es "significativa" para la historia
            const totalWeight = Object.values(weights).reduce((a, b) => Math.abs(a) + Math.abs(b), 0);
            return totalWeight > 5 ? 'MAJOR' : 'MINOR';
        }

        checkNarrativeTriggers() {
            const oldState = this.narrativeState;
            
            // Lógica de estados narrativos
            if (this.values.criminality > THRESHOLDS.CRIMINALITY.EXTREME && 
                this.values.humanity < THRESHOLDS.HUMANITY.LOW) {
                this.narrativeState = 'MONSTER';
                this.setFlag('dark_path');
            } else if (this.values.idealism > 70 && this.values.criminality < 40) {
                this.narrativeState = 'WHISTLEBLOWER';
                this.setFlag('hacktivist');
            } else if (this.values.criminality > THRESHOLDS.CRIMINALITY.HIGH) {
                this.narrativeState = 'CRIMINAL';
            } else if (this.values.secrecy < 30) {
                this.narrativeState = 'EXPOSED';
                this.setFlag('compromised');
            }

            if (oldState !== this.narrativeState) {
                this.triggerStateChange(oldState, this.narrativeState);
            }
        }

        setFlag(flag) {
            if (!this.flags.has(flag)) {
                this.flags.add(flag);
                console.log(`[Karma] Flag narrativa desbloqueada: ${flag}`);
                this.notifyFlagUnlock(flag);
            }
        }

        triggerStateChange(oldState, newState) {
            console.log(`[Karma] Transición: ${oldState} -> ${newState}`);
            
            // Notificar al sistema de noticias
            if (window.NewsSystem) {
                NewsSystem.generateKarmaNews(newState);
            }

            // Notificar al sistema de diálogos
            if (window.DialogueSystem) {
                DialogueSystem.updateTone(newState);
            }
        }

        syncWithWorld() {
            // Afectar precios en el mercado negro
            if (window.BlackMarket) {
                const riskMultiplier = this.values.secrecy < 50 ? 1.5 : 1.0;
                window.BlackMarket.setRiskMultiplier(riskMultiplier);
            }

            // Afectar dificultad de hacking (más criminal = más atención)
            if (window.NetworkSystem && this.values.criminality > 60) {
                // Los nodos tienen más seguridad
            }
        }

        // Consultas para otros sistemas (sin revelar números)
        query(type) {
            switch(type) {
                case 'REPUTATION':
                    return this.getReputationHint();
                case 'MORAL_STANDING':
                    return this.getMoralHint();
                case 'HEAT':
                    return this.getHeatLevel();
                case 'ENDING':
                    return this.calculateEnding();
                default:
                    return null;
            }
        }

        getReputationHint() {
            if (this.values.criminality > 80) return 'INFAMOUS';
            if (this.values.criminality > 50) return 'NOTORIOUS';
            if (this.values.criminality > 20) return 'KNOWN';
            return 'UNKNOWN';
        }

        getMoralHint() {
            if (this.values.humanity < 30) return 'RUTHLESS';
            if (this.values.humanity > 70) return 'COMPASSIONATE';
            return 'PRAGMATIC';
        }

        getHeatLevel() {
            // Basado en secrecy y criminality
            const heat = (this.values.criminality * 0.6) + ((100 - this.values.secrecy) * 0.4);
            if (heat > 80) return 'CRITICAL';
            if (heat > 60) return 'HIGH';
            if (heat > 40) return 'MODERATE';
            return 'LOW';
        }

        calculateEnding() {
            // Determinar qué final(es) están disponibles
            const endings = [];
            
            if (this.flags.has('dark_path')) endings.push('TYRANT');
            if (this.flags.has('hacktivist')) endings.push('HERO');
            if (this.values.loyalty > 80) endings.push('LOYAL_SOLDIER');
            if (this.values.secrecy < 20) endings.push('CAPTURED');
            if (this.values.idealism > 60 && this.values.criminality < 30) endings.push('REFORMED');
            
            return endings.length > 0 ? endings : ['NEUTRAL'];
        }

        notifyFlagUnlock(flag) {
            // Evento para el OS
            const event = new CustomEvent('karma-flag', { detail: { flag } });
            window.dispatchEvent(event);
        }

        // Debug (solo para desarrollo)
        debug() {
            return {
                values: this.values,
                flags: Array.from(this.flags),
                state: this.narrativeState,
                recentHistory: this.history.slice(-10)
            };
        }
    }

    const engine = new KarmaEngine();

    // API Pública (diseñada para ser opaca)
    return {
        recordAction: (type, ctx) => engine.recordAction(type, ctx),
        query: (type) => engine.query(type),
        hasFlag: (flag) => engine.flags.has(flag),
        getState: () => engine.narrativeState,
        
        // Solo para desarrollo
        _debug: () => engine.debug()
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KarmaSystem;
} else {
    window.KarmaSystem = KarmaSystem;
}