// community.js — Community Projects: submit, vote, comment, browse

const Community = (() => {
  let currentCategory = 'All';
  let currentSort = 'newest';
  let userVotes = {}; // { projectId: 'up'|'down' }
  let expandedComments = {}; // { projectId: true }
  let commentsCache = {}; // { projectId: [...] }
  let showSubmitForm = false;

  const CATEGORIES = ['All', 'SaaS', 'Social', 'Creative', 'Dev Tools', 'Other'];

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  async function render(container) {
    // Load user votes
    try {
      const votes = await spirosAPI.getUserVotes();
      userVotes = {};
      for (const v of (votes || [])) {
        userVotes[v.project_id] = v.vote_type;
      }
    } catch (_) {}

    // Load projects
    const filter = currentCategory === 'All' ? null : currentCategory;
    let projects = [];
    try {
      projects = await spirosAPI.getCommunityProjects(filter, currentSort) || [];
    } catch (_) {}

    container.innerHTML = `
      <div class="community-page">
        <div class="community-header">
          <h2 class="page-title">Community Projects</h2>
          <button class="btn-pixel btn-sm${!(window.requiresTier && window.requiresTier('starter')) ? ' btn-locked' : ''}" id="btn-submit-project">${!(window.requiresTier && window.requiresTier('starter')) ? '&#x1F512; ' : ''}${showSubmitForm ? 'Cancel' : 'Submit Project'}</button>
        </div>

        ${showSubmitForm ? renderSubmitForm() : ''}

        <div class="community-filters">
          <div class="community-cat-tabs">
            ${CATEGORIES.map(cat => `
              <button class="community-cat-tab ${currentCategory === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
            `).join('')}
          </div>
          <select class="community-sort" id="community-sort">
            <option value="newest" ${currentSort === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="top" ${currentSort === 'top' ? 'selected' : ''}>Top Rated</option>
          </select>
        </div>

        <div class="community-projects-list" id="community-list">
          ${projects.length === 0
            ? `<div class="empty-state">
                <div class="empty-state-icon">🌍</div>
                <p>No projects yet</p>
                <p class="empty-state-hint">Be the first to share a project with the community!</p>
              </div>`
            : projects.map(p => renderProjectCard(p)).join('')
          }
        </div>
      </div>
    `;

    wireEvents(container, projects);
  }

  function renderSubmitForm() {
    return `
      <div class="settings-section glass community-submit-form" id="submit-form">
        <h3 class="section-title">Share Your Project</h3>
        <div class="setting-row">
          <input type="text" id="submit-title" class="input-pixel" placeholder="Project title" maxlength="100">
          <span class="char-count" id="submit-title-count">0/100</span>
        </div>
        <div class="setting-row">
          <textarea id="submit-desc" class="input-pixel" placeholder="Brief description" maxlength="500"></textarea>
          <span class="char-count" id="submit-desc-count">0/500</span>
        </div>
        <div class="setting-row">
          <input type="url" id="submit-url" class="input-pixel" placeholder="https://your-project.com">
        </div>
        <div class="setting-row">
          <select id="submit-category" class="community-sort" style="width:100%">
            <option value="">Select category...</option>
            <option value="SaaS">SaaS</option>
            <option value="Social">Social</option>
            <option value="Creative">Creative</option>
            <option value="Dev Tools">Dev Tools</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div id="submit-error" style="color:var(--red);font-size:7px;display:none;margin-bottom:6px"></div>
        <button class="btn-pixel" id="btn-do-submit">Submit</button>
      </div>
    `;
  }

  function renderProjectCard(p) {
    const vote = userVotes[p.id];
    const score = (p.upvotes || 0) - (p.downvotes || 0);
    const expanded = expandedComments[p.id];
    const comments = commentsCache[p.id] || [];

    return `
      <div class="community-project-card" data-project-id="${p.id}">
        <div class="community-vote-col">
          <button class="community-vote-btn ${vote === 'up' ? 'active-up' : ''}" data-vote="up" data-pid="${p.id}">▲</button>
          <div class="community-vote-score">${score}</div>
          <button class="community-vote-btn ${vote === 'down' ? 'active-down' : ''}" data-vote="down" data-pid="${p.id}">▼</button>
        </div>
        <div class="community-project-content">
          <div class="community-project-title">${escapeHtml(p.title)}</div>
          <div class="community-project-desc">${escapeHtml(p.description)}</div>
          <div class="community-project-url" data-url="${escapeHtml(p.url)}">${escapeHtml(p.url)}</div>
          <div class="community-project-meta">
            <span class="community-cat-tag">${escapeHtml(p.category)}</span>
            <span>${escapeHtml(p.profiles?.display_name || 'Unknown')}</span>
            <span>${timeAgo(p.created_at)}</span>
          </div>
          <div class="community-project-actions">
            <button class="community-comment-toggle" data-pid="${p.id}">${expanded ? 'Hide' : 'Comments'}</button>
            ${p._isOwner ? `<button class="community-delete-btn" data-delete="${p.id}">Delete</button>` : ''}
          </div>
          ${expanded ? renderComments(p.id, comments) : ''}
        </div>
      </div>
    `;
  }

  function renderComments(projectId, comments) {
    return `
      <div class="community-comments-section">
        ${comments.map(c => `
          <div class="community-comment">
            <span class="community-comment-author">${escapeHtml(c.profiles?.display_name || 'Unknown')}</span>
            <span class="community-comment-time">${timeAgo(c.created_at)}</span>
            <div class="community-comment-text">${escapeHtml(c.content)}</div>
          </div>
        `).join('')}
        ${comments.length === 0 ? '<div style="font-size:7px;color:var(--text-dim);padding:4px 0">No comments yet</div>' : ''}
        <div class="community-comment-form">
          <input type="text" class="input-pixel" placeholder="Add a comment..." maxlength="1000" data-comment-input="${projectId}">
          <button class="btn-pixel btn-sm" data-comment-submit="${projectId}">Post</button>
        </div>
      </div>
    `;
  }

  function wireEvents(container, projects) {
    // Submit toggle (Pro required)
    container.querySelector('#btn-submit-project')?.addEventListener('click', () => {
      if (!(window.requiresTier && window.requiresTier('starter'))) {
        if (window.showUpgradeModal) window.showUpgradeModal('Submit Project', 'starter');
        return;
      }
      showSubmitForm = !showSubmitForm;
      render(container);
    });

    // Character count indicators
    container.querySelector('#submit-title')?.addEventListener('input', (e) => {
      const cnt = container.querySelector('#submit-title-count');
      if (cnt) cnt.textContent = `${e.target.value.length}/100`;
    });
    container.querySelector('#submit-desc')?.addEventListener('input', (e) => {
      const cnt = container.querySelector('#submit-desc-count');
      if (cnt) cnt.textContent = `${e.target.value.length}/500`;
    });

    // Submit form
    container.querySelector('#btn-do-submit')?.addEventListener('click', async () => {
      const title = container.querySelector('#submit-title')?.value.trim();
      const desc = container.querySelector('#submit-desc')?.value.trim();
      const url = container.querySelector('#submit-url')?.value.trim();
      const cat = container.querySelector('#submit-category')?.value;
      const errEl = container.querySelector('#submit-error');

      if (!title || !desc || !url || !cat) {
        errEl.textContent = 'All fields are required';
        errEl.style.display = 'block';
        return;
      }
      if (!/^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/.test(url)) {
        errEl.textContent = 'Enter a valid URL (e.g. https://example.com)';
        errEl.style.display = 'block';
        return;
      }

      const result = await spirosAPI.submitCommunityProject(title, desc, url, cat);
      if (result.success) {
        showSubmitForm = false;
        render(container);
      } else {
        errEl.textContent = result.error || 'Failed to submit';
        errEl.style.display = 'block';
      }
    });

    // Category tabs
    container.querySelectorAll('.community-cat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = btn.dataset.cat;
        render(container);
      });
    });

    // Sort
    container.querySelector('#community-sort')?.addEventListener('change', (e) => {
      currentSort = e.target.value;
      render(container);
    });

    // Vote buttons
    container.querySelectorAll('.community-vote-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        const voteType = btn.dataset.vote;
        await spirosAPI.voteCommunityProject(pid, voteType);
        // Refresh votes and re-render
        try {
          const votes = await spirosAPI.getUserVotes();
          userVotes = {};
          for (const v of (votes || [])) userVotes[v.project_id] = v.vote_type;
        } catch (_) {}
        render(container);
      });
    });

    // URL clicks
    container.querySelectorAll('.community-project-url').forEach(el => {
      el.addEventListener('click', () => {
        if (el.dataset.url) spirosAPI.openExternalLink(el.dataset.url);
      });
    });

    // Comment toggles
    container.querySelectorAll('.community-comment-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        if (expandedComments[pid]) {
          delete expandedComments[pid];
        } else {
          expandedComments[pid] = true;
          try {
            commentsCache[pid] = await spirosAPI.getProjectComments(pid) || [];
          } catch (_) { commentsCache[pid] = []; }
        }
        render(container);
      });
    });

    // Comment submit
    container.querySelectorAll('[data-comment-submit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.commentSubmit;
        const input = container.querySelector(`[data-comment-input="${pid}"]`);
        const content = input?.value.trim();
        if (!content) return;

        btn.disabled = true;
        const result = await spirosAPI.addProjectComment(pid, content);
        if (result.success) {
          commentsCache[pid] = await spirosAPI.getProjectComments(pid) || [];
          render(container);
        } else {
          btn.disabled = false;
        }
      });
    });

    // Comment input enter key
    container.querySelectorAll('[data-comment-input]').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const pid = input.dataset.commentInput;
          container.querySelector(`[data-comment-submit="${pid}"]`)?.click();
        }
      });
    });

    // Delete
    container.querySelectorAll('.community-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.delete;
        if (!confirm('Delete this project?')) return;
        await spirosAPI.deleteCommunityProject(pid);
        render(container);
      });
    });
  }

  return { render };
})();
