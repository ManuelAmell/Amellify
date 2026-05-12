#!/bin/bash

echo "🛑 Deteniendo Amellify..."
if pkill -f "node server.js"; then
    echo "✅ App detenida"
    rm -f /tmp/amellify.log
else
    echo "⚠️  La app no estaba corriendo"
fi