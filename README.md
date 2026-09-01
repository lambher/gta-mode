# gta-mode

Mode de jeu FiveM (gametype) où chaque joueur marque des points en tuant des PNJ.

## Table des points

| Cible      | Le PNJ | Son véhicule (explosé) |
| ---------- | -----: | ---------------------: |
| Civil      |      1 |                     10 |
| Policier   |    100 |                  1 000 |
| GIGN       |  1 000 |                 10 000 |
| Militaire  |  1 000 |                 10 000 |

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

## Réglages

Tout est dans `config.js` :

- `SCORES` — la table ci-dessus.
- `SPAWN` — position, modèle du joueur, véhicule offert au spawn.
- `RESET_SCORE_ON_DEATH` — `false` par défaut (le score se cumule sur la
  session) ; passer à `true` pour une manche arcade où mourir remet à zéro.
- `PED_MODELS` / `VEHICLE_MODELS` — pour ajouter des modèles, y compris des
  add-ons.

## HUD

Le score s'affiche en haut à droite, avec un fil des derniers gains.
Maintenir **Z** affiche le classement.
