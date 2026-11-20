const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStudyData: () => ipcRenderer.invoke('get-study-data'),
  saveStudySession: (session) => ipcRenderer.invoke('save-study-session', session),
  deleteSession: (id) => ipcRenderer.invoke('delete-session', id),
  deleteSessionsOlderThan: (days) => ipcRenderer.invoke('delete-sessions-older-than', days),
  clearAllSessions: () => ipcRenderer.invoke('clear-all-sessions'),
  setActiveSession: (info) => ipcRenderer.invoke('set-active-session', info),
  clearActiveSession: () => ipcRenderer.invoke('clear-active-session'),
  setLockIn: (enabled) => ipcRenderer.invoke('set-lock-in', enabled),
  setFloatingWidgetMode: (enabled) => ipcRenderer.invoke('set-floating-widget-mode', enabled),
  openRaySenseiLogin: () => ipcRenderer.invoke('open-raysensei-login'),
  startRaySenseiBrowserAuth: () => ipcRenderer.invoke('start-raysensei-browser-auth'),
  checkRaySenseiAuthStatus: () => ipcRenderer.invoke('check-raysensei-auth-status'),
  injectRaySenseiSession: (sessionData) => ipcRenderer.invoke('inject-raysensei-session', sessionData),
  onRaySenseiAuthSuccess: (callback) => ipcRenderer.on('raysensei-auth-success', (event, data) => callback(data)),
  
  // Window management
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Hardware Panic Chord Listener
  onEmergencyChord: (callback) => {
    ipcRenderer.on('emergency-chord-triggered', () => callback());
  },

  // Global Session Input Listeners (Bypasses Guest Webviews)
  onToggleParentProof: (callback) => {
    ipcRenderer.on('toggle-parent-proof-global', () => callback());
  },
  onSwitchWorkspace: (callback) => {
    ipcRenderer.on('switch-workspace-global', (event, index) => callback(index));
  }
});
