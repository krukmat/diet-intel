#!/usr/bin/env node

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

/**
 * Simplified screenshot capture for DietIntel webapp
 * This script captures screenshots by mocking the webapp interfaces
 */

const config = {
  screenshotsDir: path.join(__dirname, '..', 'screenshots'),
  viewport: { width: 1920, height: 1080 },
  timeout: 30000
};

async function ensureDirectoryExists() {
  try {
    await fs.mkdir(config.screenshotsDir, { recursive: true });
    console.log(`📁 Screenshots directory ready: ${config.screenshotsDir}`);
  } catch (error) {
    console.error('Failed to create screenshots directory:', error);
    throw error;
  }
}

async function createMockHomepage(page) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DietIntel - Smart Nutrition Tracking</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .card-hover:hover { transform: translateY(-4px); transition: transform 0.3s ease; }
        .demo-section { background: linear-gradient(to right, #f8fafc, #e2e8f0); }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Hero Section -->
    <div class="gradient-bg text-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div class="text-center">
                <h1 class="text-4xl md:text-6xl font-bold mb-6">
                    Smart Nutrition Tracking
                </h1>
                <p class="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
                    Scan barcodes, read labels with OCR, and generate AI-powered meal plans tailored to your goals
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <button class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
                        🍽️ Generate Meal Plan
                    </button>
                    <button class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors">
                        📚 View API Docs
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Features Section -->
    <div class="py-16 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-16">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">Powerful Features</h2>
                <p class="text-xl text-gray-600">Everything you need for intelligent nutrition tracking</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div class="text-center p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all card-hover">
                    <div class="text-4xl mb-4">🔍</div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Barcode Lookup</h3>
                    <p class="text-gray-600">Instant product information from global food database</p>
                </div>
                <div class="text-center p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all card-hover">
                    <div class="text-4xl mb-4">📸</div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">OCR Scanning</h3>
                    <p class="text-gray-600">Extract nutrition data from label photos with AI</p>
                </div>
                <div class="text-center p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all card-hover">
                    <div class="text-4xl mb-4">🤖</div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">AI Meal Plans</h3>
                    <p class="text-gray-600">Personalized nutrition plans based on your goals</p>
                </div>
                <div class="text-center p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all card-hover">
                    <div class="text-4xl mb-4">📊</div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Analytics</h3>
                    <p class="text-gray-600">Detailed nutritional breakdowns and tracking</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Demo Section -->
    <div class="py-16 demo-section">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-16">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">Try It Now</h2>
                <p class="text-xl text-gray-600">Test our APIs directly from the browser</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Barcode Lookup Demo -->
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">🔍 Barcode Lookup</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Enter Barcode</label>
                            <input type="text" value="737628064502" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <button class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                            Lookup Product
                        </button>
                        <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                            <h4 class="font-semibold text-green-900 mb-2">✅ Product Found!</h4>
                            <div class="space-y-1 text-sm">
                                <div><strong>Name:</strong> Organic Greek Yogurt</div>
                                <div><strong>Brand:</strong> Chobani</div>
                                <div><strong>Calories:</strong> 100 kcal/100g</div>
                                <div><strong>Protein:</strong> 10g/100g</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- OCR Demo -->
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">📸 OCR Label Scanning</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Upload Nutrition Label</label>
                            <input type="file" accept="image/*" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <button class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                            Scan Label
                        </button>
                        <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                            <h4 class="font-semibold text-blue-900 mb-2">📸 Processing...</h4>
                            <div class="text-sm text-blue-800">Upload an image to see OCR in action!</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Stats Section -->
    <div class="py-16 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-16">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">System Performance</h2>
                <p class="text-xl text-gray-600">Real-time metrics from our API</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="text-center">
                    <div class="text-4xl font-bold text-blue-600 mb-2">87%</div>
                    <div class="text-gray-600">Cache Hit Rate</div>
                </div>
                <div class="text-center">
                    <div class="text-4xl font-bold text-green-600 mb-2">145ms</div>
                    <div class="text-gray-600">Avg Response Time</div>
                </div>
                <div class="text-center">
                    <div class="text-4xl font-bold text-purple-600 mb-2">92%</div>
                    <div class="text-gray-600">OCR Accuracy</div>
                </div>
                <div class="text-center">
                    <div class="text-4xl font-bold text-orange-600 mb-2">1.2k+</div>
                    <div class="text-gray-600">Plans Generated</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
  `;
  
  await page.setContent(html);
  await page.waitForTimeout(1000);
}

async function createMockDashboard(page) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meal Plans - DietIntel</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .card-hover:hover { transform: translateY(-2px); transition: transform 0.3s ease; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .progress-bar { height: 8px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 4px; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-3xl font-bold text-gray-900">Meal Plans</h1>
                <p class="mt-2 text-gray-600">Manage your personalized nutrition plans</p>
            </div>
            <button class="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                ➕ Generate New Plan
            </button>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-blue-100">
                        <span class="text-2xl">📊</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">Total Plans</p>
                        <p class="text-2xl font-bold text-gray-900">12</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-green-100">
                        <span class="text-2xl">✅</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">Active</p>
                        <p class="text-2xl font-bold text-gray-900">3</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-yellow-100">
                        <span class="text-2xl">⏳</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">Pending</p>
                        <p class="text-2xl font-bold text-gray-900">2</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-purple-100">
                        <span class="text-2xl">🎯</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">Avg Calories</p>
                        <p class="text-2xl font-bold text-gray-900">2,250</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filter and Search -->
        <div class="bg-white rounded-lg shadow mb-6 p-4">
            <div class="flex flex-col sm:flex-row gap-4">
                <div class="flex-1">
                    <input type="text" placeholder="Search meal plans..." 
                           class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <select class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                </select>
                <select class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="date">Sort by Date</option>
                    <option value="name">Sort by Name</option>
                    <option value="calories">Sort by Calories</option>
                </select>
            </div>
        </div>

        <!-- Plans Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Plan 1 -->
            <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow card-hover">
                <div class="p-6">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">High Protein Plan</h3>
                            <p class="text-sm text-gray-600">For Friday, Aug 30</p>
                        </div>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✅ Active
                        </span>
                    </div>
                    <div class="mb-4">
                        <div class="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>Daily Calories</span>
                            <span class="font-medium">2,200 kcal</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="progress-bar h-2 rounded-full" style="width: 73%"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                        <div>
                            <div class="text-lg font-semibold text-gray-900">4</div>
                            <div class="text-xs text-gray-600">Meals</div>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">12</div>
                            <div class="text-xs text-gray-600">Items</div>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">165g</div>
                            <div class="text-xs text-gray-600">Protein</div>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                            View Details
                        </button>
                        <button class="bg-gray-100 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
                            📋
                        </button>
                        <button class="bg-red-100 text-red-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-red-200 transition-colors">
                            🗑️
                        </button>
                    </div>
                    <div class="mt-4 pt-4 border-t border-gray-100">
                        <p class="text-xs text-gray-500">Created 8/29/2025</p>
                    </div>
                </div>
            </div>

            <!-- Plan 2 -->
            <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow card-hover">
                <div class="p-6">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Weight Loss Plan</h3>
                            <p class="text-sm text-gray-600">For Saturday, Aug 31</p>
                        </div>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⏳ Pending
                        </span>
                    </div>
                    <div class="mb-4">
                        <div class="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>Daily Calories</span>
                            <span class="font-medium">1,800 kcal</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-yellow-500 h-2 rounded-full" style="width: 60%"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                        <div>
                            <div class="text-lg font-semibold text-gray-900">4</div>
                            <div class="text-xs text-gray-600">Meals</div>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">9</div>
                            <div class="text-xs text-gray-600">Items</div>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">120g</div>
                            <div class="text-xs text-gray-600">Protein</div>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                            View Details
                        </button>
                        <button class="bg-gray-100 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
                            📋
                        </button>
                        <button class="bg-red-100 text-red-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-red-200 transition-colors">
                            🗑️
                        </button>
                    </div>
                    <div class="mt-4 pt-4 border-t border-gray-100">
                        <p class="text-xs text-gray-500">Created 8/28/2025</p>
                    </div>
                </div>
            </div>

            <!-- Plan 3 -->
            <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow card-hover">
                <div class="p-6">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Balanced Nutrition</h3>
                            <p class="text-sm text-gray-600">For Sunday, Sep 1</p>
                        </div>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✅ Active
                        </span>
                    </div>
                    <div class="mb-4">
                        <div class="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>Daily Calories</span>
                            <span class="font-medium">2,400 kcal</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="progress-bar h-2 rounded-full" style="width: 80%"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                        <div>
                            <div class="text-lg font-semibold text-gray-900">4</div>
                            <div class="text-xs text-gray-600">Meals</div>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">14</div>
                            <div class="text-xs text-gray-600">Items</div>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">140g</div>
                            <div class="text-xs text-gray-600">Protein</div>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                            View Details
                        </button>
                        <button class="bg-gray-100 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
                            📋
                        </button>
                        <button class="bg-red-100 text-red-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-red-200 transition-colors">
                            🗑️
                        </button>
                    </div>
                    <div class="mt-4 pt-4 border-t border-gray-100">
                        <p class="text-xs text-gray-500">Created 8/27/2025</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
  `;
  
  await page.setContent(html);
  await page.waitForTimeout(1000);
}

async function createMockDetailPage(page) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>High Protein Plan - DietIntel</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .progress-ring { transition: stroke-dashoffset 0.5s ease-in-out; }
        .meal-card { border-left: 4px solid #3b82f6; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header Section -->
        <div class="mb-8">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">High Protein Plan</h1>
                    <p class="mt-2 text-gray-600">Generated on Friday, August 30, 2025</p>
                </div>
                <div class="flex space-x-3">
                    <button class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                        📄 Export PDF
                    </button>
                    <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                        📤 Share
                    </button>
                </div>
            </div>
        </div>

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-blue-100">
                        <span class="text-2xl">🔥</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">Daily Target</p>
                        <p class="text-2xl font-bold text-gray-900">2,200</p>
                        <p class="text-xs text-gray-500">kcal</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-green-100">
                        <span class="text-2xl">⚡</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">BMR</p>
                        <p class="text-2xl font-bold text-gray-900">1,750</p>
                        <p class="text-xs text-gray-500">kcal/day</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-yellow-100">
                        <span class="text-2xl">🏃</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">TDEE</p>
                        <p class="text-2xl font-bold text-gray-900">2,200</p>
                        <p class="text-xs text-gray-500">kcal/day</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-purple-100">
                        <span class="text-2xl">📊</span>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-600">Actual Total</p>
                        <p class="text-2xl font-bold text-gray-900">2,150</p>
                        <p class="text-xs text-gray-500">kcal</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Macros Overview -->
        <div class="bg-white rounded-lg shadow mb-8">
            <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900">Macronutrient Breakdown</h2>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Macro Chart -->
                    <div class="flex justify-center">
                        <div class="relative w-64 h-64">
                            <canvas id="macrosChart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Macro Details -->
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                                <span class="font-medium text-gray-900">Protein</span>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-gray-900">165g</p>
                                <p class="text-sm text-gray-600">30%</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
                                <span class="font-medium text-gray-900">Fat</span>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-gray-900">95g</p>
                                <p class="text-sm text-gray-600">40%</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                                <span class="font-medium text-gray-900">Carbohydrates</span>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-gray-900">215g</p>
                                <p class="text-sm text-gray-600">30%</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
                                <span class="font-medium text-gray-900">Sugars</span>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-gray-900">45g</p>
                                <p class="text-sm text-gray-600">-</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Meals Section -->
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-900">Daily Meals</h2>
            
            <!-- Breakfast -->
            <div class="bg-white rounded-lg shadow meal-card">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">🌅</span>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">Breakfast</h3>
                            <p class="text-sm text-gray-600">Target: 550 kcal | Actual: 525 kcal</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <div class="w-16 h-16">
                            <svg class="w-16 h-16 transform -rotate-90">
                                <circle cx="32" cy="32" r="28" stroke="#e5e7eb" stroke-width="4" fill="transparent"/>
                                <circle cx="32" cy="32" r="28" stroke="#3b82f6" stroke-width="4" fill="transparent"
                                        stroke-dasharray="176" stroke-dashoffset="18" class="progress-ring"/>
                            </svg>
                        </div>
                        <span class="ml-2 text-sm font-medium text-gray-600">95%</span>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div class="flex-1">
                                <h4 class="font-medium text-gray-900">Greek Yogurt with Berries</h4>
                                <div class="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                                    <span>📏 200g</span>
                                    <span>🔥 150 kcal</span>
                                    <span class="font-mono text-xs bg-gray-200 px-2 py-1 rounded">000000000001</span>
                                </div>
                                <div class="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">P: 15.0g</span>
                                    <span class="bg-red-100 text-red-800 px-2 py-1 rounded">F: 5.0g</span>
                                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded">C: 20.0g</span>
                                    <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">S: 12.0g</span>
                                    <span class="bg-gray-100 text-gray-800 px-2 py-1 rounded">Salt: 0.1g</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div class="flex-1">
                                <h4 class="font-medium text-gray-900">Granola</h4>
                                <div class="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                                    <span>📏 30g</span>
                                    <span>🔥 375 kcal</span>
                                    <span class="font-mono text-xs bg-gray-200 px-2 py-1 rounded">000000000002</span>
                                </div>
                                <div class="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">P: 8.0g</span>
                                    <span class="bg-red-100 text-red-800 px-2 py-1 rounded">F: 12.0g</span>
                                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded">C: 45.0g</span>
                                    <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">S: 8.0g</span>
                                    <span class="bg-gray-100 text-gray-800 px-2 py-1 rounded">Salt: 0.2g</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Lunch -->
            <div class="bg-white rounded-lg shadow meal-card" style="border-left-color: #10b981;">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">🌞</span>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">Lunch</h3>
                            <p class="text-sm text-gray-600">Target: 880 kcal | Actual: 850 kcal</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <div class="w-16 h-16">
                            <svg class="w-16 h-16 transform -rotate-90">
                                <circle cx="32" cy="32" r="28" stroke="#e5e7eb" stroke-width="4" fill="transparent"/>
                                <circle cx="32" cy="32" r="28" stroke="#10b981" stroke-width="4" fill="transparent"
                                        stroke-dasharray="176" stroke-dashoffset="23" class="progress-ring"/>
                            </svg>
                        </div>
                        <span class="ml-2 text-sm font-medium text-gray-600">97%</span>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div class="flex-1">
                                <h4 class="font-medium text-gray-900">Grilled Chicken Salad</h4>
                                <div class="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                                    <span>📏 250g</span>
                                    <span>🔥 420 kcal</span>
                                </div>
                                <div class="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">P: 45.0g</span>
                                    <span class="bg-red-100 text-red-800 px-2 py-1 rounded">F: 18.0g</span>
                                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded">C: 12.0g</span>
                                    <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">S: 8.0g</span>
                                    <span class="bg-gray-100 text-gray-800 px-2 py-1 rounded">Salt: 1.2g</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div class="flex-1">
                                <h4 class="font-medium text-gray-900">Quinoa & Vegetables</h4>
                                <div class="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                                    <span>📏 180g</span>
                                    <span>🔥 430 kcal</span>
                                </div>
                                <div class="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">P: 16.0g</span>
                                    <span class="bg-red-100 text-red-800 px-2 py-1 rounded">F: 12.0g</span>
                                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded">C: 68.0g</span>
                                    <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">S: 4.0g</span>
                                    <span class="bg-gray-100 text-gray-800 px-2 py-1 rounded">Salt: 0.8g</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Plan Info -->
        <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-blue-900 mb-4">Plan Information</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="font-medium text-blue-900">Flexibility Used:</span>
                    <span class="ml-2 text-blue-700">Yes</span>
                </div>
                <div>
                    <span class="font-medium text-blue-900">Optional Products:</span>
                    <span class="ml-2 text-blue-700">2 included</span>
                </div>
                <div>
                    <span class="font-medium text-blue-900">Plan ID:</span>
                    <span class="ml-2 font-mono text-blue-700">hp-001</span>
                </div>
                <div>
                    <span class="font-medium text-blue-900">Created:</span>
                    <span class="ml-2 text-blue-700">8/30/2025, 10:15:32 AM</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const ctx = document.getElementById('macrosChart').getContext('2d');
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Protein', 'Fat', 'Carbs'],
                    datasets: [{
                        data: [30, 40, 30],
                        backgroundColor: ['#3b82f6', '#ef4444', '#22c55e'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        });
    </script>
</body>
</html>
  `;
  
  await page.setContent(html);
  await page.waitForTimeout(2000);
}

async function captureScreenshots() {
  console.log('🚀 Starting simplified screenshot capture...\n');
  
  await ensureDirectoryExists();
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    console.log('📸 Capturing screenshots...\n');
    
    // Homepage
    console.log('📸 Capturing homepage...');
    const homepageContext = await browser.newContext({ viewport: config.viewport });
    const homepagePage = await homepageContext.newPage();
    await createMockHomepage(homepagePage);
    await homepagePage.screenshot({
      path: path.join(config.screenshotsDir, 'homepage.png'),
      fullPage: true,
      quality: 90
    });
    await homepageContext.close();
    console.log('  ✅ Homepage screenshot saved');
    
    // Dashboard
    console.log('📸 Capturing meal plans dashboard...');
    const dashboardContext = await browser.newContext({ viewport: config.viewport });
    const dashboardPage = await dashboardContext.newPage();
    await createMockDashboard(dashboardPage);
    await dashboardPage.screenshot({
      path: path.join(config.screenshotsDir, 'meal-plans-dashboard.png'),
      fullPage: true,
      quality: 90
    });
    await dashboardContext.close();
    console.log('  ✅ Dashboard screenshot saved');
    
    // Detail page
    console.log('📸 Capturing meal plan detail...');
    const detailContext = await browser.newContext({ viewport: config.viewport });
    const detailPage = await detailContext.newPage();
    await createMockDetailPage(detailPage);
    await detailPage.screenshot({
      path: path.join(config.screenshotsDir, 'meal-plan-detail.png'),
      fullPage: true,
      quality: 90
    });
    await detailContext.close();
    console.log('  ✅ Detail page screenshot saved');
    
    // API Docs (mock)
    console.log('📸 Creating API docs screenshot...');
    const apiContext = await browser.newContext({ viewport: config.viewport });
    const apiPage = await apiContext.newPage();
    
    const apiHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>DietIntel API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        body { margin: 0; padding: 0; }
        .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .swagger-ui .topbar { background: #1f2937; }
        .swagger-ui .topbar .topbar-wrapper { padding: 0 20px; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { font-size: 36px; color: #3b4151; }
        .swagger-ui .info .description { margin: 20px 0; }
        .swagger-ui .scheme-container { margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 4px; }
        .swagger-ui .opblock { margin: 10px 0; border-radius: 4px; }
        .swagger-ui .opblock.opblock-post { border-color: #49cc90; background: rgba(73, 204, 144, 0.1); }
        .swagger-ui .opblock.opblock-get { border-color: #61affe; background: rgba(97, 175, 254, 0.1); }
        .swagger-ui .opblock-summary { padding: 15px; }
        .swagger-ui .opblock-summary-method { font-weight: 700; }
    </style>
</head>
<body>
    <div id="swagger-ui" class="swagger-ui">
        <div class="topbar">
            <div class="topbar-wrapper">
                <div class="topbar-logo">
                    <span style="color: white; font-size: 18px; font-weight: bold;">DietIntel API</span>
                </div>
            </div>
        </div>
        
        <div class="information-container wrapper">
            <section class="block col-12">
                <div class="info">
                    <div class="title">DietIntel API</div>
                    <div class="description">
                        <p>A comprehensive FastAPI application for nutrition tracking with barcode product lookup, OCR label scanning, and AI-powered daily meal planning.</p>
                        <p><strong>Version:</strong> 1.0.0</p>
                    </div>
                </div>
                
                <div class="scheme-container">
                    <label>Servers</label>
                    <div>
                        <select>
                            <option value="http://localhost:8000">http://localhost:8000</option>
                        </select>
                    </div>
                </div>
            </section>
        </div>
        
        <div class="wrapper">
            <section class="block col-12">
                <div class="tag-container">
                    <h3>product</h3>
                    
                    <div class="opblock opblock-post">
                        <div class="opblock-summary opblock-summary-post">
                            <span class="opblock-summary-method" style="background: #49cc90; color: white; padding: 3px 8px; border-radius: 3px;">POST</span>
                            <span class="opblock-summary-path">/product/by-barcode</span>
                            <div class="opblock-summary-description">Lookup product information by barcode using OpenFoodFacts API</div>
                        </div>
                    </div>
                    
                    <div class="opblock opblock-post">
                        <div class="opblock-summary opblock-summary-post">
                            <span class="opblock-summary-method" style="background: #49cc90; color: white; padding: 3px 8px; border-radius: 3px;">POST</span>
                            <span class="opblock-summary-path">/product/scan-label</span>
                            <div class="opblock-summary-description">OCR nutrition label scanning with local processing</div>
                        </div>
                    </div>
                    
                    <div class="opblock opblock-post">
                        <div class="opblock-summary opblock-summary-post">
                            <span class="opblock-summary-method" style="background: #49cc90; color: white; padding: 3px 8px; border-radius: 3px;">POST</span>
                            <span class="opblock-summary-path">/product/scan-label-external</span>
                            <div class="opblock-summary-description">OCR with external service fallback for better accuracy</div>
                        </div>
                    </div>
                </div>
                
                <div class="tag-container" style="margin-top: 30px;">
                    <h3>plan</h3>
                    
                    <div class="opblock opblock-post">
                        <div class="opblock-summary opblock-summary-post">
                            <span class="opblock-summary-method" style="background: #49cc90; color: white; padding: 3px 8px; border-radius: 3px;">POST</span>
                            <span class="opblock-summary-path">/plan/generate</span>
                            <div class="opblock-summary-description">Generate personalized daily meal plans based on user profile and goals</div>
                        </div>
                    </div>
                    
                    <div class="opblock opblock-get">
                        <div class="opblock-summary opblock-summary-get">
                            <span class="opblock-summary-method" style="background: #61affe; color: white; padding: 3px 8px; border-radius: 3px;">GET</span>
                            <span class="opblock-summary-path">/plan/config</span>
                            <div class="opblock-summary-description">Get meal planning configuration settings and defaults</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</body>
</html>
    `;
    
    await apiPage.setContent(apiHtml);
    await apiPage.waitForTimeout(1000);
    await apiPage.screenshot({
      path: path.join(config.screenshotsDir, 'api-docs.png'),
      fullPage: true,
      quality: 90
    });
    await apiContext.close();
    console.log('  ✅ API docs screenshot saved');
    
    console.log('\n✅ All screenshots captured successfully!');
    
    const files = await fs.readdir(config.screenshotsDir);
    const screenshots = files.filter(file => file.endsWith('.png'));
    
    console.log('\n📋 Captured screenshots:');
    screenshots.forEach(file => {
      console.log(`  • ${file}`);
    });
    
  } catch (error) {
    console.error('❌ Screenshot capture failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (require.main === module) {
  captureScreenshots().catch(console.error);
}

module.exports = { captureScreenshots };