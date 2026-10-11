@echo off
setlocal enabledelayedexpansion

echo =====================================================================
echo  UNIVERSITY OF LAKKI MARWAT - LIBRARY MANAGEMENT SYSTEM
echo  Native Windows Desktop (.exe) Production Packager
echo =====================================================================
echo.

:: 1. Verify Node and npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: 2. Verify .NET SDK
where dotnet >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] .NET SDK is not installed or not in your PATH.
    echo Please install .NET 8.0 SDK or Visual Studio 2022 with .NET desktop development.
    pause
    exit /b 1
)

echo [STEP 1/3] Building frontend assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)
echo [OK] Frontend assets compiled to \dist folder.
echo.

echo [STEP 2/3] Compiling C# WPF Native Windows Desktop Host...
echo Target Project: windows-desktop\UniversityOfLakkiMarwatLMS.Desktop.csproj
dotnet restore windows-desktop\UniversityOfLakkiMarwatLMS.Desktop.csproj
if %errorlevel% neq 0 (
    echo [ERROR] dotnet restore failed.
    pause
    exit /b 1
)

echo.
echo [STEP 3/3] Publishing Single-File Windows Executable (.exe)...
dotnet publish windows-desktop\UniversityOfLakkiMarwatLMS.Desktop.csproj -c Release -r win-x64 --self-contained false /p:PublishSingleFile=true -o dist-desktop
if %errorlevel% neq 0 (
    echo [ERROR] dotnet publish failed.
    pause
    exit /b 1
)

echo.
echo =====================================================================
echo  [SUCCESS] WINDOWS DESKTOP APP GENERATED!
echo  Location: dist-desktop\UniversityOfLakkiMarwatLMS.exe
echo =====================================================================
echo.
echo You can now run dist-desktop\UniversityOfLakkiMarwatLMS.exe or distribute
echo the folder to library circulation desk workstations across campus.
echo.
pause
