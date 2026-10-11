# =====================================================================
#  UNIVERSITY OF LAKKI MARWAT - LIBRARY MANAGEMENT SYSTEM
#  PowerShell Windows Desktop Executable Builder (.exe)
# =====================================================================

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " UNIVERSITY OF LAKKI MARWAT - LIBRARY MANAGEMENT SYSTEM (ULM-LMS)" -ForegroundColor Yellow
Write-Host " Automated Windows PC Desktop (.exe) Production Builder" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

# Check Prerequisites
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm was not found. Please install Node.js (https://nodejs.org)."
    exit 1
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error ".NET SDK was not found. Please install .NET 8.0 SDK or Visual Studio 2022 with .NET Desktop Development."
    exit 1
}

# Step 1: Build Frontend
Write-Host "[STEP 1/3] Compiling React + Tailwind CSS Web Core..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend compilation failed."
    exit 1
}

# Step 2: Restore C# Dependencies
Write-Host "`n[STEP 2/3] Restoring .NET Desktop & Microsoft.Web.WebView2 dependencies..." -ForegroundColor Green
dotnet restore windows-desktop/UniversityOfLakkiMarwatLMS.Desktop.csproj
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to restore .NET packages."
    exit 1
}

# Step 3: Publish Standalone Executable
Write-Host "`n[STEP 3/3] Compiling and Publishing Single-File Windows Executable..." -ForegroundColor Green
dotnet publish windows-desktop/UniversityOfLakkiMarwatLMS.Desktop.csproj `
    -c Release `
    -r win-x64 `
    --self-contained false `
    /p:PublishSingleFile=true `
    -o dist-desktop

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to publish Windows executable."
    exit 1
}

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Windows Desktop (.exe) Successfully Generated!" -ForegroundColor Yellow
Write-Host " Target File: dist-desktop\UniversityOfLakkiMarwatLMS.exe" -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""
