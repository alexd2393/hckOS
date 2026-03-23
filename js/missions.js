/**
 * missions.js - Motor de Misiones para AleXim OS
 * Carga y gestiona misiones desde JSON, maneja objetivos y recompensas
 */

const MissionSystem = (function() {
    'use strict';

    // Estados de misión
    const MISSION_STATUS = {
        AVAILABLE: 'available',
        ACTIVE: 'active',
        COMPLETED: 'completed',
        FAILED: 'failed',
        EXPIRED: 'expired'
    };

    // Tipos de objetivos
    const OBJECTIVE_TYPES = {
        STEAL_DATA: 'steal_data',
        INSTALL_MALWARE: 'install_malware',
        PHISHING: 'fisherman',
        BREACH_SERVER: 'breach_server',
        DELETE_EVIDENCE: 'delete_evidence',
        TRACE_USER: 'trace_user',
        ESCORT_DATA: 'escort_data',
        FRAME_INNOCENT: 'frame_innocent'
    };

    let missionsData = [];
    let activeMissions = new Map();
    let completedMissions = new Set();
    let missionCallbacks = {};

    // Cargar misiones desde JSON (path relativo para compatibilidad con file://)
    async function loadMissions(url = './data/missions.json') {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            missionsData = await response.json();
            console.log(`[Missions] ${missionsData.length} misiones cargadas`);
            return missionsData;
        } catch (error) {
            console.warn('[Missions] fetch falló, misiones se cargarán via patch:', error.message);
            return [];
        }
    }

    // Clase Misión
    class Mission {
        constructor(data) {
            this.id = data.id;
            this.title = data.title;
            this.description = data.description;
            this.client = data.client;
            this.difficulty = data.difficulty || 1;
            this.reward = data.reward;
            this.type = data.type;
            this.objectives = data.objectives.map(obj => ({
                ...obj,
                completed: false,
                progress: 0,
                target: obj.target || 1
            }));
            this.timeLimit = data.timeLimit || null; // en minutos
            this.startTime = null;
            this.deadline = null;
            this.status = MISSION_STATUS.AVAILABLE;
            this.karmaImpact = data.karmaImpact || {};
            this.unlocks = data.unlocks || [];
            this.requires = data.requires || [];
            this.hidden = data.hidden || false;
        }

        start() {
            if (this.status !== MISSION_STATUS.AVAILABLE) {
                return { success: false, message: 'Misión no disponible' };
            }

            this.status = MISSION_STATUS.ACTIVE;
            this.startTime = Date.now();
            if (this.timeLimit) {
                this.deadline = this.startTime + (this.timeLimit * 60000);
            }

            // Notificar a otros sistemas
            this.notifyStart();
            
            return { 
                success: true, 
                message: `Misión iniciada: ${this.title}`,
                mission: this.getStatus()
            };
        }

        updateObjective(objectiveId, progress = 1, data = {}) {
            const objective = this.objectives.find(o => o.id === objectiveId);
            if (!objective || objective.completed) return false;

            objective.progress += progress;
            
            // Verificar si objetivo completado
            if (objective.progress >= objective.target) {
                objective.completed = true;
                this.checkObjectiveCompletion(objective, data);
            }

            // Verificar si misión completada
            if (this.isComplete()) {
                this.complete();
            }

            return objective.completed;
        }

        checkObjectiveCompletion(objective, data) {
            // Registrar en karma según tipo
            if (window.KarmaSystem) {
                const karmaMap = {
                    [OBJECTIVE_TYPES.STEAL_DATA]: 'DATA_THEFT',
                    [OBJECTIVE_TYPES.PHISHING]: 'SCAM',
                    [OBJECTIVE_TYPES.INSTALL_MALWARE]: 'MALWARE_DIST',
                    [OBJECTIVE_TYPES.FRAME_INNOCENT]: 'FRAME_UP'
                };

                if (karmaMap[objective.type]) {
                    KarmaSystem.recordAction(karmaMap[objective.type], {
                        mission: this.id,
                        target: data.target || 'unknown',
                        value: data.value || 0
                    });
                }
            }
        }

        isComplete() {
            return this.objectives.every(o => o.completed);
        }

        complete() {
            this.status = MISSION_STATUS.COMPLETED;
            completedMissions.add(this.id);
            activeMissions.delete(this.id);

            // Otorgar recompensas
            this.grantRewards();
            
            // Desbloquear misiones
            this.unlockMissions();

            // Notificar
            this.notifyComplete();

            return {
                success: true,
                rewards: this.reward,
                message: `Misión completada: ${this.title}`
            };
        }

        grantRewards() {
            // Integrar con sistema económico del OS
            if (window.AleXimOS && window.AleXimOS.wallet) {
                window.AleXimOS.wallet.add(this.reward.money || 0);
            }

            // Reputación
            if (window.ReputationSystem) {
                window.ReputationSystem.modify(
                    this.client, 
                    this.reward.reputation || 0
                );
            }

            // Herramientas
            if (this.reward.tools) {
                this.reward.tools.forEach(tool => {
                    if (window.ToolSystem) {
                        window.ToolSystem.unlock(tool);
                    }
                });
            }
        }

        unlockMissions() {
            this.unlocks.forEach(missionId => {
                const mission = missionsData.find(m => m.id === missionId);
                if (mission) {
                    mission.hidden = false;
                    this.notifyUnlock(mission);
                }
            });
        }

        fail(reason = 'Tiempo agotado') {
            this.status = MISSION_STATUS.FAILED;
            activeMissions.delete(this.id);
            
            // Karma negativo por fallo
            if (window.KarmaSystem) {
                KarmaSystem.recordAction('MISSION_FAILED', {
                    mission: this.id,
                    reason: reason
                });
            }

            return {
                success: false,
                message: `Misión fallida: ${reason}`
            };
        }

        getStatus() {
            return {
                id: this.id,
                title: this.title,
                status: this.status,
                progress: this.calculateProgress(),
                timeRemaining: this.deadline ? this.deadline - Date.now() : null,
                objectives: this.objectives.map(o => ({
                    id: o.id,
                    description: o.description,
                    completed: o.completed,
                    progress: `${o.progress}/${o.target}`
                }))
            };
        }

        calculateProgress() {
            const completed = this.objectives.filter(o => o.completed).length;
            return Math.floor((completed / this.objectives.length) * 100);
        }

        notifyStart() {
            if (missionCallbacks['missionStart']) {
                missionCallbacks['missionStart'](this);
            }
        }

        notifyComplete() {
            if (missionCallbacks['missionComplete']) {
                missionCallbacks['missionComplete'](this);
            }
        }

        notifyUnlock(mission) {
            if (missionCallbacks['missionUnlock']) {
                missionCallbacks['missionUnlock'](mission);
            }
        }
    }

    // Gestor de Misiones
    const missionManager = {
        async initialize() {
            await loadMissions();
            this.startTimer();
        },

        getAvailableMissions() {
            return missionsData
                .filter(m => !m.hidden && 
                    !completedMissions.has(m.id) && 
                    !activeMissions.has(m.id))
                .filter(m => {
                    // Verificar prerequisitos
                    return !m.requires || m.requires.every(req => 
                        completedMissions.has(req)
                    );
                })
                .map(m => ({
                    id: m.id,
                    title: m.title,
                    difficulty: m.difficulty,
                    reward: m.reward,
                    client: m.client,
                    type: m.type
                }));
        },

        startMission(missionId) {
            const data = missionsData.find(m => m.id === missionId);
            if (!data) return { success: false, message: 'Misión no encontrada' };

            const mission = new Mission(data);
            const result = mission.start();
            
            if (result.success) {
                activeMissions.set(missionId, mission);
            }
            
            return result;
        },

        updateMissionProgress(missionId, objectiveId, progress, data) {
            const mission = activeMissions.get(missionId);
            if (!mission) return { success: false, message: 'Misión no activa' };

            return mission.updateObjective(objectiveId, progress, data);
        },

        getActiveMissions() {
            return Array.from(activeMissions.values()).map(m => m.getStatus());
        },

        // Verificar eventos del juego contra objetivos activos
        checkEvent(eventType, eventData) {
            activeMissions.forEach(mission => {
                mission.objectives.forEach(obj => {
                    if (obj.type === eventType && !obj.completed) {
                        // Verificar condiciones específicas
                        if (this.matchesObjective(obj, eventData)) {
                            mission.updateObjective(obj.id, 1, eventData);
                        }
                    }
                });
            });
        },

        matchesObjective(objective, eventData) {
            // Lógica de matching según condiciones del objetivo
            if (objective.conditions) {
                return Object.entries(objective.conditions).every(([key, value]) => {
                    return eventData[key] === value;
                });
            }
            return true;
        },

        startTimer() {
            // Verificar timeouts cada minuto
            setInterval(() => {
                const now = Date.now();
                activeMissions.forEach(mission => {
                    if (mission.deadline && now > mission.deadline) {
                        mission.fail('Tiempo agotado');
                    }
                });
            }, 60000);
        },

        on(event, callback) {
            missionCallbacks[event] = callback;
        }
    };

    // API Pública
    return {
        init: () => missionManager.initialize(),
        load: loadMissions,
        available: () => missionManager.getAvailableMissions(),
        start: (id) => missionManager.startMission(id),
        active: () => missionManager.getActiveMissions(),
        update: (mId, oId, prog, data) => 
            missionManager.updateMissionProgress(mId, oId, prog, data),
        check: (type, data) => missionManager.checkEvent(type, data),
        on: (event, cb) => missionManager.on(event, cb),
        MISSION_STATUS,
        OBJECTIVE_TYPES
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MissionSystem;
} else {
    window.MissionSystem = MissionSystem;
}