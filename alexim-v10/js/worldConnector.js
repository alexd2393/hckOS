/**
 * worldConnector.js - Sistema de Integración Mundial para AleXim OS
 * Conecta NetworkSystem, KarmaSystem, MissionSystem y NewsSystem
 * Genera consecuencias dinámicas basadas en acciones del jugador
 */

const WorldConnector = (function() {
    'use strict';

    // Configuración de efectos por tipo de nodo
    const NODE_EFFECTS = {
        BANK: {
            baseReward: 2500,
            karmaImpact: { criminality: 8, humanity: -3, secrecy: -2 },
            newsChance: 0.7,
            newsTypes: ['FINANCIAL_THEFT', 'DATA_BREACH'],
            heatValue: 15
        },
        CORPORATE: {
            baseReward: 1200,
            karmaImpact: { criminality: 5, humanity: -1, secrecy: -1 },
            newsChance: 0.4,
            newsTypes: ['DATA_BREACH', 'CORPORATE_ESPIONAGE'],
            heatValue: 8
        },
        GOVERNMENT: {
            baseReward: 5000,
            karmaImpact: { criminality: 12, humanity: -2, idealism: 5, secrecy: -5 },
            newsChance: 0.9,
            newsTypes: ['GOVERNMENT_BREACH', 'WHISTLEBLOW'],
            heatValue: 25
        },
        PERSONAL: {
            baseReward: 300,
            karmaImpact: { criminality: 3, humanity: -4, secrecy: 0 },
            newsChance: 0.1,
            newsTypes: ['IDENTITY_THEFT'],
            heatValue: 3
        },
        MILITARY: {
            baseReward: 8000,
            karmaImpact: { criminality: 15, humanity: -5, secrecy: -8 },
            newsChance: 1.0,
            newsTypes: ['SECURITY_BREACH', 'TERRORISM_SUSPICION'],
            heatValue: 40
        },
        HOSPITAL: {
            baseReward: 1800,
            karmaImpact: { criminality: 10, humanity: -8, secrecy: -3 },
            newsChance: 0.8,
            newsTypes: ['MEDICAL_DATA_THEFT', 'RANSOMWARE_ATTACK'],
            heatValue: 20
        }
    };

    // Configuración de archivos especiales para misiones
    const SPECIAL_FILES = {
        'classified.pdf': { missionTrigger: 'steal_classified', value: 5000 },
        'transactions.db': { missionTrigger: 'financial_fraud', value: 3000 },
        'emails.pst': { missionTrigger: 'corporate_espionage', value: 2000 },
        'citizens.db': { missionTrigger: 'mass_surveillance', value: 4000 },
        'medical_records.enc': { missionTrigger: 'health_data_theft', value: 3500 },
        'audit.log': { missionTrigger: 'cover_tracks', value: 1000 }
    };

    // Estado del mundo
    let worldState = {
        totalHacks: 0,
        totalMoneyStolen: 0,
        currentHeat: 0,
        activeConsequences: [],
        lastHackTimestamp: null
    };

    /**
     * Maneja un hackeo exitoso completo
     */
    function handleSuccessfulHack(node) {
        console.log(`[WorldConnector] Procesando hackeo: ${node.name}`);
        
        const effects = NODE_EFFECTS[node.type] || NODE_EFFECTS.PERSONAL;
        const results = {
            nodeId: node.id,
            timestamp: Date.now(),
            rewards: {},
            karma: {},
            news: null,
            missionUpdates: [],
            worldChanges: []
        };

        // 1. Otorgar recompensas monetarias
        results.rewards = grantHackRewards(node, effects);
        
        // 2. Registrar en KarmaSystem
        results.karma = updateKarmaFromHack(node, effects);
        
        // 3. Actualizar misiones activas
        results.missionUpdates = checkMissionProgress(node, 'BREACH');
        
        // 4. Generar noticias si aplica
        results.news = generateHackNews(node, effects);
        
        // 5. Actualizar estado mundial
        updateWorldState(node, effects, results);
        
        // 6. Verificar consecuencias encadenadas
        results.worldChanges = checkChainReactions(node, effects);
        
        // Emitir evento global
        emitWorldEvent('HACK_COMPLETED', results);
        
        return results;
    }

    /**
     * Maneja la descarga de archivos específicos
     */
    function handleFileDownload(file, node) {
        console.log(`[WorldConnector] Archivo descargado: ${file.name} de ${node.name}`);
        
        const results = {
            fileId: file.id,
            fileName: file.name,
            nodeType: node.type,
            rewards: {},
            karma: {},
            missionUpdates: [],
            specialContent: null
        };

        // 1. Recompensa por valor del archivo
        results.rewards = grantFileRewards(file, node);
        
        // 2. Karma específico por tipo de archivo
        results.karma = updateKarmaFromFile(file, node);
        
        // 3. Verificar si es archivo de misión
        results.missionUpdates = checkMissionFileObjective(file, node);
        
        // 4. Verificar contenido especial
        results.specialContent = revealFileContent(file, node);
        
        // 5. Si es archivo sensible, posible noticia adicional
        if (file.encrypted || file.value > 3000) {
            generateFileNews(file, node);
        }
        
        emitWorldEvent('FILE_DOWNLOADED', results);
        return results;
    }

    /**
     * Dispara reacciones del mundo basadas en acciones
     */
    function triggerWorldReaction(actionType, context = {}) {
        const reactions = [];
        
        switch(actionType) {
            case 'DETECTION_RISK':
                reactions.push(handleDetectionRisk(context));
                break;
            case 'REPUTATION_CHANGE':
                reactions.push(handleReputationShift(context));
                break;
            case 'KARMA_THRESHOLD':
                reactions.push(handleKarmaMilestone(context));
                break;
            case 'ECONOMIC_IMPACT':
                reactions.push(handleEconomicShift(context));
                break;
            case 'FACTION_REACTION':
                reactions.push(handleFactionResponse(context));
                break;
        }
        
        // Verificar si alguna reacción desbloquea contenido
        reactions.forEach(reaction => {
            if (reaction.unlocks) {
                reaction.unlocks.forEach(unlock => {
                    unlockContent(unlock);
                });
            }
        });
        
        return reactions;
    }

    // ============================================================
    // FUNCIONES INTERNAS DE SISTEMA
    // ============================================================

    function grantHackRewards(node, effects) {
        // Calcular recompensa base con variación
        const variation = 0.8 + (Math.random() * 0.4); // ±20%
        const baseAmount = effects.baseReward * variation;
        
        // Bonus por nivel de seguridad
        const difficultyBonus = node.securityLevel * 100;
        
        // Bonus por sigilo (si implementamos sistema de detección)
        const stealthBonus = worldState.currentHeat < 30 ? 500 : 0;
        
        const totalMoney = Math.floor(baseAmount + difficultyBonus + stealthBonus);
        const dataPoints = Math.floor(node.files.length * 50 * node.securityLevel);
        
        // Integrar con sistema económico del OS
        if (window.AleXimOS && window.AleXimOS.wallet) {
            window.AleXimOS.wallet.add(totalMoney);
        }
        
        // Actualizar estadísticas
        worldState.totalMoneyStolen += totalMoney;
        
        return {
            money: totalMoney,
            dataPoints: dataPoints,
            reputation: Math.floor(node.securityLevel * 2),
            breakdown: {
                base: Math.floor(baseAmount),
                difficulty: difficultyBonus,
                stealth: stealthBonus
            }
        };
    }

    function grantFileRewards(file, node) {
        // Valor específico del archivo
        const fileValue = file.value || 500;
        const decryptBonus = file.encrypted ? fileValue * 0.5 : 0;
        const totalValue = Math.floor(fileValue + decryptBonus);
        
        if (window.AleXimOS && window.AleXimOS.wallet) {
            window.AleXimOS.wallet.add(totalValue);
        }
        
        return {
            money: totalValue,
            dataValue: fileValue,
            decryptBonus: Math.floor(decryptBonus),
            fileType: file.type
        };
    }

    function updateKarmaFromHack(node, effects) {
        // Preparar contexto enriquecido
        const context = {
            target: node.name,
            type: node.type,
            securityLevel: node.securityLevel,
            filesCount: node.files.length,
            moneyGained: effects.baseReward,
            timestamp: Date.now()
        };
        
        // Registrar acción principal
        KarmaSystem.recordAction('SUCCESSFUL_HACK', context);
        
        // Registrar impactos específicos
        const impacts = [];
        Object.entries(effects.karmaImpact).forEach(([dimension, value]) => {
            // Ajustar por nivel de seguridad
            const adjustedValue = Math.floor(value * (1 + node.securityLevel / 10));
            
            // Crear acción específica por dimensión
            const actionMap = {
                criminality: 'CRIMINAL_ESCALATION',
                humanity: 'MORAL_COMPROMISE',
                secrecy: 'EXPOSURE_RISK',
                idealism: 'IDEOLOGICAL_CHOICE',
                loyalty: 'FACTION_BETRAYAL'
            };
            
            if (actionMap[dimension]) {
                KarmaSystem.recordAction(actionMap[dimension], {
                    ...context,
                    dimension: dimension,
                    impact: adjustedValue
                });
                impacts.push({ dimension, value: adjustedValue });
            }
        });
        
        return { impacts, context };
    }

    function updateKarmaFromFile(file, node) {
        const context = {
            fileName: file.name,
            fileType: file.type,
            encrypted: file.encrypted,
            value: file.value,
            origin: node.type
        };
        
        // Karma específico por tipo de archivo
        if (file.type === 'db' && file.name.includes('citizens')) {
            KarmaSystem.recordAction('MASS_SURVEILLANCE_THEFT', context);
        } else if (file.type === 'pdf' && file.name.includes('classified')) {
            KarmaSystem.recordAction('CLASSIFIED_ACCESS', context);
        } else if (file.type === 'txt' && file.name.includes('password')) {
            KarmaSystem.recordAction('CREDENTIAL_THEFT', context);
        } else if (file.type === 'enc') {
            KarmaSystem.recordAction('ENCRYPTED_DATA_THEFT', context);
        }
        
        return context;
    }

    function checkMissionProgress(node, actionType) {
        const updates = [];
        
        // Verificar misiones activas
        const activeMissions = MissionSystem.active();
        
        activeMissions.forEach(mission => {
            mission.objectives.forEach(objective => {
                // Verificar si el objetivo coincide con la acción
                let progress = 0;
                let matches = false;
                
                if (objective.type === 'breach_server' && actionType === 'BREACH') {
                    // Verificar condiciones específicas
                    if (objective.conditions) {
                        matches = Object.entries(objective.conditions).every(([key, val]) => {
                            if (key === 'systemType') return node.type === val;
                            if (key === 'minSecurity') return node.securityLevel >= val;
                            return true;
                        });
                    } else {
                        matches = true;
                    }
                }
                
                if (matches) {
                    const result = MissionSystem.update(
                        mission.id, 
                        objective.id, 
                        1, 
                        { node: node.id, type: node.type }
                    );
                    updates.push({
                        missionId: mission.id,
                        objectiveId: objective.id,
                        completed: result,
                        missionTitle: mission.title
                    });
                }
            });
        });
        
        return updates;
    }

    function checkMissionFileObjective(file, node) {
        const updates = [];
        
        // Verificar si el archivo completa algún objetivo
        const activeMissions = MissionSystem.active();
        
        activeMissions.forEach(mission => {
            mission.objectives.forEach(objective => {
                if (objective.type === 'steal_data') {
                    let matches = false;
                    
                    // Verificar por nombre de archivo
                    if (objective.conditions && objective.conditions.fileName) {
                        matches = file.name.includes(objective.conditions.fileName);
                    }
                    
                    // Verificar por tipo de archivo
                    if (objective.conditions && objective.conditions.fileType) {
                        matches = matches || file.type === objective.conditions.fileType;
                    }
                    
                    // Verificar por origen
                    if (objective.conditions && objective.conditions.originType) {
                        matches = matches && node.type === objective.conditions.originType;
                    }
                    
                    if (matches) {
                        MissionSystem.update(mission.id, objective.id, 1, {
                            file: file.name,
                            node: node.name
                        });
                        updates.push({
                            missionId: mission.id,
                            objectiveId: objective.id,
                            file: file.name
                        });
                    }
                }
            });
        });
        
        // Verificar archivos especiales que desbloquean misiones
        const specialFile = SPECIAL_FILES[file.name];
        if (specialFile && !updates.length) {
            // Podría desbloquear misión secreta
            triggerWorldReaction('SPECIAL_DISCOVERY', {
                file: file.name,
                missionTrigger: specialFile.missionTrigger
            });
        }
        
        return updates;
    }

    function generateHackNews(node, effects) {
        if (Math.random() > effects.newsChance) return null;
        
        const newsType = effects.newsTypes[Math.floor(Math.random() * effects.newsTypes.length)];
        
        const newsContext = {
            target: node.name,
            sector: getSectorName(node.type),
            amount: effects.baseReward,
            alias: getPlayerAlias(),
            severity: node.securityLevel > 7 ? 'critical' : 'moderate'
        };
        
        // Generar noticia a través del sistema de noticias
        const news = NewsSystem.report(newsType, newsContext);
        
        // Si es noticia crítica, aumentar heat global
        if (newsContext.severity === 'critical') {
            worldState.currentHeat += effects.heatValue;
            triggerWorldReaction('DETECTION_RISK', { level: worldState.currentHeat });
        }
        
        return news;
    }

    function generateFileNews(file, node) {
        const newsContext = {
            fileType: file.type.toUpperCase(),
            dataSize: file.size,
            target: node.name,
            encrypted: file.encrypted
        };
        
        NewsSystem.report('DATA_LEAK', newsContext);
    }

    function revealFileContent(file, node) {
        // Simular contenido revelado que puede tener valor narrativo
        const revelations = [];
        
        if (file.name.includes('corruption')) {
            revelations.push({
                type: 'PLOT_POINT',
                content: 'Evidence of government corruption discovered',
                unlocks: 'mission_whistleblower'
            });
            KarmaSystem.recordAction('CORRUPTION_DISCOVERED', { file: file.name });
        }
        
        if (file.name.includes('conspiracy')) {
            revelations.push({
                type: 'LORE',
                content: 'Hidden connections between corporations and government',
                unlocks: 'contact_insider'
            });
        }
        
        if (file.type === 'db' && Math.random() > 0.7) {
            revelations.push({
                type: 'BLACKMAIL_MATERIAL',
                value: file.value * 2,
                target: generateRandomNPC()
            });
        }
        
        return revelations.length > 0 ? revelations : null;
    }

    function updateWorldState(node, effects, results) {
        worldState.totalHacks++;
        worldState.lastHackTimestamp = Date.now();
        worldState.currentHeat = Math.min(100, worldState.currentHeat + effects.heatValue);
        
        // Verificar umbrales de heat
        if (worldState.currentHeat > 80) {
            triggerWorldReaction('KARMA_THRESHOLD', { type: 'HIGH_HEAT' });
        }
        
        // Guardar consecuencia activa
        worldState.activeConsequences.push({
            type: 'HACK',
            timestamp: Date.now(),
            heat: effects.heatValue,
            expires: Date.now() + (3600000 * 24) // 24 horas
        });
    }

    function checkChainReactions(node, effects) {
        const changes = [];
        
        // Si heat es muy alto, posible investigación
        if (worldState.currentHeat > 60 && Math.random() > 0.5) {
            changes.push({
                type: 'INVESTIGATION_STARTED',
                description: 'Law enforcement increasing cybercrime unit activity',
                effect: 'future_hacks_harder'
            });
        }
        
        // Si es banco y robo masivo, mercado financiero afectado
        if (node.type === 'BANK' && effects.baseReward > 3000) {
            changes.push({
                type: 'ECONOMIC_IMPACT',
                description: 'Bank stocks dropping after security breach',
                effect: 'bank_security_upgraded'
            });
        }
        
        // Karma específico puede desbloquear eventos
        const karmaState = KarmaSystem.getState();
        if (karmaState === 'CRIMINAL' && worldState.totalHacks > 5) {
            changes.push({
                type: 'REPUTATION_CHANGE',
                description: 'Underworld reputation growing',
                unlocks: 'black_market_tier2'
            });
        }
        
        return changes;
    }

    // ============================================================
    // MANEJADORES DE REACCIONES DEL MUNDO
    // ============================================================

    function handleDetectionRisk(context) {
        const level = context.level || worldState.currentHeat;
        
        if (level > 90) {
            // Riesgo máximo - posible final de juego cercano
            return {
                type: 'MANHUNT',
                severity: 'critical',
                description: 'Your identity is being actively hunted',
                action: 'evacuate_now'
            };
        } else if (level > 70) {
            // Investigación activa
            NewsSystem.report('HACKER_PROFILE', { alias: getPlayerAlias() });
            return {
                type: 'INVESTIGATION',
                severity: 'high',
                description: 'Digital forensics team assigned to your case',
                effect: 'trace_level_increased'
            };
        }
        
        return { type: 'MONITORING', severity: 'low' };
    }

    function handleKarmaMilestone(context) {
        const state = KarmaSystem.getState();
        const changes = [];
        
        if (state === 'MONSTER') {
            changes.push({
                type: 'FEAR_REPUTATION',
                description: 'Other hackers fear you',
                unlocks: 'intimidation_options'
            });
        } else if (state === 'WHISTLEBLOWER') {
            changes.push({
                type: 'SUPPORT_NETWORK',
                description: 'Activists willing to help you',
                unlocks: 'safe_houses'
            });
        }
        
        return changes;
    }

    function handleReputationShift(context) {
        // Afectar precios en mercado negro
        if (window.BlackMarket) {
            const multiplier = context.reputation > 50 ? 0.9 : 1.1;
            window.BlackMarket.setReputationDiscount(multiplier);
        }
        
        return {
            type: 'MARKET_REACTION',
            priceModifier: context.reputation > 50 ? 'discount' : 'premium'
        };
    }

    function handleEconomicShift(context) {
        // Afectar recompensas futuras
        if (context.sector === 'BANK') {
            NODE_EFFECTS.BANK.baseReward *= 0.9; // Bancos suben seguridad, menos dinero fácil
        }
        
        return {
            type: 'SECTOR_SECURITY_INCREASE',
            sector: context.sector
        };
    }

    function handleFactionResponse(context) {
        // Las facciones reaccionan a tus acciones
        const faction = context.faction || 'syndicate';
        
        if (KarmaSystem.hasFlag('dark_path')) {
            return {
                type: 'FACTION_RESPECT',
                faction: faction,
                offer: 'elite_missions'
            };
        }
        
        return { type: 'FACTION_NEUTRAL' };
    }

    // ============================================================
    // UTILIDADES
    // ============================================================

    function getSectorName(nodeType) {
        const sectors = {
            BANK: 'financiero',
            CORPORATE: 'corporativo',
            GOVERNMENT: 'gubernamental',
            PERSONAL: 'privado',
            MILITARY: 'militar',
            HOSPITAL: 'salud'
        };
        return sectors[nodeType] || 'desconocido';
    }

    function getPlayerAlias() {
        return (window.AleXimOS && window.AleXimOS.player && window.AleXimOS.player.alias) 
            || 'UnknownHacker';
    }

    function generateRandomNPC() {
        const names = ['Senator Blake', 'CEO Nakamura', 'Director Vance', 'Dr. Chen'];
        return names[Math.floor(Math.random() * names.length)];
    }

    function unlockContent(contentId) {
        console.log(`[WorldConnector] Desbloqueado: ${contentId}`);
        const event = new CustomEvent('content-unlocked', { 
            detail: { contentId, timestamp: Date.now() } 
        });
        window.dispatchEvent(event);
    }

    function emitWorldEvent(type, data) {
        const event = new CustomEvent('world-event', {
            detail: { type, data, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
        
        // También log para debug
        console.log(`[WorldEvent] ${type}`, data);
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================

    return {
        // Métodos principales requeridos
        handleSuccessfulHack,
        handleFileDownload,
        triggerWorldReaction,
        
        // Utilidades de consulta
        getWorldState: () => ({ ...worldState }),
        getHeatLevel: () => worldState.currentHeat,
        resetHeat: () => { worldState.currentHeat = 0; },
        
        // Configuración
        setNodeEffect: (type, config) => {
            NODE_EFFECTS[type] = { ...NODE_EFFECTS[type], ...config };
        }
    };
})();

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldConnector;
} else {
    window.WorldConnector = WorldConnector;
}