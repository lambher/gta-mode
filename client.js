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
            model: 'a_m_m_hasjew_01'
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
    emitNet("test", "GetPlayerIndex", playerID);

    exports.spawnmanager.setAutoSpawn(true)
    exports.spawnmanager.forceRespawn()
});

function getPedValue(pedID) {
    const pedType = GetPedType(pedID);

    return pedType;
}

onNet('killEvent', (killerID, pedID) => {
    emitNet("killEvent", killerID, getPedValue(pedID));
});


onNet('scoreEvent', (score, value) => {
    emit('chat:addMessage', {
        args: [
            `${playerName} earns ${value} and his score is ${score}`
        ]
    })
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
    let pp = GetPlayerPed(GetPlayerIndex());

    const peds = getNearbyPeds();

    peds.forEach(pedID => {
        const pedKillerID = GetPedSourceOfDeath(pedID);

        if (pedKillerID !== 0) {
            if (pedIDs[pedID] === undefined) {
                pedIDs[pedID] = true;
                if (pedKillerID === pp) {
                    emitNet("killEvent", clientID, getPedValue(pedID));
                }
            }


        }
    });

    setTimeout(watchPeds, 1000);
}

watchPeds();
