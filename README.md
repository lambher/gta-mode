# gta-mode

Mode de jeu FiveM (gametype) où chaque joueur marque des points en tuant des PNJ.

## Table des points

| Cible      | Le PNJ | Son véhicule (explosé) |
| ---------- | -----: | ---------------------: |
| Civil      |      1 |                     10 |
| Policier   |    100 |                  1 000 |
| GIGN       |  1 000 |                 10 000 |
| Militaire  |  2 000 |                 20 000 |

Faire sauter un véhicule occupé rapporte les deux : le véhicule *plus* chaque
occupant tué par l'explosion (une voiture de police avec deux agents = 1 200).

## Comment ça marche

- `config.js` — *shared script* : la table de points, les catégories, la liste
  des modèles de PNJ et de véhicules, le point de spawn. Chargé des deux côtés :
  le serveur recalcule lui-même chaque récompense, donc un client modifié ne
  peut pas s'attribuer un score arbitraire.
- `client.js` — détecte les kills et affiche le HUD.
- `server.js` — garde les scores, diffuse le classement.

### Détection des kills

Le client balaie les entités streamées toutes les 250 ms
(`GetGamePool('CPed')` / `GetGamePool('CVehicle')`) et attribue une mort au
joueur via `HasEntityBeenDamagedByEntity` — ce qui couvre les tirs, les
collisions et les explosions — avec `GetPedSourceOfDeath` en renfort. Les
véhicules que le joueur a conduits comptent comme lui : écraser un civil
rapporte ses points.

### Catégorie d'une cible

Pour un PNJ : nom de modèle connu, sinon `GetPedType()` (COP 6, SWAT 27,
ARMY 29), sinon civil.

Pour un véhicule : la catégorie la plus élevée parmi ses occupants vus vivants
(une voiture de police vide ressemble à n'importe quelle voiture une fois son
conducteur mort), sinon son modèle, sinon `GetVehicleClass()` 19 (Military),
sinon civil.

## Armurerie

Ouvrir avec **B** (rebindable dans les paramètres FiveM, ou `/armurerie` dans
le chat). Flèches pour naviguer, Entrée pour acheter.

**On ne peut acheter qu'une fois la police semée.** GTA garde les étoiles
allumées pendant toute la phase de recherche, donc « niveau de recherche à 0 »
veut dire exactement « la course-poursuite est finie ». La règle est vérifiée
côté serveur (`GetPlayerWantedLevel`), pas seulement dans le menu.

### Les prix

Chaque palier est calibré pour être payé par le revenu du palier juste en
dessous — il faut donc faire monter la réponse policière pour s'offrir de quoi
y survivre.

| Palier | Prix | Ce que ça représente |
| --- | ---: | --- |
| Corps à corps | 50 – 150 | quelques voitures de civils |
| Pistolets | 250 – 1 500 | 3 à 15 flics |
| Mitraillettes / pompes | 1 500 – 4 000 | 2 à 4 voitures de police |
| Fusils d'assaut | 6 000 – 12 000 | 6 à 12 GIGN |
| Précision / mitrailleuses | 15 000 – 35 000 | 2 à 4 véhicules GIGN |
| Explosifs lourds | 50 000 – 250 000 | 1 à 13 véhicules militaires |

Les grenades, molotovs et bombes collantes sont vendus par lots de 5 et restent
accessibles tôt (2 000 – 6 000).

### Munitions et mort

Une arme achetée est acquise pour la session. La racheter ne coûte que **20 %
du prix** et ne fait que recharger les munitions. À la mort, le ped réapparaît
les mains vides : le serveur lui rend tout son arsenal, munitions pleines.

## Déploiement

Cette ressource est un **gametype** FiveM : elle a besoin d'un FXServer, elle
ne se lance pas toute seule.

### 1. Installer le serveur

Télécharger un artifact récent (`fx.tar.xz` sous Linux, `server.7z` sous
Windows) sur https://runtime.fivem.net/artifacts/fivem/ et le décompresser,
puis cloner les ressources de base :

```
git clone https://github.com/citizenfx/cfx-server-data.git server-data
```

Générer une clé serveur sur https://keymaster.fivem.net et la mettre dans
`sv_licenseKey`.

### 2. Poser la ressource

Le **nom du dossier** est ce qui compte, c'est lui qu'on écrit dans le
`server.cfg` :

```
cd server-data/resources
git clone https://github.com/lambher/gta-mode.git gta-mode
cd gta-mode && git checkout claude/gta5-points-gamemode-ao62xc
```

### 3. Configurer

Voir `server.cfg.example`. L'essentiel :

```
ensure mapmanager
ensure chat
ensure spawnmanager
ensure gta-mode
```

`chat` et `spawnmanager` ne sont pas optionnels : le mode s'en sert pour faire
apparaître le joueur et afficher ses messages.

**Ne démarrer qu'un seul gametype.** Si `basic-gamemode` ou `fivem` tourne
aussi, il y a conflit — commenter la ligne.

### 4. Le piège de la carte

Une carte déclare quels gametypes elle accepte, **par nom de ressource**. La
carte par défaut n'accepte que le gametype nommé `fivem`, donc avec un dossier
appelé `gta-mode` mapmanager ne démarrera jamais le mode et rien ne se passera
à la connexion.

Corriger dans le manifeste de la carte
(`resources/[local]/fivem-map-skater/fxmanifest.lua`, ou `__resource.lua` sur
les vieilles versions) :

```lua
resource_type 'map' { gameTypes = { ['gta-mode'] = true } }
```

### 5. Lancer

```
cd server-data
/chemin/vers/artifact/run.sh +exec server.cfg      # Linux
C:\chemin\vers\artifact\FXServer.exe +exec server.cfg   # Windows
```

Puis dans FiveM : F8 → `connect 127.0.0.1:30120`.

### Mettre à jour ensuite

Sur le serveur : `git pull`, puis dans la console FXServer
`restart gta-mode` — pas besoin de redémarrer tout le serveur. Les scores en
cours sont perdus, ils ne vivent qu'en mémoire.

### Débogage

La console FXServer affiche les lignes `[gta-mode]` à chaque kill et chaque
achat. Côté client, F8 ouvre la console du jeu et montre les erreurs de script.

## Points ou argent du jeu

Par défaut (`MONEY.enabled`), les points sont présentés comme de l'argent GTA :
`$1 200` au lieu de `1 200 pts`, avec le widget de portefeuille de GTA Online
et le « +$ » vert à chaque gain.

C'est un **affichage**, pas un changement de système. Le solde qui fait foi
reste celui du serveur : le HUD de GTA vit entièrement côté client, un joueur
peut y écrire ce qu'il veut sans que ça change quoi que ce soit à ce qu'il peut
acheter. On y recopie simplement le solde serveur après chaque transaction.

Le compteur en haut à droite reste dessiné par la ressource, parce que lui
s'affiche toujours ; le widget natif est le décor.

Passer `MONEY.enabled` à `false` dans `config.js` pour revenir à un score sec.

## Réglages

Tout est dans `config.js` :

- `SCORES` — la table ci-dessus.
- `SPAWN` — position, modèle du joueur, véhicule offert au spawn.
- `RESET_SCORE_ON_DEATH` — `false` par défaut (le score se cumule sur la
  session) ; passer à `true` pour une manche arcade où mourir remet à zéro
  (score *et* arsenal).
- `WEAPON_CATEGORIES` — le catalogue de l'armurerie : catégories, prix,
  munitions livrées.
- `SHOP.maxWantedLevel` — le nombre d'étoiles toléré pour acheter (0).
- `SHOP.refillRatio` — le prix d'une recharge, en fraction du prix de l'arme.
- `PED_MODELS` / `VEHICLE_MODELS` — pour ajouter des modèles, y compris des
  add-ons.

## HUD

Le score s'affiche en haut à droite, avec un fil des derniers gains et
dépenses. Maintenir **Z** affiche le classement, **B** ouvre l'armurerie.
