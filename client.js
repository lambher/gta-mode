const spawnPos = [686.245, 577.950, 130.461];


let playerID;
let playerName = "";

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

const pedIDs = {};
const playerPeds = {};

function getNearbyPeds() {
    const peds = [];

    let res = FindFirstPed();
    let pedID = res[0];
    let lastPedID = 0;
    while (pedID !== 0) {
        peds.push(pedID);
        lastPedID = pedID;
        res = FindNextPed(pedID);
        pedID = res[0];
    }
    if (lastPedID !== 0) {
        EndFindPed(lastPedID);
    }
    return peds;
}

function watchPeds() {
    const peds = getNearbyPeds();
    emitNet("test", playerID, peds.length);

    peds.forEach(pedID => {
        const pedKillerID = GetPedSourceOfDeath(pedID);
        if (pedKillerID !== 0) {
            if (pedIDs[pedID] === undefined) {
                pedIDs[pedID] = true;
                if (playerID === GetPlayerPed(killerID)) {
                    emitNet("killEvent", playerID, getPedValue(pedID));
                }
            }


        }
    });

    setTimeout(watchPeds, 100);
}

watchPeds();
