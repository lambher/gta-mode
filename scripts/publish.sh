#!/bin/bash
set -e

# Charger les variables d'environnement si le fichier .env existe
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Configuration
REGISTRY="ghcr.io"
IMAGE_NAME="lambher/gta-mode"
TAG="latest"
FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME:$TAG"

# 1. Vérification de la syntaxe du code avant de compiler l'image (super important !)
echo "🔍 Checking JavaScript syntax..."
node -c "$ROOT_DIR/config.js" "$ROOT_DIR/server.js" "$ROOT_DIR/client.js"
echo "✅ Syntax is clean!"

# 2. Connexion au registre d'images si les variables sont renseignées
if [ ! -z "$CR_PAT" ] && [ ! -z "$GITHUB_USERNAME" ]; then
    echo "🔑 Logging in to $REGISTRY..."
    echo "$CR_PAT" | docker login "$REGISTRY" -u "$GITHUB_USERNAME" --password-stdin
fi

# 3. Build et Push de l'image Docker
echo "🚀 Building image for linux/amd64 (max compatibility mode)..."
# On désactive provenance et sbom pour être lisible par les anciennes versions de docker-compose
docker buildx build --platform linux/amd64 --provenance=false --sbom=false -t "$FULL_IMAGE_NAME" --push "$ROOT_DIR"

echo "✅ Image pushed to $FULL_IMAGE_NAME"
