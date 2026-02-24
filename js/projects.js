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
            <button class="btn-pixel" id="btn-scan-projects">⟳ Scan</button>
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

    projectsData = await synchronAPI.scanProjects();
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

    grid.innerHTML = filtered.map(p => renderProjectCard(p)).join('');

    // Wire up buttons
    grid.querySelectorAll('.btn-vscode').forEach(btn => {
      btn.addEventListener('click', () => synchronAPI.openInVSCode(btn.dataset.path));
    });
    grid.querySelectorAll('.btn-terminal').forEach(btn => {
      btn.addEventListener('click', () => synchronAPI.openTerminal(btn.dataset.path));
    });
  }

  function renderProjectCard(project) {
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

    return `
      <div class="project-card glass">
        <div class="project-header">
          <h3 class="project-name">${project.name}</h3>
          ${dirtyBadge}
        </div>
        <div class="project-branch">⎇ ${project.branch || 'main'}</div>
        <div class="project-commit" title="${project.lastCommit}">${truncate(project.lastCommit, 50)}</div>
        <div class="project-stats">
          <span title="Commits">⬡ ${project.commitCount}</span>
          <span title="Files">📄 ${project.fileCount}</span>
          <span title="Lines"># ${formatNumber(project.lineCount)}</span>
          <span title="Last updated">⏱ ${timeAgo}</span>
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

  return { render };
})();
