function watchPeds() {
    const peds = GetAllPeds();


    peds.forEach(pedID => {
        const playerID = GetPedSourceOfDeath(pedID);
        if (playerID !== 0) {
            console.log(playerID);
        }
    });

    setTimeout(watchPeds, 100);
}

watchPeds();
