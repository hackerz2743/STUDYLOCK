const { app, BrowserWindow, ipcMain, globalShortcut, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Hardware acceleration & performance switches for 120+ FPS rendering
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Standard modern Chrome User-Agent
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_UA;

let mainWindow = null;
let isLockedIn = false;
let activeSessionData = null;

// Path to study_data.json in userData
const dataDir = app.getPath('userData');
const dataFilePath = path.join(dataDir, 'study_data.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
      console.error('Failed to create dataDir:', err);
    }
  }
  if (!fs.existsSync(dataFilePath)) {
    const initialData = {
      sessions: [],
      settings: {
        theme: 'obsidian',
        emergencyPassword: 'unlock123'
      }
    };
    try {
      fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to create initial study_data.json:', err);
    }
  }
}

function loadData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(dataFilePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse study_data.json, returning default:', err);
    return { sessions: [], settings: { theme: 'obsidian', emergencyPassword: 'unlock123' } };
  }
}

// Direct synchronous write on Windows prevents EPERM / file lock collisions
function saveData(data) {
  try {
    ensureDataFile();
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Save data error:', err);
  }
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1360, width),
    height: Math.min(880, height),
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#070a10',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true // Enables isolated <webview> tag for pristine YouTube streaming
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Emergency Hardware Panic Chord: Ctrl + Alt + Shift + F12
  globalShortcut.register('CommandOrControl+Alt+Shift+F12', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('emergency-chord-triggered');
      disableLockIn();
    }
  });

  mainWindow.on('blur', () => {
    if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      }, 15);
    }
  });

  mainWindow.on('close', () => {
    // If a session is active on close, finalize and save immediately
    if (activeSessionData && activeSessionData.startTime) {
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - activeSessionData.startTime) / 1000));
      const currentData = loadData();
      const existingIdx = currentData.sessions.findIndex(s => s.id === activeSessionData.id);
      const record = {
        id: activeSessionData.id || ('session_' + Date.now()),
        subject: activeSessionData.subject || 'General Study',
        topic: activeSessionData.topic || 'Focus Session',
        mode: activeSessionData.mode || (activeSessionData.type === 'player' ? 'Lecture Player' : 'Desk Clock'),
        durationSeconds: elapsedSeconds,
        targetDurationMinutes: activeSessionData.targetMinutes || 0,
        completedAt: new Date().toISOString(),
        exitReason: 'app_closed'
      };

      if (existingIdx >= 0) {
        currentData.sessions[existingIdx] = record;
      } else {
        currentData.sessions.unshift(record);
      }

      saveData(currentData);
    }
  });
}

function enableLockIn() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isLockedIn = true;

  mainWindow.setFullScreen(true);
  mainWindow.setKiosk(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setSkipTaskbar(true);
  mainWindow.focus();

  // Block task-switching shortcuts & register session keys
  const blockedKeys = ['Alt+Tab', 'Alt+F4', 'Alt+Escape', 'CommandOrControl+Escape'];
  blockedKeys.forEach((shortcut) => {
    try {
      globalShortcut.register(shortcut, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
        }
      });
    } catch (e) {}
  });

  // Global Backtick interceptor at OS level when locked in
  try {
    globalShortcut.register('`', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toggle-parent-proof-global');
      }
    });
  } catch (e) {}
}

function disableLockIn() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isLockedIn = false;

  const blockedKeys = ['Alt+Tab', 'Alt+F4', 'Alt+Escape', 'CommandOrControl+Escape', '`'];
  blockedKeys.forEach((shortcut) => {
    try {
      globalShortcut.unregister(shortcut);
    } catch (e) {}
  });

  mainWindow.setAlwaysOnTop(false);
  mainWindow.setKiosk(false);
  mainWindow.setFullScreen(false);
  mainWindow.setSkipTaskbar(false);
  mainWindow.focus();
}

// IPC Handlers
ipcMain.handle('get-study-data', async () => {
  return loadData();
});

// Real-Time Persistent Session Saver
ipcMain.handle('save-study-session', async (event, session) => {
  const data = loadData();
  const existingIndex = data.sessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    data.sessions[existingIndex] = session;
  } else {
    data.sessions.unshift(session);
  }
  saveData(data);
  return { success: true, count: data.sessions.length };
});

ipcMain.handle('delete-session', async (event, sessionId) => {
  const data = loadData();
  data.sessions = data.sessions.filter(s => s.id !== sessionId);
  saveData(data);
  return { success: true };
});

ipcMain.handle('delete-sessions-older-than', async (event, days) => {
  const data = loadData();
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  data.sessions = data.sessions.filter(s => new Date(s.completedAt).getTime() >= cutoffTime);
  saveData(data);
  return { success: true, remaining: data.sessions.length };
});

ipcMain.handle('clear-all-sessions', async () => {
  const data = loadData();
  data.sessions = [];
  saveData(data);
  return { success: true };
});

ipcMain.handle('set-active-session', async (event, sessionInfo) => {
  activeSessionData = sessionInfo;
  return { success: true };
});

ipcMain.handle('clear-active-session', async () => {
  activeSessionData = null;
  return { success: true };
});

ipcMain.handle('set-lock-in', async (event, enabled) => {
  if (enabled) {
    enableLockIn();
  } else {
    disableLockIn();
  }
  return { isLockedIn };
});

ipcMain.handle('set-floating-widget-mode', async (event, enabled) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { isFloating: false };
  if (enabled) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(320, 100);
    mainWindow.setSize(360, 115);
    mainWindow.setPosition(width - 380, height - 135);
    mainWindow.setAlwaysOnTop(true, 'floating');
  } else {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(980, 680);
    mainWindow.setSize(Math.min(1360, width), Math.min(880, height));
    mainWindow.center();
  }
  return { isFloating: enabled };
});

// Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow && !isLockedIn) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow && !isLockedIn) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow && !isLockedIn) {
    mainWindow.close();
  }
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Attach valid Referer for youtube-nocookie embed requests to ensure error-free playback
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*.youtube-nocookie.com/*', '*://*.youtube.com/embed/*'] },
      (details, callback) => {
        details.requestHeaders['Referer'] = 'https://www.youtube.com/';
        details.requestHeaders['User-Agent'] = CHROME_UA;
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      }
    );

    createWindow();

    // Intercept keyboard inputs across all webcontents (including guest <webview> instances)
    app.on('web-contents-created', (event, contents) => {
      contents.on('before-input-event', (inputEvent, input) => {
        // Intercept Backtick (` / ~) regardless of which webview is active
        if (input.type === 'keyDown' && (input.key === '`' || input.key === '~' || input.code === 'Backquote')) {
          if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('toggle-parent-proof-global');
          }
        }
        // Intercept Ctrl+1..5 for fast workspace tab switching
        if (input.type === 'keyDown' && input.control && !input.alt && !input.shift) {
          if (['1', '2', '3', '4', '5'].includes(input.key)) {
            const targetIndex = parseInt(input.key, 10) - 1;
            if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('switch-workspace-global', targetIndex);
            }
          }
        }
      });
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
