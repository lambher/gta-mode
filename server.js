function watchPeds() {
    const peds = GetAllPeds();


    console.log(peds);

    setTimeout(watchPeds, 100);
}

watchPeds();
