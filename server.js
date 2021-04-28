

const players = {};

class Player {
    constructor(id) {
        this.score = 0;
        this.id = id;
    }

    kill(value) {
        console.log(`Player id ${this.id} kills with value ${value}`);
        this.score += value;

        emitNet("scoreEvent", this.id, this.score, value);
    }
}

onNet('killEvent', (killerID, value) => {
    console.log("killevent " + killerID + " " + value)
    if (players[killerID] === undefined) {
        players[killerID] = new Player(killerID);
    }
    players[killerID].kill(value);
});

onNet('test', (tag, value) => {
    console.log(tag + " " + value);

});






on('respawnPlayerPedEvent', (player, content) => {
    emitNet("setClientID", player, player);
})
