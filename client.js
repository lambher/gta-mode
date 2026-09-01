const {
    CATEGORY,
    SPAWN,
    MONEY,
    SHOP,
    formatAmount,
    WEAPON_CATEGORIES,
    PED_TYPE_CATEGORY,
    PED_MODEL_CATEGORY,
    VEHICLE_MODEL_CATEGORY,
    VEHICLE_CLASS_CATEGORY,
    categoryRank,
    priceFor,
} = globalThis.GameMode;

// How often we sweep the streamed entities looking for fresh kills.
const SCAN_INTERVAL = 250;
// A kill feed line stays on screen this long.
const FEED_DURATION = 4000;
const FEED_SIZE = 5;

let score = 0;
let leaderboard = [];
let feed = [];
let ownedWeapons = new Set();
let walletHideAt = 0;

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
                args: ['Tue pour marquer des points. B : armurerie, Z : classement.'],
            });
            if (SPAWN.vehicle) {
                spawnCar(SPAWN.vehicle);
            }
        });
    });

    exports.spawnmanager.setAutoSpawn(true);
    exports.spawnmanager.forceRespawn();
});

// ---------------------------------------------------------------------------
// Événements serveur
// ---------------------------------------------------------------------------

onNet('gtamode:score', (total, delta, text) => {
    score = total;
    syncMoneyHud(delta);

    // A resync after respawn carries no transaction, so it gets no feed line.
    if (delta > 0) {
        pushFeed(`+${formatAmount(delta)}  ${text}`, [120, 255, 120, 230]);
    } else if (delta < 0) {
        pushFeed(`-${formatAmount(-delta)}  ${text}`, [255, 180, 90, 230]);
    }
});

onNet('gtamode:leaderboard', (players) => {
    leaderboard = players;
});

onNet('gtamode:inventory', (weapons) => {
    ownedWeapons = new Set(weapons);
});

onNet('gtamode:grant', (weaponName, ammo, refill) => {
    const playerPed = PlayerPedId();
    const hash = GetHashKey(weaponName);

    if (refill) {
        AddAmmoToPed(playerPed, hash, ammo);
    } else {
        GiveWeaponToPed(playerPed, hash, ammo, false, true);
    }

    PlaySoundFrontend(-1, 'PURCHASE', 'HUD_LIQUOR_STORE_SOUNDSET', false);
});

// A fresh ped spawns empty handed, so everything bought is handed back.
onNet('gtamode:giveLoadout', (loadout) => {
    const playerPed = PlayerPedId();
    for (const item of loadout) {
        GiveWeaponToPed(playerPed, GetHashKey(item.weapon), item.ammo, false, false);
    }
});

onNet('gtamode:shopDenied', (reason) => {
    setShopMessage(reason, [255, 100, 100, 255]);
    PlaySoundFrontend(-1, 'ERROR', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false);
});

// ---------------------------------------------------------------------------
// Détection des kills
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
// Armurerie
// ---------------------------------------------------------------------------

const SHOP_ROWS = 8;
const SHOP_LEFT = 0.34;
const SHOP_RIGHT = 0.66;
const SHOP_WIDTH = SHOP_RIGHT - SHOP_LEFT;
const ROW_HEIGHT = 0.032;

let shopOpen = false;
let categoryIndex = 0;
let itemIndex = 0;
let shopMessage = null;

function currentCategory() {
    return WEAPON_CATEGORIES[categoryIndex];
}

function currentWeapon() {
    return currentCategory().weapons[itemIndex];
}

function isChased() {
    return GetPlayerWantedLevel(PlayerId()) > SHOP.maxWantedLevel;
}

function setShopMessage(text, colour) {
    shopMessage = { text, colour, expiresAt: GetGameTimer() + 4000 };
}

function toggleShop() {
    shopOpen = !shopOpen;
    if (shopOpen) {
        shopMessage = null;
        flashWallet();
        PlaySoundFrontend(-1, 'SELECT', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false);
    }
}

RegisterCommand('armurerie', () => toggleShop(), false);
RegisterKeyMapping('armurerie', 'Ouvrir l\'armurerie', 'keyboard', 'B');

function moveCategory(step) {
    categoryIndex = (categoryIndex + step + WEAPON_CATEGORIES.length) % WEAPON_CATEGORIES.length;
    itemIndex = 0;
    PlaySoundFrontend(-1, 'NAV_LEFT_RIGHT', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false);
}

function moveItem(step) {
    const count = currentCategory().weapons.length;
    itemIndex = (itemIndex + step + count) % count;
    PlaySoundFrontend(-1, 'NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false);
}

function buySelected() {
    const weapon = currentWeapon();

    // The server checks this again; doing it here keeps the refusal instant.
    if (isChased()) {
        setShopMessage('Impossible en course-poursuite : sème la police d\'abord.', [255, 100, 100, 255]);
        PlaySoundFrontend(-1, 'ERROR', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false);
        return;
    }

    emitNet('gtamode:buy', weapon.name);
}

function handleShopInput() {
    // Keep the player from shooting or swapping weapons through the menu.
    for (const control of [24, 25, 37, 44, 140, 141, 142, 257, 263, 264]) {
        DisableControlAction(0, control, true);
    }

    if (IsControlJustPressed(0, 177)) {
        shopOpen = false;
        return;
    }
    if (IsControlJustPressed(0, 172)) {
        moveItem(-1);
    }
    if (IsControlJustPressed(0, 173)) {
        moveItem(1);
    }
    if (IsControlJustPressed(0, 174)) {
        moveCategory(-1);
    }
    if (IsControlJustPressed(0, 175)) {
        moveCategory(1);
    }
    if (IsControlJustPressed(0, 176)) {
        buySelected();
    }
}

// What a row offers right now: a purchase, an ammo refill, or nothing left to
// buy for a melee weapon already owned.
function offerFor(weapon) {
    const owned = ownedWeapons.has(weapon.name);

    if (!owned) {
        return { owned: false, price: weapon.price, text: formatAmount(weapon.price) };
    }
    if (weapon.ammo <= 1) {
        return { owned: true, price: 0, text: 'POSSÉDÉ' };
    }

    const price = priceFor(weapon.name, true);
    return { owned: true, price, text: `${formatAmount(price)} (munitions)` };
}

function drawShop() {
    const category = currentCategory();
    const weapons = category.weapons;
    const chased = isChased();

    // Keep the selected row inside the visible window.
    const scrollTop = Math.max(0, Math.min(itemIndex - SHOP_ROWS + 1, weapons.length - SHOP_ROWS));
    const visible = weapons.slice(scrollTop, scrollTop + SHOP_ROWS);

    const headerY = 0.20;
    const listY = 0.285;
    const bodyHeight = visible.length * ROW_HEIGHT;

    DrawRect(0.5, headerY + 0.02, SHOP_WIDTH, 0.055, 15, 15, 20, 230);
    drawText('ARMURERIE', SHOP_LEFT + 0.01, headerY + 0.001, 0.55, 1, [255, 255, 255, 255]);
    drawText(formatAmount(score), SHOP_RIGHT - 0.01, headerY + 0.008, 0.42, 2, [255, 220, 100, 255]);

    DrawRect(0.5, listY - 0.018, SHOP_WIDTH, 0.032, 40, 40, 55, 230);
    drawText(`<  ${category.label}  >`, 0.5, listY - 0.026, 0.40, 0, [200, 220, 255, 255]);

    DrawRect(0.5, listY + bodyHeight / 2 - ROW_HEIGHT / 2, SHOP_WIDTH, bodyHeight, 0, 0, 0, 190);

    visible.forEach((weapon, row) => {
        const index = scrollTop + row;
        const y = listY + row * ROW_HEIGHT - ROW_HEIGHT / 2;
        const selected = index === itemIndex;
        const offer = offerFor(weapon);
        const affordable = score >= offer.price;

        if (selected) {
            DrawRect(0.5, y + 0.011, SHOP_WIDTH, ROW_HEIGHT, 245, 245, 245, 200);
        }

        let colour;
        if (selected) {
            colour = [10, 10, 10, 255];
        } else if (offer.owned) {
            colour = [255, 220, 100, 240];
        } else if (affordable) {
            colour = [255, 255, 255, 240];
        } else {
            colour = [140, 140, 140, 220];
        }

        drawText(weapon.label, SHOP_LEFT + 0.012, y, 0.36, 1, colour);
        drawText(offer.text, SHOP_RIGHT - 0.012, y, 0.36, 2, colour);
    });

    const footerY = listY + bodyHeight;
    DrawRect(0.5, footerY + 0.005, SHOP_WIDTH, 0.03, 15, 15, 20, 230);

    if (shopMessage && shopMessage.expiresAt > GetGameTimer()) {
        drawText(shopMessage.text, 0.5, footerY - 0.004, 0.33, 0, shopMessage.colour);
    } else if (chased) {
        drawText('COURSE-POURSUITE — ACHATS BLOQUÉS', 0.5, footerY - 0.004, 0.33, 0, [255, 90, 90, 255]);
    } else {
        drawText('Flèches : naviguer    Entrée : acheter    B : fermer', 0.5, footerY - 0.004, 0.33, 0, [180, 180, 180, 230]);
    }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

// GTA's cash HUD is display only and lives entirely on this client: it is the
// server score that is authoritative, mirrored into the stat the HUD reads.
// Whatever the earn popup does to the balance is overwritten right after.
function syncMoneyHud(delta) {
    if (!MONEY.enabled) {
        return;
    }

    if (delta > 0) {
        NetworkEarnFromRockstar(delta);
    }

    StatSetInt(GetHashKey('MP0_WALLET_BALANCE'), score, true);
    flashWallet();
}

// The wallet widget is meant to appear on a transaction and fade out, so we
// show it and schedule the hide instead of leaving it pinned.
function flashWallet() {
    SetMultiplayerWalletCash();
    walletHideAt = GetGameTimer() + 5000;
}

function pushFeed(text, colour) {
    feed.push({ text, colour, expiresAt: GetGameTimer() + FEED_DURATION });
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
    drawText(MONEY.enabled ? 'MAGOT' : 'SCORE', 0.985, 0.025, 0.32, 2, [200, 200, 200, 220]);
    drawText(formatAmount(score), 0.985, 0.050, 0.65, 2, [255, 255, 255, 255]);
}

function drawFeed() {
    const now = GetGameTimer();
    feed = feed.filter((line) => line.expiresAt > now);

    feed.forEach((line, index) => {
        drawText(line.text, 0.985, 0.105 + index * 0.028, 0.38, 2, line.colour);
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
        drawText(formatAmount(player.score), 0.63, y, 0.38, 2, [255, 220, 100, 240]);
    });
}

setTick(() => {
    if (walletHideAt && GetGameTimer() > walletHideAt) {
        RemoveMultiplayerWalletCash();
        walletHideAt = 0;
    }

    drawScorePanel();
    drawFeed();

    if (shopOpen) {
        handleShopInput();
        drawShop();
        return;
    }

    // INPUT_MULTIPLAYER_INFO, the Z key by default.
    if (IsControlPressed(0, 20)) {
        drawLeaderboard();
    }
});

// ---------------------------------------------------------------------------
// Spawn
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
