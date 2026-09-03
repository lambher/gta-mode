#!/bin/bash

# Configuration
SSH_ALIAS="kimsufi"

echo "📋 Fetching remote logs for gta-mode-server..."
ssh "$SSH_ALIAS" "docker logs --follow gta-mode-server"
