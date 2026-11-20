const { app, BrowserWindow, ipcMain, globalShortcut, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');
const squadService = require('./squadService');

// Hardware acceleration & performance switches for 120+ FPS rendering
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Standard modern User-Agent for seamless YouTube streaming & browser rendering
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
app.userAgentFallback = BROWSER_UA;

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
      tasks: [],
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
    const parsed = JSON.parse(raw);
    if (!parsed.tasks) parsed.tasks = [];
    return parsed;
  } catch (err) {
    console.error('Failed to parse study_data.json, returning default:', err);
    return { sessions: [], tasks: [], settings: { theme: 'obsidian', emergencyPassword: 'unlock123' } };
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
    squadService.initSquadService(mainWindow);
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
    // Notify squad service of app close to clear active presence
    squadService.handleAppClose();

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
        exitReason: 'app_closed',
        youtubeUrl: activeSessionData.youtubeUrl || '',
        videoId: activeSessionData.videoId || ''
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

// Daily Target Tasks
ipcMain.handle('get-study-tasks', async () => {
  const data = loadData();
  return data.tasks || [];
});

ipcMain.handle('save-study-tasks', async (event, tasks) => {
  const data = loadData();
  data.tasks = tasks;
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

// ========================================================
// STUDY SQUAD (Multiplayer Realtime Cloud Presence)
// ========================================================
ipcMain.handle('squad-signup', async (event, payload) => {
  try {
    return await squadService.squadSignup(payload);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('squad-login', async (event, payload) => {
  try {
    return await squadService.squadLogin(payload);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('squad-logout', async () => {
  try {
    return await squadService.squadLogout();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('squad-get-profile', async () => {
  try {
    return await squadService.squadGetProfile();
  } catch (err) {
    return null;
  }
});

ipcMain.handle('squad-update-status', async (event, status) => {
  try {
    return await squadService.squadUpdateStatus(status);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('squad-add-friend', async (event, username) => {
  try {
    return await squadService.squadAddFriend(username);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('squad-remove-friend', async (event, friendId) => {
  try {
    return await squadService.squadRemoveFriend(friendId);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('squad-get-friends', async () => {
  try {
    return await squadService.squadGetFriends();
  } catch (err) {
    return [];
  }
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
    // Configure default and unified persistent session for pristine YouTube streaming
    const unifiedSession = session.fromPartition('persist:studylock_session');
    [session.defaultSession, unifiedSession].forEach(ses => {
      ses.setUserAgent(BROWSER_UA);
      ses.webRequest.onBeforeSendHeaders(
        (details, callback) => {
          details.requestHeaders['User-Agent'] = BROWSER_UA;
          if (details.url.includes('youtube-nocookie.com') || details.url.includes('youtube.com/embed')) {
            details.requestHeaders['Referer'] = 'https://www.youtube.com/';
          }
          callback({ cancel: false, requestHeaders: details.requestHeaders });
        }
      );
    });

    createWindow();

    // Intercept keyboard inputs across all webcontents (including guest <webview> instances)
    app.on('web-contents-created', (event, contents) => {
      contents.setUserAgent(BROWSER_UA);

      // Block unauthorized popups to ensure complete focus
      contents.setWindowOpenHandler(() => {
        return { action: 'deny' };
      });

      contents.on('before-input-event', (inputEvent, input) => {
        // Fast Refresh (Ctrl+R / F5) when not locked in
        if (input.type === 'keyDown' && ((input.control && (input.key === 'r' || input.key === 'R')) || input.key === 'F5')) {
          if (!isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
            inputEvent.preventDefault();
            mainWindow.reload();
            return;
          }
        }

        // Toggle DevTools (Ctrl+Shift+I / F12) when not locked in
        if (input.type === 'keyDown' && ((input.control && input.shift && (input.key === 'i' || input.key === 'I')) || input.key === 'F12')) {
          if (!isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
            inputEvent.preventDefault();
            mainWindow.webContents.toggleDevTools();
            return;
          }
        }

        // Intercept Backtick (` / ~) regardless of whether webview is focused
        if (input.type === 'keyDown' && (input.key === '`' || input.key === '~' || input.code === 'Backquote')) {
          if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('toggle-parent-proof-global');
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
