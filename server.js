const pedIDs = {};


const players = {};

class Player {
    constructor(id) {
        this.id = id;
        this.pedIds = [];
    }

    kill(pedID) {
        this.pedIds.push(pedID);
        console.log(`Player id ${this.id} kills ped id ${pedID}`);
    }
}


function watchPeds() {
    const peds = GetAllPeds();
    console.log(peds);

    peds.forEach(pedID => {
        const playerID = GetPedSourceOfDeath(pedID);
        if (playerID !== 0) {
            if (pedIDs[pedID] === undefined) {
                pedIDs[pedID] = true;
                if (players[playerID] === undefined) {
                    players[playerID] = new Player(playerID);
                }
                players[playerID].kill(pedID);
            }


        }
    });

    setTimeout(watchPeds, 100);
}

watchPeds();
