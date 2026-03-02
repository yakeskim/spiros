// chat.js — Live Chat: category channels + friend DMs with Supabase Realtime + Reactions

const Chat = (() => {
  const CHANNELS = ['General', 'Coding', 'Creative', 'Off-Topic'];
  const CHANNEL_ICONS = { General: '💬', Coding: '💻', Creative: '🎨', 'Off-Topic': '🎲' };
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '💯', '⚔'];

  let activeTab = 'channel'; // 'channel' | 'dm'
  let activeChannel = 'General';
  let activeDMFriend = null; // { id, display_name }
  let messages = [];
  let friends = [];
  let reactions = {}; // { messageId: { emoji: { count, mine } } }
  let _container = null;
  let _currentUserId = null;
  let _pickerCloseHandler = null;

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (isToday) return time;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time;
  }

  async function render(container) {
    _container = container;

    try {
      const data = await spirosAPI.getFriends();
      const { user } = await spirosAPI.getUser();
      if (user) {
        _currentUserId = user.id;
        friends = (data.friends || []).map(f => {
          const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
          return { id: otherId, ...f.profile };
        });
      } else {
        friends = [];
      }
    } catch (_) { friends = []; }

    buildDOM(container);
    wireEvents(container);
    await loadMessages();
  }

  function buildDOM(container) {
    const hasChannels = window.requiresTier && window.requiresTier('starter');
    const hasDMs = window.requiresTier && window.requiresTier('pro');

    container.innerHTML = `
      <div class="chat-page">
        <div class="chat-page-header">
          <h2 class="page-title">Chat</h2>
        </div>
        <div class="chat-layout">
          <div class="chat-sidebar">
            <div class="chat-sidebar-section">
              <div class="chat-sidebar-title">Channels</div>
              ${CHANNELS.map(ch => {
                const locked = !hasChannels && ch !== 'General';
                return `
                <button class="chat-channel-btn ${activeTab === 'channel' && activeChannel === ch ? 'active' : ''}${locked ? ' chat-locked' : ''}" data-channel="${escapeHtml(ch)}" ${locked ? 'data-locked="true"' : ''}>
                  <span class="chat-channel-icon">${locked ? '&#x1F512;' : (CHANNEL_ICONS[ch] || '📦')}</span>
                  <span>${escapeHtml(ch)}</span>
                </button>
              `}).join('')}
            </div>
            <div class="chat-sidebar-section">
              <div class="chat-sidebar-title">Direct Messages</div>
              ${!hasDMs
                ? '<div style="font-size:var(--font-size-base);color:var(--gold);padding:4px;cursor:pointer" id="chat-dm-upgrade">&#x1F512; Upgrade to Pro for DMs</div>'
                : (friends.length === 0
                  ? '<div style="font-size:var(--font-size-base);color:var(--text-dim);padding:4px">No friends yet</div>'
                  : friends.map(f => `
                    <button class="chat-dm-item ${activeTab === 'dm' && activeDMFriend?.id === f.id ? 'active' : ''}" data-dm-id="${f.id}" data-dm-name="${escapeHtml(f.display_name || 'Unknown')}">
                      <span class="chat-dm-avatar">${escapeHtml((f.display_name || '?').charAt(0).toUpperCase())}</span>
                      <span>${escapeHtml(f.display_name || 'Unknown')}</span>
                    </button>
                  `).join(''))
              }
            </div>
          </div>
          <div class="chat-main">
            <div class="chat-header" id="chat-header">
              ${getHeaderText()}
            </div>
            <div class="chat-messages" id="chat-messages">
              ${renderMessages()}
            </div>
            <div class="chat-input-bar">
              <input type="text" id="chat-input" class="input-pixel" placeholder="Type a message..." maxlength="500">
              <button class="btn-pixel btn-sm" id="btn-chat-send">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getHeaderText() {
    if (activeTab === 'channel') {
      return `${CHANNEL_ICONS[activeChannel] || ''} ${escapeHtml(activeChannel)}`;
    }
    return `DM: ${escapeHtml(activeDMFriend?.display_name || '')}`;
  }

  function renderMessages() {
    if (messages.length === 0) {
      return '<div class="chat-empty">No messages yet</div>';
    }
    return messages.map(m => {
      const msgId = m.id;
      const userId = m.user_id || m.sender_id || '';
      const msgReactions = reactions[msgId] || {};
      const reactionPills = Object.entries(msgReactions).map(([emoji, info]) => {
        const mineClass = info.mine ? ' mine' : '';
        return `<button class="chat-reaction-pill${mineClass}" data-msg-id="${msgId}" data-emoji="${emoji}">${emoji} ${info.count}</button>`;
      }).join('');

      return `
        <div class="chat-message" data-msg-id="${msgId}">
          <span class="chat-message-author chat-profile-link" data-user-id="${userId}">${escapeHtml(m.display_name || m.profiles?.display_name || 'Unknown')}</span>
          <span class="chat-message-time">${formatTime(m.created_at)}</span>
          <div class="chat-message-text">${escapeHtml(m.content)}</div>
          <div class="chat-reactions-row">
            ${reactionPills}
            <button class="chat-react-btn" data-msg-id="${msgId}" title="Add reaction">+</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function switchView() {
    if (_container) {
      _container.querySelectorAll('.chat-channel-btn').forEach(btn => {
        btn.classList.toggle('active', activeTab === 'channel' && btn.dataset.channel === activeChannel);
      });
      _container.querySelectorAll('.chat-dm-item').forEach(btn => {
        btn.classList.toggle('active', activeTab === 'dm' && activeDMFriend && btn.dataset.dmId === activeDMFriend.id);
      });
    }

    const header = document.getElementById('chat-header');
    if (header) header.innerHTML = getHeaderText();

    messages = [];
    reactions = {};
    updateMessagesUI();

    await loadMessages();
  }

  async function loadMessages() {
    try {
      await spirosAPI.unsubscribeChat();
    } catch (_) {}

    try {
      if (activeTab === 'channel') {
        messages = await spirosAPI.getChatMessages(activeChannel) || [];
        await spirosAPI.subscribeChatChannel(activeChannel);
      } else if (activeDMFriend) {
        messages = await spirosAPI.getDirectMessages(activeDMFriend.id) || [];
        await spirosAPI.subscribeDMChannel(activeDMFriend.id);
      }
    } catch (err) {
      console.error('Chat loadMessages error:', err);
      if (window.showToast) window.showToast('Failed to load messages', 'error');
      messages = [];
    }

    await loadReactions();
    updateMessagesUI();
  }

  async function loadReactions() {
    const msgIds = messages.map(m => m.id).filter(Boolean);
    if (msgIds.length === 0) { reactions = {}; return; }
    try {
      reactions = await spirosAPI.getReactions(msgIds) || {};
    } catch (_) {
      reactions = {};
    }
  }

  function updateMessagesUI() {
    const msgContainer = document.getElementById('chat-messages');
    if (!msgContainer) return;
    msgContainer.innerHTML = renderMessages();
    wireReactionEvents(msgContainer);
    wireProfileClicks(msgContainer);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function optimisticToggleReaction(msgId, emoji) {
    if (!reactions[msgId]) reactions[msgId] = {};
    const r = reactions[msgId][emoji];
    if (r && r.mine) {
      // Remove own reaction
      r.count--;
      r.mine = false;
      if (r.count <= 0) delete reactions[msgId][emoji];
    } else if (r) {
      // Add own reaction to existing emoji
      r.count++;
      r.mine = true;
    } else {
      // New emoji reaction
      reactions[msgId][emoji] = { count: 1, mine: true };
    }
  }

  function wireReactionEvents(container) {
    container.querySelectorAll('.chat-reaction-pill').forEach(pill => {
      pill.addEventListener('click', async () => {
        const msgId = pill.dataset.msgId;
        const emoji = pill.dataset.emoji;
        const msgType = activeTab === 'channel' ? 'channel' : 'dm';
        // Optimistic update — instant UI
        optimisticToggleReaction(msgId, emoji);
        updateMessagesUI();
        // Fire-and-forget network call, then reconcile
        spirosAPI.addReaction(msgId, msgType, emoji).then(() => loadReactions().then(() => updateMessagesUI())).catch(() => { loadReactions().then(() => updateMessagesUI()); });
      });
    });

    container.querySelectorAll('.chat-react-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!(window.requiresTier && window.requiresTier('pro'))) {
          if (window.showUpgradeModal) window.showUpgradeModal('Chat Reactions', 'pro');
          return;
        }
        showEmojiPicker(btn, btn.dataset.msgId);
      });
    });
  }

  function wireProfileClicks(container) {
    container.querySelectorAll('.chat-profile-link').forEach(el => {
      el.addEventListener('click', () => {
        const userId = el.dataset.userId;
        if (userId) showUserProfile(userId);
      });
    });
  }

  function showEmojiPicker(anchorEl, msgId) {
    // Remove any existing picker and clean up close handler
    if (_pickerCloseHandler) {
      document.removeEventListener('click', _pickerCloseHandler);
      _pickerCloseHandler = null;
    }
    document.querySelectorAll('.chat-emoji-picker').forEach(el => el.remove());

    const picker = document.createElement('div');
    picker.className = 'chat-emoji-picker';
    picker.innerHTML = REACTION_EMOJIS.map(emoji =>
      `<button class="chat-emoji-btn" data-emoji="${emoji}">${emoji}</button>`
    ).join('');

    // Position relative to viewport using getBoundingClientRect
    const rect = anchorEl.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.left = rect.left + 'px';
    picker.style.top = (rect.top - 36) + 'px';
    picker.style.bottom = 'auto';
    picker.style.zIndex = '9999';

    document.body.appendChild(picker);

    // Adjust if picker goes off-screen top
    const pickerRect = picker.getBoundingClientRect();
    if (pickerRect.top < 0) {
      picker.style.top = (rect.bottom + 4) + 'px';
    }
    // Adjust if picker goes off-screen right
    if (pickerRect.right > window.innerWidth) {
      picker.style.left = (window.innerWidth - pickerRect.width - 8) + 'px';
    }

    picker.querySelectorAll('.chat-emoji-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const emoji = btn.dataset.emoji;
        const msgType = activeTab === 'channel' ? 'channel' : 'dm';
        picker.remove();
        // Optimistic update — instant UI
        optimisticToggleReaction(msgId, emoji);
        updateMessagesUI();
        // Network in background, then reconcile
        spirosAPI.addReaction(msgId, msgType, emoji).then(() => loadReactions().then(() => updateMessagesUI())).catch(() => { loadReactions().then(() => updateMessagesUI()); });
      });
    });

    const closeHandler = (e) => {
      if (!picker.contains(e.target) && e.target !== anchorEl) {
        picker.remove();
        document.removeEventListener('click', closeHandler);
        _pickerCloseHandler = null;
      }
    };
    _pickerCloseHandler = closeHandler;
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  // ===== User Profile Popup =====
  async function showUserProfile(userId) {
    // Remove existing popup
    document.querySelectorAll('.chat-profile-popup-backdrop').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'chat-profile-popup-backdrop';
    backdrop.innerHTML = `
      <div class="chat-profile-popup glass">
        <div class="lb-loading">Loading profile...</div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    const onKey = (e) => {
      if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    // Fetch profile
    const result = await spirosAPI.getPublicProfile(userId);
    const profile = result?.profile || null;
    const popup = backdrop.querySelector('.chat-profile-popup');

    if (!profile) {
      popup.innerHTML = `
        <button class="project-detail-close chat-profile-close">&times;</button>
        <div style="text-align:center;padding:20px;color:var(--text-dim)">Profile not found${result?.error ? '<br><small style="color:#f66">' + result.error + '</small>' : ''}</div>
      `;
      popup.querySelector('.chat-profile-close').addEventListener('click', () => backdrop.remove());
      return;
    }

    const initial = (profile.display_name || '?').charAt(0).toUpperCase();
    const memberSince = profile.created_at
      ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';
    const isYou = userId === _currentUserId;

    popup.innerHTML = `
      <button class="project-detail-close chat-profile-close">&times;</button>
      <div class="chat-profile-header">
        <div class="profile-avatar" style="width:40px;height:40px;font-size:16px">${escapeHtml(initial)}</div>
        <div>
          <div class="chat-profile-name">${escapeHtml(profile.display_name || 'Unknown')}${isYou ? ' (You)' : ''}</div>
          <div class="chat-profile-title">Lv. ${profile.level || 1} &middot; ${escapeHtml(profile.title || 'Novice')}</div>
        </div>
      </div>
      <div class="chat-profile-stats">
        <div class="chat-profile-stat">
          <div class="chat-profile-stat-value">${(profile.xp || 0).toLocaleString()}</div>
          <div class="chat-profile-stat-label">XP</div>
        </div>
        <div class="chat-profile-stat">
          <div class="chat-profile-stat-value">${profile.streak_current || 0}</div>
          <div class="chat-profile-stat-label">Streak</div>
        </div>
        <div class="chat-profile-stat">
          <div class="chat-profile-stat-value">Lv. ${profile.level || 1}</div>
          <div class="chat-profile-stat-label">Level</div>
        </div>
      </div>
      ${memberSince ? `<div class="chat-profile-since">Member since ${memberSince}</div>` : ''}
    `;

    popup.querySelector('.chat-profile-close').addEventListener('click', () => backdrop.remove());
  }

  function wireEvents(container) {
    container.querySelectorAll('.chat-channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.locked === 'true') {
          if (window.showUpgradeModal) window.showUpgradeModal('Chat Channels', 'starter');
          return;
        }
        if (activeTab === 'channel' && activeChannel === btn.dataset.channel) return;
        activeTab = 'channel';
        activeChannel = btn.dataset.channel;
        activeDMFriend = null;
        switchView();
      });
    });

    container.querySelector('#chat-dm-upgrade')?.addEventListener('click', () => {
      if (window.showUpgradeModal) window.showUpgradeModal('Direct Messages', 'pro');
    });

    container.querySelectorAll('.chat-dm-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (activeTab === 'dm' && activeDMFriend?.id === btn.dataset.dmId) return;
        activeTab = 'dm';
        activeDMFriend = { id: btn.dataset.dmId, display_name: btn.dataset.dmName };
        switchView();
      });
    });

    container.querySelector('#btn-chat-send')?.addEventListener('click', () => sendMessage());

    container.querySelector('#chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-chat-send');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

    try {
      let result;
      if (activeTab === 'channel') {
        result = await spirosAPI.sendChatMessage(activeChannel, content);
      } else if (activeDMFriend) {
        result = await spirosAPI.sendDirectMessage(activeDMFriend.id, content);
      }

      if (result && result.success) {
        input.value = '';
        await loadMessages();
      } else {
        console.error('Chat send failed:', result?.error);
        if (window.showToast) window.showToast('Message failed to send', 'error');
        input.style.borderColor = 'var(--red)';
        setTimeout(() => { input.style.borderColor = ''; }, 2000);
      }
    } catch (err) {
      console.error('Chat send error:', err);
      if (window.showToast) window.showToast('Message failed to send', 'error');
      input.style.borderColor = 'var(--red)';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
    }

    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
    input.focus();
  }

  if (typeof spirosAPI !== 'undefined') {
    spirosAPI.onChatMessage?.((msg) => {
      if (activeTab === 'channel' && msg.channel === activeChannel) {
        messages.push(msg);
        updateMessagesUI();
      }
    });

    spirosAPI.onDirectMessage?.((msg) => {
      if (activeTab === 'dm' && activeDMFriend &&
        (msg.sender_id === activeDMFriend.id || msg.receiver_id === activeDMFriend.id)) {
        messages.push(msg);
        updateMessagesUI();
      }
    });
  }

  return { render };
})();
