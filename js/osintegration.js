/**
 * osIntegration.js - Capa de Integración para el Desarrollador del OS
 * 
 * UBICACIÓN: /js/osIntegration.js
 * 
 * Este archivo es PUENTE entre tu código del OS (UI, terminal, etc.)
 * y los sistemas de juego (Network, Missions, Karma, News).
 * 
 * NO modifica los sistemas existentes, solo los consume.
 */

const OSIntegration = (function() {
    'use strict';

    // Referencias a elementos UI del OS (ejemplos)
    let ui = {
        terminal: null,
        moneyDisplay: null,
        heatBar: null,
        newsFeed: null,
        missionPanel: null
    };

    /**
     * Inicializar referencias UI
     * Llama esto desde tu main.js del OS cuando el DOM esté listo
     */
    function initialize(osUI) {
        ui = { ...ui, ...osUI };
        console.log('[OSIntegration] UI vinculada');
        
        // Sincronizar estado inicial
        syncOSState();
    }

    /**
     * ============================================================
     * INTEGRACIÓN BÁSICA - MÉTODOS QUE USARÁS EN TU CÓDIGO
     * ============================================================
     */

    /**
     * Ejecutar cuando el jugador intente hackear desde tu terminal
     * Uso: Tu terminal llama esto en lugar de NetworkSystem directamente
     */
    async function executeHack(nodeId, tools = []) {
        // 1. Validar (tu lógica de UI)
        ui.terminal.printLine(`> Intentando breach en nodo ${nodeId}...`);
        
        // 2. Llamar a NetworkSystem (existente)
        const hackResult = NetworkSystem.breach(nodeId, tools);
        
        // 3. Si exitoso, procesar consecuencias mundiales (NUEVO)
        if (hackResult.success) {
            ui.terminal.printLine('> Breach exitoso. Procesando datos...');
            
            // OBTENER nodo completo para el conector
            const node = NetworkSystem.getNode(nodeId);
            
            // CONECTAR CON EL MUNDO (WorldConnector)
            const worldEffects = WorldConnector.handleSuccessfulHack(node);
            
            // 4. Actualizar UI del OS con resultados
            displayHackRewards(worldEffects.rewards);
            displayMissionUpdates(worldEffects.missionUpdates);
            displayNews(worldEffects.news);
            updateHeatDisplay(WorldConnector.getHeatLevel());
            
            // 5. Retornar para tu lógica adicional
            return {
                success: true,
                hack: hackResult,
                world: worldEffects
            };
            
        } else {
            // Hackeo fallido
            ui.terminal.printLine(`> Error: ${hackResult.message}`);
            
            // Procesar consecuencias de fallo
            WorldConnector.triggerWorldReaction('DETECTION_RISK', {
                level: hackResult.traceLevel
            });
            
            return { success: false, error: hackResult.message };
        }
    }

    /**
     * Ejecutar cuando el jugador descargue un archivo desde tu UI
     */
    async function executeDownload(fileId, nodeId) {
        // BUG #8 fix: stub de métodos de display que la IA dejó incompletos
        const node = NetworkSystem.getNode(nodeId);
        const file = NetworkSystem.getFiles(nodeId)?.find(f => f.name === fileId);
        if (!node || !file) return { success: false, error: 'Archivo o nodo no encontrado' };
        const result = await NetworkSystem.download(file.name, node.ip);
        if (result.ok && window.WorldConnector) {
            WorldConnector.handleFileDownload(file, node);
        }
        return result;
    }

    function displayHackRewards(rewards) {
        if (!rewards || !ui.terminal) return;
        if (rewards.money > 0) {
            GameLoop?.getTerminal()?.printLine(`[WorldConnector] +$${rewards.money} transferidos`, 'success');
        }
    }

    function displayMissionUpdates(updates) {
        if (!updates || !updates.length) return;
        updates.forEach(u => {
            if (u.completed) {
                UI?.notify?.(`Objetivo completado: ${u.missionTitle}`, 'success');
            }
        });
    }

    function displayNews(news) {
        if (!news) return;
        UI?.notify?.(`📰 ${news.headline}`, 'warning', 7000);
    }

    function updateHeatDisplay(heat) {
        document.body.style.setProperty('--heat-level', heat + '%');
    }

    function syncOSState() {
        if (window.GameState) {
            updateHeatDisplay(window.WorldConnector?.getHeatLevel() ?? 0);
        }
    }

    return {
        initialize,
        executeHack,
        executeDownload,
        syncOSState,
    };
})();

window.OSIntegration = OSIntegration;
