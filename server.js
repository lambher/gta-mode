const data = {};


on('playerConnecting', (name, setKickReason, deferrals) => {
    deferrals.defer()

    const player = global.source;
    console.log("playerConnecting " + player);
})


function watchPeds() {
    const peds = GetAllPeds();


    peds.forEach(pedID => {
        const playerID = GetPedSourceOfDeath(pedID);
        if (playerID !== 0) {
            player = GetPlayerFromServerId(playerID);
            console.log("killer " + playerID);
            console.log(player);
        }
    });

    setTimeout(watchPeds, 100);
}

watchPeds();
