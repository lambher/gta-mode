const spawnPos = [686.245, 577.950, 130.461];

let playerID;
let playerName = "";

on('onClientGameTypeStart', () => {
    exports.spawnmanager.setAutoSpawnCallback(() => {
        exports.spawnmanager.spawnPlayer({
            x: spawnPos[0],
            y: spawnPos[1],
            z: spawnPos[2],
            model: 'a_m_m_skater_01'
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

onNet('killEvent', (score, value) => {
    emit('chat:addMessage', {
        args: [
            `${playerName} earns ${value} and his score is ${score}`
        ]
    })
})
