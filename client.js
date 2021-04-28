const spawnPos = [686.245, 577.950, 130.461];


let playerID;
let playerName = "";
let clientID = 0;

on('onClientGameTypeStart', () => {
    exports.spawnmanager.setAutoSpawnCallback(() => {
        exports.spawnmanager.spawnPlayer({
            x: spawnPos[0],
            y: spawnPos[1],
            z: spawnPos[2],
            // model: 'a_m_m_skater_01'
            model: Math.random() > 0.5 ? 'a_c_chop' : 'a_c_chimp'
        }, () => {
            emit('chat:addMessage', {
                args: [
                    'Welcome to the party!~'
                ]
            })
        });
    });
    playerID = GetPlayerIndex();
    playerName = GetPlayerName(playerID);

    exports.spawnmanager.setAutoSpawn(true)
    exports.spawnmanager.forceRespawn()
});


onNet('scoreEvent', (score, value) => {
    emit('chat:addMessage', {
        args: [
            `${playerName}:  +${value} score: ${score}`
        ]
    })

    const pos = GetEntityCoords(GetPlayerPed(GetPlayerIndex()), true);
    DrawDebugText(`score : ${score}`, pos[0], pos[1], pos[2], 0, 255, 0, 0.5);
})

onNet('setClientID', (id) => {
    clientID = id;
})

const pedIDs = {};
const playerPeds = {};

function getNearbyPeds() {
    const peds = [];
    let pp = GetPlayerPed(GetPlayerIndex());

    let res = FindFirstPed();
    let findHandle = res[0];
    let pedID = res[1];
    let find = true;
    if (findHandle === 0) {
        find = false;
    }
    while (find) {
        if (pedID !== pp) {
            peds.push(pedID);
        }

        res = FindNextPed(findHandle);
        find = res[0];
        pedID = res[1];
    }
    if (findHandle !== 0) {
        EndFindPed(findHandle);
    }
    return peds;
}

function watchPeds() {
    const pp = GetPlayerPed(GetPlayerIndex());
    const vp = GetVehiclePedIsIn(PlayerPedId())

    const peds = getNearbyPeds();

    peds.forEach(pedID => {
        const pedKillerID = GetPedSourceOfDeath(pedID);

        if (pedKillerID !== 0) {
            if (pedIDs[pedID] === undefined) {
                pedIDs[pedID] = true;
                if (pedKillerID === pp || pedKillerID == vp) {
                    emitNet("killEvent", clientID, getPedValue(pedID));
                }
            }
        }
    });

    setTimeout(watchPeds, 1000);
}

watchPeds();

function getPedValue(pedID) {
    const pedType = GetPedType(pedID);

    switch (pedType) {
        case 6:
            return 10;
        case 29:
            return 20;
        case 27:
            return 15;
    }

    return 1;
}


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