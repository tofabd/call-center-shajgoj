#!/bin/bash

# Get current IPs
WSL_IP=$(hostname -I | awk '{print $1}')
HOST_IP=$(ip route show default | awk '{print $3}')

# Get IPs from .env file
ENV_DB_HOST=$(grep "^DB_HOST=" .env | cut -d'=' -f2)
ENV_REDIS_HOST=$(grep "^REDIS_HOST=" .env | cut -d'=' -f2)

echo "Current Network Status:"
echo "WSL IP: $WSL_IP"
echo "Windows Host IP: $HOST_IP"
echo ""
echo "Current .env settings:"
echo "DB_HOST: $ENV_DB_HOST"
echo "REDIS_HOST: $ENV_REDIS_HOST"
echo ""

# Check if update needed
if [ "$HOST_IP" != "$ENV_DB_HOST" ] || [ "$HOST_IP" != "$ENV_REDIS_HOST" ]; then
    echo "⚠️  IP MISMATCH DETECTED!"
    echo "Run: ./update-ips.sh"
else
    echo "✅ IPs match - no update needed"
fis
