#!/bin/bash
set -e

# Configuration
SSH_ALIAS="kimsufi"
SERVER_PATH="/home/ubuntu/project/perso/gta-mode"

# 1. Build et Push local
echo "📦 Step 1: Building and pushing image..."
./$(dirname "$0")/publish.sh

# 2. Déploiement à distance via SSH
echo "🚀 Step 2: Deploying on remote server ($SSH_ALIAS)..."
ssh "$SSH_ALIAS" "bash -s" << EOF
    cd "$SERVER_PATH"
    ./scripts/deploy.sh
EOF

echo "✨ All done! System is up to date."
