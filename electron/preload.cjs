const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  sendWindowAction: (action) => ipcRenderer.send('window-action', action),
  platform: process.platform,
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:open-directory'),
  openFileDialog: (filter) => ipcRenderer.invoke('dialog:open-file', filter),
  openPathInExplorer: (dirPath) => ipcRenderer.invoke('shell:open-path', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:write-file', filePath, data),
  statFile: (filePath) => ipcRenderer.invoke('fs:stat-file', filePath),
  checkLock: (filePath) => ipcRenderer.invoke('fs:check-lock', filePath),
  acquireLock: (filePath) => ipcRenderer.invoke('fs:acquire-lock', filePath),
  releaseLock: (filePath) => ipcRenderer.invoke('fs:release-lock', filePath),
  getAppDataConfigPath: () => ipcRenderer.invoke('app:get-data-path'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximizeChange: (callback) => {
    const handler = (event, isMax) => callback(isMax);
    ipcRenderer.on('window-maximize-changed', handler);
    return () => ipcRenderer.removeListener('window-maximize-changed', handler);
  },
});
