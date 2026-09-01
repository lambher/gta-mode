const {
    LABELS,
    RESET_SCORE_ON_DEATH,
    SHOP,
    WEAPONS,
    priceFor,
    scoreFor,
} = globalThis.GameMode;

// How many players the on-screen leaderboard shows.
const LEADERBOARD_SIZE = 10;

const players = new Map();

class Player {
    constructor(id) {
        this.id = id;
        this.name = GetPlayerName(id) || `Joueur ${id}`;
        this.score = 0;
        this.kills = 0;
        this.weapons = new Map(); // WEAPON_* -> ammo granted
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

// ---------------------------------------------------------------------------
// Kills
// ---------------------------------------------------------------------------

// The client only reports *what* it killed. The value is recomputed here from
// the shared table, so a tampered client cannot hand itself a score.
onNet('gtamode:kill', (category, kind) => {
    const id = global.source;
    const value = scoreFor(category, kind);

    if (!value) {
        console.log(`[gta-mode] kill rejeté de ${id}: ${category}/${kind}`);
        return;
    }

    const text = `${LABELS[category]}${kind === 'vehicle' ? ' (véhicule)' : ''}`;
    getPlayer(id).credit(value, text);
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

onNet('gtamode:buy', (weaponName) => {
    const id = global.source;
    const player = getPlayer(id);
    const weapon = WEAPONS[weaponName];

    if (!weapon) {
        console.log(`[gta-mode] achat rejeté de ${id}: ${weaponName}`);
        return;
    }

    if (wantedLevelOf(id) > SHOP.maxWantedLevel) {
        deny(id, 'Impossible en course-poursuite : sème la police d\'abord.');
        return;
    }

    const owned = player.weapons.has(weaponName);
    if (owned && weapon.ammo <= 1) {
        deny(id, `${weapon.label} : déjà en ta possession.`);
        return;
    }

    const price = priceFor(weaponName, owned);
    if (player.score < price) {
        deny(id, `${weapon.label} : il te manque ${price - player.score} points.`);
        return;
    }

    player.weapons.set(weaponName, weapon.ammo);
    player.debit(price, owned ? `Munitions ${weapon.label}` : weapon.label);

    emitNet('gtamode:grant', id, weaponName, weapon.ammo, owned);
    emitNet('gtamode:inventory', id, [...player.weapons.keys()]);
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
    players.delete(global.source);
    broadcastLeaderboard();
});

on('respawnPlayerPedEvent', (id) => {
    const player = getPlayer(id);
    // The name is not always available yet when the player joins.
    player.name = GetPlayerName(id) || player.name;

    if (RESET_SCORE_ON_DEATH) {
        player.score = 0;
        player.kills = 0;
        player.weapons.clear();
    }

    // Resync the freshly spawned ped: score, owned weapons, and the weapons
    // themselves since a new ped spawns empty handed.
    player.syncScore(0, null);
    emitNet('gtamode:inventory', id, [...player.weapons.keys()]);
    emitNet('gtamode:giveLoadout', id, player.loadout());
    emitNet('gtamode:leaderboard', id, leaderboard());
    broadcastLeaderboard();
});
