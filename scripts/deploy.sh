#!/bin/bash
set -e

# On se place dans le dossier du script ou de l'application
cd "$(dirname "$0")/.."

# Charger les variables d'environnement si le fichier .env existe
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Détecter si on utilise 'docker compose' (V2) ou 'docker-compose' (V1)
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Tentative de login si les variables sont présentes
if [ ! -z "$CR_PAT" ] && [ ! -z "$GITHUB_USERNAME" ]; then
    echo "🔑 Logging in to ghcr.io..."
    echo "$CR_PAT" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
fi

echo "📥 Pulling latest images..."
$DOCKER_COMPOSE pull fivem

echo "🚀 Starting containers..."
# --remove-orphans supprime les anciens conteneurs obsolètes
$DOCKER_COMPOSE up -d --remove-orphans

echo "🧹 Cleaning up old images..."
# Supprime les images inutilisées pour éviter de saturer le disque
docker image prune -f

echo "✅ Deployment successful!"
