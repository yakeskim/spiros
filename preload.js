const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('synchronAPI', {
  // Auth
  signUp: (email, password, displayName) => ipcRenderer.invoke('auth:signup', email, password, displayName),
  login: (email, password) => ipcRenderer.invoke('auth:login', email, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:user'),
  updateProfile: (updates) => ipcRenderer.invoke('auth:updateProfile', updates),

  // Friends
  searchUsers: (query) => ipcRenderer.invoke('friends:search', query),
  getFriends: () => ipcRenderer.invoke('friends:list'),
  sendFriendRequest: (addresseeId) => ipcRenderer.invoke('friends:request', addresseeId),
  respondFriendRequest: (friendshipId, accept) => ipcRenderer.invoke('friends:respond', friendshipId, accept),
  removeFriend: (friendshipId) => ipcRenderer.invoke('friends:remove', friendshipId),
  getFriendActivity: (friendId, date) => ipcRenderer.invoke('friends:activity', friendId, date),
  getFriendStats: (friendId, startDate, endDate) => ipcRenderer.invoke('friends:stats', friendId, startDate, endDate),

  // Sync
  syncNow: () => ipcRenderer.invoke('sync:now'),

  // Tracker
  startTracking: () => ipcRenderer.invoke('tracker:start'),
  stopTracking: () => ipcRenderer.invoke('tracker:stop'),
  getTrackingStatus: () => ipcRenderer.invoke('tracker:status'),
  getToday: () => ipcRenderer.invoke('tracker:today'),
  getRange: (startDate, endDate) => ipcRenderer.invoke('tracker:range', startDate, endDate),
  onActivityUpdate: (callback) => {
    ipcRenderer.on('activity:update', (event, entry) => callback(entry));
  },

  // Projects
  scanProjects: (folder) => ipcRenderer.invoke('projects:scan', folder),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),

  // Game state
  getGameState: () => ipcRenderer.invoke('game:get'),
  setGameState: (state) => ipcRenderer.invoke('game:set', state),

  // App actions
  openFolder: () => ipcRenderer.invoke('app:openFolder'),
  openInVSCode: (projPath) => ipcRenderer.invoke('app:openInVSCode', projPath),
  openTerminal: (projPath) => ipcRenderer.invoke('app:openTerminal', projPath),
  exportData: () => ipcRenderer.invoke('app:exportData'),
  clearHistory: () => ipcRenderer.invoke('app:clearHistory'),

  isElectron: true
});
