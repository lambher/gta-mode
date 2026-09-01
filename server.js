const { LABELS, RESET_SCORE_ON_DEATH, scoreFor } = globalThis.GameMode;

// How many players the on-screen leaderboard shows.
const LEADERBOARD_SIZE = 10;

const players = new Map();

class Player {
    constructor(id) {
        this.id = id;
        this.name = GetPlayerName(id) || `Joueur ${id}`;
        this.score = 0;
        this.kills = 0;
    }

    award(value, category, kind) {
        this.score += value;
        this.kills += 1;

        console.log(`[gta-mode] ${this.name} (${this.id}) +${value} (${LABELS[category]} ${kind}) -> ${this.score}`);
        emitNet('gtamode:score', this.id, this.score, value, category, kind);
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

// The client only reports *what* it killed. The value is recomputed here from
// the shared table, so a tampered client cannot hand itself a score.
onNet('gtamode:kill', (category, kind) => {
    const id = global.source;
    const value = scoreFor(category, kind);

    if (!value) {
        console.log(`[gta-mode] kill rejeté de ${id}: ${category}/${kind}`);
        return;
    }

    getPlayer(id).award(value, category, kind);
    broadcastLeaderboard();
});

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
    }

    // Resync the freshly spawned client with the score the server holds.
    emitNet('gtamode:score', id, player.score, 0, null, null);
    emitNet('gtamode:leaderboard', id, leaderboard());
    broadcastLeaderboard();
});
