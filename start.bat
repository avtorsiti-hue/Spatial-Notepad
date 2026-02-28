@echo off
echo ==========================================
echo   Obsidian-style Mind Map Starter
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 goto :no_node

echo [INFO] Node.js found.
echo.

:: Check if node_modules exists
if exist "node_modules\" goto :check_vite

echo [INFO] Installing dependencies (first run)...
call npm install
if %errorlevel% neq 0 goto :install_failed

:check_vite
if exist "node_modules\.bin\vite.cmd" goto :start_app

echo [ERROR] Vite not found in node_modules!
echo Trying to repair by running npm install again...
call npm install

:start_app
echo [INFO] Starting the application...
echo The app will be available at http://localhost:3000
echo.

:: Run the dev server using npm
call npm run dev

if %errorlevel% neq 0 goto :start_failed

pause
exit /b

:no_node
echo [ERROR] Node.js is not installed!
echo Please download and install it from https://nodejs.org/
pause
exit /b

:install_failed
echo [ERROR] Failed to install dependencies.
pause
exit /b

:start_failed
echo.
echo [ERROR] Application failed to start.
echo Possible reasons:
echo 1. Port 3000 is already in use by another program.
echo 2. Missing files (check if 'src' folder exists).
echo 3. Node.js version is too old (need 18+).
pause
exit /b
