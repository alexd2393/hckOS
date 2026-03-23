// ToolSystem - Gestión de herramientas
const ToolSystem = (function() {
    let inventory = new Set();
    let activeTools = new Set();
    let toolData = [];

    // Datos inline de respaldo (evita fetch con file:// protocol)
    const TOOLS_INLINE = [
        { id: 'password_cracker_basic',    name: 'John the Basher',           type: 'cracker',      tier: 1, hackBonus: 2,  specialAbility: 'DICTIONARY_ATTACK',  price: 500  },
        { id: 'password_cracker_advanced', name: 'HashCrack Pro',            type: 'cracker',      tier: 3, hackBonus: 8,  specialAbility: 'RAINBOW_TABLES',     price: 5000 },
        { id: 'packet_sniffer',            name: 'WireShark Noir',            type: 'sniffer',      tier: 2, hackBonus: 3,  specialAbility: 'TRAFFIC_ANALYSIS',   price: 1200 },
        { id: 'phantom',           name: 'Phantom v1',          type: 'bypass',       tier: 2, hackBonus: 5,  specialAbility: 'STEALTH_MODE',       price: 2500 },
        { id: 'cryptbreak',                 name: 'CryptoBreaker',             type: 'cryptbreak',    tier: 3, hackBonus: 6,  specialAbility: 'ZERO_DAY_EXPLOIT',   price: 8000 },
        { id: 'proxy_chain',               name: 'Onion Router X',            type: 'anonymizer',   tier: 1, hackBonus: 1,  specialAbility: 'TRACE_REDUCTION',    price: 300  },
        { id: 'rootkit',                   name: 'GhostRoot',                 type: 'malware',      tier: 4, hackBonus: 10, specialAbility: 'PERMANENT_ACCESS',   price: 15000},
        { id: 'social_engineering_kit',    name: 'Human Exploit Framework',   type: 'social',       tier: 2, hackBonus: 4,  specialAbility: 'PHISHING_BOOST',     price: 1800 },
        { id: 'hardware_implant',          name: 'USB Rubber Ducky',          type: 'physical',     tier: 3, hackBonus: 7,  specialAbility: 'OFFLINE_BREACH',     price: 3500 },
        { id: 'ai_assistant',             name: 'Neural Assistant v3',       type: 'utility',      tier: 3, hackBonus: 5,  specialAbility: 'AUTO_BREACH',        price: 6000 },
    ];

    async function loadTools() {
        try {
            const response = await fetch('./data/tools.json');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            toolData = data.tools;
        } catch (error) {
            console.warn('[ToolSystem] fetch falló, usando datos inline:', error.message);
            toolData = TOOLS_INLINE;
        }
        return toolData;
    }

    return {
        init: loadTools,
        
        unlock: (toolId) => {
            inventory.add(toolId);
            console.log(`[Tools] Desbloqueado: ${toolId}`);
        },
        
        equip: (toolId) => {
            if (inventory.has(toolId)) {
                activeTools.add(toolId);
                return true;
            }
            return false;
        },
        
        getActive: () => {
            return Array.from(activeTools).map(id => 
                toolData.find(t => t.id === id)
            ).filter(Boolean);
        },
        
        getHackBonus: () => {
            return Array.from(activeTools).reduce((sum, id) => {
                const tool = toolData.find(t => t.id === id);
                return sum + (tool?.hackBonus || 0);
            }, 0);
        },
        
        hasTool: (toolId) => inventory.has(toolId),
        
        getAvailable: () => toolData.filter(t => !inventory.has(t.id))
    };
})();

window.ToolSystem = ToolSystem;