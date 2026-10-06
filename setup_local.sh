#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/backend/uploads"
echo "Installing backend dependencies..."
(cd "$ROOT/backend" && npm install && npx prisma generate)
echo "Installing frontend dependencies..."
(cd "$ROOT/frontend" && npm install)
if [ ! -f "$ROOT/backend/.env" ]; then cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"; fi
if [ ! -f "$ROOT/frontend/.env" ]; then cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"; fi
echo "Setup files are ready. Configure backend/.env, then run the migration and seed."
