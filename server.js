const data = {};


on('playerConnecting', (name, setKickReason, deferrals) => {
    const player = global.source;
    console.log("playerConnecting " + player);
});


function watchPeds() {
    const peds = GetAllPeds();


    peds.forEach(pedID => {
        const playerID = GetPedSourceOfDeath(pedID);
        if (playerID !== 0) {
            console.log("killer " + playerID);
        }
    });

    setTimeout(watchPeds, 100);
}

watchPeds();
