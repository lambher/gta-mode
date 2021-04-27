const pedIDs = {};


const players = {};
const playerPeds = {};

class Player {
    constructor(id) {
        this.score = 0;
        this.id = id;
        this.pedIds = [];
    }

    kill(pedID) {
        this.pedIds.push(pedID);
        console.log(`Player id ${this.id} kills ped id ${pedID}`);
        const value = 1;
        this.score += value;

        emitNet("killEvent", this.id, this.score, value);
    }
}

on('respawnPlayerPedEvent', (player, content) => {
    const ped = GetPlayerPed(player);
    playerPeds[ped] = player;
})

function getPlayerIDFromPedID(pedID) {
    for (let i = 0; i < 31; i++) {
        if (pedID == GetPlayerPed(i)) {
            return i;
        }
    }
}


function watchPeds() {
    const peds = GetAllPeds();

    peds.forEach(pedID => {
        const pedKillerID = GetPedSourceOfDeath(pedID);
        if (pedKillerID !== 0) {
            if (pedIDs[pedID] === undefined) {
                pedIDs[pedID] = true;
                if (playerPeds[pedKillerID] !== undefined) {
                    const playerID = playerPeds[pedKillerID];
                    if (players[playerID] === undefined) {
                        players[playerID] = new Player(playerID);
                    }
                    players[playerID].kill(pedID);
                }

            }


        }
    });

    setTimeout(watchPeds, 100);
}

watchPeds();
