const {
    CATEGORY,
    LABELS,
    SPAWN,
    PED_TYPE_CATEGORY,
    PED_MODEL_CATEGORY,
    VEHICLE_MODEL_CATEGORY,
    VEHICLE_CLASS_CATEGORY,
    categoryRank,
} = globalThis.GameMode;

// How often we sweep the streamed entities looking for fresh kills.
const SCAN_INTERVAL = 250;
// A kill feed line stays on screen this long.
const FEED_DURATION = 4000;
const FEED_SIZE = 5;

let score = 0;
let leaderboard = [];
let feed = [];

// Entities we already made a decision about, so a corpse lying around is never
// counted twice. Handles get recycled by the engine, hence the pruning below.
const settledPeds = new Set();
const trackedVehicles = new Map(); // handle -> { category, settled }
// Every vehicle the player rode: damage dealt by any of them is damage he dealt.
const ownVehicles = new Set();

on('onClientGameTypeStart', () => {
    exports.spawnmanager.setAutoSpawnCallback(() => {
        exports.spawnmanager.spawnPlayer({
            x: SPAWN.position.x,
            y: SPAWN.position.y,
            z: SPAWN.position.z,
            model: SPAWN.model,
        }, () => {
            emit('chat:addMessage', {
                args: ['Bienvenue ! Tue pour marquer des points, appuie sur Z pour le classement.'],
            });
            if (SPAWN.vehicle) {
                spawnCar(SPAWN.vehicle);
            }
        });
    });

    exports.spawnmanager.setAutoSpawn(true);
    exports.spawnmanager.forceRespawn();
});

onNet('gtamode:score', (total, value, category, kind) => {
    score = total;

    // A resync after respawn carries no kill, so it gets no feed line.
    if (value > 0) {
        pushFeed(`+${formatNumber(value)}  ${LABELS[category] || '?'}${kind === 'vehicle' ? ' (véhicule)' : ''}`);
    }
});

onNet('gtamode:leaderboard', (players) => {
    leaderboard = players;
});

// ---------------------------------------------------------------------------
// Kill detection
// ---------------------------------------------------------------------------

function categoryOfPed(ped) {
    const model = GetEntityModel(ped) >>> 0;
    return PED_MODEL_CATEGORY.get(model)
        || PED_TYPE_CATEGORY[GetPedType(ped)]
        || CATEGORY.CIVILIAN;
}

function categoryOfVehicle(vehicle) {
    const model = GetEntityModel(vehicle) >>> 0;
    return VEHICLE_MODEL_CATEGORY.get(model)
        || VEHICLE_CLASS_CATEGORY[GetVehicleClass(vehicle)]
        || CATEGORY.CIVILIAN;
}

// An empty police car looks like any other car once its driver is gone, so we
// note who is riding what while everybody is still alive.
function noteOccupant(ped, playerPed) {
    const vehicle = GetVehiclePedIsIn(ped, false);
    if (!vehicle || vehicle === GetVehiclePedIsIn(playerPed, false)) {
        return;
    }

    const entry = trackVehicle(vehicle);
    const category = categoryOfPed(ped);
    if (categoryRank(category) > categoryRank(entry.category)) {
        entry.category = category;
    }
}

function trackVehicle(vehicle) {
    let entry = trackedVehicles.get(vehicle);
    if (!entry) {
        entry = { category: categoryOfVehicle(vehicle), settled: false };
        trackedVehicles.set(vehicle, entry);
    }
    return entry;
}

// Did the player cause this? Direct hits, hits from a vehicle he drove, and
// explosions all end up recorded as damage from one of those entities.
function isPlayerKill(entity, playerPed) {
    if (HasEntityBeenDamagedByEntity(entity, playerPed, true)) {
        return true;
    }

    for (const vehicle of ownVehicles) {
        if (DoesEntityExist(vehicle) && HasEntityBeenDamagedByEntity(entity, vehicle, true)) {
            return true;
        }
    }

    if (IsEntityAPed(entity)) {
        const source = GetPedSourceOfDeath(entity);
        if (source && (source === playerPed || ownVehicles.has(source))) {
            return true;
        }
    }

    return false;
}

function scanPeds(playerPed) {
    for (const ped of GetGamePool('CPed')) {
        if (ped === playerPed || IsPedAPlayer(ped)) {
            continue;
        }

        if (!IsEntityDead(ped)) {
            noteOccupant(ped, playerPed);
            continue;
        }

        if (settledPeds.has(ped)) {
            continue;
        }
        settledPeds.add(ped);

        if (isPlayerKill(ped, playerPed)) {
            reportKill(categoryOfPed(ped), 'ped');
        }
    }
}

function scanVehicles(playerPed) {
    for (const vehicle of GetGamePool('CVehicle')) {
        if (ownVehicles.has(vehicle)) {
            continue;
        }

        const entry = trackVehicle(vehicle);
        if (entry.settled || !IsEntityDead(vehicle)) {
            continue;
        }
        entry.settled = true;

        if (isPlayerKill(vehicle, playerPed)) {
            reportKill(entry.category, 'vehicle');
        }
    }
}

function reportKill(category, kind) {
    emitNet('gtamode:kill', category, kind);
}

// Entity handles are reused by the engine, so stale entries would eventually
// make us skip a real kill. Drop everything that no longer exists.
function prune() {
    for (const ped of settledPeds) {
        if (!DoesEntityExist(ped)) {
            settledPeds.delete(ped);
        }
    }
    for (const vehicle of trackedVehicles.keys()) {
        if (!DoesEntityExist(vehicle)) {
            trackedVehicles.delete(vehicle);
        }
    }
    for (const vehicle of ownVehicles) {
        if (!DoesEntityExist(vehicle)) {
            ownVehicles.delete(vehicle);
        }
    }
}

function scan() {
    const playerPed = PlayerPedId();

    const vehicle = GetVehiclePedIsIn(playerPed, false);
    if (vehicle) {
        ownVehicles.add(vehicle);
        trackedVehicles.delete(vehicle);
    }

    scanPeds(playerPed);
    scanVehicles(playerPed);
    prune();

    setTimeout(scan, SCAN_INTERVAL);
}

setTimeout(scan, SCAN_INTERVAL);

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function formatNumber(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function pushFeed(text) {
    feed.push({ text, expiresAt: GetGameTimer() + FEED_DURATION });
    if (feed.length > FEED_SIZE) {
        feed = feed.slice(feed.length - FEED_SIZE);
    }
}

// justification: 0 = center, 1 = left, 2 = right
function drawText(text, x, y, scale, justification, colour) {
    SetTextFont(4);
    SetTextScale(scale, scale);
    SetTextColour(colour[0], colour[1], colour[2], colour[3]);
    SetTextDropShadow();
    SetTextOutline();
    SetTextJustification(justification);
    if (justification === 2) {
        SetTextWrap(0.0, x);
    }
    SetTextEntry('STRING');
    AddTextComponentString(text);
    DrawText(x, y);
}

function drawScorePanel() {
    DrawRect(0.905, 0.055, 0.17, 0.07, 0, 0, 0, 140);
    drawText('SCORE', 0.985, 0.025, 0.32, 2, [200, 200, 200, 220]);
    drawText(formatNumber(score), 0.985, 0.050, 0.65, 2, [255, 255, 255, 255]);
}

function drawFeed() {
    const now = GetGameTimer();
    feed = feed.filter((line) => line.expiresAt > now);

    feed.forEach((line, index) => {
        drawText(line.text, 0.985, 0.105 + index * 0.028, 0.38, 2, [120, 255, 120, 230]);
    });
}

function drawLeaderboard() {
    const rows = leaderboard.length || 1;
    DrawRect(0.5, 0.32 + rows * 0.015, 0.30, 0.06 + rows * 0.03, 0, 0, 0, 170);
    drawText('CLASSEMENT', 0.5, 0.28, 0.5, 0, [255, 255, 255, 255]);

    if (!leaderboard.length) {
        drawText('Aucun score pour le moment', 0.5, 0.325, 0.35, 0, [200, 200, 200, 220]);
        return;
    }

    leaderboard.forEach((player, index) => {
        const y = 0.325 + index * 0.03;
        drawText(`${index + 1}. ${player.name}`, 0.37, y, 0.38, 1, [255, 255, 255, 240]);
        drawText(formatNumber(player.score), 0.63, y, 0.38, 2, [255, 220, 100, 240]);
    });
}

setTick(() => {
    drawScorePanel();
    drawFeed();

    // INPUT_MULTIPLAYER_INFO, the Z key by default.
    if (IsControlPressed(0, 20)) {
        drawLeaderboard();
    }
});

// ---------------------------------------------------------------------------
// Spawn helpers
// ---------------------------------------------------------------------------

function spawnCar(car) {
    const carHash = GetHashKey(car);

    RequestModel(carHash);
    loadModel(carHash, () => {
        const playerPed = PlayerPedId();
        const pos = GetEntityCoords(playerPed, false);
        const vehicle = CreateVehicle(carHash, pos[0] + 3, pos[1] + 3, pos[2] + 1, GetEntityHeading(playerPed), true, false);

        ownVehicles.add(vehicle);
        SetModelAsNoLongerNeeded(carHash);
    });
}

function loadModel(carHash, callback) {
    if (HasModelLoaded(carHash)) {
        callback();
        return;
    }
    setTimeout(() => loadModel(carHash, callback), 100);
}
