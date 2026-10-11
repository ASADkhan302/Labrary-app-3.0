const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
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
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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
