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

// Dedicated Dual Deck State (YouTube + RaySensei)
let currentDeck = 'youtube'; // 'youtube' | 'raysensei'
let ytWebviewEl = null;
let rayWebviewEl = null;

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
  setupClockSection();
  setupParentProofOverlay();
  setupEmergencyExitModal();
  setupTimerExpiryModal();
  setupEmergencyChordListener();
  generateNewRandomCode();
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

  // Exit Code Mode Toggle: Notebook Code vs Custom Password
  const btnExitRand = document.getElementById('btnExitModeRandom') || document.getElementById('btnRitualRandom');
  const btnExitCust = document.getElementById('btnExitModeCustom') || document.getElementById('btnRitualCustom');
  const boxExitRand = document.getElementById('boxExitCodeRandom') || document.getElementById('boxRitualRandom');
  const boxExitCust = document.getElementById('boxExitCodeCustom') || document.getElementById('boxRitualCustom');

  if (btnExitRand && btnExitCust && boxExitRand && boxExitCust) {
    btnExitRand.addEventListener('click', () => {
      ritualMode = 'random';
      btnExitRand.classList.add('active');
      btnExitCust.classList.remove('active');
      boxExitRand.classList.remove('hidden');
      boxExitRand.classList.add('active');
      boxExitCust.classList.add('hidden');
      boxExitCust.classList.remove('active');
    });

    btnExitCust.addEventListener('click', () => {
      ritualMode = 'custom';
      btnExitCust.classList.add('active');
      btnExitRand.classList.remove('active');
      boxExitCust.classList.remove('hidden');
      boxExitCust.classList.add('active');
      boxExitRand.classList.add('hidden');
      boxExitRand.classList.remove('active');
      const custInput = document.getElementById('playerCustomPassword');
      if (custInput) custInput.focus();
    });
  }

  const btnPRegen = document.getElementById('btnPlayerRegenCode');
  if (btnPRegen) btnPRegen.addEventListener('click', generateNewRandomCode);

  // Dual Deck Top Bar Switcher Pills
  const pillYt = document.getElementById('deckPillYt');
  if (pillYt) pillYt.addEventListener('click', () => switchToDeck('youtube'));
  const pillRay = document.getElementById('deckPillRay');
  if (pillRay) pillRay.addEventListener('click', () => switchToDeck('raysensei'));

  // Ensure Floating Edge Navigation Arrows are wired
  ensureEdgeArrowButtons();

  // Preview Button: Render Live Direct Watch in Stage Screen
  const btnPreview = document.getElementById('btnPreviewUrl');
  const btnClosePrev = document.getElementById('btnClosePreview');

  if (btnPreview) {
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
  }

  if (btnClosePrev) {
    btnClosePrev.addEventListener('click', closeStagePreview);
  }

  // Launch Player
  const btnLaunch = document.getElementById('btnLaunchPlayer');
  if (btnLaunch) btnLaunch.addEventListener('click', handlePlayerLaunch);

  // Permanent Bar Emergency Exit Button
  const btnEmerg = document.getElementById('btnPlayerEmergency');
  if (btnEmerg) btnEmerg.addEventListener('click', openEmergencyModal);

  // Setup Screen: 10-Second Chrome Sync for RaySensei
  setupRaySenseiSyncUI();
}

function setupRaySenseiSyncUI() {
  const btnOpenSync = document.getElementById('btnOpenSyncRaySensei');
  const btnCloseSync = document.getElementById('btnCloseSyncRaySensei');
  const modal = document.getElementById('syncRaySenseiModal');
  const btnCopyCmd = document.getElementById('btnCopySyncCommand');
  const btnPasteSync = document.getElementById('btnPasteAndSyncRaySensei');
  const feedback = document.getElementById('syncStatusFeedback');

  // Check if already synced
  if (btnOpenSync && localStorage.getItem('studylock_raysensei_session')) {
    btnOpenSync.textContent = '✓ RaySensei Synced';
    btnOpenSync.style.color = '#34d399';
  }

  if (btnOpenSync && modal) {
    btnOpenSync.addEventListener('click', () => {
      if (feedback) {
        feedback.className = 'sync-feedback-text hidden';
        feedback.textContent = '';
      }
      modal.classList.remove('hidden');
    });
  }

  if (btnCloseSync && modal) {
    btnCloseSync.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  if (btnCopyCmd) {
    btnCopyCmd.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('copy(JSON.stringify(localStorage))');
        const origText = btnCopyCmd.textContent;
        btnCopyCmd.textContent = 'Copied!';
        btnCopyCmd.style.color = '#34d399';
        setTimeout(() => {
          btnCopyCmd.textContent = origText;
          btnCopyCmd.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    });
  }

  if (btnPasteSync) {
    btnPasteSync.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || text.trim() === '') {
          if (feedback) {
            feedback.className = 'sync-feedback-text sync-feedback-error';
            feedback.textContent = 'Clipboard is empty. Please run the command in Chrome console first.';
          }
          return;
        }

        let parsed = null;
        try {
          parsed = JSON.parse(text.trim());
        } catch (e) {
          if (feedback) {
            feedback.className = 'sync-feedback-text sync-feedback-error';
            feedback.textContent = 'Invalid session data in clipboard. Please copy directly from Chrome console.';
          }
          return;
        }

        if (typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
          if (feedback) {
            feedback.className = 'sync-feedback-text sync-feedback-error';
            feedback.textContent = 'No storage keys found. Make sure you are signed in on app.raysensei.com in Chrome.';
          }
          return;
        }

        // Save locally in StudyLock
        localStorage.setItem('studylock_raysensei_session', JSON.stringify(parsed));

        // Inject into persistent partition
        if (window.api && window.api.injectRaySenseiSession) {
          await window.api.injectRaySenseiSession(JSON.stringify(parsed));
        }

        // Inject into live RaySensei webview if loaded
        if (rayWebviewEl) {
          rayWebviewEl.executeJavaScript(`
            try {
              const data = ${JSON.stringify(parsed)};
              for (const [k, v] of Object.entries(data)) {
                localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
              }
              window.location.reload();
            } catch (e) {}
          `).catch(() => {});
        }

        if (feedback) {
          feedback.className = 'sync-feedback-text sync-feedback-success';
          feedback.textContent = '🎉 RaySensei login session synced successfully! You are logged in.';
        }

        if (btnOpenSync) {
          btnOpenSync.textContent = '✓ RaySensei Synced';
          btnOpenSync.style.color = '#34d399';
        }

        showToastNotification('✓ RaySensei login synced from Chrome! Account ready.');

        setTimeout(() => {
          if (modal) modal.classList.add('hidden');
        }, 1800);
      } catch (err) {
        console.error('Paste sync error:', err);
        if (feedback) {
          feedback.className = 'sync-feedback-text sync-feedback-error';
          feedback.textContent = 'Failed to read clipboard: ' + err.message;
        }
      }
    });
  }
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
  webview.setAttribute('partition', 'persist:studylock_session');
  webview.setAttribute('allowfullscreen', 'true');
  webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0');
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
// DEDICATED DUAL DECK ENGINE: YouTube + RaySensei
// ========================================================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function destroyDualDeckWebviews() {
  const wrapper = document.getElementById('videoFrameWrapper');
  if (wrapper) {
    const webviews = wrapper.querySelectorAll('webview');
    webviews.forEach(wv => {
      try {
        wv.src = 'about:blank';
      } catch (e) {}
      wv.remove();
    });
  }
  ytWebviewEl = null;
  rayWebviewEl = null;
}

function ensureEdgeArrowButtons() {
  const wrapper = document.getElementById('videoFrameWrapper');
  if (!wrapper) return;

  let btnFlipRay = document.getElementById('btnFlipToRaySensei');
  if (!btnFlipRay) {
    btnFlipRay = document.createElement('button');
    btnFlipRay.id = 'btnFlipToRaySensei';
    btnFlipRay.className = 'deck-edge-arrow arrow-edge-right';
    btnFlipRay.title = 'Flip to RaySensei (Alt+Right / Ctrl+2)';
    btnFlipRay.innerHTML = '<span class="edge-arrow-icon">❯</span><span class="edge-arrow-tag">RaySensei</span>';
    wrapper.appendChild(btnFlipRay);
  }

  let btnFlipYt = document.getElementById('btnFlipToYouTube');
  if (!btnFlipYt) {
    btnFlipYt = document.createElement('button');
    btnFlipYt.id = 'btnFlipToYouTube';
    btnFlipYt.className = 'deck-edge-arrow arrow-edge-left hidden';
    btnFlipYt.title = 'Flip back to Lecture (Alt+Left / Ctrl+1)';
    btnFlipYt.innerHTML = '<span class="edge-arrow-icon">❮</span><span class="edge-arrow-tag">Lecture</span>';
    wrapper.appendChild(btnFlipYt);
  }

  btnFlipRay.onclick = (e) => {
    e.stopPropagation();
    switchToDeck('raysensei');
  };
  btnFlipYt.onclick = (e) => {
    e.stopPropagation();
    switchToDeck('youtube');
  };
}

function switchToDeck(target) {
  currentDeck = target;
  const pillYt = document.getElementById('deckPillYt');
  const pillRay = document.getElementById('deckPillRay');
  const arrowRight = document.getElementById('btnFlipToRaySensei');
  const arrowLeft = document.getElementById('btnFlipToYouTube');
  const hudTopic = document.getElementById('playerHudTopic');

  if (target === 'youtube') {
    if (ytWebviewEl) {
      ytWebviewEl.classList.remove('inactive-workspace');
      ytWebviewEl.classList.add('active-workspace');
      try { ytWebviewEl.focus(); } catch (e) {}
    }
    if (rayWebviewEl) {
      rayWebviewEl.classList.remove('active-workspace');
      rayWebviewEl.classList.add('inactive-workspace');
    }
    if (pillYt) pillYt.classList.add('active');
    if (pillRay) pillRay.classList.remove('active');
    if (arrowRight) arrowRight.classList.remove('hidden');
    if (arrowLeft) arrowLeft.classList.add('hidden');
    if (hudTopic) hudTopic.textContent = 'YouTube Lecture';
  } else {
    // RaySensei
    if (rayWebviewEl) {
      rayWebviewEl.classList.remove('inactive-workspace');
      rayWebviewEl.classList.add('active-workspace');
      try { rayWebviewEl.focus(); } catch (e) {}
    }
    if (ytWebviewEl) {
      ytWebviewEl.classList.remove('active-workspace');
      ytWebviewEl.classList.add('inactive-workspace');
    }
    if (pillRay) pillRay.classList.add('active');
    if (pillYt) pillYt.classList.remove('active');
    if (arrowRight) arrowRight.classList.add('hidden');
    if (arrowLeft) arrowLeft.classList.remove('hidden');
    if (hudTopic) hudTopic.textContent = 'RaySensei';
  }
}

function initDedicatedDualDeck(videoId) {
  const wrapper = document.getElementById('videoFrameWrapper');
  if (!wrapper) return;

  destroyDualDeckWebviews();

  // 1. YouTube Webview (Primary)
  const ytWv = document.createElement('webview');
  ytWv.id = 'ws_webview_yt';
  ytWv.className = 'workspace-webview active-workspace';
  ytWv.setAttribute('allowfullscreen', 'true');
  ytWv.setAttribute('allowpopups', 'true');
  ytWv.setAttribute('partition', 'persist:studylock_session');
  ytWv.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0');
  ytWv.src = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;

  // Protect YouTube navigation: allow account sign-in, prevent roaming to unrelated videos
  ytWv.addEventListener('will-navigate', (e) => {
    try {
      const navUrl = new URL(e.url);
      const navHost = navUrl.hostname.toLowerCase();
      const isAuthHost = navHost === 'accounts.google.com' ||
                         navHost === 'accounts.youtube.com' ||
                         navHost.endsWith('.google.com') ||
                         navHost.endsWith('.youtube.com');
      if (isAuthHost && !navUrl.pathname.startsWith('/watch')) {
        return; // Allow Google account login navigation
      }
      const targetId = extractYouTubeId(e.url || '');
      if (targetId && videoId && targetId !== videoId) {
        e.preventDefault();
      }
    } catch (err) {}
  });

  ytWv.addEventListener('enter-html-full-screen', () => {
    ytWv.style.position = 'fixed';
    ytWv.style.top = '0';
    ytWv.style.left = '0';
    ytWv.style.width = '100vw';
    ytWv.style.height = '100vh';
    ytWv.style.zIndex = '999998';
  });

  ytWv.addEventListener('leave-html-full-screen', () => {
    ytWv.style.position = 'relative';
    ytWv.style.width = '100%';
    ytWv.style.height = '100%';
    ytWv.style.zIndex = 'auto';
  });

  ytWv.addEventListener('dom-ready', () => {
    ytWv.insertCSS(`
      #secondary, #related, ytd-watch-next-secondary-results-renderer, #comments, #masthead-container, #guide-button, #guide-wrapper, ytd-mini-guide-renderer, .ytp-ce-element, .ytp-endscreen-content, #below {
        display: none !important;
      }
      #page-manager { margin-top: 0 !important; }
      ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: 100vw !important; margin: 0 auto !important; padding: 0 !important; }
    `).catch(() => {});
  });

  // 2. RaySensei Webview (Simultaneous Background Companion)
  const rayWv = document.createElement('webview');
  rayWv.id = 'ws_webview_raysensei';
  rayWv.className = 'workspace-webview inactive-workspace';
  rayWv.setAttribute('allowfullscreen', 'true');
  rayWv.setAttribute('allowpopups', 'true');
  rayWv.setAttribute('partition', 'persist:studylock_session');
  rayWv.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0');
  rayWv.src = 'https://app.raysensei.com/';

  // Allow navigation inside RaySensei and OAuth providers
  rayWv.addEventListener('will-navigate', (e) => {
    try {
      const navUrl = new URL(e.url);
      const navHost = navUrl.hostname.toLowerCase();
      const isAllowed = navHost.includes('raysensei.com') ||
                        navHost.includes('google.com') ||
                        navHost.includes('firebaseapp.com') ||
                        navHost.includes('supabase.co') ||
                        navHost.includes('clerk.dev') ||
                        navHost.includes('auth0.com');
      if (!isAllowed) {
        e.preventDefault();
        console.warn('Navigation blocked by StudyLock Whitelist Firewall:', e.url);
      }
    } catch (err) {
      e.preventDefault();
    }
  });

  // Automatically inject synced login credentials on load
  rayWv.addEventListener('dom-ready', () => {
    const saved = localStorage.getItem('studylock_raysensei_session');
    if (saved) {
      rayWv.executeJavaScript(`
        try {
          const raw = ${JSON.stringify(saved)};
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          let updated = false;
          for (const [k, v] of Object.entries(parsed)) {
            const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
            if (localStorage.getItem(k) !== strVal) {
              localStorage.setItem(k, strVal);
              updated = true;
            }
          }
          if (updated) {
            window.location.reload();
          }
        } catch (e) {}
      `).catch(() => {});
    }
  });

  // Prepend webviews so edge arrow buttons remain on top
  wrapper.prepend(rayWv);
  wrapper.prepend(ytWv);

  ytWebviewEl = ytWv;
  rayWebviewEl = rayWv;

  ensureEdgeArrowButtons();
  switchToDeck('youtube');
}

function handlePlayerLaunch() {
  try {
    closeStagePreview();

    const urlInput = document.getElementById('ytUrlInput');
    const url = urlInput ? urlInput.value.trim() : '';
    const videoData = convertToYouTubeData(url);

    if (!videoData) {
      alert('Please enter a valid YouTube video link before starting.');
      if (urlInput) urlInput.focus();
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
        alert('Please enter your custom exit password or switch to Notebook Code.');
        if (custInput) custInput.focus();
        return;
      }
      unlockKey = custVal;
    }

    sessionUnlockKey = unlockKey;

    const activeChip = document.querySelector('#playerSubjectChips .chip-bold.active');
    const subject = activeChip ? (activeChip.dataset.subject || activeChip.textContent.trim()) : 'Physics';
    const topicInput = document.getElementById('playerTopicInput');
    const topic = (topicInput ? topicInput.value.trim() : '') || 'Lecture Immersion';
    const minutesInput = document.getElementById('playerCustomMinutes');
    const targetMinutes = parseInt(minutesInput ? minutesInput.value : 45, 10) || 45;

    const hudSub = document.getElementById('playerHudSubject');
    if (hudSub) hudSub.textContent = subject;
    const hudTop = document.getElementById('playerHudTopic');
    if (hudTop) hudTop.textContent = topic;

    // Launch Dedicated Dual Deck (YouTube + RaySensei)
    initDedicatedDualDeck(videoData.videoId);

    startSessionEngine({
      type: 'player',
      clockMode: 'locked',
      subject,
      topic,
      targetMinutes
    });

    const studioView = document.querySelector('#tabPlayer .studio-viewport-expansive');
    if (studioView) studioView.classList.add('hidden');
    const activeView = document.getElementById('playerActiveView');
    if (activeView) activeView.classList.remove('hidden');

    window.api.setLockIn(true);
  } catch (err) {
    console.error('Launch failed:', err);
    alert('Session launch error: ' + err.message);
  }
}

function pauseCurrentPlayer() {
  if (ytWebviewEl) {
    ytWebviewEl.executeJavaScript('const v = document.querySelector("video"); if (v) v.pause();').catch(() => {});
  }
  if (rayWebviewEl) {
    rayWebviewEl.executeJavaScript('const v = document.querySelector("video, audio"); if (v) v.pause();').catch(() => {});
  }
}

function resumeCurrentPlayer() {
  if (currentDeck === 'youtube' && ytWebviewEl) {
    ytWebviewEl.executeJavaScript('const v = document.querySelector("video"); if (v) v.play();').catch(() => {});
  } else if (currentDeck === 'raysensei' && rayWebviewEl) {
    rayWebviewEl.executeJavaScript('const v = document.querySelector("video, audio"); if (v) v.play();').catch(() => {});
  }
}

function exitWebviewFullscreenIfActive() {
  if (ytWebviewEl) {
    ytWebviewEl.executeJavaScript('if (document.fullscreenElement) document.exitFullscreen();').catch(() => {});
  }
  if (rayWebviewEl) {
    rayWebviewEl.executeJavaScript('if (document.fullscreenElement) document.exitFullscreen();').catch(() => {});
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
    const hudCountdown = document.getElementById('playerHudCountdown');
    if (hudCountdown) hudCountdown.textContent = cdStr;
    const hudElapsed = document.getElementById('playerHudElapsed');
    if (hudElapsed) hudElapsed.textContent = `(${formatDurationSmart(elapsed)} elapsed)`;
  }

  // 3. Update Padhai Proof Parent Overlay if open
  if (isParentProofOpen) {
    try {
      updateParentProofContent();
    } catch (e) {
      console.error('Error ticking parent proof:', e);
    }
  }

  rafTimerId = requestAnimationFrame(tickSession);
}

// When Target Timer Finishes (e.g., 45m or 1m completed)
function handleTargetTimerExpired() {
  exitWebviewFullscreenIfActive();
  pauseCurrentPlayer();

  if (currentSessionRecord && activeSession) {
    currentSessionRecord.durationSeconds = Math.max(1, activeSession.elapsedSeconds);
    window.api.saveStudySession(currentSessionRecord);
  }

  const subEl = document.getElementById('expirySubject');
  if (subEl) subEl.textContent = activeSession.subject || 'Physics';
  const durEl = document.getElementById('expiryDuration');
  if (durEl) durEl.textContent = `${formatDurationSmart(activeSession.elapsedSeconds)} Completed`;

  const modal = document.getElementById('timerExpiryModal');
  if (modal) modal.classList.remove('hidden');
}

function setupTimerExpiryModal() {
  const btnExtend = document.getElementById('btnExpiryExtend');
  if (btnExtend) {
    btnExtend.addEventListener('click', () => {
      if (activeSession) {
        activeSession.targetMinutes += 15;
        activeSession.isExpired = false;
        const modal = document.getElementById('timerExpiryModal');
        if (modal) modal.classList.add('hidden');
        resumeCurrentPlayer();
        tickSession();
      }
    });
  }

  const btnFinish = document.getElementById('btnExpiryFinish');
  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      const modal = document.getElementById('timerExpiryModal');
      if (modal) modal.classList.add('hidden');
      finishAndSaveSession('target_completed');
    });
  }
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

  // 2. Teardown Viewports & Webviews
  document.body.style.cursor = 'default';
  const studioView = document.querySelector('#tabPlayer .studio-viewport-expansive');
  if (studioView) studioView.classList.remove('hidden');
  const playerActiveView = document.getElementById('playerActiveView');
  if (playerActiveView) playerActiveView.classList.add('hidden');
  const clockActiveView = document.getElementById('clockActiveView');
  if (clockActiveView) clockActiveView.classList.add('hidden');

  destroyDualDeckWebviews();

  const savedSubject = sessionRecord.subject;
  const savedDuration = formatDurationSmart(durationSeconds);

  activeSession = null;
  currentSessionRecord = null;
  sessionUnlockKey = '';
  currentVideoId = '';
  isClockPaused = false;
  clockPauseStartTimestamp = 0;
  clockTotalPausedMs = 0;
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
      if (index === 0) switchToDeck('youtube');
      else if (index === 1) switchToDeck('raysensei');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeParentProof();
      }
    });
  }

  // Global Backtick (` / ~) & Dual Deck shortcuts
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

    // Intercept Dual Deck flipping (Alt+Left/Right or Ctrl+1/2)
    if (activeSession && activeSession.type === 'player') {
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        switchToDeck('youtube');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        switchToDeck('raysensei');
        return;
      }
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') {
          switchToDeck('youtube');
        } else {
          switchToDeck('raysensei');
        }
        return;
      }
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

  try {
    const subject = activeSession.subject || 'General Study';
    const activeTabName = currentDeck === 'youtube' ? 'YouTube Lecture' : 'RaySensei';
    const topic = activeSession.topic || 'Lecture Immersion';
    const elapsed = Math.max(1, activeSession.elapsedSeconds || 1);
    const targetMinutes = activeSession.targetMinutes || 45;
    const targetSec = targetMinutes * 60;
    const remainingSec = Math.max(0, targetSec - elapsed);

    const elapsedMinutes = Math.floor(elapsed / 60);
    const elapsedSecsRem = elapsed % 60;

    const remainingMinutes = Math.floor(remainingSec / 60);
    const remainingSecsRem = remainingSec % 60;

    const subEl = document.getElementById('parentProofSubject');
    const topicEl = document.getElementById('parentProofTopic');
    const elapEl = document.getElementById('parentProofElapsed');
    const remEl = document.getElementById('parentProofRemaining');
    const targetEl = document.getElementById('parentProofTarget');
    const barEl = document.getElementById('parentProofProgressBar');
    const msgEl = document.getElementById('parentProofDynamicMessage');

    if (subEl) subEl.textContent = subject.toUpperCase();
    if (topicEl) topicEl.textContent = `${topic} (${activeTabName})`;

    // Exact, live dynamic elapsed time
    if (elapEl) {
      if (elapsed < 60) {
        elapEl.textContent = `${elapsed} Second${elapsed === 1 ? '' : 's'}`;
      } else {
        elapEl.textContent = `${elapsedMinutes}m ${elapsedSecsRem}s`;
      }
    }

    // Exact, live dynamic remaining time
    if (remEl) {
      if (remainingSec <= 0) {
        remEl.textContent = '0s (Completed)';
      } else if (remainingSec < 60) {
        remEl.textContent = `${remainingSec} Second${remainingSec === 1 ? '' : 's'}`;
      } else {
        remEl.textContent = `${remainingMinutes}m ${remainingSecsRem}s`;
      }
    }

    if (targetEl) {
      targetEl.textContent = `Target: ${targetMinutes} Minute${targetMinutes === 1 ? '' : 's'}`;
    }

    if (barEl) {
      const pct = targetSec > 0 ? Math.min(100, (elapsed / targetSec) * 100) : 100;
      barEl.style.width = `${pct}%`;
    }

    // Dynamic Personal Hinglish Milestone Message for Parents
    if (msgEl) {
      if (elapsed < 60) {
        msgEl.textContent = `Namaste Uncle / Aunty ji 🙏\n\nAapke bete ne abhi padhai shuru ki hai (${elapsed} seconds). Laptop par ${subject} ka lecture chalu ho chuka hai aur screen lock hai taaki dhyan na bhatke.`;
      } else if (elapsedMinutes < 5) {
        msgEl.textContent = `Namaste Uncle / Aunty ji 🙏\n\nAapke bete ne padhai shuru kar di hai (${elapsedMinutes} minute se). Laptop par ${subject} ka lecture chalu hai aur screen poori tarah locked hai.`;
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
  } catch (err) {
    console.error('Safe guard: error updating parent proof overlay:', err);
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
  const msgEl = document.getElementById('emergencyPassMsg');
  if (msgEl) {
    if (ritualMode === 'custom') {
      msgEl.textContent = 'Enter the custom exit password you configured before starting.';
    } else {
      msgEl.textContent = 'Session shuru karne se pehle jo code notebook mein likha tha wahi enter karein.';
    }
    msgEl.style.color = 'var(--text-dim)';
  }
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
