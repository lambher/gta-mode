const pedIDs = {};


const players = {};
const playerPeds = {};

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
    if (players[killerID] !== undefined) {
        players[killerID].kill(value);

    }
});

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
                    emitNet("killEvent", playerID, playerID, pedID);
                }

            }


        }
    });

    setTimeout(watchPeds, 100);
}

watchPeds();
