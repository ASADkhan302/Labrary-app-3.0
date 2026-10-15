const { app, BrowserWindow, ipcMain, shell, Menu, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
const windowStateFile = path.join(app.getPath('userData'), 'ulm_lms_window_state.json');

function loadWindowState() {
  const defaultState = {
    width: 1440,
    height: 900,
    x: undefined,
    y: undefined,
    isMaximized: true, // Default to maximized on startup per specification
  };

  try {
    if (fs.existsSync(windowStateFile)) {
      const raw = fs.readFileSync(windowStateFile, 'utf8');
      const saved = JSON.parse(raw);
      const state = { ...defaultState, ...saved };

      // Validate that saved position is visible within at least one active display
      if (typeof state.x === 'number' && typeof state.y === 'number') {
        const displays = screen.getAllDisplays();
        const isVisible = displays.some((display) => {
          const { x, y, width, height } = display.workArea;
          return (
            state.x >= x - 20 &&
            state.y >= y - 20 &&
            state.x < x + width &&
            state.y < y + height
          );
        });

        if (!isVisible) {
          state.x = undefined;
          state.y = undefined;
        }
      }

      // Ensure minimum sensible bounds
      if (typeof state.width === 'number') {
        state.width = Math.max(state.width, 800);
      }
      if (typeof state.height === 'number') {
        state.height = Math.max(state.height, 560);
      }

      return state;
    }
  } catch (err) {
    console.warn('[Window State] Could not load previous window state, using defaults:', err.message);
  }

  return defaultState;
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const isMax = win.isMaximized();
    // In Electron, getNormalBounds() returns restored dimensions when maximized
    let bounds;
    if (isMax && typeof win.getNormalBounds === 'function') {
      bounds = win.getNormalBounds();
    } else {
      bounds = win.getBounds();
    }

    const stateToSave = {
      isMaximized: isMax,
      width: bounds.width || 1440,
      height: bounds.height || 900,
      x: bounds.x,
      y: bounds.y,
    };

    fs.writeFileSync(windowStateFile, JSON.stringify(stateToSave, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Window State] Failed to save window state:', err.message);
  }
}

function createWindow() {
  const windowState = loadWindowState();

  const windowOptions = {
    width: windowState.width || 1440,
    height: windowState.height || 900,
    minWidth: 800, // Sensible minimum allowing restored layout on 1024x768 and Surface scaled resolutions
    minHeight: 560,
    title: 'University of Lakki Marwat - Library Management System (Desktop)',
    backgroundColor: '#0B1120',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      spellcheck: false,
    },
    frame: true,
  };

  if (typeof windowState.x === 'number' && typeof windowState.y === 'number') {
    windowOptions.x = windowState.x;
    windowOptions.y = windowState.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    // Open maximized on startup so it uses available display area without exclusive fullscreen
    if (windowState.isMaximized !== false) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Track and broadcast maximize/restore events to renderer UI
  mainWindow.on('maximize', () => {
    saveWindowState(mainWindow);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximize-changed', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    saveWindowState(mainWindow);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximize-changed', false);
    }
  });

  mainWindow.on('resize', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on('move', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window controls IPC
ipcMain.on('window-action', (event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  if (action === 'close') mainWindow.close();
});

ipcMain.handle('window:is-maximized', async () => {
  return mainWindow ? mainWindow.isMaximized() : true;
});

// Native folder and file dialogs IPC
ipcMain.handle('dialog:open-directory', async () => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(mainWindow, {
    title: 'Choose Library Storage Directory',
    properties: ['openDirectory', 'createDirectory'],
  });
});

ipcMain.handle('dialog:open-file', async (event, filter) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(mainWindow, {
    title: 'Open Existing Library File (.ulmlib)',
    properties: ['openFile'],
    filters: filter || [
      { name: 'ULM Library Files', extensions: ['ulmlib', 'db', 'sqlite'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
});

ipcMain.handle('shell:open-path', async (event, dirPath) => {
  return shell.openPath(dirPath);
});

// Native File System IPC
ipcMain.handle('fs:read-file', async (event, filePath) => {
  return fs.promises.readFile(filePath);
});

ipcMain.handle('fs:write-file', async (event, filePath, data) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, Buffer.from(data));
  return { success: true };
});

ipcMain.handle('fs:stat-file', async (event, filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    return { exists: true, size: stat.size, mtime: stat.mtime.toISOString() };
  } catch {
    return { exists: false, size: 0, mtime: null };
  }
});

// Single-Instance File Lock IPC
ipcMain.handle('fs:check-lock', async (event, filePath) => {
  const lockPath = `${filePath}.lock`;
  try {
    const raw = await fs.promises.readFile(lockPath, 'utf8');
    const lockInfo = JSON.parse(raw);
    return { locked: true, lockInfo };
  } catch {
    return { locked: false };
  }
});

ipcMain.handle('fs:acquire-lock', async (event, filePath) => {
  const lockPath = `${filePath}.lock`;
  const lockData = JSON.stringify({
    pid: process.pid,
    hostname: os.hostname(),
    platform: process.platform,
    time: new Date().toISOString(),
  });
  await fs.promises.writeFile(lockPath, lockData, 'utf8');
  return { success: true };
});

ipcMain.handle('fs:release-lock', async (event, filePath) => {
  const lockPath = `${filePath}.lock`;
  try {
    await fs.promises.unlink(lockPath);
  } catch {}
  return { success: true };
});

ipcMain.handle('app:get-data-path', async () => {
  return path.join(app.getPath('userData'), 'ulm_lms_config.json');
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
