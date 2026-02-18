# HandWrite AI - Windows Setup Script
# Run with: .\setup-windows.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  HandWrite AI - Windows Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check PowerShell version
$PSVersion = $PSVersionTable.PSVersion.Major
if ($PSVersion -lt 5) {
    Write-Host "ERROR: PowerShell 5.0 or higher required!" -ForegroundColor Red
    Write-Host "Your version: $PSVersion" -ForegroundColor Red
    exit 1
}

Write-Host "[1/8] Checking Prerequisites..." -ForegroundColor Yellow

# Check Python
Write-Host "  Checking Python..." -NoNewline
try {
    $pythonVersion = python --version 2>&1
    Write-Host " OK ($pythonVersion)" -ForegroundColor Green
} catch {
    Write-Host " NOT FOUND!" -ForegroundColor Red
    Write-Host "  Please install Python from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "  IMPORTANT: Check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    exit 1
}

# Check Node.js
Write-Host "  Checking Node.js..." -NoNewline
try {
    $nodeVersion = node --version 2>&1
    Write-Host " OK ($nodeVersion)" -ForegroundColor Green
} catch {
    Write-Host " NOT FOUND!" -ForegroundColor Red
    Write-Host "  Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[2/8] Creating folder structure..." -ForegroundColor Yellow

# Create backend folders
New-Item -ItemType Directory -Path "backend" -Force | Out-Null
New-Item -ItemType Directory -Path "backend\fonts" -Force | Out-Null
New-Item -ItemType Directory -Path "backend\uploads" -Force | Out-Null
New-Item -ItemType Directory -Path "backend\uploads\folios" -Force | Out-Null
Write-Host "  Backend folders created" -ForegroundColor Green

# Create frontend folders
New-Item -ItemType Directory -Path "frontend" -Force | Out-Null
New-Item -ItemType Directory -Path "frontend\app" -Force | Out-Null
Write-Host "  Frontend folders created" -ForegroundColor Green

Write-Host ""
Write-Host "[3/8] Moving backend files..." -ForegroundColor Yellow

# Move backend files if they exist in root
$backendFiles = @("app.py", "requirements.txt", ".env.example", "download_fonts.sh")
foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "backend\" -Force
        Write-Host "  Moved $file" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[4/8] Moving frontend files..." -ForegroundColor Yellow

# Move frontend files
if (Test-Path "page.tsx") {
    Move-Item -Path "page.tsx" -Destination "frontend\app\" -Force
    Write-Host "  Moved page.tsx" -ForegroundColor Green
}
if (Test-Path "layout.tsx") {
    Move-Item -Path "layout.tsx" -Destination "frontend\app\" -Force
    Write-Host "  Moved layout.tsx" -ForegroundColor Green
}
if (Test-Path "globals.css") {
    Move-Item -Path "globals.css" -Destination "frontend\app\" -Force
    Write-Host "  Moved globals.css" -ForegroundColor Green
}

$frontendConfigFiles = @("package.json", "tsconfig.json", "tailwind.config.js", "postcss.config.js", "next.config.js")
foreach ($file in $frontendConfigFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "frontend\" -Force
        Write-Host "  Moved $file" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[5/8] Installing Python dependencies..." -ForegroundColor Yellow
Set-Location backend
python -m pip install Flask Flask-CORS Pillow Werkzeug --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Python packages installed" -ForegroundColor Green
} else {
    Write-Host "  Warning: Some packages may not have installed correctly" -ForegroundColor Yellow
}
Set-Location ..

Write-Host ""
Write-Host "[6/8] Installing Node.js dependencies..." -ForegroundColor Yellow
Set-Location frontend
Write-Host "  This may take 3-5 minutes..." -ForegroundColor Cyan
npm install --silent
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Node packages installed" -ForegroundColor Green
} else {
    Write-Host "  Warning: Some packages may not have installed correctly" -ForegroundColor Yellow
}
Set-Location ..

Write-Host ""
Write-Host "[7/8] Generating folio templates..." -ForegroundColor Yellow
if (Test-Path "generate_folio.py") {
    python generate_folio.py --preset all
    Move-Item -Path "folio_*.jpg" -Destination "backend\uploads\folios\" -Force -ErrorAction SilentlyContinue
    $folioCount = (Get-ChildItem "backend\uploads\folios\*.jpg" -ErrorAction SilentlyContinue).Count
    if ($folioCount -gt 0) {
        Write-Host "  Generated $folioCount folio templates" -ForegroundColor Green
    } else {
        Write-Host "  Warning: No folios generated" -ForegroundColor Yellow
    }
} else {
    Write-Host "  generate_folio.py not found, skipping..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[8/8] Checking fonts..." -ForegroundColor Yellow
$fontCount = (Get-ChildItem "backend\fonts\*.ttf" -ErrorAction SilentlyContinue).Count
if ($fontCount -eq 0) {
    Write-Host "  WARNING: No fonts found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  NEXT STEP: Download fonts manually" -ForegroundColor Yellow
    Write-Host "  1. Visit: https://fonts.google.com" -ForegroundColor Cyan
    Write-Host "  2. Download these fonts:" -ForegroundColor Cyan
    Write-Host "     - Indie Flower" -ForegroundColor White
    Write-Host "     - Dancing Script" -ForegroundColor White
    Write-Host "     - Caveat" -ForegroundColor White
    Write-Host "     - Patrick Hand" -ForegroundColor White
    Write-Host "  3. Copy .ttf files to: backend\fonts\" -ForegroundColor Cyan
} else {
    Write-Host "  Found $fontCount font files" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Download fonts (if not done):" -ForegroundColor White
Write-Host "   - Visit https://fonts.google.com" -ForegroundColor Cyan
Write-Host "   - Download and copy .ttf files to backend\fonts\" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Run Backend (Terminal 1):" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Cyan
Write-Host "   python app.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Run Frontend (Terminal 2):" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Open Browser:" -ForegroundColor White
Write-Host "   http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Need help? Check WINDOWS_SETUP.md" -ForegroundColor Yellow
Write-Host ""
