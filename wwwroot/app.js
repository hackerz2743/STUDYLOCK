/* ==========================================================================
   StudyLock - Complete Frontend Logic
   Distraction-Free Immersion Study & Desk Clock Desktop Application
   ========================================================================== */

(() => {
  'use strict';

  // -------------------------------------------------------------------------
  // Global State
  // -------------------------------------------------------------------------
  const state = {
    activeTab: 'player', // 'player' | 'timer' | 'analysis'
    activeSession: {
      isActive: false,
      subject: 'Physics',
      topic: 'Rotational Motion Lecture 03',
      targetMinutes: 45,
      mode: 'player', // 'player' | 'normal' | 'lockin'
      startTime: null,
      elapsedSeconds: 0,
      timerInterval: null
    },
    vault: {
      settings: {
        securityPassword: 'unlock123',
        accountabilityPledge: 'I promise to stay disciplined and return to my studies',
        theme: 'night',
        soundChoice: 'none'
      },
      sessions: []
    },
    ui: {
      idleTimeout: null,
      isIdle: false,
      selectedSound: 'none',
      playerSubject: 'Physics',
      playerTargetMinutes: 45,
      timerSubject: 'Physics',
      timerTargetMinutes: 25,
      timerMode: 'normal' // 'normal' | 'lockin'
    }
  };

  // -------------------------------------------------------------------------
  // Audio Synthesis via Web Audio API (Zero external assets needed)
  // -------------------------------------------------------------------------
  class SoundSynthesizer {
    constructor() {
      this.ctx = null;
      this.activeSource = null;
      this.gainNode = null;
      this.tickInterval = null;
      this.currentMode = 'none';
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    play(mode) {
      this.stop();
      this.currentMode = mode;
      if (mode === 'none') return;

      this.init();

      if (mode === 'tick') {
        this.playTick();
        this.tickInterval = setInterval(() => this.playTick(), 1000);
      } else if (mode === 'rain') {
        this.startRain();
      } else if (mode === 'brown') {
        this.startBrownNoise();
      }
    }

    playTick() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.035);
    }

    startRain() {
      if (!this.ctx) return;
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Generate pink/white noise filtered for rain
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.04, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      whiteNoise.start(0);
      this.activeSource = whiteNoise;
    }

    startBrownNoise() {
      if (!this.ctx) return;
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      const brownNoise = this.ctx.createBufferSource();
      brownNoise.buffer = noiseBuffer;
      brownNoise.loop = true;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.06, this.ctx.currentTime);

      brownNoise.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      brownNoise.start(0);
      this.activeSource = brownNoise;
    }

    stop() {
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }
      if (this.activeSource) {
        try { this.activeSource.stop(); } catch (e) {}
        this.activeSource = null;
      }
      this.currentMode = 'none';
    }
  }

  const soundSynth = new SoundSynthesizer();

  // -------------------------------------------------------------------------
  // Starfield Animation for Night Obsidian Mode
  // -------------------------------------------------------------------------
  function initStarfield() {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      drawStars();
    });

    const stars = [];
    const count = 75;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.2 + 0.3,
        alpha: Math.random() * 0.7 + 0.2
      });
    }

    function drawStars() {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawStars();
  }

  // -------------------------------------------------------------------------
  // IPC Communication with C# WPF Host
  // -------------------------------------------------------------------------
  function postMessageToHost(obj) {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(JSON.stringify(obj));
    } else {
      console.log('[IPC Mock to C#]:', obj);
    }
  }

  function setupHostListeners() {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.addEventListener('message', (event) => {
        try {
          const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          handleHostMessage(msg);
        } catch (err) {
          console.error('Error handling host message:', err);
        }
      });
    }

    // Request initial saved vault data
    postMessageToHost({ action: 'getData' });
  }

  function handleHostMessage(msg) {
    if (!msg) return;

    if (msg.type === 'loadDataResponse') {
      if (msg.data && typeof msg.data === 'string' && msg.data.trim().length > 0) {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed && typeof parsed === 'object') {
            if (parsed.settings) state.vault.settings = { ...state.vault.settings, ...parsed.settings };
            if (Array.isArray(parsed.sessions)) state.vault.sessions = parsed.sessions;
            applyLoadedSettings();
            renderAnalytics();
          }
        } catch (e) {
          console.error('Failed parsing loaded data:', e);
        }
      } else {
        // First run seed data for JEE/NEET demo
        seedInitialDemoData();
      }
    } else if (msg.type === 'failsafeTriggered') {
      // Hard failsafe triggered: Ctrl + Alt + Shift + F12
      handleFailsafeTriggered();
    } else if (msg.type === 'forceAutoSaveBeforeClose') {
      // Emergency flush on app close
      if (state.activeSession.isActive) {
        finishAndLogSession('app_close');
      }
    }
  }

  function seedInitialDemoData() {
    state.vault.sessions = [
      {
        id: 'seed_1',
        subject: 'Physics',
        topic: 'Rotational Motion - Moment of Inertia',
        mode: 'lockin_clock',
        durationSeconds: 2700, // 45m
        startTime: new Date(Date.now() - 86400000 * 2).toISOString(),
        endTime: new Date(Date.now() - 86400000 * 2 + 2700000).toISOString(),
        exitReason: 'completed'
      },
      {
        id: 'seed_2',
        subject: 'Chemistry',
        topic: 'Organic Reaction Mechanisms - Electrophilic Addition',
        mode: 'lockin_player',
        durationSeconds: 3600, // 60m
        startTime: new Date(Date.now() - 86400000).toISOString(),
        endTime: new Date(Date.now() - 86400000 + 3600000).toISOString(),
        exitReason: 'completed'
      },
      {
        id: 'seed_3',
        subject: 'Maths',
        topic: 'Definite Integration & Area Under Curves',
        mode: 'normal_clock',
        durationSeconds: 1845, // 30m 45s
        startTime: new Date(Date.now() - 3600000 * 3).toISOString(),
        endTime: new Date(Date.now() - 3600000 * 3 + 1845000).toISOString(),
        exitReason: 'completed'
      }
    ];
    saveVaultToDisk();
    renderAnalytics();
  }

  function saveVaultToDisk() {
    const dataToSave = {
      settings: state.vault.settings,
      sessions: state.vault.sessions
    };
    postMessageToHost({ action: 'saveData', data: dataToSave });
    try {
      localStorage.setItem('studylock_vault_backup', JSON.stringify(dataToSave));
    } catch (e) {}
  }

  function applyLoadedSettings() {
    const s = state.vault.settings;
    if (s.theme) {
      applyTheme(s.theme);
    }
    if (s.securityPassword) {
      const pwdInput = document.getElementById('settings-password');
      if (pwdInput) pwdInput.value = s.securityPassword;
    }
    if (s.accountabilityPledge) {
      const pledgeInput = document.getElementById('settings-pledge');
      const targetPledge = document.getElementById('target-pledge-text');
      if (pledgeInput) pledgeInput.value = s.accountabilityPledge;
      if (targetPledge) targetPledge.textContent = `"${s.accountabilityPledge}"`;
    }
  }

  // -------------------------------------------------------------------------
  // Theme Switching
  // -------------------------------------------------------------------------
  function applyTheme(theme) {
    state.vault.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = `theme-${theme}`;

    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    if (theme === 'day') {
      moonIcon?.classList.add('hidden');
      sunIcon?.classList.remove('hidden');
    } else {
      moonIcon?.classList.remove('hidden');
      sunIcon?.classList.add('hidden');
    }
  }

  function toggleTheme() {
    const nextTheme = state.vault.settings.theme === 'night' ? 'day' : 'night';
    applyTheme(nextTheme);
    saveVaultToDisk();
  }

  // -------------------------------------------------------------------------
  // Navigation Tabs Switching
  // -------------------------------------------------------------------------
  function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    if (tabId === 'analysis') {
      renderAnalytics();
    }
  }

  // -------------------------------------------------------------------------
  // YouTube Link Parser & Embed Formatter
  // -------------------------------------------------------------------------
  function parseYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();

    // Check for Playlist ID
    const playlistMatch = cleanUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    const playlistId = playlistMatch ? playlistMatch[1] : null;

    // Check for Video ID (various formats: youtube.com/watch?v=, youtu.be/, embed/)
    const videoMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const videoId = videoMatch ? videoMatch[1] : null;

    if (videoId) {
      return {
        type: 'video',
        videoId: videoId,
        playlistId: playlistId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0&controls=1${playlistId ? `&list=${playlistId}` : ''}`
      };
    } else if (playlistId) {
      return {
        type: 'playlist',
        videoId: null,
        playlistId: playlistId,
        embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&autoplay=1&enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0&controls=1`
      };
    }

    // Direct 11-char ID fallback
    if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return {
        type: 'video',
        videoId: cleanUrl,
        playlistId: null,
        embedUrl: `https://www.youtube-nocookie.com/embed/${cleanUrl}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0&controls=1`
      };
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Session Lifecycle Management (Start, Tick, Finish, Emergency Unlock)
  // -------------------------------------------------------------------------
  function startSession(options) {
    const { subject, topic, targetMinutes, mode, embedUrl } = options;

    state.activeSession = {
      isActive: true,
      subject: subject || 'Physics',
      topic: topic || 'Self Study & Revision',
      targetMinutes: targetMinutes || 25,
      mode: mode, // 'player' | 'normal' | 'lockin'
      startTime: Date.now(),
      elapsedSeconds: 0,
      timerInterval: null
    };

    // Notify host for keyboard hook & fullscreen if hardcore lockin
    if (mode === 'lockin' || mode === 'player') {
      postMessageToHost({ action: 'setLockIn', enabled: true });
    }

    // Launch appropriate fullscreen UI
    if (mode === 'player') {
      launchPlayerImmersion(embedUrl);
    } else {
      launchDeskClockLayer(mode);
    }

    // Play selected ambient sound
    if (state.ui.selectedSound !== 'none') {
      soundSynth.play(state.ui.selectedSound);
    }

    // Start 1-second precision tick interval
    state.activeSession.timerInterval = setInterval(handleSessionTick, 1000);
    handleSessionTick(); // Immediate first tick
    updateLivePill();
  }

  function handleSessionTick() {
    if (!state.activeSession.isActive) return;

    // Precision calculation from wall-clock Date.now()
    const now = Date.now();
    state.activeSession.elapsedSeconds = Math.max(0, Math.floor((now - state.activeSession.startTime) / 1000));

    // Notify C# host of active session state for emergency failsafe persistence
    postMessageToHost({
      action: 'sessionTick',
      session: {
        subject: state.activeSession.subject,
        topic: state.activeSession.topic,
        elapsedSeconds: state.activeSession.elapsedSeconds,
        startTime: state.activeSession.startTime
      }
    });

    // Update displays
    updateDeskClockDisplay();
    updateFloatingClockDisplay();
    updateLivePill();
    updateAnalysisLiveBanner();
  }

  function updateLivePill() {
    const pill = document.getElementById('live-session-pill');
    const badge = document.getElementById('pill-subject-badge');
    const timerText = document.getElementById('pill-timer-text');
    if (!pill || !badge || !timerText) return;

    if (state.activeSession.isActive) {
      pill.classList.remove('hidden');
      badge.className = `subject-badge badge-${state.activeSession.subject.toLowerCase()}`;
      badge.textContent = state.activeSession.subject;
      timerText.textContent = formatDuration(state.activeSession.elapsedSeconds);
    } else {
      pill.classList.add('hidden');
    }
  }

  function updateAnalysisLiveBanner() {
    const banner = document.getElementById('analysis-live-banner');
    const details = document.getElementById('banner-session-details');
    if (!banner || !details) return;

    if (state.activeSession.isActive) {
      banner.classList.remove('hidden');
      details.textContent = `Studying ${state.activeSession.subject} • ${state.activeSession.topic} • ${formatDuration(state.activeSession.elapsedSeconds)} elapsed`;
    } else {
      banner.classList.add('hidden');
    }
  }

  function launchPlayerImmersion(embedUrl) {
    const layer = document.getElementById('player-immersion-layer');
    const container = document.getElementById('yt-iframe-container');
    const hudSubject = document.getElementById('player-hud-subject');
    const hudTopic = document.getElementById('player-hud-topic');

    if (hudSubject) {
      hudSubject.className = `subject-badge badge-${state.activeSession.subject.toLowerCase()}`;
      hudSubject.textContent = state.activeSession.subject;
    }
    if (hudTopic) {
      hudTopic.textContent = state.activeSession.topic;
    }

    // Default lecture fallback if user entered empty link
    const validUrl = embedUrl || 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0&controls=1';

    if (container) {
      container.innerHTML = `<iframe src="${validUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }

    layer?.classList.remove('hidden');
    setupMouseAutohide(layer);
  }

  function launchDeskClockLayer(mode) {
    const layer = document.getElementById('desk-clock-layer');
    const subjectBadge = document.getElementById('clock-subject-badge');
    const modeTag = document.getElementById('clock-mode-indicator');
    const topicTitle = document.getElementById('clock-topic-title');
    const targetMeta = document.getElementById('clock-target-meta');
    const bgBtn = document.getElementById('clock-background-btn');
    const unlockBtn = document.getElementById('clock-unlock-btn');

    if (subjectBadge) {
      subjectBadge.className = `subject-badge badge-${state.activeSession.subject.toLowerCase()} pulse`;
      subjectBadge.textContent = state.activeSession.subject;
    }
    if (modeTag) {
      if (mode === 'lockin') {
        modeTag.textContent = '🔒 HARDCORE LOCK-IN';
        modeTag.className = 'clock-mode-tag';
        if (bgBtn) bgBtn.style.display = 'none';
        if (unlockBtn) unlockBtn.style.display = 'inline-flex';
      } else {
        modeTag.textContent = '🕒 NORMAL MODE';
        modeTag.className = 'clock-mode-tag mode-badge normal';
        if (bgBtn) bgBtn.style.display = 'inline-flex';
        if (unlockBtn) unlockBtn.style.display = 'none';
      }
    }
    if (topicTitle) {
      topicTitle.textContent = state.activeSession.topic;
    }
    if (targetMeta) {
      targetMeta.textContent = `Target: ${state.activeSession.targetMinutes}m`;
    }

    layer?.classList.remove('hidden');
    setupMouseAutohide(layer);
    updateDeskClockDisplay();
  }

  function updateDeskClockDisplay() {
    const elapsed = state.activeSession.elapsedSeconds;
    const targetSec = state.activeSession.targetMinutes * 60;
    const remaining = Math.max(0, targetSec - elapsed);

    const hrs = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;

    const hrsUnit = document.getElementById('flip-unit-hours');
    const hrsColon = document.getElementById('flip-colon-hours');

    if (hrs > 0) {
      if (hrsUnit) hrsUnit.style.display = 'flex';
      if (hrsColon) hrsColon.style.display = 'block';
      setDigit('digit-hours', String(hrs).padStart(2, '0'));
    } else {
      if (hrsUnit) hrsUnit.style.display = 'none';
      if (hrsColon) hrsColon.style.display = 'none';
    }

    setDigit('digit-mins', String(mins).padStart(2, '0'));
    setDigit('digit-secs', String(secs).padStart(2, '0'));

    // Progress bar fill
    const progressPercent = Math.min(100, (elapsed / targetSec) * 100);
    const progressFill = document.getElementById('clock-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;

    const elapsedMeta = document.getElementById('clock-elapsed-meta');
    if (elapsedMeta) elapsedMeta.textContent = `${formatDuration(elapsed)} elapsed`;
  }

  function setDigit(elementIdPrefix, val) {
    const top = document.getElementById(`${elementIdPrefix}-top`);
    const bottom = document.getElementById(`${elementIdPrefix}-bottom`);
    if (top && top.textContent !== val) top.textContent = val;
    if (bottom && bottom.textContent !== val) bottom.textContent = val;
  }

  function updateFloatingClockDisplay() {
    const elapsed = state.activeSession.elapsedSeconds;
    const targetSec = state.activeSession.targetMinutes * 60;
    const remaining = Math.max(0, targetSec - elapsed);

    const remainingText = document.getElementById('floating-clock-remaining');
    const elapsedText = document.getElementById('floating-clock-elapsed');
    const ringProgress = document.getElementById('floating-ring-progress');

    if (remainingText) remainingText.textContent = formatDuration(remaining);
    if (elapsedText) elapsedText.textContent = `${formatDuration(elapsed)} elapsed`;

    if (ringProgress) {
      const circumference = 2 * Math.PI * 44; // 276.46
      const percent = Math.min(1, elapsed / targetSec);
      const offset = circumference * (1 - percent);
      ringProgress.style.strokeDashoffset = offset;
    }
  }

  // -------------------------------------------------------------------------
  // Finish & Log Session (Absolute Second Precision)
  // -------------------------------------------------------------------------
  function finishAndLogSession(exitReason = 'completed') {
    if (!state.activeSession.isActive) return;

    // Clear timer
    if (state.activeSession.timerInterval) {
      clearInterval(state.activeSession.timerInterval);
      state.activeSession.timerInterval = null;
    }

    soundSynth.stop();

    // Exact elapsed seconds calculation
    const now = Date.now();
    const durationSeconds = Math.max(1, Math.floor((now - state.activeSession.startTime) / 1000));

    const newRecord = {
      id: 'sess_' + Date.now(),
      subject: state.activeSession.subject,
      topic: state.activeSession.topic,
      mode: state.activeSession.mode === 'player' ? 'YouTube Immersion' : (state.activeSession.mode === 'lockin' ? 'Hardcore Lock-In' : 'Normal Clock'),
      durationSeconds: durationSeconds,
      seconds: durationSeconds,
      targetMinutes: state.activeSession.targetMinutes,
      startTime: new Date(state.activeSession.startTime).toISOString(),
      endTime: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      display_time: formatDuration(durationSeconds),
      exitReason: exitReason
    };

    // Absolute Second Precision: Never discard sessions even if 5 seconds or 30 seconds!
    state.vault.sessions.unshift(newRecord);
    saveVaultToDisk();

    // Disengage host lockin
    postMessageToHost({ action: 'setLockIn', enabled: false });
    postMessageToHost({ action: 'sessionEnded' });

    // Close fullscreen layers
    document.getElementById('player-immersion-layer')?.classList.add('hidden');
    document.getElementById('desk-clock-layer')?.classList.add('hidden');
    const container = document.getElementById('yt-iframe-container');
    if (container) container.innerHTML = ''; // Stop video audio

    state.activeSession.isActive = false;
    updateLivePill();
    updateAnalysisLiveBanner();

    // Switch to analysis tab to view recorded session
    switchTab('analysis');
    renderAnalytics();

    showToast(`✅ Session logged to Vault! Studied ${formatDuration(durationSeconds)} of ${newRecord.subject}.`);
  }

  // -------------------------------------------------------------------------
  // Emergency Failsafe Triggered (Ctrl + Alt + Shift + F12)
  // -------------------------------------------------------------------------
  function handleFailsafeTriggered() {
    closeEmergencyModal();
    if (state.activeSession.isActive) {
      finishAndLogSession('failsafe');
      showToast('🛡️ Emergency Hard Failsafe Activated! System unhooked and session saved.');
    } else {
      postMessageToHost({ action: 'setLockIn', enabled: false });
      showToast('🛡️ System restored from failsafe.');
    }
  }

  // -------------------------------------------------------------------------
  // Mouse Autohide for Immersive Fullscreen Layers
  // -------------------------------------------------------------------------
  function setupMouseAutohide(layerElement) {
    if (!layerElement) return;

    function resetIdle() {
      layerElement.classList.remove('idle-hidden');
      if (state.ui.idleTimeout) clearTimeout(state.ui.idleTimeout);

      state.ui.idleTimeout = setTimeout(() => {
        if (state.activeSession.isActive && !layerElement.classList.contains('hidden')) {
          layerElement.classList.add('idle-hidden');
        }
      }, 3000); // 3 seconds of inactivity fades controls
    }

    layerElement.removeEventListener('mousemove', resetIdle);
    layerElement.removeEventListener('mousedown', resetIdle);
    layerElement.removeEventListener('keydown', resetIdle);

    layerElement.addEventListener('mousemove', resetIdle);
    layerElement.addEventListener('mousedown', resetIdle);
    layerElement.addEventListener('keydown', resetIdle);

    resetIdle();
  }

  // -------------------------------------------------------------------------
  // Emergency Unlock Gate Modal
  // -------------------------------------------------------------------------
  function openEmergencyModal() {
    const modal = document.getElementById('emergency-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Reset fields
    const pledgeInput = document.getElementById('pledge-input');
    const pwdInput = document.getElementById('emergency-password-input');
    const pwdError = document.getElementById('password-error-msg');
    const pledgeCounter = document.getElementById('pledge-match-counter');
    const pledgeBadge = document.getElementById('pledge-match-badge');
    const pledgeBtn = document.getElementById('confirm-pledge-unlock-btn');

    if (pledgeInput) pledgeInput.value = '';
    if (pwdInput) pwdInput.value = '';
    if (pwdError) pwdError.classList.add('hidden');

    const targetPledge = state.vault.settings.accountabilityPledge || 'I promise to stay disciplined and return to my studies';
    if (pledgeCounter) pledgeCounter.textContent = `0 / ${targetPledge.length} characters matched`;
    if (pledgeBadge) {
      pledgeBadge.textContent = 'Incomplete';
      pledgeBadge.className = 'badge-incomplete';
    }
    if (pledgeBtn) pledgeBtn.disabled = true;

    // Switch to pledge tab by default
    switchModalTab('pledge');
  }

  function closeEmergencyModal() {
    document.getElementById('emergency-modal')?.classList.add('hidden');
  }

  function switchModalTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-modal-tab') === tabName);
    });
    document.getElementById('modal-tab-pledge')?.classList.toggle('active', tabName === 'pledge');
    document.getElementById('modal-tab-password')?.classList.toggle('active', tabName === 'password');
  }

  function handlePledgeInput() {
    const input = document.getElementById('pledge-input');
    const counter = document.getElementById('pledge-match-counter');
    const badge = document.getElementById('pledge-match-badge');
    const confirmBtn = document.getElementById('confirm-pledge-unlock-btn');
    if (!input || !counter || !badge || !confirmBtn) return;

    const typed = input.value;
    const target = state.vault.settings.accountabilityPledge || 'I promise to stay disciplined and return to my studies';

    let matchedChars = 0;
    for (let i = 0; i < typed.length && i < target.length; i++) {
      if (typed[i] === target[i]) matchedChars++;
      else break;
    }

    counter.textContent = `${matchedChars} / ${target.length} characters matched`;

    if (typed.trim() === target.trim()) {
      badge.textContent = 'Matched! Ready to unlock';
      badge.className = 'badge-complete';
      confirmBtn.disabled = false;
    } else {
      badge.textContent = 'Incomplete';
      badge.className = 'badge-incomplete';
      confirmBtn.disabled = true;
    }
  }

  function handlePasswordUnlock() {
    const pwdInput = document.getElementById('emergency-password-input');
    const pwdError = document.getElementById('password-error-msg');
    if (!pwdInput) return;

    const entered = pwdInput.value.trim();
    const target = state.vault.settings.securityPassword || 'unlock123';

    if (entered === target) {
      closeEmergencyModal();
      finishAndLogSession('emergency_password');
    } else {
      if (pwdError) {
        pwdError.classList.remove('hidden');
        pwdInput.classList.add('shake');
        setTimeout(() => pwdInput.classList.remove('shake'), 400);
      }
    }
  }

  // -------------------------------------------------------------------------
  // PILLAR 3: Study Analytics Vault Computation & Rendering
  // -------------------------------------------------------------------------
  function renderAnalytics() {
    const sessions = state.vault.sessions || [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Calculate start of current week (Monday)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();

    let todaySec = 0;
    let todaySessionsCount = 0;
    let weekSec = 0;
    let allTimeSec = 0;

    const subjectTotals = { Physics: 0, Chemistry: 0, Maths: 0, Productivity: 0 };
    const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // Mon = 0, Sun = 6

    const studyDates = new Set();

    sessions.forEach(s => {
      const sTime = s.startTime ? new Date(s.startTime).getTime() : (s.date ? new Date(s.date).getTime() : Date.now());
      const dur = Number(s.durationSeconds || s.seconds) || 0;

      allTimeSec += dur;

      // Date key for streak
      const dateKey = s.date || (s.startTime ? new Date(s.startTime).toDateString() : new Date().toDateString());
      studyDates.add(dateKey);

      // Subject breakdown
      if (subjectTotals.hasOwnProperty(s.subject)) {
        subjectTotals[s.subject] += dur;
      } else {
        subjectTotals.Productivity += dur;
      }

      // Today
      if (sTime >= todayStart) {
        todaySec += dur;
        todaySessionsCount++;
      }

      // This week
      if (sTime >= weekStart) {
        weekSec += dur;
        const sDay = (new Date(s.startTime).getDay() + 6) % 7;
        dayTotals[sDay] += dur;
      }
    });

    // Compute Streak
    let streak = 0;
    let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (studyDates.has(checkDate.toDateString())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Update KPI Card Displays
    setText('kpi-today', formatDuration(todaySec));
    setText('kpi-today-sessions', `${todaySessionsCount} session${todaySessionsCount === 1 ? '' : 's'} logged`);
    setText('kpi-week', formatDuration(weekSec));
    setText('kpi-alltime', formatDuration(allTimeSec));
    setText('kpi-streak', `${streak} Day${streak === 1 ? '' : 's'}`);
    setText('kpi-total-sessions', sessions.length);

    // Render Donut Chart
    renderDonutChart(subjectTotals, allTimeSec);

    // Render Weekly Histogram Capsules
    renderWeeklyHistogram(dayTotals, dayOfWeek);

    // Render Vault Table
    renderVaultTable(sessions);
  }

  function renderDonutChart(subjectTotals, totalSec) {
    const svg = document.getElementById('subject-donut-svg');
    const totalHoursLabel = document.getElementById('donut-total-hours');
    const barsList = document.getElementById('subject-bars-list');
    if (!svg || !barsList) return;

    if (totalHoursLabel) {
      if (totalSec < 3600) {
        totalHoursLabel.textContent = formatDuration(totalSec);
      } else {
        totalHoursLabel.textContent = `${(totalSec / 3600).toFixed(1)}h`;
      }
    }

    // Colors mapping
    const subjectColors = {
      Physics: '#38bdf8',
      Chemistry: '#f59e0b',
      Maths: '#c084fc',
      Productivity: '#34d399'
    };

    const circumference = 2 * Math.PI * 38; // 238.76
    let accumulatedOffset = 0;

    // Clear previous segments except background ring
    const existingSegments = svg.querySelectorAll('.donut-segment');
    existingSegments.forEach(el => el.remove());

    barsList.innerHTML = '';

    const subjects = ['Physics', 'Chemistry', 'Maths', 'Productivity'];

    subjects.forEach(sub => {
      const sec = subjectTotals[sub] || 0;
      const pct = totalSec > 0 ? (sec / totalSec) : 0;
      const dashLength = circumference * pct;

      if (pct > 0) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', '38');
        circle.setAttribute('class', 'donut-segment');
        circle.setAttribute('stroke', subjectColors[sub]);
        circle.setAttribute('stroke-dasharray', `${dashLength} ${circumference}`);
        circle.setAttribute('stroke-dashoffset', `-${accumulatedOffset}`);
        svg.appendChild(circle);

        accumulatedOffset += dashLength;
      }

      // Bar row in list
      const pctDisplay = (pct * 100).toFixed(0);
      const row = document.createElement('div');
      row.className = 'subject-bar-row';
      row.innerHTML = `
        <div class="subject-bar-header">
          <span style="color: ${subjectColors[sub]}">${sub} (${pctDisplay}%)</span>
          <span class="small-text font-mono">${formatDuration(sec)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pctDisplay}%; background-color: ${subjectColors[sub]}"></div>
        </div>
      `;
      barsList.appendChild(row);
    });
  }

  function renderWeeklyHistogram(dayTotals, currentDayIndex) {
    const container = document.getElementById('weekly-histogram');
    if (!container) return;
    container.innerHTML = '';

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const maxVal = Math.max(3600, ...dayTotals); // Scale to at least 1 hr or max day

    dayNames.forEach((name, idx) => {
      const sec = dayTotals[idx];
      const percent = Math.min(100, Math.max(4, (sec / maxVal) * 100));
      const isToday = idx === currentDayIndex;

      const col = document.createElement('div');
      col.className = `histogram-col ${isToday ? 'is-today' : ''}`;
      col.innerHTML = `
        <div class="histogram-track ${isToday ? 'today-col' : ''}" title="${name}: ${formatDuration(sec)}">
          <div class="histogram-fill" style="height: ${percent}%"></div>
        </div>
        <div class="histogram-day-label">${name}</div>
        <div class="histogram-duration-label">${formatDuration(sec)}</div>
      `;
      container.appendChild(col);
    });
  }

  function renderVaultTable(sessions) {
    const tbody = document.getElementById('vault-table-body');
    const emptyState = document.getElementById('vault-empty-state');
    const countBadge = document.getElementById('vault-count');
    const searchFilter = document.getElementById('vault-search-input')?.value.toLowerCase().trim() || '';
    const subjectFilter = document.getElementById('vault-filter-subject')?.value || 'ALL';

    if (!tbody || !emptyState) return;

    tbody.innerHTML = '';

    const filtered = sessions.filter(s => {
      const matchesSearch = !searchFilter || s.topic.toLowerCase().includes(searchFilter) || s.subject.toLowerCase().includes(searchFilter);
      const matchesSubject = subjectFilter === 'ALL' || s.subject === subjectFilter;
      return matchesSearch && matchesSubject;
    });

    if (countBadge) {
      countBadge.textContent = `${sessions.length} session${sessions.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    filtered.forEach(s => {
      const tr = document.createElement('tr');
      const formattedDate = (s.date && s.time) ? `${s.date} • ${s.time}` : formatDateTime(s.startTime);
      const exactSeconds = Number(s.durationSeconds || s.seconds) || 0;
      tr.innerHTML = `
        <td><span class="subject-badge badge-${(s.subject || 'physics').toLowerCase()}">${s.subject || 'Physics'}</span></td>
        <td><strong>${escapeHtml(s.topic || 'Untitled Study Session')}</strong></td>
        <td><span class="mode-pill">${s.mode || 'Desk Clock'}</span></td>
        <td class="duration-cell">${formatDuration(exactSeconds)}</td>
        <td>${formattedDate}</td>
        <td>
          <button class="pill-btn danger delete-session-btn" data-id="${s.id}" title="Delete session">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach delete listeners
    tbody.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        deleteSession(id);
      });
    });
  }

  function deleteSession(sessionId) {
    state.vault.sessions = state.vault.sessions.filter(s => s.id !== sessionId);
    saveVaultToDisk();
    renderAnalytics();
    showToast('Session removed from Vault.');
  }

  // -------------------------------------------------------------------------
  // Helper Formatting Functions (Absolute Second Precision)
  // -------------------------------------------------------------------------
  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    if (s < 60) {
      return `${s}s`;
    }
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    if (mins < 60) {
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  }

  function formatDateTime(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  // -------------------------------------------------------------------------
  // Event Bindings & Initialization
  // -------------------------------------------------------------------------
  function setupEventListeners() {
    // Window Controls
    document.getElementById('win-min-btn')?.addEventListener('click', () => postMessageToHost({ action: 'minimize' }));
    document.getElementById('win-max-btn')?.addEventListener('click', () => postMessageToHost({ action: 'maximize' }));
    document.getElementById('win-close-btn')?.addEventListener('click', () => postMessageToHost({ action: 'close' }));

    // Drag Window from header
    const dragRegion = document.getElementById('drag-region');
    if (dragRegion) {
      dragRegion.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        postMessageToHost({ action: 'dragWindow' });
      });
    }

    // Theme Toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

    // Nav Tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // Live Pill Actions
    document.getElementById('pill-view-btn')?.addEventListener('click', () => {
      if (state.activeSession.isActive) {
        if (state.activeSession.mode === 'player') {
          document.getElementById('player-immersion-layer')?.classList.remove('hidden');
        } else {
          document.getElementById('desk-clock-layer')?.classList.remove('hidden');
        }
      }
    });

    document.getElementById('pill-finish-btn')?.addEventListener('click', () => {
      finishAndLogSession('normal');
    });

    // Analysis Live Banner Actions
    document.getElementById('banner-open-clock-btn')?.addEventListener('click', () => {
      if (state.activeSession.mode === 'player') {
        document.getElementById('player-immersion-layer')?.classList.remove('hidden');
      } else {
        document.getElementById('desk-clock-layer')?.classList.remove('hidden');
      }
    });

    document.getElementById('banner-finish-btn')?.addEventListener('click', () => {
      finishAndLogSession('normal');
    });

    // --------------------------------------------------
    // Pillar 1: Study Player Event Listeners
    // --------------------------------------------------
    const ytUrlInput = document.getElementById('yt-url-input');
    const ytStatus = document.getElementById('yt-url-status');
    const previewBox = document.getElementById('yt-preview-box');

    function checkYtUrl() {
      const val = ytUrlInput?.value.trim() || '';
      const parsed = parseYouTubeUrl(val);
      if (parsed) {
        if (ytStatus) {
          ytStatus.textContent = `✓ Valid YouTube ${parsed.type === 'playlist' ? 'Playlist' : 'Lecture'} Detected!`;
          ytStatus.style.color = 'var(--success-color)';
        }
        if (previewBox) {
          if (parsed.videoId) {
            previewBox.innerHTML = `<img src="https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg" style="width:100%; height:100%; object-fit:cover;" alt="Lecture Preview">`;
          } else {
            previewBox.innerHTML = `<div class="preview-placeholder"><span>✓ Valid Playlist Ready</span></div>`;
          }
        }
      } else if (val.length > 0) {
        if (ytStatus) {
          ytStatus.textContent = 'Checking URL... Enter full link or video ID';
          ytStatus.style.color = 'var(--text-muted)';
        }
      }
    }

    ytUrlInput?.addEventListener('input', checkYtUrl);

    document.getElementById('paste-yt-btn')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (ytUrlInput && text) {
          ytUrlInput.value = text;
          checkYtUrl();
        }
      } catch (e) {
        showToast('Please press Ctrl+V to paste link directly.');
      }
    });

    // Player Subject Chips
    document.querySelectorAll('#player-subject-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#player-subject-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.ui.playerSubject = chip.getAttribute('data-subject');
      });
    });

    // Player Duration Presets
    document.querySelectorAll('#player-duration-presets .preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#player-duration-presets .preset-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const mins = parseInt(pill.getAttribute('data-minutes'), 10);
        state.ui.playerTargetMinutes = mins;
        const input = document.getElementById('player-custom-minutes');
        if (input) input.value = mins;
      });
    });

    // Player Steppers
    document.getElementById('player-sub-15')?.addEventListener('click', () => adjustMinutes('player', -15));
    document.getElementById('player-sub-5')?.addEventListener('click', () => adjustMinutes('player', -5));
    document.getElementById('player-add-5')?.addEventListener('click', () => adjustMinutes('player', 5));
    document.getElementById('player-add-15')?.addEventListener('click', () => adjustMinutes('player', 15));
    document.getElementById('player-custom-minutes')?.addEventListener('change', (e) => {
      const val = Math.max(1, parseInt(e.target.value, 10) || 45);
      state.ui.playerTargetMinutes = val;
    });

    // Launch Study Player
    document.getElementById('launch-player-btn')?.addEventListener('click', () => {
      const url = ytUrlInput?.value.trim() || '';
      const topic = document.getElementById('player-topic-input')?.value.trim() || 'Rotational Motion Lecture';
      const parsed = parseYouTubeUrl(url);

      startSession({
        subject: state.ui.playerSubject,
        topic: topic,
        targetMinutes: state.ui.playerTargetMinutes,
        mode: 'player',
        embedUrl: parsed ? parsed.embedUrl : null
      });
    });

    // Player Controls
    document.getElementById('player-finish-btn')?.addEventListener('click', () => finishAndLogSession('completed'));
    document.getElementById('player-unlock-btn')?.addEventListener('click', openEmergencyModal);
    document.getElementById('floating-finish-btn')?.addEventListener('click', () => finishAndLogSession('completed'));
    document.getElementById('floating-unlock-btn')?.addEventListener('click', openEmergencyModal);

    // --------------------------------------------------
    // Pillar 2: Focus Timer Event Listeners
    // --------------------------------------------------
    // Timer Subject Chips
    document.querySelectorAll('#timer-subject-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#timer-subject-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.ui.timerSubject = chip.getAttribute('data-subject');
      });
    });

    // Timer Duration Presets
    document.querySelectorAll('#timer-duration-presets .preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#timer-duration-presets .preset-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const mins = parseInt(pill.getAttribute('data-minutes'), 10);
        state.ui.timerTargetMinutes = mins;
        const input = document.getElementById('timer-custom-minutes');
        if (input) input.value = mins;
      });
    });

    // Timer Steppers
    document.getElementById('timer-sub-15')?.addEventListener('click', () => adjustMinutes('timer', -15));
    document.getElementById('timer-sub-5')?.addEventListener('click', () => adjustMinutes('timer', -5));
    document.getElementById('timer-add-5')?.addEventListener('click', () => adjustMinutes('timer', 5));
    document.getElementById('timer-add-15')?.addEventListener('click', () => adjustMinutes('timer', 15));
    document.getElementById('timer-custom-minutes')?.addEventListener('change', (e) => {
      const val = Math.max(1, parseInt(e.target.value, 10) || 25);
      state.ui.timerTargetMinutes = val;
    });

    // Timer Mode Selector
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.ui.timerMode = card.getAttribute('data-mode'); // 'normal' | 'lockin'
      });
    });

    // Sound Chips
    document.querySelectorAll('.sound-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.sound-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const sound = chip.getAttribute('data-sound');
        state.ui.selectedSound = sound;
        soundSynth.play(sound);
      });
    });

    // Launch Desk Clock Session
    document.getElementById('launch-timer-btn')?.addEventListener('click', () => {
      const topic = document.getElementById('timer-topic-input')?.value.trim() || 'Offline Study & Problem Solving';
      startSession({
        subject: state.ui.timerSubject,
        topic: topic,
        targetMinutes: state.ui.timerTargetMinutes,
        mode: state.ui.timerMode
      });
    });

    // Desk Clock Actions
    document.getElementById('clock-background-btn')?.addEventListener('click', () => {
      // Normal mode: Student keeps session ticking in background to use PDFs/Calculators
      document.getElementById('desk-clock-layer')?.classList.add('hidden');
      updateLivePill();
      showToast('Desk Clock running in background. Use live pill to return.');
    });

    document.getElementById('clock-finish-btn')?.addEventListener('click', () => finishAndLogSession('completed'));
    document.getElementById('clock-unlock-btn')?.addEventListener('click', openEmergencyModal);

    // Sound toggle in desk clock
    document.getElementById('clock-sound-btn')?.addEventListener('click', () => {
      const sounds = ['none', 'tick', 'rain', 'brown'];
      const nextIdx = (sounds.indexOf(state.ui.selectedSound) + 1) % sounds.length;
      const nextSound = sounds[nextIdx];
      state.ui.selectedSound = nextSound;
      soundSynth.play(nextSound);

      const label = document.getElementById('clock-sound-label');
      const icon = document.getElementById('clock-sound-icon');
      if (label && icon) {
        const icons = { none: '🔇', tick: '⏱️', rain: '🌧️', brown: '🌊' };
        icon.textContent = icons[nextSound];
        label.textContent = `Sound: ${nextSound.charAt(0).toUpperCase() + nextSound.slice(1)}`;
      }
    });

    // --------------------------------------------------
    // Modal Listeners
    // --------------------------------------------------
    // Emergency Modal Tabs
    document.getElementById('tab-pledge-btn')?.addEventListener('click', () => switchModalTab('pledge'));
    document.getElementById('tab-password-btn')?.addEventListener('click', () => switchModalTab('password'));
    document.getElementById('cancel-emergency-btn')?.addEventListener('click', closeEmergencyModal);

    // Pledge Typing Input
    document.getElementById('pledge-input')?.addEventListener('input', handlePledgeInput);
    document.getElementById('confirm-pledge-unlock-btn')?.addEventListener('click', () => {
      closeEmergencyModal();
      finishAndLogSession('emergency_pledge');
    });

    // Password Unlock
    document.getElementById('confirm-password-unlock-btn')?.addEventListener('click', handlePasswordUnlock);
    document.getElementById('emergency-password-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlePasswordUnlock();
    });

    // Settings Modal
    document.getElementById('settings-open-btn')?.addEventListener('click', () => {
      document.getElementById('settings-modal')?.classList.remove('hidden');
    });
    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
      document.getElementById('settings-modal')?.classList.add('hidden');
    });
    document.getElementById('save-settings-btn')?.addEventListener('click', () => {
      const pwd = document.getElementById('settings-password')?.value.trim();
      const pledge = document.getElementById('settings-pledge')?.value.trim();
      if (pwd) state.vault.settings.securityPassword = pwd;
      if (pledge) state.vault.settings.accountabilityPledge = pledge;
      saveVaultToDisk();
      applyLoadedSettings();
      document.getElementById('settings-modal')?.classList.add('hidden');
      showToast('Settings saved successfully!');
    });

    // Data Management
    document.getElementById('vault-export-btn')?.addEventListener('click', exportVaultJson);
    document.getElementById('settings-export-btn')?.addEventListener('click', exportVaultJson);
    
    document.getElementById('settings-import-btn')?.addEventListener('click', () => {
      document.getElementById('settings-file-input')?.click();
    });

    document.getElementById('settings-file-input')?.addEventListener('change', importVaultJson);

    document.getElementById('settings-clear-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all logged study sessions? This cannot be undone.')) {
        state.vault.sessions = [];
        saveVaultToDisk();
        renderAnalytics();
        showToast('All sessions cleared.');
      }
    });

    // Vault Filtering
    document.getElementById('vault-search-input')?.addEventListener('input', () => renderVaultTable(state.vault.sessions));
    document.getElementById('vault-filter-subject')?.addEventListener('change', () => renderVaultTable(state.vault.sessions));
  }

  function adjustMinutes(prefix, delta) {
    const input = document.getElementById(`${prefix}-custom-minutes`);
    if (!input) return;
    let current = parseInt(input.value, 10) || 25;
    current = Math.max(1, Math.min(600, current + delta));
    input.value = current;

    if (prefix === 'player') state.ui.playerTargetMinutes = current;
    if (prefix === 'timer') state.ui.timerTargetMinutes = current;

    // Deselect preset pills if not matching
    document.querySelectorAll(`#${prefix}-duration-presets .preset-pill`).forEach(pill => {
      const m = parseInt(pill.getAttribute('data-minutes'), 10);
      pill.classList.toggle('active', m === current);
    });
  }

  function exportVaultJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      settings: state.vault.settings,
      sessions: state.vault.sessions
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `studylock_vault_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Vault exported to JSON backup.');
  }

  function importVaultJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && Array.isArray(parsed.sessions)) {
          state.vault.sessions = parsed.sessions;
          if (parsed.settings) state.vault.settings = { ...state.vault.settings, ...parsed.settings };
          saveVaultToDisk();
          renderAnalytics();
          showToast(`Successfully imported ${parsed.sessions.length} sessions!`);
        } else {
          showToast('Invalid backup file format.');
        }
      } catch (err) {
        showToast('Error reading JSON file.');
      }
    };
    reader.readAsText(file);
  }

  // -------------------------------------------------------------------------
  // Initialization on DOMContentLoaded
  // -------------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    initStarfield();
    setupHostListeners();
    setupEventListeners();
    renderAnalytics();
  });

})();
