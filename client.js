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


function watchPeds() {
    const peds = GetAllPeds();

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
