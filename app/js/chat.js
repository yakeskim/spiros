// chat.js — Live Chat: category channels + friend DMs with Supabase Realtime

const Chat = (() => {
  const CHANNELS = ['General', 'Help', 'SaaS', 'Social', 'Creative', 'Dev Tools', 'Other'];
  const CHANNEL_ICONS = { General: '💬', Help: '❓', SaaS: '💼', Social: '👥', Creative: '🎨', 'Dev Tools': '🛠', Other: '📦' };

  let activeTab = 'channel'; // 'channel' | 'dm'
  let activeChannel = 'General';
  let activeDMFriend = null; // { id, display_name }
  let messages = [];
  let friends = [];
  let _container = null;

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

  // Full render — only on first open (fetches friends, builds DOM)
  async function render(container) {
    _container = container;

    // Load friends for DM list (one-time per tab open)
    try {
      const data = await synchronAPI.getFriends();
      const { user } = await synchronAPI.getUser();
      if (user) {
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
    container.innerHTML = `
      <div class="chat-page">
        <div class="chat-page-header">
          <h2 class="page-title">Chat</h2>
        </div>
        <div class="chat-layout">
          <div class="chat-sidebar">
            <div class="chat-sidebar-section">
              <div class="chat-sidebar-title">Channels</div>
              ${CHANNELS.map(ch => `
                <button class="chat-channel-btn ${activeTab === 'channel' && activeChannel === ch ? 'active' : ''}" data-channel="${escapeHtml(ch)}">
                  <span class="chat-channel-icon">${CHANNEL_ICONS[ch] || '📦'}</span>
                  <span>${escapeHtml(ch)}</span>
                </button>
              `).join('')}
            </div>
            <div class="chat-sidebar-section">
              <div class="chat-sidebar-title">Direct Messages</div>
              ${friends.length === 0
                ? '<div style="font-size:6px;color:var(--text-dim);padding:4px">No friends yet</div>'
                : friends.map(f => `
                  <button class="chat-dm-item ${activeTab === 'dm' && activeDMFriend?.id === f.id ? 'active' : ''}" data-dm-id="${f.id}" data-dm-name="${escapeHtml(f.display_name || 'Unknown')}">
                    <span class="chat-dm-avatar">${escapeHtml((f.display_name || '?').charAt(0).toUpperCase())}</span>
                    <span>${escapeHtml(f.display_name || 'Unknown')}</span>
                  </button>
                `).join('')
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
    return messages.map(m => `
      <div class="chat-message">
        <span class="chat-message-author">${escapeHtml(m.display_name || m.profiles?.display_name || 'Unknown')}</span>
        <span class="chat-message-time">${formatTime(m.created_at)}</span>
        <div class="chat-message-text">${escapeHtml(m.content)}</div>
      </div>
    `).join('');
  }

  // Fast switch — no network calls, just updates highlights + header + loads messages
  async function switchView() {
    // Update sidebar highlights
    if (_container) {
      _container.querySelectorAll('.chat-channel-btn').forEach(btn => {
        btn.classList.toggle('active', activeTab === 'channel' && btn.dataset.channel === activeChannel);
      });
      _container.querySelectorAll('.chat-dm-item').forEach(btn => {
        btn.classList.toggle('active', activeTab === 'dm' && activeDMFriend && btn.dataset.dmId === activeDMFriend.id);
      });
    }

    // Update header
    const header = document.getElementById('chat-header');
    if (header) header.innerHTML = getHeaderText();

    // Clear messages immediately so the UI feels responsive
    messages = [];
    updateMessagesUI();

    // Load new messages (only network call)
    await loadMessages();
  }

  async function loadMessages() {
    try {
      await synchronAPI.unsubscribeChat();
    } catch (_) {}

    try {
      if (activeTab === 'channel') {
        messages = await synchronAPI.getChatMessages(activeChannel) || [];
        await synchronAPI.subscribeChatChannel(activeChannel);
      } else if (activeDMFriend) {
        messages = await synchronAPI.getDirectMessages(activeDMFriend.id) || [];
        await synchronAPI.subscribeDMChannel(activeDMFriend.id);
      }
    } catch (err) {
      console.error('Chat loadMessages error:', err);
      messages = [];
    }

    updateMessagesUI();
  }

  function updateMessagesUI() {
    const msgContainer = document.getElementById('chat-messages');
    if (!msgContainer) return;
    msgContainer.innerHTML = renderMessages();
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function wireEvents(container) {
    // Channel buttons — fast switch, no full re-render
    container.querySelectorAll('.chat-channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (activeTab === 'channel' && activeChannel === btn.dataset.channel) return;
        activeTab = 'channel';
        activeChannel = btn.dataset.channel;
        activeDMFriend = null;
        switchView();
      });
    });

    // DM buttons — fast switch
    container.querySelectorAll('.chat-dm-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (activeTab === 'dm' && activeDMFriend?.id === btn.dataset.dmId) return;
        activeTab = 'dm';
        activeDMFriend = { id: btn.dataset.dmId, display_name: btn.dataset.dmName };
        switchView();
      });
    });

    // Send button
    container.querySelector('#btn-chat-send')?.addEventListener('click', () => sendMessage());

    // Enter key
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

    // Disable while sending
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

    try {
      let result;
      if (activeTab === 'channel') {
        result = await synchronAPI.sendChatMessage(activeChannel, content);
      } else if (activeDMFriend) {
        result = await synchronAPI.sendDirectMessage(activeDMFriend.id, content);
      }

      if (result && result.success) {
        input.value = '';
        await loadMessages();
      } else {
        console.error('Chat send failed:', result?.error);
        input.style.borderColor = 'var(--red)';
        setTimeout(() => { input.style.borderColor = ''; }, 2000);
      }
    } catch (err) {
      console.error('Chat send error:', err);
      input.style.borderColor = 'var(--red)';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
    }

    // Re-enable
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
    input.focus();
  }

  // Handle incoming realtime messages
  if (typeof synchronAPI !== 'undefined') {
    synchronAPI.onChatMessage?.((msg) => {
      if (activeTab === 'channel' && msg.channel === activeChannel) {
        messages.push(msg);
        updateMessagesUI();
      }
    });

    synchronAPI.onDirectMessage?.((msg) => {
      if (activeTab === 'dm' && activeDMFriend &&
        (msg.sender_id === activeDMFriend.id || msg.receiver_id === activeDMFriend.id)) {
        messages.push(msg);
        updateMessagesUI();
      }
    });
  }

  return { render };
})();
