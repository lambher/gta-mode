FROM spritsail/fivem:latest

# Create the resource directory
RUN mkdir -p /config/resources/gta-mode

# Copy resource files
COPY client.js /config/resources/gta-mode/
COPY server.js /config/resources/gta-mode/
COPY config.js /config/resources/gta-mode/
COPY fxmanifest.lua /config/resources/gta-mode/

# Copy server configuration
COPY server.cfg /config/server.cfg
