#!/bin/bash

# Get local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    IP=$(ipconfig getifaddr en0)
else
    # Linux
    IP=$(hostname -I | awk '{print $1}')
fi

# Update capacitor.config.json with the IP address
sed -i.bak "s/YOUR_LOCAL_IP/$IP/g" capacitor.config.json

# Start the dev server
npm run dev -- --host $IP

# Restore original capacitor.config.json
mv capacitor.config.json.bak capacitor.config.json 