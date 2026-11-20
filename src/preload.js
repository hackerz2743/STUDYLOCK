const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStudyData: () => ipcRenderer.invoke('get-study-data'),
  saveStudySession: (session) => ipcRenderer.invoke('save-study-session', session),
  deleteSession: (id) => ipcRenderer.invoke('delete-session', id),
  deleteSessionsOlderThan: (days) => ipcRenderer.invoke('delete-sessions-older-than', days),
  clearAllSessions: () => ipcRenderer.invoke('clear-all-sessions'),
  getStudyTasks: () => ipcRenderer.invoke('get-study-tasks'),
  saveStudyTasks: (tasks) => ipcRenderer.invoke('save-study-tasks', tasks),
  setActiveSession: (info) => ipcRenderer.invoke('set-active-session', info),
  clearActiveSession: () => ipcRenderer.invoke('clear-active-session'),
  setLockIn: (enabled) => ipcRenderer.invoke('set-lock-in', enabled),
  setFloatingWidgetMode: (enabled) => ipcRenderer.invoke('set-floating-widget-mode', enabled),
  
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

  // Study Squad Multiplayer API
  squadSignup: (data) => ipcRenderer.invoke('squad-signup', data),
  squadLogin: (data) => ipcRenderer.invoke('squad-login', data),
  squadLogout: () => ipcRenderer.invoke('squad-logout'),
  squadGetProfile: () => ipcRenderer.invoke('squad-get-profile'),
  squadUpdateStatus: (status) => ipcRenderer.invoke('squad-update-status', status),
  squadAddFriend: (username) => ipcRenderer.invoke('squad-add-friend', username),
  squadRemoveFriend: (friendId) => ipcRenderer.invoke('squad-remove-friend', friendId),
  squadGetFriends: () => ipcRenderer.invoke('squad-get-friends'),
  onSquadProfileUpdated: (callback) => ipcRenderer.on('squad-profile-updated', (event, profile) => callback(profile)),
  onSquadFriendsUpdated: (callback) => ipcRenderer.on('squad-friends-updated', () => callback())
});
