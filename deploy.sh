#!/bin/bash
# Quick deployment test script

set -e

echo "🚀 AI Voice Agent Platform - Deployment Checker"
echo "================================================"

# Check prerequisites
echo ""
echo "✓ Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not installed. Install from https://docker.com"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not installed. Install from https://nodejs.org"
    exit 1
fi

if ! command -v python &> /dev/null; then
    echo "❌ Python not installed. Install from https://python.org"
    exit 1
fi

echo "   ✓ Docker: $(docker --version)"
echo "   ✓ Node.js: $(node --version)"
echo "   ✓ Python: $(python --version)"

# Check for required files
echo ""
echo "✓ Checking deployment files..."

required_files=(
    ".env.example"
    "backend/Dockerfile"
    "backend/requirements.txt"
    "render.yaml"
    "vercel.json"
    "FREE_DEPLOYMENT_GUIDE.md"
    "frontend/package.json"
    "frontend/vite.config.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file"
    else
        echo "   ❌ Missing: $file"
        exit 1
    fi
done

# Check Python env
echo ""
echo "✓ Checking Python environment..."

if [ ! -d "backend/.venv" ]; then
    echo "   Creating virtual environment..."
    python -m venv backend/.venv
fi

source backend/.venv/Scripts/activate 2>/dev/null || source backend/.venv/bin/activate

echo "   ✓ Virtual environment active"

# Check Python dependencies
echo ""
echo "✓ Checking Python dependencies..."

pip install -q -r backend/requirements.txt
echo "   ✓ All Python packages installed"

# Check Node dependencies
echo ""
echo "✓ Checking Node dependencies..."

if [ ! -d "frontend/node_modules" ]; then
    cd frontend
    npm install -q
    cd ..
fi

echo "   ✓ All Node packages installed"

# Build frontend
echo ""
echo "✓ Building frontend..."

cd frontend
npm run build > /dev/null 2>&1
cd ..

echo "   ✓ Frontend built successfully"

# Test backend imports
echo ""
echo "✓ Testing backend imports..."

python -c "from backend.main import app; from backend.database import init_db; print('   ✓ Backend imports OK')"

# Summary
echo ""
echo "================================================"
echo "✅ All checks passed! Your app is deployment-ready."
echo ""
echo "Next steps:"
echo "1. Push to GitHub"
echo "2. Connect Render (backend)"
echo "3. Connect Vercel (frontend)"
echo "4. Set environment variables (see FREE_DEPLOYMENT_GUIDE.md)"
echo ""
echo "📖 See FREE_DEPLOYMENT_GUIDE.md for detailed instructions"
echo "================================================"
