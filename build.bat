@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo   Building Browser Extension (Dist)
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install it from https://nodejs.org/
    pause
    exit /b
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
)

echo [INFO] Running build process...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Build complete! 
    echo.
    echo To install the extension:
    echo 1. Open Chrome and go to chrome://extensions/
    echo 2. Enable "Developer mode" (top right)
    echo 3. Click "Load unpacked"
    echo 4. Select the "dist" folder in this directory.
) else (
    echo.
    echo [ERROR] Build failed. Check the errors above.
)

pause
