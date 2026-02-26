// projects.js — Project scanner UI

const Projects = (() => {
  let projectsData = [];
  let sortBy = 'recent'; // recent | name | commits | lines
  let filterLang = '';

  async function render(container) {
    container.innerHTML = `
      <div class="projects-page">
        <div class="projects-header">
          <h2 class="page-title">Projects</h2>
          <div class="projects-controls">
            <button class="btn-pixel" id="btn-set-folder">📁 Set Folder</button>
            <button class="btn-pixel" id="btn-scan-projects">⟳ Refresh</button>
            <select id="sort-projects" class="select-pixel">
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="commits">Commits</option>
              <option value="lines">Lines</option>
            </select>
            <select id="filter-lang" class="select-pixel">
              <option value="">All Languages</option>
            </select>
          </div>
        </div>
        <div id="projects-grid" class="projects-grid">
          <div class="loading-state">Scanning projects...</div>
        </div>
      </div>
    `;

    container.querySelector('#btn-set-folder').addEventListener('click', async () => {
      const result = await synchronAPI.openFolder();
      if (result.success) {
        const settings = await synchronAPI.getSettings();
        settings.projectsFolder = result.path;
        await synchronAPI.setSettings(settings);
        await scanAndRender();
      }
    });
    container.querySelector('#btn-scan-projects').addEventListener('click', () => scanAndRender());
    container.querySelector('#sort-projects').addEventListener('change', (e) => {
      sortBy = e.target.value;
      renderGrid();
    });
    container.querySelector('#filter-lang').addEventListener('change', (e) => {
      filterLang = e.target.value;
      renderGrid();
    });

    await scanAndRender();
  }

  async function scanAndRender() {
    const grid = document.getElementById('projects-grid');
    if (grid) grid.innerHTML = '<div class="loading-state">Scanning projects...</div>';

    try {
      projectsData = await synchronAPI.scanProjects();
    } catch (e) {
      console.error('scanProjects error:', e);
      projectsData = [];
    }
    updateLanguageFilter();
    renderGrid();
  }

  function updateLanguageFilter() {
    const langSet = new Set();
    for (const p of projectsData) {
      for (const lang of Object.keys(p.languages || {})) {
        if (!['JSON', 'Markdown', 'YAML', '.gitignore'].includes(lang)) {
          langSet.add(lang);
        }
      }
    }
    const select = document.getElementById('filter-lang');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">All Languages</option>' +
      [...langSet].sort().map(l => `<option value="${l}" ${l === current ? 'selected' : ''}>${l}</option>`).join('');
  }

  function renderGrid() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    let filtered = [...projectsData];
    if (filterLang) {
      filtered = filtered.filter(p => p.languages && p.languages[filterLang]);
    }

    // Sort
    if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'commits') filtered.sort((a, b) => b.commitCount - a.commitCount);
    else if (sortBy === 'lines') filtered.sort((a, b) => b.lineCount - a.lineCount);
    // 'recent' is default sort from scanner

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state">No projects found. Check your projects folder in Settings.</div>';
      return;
    }

    grid.innerHTML = filtered.map((p, i) => renderProjectCard(p, i)).join('');

    // Wire up buttons (stop propagation so card click doesn't fire)
    grid.querySelectorAll('.btn-vscode').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); synchronAPI.openInVSCode(btn.dataset.path); });
    });
    grid.querySelectorAll('.btn-terminal').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); synchronAPI.openTerminal(btn.dataset.path); });
    });

    // Wire up card click → detail popup
    grid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index, 10);
        if (!isNaN(idx) && filtered[idx]) showProjectDetail(filtered[idx]);
      });
    });
  }

  function renderProjectCard(project, index) {
    const topLangs = Object.entries(project.languages || {})
      .filter(([l]) => !['JSON', 'Markdown', 'YAML', '.gitignore', '.txt'].includes(l))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const totalLangFiles = topLangs.reduce((s, [, c]) => s + c, 0) || 1;
    const langBar = topLangs.map(([lang, count]) => {
      const pct = (count / totalLangFiles) * 100;
      const color = getLangColor(lang);
      return `<div class="lang-segment" style="width:${pct}%;background:${color}" title="${lang}: ${count} files"></div>`;
    }).join('');

    const timeAgo = project.lastCommitDate ? getTimeAgo(project.lastCommitDate) : 'never';
    const dirtyBadge = project.dirty ? '<span class="badge dirty">modified</span>' : '';
    const typeBadge = !project.hasGit ? `<span class="badge project-type-badge">${escapeHtml(project.projectType)}</span>` : '';

    return `
      <div class="project-card glass" data-index="${index}">
        <div class="project-header">
          <h3 class="project-name">${escapeHtml(project.name)}</h3>
          ${dirtyBadge}
          ${typeBadge}
        </div>
        ${project.hasGit
          ? `<div class="project-branch">\u2387 ${project.branch || 'main'}</div>
             <div class="project-commit" title="${escapeAttr(project.lastCommit)}">${truncate(project.lastCommit, 50)}</div>`
          : `<div class="project-branch project-type-label">${escapeHtml(project.projectType)} project</div>`
        }
        <div class="project-stats">
          ${project.hasGit ? `<span title="Commits">\u2B21 ${project.commitCount}</span>` : ''}
          <span title="Files">\u{1F4C4} ${project.fileCount}</span>
          <span title="Lines"># ${formatNumber(project.lineCount)}</span>
          <span title="Last updated">\u23F1 ${timeAgo}</span>
        </div>
        <div class="lang-bar">${langBar}</div>
        <div class="lang-labels">${topLangs.map(([l]) => `<span class="lang-label" style="color:${getLangColor(l)}">${l}</span>`).join('')}</div>
        <div class="project-actions">
          <button class="btn-sm btn-vscode" data-path="${escapeAttr(project.path)}">VS Code</button>
          <button class="btn-sm btn-terminal" data-path="${escapeAttr(project.path)}">Terminal</button>
        </div>
      </div>
    `;
  }

  function getLangColor(lang) {
    const colors = {
      'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572A5',
      'HTML': '#e34c26', 'CSS': '#563d7c', 'SCSS': '#c6538c',
      'Ruby': '#701516', 'Go': '#00ADD8', 'Rust': '#dea584',
      'Java': '#b07219', 'C#': '#178600', 'C++': '#f34b7d', 'C': '#555555',
      'PHP': '#4F5D95', 'Swift': '#F05138', 'Dart': '#00B4AB',
      'Vue': '#41b883', 'Svelte': '#ff3e00', 'Shell': '#89e051', 'Lua': '#000080'
    };
    return colors[lang] || '#78909c';
  }

  function getTimeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }

  function truncate(s, max) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max - 2) + '..' : s;
  }

  function escapeAttr(s) {
    return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showProjectDetail(project) {
    // Remove any existing popup
    const existing = document.getElementById('project-detail-backdrop');
    if (existing) existing.remove();

    const timeAgo = project.lastCommitDate ? getTimeAgo(project.lastCommitDate) : 'never';
    const dirtyBadge = project.dirty ? '<span class="badge dirty">modified</span>' : '';

    // Full language breakdown (not just top 3)
    const allLangs = Object.entries(project.languages || {})
      .filter(([l]) => !['JSON', 'Markdown', 'YAML', '.gitignore', '.txt'].includes(l))
      .sort((a, b) => b[1] - a[1]);

    const totalLangFiles = allLangs.reduce((s, [, c]) => s + c, 0) || 1;
    const langBar = allLangs.map(([lang, count]) => {
      const pct = (count / totalLangFiles) * 100;
      const color = getLangColor(lang);
      return `<div class="lang-segment" style="width:${pct}%;background:${color}" title="${lang}: ${count} files"></div>`;
    }).join('');

    const langRows = allLangs.map(([lang, count]) => {
      const pct = ((count / totalLangFiles) * 100).toFixed(1);
      return `<div class="detail-lang-row">
        <span class="detail-lang-dot" style="background:${getLangColor(lang)}"></span>
        <span class="detail-lang-name">${escapeHtml(lang)}</span>
        <span class="detail-lang-count">${count} files</span>
        <span class="detail-lang-pct">${pct}%</span>
      </div>`;
    }).join('');

    // Build copy-context markdown
    const langSummary = allLangs.map(([l, c]) => `${l} (${c} files)`).join(', ');
    const contextMd = project.hasGit
      ? `## ${project.name}\n- Path: ${project.path}\n- Branch: ${project.branch || 'main'}\n- Languages: ${langSummary}\n- Files: ${project.fileCount} | Lines: ${project.lineCount}\n- Last commit: ${project.lastCommit || 'none'} (${timeAgo})`
      : `## ${project.name}\n- Path: ${project.path}\n- Type: ${project.projectType}\n- Languages: ${langSummary}\n- Files: ${project.fileCount} | Lines: ${project.lineCount}`;

    const gitSection = project.hasGit ? `
        <div class="project-detail-section">
          <h4 class="detail-section-title">Git</h4>
          <div class="detail-stats-row">
            <span>\u2B21 ${project.commitCount} commits</span>
            <span>\u23F1 Last: ${timeAgo}</span>
          </div>
          <div class="detail-commit-msg">${escapeHtml(project.lastCommit)}</div>
        </div>` : `
        <div class="project-detail-section">
          <h4 class="detail-section-title">Info</h4>
          <div class="detail-stats-row">
            <span>${escapeHtml(project.projectType)} project</span>
            <span>\u23F1 Modified: ${timeAgo}</span>
          </div>
        </div>`;

    const detailBranch = project.hasGit
      ? `\u2387 ${escapeHtml(project.branch || 'main')} ${dirtyBadge}`
      : `${escapeHtml(project.projectType)}`;

    const backdrop = document.createElement('div');
    backdrop.id = 'project-detail-backdrop';
    backdrop.className = 'project-detail-backdrop';
    backdrop.innerHTML = `
      <div class="project-detail-panel glass">
        <div class="project-detail-top">
          <div>
            <h3 class="project-detail-name">${escapeHtml(project.name)}</h3>
            <div class="project-detail-branch">${detailBranch}</div>
          </div>
          <button class="project-detail-close" id="detail-close-btn">&times;</button>
        </div>

        <div class="project-detail-path" title="Click to copy path">
          <span class="detail-path-text">${escapeHtml(project.path)}</span>
          <span class="detail-copy-hint">click to copy</span>
        </div>

        ${gitSection}

        <div class="project-detail-section">
          <h4 class="detail-section-title">Code</h4>
          <div class="detail-stats-row">
            <span>\u{1F4C4} ${project.fileCount} files</span>
            <span># ${formatNumber(project.lineCount)} lines</span>
          </div>
          <div class="lang-bar" style="margin:6px 0 4px;height:8px">${langBar}</div>
          <div class="detail-lang-list">${langRows}</div>
        </div>

        <div class="project-detail-actions">
          <button class="btn-pixel detail-action-btn" id="detail-copy-ctx">\u{1F4CB} Copy Context</button>
          <button class="btn-pixel detail-action-btn" id="detail-vscode">VS Code</button>
          <button class="btn-pixel detail-action-btn" id="detail-terminal">Terminal</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    // Close button
    backdrop.querySelector('#detail-close-btn').addEventListener('click', () => backdrop.remove());

    // Copy path
    backdrop.querySelector('.project-detail-path').addEventListener('click', () => {
      navigator.clipboard.writeText(project.path);
      const hint = backdrop.querySelector('.detail-copy-hint');
      hint.textContent = 'copied!';
      setTimeout(() => { hint.textContent = 'click to copy'; }, 1500);
    });

    // Copy context
    backdrop.querySelector('#detail-copy-ctx').addEventListener('click', () => {
      navigator.clipboard.writeText(contextMd);
      const btn = backdrop.querySelector('#detail-copy-ctx');
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy Context'; }, 1500);
    });

    // VS Code
    backdrop.querySelector('#detail-vscode').addEventListener('click', () => {
      synchronAPI.openInVSCode(project.path);
    });

    // Terminal
    backdrop.querySelector('#detail-terminal').addEventListener('click', () => {
      synchronAPI.openTerminal(project.path);
    });

    // Close on Escape
    const onKey = (e) => {
      if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  }

  return { render };
})();
