const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('synchronAPI', {
  // Auth
  signUp: (email, password, displayName) => ipcRenderer.invoke('auth:signup', email, password, displayName),
  login: (email, password) => ipcRenderer.invoke('auth:login', email, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:user'),
  updateProfile: (updates) => ipcRenderer.invoke('auth:updateProfile', updates),

  // Profile
  changeDisplayName: (newName) => ipcRenderer.invoke('profile:changeName', newName),

  // Chat
  getChatMessages: (channel) => ipcRenderer.invoke('chat:getMessages', channel),
  sendChatMessage: (channel, content) => ipcRenderer.invoke('chat:send', channel, content),
  getDirectMessages: (friendId) => ipcRenderer.invoke('chat:getDMs', friendId),
  sendDirectMessage: (receiverId, content) => ipcRenderer.invoke('chat:sendDM', receiverId, content),
  subscribeChatChannel: (channel) => ipcRenderer.invoke('chat:subscribeChannel', channel),
  subscribeDMChannel: (friendId) => ipcRenderer.invoke('chat:subscribeDM', friendId),
  unsubscribeChat: () => ipcRenderer.invoke('chat:unsubscribe'),
  onChatMessage: (callback) => {
    ipcRenderer.on('chat:newMessage', (event, data) => callback(data));
  },
  onDirectMessage: (callback) => {
    ipcRenderer.on('chat:newDM', (event, data) => callback(data));
  },

  // Community
  getCommunityProjects: (filter, sort) => ipcRenderer.invoke('community:getProjects', filter, sort),
  submitCommunityProject: (title, desc, url, cat) => ipcRenderer.invoke('community:submit', title, desc, url, cat),
  voteCommunityProject: (projectId, voteType) => ipcRenderer.invoke('community:vote', projectId, voteType),
  getUserVotes: () => ipcRenderer.invoke('community:getUserVotes'),
  getProjectComments: (projectId) => ipcRenderer.invoke('community:getComments', projectId),
  addProjectComment: (projectId, content) => ipcRenderer.invoke('community:addComment', projectId, content),
  deleteCommunityProject: (projectId) => ipcRenderer.invoke('community:delete', projectId),

  // Friends
  searchUsers: (query) => ipcRenderer.invoke('friends:search', query),
  getFriends: () => ipcRenderer.invoke('friends:list'),
  sendFriendRequest: (addresseeId) => ipcRenderer.invoke('friends:request', addresseeId),
  respondFriendRequest: (friendshipId, accept) => ipcRenderer.invoke('friends:respond', friendshipId, accept),
  removeFriend: (friendshipId) => ipcRenderer.invoke('friends:remove', friendshipId),
  getFriendActivity: (friendId, date) => ipcRenderer.invoke('friends:activity', friendId, date),
  getFriendStats: (friendId, startDate, endDate) => ipcRenderer.invoke('friends:stats', friendId, startDate, endDate),

  // Presence
  getOnlineFriends: () => ipcRenderer.invoke('presence:getOnlineFriends'),
  getCommunityStats: () => ipcRenderer.invoke('presence:communityStats'),
  onPresenceSync: (callback) => {
    ipcRenderer.on('presence:sync', (event, data) => callback(data));
  },
  onPresenceJoin: (callback) => {
    ipcRenderer.on('presence:join', (event, data) => callback(data));
  },
  onPresenceLeave: (callback) => {
    ipcRenderer.on('presence:leave', (event, data) => callback(data));
  },

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
  setCategoryOverride: (appPattern, category) => ipcRenderer.invoke('settings:setCategoryOverride', appPattern, category),

  // Game state
  getGameState: () => ipcRenderer.invoke('game:get'),
  setGameState: (state) => ipcRenderer.invoke('game:set', state),

  // App actions
  openFolder: () => ipcRenderer.invoke('app:openFolder'),
  openInVSCode: (projPath) => ipcRenderer.invoke('app:openInVSCode', projPath),
  openTerminal: (projPath) => ipcRenderer.invoke('app:openTerminal', projPath),
  exportData: () => ipcRenderer.invoke('app:exportData'),
  clearHistory: () => ipcRenderer.invoke('app:clearHistory'),

  // Privacy & Consent
  getConsent: () => ipcRenderer.invoke('privacy:getConsent'),
  acceptConsent: () => ipcRenderer.invoke('privacy:acceptConsent'),
  getPrivacySettings: () => ipcRenderer.invoke('privacy:getSettings'),
  setPrivacySettings: (settings) => ipcRenderer.invoke('privacy:setSettings', settings),
  deleteAccount: () => ipcRenderer.invoke('app:deleteAccount'),
  openExternalLink: (url) => ipcRenderer.invoke('app:openExternal', url),

  getAppVersion: () => ipcRenderer.invoke('app:version'),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update:status', (event, data) => callback(data));
  },

  isElectron: true
});
