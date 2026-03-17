#!/bin/bash
# Quick setup for local development

set -e

echo "🚀 AI Voice Agent Platform - Setup Script"
echo "==========================================="

# Create .env from .env.example if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo ""
    echo "Creating backend/.env from template..."
    cp .env.example backend/.env
    echo "⚠️  Edit backend/.env and add your GEMINI_API_KEY"
fi

# Setup backend
echo ""
echo "Setting up backend..."

if [ ! -d "backend/.venv" ]; then
    cd backend
    python -m venv .venv
    
    # Activate venv
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        source .venv/Scripts/activate
    else
        source .venv/bin/activate
    fi
    
    pip install --upgrade pip setuptools wheel
    pip install -r requirements.txt
    
    # Create directories
    mkdir -p uploads
    mkdir -p chroma_db
    
    echo "✅ Backend setup complete"
    cd ..
else
    echo "   ✓ Virtual environment already exists"
fi

# Setup frontend
echo ""
echo "Setting up frontend..."

if [ ! -d "frontend/node_modules" ]; then
    cd frontend
    npm install
    echo "✅ Frontend setup complete"
    cd ..
else
    echo "   ✓ node_modules already exists"
fi

# Summary
echo ""
echo "==========================================="
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo ""
echo "Terminal 1 (Backend):"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "  cd backend && .venv\\Scripts\\activate && python -m uvicorn main:app --reload"
else
    echo "  cd backend && source .venv/bin/activate && python -m uvicorn main:app --reload"
fi
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend && npm run dev"
echo ""
echo "Open http://localhost:5173 in your browser"
echo ""
echo "📖 See FREE_DEPLOYMENT_GUIDE.md for production deployment"
echo "==========================================="
