// changelog.js — Changelog view

const Changelog = (() => {

  function parseChangelog(md) {
    if (!md) return '<p class="text-muted">No changelog available.</p>';

    const lines = md.split('\n');
    let html = '';
    let inList = false;
    let inSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Top-level heading (# Spiros Changelog) — skip, we render our own title
      if (/^# /.test(trimmed)) continue;

      // Version heading: ## v1.0.0 — 2026-02-25
      const versionMatch = trimmed.match(/^## (v[\d.]+)(?:\s*[—–-]\s*(.+))?$/);
      if (versionMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        if (inSection) { html += '</div>'; inSection = false; }
        html += `<div class="settings-section glass">`;
        inSection = true;
        html += `<h3 class="section-title">${esc(versionMatch[1])}`;
        if (versionMatch[2]) html += ` <span class="text-muted" style="font-size:0.8em;margin-left:8px">${esc(versionMatch[2])}</span>`;
        html += `</h3>`;
        continue;
      }

      // Bold type label: **MAJOR**, **Added**, etc.
      const typeMatch = trimmed.match(/^\*\*(.+?)\*\*(?:\s*[—–-]\s*(.+))?$/);
      if (typeMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<div class="changelog-type">${esc(typeMatch[1])}`;
        if (typeMatch[2]) html += ` — ${esc(typeMatch[2])}`;
        html += `</div>`;
        continue;
      }

      // Bullet item
      if (trimmed.startsWith('- ')) {
        if (!inList) { html += '<ul class="changelog-list">'; inList = true; }
        html += `<li>${esc(trimmed.slice(2))}</li>`;
        continue;
      }

      // Description text (non-empty, non-heading, non-bullet)
      if (trimmed.length > 0) continue;
    }

    if (inList) html += '</ul>';
    if (inSection) html += '</div>';

    return html;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function render(container) {
    const md = await spirosAPI.getChangelog();

    container.innerHTML = `
      <div class="settings-page">
        <h2 class="page-title">Changelog</h2>
        <p class="text-muted" style="margin-bottom:16px">Release notes for Spiros</p>
        ${parseChangelog(md)}
      </div>
    `;
  }

  return { render };
})();
