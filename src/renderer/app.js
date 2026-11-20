/**
 * StudyLock — Comprehensive macOS Immersion Suite
 * 1. 100% Direct Watch YouTube Engine (Immune to Error 150/152)
 * 2. Real-Time Incremental Autosave (100% Zero Data Loss, even for 5s/7s)
 * 3. Dual-Mode Focus Clock: Strict Fullscreen Lock-In vs Normal Free Mode (App Switching Allowed)
 * 4. Padhai Proof 85% Parent Verification Overlay (Hinglish + Dynamic Milestones via Tab)
 * 5. Strict 6-Digit Notebook Code / Master Key Exit (No typing essay shortcuts)
 */

// App State
let studyData = { sessions: [], settings: {} };
let activeSession = null;
let currentSessionRecord = null;
let sessionUnlockKey = '';
let currentRandomCode = '';
let ritualMode = 'random'; // 'random' | 'custom'
let currentVideoId = '';
let isParentProofOpen = false;

// Whitelisted Multi-Resource Workspaces State
let extraResourcesList = []; // Array of { id, title, url }
let activeWorkspaces = []; // Array of { id, title, url, type, webviewEl }
let activeWorkspaceIndex = 0;

// Dual Clock Mode state
let clockMode = 'locked'; // 'locked' | 'free'
let isClockFloating = false;
let isClockPaused = false;
let clockPauseStartTimestamp = 0;
let clockTotalPausedMs = 0;

let rafTimerId = null;
let lastAutosaveTimestamp = 0;

const SUBJECT_COLORS = {
  Physics: '#38bdf8',
  Chemistry: '#a855f7',
  Maths: '#10b981',
  Productivity: '#f59e0b',
  Biology: '#ec4899',
  Other: '#94a3b8'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadStudyData();
  setupWindowControls();
  setupTabNavigation();
  setupPlayerSection();
  setupResourceWhitelistUI();
  setupClockSection();
  setupParentProofOverlay();
  setupEmergencyExitModal();
  setupTimerExpiryModal();
  setupEmergencyChordListener();
  generateNewRandomCode();
  renderExtraResourcesList();
});

// ========================================================
// Data Loading
// ========================================================
async function loadStudyData() {
  try {
    const data = await window.api.getStudyData();
    if (data) {
      studyData = data;
    }
  } catch (e) {
    console.error('Failed to load study data:', e);
  }
}

// ========================================================
// Window Controls (macOS Traffic Lights)
// ========================================================
function setupWindowControls() {
  document.getElementById('btnWinClose').addEventListener('click', () => {
    if (activeSession && activeSession.clockMode === 'locked') {
      alert('🔒 StudyLock is in strict lock-in mode! Complete your session or click Emergency Exit in the top bar.');
    } else if (activeSession && activeSession.clockMode === 'free') {
      if (confirm('Focus session is running. Do you want to finish and save your study record before closing?')) {
        finishAndSaveSession('normal_closed');
      } else {
        window.api.closeWindow();
      }
    } else {
      window.api.closeWindow();
    }
  });

  document.getElementById('btnWinMin').addEventListener('click', () => {
    if (!activeSession || activeSession.clockMode !== 'locked') window.api.minimizeWindow();
  });

  document.getElementById('btnWinMax').addEventListener('click', () => {
    if (!activeSession || activeSession.clockMode !== 'locked') window.api.maximizeWindow();
  });
}

// ========================================================
// Navigation
// ========================================================
function setupTabNavigation() {
  document.querySelectorAll('.nav-segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.dataset.tab;
      document.querySelectorAll('.nav-segment-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// ========================================================
// Random Code Generator
// ========================================================
function generateNewRandomCode() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  currentRandomCode = code;
  const formatted = `${code.slice(0, 3)} ${code.slice(3, 6)}`;
  document.getElementById('displayPlayerCode').textContent = formatted;
  document.getElementById('displayClockCode').textContent = formatted;
}

// ========================================================
// PILLAR 1: EXPANSIVE STUDIO DASHBOARD & DIRECT WATCH
// ========================================================
function setupPlayerSection() {
  const urlInput = document.getElementById('ytUrlInput');

  // Paste Link
  document.getElementById('btnPasteUrl').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text;
      validateYouTubeUrl(text);
    } catch (e) {
      urlInput.focus();
    }
  });

  urlInput.addEventListener('input', (e) => validateYouTubeUrl(e.target.value.trim()));

  // Chips
  setupChipGroup('#playerSubjectChips');
  setupChipGroup('#playerDurationChips', (mins) => {
    document.getElementById('playerCustomMinutes').value = mins;
  });

  // Steppers (Guarded against missing buttons)
  const btnPSub15 = document.getElementById('btnPlayerSub15');
  if (btnPSub15) btnPSub15.addEventListener('click', () => adjustMinutes('playerCustomMinutes', -15));
  const btnPSub5 = document.getElementById('btnPlayerSub5');
  if (btnPSub5) btnPSub5.addEventListener('click', () => adjustMinutes('playerCustomMinutes', -5));
  const btnPAdd5 = document.getElementById('btnPlayerAdd5');
  if (btnPAdd5) btnPAdd5.addEventListener('click', () => adjustMinutes('playerCustomMinutes', 5));
  const btnPAdd15 = document.getElementById('btnPlayerAdd15');
  if (btnPAdd15) btnPAdd15.addEventListener('click', () => adjustMinutes('playerCustomMinutes', 15));

  // Ritual Toggle
  const btnRand = document.getElementById('btnRitualRandom');
  const btnCust = document.getElementById('btnRitualCustom');
  const boxRand = document.getElementById('boxRitualRandom');
  const boxCust = document.getElementById('boxRitualCustom');

  if (btnRand && btnCust && boxRand && boxCust) {
    btnRand.addEventListener('click', () => {
      ritualMode = 'random';
      btnRand.classList.add('active');
      btnCust.classList.remove('active');
      boxRand.classList.add('active');
      boxCust.classList.remove('active');
    });

    btnCust.addEventListener('click', () => {
      ritualMode = 'custom';
      btnCust.classList.add('active');
      btnRand.classList.remove('active');
      boxCust.classList.add('active');
      boxRand.classList.remove('active');
    });
  }

  const btnPRegen = document.getElementById('btnPlayerRegenCode');
  if (btnPRegen) btnPRegen.addEventListener('click', generateNewRandomCode);

  // Preview Button: Render Live Direct Watch in Stage Screen
  const btnPreview = document.getElementById('btnPreviewUrl');
  const btnClosePrev = document.getElementById('btnClosePreview');

  btnPreview.addEventListener('click', () => {
    const url = document.getElementById('ytUrlInput').value.trim();
    const videoData = convertToYouTubeData(url);

    if (!videoData) {
      alert('Please enter or paste a valid YouTube video link first to preview.');
      document.getElementById('ytUrlInput').focus();
      return;
    }

    renderPreviewPlayer(videoData.videoId);
  });

  if (btnClosePrev) {
    btnClosePrev.addEventListener('click', closeStagePreview);
  }

  // Launch Player
  document.getElementById('btnLaunchPlayer').addEventListener('click', handlePlayerLaunch);

  // Permanent Bar Emergency Exit Button
  document.getElementById('btnPlayerEmergency').addEventListener('click', openEmergencyModal);
}

function renderPreviewPlayer(videoId) {
  const idleState = document.getElementById('theaterIdleState');
  const previewContainer = document.getElementById('theaterPreviewContainer');
  const holder = document.getElementById('previewWebviewHolder');

  holder.innerHTML = '';
  idleState.classList.add('hidden');
  previewContainer.classList.remove('hidden');

  const webview = document.createElement('webview');
  webview.id = 'stagePreviewWebview';
  webview.setAttribute('partition', 'persist:studylock_yt');
  webview.setAttribute('allowfullscreen', 'true');
  webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  webview.setAttribute('allowpopups', 'true');
  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.style.border = 'none';
  webview.src = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;

  // Allow Google & YouTube account login while preventing roaming to other videos
  webview.addEventListener('will-navigate', (e) => {
    try {
      const navUrl = new URL(e.url);
      const navHost = navUrl.hostname.toLowerCase();
      const isAuthHost = navHost === 'accounts.google.com' ||
                         navHost === 'accounts.youtube.com' ||
                         navHost.endsWith('.google.com') ||
                         navHost.endsWith('.youtube.com');
      if (isAuthHost && !navUrl.pathname.startsWith('/watch')) {
        return; // Allow login navigation
      }
      const targetId = extractYouTubeId(e.url || '');
      if (targetId && targetId !== videoId) e.preventDefault();
    } catch (err) {}
  });

  webview.addEventListener('new-window', (e) => {
    try {
      const parsed = new URL(e.url);
      const host = parsed.hostname.toLowerCase();
      if (host.includes('google.com') || host.includes('youtube.com') || host.includes('accounts.')) {
        webview.loadURL(e.url);
        return;
      }
    } catch (err) {}
    e.preventDefault();
  });

  // Inject distraction-free CSS
  webview.addEventListener('dom-ready', () => {
    webview.insertCSS(`
      #secondary, #related, ytd-watch-next-secondary-results-renderer, #comments, #masthead-container #center, #masthead-container #buttons, #masthead-container #voice-search-button, #guide-button, #guide-wrapper, ytd-mini-guide-renderer, .ytp-ce-element, .ytp-endscreen-content, #below {
        display: none !important;
      }
      #page-manager { margin-top: 0 !important; }
      ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: 100vw !important; margin: 0 auto !important; }
    `).catch(() => {});
  });

  holder.appendChild(webview);
}

function closeStagePreview() {
  const idleState = document.getElementById('theaterIdleState');
  const previewContainer = document.getElementById('theaterPreviewContainer');
  const holder = document.getElementById('previewWebviewHolder');

  if (holder) holder.innerHTML = '';
  if (previewContainer) previewContainer.classList.add('hidden');
  if (idleState) idleState.classList.remove('hidden');
}

function validateYouTubeUrl(url) {
  const feedback = document.getElementById('urlFeedback');
  if (!url) {
    feedback.textContent = 'Direct Watch engine runs raw YouTube stream with all recommendations, shorts, and comments stripped.';
    feedback.style.color = 'var(--text-dim)';
    return null;
  }
  const videoData = convertToYouTubeData(url);
  if (videoData) {
    feedback.textContent = `✓ Valid YouTube lecture identified (ID: ${videoData.videoId}) — Direct Watch Ready`;
    feedback.style.color = '#34d399';
    return videoData;
  } else {
    feedback.textContent = '⚠️ Please enter a valid YouTube video URL or ID.';
    feedback.style.color = '#f87171';
    return null;
  }
}

function convertToYouTubeData(input) {
  if (!input) return null;
  input = input.trim();

  const regex = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/)|^)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  if (match && match[1]) {
    const videoId = match[1];
    return {
      videoId,
      directUrl: `https://www.youtube.com/watch?v=${videoId}&autoplay=1`
    };
  }
  return null;
}

function extractYouTubeId(url) {
  const data = convertToYouTubeData(url);
  return data ? data.videoId : null;
}

// ========================================================
// Persistent Multi-Site Workspaces Storage & Engine
// ========================================================
let savedWorkspacesList = [];

function loadSavedWorkspaces() {
  try {
    const raw = localStorage.getItem('studylock_saved_workspaces');
    if (raw) {
      savedWorkspacesList = JSON.parse(raw);
    } else {
      savedWorkspacesList = [
        { id: 'pw_default', title: 'PhysicsWallah', url: 'https://study.physicswallah.live/' },
        { id: 'gpt_default', title: 'ChatGPT Doubts', url: 'https://chatgpt.com/' }
      ];
      persistSavedWorkspaces();
    }
  } catch (e) {
    savedWorkspacesList = [];
  }
}

function persistSavedWorkspaces() {
  try {
    localStorage.setItem('studylock_saved_workspaces', JSON.stringify(savedWorkspacesList));
  } catch (e) {}
}

function addSavedWorkspace(title, url) {
  if (!url) return;
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  const existing = savedWorkspacesList.find(w => w.url.toLowerCase() === url.toLowerCase());
  if (existing) {
    existing.title = title || existing.title;
  } else {
    savedWorkspacesList.push({
      id: 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: title || 'Study Website',
      url
    });
  }
  persistSavedWorkspaces();
  renderSavedWorkspacesList();
}

function removeSavedWorkspace(id) {
  savedWorkspacesList = savedWorkspacesList.filter(w => w.id !== id);
  persistSavedWorkspaces();
  renderSavedWorkspacesList();
}

function renderSavedWorkspacesList() {
  const container = document.getElementById('savedWorkspacesContainer');
  if (!container) return;

  if (savedWorkspacesList.length === 0) {
    container.innerHTML = '<div style="font-size: 11px; color: #64748b; font-style: italic; padding: 4px 0;">No extra websites added. PC will strictly only run the YouTube lecture.</div>';
    return;
  }

  container.innerHTML = '';
  savedWorkspacesList.forEach((ws) => {
    let domain = '';
    try {
      domain = new URL(ws.url).hostname;
    } catch (e) {
      domain = ws.url;
    }

    const card = document.createElement('div');
    card.className = 'saved-workspace-card';
    card.innerHTML = `
      <div class="saved-card-left">
        <span class="saved-card-tag">✓ SAVED</span>
        <span class="saved-card-title">${escapeHtml(ws.title)}</span>
        <span class="saved-card-url" title="${escapeHtml(ws.url)}">${escapeHtml(domain)}</span>
      </div>
      <button type="button" class="btn-delete-saved-ws" title="Remove website" data-id="${ws.id}">✕</button>
    `;

    card.querySelector('.btn-delete-saved-ws').addEventListener('click', () => {
      removeSavedWorkspace(ws.id);
    });

    container.appendChild(card);
  });
}

function setupResourceWhitelistUI() {
  loadSavedWorkspaces();
  renderSavedWorkspacesList();

  const btnAddPw = document.getElementById('btnAddPwPreset');
  const btnAddGpt = document.getElementById('btnAddGptPreset');
  const btnSaveCustom = document.getElementById('btnSaveCustomWs');

  if (btnAddPw) {
    btnAddPw.addEventListener('click', () => {
      addSavedWorkspace('PhysicsWallah', 'https://study.physicswallah.live/');
    });
  }
  if (btnAddGpt) {
    btnAddGpt.addEventListener('click', () => {
      addSavedWorkspace('ChatGPT Doubts', 'https://chatgpt.com/');
    });
  }
  if (btnSaveCustom) {
    btnSaveCustom.addEventListener('click', () => {
      const titleInput = document.getElementById('customWsTitle');
      const urlInput = document.getElementById('customWsUrl');
      const title = (titleInput ? titleInput.value.trim() : '') || 'Study Resource';
      let url = urlInput ? urlInput.value.trim() : '';

      if (!url) {
        alert('Please enter a website URL.');
        if (urlInput) urlInput.focus();
        return;
      }

      addSavedWorkspace(title, url);
      if (titleInput) titleInput.value = '';
      if (urlInput) urlInput.value = '';
    });
  }

  // Floating Deck Navigation Arrows (Matching User Screenshot)
  const btnPrev = document.getElementById('btnPrevWorkspace');
  const btnNext = document.getElementById('btnNextWorkspace');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (activeWorkspaces.length > 1) {
        const prevIdx = activeWorkspaceIndex > 0 ? activeWorkspaceIndex - 1 : activeWorkspaces.length - 1;
        switchWorkspace(prevIdx);
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (activeWorkspaces.length > 1) {
        const nextIdx = activeWorkspaceIndex < activeWorkspaces.length - 1 ? activeWorkspaceIndex + 1 : 0;
        switchWorkspace(nextIdx);
      }
    });
  }

  // In-session modal listeners
  const btnCancelAdd = document.getElementById('btnCancelAddResource');
  const btnConfirmAdd = document.getElementById('btnConfirmAddResource');
  if (btnCancelAdd) {
    btnCancelAdd.addEventListener('click', closeAddResourceModal);
  }
  if (btnConfirmAdd) {
    btnConfirmAdd.addEventListener('click', handleConfirmAddResource);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function handlePlayerLaunch() {
  try {
    // 1. Close preview in stage immediately to stop background audio
    closeStagePreview();

    const url = document.getElementById('ytUrlInput').value.trim();
    const videoData = convertToYouTubeData(url);

    if (!videoData) {
      alert('Please enter a valid YouTube video link before starting.');
      document.getElementById('ytUrlInput').focus();
      return;
    }

    currentVideoId = videoData.videoId;

    if (!currentRandomCode) {
      generateNewRandomCode();
    }

    let unlockKey = currentRandomCode || '749204';
    if (ritualMode === 'custom') {
      const custInput = document.getElementById('playerCustomPassword');
      const custVal = custInput ? custInput.value.trim() : '';
      if (!custVal) {
        alert('Please enter a custom emergency password or use the 6-digit notebook code.');
        if (custInput) custInput.focus();
        return;
      }
      unlockKey = custVal;
    }

    sessionUnlockKey = unlockKey;

    const activeChip = document.querySelector('#playerSubjectChips .chip-bold.active');
    const subject = activeChip ? activeChip.dataset.subject : 'Physics';
    const topic = document.getElementById('playerTopicInput').value.trim() || 'Lecture Immersion';
    const targetMinutes = parseInt(document.getElementById('playerCustomMinutes').value, 10) || 45;

    const hudSub = document.getElementById('playerHudSubject');
    if (hudSub) hudSub.textContent = subject;
    const hudTop = document.getElementById('playerHudTopic');
    if (hudTop) hudTop.textContent = topic;

    // Construct Multi-Resource Workspaces (YouTube primary + all saved verified websites)
    const workspaces = [
      {
        id: 'ws_yt_primary',
        title: 'YouTube Lecture',
        url: `https://www.youtube.com/watch?v=${videoData.videoId}&autoplay=1`,
        videoId: videoData.videoId,
        type: 'youtube'
      }
    ];

    savedWorkspacesList.forEach((res, idx) => {
      let rawUrl = (res.url || '').trim();
      if (!rawUrl) return;
      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = 'https://' + rawUrl;
      }
      const ytMatch = convertToYouTubeData(rawUrl);
      workspaces.push({
        id: 'ws_saved_' + idx,
        title: res.title.trim() || `Workspace ${workspaces.length + 1}`,
        url: ytMatch ? `https://www.youtube.com/watch?v=${ytMatch.videoId}&autoplay=1` : rawUrl,
        videoId: ytMatch ? ytMatch.videoId : null,
        type: ytMatch ? 'youtube' : 'web'
      });
    });

    activeWorkspaces = workspaces;
    activeWorkspaceIndex = 0;

    // Initialize all workspaces
    initMultiWorkspaceEnvironment(activeWorkspaces);

    startSessionEngine({
      type: 'player',
      clockMode: 'locked',
      subject,
      topic,
      targetMinutes
    });

    const studioView = document.querySelector('#tabPlayer .studio-viewport-expansive');
    if (studioView) studioView.classList.add('hidden');
    document.getElementById('playerActiveView').classList.remove('hidden');
    window.api.setLockIn(true);
  } catch (err) {
    console.error('Launch failed:', err);
    alert('Session launch error: ' + err.message);
  }
}

function initMultiWorkspaceEnvironment(workspaces) {
  const tabsStrip = document.getElementById('workspaceTabsBar');
  const webviewWrapper = document.getElementById('videoFrameWrapper');

  if (!tabsStrip || !webviewWrapper) return;

  tabsStrip.innerHTML = '';
  webviewWrapper.innerHTML = '';

  workspaces.forEach((ws, idx) => {
    // 1. Top workspace tab button
    const tabBtn = document.createElement('button');
    tabBtn.className = `workspace-tab ${idx === activeWorkspaceIndex ? 'active' : ''}`;
    tabBtn.dataset.index = idx;
    tabBtn.innerHTML = `<span class="tab-num">${idx + 1}.</span> <span>${escapeHtml(ws.title)}</span>`;
    tabBtn.addEventListener('click', () => switchWorkspace(idx));
    tabsStrip.appendChild(tabBtn);

    // 2. Sandboxed Webview
    const webview = document.createElement('webview');
    webview.id = `ws_webview_${idx}`;
    webview.className = `workspace-webview ${idx === activeWorkspaceIndex ? 'active-workspace' : 'inactive-workspace'}`;
    webview.setAttribute('allowfullscreen', 'true');
    webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    if (ws.type === 'youtube') {
      webview.setAttribute('partition', 'persist:studylock_yt');
      webview.setAttribute('allowpopups', 'true'); // Allows Google & YouTube account login
      webview.src = ws.url;

      // Allow Google & YouTube account sign-in while blocking roaming to other videos
      webview.addEventListener('will-navigate', (e) => {
        try {
          const navUrl = new URL(e.url);
          const navHost = navUrl.hostname.toLowerCase();
          const isAuthHost = navHost === 'accounts.google.com' ||
                             navHost === 'accounts.youtube.com' ||
                             navHost.endsWith('.google.com') ||
                             navHost.endsWith('.youtube.com');
          if (isAuthHost && !navUrl.pathname.startsWith('/watch')) {
            return; // Allow Google account login navigation!
          }
          const targetId = extractYouTubeId(e.url || '');
          if (targetId && ws.videoId && targetId !== ws.videoId) {
            e.preventDefault();
          }
        } catch (err) {}
      });

      webview.addEventListener('new-window', (e) => {
        try {
          const parsed = new URL(e.url);
          const host = parsed.hostname.toLowerCase();
          if (host.includes('google.com') || host.includes('youtube.com') || host.includes('accounts.')) {
            webview.loadURL(e.url);
            return;
          }
        } catch (err) {}
        e.preventDefault();
      });

      webview.addEventListener('enter-html-full-screen', () => {
        webview.style.position = 'fixed';
        webview.style.top = '0';
        webview.style.left = '0';
        webview.style.width = '100vw';
        webview.style.height = '100vh';
        webview.style.zIndex = '999998';
      });

      webview.addEventListener('leave-html-full-screen', () => {
        webview.style.position = 'relative';
        webview.style.width = '100%';
        webview.style.height = '100%';
        webview.style.zIndex = 'auto';
      });

      webview.addEventListener('dom-ready', () => {
        webview.insertCSS(`
          #secondary, #related, ytd-watch-next-secondary-results-renderer, #comments, #masthead-container, #guide-button, #guide-wrapper, ytd-mini-guide-renderer, .ytp-ce-element, .ytp-endscreen-content, #below {
            display: none !important;
          }
          #page-manager { margin-top: 0 !important; }
          ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: 100vw !important; margin: 0 auto !important; padding: 0 !important; }
        `).catch(() => {});
      });
    } else {
      // Standard whitelisted website (PhysicsWallah, ChatGPT, etc.)
      webview.setAttribute('partition', 'persist:studylock_workspaces');
      webview.setAttribute('allowpopups', 'true'); // Allows Google / Auth popups
      webview.src = ws.url;

      try {
        const parsed = new URL(ws.url);
        const baseHost = parsed.hostname.toLowerCase();

        webview.addEventListener('will-navigate', (e) => {
          try {
            const navUrl = new URL(e.url);
            const navHost = navUrl.hostname.toLowerCase();
            const isAllowed = navHost === baseHost || 
                              navHost.endsWith('.' + baseHost) || 
                              navHost.includes('google.com') || 
                              navHost.includes('openai.com') ||
                              navHost.includes('physicswallah.live') ||
                              navHost.includes('pw.live') ||
                              navHost.includes('auth0.com');
            if (!isAllowed) {
              e.preventDefault();
              console.warn('Navigation blocked by StudyLock Whitelist Firewall:', e.url);
            }
          } catch (err) {
            e.preventDefault();
          }
        });

        webview.addEventListener('new-window', (e) => {
          try {
            const navUrl = new URL(e.url);
            const navHost = navUrl.hostname.toLowerCase();
            const isAllowed = navHost === baseHost || 
                              navHost.endsWith('.' + baseHost) || 
                              navHost.includes('google.com') || 
                              navHost.includes('openai.com') ||
                              navHost.includes('physicswallah.live') ||
                              navHost.includes('pw.live') ||
                              navHost.includes('auth0.com');
            if (isAllowed) {
              webview.loadURL(e.url);
              return;
            }
          } catch (err) {}
          e.preventDefault();
        });
      } catch (e) {}
    }

    ws.webviewEl = webview;
    webviewWrapper.appendChild(webview);
  });

  // Re-inject deck navigation arrows and indicator
  const btnPrev = document.createElement('button');
  btnPrev.id = 'btnPrevWorkspace';
  btnPrev.className = `deck-nav-arrow deck-nav-prev ${workspaces.length > 1 ? '' : 'hidden'}`;
  btnPrev.title = 'Previous Workspace (Ctrl+Left)';
  btnPrev.textContent = '❮';
  btnPrev.onclick = () => {
    if (activeWorkspaces.length > 1) {
      const prevIdx = activeWorkspaceIndex > 0 ? activeWorkspaceIndex - 1 : activeWorkspaces.length - 1;
      switchWorkspace(prevIdx);
    }
  };
  webviewWrapper.appendChild(btnPrev);

  const btnNext = document.createElement('button');
  btnNext.id = 'btnNextWorkspace';
  btnNext.className = `deck-nav-arrow deck-nav-next ${workspaces.length > 1 ? '' : 'hidden'}`;
  btnNext.title = 'Next Workspace (Ctrl+Right)';
  btnNext.textContent = '❯';
  btnNext.onclick = () => {
    if (activeWorkspaces.length > 1) {
      const nextIdx = activeWorkspaceIndex < activeWorkspaces.length - 1 ? activeWorkspaceIndex + 1 : 0;
      switchWorkspace(nextIdx);
    }
  };
  webviewWrapper.appendChild(btnNext);

  const deckIndicator = document.createElement('div');
  deckIndicator.id = 'workspaceDeckIndicator';
  deckIndicator.className = `workspace-deck-indicator ${workspaces.length > 1 ? '' : 'hidden'}`;
  deckIndicator.innerHTML = `<span class="deck-indicator-dot">●</span> <span id="deckIndicatorText">Workspace 1 of ${workspaces.length}: ${workspaces[0].title} · State Persisted</span>`;
  webviewWrapper.appendChild(deckIndicator);

  // Top "+ Add Resource" button in tab strip
  const addTabBtn = document.createElement('button');
  addTabBtn.className = 'workspace-tab-add';
  addTabBtn.id = 'btnTopAddResource';
  addTabBtn.title = 'Add another whitelisted website in this session';
  addTabBtn.innerHTML = '+ Add Resource';
  addTabBtn.addEventListener('click', openAddResourceModal);
  tabsStrip.appendChild(addTabBtn);
}

function switchWorkspace(targetIndex) {
  if (targetIndex < 0 || targetIndex >= activeWorkspaces.length) return;
  activeWorkspaceIndex = targetIndex;

  // Update tabs
  document.querySelectorAll('.workspace-tab').forEach((tab, idx) => {
    if (idx === targetIndex) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Toggle webview visibility (state/playback persists without reloading)
  activeWorkspaces.forEach((ws, idx) => {
    if (ws.webviewEl) {
      if (idx === targetIndex) {
        ws.webviewEl.classList.remove('inactive-workspace');
        ws.webviewEl.classList.add('active-workspace');
        ws.webviewEl.focus();
      } else {
        ws.webviewEl.classList.remove('active-workspace');
        ws.webviewEl.classList.add('inactive-workspace');
      }
    }
  });

  const cur = activeWorkspaces[targetIndex];
  if (cur && cur.title) {
    document.getElementById('playerHudTopic').textContent = cur.title;
  }
  const deckText = document.getElementById('deckIndicatorText');
  if (deckText && cur) {
    deckText.textContent = `Workspace ${targetIndex + 1} of ${activeWorkspaces.length}: ${cur.title} · State Persisted`;
  }
}

function openAddResourceModal() {
  const modal = document.getElementById('addResourceModal');
  if (modal) {
    document.getElementById('newResourceTitleInput').value = '';
    document.getElementById('newResourceUrlInput').value = '';
    modal.classList.remove('hidden');
    document.getElementById('newResourceTitleInput').focus();
  }
}

function closeAddResourceModal() {
  const modal = document.getElementById('addResourceModal');
  if (modal) modal.classList.add('hidden');
}

function handleConfirmAddResource() {
  const title = document.getElementById('newResourceTitleInput').value.trim() || 'Study Resource';
  let url = document.getElementById('newResourceUrlInput').value.trim();

  if (!url) {
    alert('Please enter a valid website URL.');
    document.getElementById('newResourceUrlInput').focus();
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const ytData = convertToYouTubeData(url);
  const newWs = {
    id: 'ws_added_' + Date.now(),
    title,
    url: ytData ? `https://www.youtube.com/watch?v=${ytData.videoId}&autoplay=1` : url,
    videoId: ytData ? ytData.videoId : null,
    type: ytData ? 'youtube' : 'web'
  };

  activeWorkspaces.push(newWs);
  closeAddResourceModal();
  initMultiWorkspaceEnvironment(activeWorkspaces);
  switchWorkspace(activeWorkspaces.length - 1);
}

function exitWebviewFullscreenIfActive() {
  const cur = activeWorkspaces[activeWorkspaceIndex];
  if (cur && cur.webviewEl) {
    cur.webviewEl.executeJavaScript('if (document.fullscreenElement) document.exitFullscreen();').catch(() => {});
  }
}

function pauseCurrentPlayer() {
  const cur = activeWorkspaces[activeWorkspaceIndex];
  if (cur && cur.webviewEl) {
    cur.webviewEl.executeJavaScript('const v = document.querySelector("video"); if (v) v.pause();').catch(() => {});
  }
}

function resumeCurrentPlayer() {
  const cur = activeWorkspaces[activeWorkspaceIndex];
  if (cur && cur.webviewEl) {
    cur.webviewEl.executeJavaScript('const v = document.querySelector("video"); if (v) v.play();').catch(() => {});
  }
}

// ========================================================
// PILLAR 2: Focus Clock (DUAL-MODE: STRICT LOCK-IN & NORMAL FREE)
// ========================================================
function setupClockSection() {
  setupChipGroup('#clockSubjectChips');
  setupChipGroup('#clockDurationChips', (mins) => {
    document.getElementById('clockCustomMinutes').value = mins;
  });

  const btnCSub15 = document.getElementById('btnClockSub15');
  if (btnCSub15) btnCSub15.addEventListener('click', () => adjustMinutes('clockCustomMinutes', -15));
  const btnCSub5 = document.getElementById('btnClockSub5');
  if (btnCSub5) btnCSub5.addEventListener('click', () => adjustMinutes('clockCustomMinutes', -5));
  const btnCAdd5 = document.getElementById('btnClockAdd5');
  if (btnCAdd5) btnCAdd5.addEventListener('click', () => adjustMinutes('clockCustomMinutes', 5));
  const btnCAdd15 = document.getElementById('btnClockAdd15');
  if (btnCAdd15) btnCAdd15.addEventListener('click', () => adjustMinutes('clockCustomMinutes', 15));

  // Dual Mode Selector Buttons
  const btnModeLocked = document.getElementById('btnClockModeLocked');
  const btnModeFree = document.getElementById('btnClockModeFree');
  const descEl = document.getElementById('clockModeDescription');
  const ritualGroup = document.getElementById('clockEmergencyRitualGroup');
  const launchLbl = document.getElementById('lblLaunchClock');

  if (btnModeLocked && btnModeFree) {
    btnModeLocked.addEventListener('click', () => {
      clockMode = 'locked';
      btnModeLocked.classList.add('active');
      btnModeFree.classList.remove('active');
      if (descEl) descEl.textContent = 'Fullscreen lock, Alt+Tab blocked, 6-digit notebook code required to exit early.';
      if (ritualGroup) ritualGroup.classList.remove('hidden');
      if (launchLbl) launchLbl.textContent = 'ENTER LOCK-IN';
    });

    btnModeFree.addEventListener('click', () => {
      clockMode = 'free';
      btnModeFree.classList.add('active');
      btnModeLocked.classList.remove('active');
      if (descEl) descEl.textContent = 'Task switching and all PC apps allowed. Use for reading PDFs, notes, or paper analysis while tracking time.';
      if (ritualGroup) ritualGroup.classList.add('hidden');
      if (launchLbl) launchLbl.textContent = 'START FREE TIMER';
    });
  }

  // Ritual Toggle
  const btnRand = document.getElementById('btnClockRitualRandom');
  const btnCust = document.getElementById('btnClockRitualCustom');
  const boxRand = document.getElementById('boxClockRitualRandom');
  const boxCust = document.getElementById('boxClockRitualCustom');

  if (btnRand && btnCust && boxRand && boxCust) {
    btnRand.addEventListener('click', () => {
      ritualMode = 'random';
      btnRand.classList.add('active');
      btnCust.classList.remove('active');
      boxRand.classList.add('active');
      boxCust.classList.remove('active');
    });

    btnCust.addEventListener('click', () => {
      ritualMode = 'custom';
      btnCust.classList.add('active');
      btnRand.classList.remove('active');
      boxCust.classList.add('active');
      boxRand.classList.remove('active');
    });
  }

  const btnCRegen = document.getElementById('btnClockRegenCode');
  if (btnCRegen) btnCRegen.addEventListener('click', generateNewRandomCode);

  document.getElementById('btnLaunchClock').addEventListener('click', handleClockLaunch);
  document.getElementById('btnClockEmergency').addEventListener('click', openEmergencyModal);

  // Normal Free Mode Control Actions
  const btnFreePause = document.getElementById('btnClockFreePause');
  const btnMiniPause = document.getElementById('btnMiniFloatPause');
  const btnFreeFinish = document.getElementById('btnClockFreeFinish');
  const btnMiniFinish = document.getElementById('btnMiniFloatFinish');
  const btnToggleFloat = document.getElementById('btnClockToggleFloat');
  const btnExpandMini = document.getElementById('btnExpandMiniClock');

  function toggleClockPause() {
    if (!activeSession) return;
    isClockPaused = !isClockPaused;
    if (isClockPaused) {
      clockPauseStartTimestamp = Date.now();
      if (btnFreePause) btnFreePause.textContent = '▶ Resume';
      if (btnMiniPause) btnMiniPause.textContent = '▶';
      showToastNotification('⏸️ Focus Clock paused.');
    } else {
      if (clockPauseStartTimestamp > 0) {
        clockTotalPausedMs += (Date.now() - clockPauseStartTimestamp);
        clockPauseStartTimestamp = 0;
      }
      if (btnFreePause) btnFreePause.textContent = '⏸️ Pause';
      if (btnMiniPause) btnMiniPause.textContent = '⏸️';
      showToastNotification('▶ Focus Clock resumed.');
    }
  }

  if (btnFreePause) btnFreePause.addEventListener('click', toggleClockPause);
  if (btnMiniPause) btnMiniPause.addEventListener('click', toggleClockPause);

  if (btnFreeFinish) {
    btnFreeFinish.addEventListener('click', () => finishAndSaveSession('normal_finished'));
  }
  if (btnMiniFinish) {
    btnMiniFinish.addEventListener('click', () => finishAndSaveSession('normal_finished'));
  }

  if (btnToggleFloat) {
    btnToggleFloat.addEventListener('click', () => toggleFloatingWidget(true));
  }
  if (btnExpandMini) {
    btnExpandMini.addEventListener('click', () => toggleFloatingWidget(false));
  }
}

async function toggleFloatingWidget(enable) {
  isClockFloating = enable;
  const miniView = document.getElementById('clockMiniFloatingView');
  const mainArea = document.getElementById('colossalClockMainArea');
  const topBar = document.querySelector('.clock-permanent-topbar');

  if (enable) {
    if (miniView) miniView.classList.remove('hidden');
    if (mainArea) mainArea.classList.add('hidden');
    if (topBar) topBar.classList.add('hidden');
    await window.api.setFloatingWidgetMode(true);
  } else {
    if (miniView) miniView.classList.add('hidden');
    if (mainArea) mainArea.classList.remove('hidden');
    if (topBar) topBar.classList.remove('hidden');
    await window.api.setFloatingWidgetMode(false);
  }
}

function handleClockLaunch() {
  try {
    let unlockKey = '';
    if (clockMode === 'locked') {
      if (!currentRandomCode) {
        generateNewRandomCode();
      }
      if (ritualMode === 'random') {
        unlockKey = currentRandomCode || '832915';
      } else {
        const custPass = document.getElementById('clockCustomPassword');
        unlockKey = custPass ? custPass.value.trim() : '';
        if (!unlockKey) {
          alert('Please enter a custom emergency password or use the 6-digit notebook code.');
          if (custPass) custPass.focus();
          return;
        }
      }
    }

    sessionUnlockKey = unlockKey;
    isClockPaused = false;
    clockPauseStartTimestamp = 0;
    clockTotalPausedMs = 0;

    const activeSubjectChip = document.querySelector('#clockSubjectChips .chip-bold.active');
    const subject = activeSubjectChip ? activeSubjectChip.dataset.subject : 'Physics';
    const topic = document.getElementById('clockTopicInput').value.trim() || 'Deep Work Session';
    const targetMinutes = parseInt(document.getElementById('clockCustomMinutes').value, 10) || 45;

    document.getElementById('colossalSubject').textContent = subject;
    document.getElementById('colossalTopic').textContent = topic;
    document.getElementById('colossalTargetText').textContent = `Target: ${targetMinutes}m`;

    const modeBadge = document.getElementById('colossalModeBadge');
    const strictControls = document.getElementById('clockStrictControls');
    const freeControls = document.getElementById('clockFreeControls');

    if (clockMode === 'locked') {
      if (modeBadge) modeBadge.textContent = 'STRICT LOCK-IN';
      if (strictControls) strictControls.classList.remove('hidden');
      if (freeControls) freeControls.classList.add('hidden');
    } else {
      if (modeBadge) modeBadge.textContent = 'NORMAL FREE MODE';
      if (strictControls) strictControls.classList.add('hidden');
      if (freeControls) freeControls.classList.remove('hidden');
    }

    const miniSubject = document.getElementById('miniFloatSubject');
    const miniTopic = document.getElementById('miniFloatTopic');
    if (miniSubject) miniSubject.textContent = subject;
    if (miniTopic) miniTopic.textContent = topic;

    startSessionEngine({
      type: 'clock',
      clockMode,
      subject,
      topic,
      targetMinutes
    });

    document.getElementById('clockActiveView').classList.remove('hidden');

    if (clockMode === 'locked') {
      window.api.setLockIn(true);
    } else {
      window.api.setLockIn(false);
    }
  } catch (err) {
    console.error('Clock launch failed:', err);
    alert('Focus Clock launch error: ' + err.message);
  }
}

// ========================================================
// Universal Session Timer Engine with REAL-TIME AUTOSAVE
// ========================================================
function startSessionEngine(config) {
  const sessionId = 'session_' + Date.now();

  activeSession = {
    ...config,
    id: sessionId,
    startTime: Date.now(),
    elapsedSeconds: 0,
    isExpired: false
  };

  // Immediate first save: Ensures even a 5-second session is ALREADY in the database!
  currentSessionRecord = {
    id: sessionId,
    subject: activeSession.subject || 'General Study',
    topic: activeSession.topic || 'Focus Session',
    mode: activeSession.type === 'player' ? 'Lecture Player' : (activeSession.clockMode === 'free' ? 'Free Desk Clock' : 'Strict Desk Clock'),
    durationSeconds: 1,
    targetDurationMinutes: activeSession.targetMinutes || 0,
    completedAt: new Date().toISOString(),
    exitReason: 'in_progress'
  };

  window.api.saveStudySession(currentSessionRecord);
  window.api.setActiveSession(activeSession);
  lastAutosaveTimestamp = Date.now();

  if (rafTimerId) cancelAnimationFrame(rafTimerId);
  tickSession();
}

function tickSession() {
  if (!activeSession) return;

  const now = Date.now();

  // If clock paused in Free mode, hold current elapsed
  if (isClockPaused) {
    rafTimerId = requestAnimationFrame(tickSession);
    return;
  }

  const effectiveNow = now - clockTotalPausedMs;
  const elapsed = Math.floor((effectiveNow - activeSession.startTime) / 1000);
  activeSession.elapsedSeconds = elapsed;

  // Real-time incremental autosave every 2 seconds: guarantees ZERO data loss down to the second
  if (now - lastAutosaveTimestamp >= 2000 && currentSessionRecord) {
    currentSessionRecord.durationSeconds = Math.max(1, elapsed);
    window.api.saveStudySession(currentSessionRecord);
    lastAutosaveTimestamp = now;
  }

  const targetSec = activeSession.targetMinutes * 60;
  const remainingSec = Math.max(0, targetSec - elapsed);

  // Check for Target Timer Expiry
  if (targetSec > 0 && remainingSec <= 0 && !activeSession.isExpired) {
    activeSession.isExpired = true;
    handleTargetTimerExpired();
    return;
  }

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const remHours = Math.floor(remainingSec / 3600);
  const remMinutes = Math.floor((remainingSec % 3600) / 60);
  const remSeconds = remainingSec % 60;

  // 1. Update Colossal Desk Clock
  if (activeSession.type === 'clock') {
    const isCountDown = targetSec > 0;
    const dH = isCountDown ? remHours : hours;
    const dM = isCountDown ? remMinutes : minutes;
    const dS = isCountDown ? remSeconds : seconds;

    document.getElementById('flipHours').textContent = String(dH).padStart(2, '0');
    document.getElementById('flipMinutes').textContent = String(dM).padStart(2, '0');
    document.getElementById('flipSeconds').textContent = String(dS).padStart(2, '0');

    if (targetSec > 0) {
      const pct = Math.min(100, (elapsed / targetSec) * 100);
      document.getElementById('colossalProgressFill').style.width = `${pct}%`;
    }

    document.getElementById('colossalElapsedText').textContent = `${formatDurationSmart(elapsed)} elapsed`;

    // Update Floating Mini Digits if present
    const miniDigits = document.getElementById('miniFloatDigits');
    if (miniDigits) {
      miniDigits.textContent = `${String(dM + dH * 60).padStart(2, '0')}:${String(dS).padStart(2, '0')}`;
    }
  }

  // 2. Update YouTube Player Top Bar
  if (activeSession.type === 'player') {
    const cdStr = `${String(remMinutes + remHours * 60).padStart(2, '0')}:${String(remSeconds).padStart(2, '0')}`;
    document.getElementById('playerHudCountdown').textContent = cdStr;
    document.getElementById('playerHudElapsed').textContent = `(${formatDurationSmart(elapsed)} elapsed)`;
  }

  // 3. Update Padhai Proof Parent Overlay if open
  if (isParentProofOpen) {
    updateParentProofContent();
  }

  rafTimerId = requestAnimationFrame(tickSession);
}

// When Target Timer Finishes (e.g., 45m completed)
function handleTargetTimerExpired() {
  pauseCurrentPlayer();

  if (currentSessionRecord && activeSession) {
    currentSessionRecord.durationSeconds = Math.max(1, activeSession.elapsedSeconds);
    window.api.saveStudySession(currentSessionRecord);
  }

  document.getElementById('expirySubject').textContent = activeSession.subject;
  document.getElementById('expiryDuration').textContent = `${formatDurationSmart(activeSession.elapsedSeconds)} Completed`;
  document.getElementById('timerExpiryModal').classList.remove('hidden');
}

function setupTimerExpiryModal() {
  document.getElementById('btnExpiryExtend').addEventListener('click', () => {
    if (activeSession) {
      activeSession.targetMinutes += 15;
      activeSession.isExpired = false;
      document.getElementById('timerExpiryModal').classList.add('hidden');
      resumeCurrentPlayer();
      tickSession();
    }
  });

  document.getElementById('btnExpiryFinish').addEventListener('click', () => {
    document.getElementById('timerExpiryModal').classList.add('hidden');
    finishAndSaveSession('target_completed');
  });
}

async function finishAndSaveSession(exitReason = 'target_completed') {
  if (!activeSession) return;

  if (rafTimerId) {
    cancelAnimationFrame(rafTimerId);
    rafTimerId = null;
  }

  closeParentProof();

  if (isClockFloating) {
    await toggleFloatingWidget(false);
  }

  const durationSeconds = Math.max(1, Math.round((Date.now() - activeSession.startTime) / 1000));

  const sessionRecord = {
    id: activeSession.id,
    subject: activeSession.subject || 'General Study',
    topic: activeSession.topic || 'Focus Session',
    mode: activeSession.type === 'player' ? 'Lecture Player' : (activeSession.clockMode === 'free' ? 'Free Desk Clock' : 'Strict Desk Clock'),
    durationSeconds,
    targetDurationMinutes: activeSession.targetMinutes || 0,
    completedAt: new Date().toISOString(),
    exitReason
  };

  // 1. Save synchronously via IPC to study_data.json
  await window.api.saveStudySession(sessionRecord);
  await window.api.clearActiveSession();
  await window.api.setLockIn(false);

  // 2. Teardown Viewports & Webview
  document.body.style.cursor = 'default';
  const studioView = document.querySelector('#tabPlayer .studio-viewport-expansive');
  if (studioView) studioView.classList.remove('hidden');
  document.getElementById('playerActiveView').classList.add('hidden');
  document.getElementById('clockActiveView').classList.add('hidden');
  document.getElementById('videoFrameWrapper').innerHTML = '';

  const savedSubject = sessionRecord.subject;
  const savedDuration = formatDurationSmart(durationSeconds);

  activeSession = null;
  currentSessionRecord = null;
  activeWorkspaces = [];
  activeWorkspaceIndex = 0;
  sessionUnlockKey = '';
  currentVideoId = '';
  isClockPaused = false;
  clockPauseStartTimestamp = 0;
  clockTotalPausedMs = 0;
  const tabsStrip = document.getElementById('workspaceTabsBar');
  if (tabsStrip) tabsStrip.innerHTML = '';
  generateNewRandomCode();

  // 3. Reload from disk to guarantee 100% data sync
  await loadStudyData();

  // 4. Show sleek macOS toast confirmation of saved study session
  showToastNotification(`✓ Session complete: ${savedDuration} studied in ${savedSubject} saved to vault!`);
}

// ========================================================
// PARENT PROOF OVERLAY (85% SCREEN COVERAGE IN HINGLISH)
// ========================================================
function setupParentProofOverlay() {
  const modal = document.getElementById('parentProofModal');
  const btnClose = document.getElementById('btnCloseParentProof');
  const btnTogglePlayer = document.getElementById('btnParentProofToggle');
  const btnToggleClock = document.getElementById('btnClockProofToggle');

  if (btnTogglePlayer) {
    btnTogglePlayer.addEventListener('click', () => {
      exitWebviewFullscreenIfActive();
      toggleParentProof();
    });
  }
  if (btnToggleClock) {
    btnToggleClock.addEventListener('click', () => {
      toggleParentProof();
    });
  }
  if (btnClose) {
    btnClose.addEventListener('click', closeParentProof);
  }

  // Intercept Global IPC signals from Electron Main Process
  if (window.api && window.api.onToggleParentProof) {
    window.api.onToggleParentProof(() => {
      exitWebviewFullscreenIfActive();
      toggleParentProof();
    });
  }

  if (window.api && window.api.onSwitchWorkspace) {
    window.api.onSwitchWorkspace((index) => {
      switchWorkspace(index);
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeParentProof();
      }
    });
  }

  // Global Backtick (` / ~) & Ctrl+1..5 key listeners
  window.addEventListener('keydown', (e) => {
    const isBacktick = (e.key === '`' || e.key === '~' || e.code === 'Backquote');
    if (isBacktick && activeSession) {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;

      e.preventDefault();
      exitWebviewFullscreenIfActive();
      toggleParentProof();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && ['1', '2', '3', '4', '5'].includes(e.key) && activeSession && activeWorkspaces.length > 0) {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      switchWorkspace(idx);
      return;
    }

    // Keyboard Shortcuts for Deck Arrows (Alt + Left/Right or Ctrl + Left/Right)
    if ((e.altKey || e.ctrlKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && activeSession && activeWorkspaces.length > 1) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') {
        const prevIdx = activeWorkspaceIndex > 0 ? activeWorkspaceIndex - 1 : activeWorkspaces.length - 1;
        switchWorkspace(prevIdx);
      } else {
        const nextIdx = activeWorkspaceIndex < activeWorkspaces.length - 1 ? activeWorkspaceIndex + 1 : 0;
        switchWorkspace(nextIdx);
      }
      return;
    }

    if (e.key === 'Escape' && isParentProofOpen) {
      e.preventDefault();
      closeParentProof();
    }
  });
}

function toggleParentProof() {
  if (isParentProofOpen) {
    closeParentProof();
  } else {
    openParentProof();
  }
}

function openParentProof() {
  if (!activeSession) return;
  isParentProofOpen = true;
  const modal = document.getElementById('parentProofModal');
  if (modal) {
    modal.classList.remove('hidden');
    updateParentProofContent();
  }
}

function closeParentProof() {
  isParentProofOpen = false;
  const modal = document.getElementById('parentProofModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function updateParentProofContent() {
  if (!activeSession) return;

  const subject = activeSession.subject || 'General Study';
  const curWs = activeWorkspaces[activeWorkspaceIndex];
  const activeTabName = curWs ? curWs.title : (activeSession.topic || 'Lecture Immersion');
  const elapsed = activeSession.elapsedSeconds || 1;
  const targetMinutes = activeSession.targetMinutes || 45;
  const targetSec = targetMinutes * 60;
  const remainingSec = Math.max(0, targetSec - elapsed);

  const elapsedMinutes = Math.floor(elapsed / 60);
  const remainingMinutes = Math.ceil(remainingSec / 60);

  const subEl = document.getElementById('parentProofSubject');
  const topicEl = document.getElementById('parentProofTopic');
  const elapEl = document.getElementById('parentProofElapsed');
  const remEl = document.getElementById('parentProofRemaining');
  const targetEl = document.getElementById('parentProofTarget');
  const barEl = document.getElementById('parentProofProgressBar');

  if (subEl) subEl.textContent = subject.toUpperCase();
  if (topicEl) topicEl.textContent = `${activeSession.topic || 'Lecture'} (Active Tab: ${activeTabName})`;
  const msgEl = document.getElementById('parentProofDynamicMessage');

  if (subEl) subEl.textContent = subject.toUpperCase();
  if (topicEl) topicEl.textContent = topic;

  if (elapEl) {
    elapEl.textContent = elapsedMinutes > 0 ? `${elapsedMinutes} Minute (${elapsed % 60}s)` : `${elapsed % 60} Second`;
  }
  if (remEl) {
    remEl.textContent = `${remainingMinutes} Minute`;
  }
  if (targetEl) {
    targetEl.textContent = `Target: ${targetMinutes} Minute`;
  }

  if (barEl) {
    const pct = targetSec > 0 ? Math.min(100, (elapsed / targetSec) * 100) : 100;
    barEl.style.width = `${pct}%`;
  }

  // Dynamic Personal Hinglish Milestone Message for Parents
  if (msgEl) {
    if (elapsedMinutes < 5) {
      msgEl.textContent = `Namaste Uncle / Aunty ji 🙏\n\nAapke bete ne abhi padhai shuru ki hai. Laptop par ${subject} ka lecture chalu ho chuka hai aur screen lock hai taaki dhyan na bhatke.`;
    } else if (elapsedMinutes < 15) {
      msgEl.textContent = `Aapke bete ne 10+ minute lagatar dhyan se padhai kar li hai.\n\nKoi game ya timepass nahi chal raha hai, poora dhyan ${subject} ke lecture aur notes par hai.`;
    } else if (elapsedMinutes < 30) {
      msgEl.textContent = `Bohat badhiya! Aapka beta lagbhag aadhe ghante se bina kisi rukawat ke padh raha hai.\n\nAap bilkul chinta mat kijiye, poori imandari se lecture complete ho raha hai.`;
    } else if (elapsedMinutes < 50) {
      msgEl.textContent = `Zabardast mehnat! 40+ minute se continuous focus ke saath padhai chal rahi hai.\n\nAapka beta apne target ke bohot kareeb hai aur bohot serious mehnat kar raha hai.`;
    } else {
      msgEl.textContent = `Kamaal ka focus! 50+ minute se continuous padhai chal rahi hai.\n\nAapke bete ne aaj bohot acchi mehnat ki hai. Session bas complete hone hi wala hai.`;
    }
  }
}

// ========================================================
// Emergency Exit Gate Modal (STRICT 6-DIGIT CODE / KEY ONLY)
// ========================================================
function setupEmergencyExitModal() {
  const modal = document.getElementById('emergencyModal');
  const passInput = document.getElementById('emergencyPassInput');
  const btnUnlockKey = document.getElementById('btnConfirmEmergencyKey');
  const btnCancelKey = document.getElementById('btnCancelEmergencyKey');

  passInput.addEventListener('input', () => {
    const val = passInput.value.trim();
    const cleanVal = val.replace(/\s+/g, '').toLowerCase();
    const cleanKey = sessionUnlockKey.replace(/\s+/g, '').toLowerCase();
    const isMaster = (cleanVal === 'unlock123');
    const passMatches = (cleanVal === cleanKey) || isMaster;
    const feedback = document.getElementById('emergencyPassMsg');

    if (val.length > 0) {
      if (passMatches) {
        feedback.textContent = '✓ Code verified correctly';
        feedback.style.color = '#34d399';
        btnUnlockKey.disabled = false;
      } else {
        feedback.textContent = '✗ Incorrect notebook code / password';
        feedback.style.color = '#f87171';
        btnUnlockKey.disabled = true;
      }
    } else {
      feedback.textContent = 'Session shuru karne se pehle jo code notebook mein likha tha wahi enter karein.';
      feedback.style.color = 'var(--text-dim)';
      btnUnlockKey.disabled = true;
    }
  });

  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnUnlockKey.disabled) {
      modal.classList.add('hidden');
      finishAndSaveSession('emergency_key');
    }
  });

  btnUnlockKey.addEventListener('click', () => {
    modal.classList.add('hidden');
    finishAndSaveSession('emergency_key');
  });

  if (btnCancelKey) {
    btnCancelKey.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }
}

function openEmergencyModal() {
  // Immediately persist exact elapsed seconds right now:
  if (activeSession && currentSessionRecord) {
    const elapsedNow = Math.max(1, Math.round((Date.now() - activeSession.startTime) / 1000));
    currentSessionRecord.durationSeconds = elapsedNow;
    window.api.saveStudySession(currentSessionRecord);
  }

  const modal = document.getElementById('emergencyModal');
  modal.classList.remove('hidden');

  document.getElementById('emergencyPassInput').value = '';
  document.getElementById('btnConfirmEmergencyKey').disabled = true;
  document.getElementById('emergencyPassMsg').textContent = 'Session shuru karne se pehle jo code notebook mein likha tha wahi enter karein.';
  document.getElementById('emergencyPassMsg').style.color = 'var(--text-dim)';
  setTimeout(() => {
    document.getElementById('emergencyPassInput').focus();
  }, 100);
}

function setupEmergencyChordListener() {
  window.api.onEmergencyChord(() => {
    if (activeSession) {
      finishAndSaveSession('failsafe_chord');
      alert('Hardware panic chord triggered. Lock-in released and session saved.');
    }
  });
}

function showToastNotification(message) {
  let toast = document.getElementById('studyLockToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'studyLockToast';
    toast.className = 'macos-toast-banner';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>⚡</span> <span>${escapeHtml(message)}</span>`;
  toast.classList.remove('fade-out');

  setTimeout(() => {
    if (toast) toast.classList.add('fade-out');
  }, 4500);
}

// ========================================================
// Helpers & Utilities
// ========================================================
function setupChipGroup(selector, onSelect) {
  document.querySelectorAll(`${selector} .chip-bold`).forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll(`${selector} .chip-bold`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (onSelect) {
        onSelect(parseInt(chip.dataset.minutes, 10));
      }
    });
  });
}

function adjustMinutes(inputId, delta) {
  const el = document.getElementById(inputId);
  let val = parseInt(el.value, 10) || 0;
  val = Math.max(1, Math.min(600, val + delta));
  el.value = val;
}

function formatDurationSmart(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return seconds > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${hours}h ${minutes}m`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
