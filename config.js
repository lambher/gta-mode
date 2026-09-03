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
    [CATEGORY.ARMY]: { ped: 2000, vehicle: 20000 },
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

// Présenter le score comme de l'argent GTA plutôt qu'un compteur de points.
// Purement cosmétique : le solde qui fait foi reste celui du serveur, le HUD
// de GTA Online n'en est qu'un reflet.
const MONEY = {
    enabled: true,
    symbol: '$',
};

// Affichage du meilleur joueur sur la carte
const LEADER_BLIP = {
    enabled: true,
    updateInterval: 5000, // Fréquence de rafraîchissement de la position (ms)
    stealthRadius: 150.0, // Rayon de furtivité en mètres (disparition du blip)
};

// Ce qui arrive à l'argent quand on meurt.
//   'bloodstain' : il tombe sur place, à récupérer en revenant le chercher.
//                  N'importe qui peut le ramasser : tuer quelqu'un, c'est
//                  pouvoir prendre sa thune.
//   'keep'       : on garde tout, la mort ne coûte rien.
//   'wipe'       : tout est perdu.
// Les armes achetées ne tombent jamais : dépenser, c'est mettre à l'abri.
const DEATH = {
    mode: 'bloodstain',
    // Fraction de l'argent qui tombe. 1 = tout.
    dropRatio: 1,
    // Distance à laquelle on ramasse une tache, en mètres.
    pickupRadius: 2.5,
};

// La série. Elle monte à chaque kill enchaîné, retombe après un silence, et
// casse net dès qu'on se prend un coup.
const MOMENTUM = {
    // Délai maximum entre deux kills pour garder la série, en ms.
    window: 10000,
    // Multiplicateur atteint à partir de N kills d'affilée.
    tiers: [
        { kills: 3, multiplier: 1.5 },
        { kills: 6, multiplier: 2 },
        { kills: 10, multiplier: 3 },
        { kills: 15, multiplier: 4 },
        { kills: 20, multiplier: 5 },
    ],
};

function multiplierFor(streak) {
    let multiplier = 1;
    for (const tier of MOMENTUM.tiers) {
        if (streak >= tier.kills) {
            multiplier = tier.multiplier;
        }
    }
    return multiplier;
}

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

// Amounts are written the same way on both sides: the shop menu, the kill
// feed, and the refusals the server sends back.
function formatAmount(value) {
    const digits = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return MONEY.enabled ? `${MONEY.symbol}${digits}` : `${digits} pts`;
}

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


// ---------------------------------------------------------------------------
// Armurerie
// ---------------------------------------------------------------------------

// Buying is only allowed once the police have fully lost you. GTA keeps the
// stars up (flashing) for the whole search phase, so a wanted level of 0 is
// exactly "the chase is over".
const SHOP = {
    maxWantedLevel: 0,
    // Buying a weapon you already own only refills its ammo, at this fraction
    // of the full price.
    refillRatio: 0.2,
};

// Prices are set against what each target is worth, so every tier is roughly
// paid for by the income of the tier below it:
//   melee/pistols  a few dozen civilians (1 pt) or their cars (10 pts)
//   SMG/shotguns   one good 2-star fight (cop 100 pts, police car 1000 pts)
//   assault rifles several cop fights, or one NOOSE engagement (1000 pts)
//   sniper/MG      NOOSE income, incl. their vehicles (10 000 pts)
//   explosives     army income (2000 pts a soldier, 20 000 pts a tank)
// You literally have to raise the police response to afford the gear needed to
// survive it.
const SHOP_CATEGORIES = [
    {
        id: 'melee',
        label: 'Corps à corps',
        items: [
            { name: 'WEAPON_KNUCKLE', label: 'Poing américain', price: 50, ammo: 1 },
            { name: 'WEAPON_KNIFE', label: 'Couteau', price: 75, ammo: 1 },
            { name: 'WEAPON_BAT', label: 'Batte de baseball', price: 75, ammo: 1 },
            { name: 'WEAPON_MACHETE', label: 'Machette', price: 150, ammo: 1 },
            { name: 'WEAPON_HATCHET', label: 'Hachette', price: 150, ammo: 1 },
        ],
    },
    {
        id: 'pistol',
        label: 'Pistolets',
        items: [
            { name: 'WEAPON_PISTOL', label: 'Pistolet', price: 250, ammo: 100 },
            { name: 'WEAPON_SNSPISTOL', label: 'Pistolet SNS', price: 350, ammo: 100 },
            { name: 'WEAPON_COMBATPISTOL', label: 'Pistolet de combat', price: 500, ammo: 120 },
            { name: 'WEAPON_APPISTOL', label: 'Pistolet automatique', price: 900, ammo: 150 },
            { name: 'WEAPON_HEAVYPISTOL', label: 'Pistolet lourd', price: 1200, ammo: 120 },
            { name: 'WEAPON_REVOLVER', label: 'Revolver', price: 1500, ammo: 60 },
        ],
    },
    {
        id: 'smg',
        label: 'Mitraillettes / Fusils à pompe',
        items: [
            { name: 'WEAPON_MICROSMG', label: 'Micro-SMG', price: 1500, ammo: 250 },
            { name: 'WEAPON_SAWNOFFSHOTGUN', label: 'Fusil à canon scié', price: 1800, ammo: 60 },
            { name: 'WEAPON_SMG', label: 'SMG', price: 2500, ammo: 300 },
            { name: 'WEAPON_PUMPSHOTGUN', label: 'Fusil à pompe', price: 2800, ammo: 80 },
            { name: 'WEAPON_ASSAULTSMG', label: 'SMG d\'assaut', price: 3500, ammo: 300 },
            { name: 'WEAPON_COMBATPDW', label: 'PDW de combat', price: 4000, ammo: 300 },
        ],
    },
    {
        id: 'rifle',
        label: 'Fusils d\'assaut',
        items: [
            { name: 'WEAPON_ASSAULTRIFLE', label: 'Fusil d\'assaut', price: 6000, ammo: 400 },
            { name: 'WEAPON_CARBINERIFLE', label: 'Carabine d\'assaut', price: 8000, ammo: 400 },
            { name: 'WEAPON_BULLPUPRIFLE', label: 'Fusil bullpup', price: 9000, ammo: 400 },
            { name: 'WEAPON_SPECIALCARBINE', label: 'Carabine spéciale', price: 10000, ammo: 400 },
            { name: 'WEAPON_ADVANCEDRIFLE', label: 'Fusil avancé', price: 12000, ammo: 400 },
        ],
    },
    {
        id: 'heavy',
        label: 'Précision / Mitrailleuses',
        items: [
            { name: 'WEAPON_SNIPERRIFLE', label: 'Fusil de précision', price: 15000, ammo: 50 },
            { name: 'WEAPON_MG', label: 'Mitrailleuse', price: 18000, ammo: 500 },
            { name: 'WEAPON_MARKSMANRIFLE', label: 'Fusil de tireur d\'élite', price: 22000, ammo: 80 },
            { name: 'WEAPON_COMBATMG', label: 'Mitrailleuse de combat', price: 25000, ammo: 500 },
            { name: 'WEAPON_HEAVYSNIPER', label: 'Fusil de précision lourd', price: 35000, ammo: 40 },
        ],
    },
    {
        id: 'gear',
        label: 'Équipement',
        items: [
            { name: 'ARMOUR_LIGHT', label: 'Gilet pare-balles', price: 2000, armour: 50 },
            { name: 'ARMOUR_HEAVY', label: 'Gilet lourd', price: 5000, armour: 100 },
        ],
    },
    {
        id: 'explosive',
        label: 'Explosifs',
        items: [
            { name: 'WEAPON_MOLOTOV', label: 'Cocktail Molotov (x5)', price: 2000, ammo: 5 },
            { name: 'WEAPON_GRENADE', label: 'Grenade (x5)', price: 3500, ammo: 5 },
            { name: 'WEAPON_STICKYBOMB', label: 'Bombe collante (x5)', price: 6000, ammo: 5 },
            { name: 'WEAPON_GRENADELAUNCHER', label: 'Lance-grenades', price: 50000, ammo: 20 },
            { name: 'WEAPON_RPG', label: 'Lance-roquettes', price: 75000, ammo: 10 },
            { name: 'WEAPON_MINIGUN', label: 'Minigun', price: 120000, ammo: 2000 },
            { name: 'WEAPON_HOMINGLAUNCHER', label: 'Lance-missiles guidé', price: 150000, ammo: 10 },
            { name: 'WEAPON_RAILGUN', label: 'Railgun', price: 250000, ammo: 20 },
        ],
    },
];

const CATALOG = {};
for (const category of SHOP_CATEGORIES) {
    for (const item of category.items) {
        CATALOG[item.name] = item;
    }
}

// Armour is consumed, so it is bought at full price every time and never
// counts as owned.
function isConsumable(item) {
    return Boolean(item && item.armour);
}

// What buying this entry costs right now: full price the first time, an ammo
// refill afterwards. Melee weapons have no ammo, so they are never re-sold.
function priceFor(itemName, owned) {
    const item = CATALOG[itemName];
    if (!item) {
        return 0;
    }
    if (!owned || isConsumable(item)) {
        return item.price;
    }
    if (item.ammo <= 1) {
        return 0;
    }
    return Math.ceil(item.price * SHOP.refillRatio);
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
    MONEY,
    DEATH,
    MOMENTUM,
    SHOP,
    SHOP_CATEGORIES,
    CATALOG,
    LEADER_BLIP,
    isConsumable,
    multiplierFor,
    priceFor,
    PED_TYPE_CATEGORY,
    PED_MODEL_CATEGORY,
    VEHICLE_MODEL_CATEGORY,
    VEHICLE_CLASS_CATEGORY,
    joaat,
    formatAmount,
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
