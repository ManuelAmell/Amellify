#!/bin/bash
# Abre Amellify — lanzador rápido
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec npx electron . 2>/dev/null
