# University of Lakki Marwat - LMS (Windows PC Desktop Guide)

This guide explains how to open, build, run, and publish the **University of Lakki Marwat Library Management System** as a native Windows PC desktop application (`.exe`) using **Microsoft Visual Studio 2022**.

---

## 1. Prerequisites on Windows PC

1. **Microsoft Visual Studio 2022** (Community, Professional, or Enterprise)
   - Workload required: **.NET desktop development** (includes WPF, C#, and .NET 8.0 SDK)
2. **Node.js 18+ or 20+ LTS** (from [nodejs.org](https://nodejs.org))
3. **Microsoft Edge WebView2 Runtime** (pre-installed on Windows 10 & 11)

---

## 2. Opening the Project in Visual Studio 2022

1. Double-click **`UniversityOfLakkiMarwatLMS.sln`** in the root directory (or open Visual Studio 2022 and choose `File > Open > Project/Solution`).
2. In the **Solution Explorer**, you will see two integrated projects:
   - **`UniversityOfLakkiMarwatLMS.Desktop`** (C# .NET WPF Windows Desktop Executable Host)
   - **`UniversityOfLakkiMarwatLMS`** (TypeScript / React Web Application Core)

---

## 3. Running & Debugging in Visual Studio (<kbd>F5</kbd>)

1. In the Solution Explorer, right-click **`UniversityOfLakkiMarwatLMS.Desktop`** and click **Set as Startup Project**.
2. Make sure you have installed packages by opening the terminal in the root directory and running:
   ```bash
   npm install
   npm run build
   ```
3. In Visual Studio, choose **Debug** configuration and platform **x64** or **Any CPU**.
4. Press <kbd>F5</kbd> (or click the green **Start** button).
5. Visual Studio will compile the C# host, spin up the Chromium WebView2 engine, and display the ULM LMS native desktop application window.

> **Live Dev Reload**: If you want live hot-reloading while editing in Visual Studio, run `npm run dev` in a terminal. The C# desktop window automatically detects `http://localhost:3000` and points directly to your live changes!

---

## 4. Publishing a Single-File Windows Executable (`.exe`)

### Method A: From Visual Studio 2022 GUI (Recommended)
1. Build the production web bundle:
   ```bash
   npm run build
   ```
2. In Visual Studio Solution Explorer, right-click **`UniversityOfLakkiMarwatLMS.Desktop`** and select **Publish...**
3. Select **Folder** as the target, and click **Next**.
4. Click **Finish**.
5. On the Publish Profile page, click **Show all settings**:
   - **Configuration**: `Release | x64`
   - **Target Framework**: `net8.0-windows`
   - **Deployment Mode**: `Framework-dependent` (or `Self-contained` to run without needing .NET installed)
   - **Target Runtime**: `win-x64`
   - Expand **File Publish Options**:
     - Check **Produce single file**
     - Check **Enable ReadyToRun compilation** (ultra-fast startup)
6. Click **Publish**.
7. Visual Studio will generate a single `UniversityOfLakkiMarwatLMS.exe` file inside your publish folder.

---

### Method B: Automated 1-Click Command Script
We have included automated batch and PowerShell scripts:

- **Command Prompt (CMD)**:
  ```cmd
  scripts\build-windows-exe.bat
  ```

- **PowerShell**:
  ```powershell
  .\scripts\build-windows-exe.ps1
  ```

Output: A standalone, optimized `UniversityOfLakkiMarwatLMS.exe` in `dist-desktop\`.

---

## 5. Native Windows Desktop Features Included

- **Offline SQLite & Local Storage**: Data persists in `%LOCALAPPDATA%\UniversityOfLakkiMarwatLMS\WebView2Data\`, meaning the app operates completely offline without requiring an internet connection.
- **USB Hardware Barcode Scanner Support**: Automatically accepts USB barcode scanners sending standard HID keyboard strokes and `<Enter>` returns.
- **Windows Title Bar IPC Integration**: The custom top title bar communicates directly with Windows OS for Minimize, Maximize, and Close actions.
- **Per-Monitor High-DPI Crisp Rendering**: Full `app.manifest` configuring PerMonitorV2 scaling for 1080p, 2K, and 4K campus monitors.
- **Zero Web Port Conflicts**: Production mode uses virtual host mapping (`https://ulm-lms.local/`) directly to compiled files, preventing port conflicts on shared library PCs.
