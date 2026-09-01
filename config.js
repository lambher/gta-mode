// Shared configuration for the points game mode.
// Loaded on both sides (see fxmanifest.lua) so the server can recompute every
// reward itself instead of trusting the value a client sends it.

const CATEGORY = {
    CIVILIAN: 'civilian',
    COP: 'cop',
    SWAT: 'swat',
    ARMY: 'army',
};

// Points awarded per kill: `ped` for the person, `vehicle` for blowing up the
// vehicle they were riding in.
const SCORES = {
    [CATEGORY.CIVILIAN]: { ped: 1, vehicle: 10 },
    [CATEGORY.COP]: { ped: 100, vehicle: 1000 },
    [CATEGORY.SWAT]: { ped: 1000, vehicle: 10000 },
    [CATEGORY.ARMY]: { ped: 1000, vehicle: 10000 },
};

const LABELS = {
    [CATEGORY.CIVILIAN]: 'Civil',
    [CATEGORY.COP]: 'Policier',
    [CATEGORY.SWAT]: 'GIGN',
    [CATEGORY.ARMY]: 'Militaire',
};

// Where and how players spawn.
const SPAWN = {
    position: { x: 686.245, y: 577.950, z: 130.461 },
    model: 'a_c_chimp',
    vehicle: 'Bati',
};

// Set to true for an arcade round where dying wipes your score.
const RESET_SCORE_ON_DEATH = false;

// ePedType -> category. The full enum is at the bottom of this file.
const PED_TYPE_CATEGORY = {
    6: CATEGORY.COP,   // PED_TYPE_COP
    27: CATEGORY.SWAT, // PED_TYPE_SWAT
    29: CATEGORY.ARMY, // PED_TYPE_ARMY
};

// GetPedType() flags a fair number of NOOSE and military models as plain cops,
// so a known model name always wins over the ped type.
const PED_MODELS = {
    [CATEGORY.COP]: [
        's_m_y_cop_01', 's_f_y_cop_01', 's_m_y_hwaycop_01',
        's_m_y_sheriff_01', 's_f_y_sheriff_01',
        's_m_y_ranger_01', 's_f_y_ranger_01',
        's_m_m_snowcop_01', 'csb_cop', 'mp_m_freemode_01_militia',
    ],
    [CATEGORY.SWAT]: [
        's_m_y_swat_01', 's_m_m_fibsec_01', 's_m_y_fibo_01',
        's_m_m_ciasec_01', 'mp_m_fibsec_01', 'u_m_m_doa_01',
    ],
    [CATEGORY.ARMY]: [
        's_m_y_marine_01', 's_m_y_marine_02', 's_m_y_marine_03',
        's_m_m_marine_01', 's_m_m_marine_02', 's_m_y_armymech_01',
        's_m_m_armoured_01', 's_m_m_armoured_02',
        's_m_y_blackops_01', 's_m_y_blackops_02', 's_m_y_blackops_03',
        's_m_y_uscg_01',
    ],
};

const VEHICLE_MODELS = {
    [CATEGORY.COP]: [
        'police', 'police2', 'police3', 'police4', 'policeb', 'policet',
        'policeold1', 'policeold2', 'sheriff', 'sheriff2', 'pranger',
        'polmav', 'predator', 'pbus',
    ],
    [CATEGORY.SWAT]: [
        'riot', 'riot2', 'fbi', 'fbi2', 'insurgent3',
    ],
    [CATEGORY.ARMY]: [
        'rhino', 'khanjali', 'barracks', 'barracks2', 'barracks3',
        'crusader', 'apc', 'barrage', 'halftrack', 'chernobog',
        'scarab', 'scarab2', 'scarab3', 'minitank', 'lazer',
        'trailersmall2', 'vetir',
    ],
};

// Last resort when the model is unknown: GetVehicleClass() 19 is Military.
// Class 18 (Emergency) is deliberately left out, it also covers ambulances and
// fire trucks which are not police.
const VEHICLE_CLASS_CATEGORY = {
    19: CATEGORY.ARMY,
};

// Same algorithm as GetHashKey(), kept in plain JS so the tables above can be
// resolved identically on the client and the server.
function joaat(text) {
    const key = String(text).toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash + key.charCodeAt(i)) >>> 0;
        hash = (hash + (hash << 10)) >>> 0;
        hash = (hash ^ (hash >>> 6)) >>> 0;
    }
    hash = (hash + (hash << 3)) >>> 0;
    hash = (hash ^ (hash >>> 11)) >>> 0;
    hash = (hash + (hash << 15)) >>> 0;
    return hash;
}

function hashTable(modelsByCategory) {
    const table = new Map();
    for (const [category, models] of Object.entries(modelsByCategory)) {
        for (const model of models) {
            table.set(joaat(model), category);
        }
    }
    return table;
}

const PED_MODEL_CATEGORY = hashTable(PED_MODELS);
const VEHICLE_MODEL_CATEGORY = hashTable(VEHICLE_MODELS);

// How much a category is worth as a whole, used to keep the best guess when
// several peds of different kinds ride the same vehicle.
function categoryRank(category) {
    const score = SCORES[category];
    return score ? score.ped + score.vehicle : 0;
}

// The single source of truth for a reward. Returns 0 for anything unknown,
// which is how the server rejects a malformed kill report.
function scoreFor(category, kind) {
    const score = SCORES[category];
    if (!score) {
        return 0;
    }
    return score[kind] || 0;
}

globalThis.GameMode = {
    CATEGORY,
    SCORES,
    LABELS,
    SPAWN,
    RESET_SCORE_ON_DEATH,
    PED_TYPE_CATEGORY,
    PED_MODEL_CATEGORY,
    VEHICLE_MODEL_CATEGORY,
    VEHICLE_CLASS_CATEGORY,
    joaat,
    categoryRank,
    scoreFor,
};

// enum ePedType
// {
// 	PED_TYPE_PLAYER_0,
// 	PED_TYPE_PLAYER_1,
// 	PED_TYPE_NETWORK_PLAYER,
// 	PED_TYPE_PLAYER_2,
// 	PED_TYPE_CIVMALE,
// 	PED_TYPE_CIVFEMALE,
// 	PED_TYPE_COP,
// 	PED_TYPE_GANG_ALBANIAN,
// 	PED_TYPE_GANG_BIKER_1,
// 	PED_TYPE_GANG_BIKER_2,
// 	PED_TYPE_GANG_ITALIAN,
// 	PED_TYPE_GANG_RUSSIAN,
// 	PED_TYPE_GANG_RUSSIAN_2,
// 	PED_TYPE_GANG_IRISH,
// 	PED_TYPE_GANG_JAMAICAN,
// 	PED_TYPE_GANG_AFRICAN_AMERICAN,
// 	PED_TYPE_GANG_KOREAN,
// 	PED_TYPE_GANG_CHINESE_JAPANESE,
// 	PED_TYPE_GANG_PUERTO_RICAN,
// 	PED_TYPE_DEALER,
// 	PED_TYPE_MEDIC,
// 	PED_TYPE_FIREMAN,
// 	PED_TYPE_CRIMINAL,
// 	PED_TYPE_BUM,
// 	PED_TYPE_PROSTITUTE,
// 	PED_TYPE_SPECIAL,
// 	PED_TYPE_MISSION,
// 	PED_TYPE_SWAT,
// 	PED_TYPE_ANIMAL,
// 	PED_TYPE_ARMY
// };
