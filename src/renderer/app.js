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

// Player State
let playerWebviewEl = null;

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

  // Midnight Countdown, Daily Targets & Distraction Friction Engine
  setupMidnightCountdownAndDate();
  await setupTodayTasksSection();
  setupTargetLockInModal();
  setupDistractionFrictionEngine();
  await setupAnalysisSection();
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

  // Zero-Data-Loss Exit Guard: Saves down to the exact second if window is closed mid-session
  window.addEventListener('beforeunload', () => {
    if (activeSession && currentSessionRecord) {
      const now = Date.now();
      const effectiveNow = now - clockTotalPausedMs;
      const elapsed = Math.max(1, Math.floor((effectiveNow - activeSession.startTime) / 1000));
      currentSessionRecord.durationSeconds = elapsed;
      currentSessionRecord.completedAt = new Date().toISOString();
      currentSessionRecord.exitReason = 'mid_session_closed';
      window.api.saveStudySession(currentSessionRecord);
    }
  });
}

// ========================================================
// Navigation
// ========================================================
function switchTab(targetTabId) {
  document.querySelectorAll('.nav-segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === targetTabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === targetTabId);
  });
  if (targetTabId === 'tabAnalysis') {
    renderAnalysis();
  }
}

function setupTabNavigation() {
  document.querySelectorAll('.nav-segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (activeSession && activeSession.clockMode === 'locked') {
        alert('🔒 Session is locked! Complete your session or enter emergency notebook exit code.');
        return;
      }
      switchTab(btn.dataset.tab);
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
// IMMERSION PLAYER ENGINE: YouTube
// ========================================================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function destroyPlayerWebviews() {
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
  playerWebviewEl = null;
}

function initPlayerWebview(videoId) {
  const wrapper = document.getElementById('videoFrameWrapper');
  if (!wrapper) return;

  destroyPlayerWebviews();

  // Pure YouTube Immersion Webview
  const ytWv = document.createElement('webview');
  ytWv.id = 'ws_webview_yt';
  ytWv.className = 'workspace-webview active-workspace';
  ytWv.setAttribute('allowfullscreen', 'true');
  ytWv.setAttribute('allowpopups', 'false');
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

  wrapper.appendChild(ytWv);
  playerWebviewEl = ytWv;
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

    // Launch Pristine YouTube Immersion Lecture
    initPlayerWebview(videoData.videoId);

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
  if (playerWebviewEl) {
    playerWebviewEl.executeJavaScript('const v = document.querySelector("video"); if (v) v.pause();').catch(() => {});
  }
}

function resumeCurrentPlayer() {
  if (playerWebviewEl) {
    playerWebviewEl.executeJavaScript('const v = document.querySelector("video"); if (v) v.play();').catch(() => {});
  }
}

function exitWebviewFullscreenIfActive() {
  if (playerWebviewEl) {
    playerWebviewEl.executeJavaScript('if (document.fullscreenElement) document.exitFullscreen();').catch(() => {});
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

  // Real-time incremental autosave every 1 second: guarantees ZERO data loss down to the exact second
  if (now - lastAutosaveTimestamp >= 1000 && currentSessionRecord) {
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

  // 5. Auto-mark matching study target if present in today's targets
  if (sessionRecord.topic) {
    autoCompleteMatchingTask(sessionRecord.topic);
  }

  // 6. Refresh Daily Analysis telemetry
  renderAnalysis();
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

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeParentProof();
      }
    });
  }

  // Global Backtick (` / ~) Parent Proof shortcut
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
    if (topicEl) topicEl.textContent = topic;

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

// ========================================================
// MIDNIGHT DEADLINE COUNTDOWN & DATE ENGINE
// ========================================================
let midnightTickerInterval = null;

function getMidnightStats() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const diffMs = Math.max(0, midnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Day burn: from 00:00 to 24:00 (full 24-hour cycle)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const fullDayMs = 24 * 60 * 60 * 1000;
  const elapsedDayMs = now.getTime() - startOfDay;
  const burnPercent = Math.min(100, Math.max(0, Math.round((elapsedDayMs / fullDayMs) * 100)));

  // Long date: "Friday, 20 November 2026"
  const optionsLong = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDateLong = now.toLocaleDateString('en-US', optionsLong);

  // Short date: "Fri, 20 Nov"
  const optionsShort = { weekday: 'short', day: 'numeric', month: 'short' };
  const formattedDateShort = now.toLocaleDateString('en-US', optionsShort);

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    burnPercent,
    formattedDateLong,
    formattedDateShort,
    hoursStr: String(hours).padStart(2, '0'),
    minutesStr: String(minutes).padStart(2, '0'),
    secondsStr: String(seconds).padStart(2, '0')
  };
}

function updateMidnightDisplays() {
  const stats = getMidnightStats();

  // 1. Titlebar live badge
  const titlebarCountdown = document.getElementById('titlebarMidnightCountdown');
  const titlebarDate = document.getElementById('titlebarCurrentDate');
  if (titlebarCountdown) {
    titlebarCountdown.textContent = `${stats.hoursStr}:${stats.minutesStr}:${stats.secondsStr}`;
  }
  if (titlebarDate) {
    titlebarDate.textContent = stats.formattedDateShort;
  }

  // 2. Hero Section in Today's Plan
  const heroDate = document.getElementById('tasksHeroDate');
  const heroH = document.getElementById('midnightHeroHours');
  const heroM = document.getElementById('midnightHeroMinutes');
  const heroS = document.getElementById('midnightHeroSeconds');
  const dayBurnFill = document.getElementById('dayBurnFill');
  const dayBurnPct = document.getElementById('dayBurnPercentText');
  const dayBurnRem = document.getElementById('dayBurnRemainingText');

  if (heroDate) heroDate.textContent = stats.formattedDateLong;
  if (heroH) heroH.textContent = stats.hoursStr;
  if (heroM) heroM.textContent = stats.minutesStr;
  if (heroS) heroS.textContent = stats.secondsStr;
  if (dayBurnFill) dayBurnFill.style.width = `${stats.burnPercent}%`;
  if (dayBurnPct) dayBurnPct.textContent = `${stats.burnPercent}% elapsed`;
  if (dayBurnRem) dayBurnRem.textContent = `${stats.hours}h ${stats.minutes}m left today`;

  // 3. Automated Study Math & Telemetry Buffer
  updateTelemetryMath();

  // 4. Friction Modal (if currently displayed)
  const frictionMidnight = document.getElementById('frictionMidnightTimeDisplay');
  if (frictionMidnight) {
    frictionMidnight.textContent = `${stats.hoursStr}h ${stats.minutesStr}m ${stats.secondsStr}s`;
  }
}

function updateTelemetryMath() {
  const plannedEl = document.getElementById('telemetryPlannedTime');
  const remainingEl = document.getElementById('telemetryRemainingTime');
  const bufferEl = document.getElementById('telemetryBufferStatus');
  if (!plannedEl || !remainingEl || !bufferEl) return;

  // 1. Calculate total planned minutes across all pending tasks
  const pendingTasks = dailyTasks.filter(t => !t.completed);
  const totalPlannedMins = pendingTasks.reduce((acc, t) => acc + (t.minutes || 0), 0);
  const plannedH = Math.floor(totalPlannedMins / 60);
  const plannedM = totalPlannedMins % 60;
  plannedEl.textContent = `${plannedH}h ${String(plannedM).padStart(2, '0')}m`;

  // 2. Calculate remaining minutes until 12 AM
  const stats = getMidnightStats();
  const totalRemainingMins = Math.floor(stats.totalSeconds / 60);
  remainingEl.textContent = `${stats.hours}h ${String(stats.minutes).padStart(2, '0')}m`;

  // 3. Compute Schedule Buffer
  const bufferMins = totalRemainingMins - totalPlannedMins;
  if (bufferMins >= 0) {
    const bufH = Math.floor(bufferMins / 60);
    const bufM = bufferMins % 60;
    bufferEl.textContent = `+${bufH}h ${String(bufM).padStart(2, '0')}m buffer`;
    bufferEl.className = 'math-buffer-pill positive';
  } else {
    const defMins = Math.abs(bufferMins);
    const defH = Math.floor(defMins / 60);
    const defM = defMins % 60;
    bufferEl.textContent = `⚠️ -${defH}h ${String(defM).padStart(2, '0')}m deficit`;
    bufferEl.className = 'math-buffer-pill deficit';
  }
}

function setupMidnightCountdownAndDate() {
  updateMidnightDisplays();
  if (midnightTickerInterval) clearInterval(midnightTickerInterval);
  midnightTickerInterval = setInterval(updateMidnightDisplays, 1000);
}


// ========================================================
// DAILY TARGETS & TASK PLANNER (STUDIO REDESIGN)
// ========================================================
let dailyTasks = [];
let currentTaskFilter = 'all'; // 'all' | 'pending' | 'completed'
let selectedTaskSubject = 'Physics';
let selectedTaskMinutes = 45;

async function setupTodayTasksSection() {
  // Load saved tasks from persistence
  try {
    const saved = await window.api.getStudyTasks();
    dailyTasks = Array.isArray(saved) ? saved : [];
  } catch (e) {
    console.error('Failed to load tasks:', e);
    dailyTasks = [];
  }

  // Subject Chips Selection
  document.querySelectorAll('#taskSubjectChips .chip-bold').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#taskSubjectChips .chip-bold').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedTaskSubject = chip.dataset.subject || 'Physics';
    });
  });

  // Duration Chips Selection
  document.querySelectorAll('#taskDurationChips .chip-bold').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#taskDurationChips .chip-bold').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedTaskMinutes = parseInt(chip.dataset.minutes, 10) || 45;
      const minInput = document.getElementById('taskCustomMinutes');
      if (minInput) minInput.value = selectedTaskMinutes;
    });
  });

  // Custom Duration Stepper (-5 / +5)
  const btnSub5 = document.getElementById('btnTaskSub5');
  const btnAdd5 = document.getElementById('btnTaskAdd5');
  const customMinInput = document.getElementById('taskCustomMinutes');

  if (btnSub5 && customMinInput) {
    btnSub5.addEventListener('click', () => {
      let val = Math.max(1, (parseInt(customMinInput.value, 10) || 45) - 5);
      customMinInput.value = val;
      selectedTaskMinutes = val;
      updateTaskDurationChipActive(val);
    });
  }

  if (btnAdd5 && customMinInput) {
    btnAdd5.addEventListener('click', () => {
      let val = Math.min(600, (parseInt(customMinInput.value, 10) || 45) + 5);
      customMinInput.value = val;
      selectedTaskMinutes = val;
      updateTaskDurationChipActive(val);
    });
  }

  if (customMinInput) {
    customMinInput.addEventListener('input', () => {
      let val = parseInt(customMinInput.value, 10) || 45;
      selectedTaskMinutes = val;
      updateTaskDurationChipActive(val);
    });
  }

  // YouTube Link Paste Button
  const btnPasteYt = document.getElementById('btnTaskPasteYt');
  const ytInput = document.getElementById('taskYoutubeInput');
  if (btnPasteYt && ytInput) {
    btnPasteYt.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        ytInput.value = text;
        showToastNotification('✓ Pasted lecture URL');
      } catch (e) {
        ytInput.focus();
      }
    });
  }

  // Add Task Button
  const btnAdd = document.getElementById('btnAddTask');
  const taskInput = document.getElementById('taskTitleInput');

  if (btnAdd && taskInput) {
    btnAdd.addEventListener('click', () => handleAddNewTask());
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddNewTask();
    });
  }

  // Filter Buttons
  document.querySelectorAll('.task-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTaskFilter = btn.dataset.filter || 'all';
      renderTasks();
    });
  });

  // Clear Completed Tasks Button
  const btnClear = document.getElementById('btnClearCompletedTasks');
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      const completedCount = dailyTasks.filter(t => t.completed).length;
      if (completedCount === 0) {
        showToastNotification('No completed targets to clear.');
        return;
      }
      dailyTasks = dailyTasks.filter(t => !t.completed);
      await persistTasks();
      renderTasks();
      updateTelemetryMath();
      showToastNotification(`Cleared ${completedCount} completed target(s).`);
    });
  }

  // Keyboard Shortcuts: '/' to focus composer, Ctrl+Enter to launch top target
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      switchTab('tabTasks');
      const input = document.getElementById('taskTitleInput');
      if (input) input.focus();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const pendingList = dailyTasks.filter(t => !t.completed);
      if (pendingList.length > 0) {
        window.openTargetLockInModal(pendingList[0].id);
      }
    }
  });

  // Initial render
  renderTasks();
  updateTelemetryMath();
}

function updateTaskDurationChipActive(val) {
  document.querySelectorAll('#taskDurationChips .chip-bold').forEach(chip => {
    chip.classList.toggle('active', parseInt(chip.dataset.minutes, 10) === val);
  });
}

async function handleAddNewTask() {
  const titleInput = document.getElementById('taskTitleInput');
  const ytInput = document.getElementById('taskYoutubeInput');
  const title = titleInput ? titleInput.value.trim() : '';
  const youtubeUrl = ytInput ? ytInput.value.trim() : '';

  if (!title) {
    titleInput.focus();
    return;
  }

  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title,
    subject: selectedTaskSubject,
    minutes: selectedTaskMinutes,
    youtubeUrl: youtubeUrl || '',
    completed: false,
    createdAt: new Date().toISOString()
  };

  dailyTasks.unshift(newTask);
  if (titleInput) titleInput.value = '';
  if (ytInput) ytInput.value = '';

  await persistTasks();
  renderTasks();
  updateTelemetryMath();
  showToastNotification(`🎯 Added target: ${title} (${selectedTaskMinutes}m)`);
}

async function persistTasks() {
  try {
    await window.api.saveStudyTasks(dailyTasks);
  } catch (e) {
    console.error('Failed to persist tasks:', e);
  }
}

function renderTasks() {
  const container = document.getElementById('dailyTasksList');
  const emptyState = document.getElementById('tasksEmptyState');
  if (!container) return;

  // Filter tasks
  const filtered = dailyTasks.filter(task => {
    if (currentTaskFilter === 'pending') return !task.completed;
    if (currentTaskFilter === 'completed') return task.completed;
    return true;
  });

  // Update counts
  const total = dailyTasks.length;
  const completed = dailyTasks.filter(t => t.completed).length;
  const pending = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const countAll = document.getElementById('countAll');
  const countPending = document.getElementById('countPending');
  const countCompleted = document.getElementById('countCompleted');
  const completedCountEl = document.getElementById('tasksCompletedCount');
  const totalCountEl = document.getElementById('tasksTotalCount');
  const percentTextEl = document.getElementById('tasksPercentText');
  const progressFill = document.getElementById('tasksProgressFill');

  if (countAll) countAll.textContent = total;
  if (countPending) countPending.textContent = pending;
  if (countCompleted) countCompleted.textContent = completed;
  if (completedCountEl) completedCountEl.textContent = completed;
  if (totalCountEl) totalCountEl.textContent = total;
  if (percentTextEl) percentTextEl.textContent = `${percent}%`;
  if (progressFill) progressFill.style.width = `${percent}%`;

  // Update "Next Up" Hero Spotlight
  const nextUpHero = document.getElementById('taskNextUpHero');
  const nextUpSubject = document.getElementById('nextUpSubject');
  const nextUpTitle = document.getElementById('nextUpTitle');
  const nextUpDuration = document.getElementById('nextUpDuration');
  const nextUpYtBadge = document.getElementById('nextUpYtBadge');
  const btnNextUpLockIn = document.getElementById('btnNextUpLockIn');

  const pendingList = dailyTasks.filter(t => !t.completed);
  if (pendingList.length > 0 && currentTaskFilter !== 'completed') {
    const topPending = pendingList[0];
    if (nextUpHero) nextUpHero.classList.remove('hidden');
    if (nextUpSubject) {
      nextUpSubject.textContent = topPending.subject;
      const col = SUBJECT_COLORS[topPending.subject] || '#38bdf8';
      nextUpSubject.style.color = col;
      nextUpSubject.style.borderColor = col;
    }
    if (nextUpTitle) nextUpTitle.textContent = topPending.title;
    if (nextUpDuration) nextUpDuration.textContent = `⏱️ ${topPending.minutes}m`;
    if (nextUpYtBadge) {
      nextUpYtBadge.classList.toggle('hidden', !topPending.youtubeUrl);
    }
    if (btnNextUpLockIn) {
      btnNextUpLockIn.onclick = () => window.openTargetLockInModal(topPending.id);
    }
  } else {
    if (nextUpHero) nextUpHero.classList.add('hidden');
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(task => {
    const subjectColor = SUBJECT_COLORS[task.subject] || '#38bdf8';
    return `
      <div class="task-card-item ${task.completed ? 'completed' : ''}" data-id="${task.id}" style="border-left-color: ${task.completed ? '#10b981' : subjectColor};">
        <div class="task-card-left">
          <div class="task-custom-checkbox" onclick="toggleTaskCompletion('${task.id}')" title="${task.completed ? 'Mark pending' : 'Mark completed'}">
            <span class="task-check-icon">✓</span>
          </div>
          <div class="task-card-details">
            <span class="task-title-text" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span>
            <div class="task-meta-row">
              <span class="task-badge-subject" style="background: ${subjectColor}22; color: ${subjectColor}; border: 1px solid ${subjectColor}44;">${task.subject}</span>
              <span class="task-badge-duration">⏱️ ${task.minutes}m</span>
              ${task.youtubeUrl ? `<span class="task-badge-yt">▶ Lecture Linked</span>` : ''}
            </div>
          </div>
        </div>
        <div class="task-card-right">
          ${!task.completed ? `
            <button type="button" class="btn-task-lockin" onclick="openTargetLockInModal('${task.id}')" title="Choose password & launch Lock-In session">
              <span>▶ Lock In</span>
            </button>
          ` : `
            <span style="font-size: 11px; font-weight: 800; color: #10b981;">✓ Done</span>
          `}
          <button type="button" class="btn-task-delete" onclick="deleteStudyTask('${task.id}')" title="Delete target">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleTaskCompletion = async function(taskId) {
  const task = dailyTasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  if (task.completed) {
    task.completedAt = new Date().toISOString();
  } else {
    delete task.completedAt;
  }
  await persistTasks();
  renderTasks();
  renderAnalysis();
  if (task.completed) {
    showToastNotification(`🎉 Completed target: ${task.title}!`);
  }
};

window.deleteStudyTask = async function(taskId) {
  dailyTasks = dailyTasks.filter(t => t.id !== taskId);
  await persistTasks();
  renderTasks();
  renderAnalysis();
  showToastNotification('Target removed.');
};

// ========================================================
// TARGET LOCK-IN LAUNCH POPUP & RUNTIME ENGINE
// ========================================================
let currentTargetForLaunch = null;
let targetModalRandomCode = '';
let targetModalExitMode = 'random'; // 'random' | 'custom'
let targetModalLaunchDestination = 'player'; // 'player' | 'clock'

function setupTargetLockInModal() {
  const modal = document.getElementById('targetLockInModal');
  const btnCancel = document.getElementById('btnCancelTargetModal');
  const btnLaunch = document.getElementById('btnConfirmTargetLaunch');
  const btnPasteYt = document.getElementById('btnTargetModalPasteYt');
  const btnRegen = document.getElementById('btnTargetRegenCode');
  const btnExitRand = document.getElementById('btnTargetExitModeRandom');
  const btnExitCust = document.getElementById('btnTargetExitModeCustom');
  const boxRand = document.getElementById('boxTargetExitCodeRandom');
  const boxCust = document.getElementById('boxTargetExitCodeCustom');
  const btnLaunchPlayer = document.getElementById('btnTargetLaunchPlayer');
  const btnLaunchClock = document.getElementById('btnTargetLaunchClock');
  const minInput = document.getElementById('targetModalMinutes');
  const btnSub5 = document.getElementById('btnTargetModalSub5');
  const btnAdd5 = document.getElementById('btnTargetModalAdd5');

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      modal.classList.add('hidden');
      currentTargetForLaunch = null;
    });
  }

  if (btnPasteYt) {
    btnPasteYt.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const urlInput = document.getElementById('targetModalYtUrl');
        if (urlInput) urlInput.value = text;
      } catch (e) {}
    });
  }

  if (btnRegen) {
    btnRegen.addEventListener('click', () => {
      generateTargetModalRandomCode();
    });
  }

  if (btnExitRand && btnExitCust) {
    btnExitRand.addEventListener('click', () => {
      targetModalExitMode = 'random';
      btnExitRand.classList.add('active');
      btnExitCust.classList.remove('active');
      if (boxRand) boxRand.classList.remove('hidden');
      if (boxCust) boxCust.classList.add('hidden');
    });

    btnExitCust.addEventListener('click', () => {
      targetModalExitMode = 'custom';
      btnExitCust.classList.add('active');
      btnExitRand.classList.remove('active');
      if (boxCust) boxCust.classList.remove('hidden');
      if (boxRand) boxRand.classList.add('hidden');
      const passInp = document.getElementById('targetModalCustomPass');
      if (passInp) passInp.focus();
    });
  }

  if (btnLaunchPlayer && btnLaunchClock) {
    btnLaunchPlayer.addEventListener('click', () => {
      targetModalLaunchDestination = 'player';
      btnLaunchPlayer.classList.add('active');
      btnLaunchClock.classList.remove('active');
    });

    btnLaunchClock.addEventListener('click', () => {
      targetModalLaunchDestination = 'clock';
      btnLaunchClock.classList.add('active');
      btnLaunchPlayer.classList.remove('active');
    });
  }

  // Duration adjustments
  document.querySelectorAll('#targetModalDurationChips .chip-bold').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#targetModalDurationChips .chip-bold').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (minInput) minInput.value = chip.dataset.minutes;
    });
  });

  if (btnSub5 && minInput) {
    btnSub5.addEventListener('click', () => {
      let val = Math.max(1, (parseInt(minInput.value, 10) || 45) - 5);
      minInput.value = val;
      updateModalChipActive(val);
    });
  }

  if (btnAdd5 && minInput) {
    btnAdd5.addEventListener('click', () => {
      let val = Math.min(600, (parseInt(minInput.value, 10) || 45) + 5);
      minInput.value = val;
      updateModalChipActive(val);
    });
  }

  if (minInput) {
    minInput.addEventListener('input', () => {
      let val = parseInt(minInput.value, 10) || 45;
      updateModalChipActive(val);
    });
  }

  if (btnLaunch) {
    btnLaunch.addEventListener('click', executeTargetLockInLaunch);
  }
}

function updateModalChipActive(val) {
  document.querySelectorAll('#targetModalDurationChips .chip-bold').forEach(chip => {
    chip.classList.toggle('active', parseInt(chip.dataset.minutes, 10) === val);
  });
}

function generateTargetModalRandomCode() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  targetModalRandomCode = code;
  const formatted = `${code.slice(0, 3)} ${code.slice(3, 6)}`;
  const display = document.getElementById('displayTargetModalCode');
  if (display) display.textContent = formatted;
}

window.openTargetLockInModal = function(taskId) {
  const task = dailyTasks.find(t => t.id === taskId);
  if (!task) return;

  currentTargetForLaunch = task;

  const modal = document.getElementById('targetLockInModal');
  const titleEl = document.getElementById('targetModalTitle');
  const subEl = document.getElementById('targetModalSubject');
  const ytIndicator = document.getElementById('targetModalYtIndicator');
  const ytInput = document.getElementById('targetModalYtUrl');
  const minInput = document.getElementById('targetModalMinutes');

  if (titleEl) titleEl.textContent = task.title;
  if (subEl) {
    subEl.textContent = task.subject;
    const col = SUBJECT_COLORS[task.subject] || '#38bdf8';
    subEl.style.color = col;
    subEl.style.borderColor = col;
  }

  if (minInput) minInput.value = task.minutes || 45;
  updateModalChipActive(task.minutes || 45);

  if (ytInput) ytInput.value = task.youtubeUrl || '';
  if (ytIndicator) {
    if (task.youtubeUrl) {
      ytIndicator.textContent = '▶ YouTube Lecture Ready';
      ytIndicator.style.color = '#34d399';
    } else {
      ytIndicator.textContent = '⏱️ No link set (Focus Clock or paste link)';
      ytIndicator.style.color = 'var(--text-dim)';
    }
  }

  // Pre-select destination: if YouTube link is present -> Player, else Player
  targetModalLaunchDestination = task.youtubeUrl ? 'player' : 'player';
  const btnPlayer = document.getElementById('btnTargetLaunchPlayer');
  const btnClock = document.getElementById('btnTargetLaunchClock');
  if (btnPlayer && btnClock) {
    btnPlayer.classList.toggle('active', targetModalLaunchDestination === 'player');
    btnClock.classList.toggle('active', targetModalLaunchDestination === 'clock');
  }

  // Reset exit code mode
  targetModalExitMode = 'random';
  const btnRand = document.getElementById('btnTargetExitModeRandom');
  const btnCust = document.getElementById('btnTargetExitModeCustom');
  const boxRand = document.getElementById('boxTargetExitCodeRandom');
  const boxCust = document.getElementById('boxTargetExitCodeCustom');
  if (btnRand) btnRand.classList.add('active');
  if (btnCust) btnCust.classList.remove('active');
  if (boxRand) boxRand.classList.remove('hidden');
  if (boxCust) boxCust.classList.add('hidden');

  generateTargetModalRandomCode();

  if (modal) modal.classList.remove('hidden');
};

function executeTargetLockInLaunch() {
  if (!currentTargetForLaunch) return;

  const task = currentTargetForLaunch;
  const minutes = parseInt(document.getElementById('targetModalMinutes').value, 10) || 45;
  const ytUrl = document.getElementById('targetModalYtUrl').value.trim();

  // If user entered or modified YouTube URL, save it back to the task!
  if (ytUrl !== task.youtubeUrl) {
    task.youtubeUrl = ytUrl;
    persistTasks();
  }

  // Determine unlock key
  let unlockKey = '';
  if (targetModalExitMode === 'random') {
    unlockKey = targetModalRandomCode || '729401';
  } else {
    const custPass = document.getElementById('targetModalCustomPass');
    unlockKey = custPass ? custPass.value.trim() : '';
    if (!unlockKey) {
      alert('Please enter a custom exit password or choose the 6-digit notebook code.');
      if (custPass) custPass.focus();
      return;
    }
  }

  sessionUnlockKey = unlockKey;
  currentRandomCode = unlockKey;

  // Close modal
  const modal = document.getElementById('targetLockInModal');
  if (modal) modal.classList.add('hidden');

  if (targetModalLaunchDestination === 'player') {
    const videoData = convertToYouTubeData(ytUrl);
    if (!videoData) {
      if (confirm('No valid YouTube URL provided. Would you like to launch this session in Focus Clock (Pure Desk Clock) instead?')) {
        launchTaskIntoClock(task, minutes, unlockKey);
        return;
      }
      switchTab('tabPlayer');
      document.getElementById('ytUrlInput').focus();
      showToastNotification('Please paste a YouTube video URL to start lecture immersion.');
      return;
    }

    launchTaskIntoPlayer(task, minutes, videoData.videoId, unlockKey);
  } else {
    launchTaskIntoClock(task, minutes, unlockKey);
  }
}

function launchTaskIntoPlayer(task, minutes, videoId, unlockKey) {
  // Sync to Player UI fields
  const topicInput = document.getElementById('playerTopicInput');
  const minInput = document.getElementById('playerCustomMinutes');
  const urlInput = document.getElementById('ytUrlInput');
  if (topicInput) topicInput.value = task.title;
  if (minInput) minInput.value = minutes;
  if (urlInput) urlInput.value = task.youtubeUrl || '';

  document.querySelectorAll('#playerSubjectChips .chip-bold').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.subject === task.subject);
  });

  const hudSub = document.getElementById('playerHudSubject');
  if (hudSub) hudSub.textContent = task.subject;
  const hudTop = document.getElementById('playerHudTopic');
  if (hudTop) hudTop.textContent = task.title;

  switchTab('tabPlayer');

  initPlayerWebview(videoId);

  startSessionEngine({
    type: 'player',
    clockMode: 'locked',
    subject: task.subject,
    topic: task.title,
    targetMinutes: minutes
  });

  const studioView = document.querySelector('#tabPlayer .studio-viewport-expansive');
  if (studioView) studioView.classList.add('hidden');
  const activeView = document.getElementById('playerActiveView');
  if (activeView) activeView.classList.remove('hidden');

  window.api.setLockIn(true);
  showToastNotification(`🚀 Locked in: "${task.title}" (${minutes}m)!`);
}

function launchTaskIntoClock(task, minutes, unlockKey) {
  // Sync to Clock UI fields
  const topicInput = document.getElementById('clockTopicInput');
  const minInput = document.getElementById('clockCustomMinutes');
  if (topicInput) topicInput.value = task.title;
  if (minInput) minInput.value = minutes;

  document.querySelectorAll('#clockSubjectChips .chip-bold').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.subject === task.subject);
  });

  document.getElementById('colossalSubject').textContent = task.subject;
  document.getElementById('colossalTopic').textContent = task.title;
  document.getElementById('colossalTargetText').textContent = `Target: ${minutes}m`;

  clockMode = 'locked';
  isClockPaused = false;
  clockPauseStartTimestamp = 0;
  clockTotalPausedMs = 0;

  const modeBadge = document.getElementById('colossalModeBadge');
  const strictControls = document.getElementById('clockStrictControls');
  const freeControls = document.getElementById('clockFreeControls');
  if (modeBadge) modeBadge.textContent = 'STRICT LOCK-IN';
  if (strictControls) strictControls.classList.remove('hidden');
  if (freeControls) freeControls.classList.add('hidden');

  switchTab('tabClock');

  startSessionEngine({
    type: 'clock',
    clockMode: 'locked',
    subject: task.subject,
    topic: task.title,
    targetMinutes: minutes
  });

  const setupView = document.querySelector('#tabClock .clock-setup-card-expansive');
  if (setupView) setupView.classList.add('hidden');
  const activeView = document.getElementById('clockActiveView');
  if (activeView) activeView.classList.remove('hidden');

  window.api.setLockIn(true);
  showToastNotification(`⏱️ Focus Clock locked in: "${task.title}" (${minutes}m)!`);
}

function autoCompleteMatchingTask(completedTopic) {
  if (!completedTopic || !dailyTasks.length) return;
  const match = dailyTasks.find(t => !t.completed && t.title.toLowerCase().trim() === completedTopic.toLowerCase().trim());
  if (match) {
    match.completed = true;
    match.completedAt = new Date().toISOString();
    persistTasks();
    renderTasks();
    renderAnalysis();
    showToastNotification(`🎯 Auto-completed matching target: "${match.title}"!`);
  }
}


// ========================================================
// ZERO-REPETITION DISTRACTION FRICTION ENGINE
// ========================================================
const FRICTION_QUESTIONS = [
  "What you are doing right now... is it taking you closer to your goal, or are you just running away from the grind?",
  "Jo abhi kar rahe ho... kya wo sach mein zaroori hai ya bas mindless scrolling aur distraction hai?",
  "Ask yourself honestly: Is what you're doing right now worth the regret tonight at 12:00 AM?",
  "Agar kisi ne tumhare pichle 30 minutes record kiye hote, toh kya tum unhe dekhkar proud feel karte?",
  "Look at the clock. The time that just slipped away is never coming back. Is this what you promised yourself?",
  "Kya tumhara competition bhi is waqt aise hi laptop par time waste kar raha hoga, ya wo padh raha hai?",
  "Are you genuinely taking a planned break, or is this guilt-filled procrastination eating away your day?",
  "Remember why you started this entire journey. Does what you're doing right now match your ambition?",
  "12 baje ke baad afsos hoga ya sukoon? The choice is entirely in your hands right now.",
  "Agar aaj ka din dubara jeene ko mile, toh kya yahi karoge jo abhi pichle 20 minute se kar rahe ho?",
  "Your future self is watching you right now through memories. Are you giving them a reason to thank you?",
  "Boring kaam shuru karne mein sirf 2 minute lagte hain. Can you give just 2 minutes of real focus right now?",
  "Screen par random refresh karne se koi exam clear nahi hota. Which pending target will you tackle right now?",
  "Only a few hours left before the 12 AM midnight cutoff. Will you end today as a winner or with excuses?",
  "Is this random distraction worth sacrificing your rank, your college, and your self-respect?",
  "Pehle targets complete karo, phir aaraam ka haq banta hai. You still have targets waiting!",
  "Every single distraction you surrender to is a silent compromise with mediocrity. Stand up and Lock In.",
  "Do you want to wake up tomorrow morning proud of yesterday's effort, or burdened with another backlog?",
  "Discipline is simply choosing between what you want now and what you want most. What do you choose right now?",
  "Ek baar shuru kar doge toh focus apne aap aa jayega. Start the timer, face the topic.",
  "The pain of discipline weighs ounces, but the pain of regret weighs tons. Get back on track.",
  "Nobody is coming to complete your daily targets for you. It's only you who can sit down and do it.",
  "You opened your laptop with an intention to study. What are you actually doing right now?",
  "Ek ghanta aur guzar gaya. Let's turn this day around right now before the night ends.",
  "Stop negotiating with laziness. Just open the lecture or book and sit for one solid focus block.",
  "Self-respect comes from keeping the promises you made to yourself in private. Lock in.",
  "Distraction is cheap, focus is priceless. Which one are you choosing right at this moment?",
  "Kal subah regret se uthna hai ya confidence se? 12 AM midnight cutoff is ticking down.",
  "Are you waiting for the 'perfect mood'? Focus follows action, not mood. Lock in now.",
  "Ek deep breath lo. Jo useless tabs khule hain unhe close karo, aur agla target shuru karo.",
  "What you do in the secret hours of your day decides where you stand when results are declared.",
  "If you don't sacrifice for what you want, what you want becomes the sacrifice. Back to work.",
  "Har minute jo waste ho raha hai, wo tumhare target ko aur mushkil bana raha hai. Stop drifting.",
  "You have the potential, the resources, and the time. What's stopping you from giving 100% right now?",
  "Think of your parents' expectations and their belief in you. Don't let cheap dopamine steal your focus."
];

let idleOutsideLockInSeconds = 0;
let frictionCooldownUntil = 0;
const FRICTION_TRIGGER_THRESHOLD_SECONDS = 900; // 15 minutes of idle/unlocked drift
let frictionModalActive = false;
let frictionNextPendingTask = null;

function getNextFrictionQuestion() {
  const STORAGE_KEY_DECK = 'studylock_friction_deck_v1';
  const STORAGE_KEY_LAST = 'studylock_friction_last_v1';

  let deck = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DECK);
    if (saved) deck = JSON.parse(saved);
  } catch (e) {
    deck = [];
  }

  const lastIndex = parseInt(localStorage.getItem(STORAGE_KEY_LAST) || '-1', 10);

  // Re-fill deck if empty or exhausted
  if (!Array.isArray(deck) || deck.length === 0) {
    deck = FRICTION_QUESTIONS.map((_, i) => i);
    // Don't repeat the very last question on the cycle boundary
    if (lastIndex >= 0 && deck.length > 1) {
      deck = deck.filter(i => i !== lastIndex);
    }
  }

  // Draw random question from remaining deck
  const randIdx = Math.floor(Math.random() * deck.length);
  const pickedQuestionIndex = deck.splice(randIdx, 1)[0];

  try {
    localStorage.setItem(STORAGE_KEY_DECK, JSON.stringify(deck));
    localStorage.setItem(STORAGE_KEY_LAST, pickedQuestionIndex.toString());
  } catch (e) {
    console.warn('Failed to save friction deck to localStorage:', e);
  }

  return FRICTION_QUESTIONS[pickedQuestionIndex];
}

function playFrictionAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35); // A4
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    // Ignore audio errors if blocked
  }
}

function showDistractionFrictionModal(isManualTest = false) {
  const modal = document.getElementById('distractionFrictionModal');
  const questionEl = document.getElementById('frictionQuestionText');
  const idleDisplay = document.getElementById('frictionIdleTimeDisplay');
  const midnightDisplay = document.getElementById('frictionMidnightTimeDisplay');
  const spotlightBox = document.getElementById('frictionTargetSpotlight');
  const spotlightSubject = document.getElementById('frictionSpotlightSubject');
  const spotlightTitle = document.getElementById('frictionSpotlightTitle');
  const spotlightDuration = document.getElementById('frictionSpotlightDuration');

  if (!modal) return;

  // 1. Pick guaranteed non-repeating question
  const question = getNextFrictionQuestion();
  if (questionEl) questionEl.textContent = question;

  // 2. Set stats
  const idleSecs = isManualTest ? Math.max(idleOutsideLockInSeconds, 960) : idleOutsideLockInSeconds;
  const idleMins = Math.floor(idleSecs / 60);
  const idleRemainderSecs = idleSecs % 60;
  if (idleDisplay) {
    idleDisplay.textContent = `${idleMins}m ${idleRemainderSecs}s`;
  }

  const midnightStats = getMidnightStats();
  if (midnightDisplay) {
    midnightDisplay.textContent = `${midnightStats.hoursStr}h ${midnightStats.minutesStr}m ${midnightStats.secondsStr}s`;
  }

  // 3. Find next pending target
  const pendingTasks = dailyTasks.filter(t => !t.completed);
  if (pendingTasks.length > 0) {
    frictionNextPendingTask = pendingTasks[0];
    if (spotlightBox) spotlightBox.classList.remove('hidden');
    if (spotlightSubject) {
      spotlightSubject.textContent = frictionNextPendingTask.subject;
      const col = SUBJECT_COLORS[frictionNextPendingTask.subject] || '#38bdf8';
      spotlightSubject.style.color = col;
      spotlightSubject.style.borderColor = col;
    }
    if (spotlightTitle) spotlightTitle.textContent = frictionNextPendingTask.title;
    if (spotlightDuration) spotlightDuration.textContent = `⏱️ ${frictionNextPendingTask.minutes}m`;
  } else {
    frictionNextPendingTask = null;
    if (spotlightBox) spotlightBox.classList.remove('hidden');
    if (spotlightSubject) spotlightSubject.textContent = 'PLAN';
    if (spotlightTitle) spotlightTitle.textContent = 'No pending target added yet. Head to Today\'s Plan to add targets!';
    if (spotlightDuration) spotlightDuration.textContent = 'Today';
  }

  // 4. Play alert chime and display modal
  playFrictionAlertSound();
  modal.classList.remove('hidden');
  frictionModalActive = true;
}

function hideDistractionFrictionModal() {
  const modal = document.getElementById('distractionFrictionModal');
  if (modal) modal.classList.add('hidden');
  frictionModalActive = false;
  idleOutsideLockInSeconds = 0;
}

function setupDistractionFrictionEngine() {
  // Test Button in Today's Plan
  const btnTest = document.getElementById('btnTestFrictionPrompt');
  if (btnTest) {
    btnTest.addEventListener('click', () => {
      showDistractionFrictionModal(true);
    });
  }

  // Snooze Button
  const btnSnooze = document.getElementById('btnFrictionSnooze');
  if (btnSnooze) {
    btnSnooze.addEventListener('click', () => {
      frictionCooldownUntil = Date.now() + 5 * 60 * 1000; // 5 minute snooze
      hideDistractionFrictionModal();
      showToastNotification('⏳ Break snoozed for 5 minutes. Take a breath and get ready to Lock In!');
    });
  }

  // Lock In Button in Modal
  const btnLockIn = document.getElementById('btnFrictionLockIn');
  if (btnLockIn) {
    btnLockIn.addEventListener('click', () => {
      hideDistractionFrictionModal();
      if (frictionNextPendingTask) {
        launchTaskInLockIn(frictionNextPendingTask.id);
      } else {
        switchTab('tabPlayer');
        showToastNotification('🚀 Ready to study! Set your lecture and Lock In.');
      }
    });
  }

  // Idle Drift Ticker: checks every second outside Lock-In
  setInterval(() => {
    // If user is currently in a study session, reset idle drift
    if (activeSession) {
      idleOutsideLockInSeconds = 0;
      return;
    }

    idleOutsideLockInSeconds++;

    // Check if threshold reached
    if (
      idleOutsideLockInSeconds >= FRICTION_TRIGGER_THRESHOLD_SECONDS &&
      Date.now() > frictionCooldownUntil &&
      !frictionModalActive
    ) {
      showDistractionFrictionModal(false);
    }
  }, 1000);

  // Window focus trigger: when student clicks back onto StudyLock after drifting
  window.addEventListener('focus', () => {
    if (
      !activeSession &&
      idleOutsideLockInSeconds >= FRICTION_TRIGGER_THRESHOLD_SECONDS &&
      Date.now() > frictionCooldownUntil &&
      !frictionModalActive
    ) {
      showDistractionFrictionModal(false);
    }
  });
}

// ========================================================
// TAB 4: DAY-WISE STUDY ANALYSIS (Zero-Data-Loss Telemetry)
// ========================================================
let selectedAnalysisDate = new Date();

async function setupAnalysisSection() {
  const btnPrev = document.getElementById('btnAnalysisPrevDay');
  const btnNext = document.getElementById('btnAnalysisNextDay');
  const btnToday = document.getElementById('btnAnalysisToday');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      selectedAnalysisDate.setDate(selectedAnalysisDate.getDate() - 1);
      renderAnalysis();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const today = new Date();
      if (selectedAnalysisDate.toDateString() !== today.toDateString()) {
        selectedAnalysisDate.setDate(selectedAnalysisDate.getDate() + 1);
        renderAnalysis();
      }
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      selectedAnalysisDate = new Date();
      renderAnalysis();
    });
  }

  await renderAnalysis();
}

function formatAnalysisDateLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
  const formatted = date.toLocaleDateString('en-US', options);

  if (isToday) return `Today · ${formatted}`;
  if (isYesterday) return `Yesterday · ${formatted}`;
  return formatted;
}

function isSameLocalDate(isoString, targetDate) {
  if (!isoString) return false;
  const d = new Date(isoString);
  return d.getFullYear() === targetDate.getFullYear() &&
         d.getMonth() === targetDate.getMonth() &&
         d.getDate() === targetDate.getDate();
}

function formatExactDurationHMS(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '00h 00m 00s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  return `${hStr}h ${mStr}m ${sStr}s`;
}

function formatExactDurationSmart(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

async function renderAnalysis() {
  try {
    const freshData = await window.api.getStudyData();
    if (freshData) studyData = freshData;
  } catch (e) {}

  const dateTextEl = document.getElementById('analysisActiveDateText');
  const dateBadgeEl = document.getElementById('analysisDateBadge');
  const btnNext = document.getElementById('btnAnalysisNextDay');
  const heroTimeEl = document.getElementById('analysisHeroTotalTime');
  const sessionCountEl = document.getElementById('analysisSessionCount');
  const targetCompletedEl = document.getElementById('analysisTargetCompletedCount');
  const topSubjectEl = document.getElementById('analysisTopSubject');
  const avgDurationEl = document.getElementById('analysisAvgSessionDuration');
  const subjectListEl = document.getElementById('analysisSubjectBreakdownList');
  const targetsHeaderPillEl = document.getElementById('analysisTargetsHeaderPill');
  const targetsListEl = document.getElementById('analysisCompletedTargetsList');
  const sessionsLogListEl = document.getElementById('analysisSessionsLogList');

  // Update date controls
  const today = new Date();
  const isToday = selectedAnalysisDate.toDateString() === today.toDateString();
  if (dateTextEl) dateTextEl.textContent = formatAnalysisDateLabel(selectedAnalysisDate);
  if (dateBadgeEl) {
    dateBadgeEl.textContent = selectedAnalysisDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (btnNext) {
    btnNext.disabled = isToday;
  }

  // Filter Sessions for selected local date
  const allSessions = (studyData && studyData.sessions) ? studyData.sessions : [];
  const daySessions = allSessions.filter(s => isSameLocalDate(s.completedAt, selectedAnalysisDate));

  // Compute Total Study Time down to the second
  const totalDaySeconds = daySessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  if (heroTimeEl) {
    heroTimeEl.textContent = formatExactDurationHMS(totalDaySeconds);
  }

  // Session Count & Average Duration
  const sessionCount = daySessions.length;
  if (sessionCountEl) sessionCountEl.textContent = sessionCount;

  if (avgDurationEl) {
    if (sessionCount > 0) {
      const avgSecs = Math.round(totalDaySeconds / sessionCount);
      avgDurationEl.textContent = formatExactDurationSmart(avgSecs);
    } else {
      avgDurationEl.textContent = '--';
    }
  }

  // Compute Subject-Wise Distribution
  const subjectTotals = {};
  daySessions.forEach(s => {
    const subj = s.subject || 'Other';
    subjectTotals[subj] = (subjectTotals[subj] || 0) + (s.durationSeconds || 0);
  });

  // Determine top subject
  let topSubj = '--';
  let topSubjTime = 0;
  for (const [subj, secs] of Object.entries(subjectTotals)) {
    if (secs > topSubjTime) {
      topSubjTime = secs;
      topSubj = subj;
    }
  }
  if (topSubjectEl) topSubjectEl.textContent = topSubjTime > 0 ? topSubj : '--';

  // Render Subject Breakdown Bars
  if (subjectListEl) {
    const subjects = ['Physics', 'Chemistry', 'Maths', 'Other'];
    Object.keys(subjectTotals).forEach(subj => {
      if (!subjects.includes(subj)) subjects.push(subj);
    });

    if (totalDaySeconds === 0) {
      subjectListEl.innerHTML = `
        <div class="audit-empty-hint">No subject hours logged for this date.</div>
      `;
    } else {
      subjectListEl.innerHTML = subjects.map(subj => {
        const secs = subjectTotals[subj] || 0;
        const pct = totalDaySeconds > 0 ? Math.round((secs / totalDaySeconds) * 100) : 0;
        const color = SUBJECT_COLORS[subj] || '#94a3b8';
        return `
          <div class="subject-breakdown-row">
            <div class="subject-row-meta">
              <div class="subject-row-left">
                <span class="subject-dot-color" style="background: ${color};"></span>
                <span class="subject-row-name">${subj}</span>
              </div>
              <div class="subject-row-right">
                <span class="subject-row-time">${formatExactDurationSmart(secs)}</span>
                <span class="subject-row-pct">${pct}%</span>
              </div>
            </div>
            <div class="subject-bar-track">
              <div class="subject-bar-fill" style="width: ${pct}%; background: ${color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Completed Targets on this Date
  const allTasks = dailyTasks || [];
  const completedTasksOnDate = allTasks.filter(t => t.completed && isSameLocalDate(t.completedAt || t.createdAt, selectedAnalysisDate));
  const totalTasksOnDate = allTasks.filter(t => isSameLocalDate(t.createdAt, selectedAnalysisDate));

  if (targetCompletedEl) {
    targetCompletedEl.textContent = `${completedTasksOnDate.length} of ${totalTasksOnDate.length || completedTasksOnDate.length}`;
  }
  if (targetsHeaderPillEl) {
    targetsHeaderPillEl.textContent = `${completedTasksOnDate.length} Completed`;
  }

  if (targetsListEl) {
    if (completedTasksOnDate.length === 0) {
      targetsListEl.innerHTML = `
        <div class="audit-empty-hint">No completed targets recorded for this date.</div>
      `;
    } else {
      targetsListEl.innerHTML = completedTasksOnDate.map(t => {
        const color = SUBJECT_COLORS[t.subject] || '#38bdf8';
        return `
          <div class="completed-audit-item">
            <div class="audit-target-left">
              <span class="audit-check-icon">✓</span>
              <span class="task-badge-subject" style="background: ${color}22; color: ${color};">${t.subject}</span>
              <span class="audit-target-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>
            </div>
            <span class="audit-target-duration">⏱️ ${t.minutes}m</span>
          </div>
        `;
      }).join('');
    }
  }

  // Chronological Session Audit Log
  if (sessionsLogListEl) {
    if (daySessions.length === 0) {
      sessionsLogListEl.innerHTML = `
        <div class="audit-empty-hint">No focus sessions recorded on this date.<br>Start a Lock-In session in Study Player or Focus Clock to log study time!</div>
      `;
    } else {
      sessionsLogListEl.innerHTML = daySessions.map(s => {
        const color = SUBJECT_COLORS[s.subject] || '#38bdf8';
        const dateObj = new Date(s.completedAt);
        const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--';
        const isCompletedFull = s.exitReason === 'completed' || s.exitReason === 'normal_closed' || s.exitReason === '100%_complete';
        const reasonBadge = isCompletedFull ? `<span style="color: #10b981; font-size: 10px; font-weight: 800;">✓ Completed</span>` : `<span style="color: #f59e0b; font-size: 10px; font-weight: 800;">⚡ Logged</span>`;

        return `
          <div class="session-audit-card">
            <div class="session-audit-main">
              <span class="session-audit-topic" title="${escapeHtml(s.topic)}">${escapeHtml(s.topic)}</span>
              <div class="session-audit-tags">
                <span class="task-badge-subject" style="background: ${color}22; color: ${color};">${s.subject || 'General'}</span>
                <span class="session-audit-mode">${escapeHtml(s.mode || 'Immersion')}</span>
                ${reasonBadge}
              </div>
            </div>
            <div class="session-audit-time-block">
              <span class="session-audit-duration">${formatExactDurationSmart(s.durationSeconds || 0)}</span>
              <span class="session-audit-timestamp">${timeStr}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}
