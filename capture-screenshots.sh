#!/bin/bash

# DietIntel Screenshot Capture Script
# This script starts the necessary services and captures screenshots

echo "🚀 DietIntel Screenshot Capture"
echo "================================="

# Function to check if a process is running on a port
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to start API server
start_api() {
    echo "🔄 Starting API server..."
    if check_port 8000; then
        echo "✅ API server already running on port 8000"
    else
        echo "🚀 Starting API server on port 8000..."
        python main.py &
        API_PID=$!
        echo "⏳ Waiting for API server to start..."
        sleep 10
        
        if check_port 8000; then
            echo "✅ API server started successfully"
        else
            echo "❌ Failed to start API server"
            exit 1
        fi
    fi
}

# Function to start webapp
start_webapp() {
    echo "🔄 Starting webapp..."
    if check_port 3000; then
        echo "✅ Webapp already running on port 3000"
    else
        echo "🚀 Starting webapp on port 3000..."
        cd webapp
        npm start &
        WEBAPP_PID=$!
        cd ..
        echo "⏳ Waiting for webapp to start..."
        sleep 15
        
        if check_port 3000; then
            echo "✅ Webapp started successfully"
        else
            echo "❌ Failed to start webapp"
            exit 1
        fi
    fi
}

# Function to capture screenshots
capture_screenshots() {
    echo "📸 Capturing screenshots..."
    cd webapp
    node ../scripts/capture-screenshots.js
    SCREENSHOT_RESULT=$?
    cd ..
    
    if [ $SCREENSHOT_RESULT -eq 0 ]; then
        echo "✅ Screenshots captured successfully!"
    else
        echo "❌ Screenshot capture failed"
        return 1
    fi
}

# Function to cleanup processes
cleanup() {
    echo "🧹 Cleaning up..."
    if [ ! -z "$API_PID" ]; then
        echo "🛑 Stopping API server (PID: $API_PID)..."
        kill $API_PID 2>/dev/null
    fi
    if [ ! -z "$WEBAPP_PID" ]; then
        echo "🛑 Stopping webapp (PID: $WEBAPP_PID)..."
        kill $WEBAPP_PID 2>/dev/null
    fi
    echo "✅ Cleanup complete"
}

# Trap cleanup on script exit
trap cleanup EXIT

# Main execution
echo "📋 Checking prerequisites..."

# Check if Python is available
if ! command -v python &> /dev/null; then
    echo "❌ Python is not available. Please install Python."
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not available. Please install Node.js."
    exit 1
fi

# Check if required files exist
if [ ! -f "main.py" ]; then
    echo "❌ main.py not found. Make sure you're in the DietIntel root directory."
    exit 1
fi

if [ ! -d "webapp" ]; then
    echo "❌ webapp directory not found. Make sure you're in the DietIntel root directory."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Start services
start_api
start_webapp

echo ""
echo "🌐 Services are running:"
echo "  • API: http://localhost:8000"
echo "  • Webapp: http://localhost:3000"
echo ""

# Capture screenshots
if capture_screenshots; then
    echo ""
    echo "🎉 Screenshot capture completed successfully!"
    echo "📁 Screenshots saved to: ./screenshots/"
    echo ""
    echo "📋 You can now view the screenshots:"
    echo "  • homepage.png"
    echo "  • meal-plans-dashboard.png" 
    echo "  • meal-plan-detail.png"
    echo "  • api-docs.png"
else
    echo ""
    echo "❌ Screenshot capture failed. Check the logs above."
    exit 1
fi