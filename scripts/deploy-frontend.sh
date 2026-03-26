#!/bin/bash
# Builds the React app and copies it to Strapi's public folder.
# Run from the docuflow/ root: ./scripts/deploy-frontend.sh

set -e

echo "🔨 Building React frontend..."
cd frontend
npm run build

echo "📦 Copying build to Strapi public/app/..."
rm -rf ../backend/public/app
mkdir -p ../backend/public/app
cp -r dist/* ../backend/public/app/

echo "✅ Frontend deployed to backend/public/app/"
echo ""
echo "Start Strapi to serve it:"
echo "  cd backend && NODE_ENV=production npm run start"
echo "  Then open: http://localhost:1337"
