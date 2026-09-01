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
