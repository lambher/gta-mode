const {
    LABELS,
    DEATH,
    MOMENTUM,
    SHOP,
    CATALOG,
    formatAmount,
    isConsumable,
    multiplierFor,
    priceFor,
    scoreFor,
    LEADER_BLIP,
} = globalThis.GameMode;

// How many players the on-screen leaderboard shows.
const LEADERBOARD_SIZE = 10;

const players = new Map();
// One bloodstain per player: dying again forfeits the previous one, as in the
// game this is borrowed from.
const bloodstains = new Map(); // owner id -> { owner, name, amount, x, y, z }

class Player {
    constructor(id) {
        this.id = id;
        this.name = GetPlayerName(id) || `Joueur ${id}`;
        this.score = 0;
        this.kills = 0;
        this.weapons = new Map(); // WEAPON_* -> ammo granted
        this.streak = 0;
        this.streakExpiresAt = 0;
    }

    // A kill inside the window extends the streak, anything later starts over.
    extendStreak() {
        const now = Date.now();
        this.streak = now > this.streakExpiresAt ? 1 : this.streak + 1;
        this.streakExpiresAt = now + MOMENTUM.window;
        this.syncMomentum();
    }

    breakStreak() {
        if (!this.streak) {
            return;
        }
        this.streak = 0;
        this.streakExpiresAt = 0;
        this.syncMomentum();
    }

    get multiplier() {
        return Date.now() > this.streakExpiresAt ? 1 : multiplierFor(this.streak);
    }

    syncMomentum() {
        emitNet('gtamode:momentum', this.id, this.streak, this.multiplier, this.streakExpiresAt);
    }

    credit(value, text) {
        this.score += value;
        this.kills += 1;

        console.log(`[gta-mode] ${this.name} (${this.id}) +${value} (${text}) -> ${this.score}`);
        this.syncScore(value, text);
    }

    debit(value, text) {
        this.score -= value;

        console.log(`[gta-mode] ${this.name} (${this.id}) -${value} (${text}) -> ${this.score}`);
        this.syncScore(-value, text);
    }

    syncScore(delta, text) {
        emitNet('gtamode:score', this.id, this.score, delta, text);
    }

    loadout() {
        return [...this.weapons.entries()].map(([weapon, ammo]) => ({ weapon, ammo }));
    }
}

function getPlayer(id) {
    let player = players.get(id);
    if (!player) {
        player = new Player(id);
        players.set(id, player);
    }
    return player;
}

function leaderboard() {
    return [...players.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, LEADERBOARD_SIZE)
        .map((player) => ({ name: player.name, score: player.score }));
}

function broadcastLeaderboard() {
    emitNet('gtamode:leaderboard', -1, leaderboard());
}

function broadcastBloodstains() {
    emitNet('gtamode:bloodstains', -1, [...bloodstains.values()]);
}

// Read the player's position server side so a client cannot claim to be
// standing on a bloodstain it is nowhere near. Older builds do not expose the
// natives, in which case we fall back on what the client reports.
function positionOf(id, fallback) {
    if (typeof GetPlayerPed !== 'function' || typeof GetEntityCoords !== 'function') {
        return fallback;
    }
    try {
        const coords = GetEntityCoords(GetPlayerPed(id));
        return coords && coords.length === 3 ? coords : fallback;
    } catch (error) {
        return fallback;
    }
}

// ---------------------------------------------------------------------------
// Kills
// ---------------------------------------------------------------------------

// The client only reports *what* it killed. The value is recomputed here from
// the shared table, so a tampered client cannot hand itself a score.
onNet('gtamode:kill', (category, kind) => {
    const id = global.source;
    const base = scoreFor(category, kind);

    if (!base) {
        console.log(`[gta-mode] kill rejeté de ${id}: ${category}/${kind}`);
        return;
    }

    const player = getPlayer(id);
    player.extendStreak();

    const multiplier = player.multiplier;
    const value = Math.round(base * multiplier);
    const text = `${LABELS[category]}${kind === 'vehicle' ? ' (véhicule)' : ''}`;

    player.credit(value, multiplier > 1 ? `${text}  x${multiplier}` : text);
    broadcastLeaderboard();
});

// Taking a hit costs the streak, which is the whole point of it.
onNet('gtamode:hurt', () => {
    getPlayer(global.source).breakStreak();
});

// ---------------------------------------------------------------------------
// Mort et taches de sang
// ---------------------------------------------------------------------------

onNet('gtamode:died', (x, y, z) => {
    const id = global.source;
    const player = getPlayer(id);

    player.breakStreak();

    if (DEATH.mode === 'keep' || player.score <= 0) {
        return;
    }

    const dropped = Math.floor(player.score * DEATH.dropRatio);
    player.debit(dropped, DEATH.mode === 'wipe' ? 'Mort' : 'Tombé au sol');

    if (DEATH.mode !== 'bloodstain' || dropped <= 0) {
        return;
    }

    const [px, py, pz] = positionOf(id, [x, y, z]);
    bloodstains.set(id, { owner: id, name: player.name, amount: dropped, x: px, y: py, z: pz });
    broadcastBloodstains();
});

onNet('gtamode:collect', (owner) => {
    const id = global.source;
    const stain = bloodstains.get(owner);
    if (!stain) {
        return;
    }

    const [px, py, pz] = positionOf(id, [stain.x, stain.y, stain.z]);
    const distance = Math.hypot(px - stain.x, py - stain.y, pz - stain.z);
    if (distance > DEATH.pickupRadius * 2) {
        console.log(`[gta-mode] ramassage rejeté de ${id}: ${Math.round(distance)}m de la tache`);
        return;
    }

    bloodstains.delete(owner);
    broadcastBloodstains();

    const player = getPlayer(id);
    player.credit(stain.amount, owner === id ? 'Ton magot' : `Magot de ${stain.name}`);
    broadcastLeaderboard();
});

// ---------------------------------------------------------------------------
// Armurerie
// ---------------------------------------------------------------------------

// Read the wanted level server side so the rule holds even for a client that
// lies about it. Older server builds do not expose the native; the client-side
// check in the shop menu is then the only one left.
function wantedLevelOf(id) {
    if (typeof GetPlayerWantedLevel !== 'function') {
        return 0;
    }
    try {
        return GetPlayerWantedLevel(id) || 0;
    } catch (error) {
        return 0;
    }
}

function deny(id, reason) {
    emitNet('gtamode:shopDenied', id, reason);
}

onNet('gtamode:buy', (itemName) => {
    const id = global.source;
    const player = getPlayer(id);
    const item = CATALOG[itemName];

    if (!item) {
        console.log(`[gta-mode] achat rejeté de ${id}: ${itemName}`);
        return;
    }

    if (wantedLevelOf(id) > SHOP.maxWantedLevel) {
        deny(id, 'Impossible en course-poursuite : sème la police d\'abord.');
        return;
    }

    const owned = player.weapons.has(itemName);
    if (owned && !isConsumable(item) && item.ammo <= 1) {
        deny(id, `${item.label} : déjà en ta possession.`);
        return;
    }

    const price = priceFor(itemName, owned);
    if (player.score < price) {
        deny(id, `${item.label} : il te manque ${formatAmount(price - player.score)}.`);
        return;
    }

    player.debit(price, owned && !isConsumable(item) ? `Munitions ${item.label}` : item.label);

    if (isConsumable(item)) {
        emitNet('gtamode:armour', id, item.armour);
    } else {
        player.weapons.set(itemName, item.ammo);
        emitNet('gtamode:grant', id, itemName, item.ammo, owned);
        emitNet('gtamode:inventory', id, [...player.weapons.keys()]);
    }

    broadcastLeaderboard();
});

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

on('playerJoining', () => {
    getPlayer(global.source);
    broadcastLeaderboard();
});

on('playerDropped', () => {
    // The bloodstain stays: someone who quits after being killed still leaves
    // their money on the ground.
    players.delete(global.source);
    broadcastLeaderboard();
});

on('respawnPlayerPedEvent', (id) => {
    const player = getPlayer(id);
    // The name is not always available yet when the player joins.
    player.name = GetPlayerName(id) || player.name;

    // Resync the freshly spawned ped: money, owned weapons, and the weapons
    // themselves since a new ped spawns empty handed.
    player.syncScore(0, null);
    player.syncMomentum();
    emitNet('gtamode:inventory', id, [...player.weapons.keys()]);
    emitNet('gtamode:giveLoadout', id, player.loadout());
    emitNet('gtamode:leaderboard', id, leaderboard());
    emitNet('gtamode:bloodstains', id, [...bloodstains.values()]);
    broadcastLeaderboard();
});

// ---------------------------------------------------------------------------
// Cible Prioritaire (Leader Position)
// ---------------------------------------------------------------------------

let lastLeaderId = null;

function currentLeader() {
    let leader = null;
    let maxScore = 0;
    for (const player of players.values()) {
        if (player.score > maxScore) {
            maxScore = player.score;
            leader = player;
        }
    }
    return leader;
}

if (LEADER_BLIP.enabled) {
    setInterval(() => {
        const leader = currentLeader();
        const leaderId = leader ? leader.id : null;

        if (leaderId !== lastLeaderId) {
            if (leader) {
                emitNet('chat:addMessage', -1, {
                    args: [`${leader.name} est maintenant la cible prioritaire avec ${formatAmount(leader.score)} !`],
                });
            }
            lastLeaderId = leaderId;
        }

        if (leaderId) {
            const [x, y, z] = positionOf(leaderId, [0.0, 0.0, 0.0]);
            if (x !== 0.0 || y !== 0.0 || z !== 0.0) {
                emitNet('gtamode:leaderPosition', -1, leaderId, leader.name, x, y, z);
                return;
            }
        }
        
        // No leader or leader position unknown
        emitNet('gtamode:leaderPosition', -1, null, null, 0.0, 0.0, 0.0);
    }, LEADER_BLIP.updateInterval);
}
