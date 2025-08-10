#!/bin/bash

# VPS Deployment Script for React Router App

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build the application
echo "🔨 Building application..."
pnpm build

# Start the production server
echo "🌐 Starting production server..."
pnpm start
