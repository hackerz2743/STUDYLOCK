const { app, BrowserWindow, ipcMain, globalShortcut, screen, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Hardware acceleration & performance switches for 120+ FPS rendering
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Standard modern User-Agents: Edge for normal navigation & Firefox for Google/Supabase Auth Bypass
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';
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

// Helper function to inject session data into persistent partition
async function injectSessionToPartition(sessionData) {
  try {
    const tempWin = new BrowserWindow({
      show: false,
      width: 400,
      height: 300,
      webPreferences: {
        partition: 'persist:studylock_session',
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await tempWin.loadURL('https://app.raysensei.com/');

    const serializedData = typeof sessionData === 'string' ? sessionData : JSON.stringify(sessionData);

    await tempWin.webContents.executeJavaScript(`
      try {
        const raw = ${JSON.stringify(serializedData)};
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        for (const [key, val] of Object.entries(parsed)) {
          localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
        }
      } catch (e) {
        console.error('Storage injection failed:', e);
      }
    `);

    setTimeout(() => {
      try {
        if (!tempWin.isDestroyed()) tempWin.destroy();
      } catch (e) {}
    }, 1200);

    return { success: true };
  } catch (err) {
    console.error('Failed to inject RaySensei session:', err);
    return { success: false, error: err.message };
  }
}

// 1. Direct 1-Click RaySensei Login Window (With Google Auth Bypass & Auto-Detect)
let activeLoginWin = null;
ipcMain.handle('open-raysensei-login', async () => {
  if (isLockedIn) return { success: false, error: 'Locked in' };

  if (activeLoginWin && !activeLoginWin.isDestroyed()) {
    activeLoginWin.focus();
    return { success: true, alreadyOpen: true };
  }

  activeLoginWin = new BrowserWindow({
    width: 980,
    height: 720,
    center: true,
    autoHideMenuBar: true,
    title: 'StudyLock - Connect RaySensei Account',
    backgroundColor: '#070a10',
    webPreferences: {
      partition: 'persist:studylock_session',
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  activeLoginWin.webContents.setUserAgent(BROWSER_UA);
  activeLoginWin.loadURL('https://app.raysensei.com/', { userAgent: BROWSER_UA });

  // Periodically check if Supabase login token is present
  const checkAuthInterval = setInterval(async () => {
    try {
      if (!activeLoginWin || activeLoginWin.isDestroyed()) {
        clearInterval(checkAuthInterval);
        return;
      }
      const token = await activeLoginWin.webContents.executeJavaScript(`
        (() => {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith('sb-') && k.endsWith('-auth-token'))) {
                return { key: k, value: localStorage.getItem(k) };
              }
            }
          } catch(e) {}
          return null;
        })()
      `);

      if (token && token.value) {
        clearInterval(checkAuthInterval);
        console.log('RaySensei login detected successfully in login window!');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('raysensei-auth-success', { sessionKey: token.key });
        }
        setTimeout(() => {
          try {
            if (activeLoginWin && !activeLoginWin.isDestroyed()) activeLoginWin.close();
          } catch (e) {}
        }, 1200);
      }
    } catch (e) {}
  }, 1000);

  activeLoginWin.on('closed', () => {
    clearInterval(checkAuthInterval);
    activeLoginWin = null;
  });

  return { success: true };
});

// 2. Method 1: System Browser Handshake via Local Loopback Server
let authLoopbackServer = null;
ipcMain.handle('start-raysensei-browser-auth', async () => {
  if (authLoopbackServer) {
    try { authLoopbackServer.close(); } catch (e) {}
    authLoopbackServer = null;
  }

  const port = 48123;
  authLoopbackServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/bridge' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>StudyLock - RaySensei Sync Bridge</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #070a10; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
    .card { background: #0d121d; border: 1px solid #1e293b; border-radius: 16px; padding: 36px; max-width: 540px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; }
    .icon { font-size: 48px; margin-bottom: 12px; }
    h1 { margin: 0 0 10px 0; font-size: 24px; color: #ffffff; letter-spacing: -0.02em; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
    .step-box { background: #131b2e; border: 1px solid #25334d; border-radius: 12px; padding: 18px; margin-bottom: 16px; text-align: left; }
    .step-title { font-size: 14px; font-weight: 700; color: #60a5fa; margin-bottom: 6px; }
    .step-desc { font-size: 13px; color: #94a3b8; margin-bottom: 12px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none; cursor: pointer; border: none; transition: background 0.2s; }
    .btn:hover { background: #1d4ed8; }
    .bookmark-pill { display: inline-block; background: #059669; color: #fff; padding: 9px 18px; border-radius: 20px; font-weight: 600; font-size: 14px; cursor: move; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
    .bookmark-pill:hover { background: #047857; }
    .footer-note { font-size: 12px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡</div>
    <h1>StudyLock Sync Bridge</h1>
    <p>Sync your active RaySensei login session directly into StudyLock without typing any code.</p>

    <div class="step-box">
      <div class="step-title">STEP 1: Log in to RaySensei</div>
      <div class="step-desc">Open RaySensei in this browser and make sure your Google account is signed in:</div>
      <a href="https://app.raysensei.com" target="_blank" class="btn">Open app.raysensei.com ↗</a>
    </div>

    <div class="step-box">
      <div class="step-title">STEP 2: 1-Click Sync Bookmark</div>
      <div class="step-desc">Drag this green button to your browser's <strong>Bookmarks Bar</strong>:</div>
      <div style="text-align: center; margin: 12px 0;">
        <a class="bookmark-pill" href="javascript:(function(){const d={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);d[k]=localStorage.getItem(k);};fetch('http://127.0.0.1:48123/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json()).then(res=>{if(res.success){alert('✓ RaySensei session synced to StudyLock successfully! You can close this tab.');window.close();}else{alert('Sync failed: '+res.error);}}).catch(err=>alert('Could not connect to StudyLock. Make sure StudyLock is open!'));})();">⚡ Sync to StudyLock</a>
      </div>
      <div class="step-desc">Then on your <strong>app.raysensei.com</strong> tab, simply click <strong>⚡ Sync to StudyLock</strong> on your bookmarks bar!</div>
    </div>

    <div class="footer-note">🔒 Your login credentials are sent only to your own computer (127.0.0.1) and never leave your PC.</div>
  </div>
</body>
</html>`);
      return;
    }

    if (req.url === '/sync' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const sessionData = JSON.parse(body);
          await injectSessionToPartition(sessionData);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('raysensei-auth-success', { sessionKey: 'browser-bridge' });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));

          setTimeout(() => {
            if (authLoopbackServer) {
              try { authLoopbackServer.close(); } catch (e) {}
              authLoopbackServer = null;
            }
          }, 4000);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  authLoopbackServer.listen(port, '127.0.0.1', () => {
    console.log(`StudyLock Auth Server listening on http://127.0.0.1:${port}`);
    shell.openExternal(`http://127.0.0.1:${port}/bridge`);
  });

  return { success: true, port };
});

// 3. Inject RaySensei Session Directly
ipcMain.handle('inject-raysensei-session', async (event, sessionData) => {
  return injectSessionToPartition(sessionData);
});

// 4. Check if RaySensei is already logged in
ipcMain.handle('check-raysensei-auth-status', async () => {
  try {
    const tempWin = new BrowserWindow({
      show: false,
      width: 400,
      height: 300,
      webPreferences: {
        partition: 'persist:studylock_session',
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await tempWin.loadURL('https://app.raysensei.com/');
    const isLoggedIn = await tempWin.webContents.executeJavaScript(`
      (() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('sb-') && k.endsWith('-auth-token'))) {
              return true;
            }
          }
        } catch(e) {}
        return false;
      })()
    `);

    setTimeout(() => {
      try { if (!tempWin.isDestroyed()) tempWin.destroy(); } catch (e) {}
    }, 500);

    return { isLoggedIn: !!isLoggedIn };
  } catch (err) {
    return { isLoggedIn: false };
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
    // Configure default and unified persistent session with pristine Edge User-Agent and Google bypass
    const unifiedSession = session.fromPartition('persist:studylock_session');
    [session.defaultSession, unifiedSession].forEach(ses => {
      ses.setUserAgent(BROWSER_UA);
      ses.webRequest.onBeforeSendHeaders(
        (details, callback) => {
          const url = details.url.toLowerCase();
          // Google & Supabase Auth: strip Client Hint headers & use Firefox UA to bypass "browser not secure" check
          if (url.includes('google.com') || url.includes('googleusercontent.com') || url.includes('gstatic.com') || url.includes('supabase.co')) {
            delete details.requestHeaders['sec-ch-ua'];
            delete details.requestHeaders['sec-ch-ua-mobile'];
            delete details.requestHeaders['sec-ch-ua-platform'];
            delete details.requestHeaders['sec-ch-ua-model'];
            delete details.requestHeaders['sec-ch-ua-platform-version'];
            details.requestHeaders['User-Agent'] = FIREFOX_UA;
          } else {
            details.requestHeaders['User-Agent'] = BROWSER_UA;
          }
          if (details.url.includes('youtube-nocookie.com') || details.url.includes('youtube.com/embed')) {
            details.requestHeaders['Referer'] = 'https://www.youtube.com/';
          }
          callback({ cancel: false, requestHeaders: details.requestHeaders });
        }
      );
    });

    createWindow();

    // Intercept keyboard inputs & handle OAuth popups across all webcontents (including guest <webview> instances)
    app.on('web-contents-created', (event, contents) => {
      contents.setUserAgent(BROWSER_UA);

      // Dynamically switch user-agent during Google / Supabase auth navigation
      contents.on('will-navigate', (e, navUrl) => {
        const u = (navUrl || '').toLowerCase();
        if (u.includes('google.com') || u.includes('supabase.co')) {
          contents.setUserAgent(FIREFOX_UA);
        } else {
          contents.setUserAgent(BROWSER_UA);
        }
      });

      // Seamlessly allow Google OAuth and RaySensei child popups while preserving session cookies
      contents.setWindowOpenHandler((details) => {
        const urlStr = (details.url || '').toLowerCase();
        const isAuthPopup = urlStr.includes('google.com') ||
                            urlStr.includes('accounts.google') ||
                            urlStr.includes('raysensei.com') ||
                            urlStr.includes('firebaseapp.com') ||
                            urlStr.includes('supabase.co') ||
                            urlStr.includes('auth0.com') ||
                            urlStr.includes('clerk.dev');
        if (isAuthPopup) {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              width: 520,
              height: 680,
              center: true,
              autoHideMenuBar: true,
              alwaysOnTop: isLockedIn,
              webPreferences: {
                partition: 'persist:studylock_session',
                nodeIntegration: false,
                contextIsolation: true
              }
            }
          };
        }
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

        // Intercept Backtick (` / ~) regardless of which webview is active
        if (input.type === 'keyDown' && (input.key === '`' || input.key === '~' || input.code === 'Backquote')) {
          if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('toggle-parent-proof-global');
          }
        }
        // Intercept Ctrl+1..2 for fast dual deck switching
        if (input.type === 'keyDown' && input.control && !input.alt && !input.shift) {
          if (['1', '2', '3', '4', '5'].includes(input.key)) {
            const targetIndex = parseInt(input.key, 10) - 1;
            if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('switch-workspace-global', targetIndex);
            }
          }
        }

        // Intercept Alt+ArrowRight / Alt+ArrowLeft for fast dual-deck flipping
        if (input.type === 'keyDown' && input.alt && !input.control && !input.shift) {
          if (input.key === 'ArrowRight') {
            if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('switch-workspace-global', 1);
            }
          } else if (input.key === 'ArrowLeft') {
            if (isLockedIn && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('switch-workspace-global', 0);
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
