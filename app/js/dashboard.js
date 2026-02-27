// dashboard.js — Dashboard renderer (daily/weekly/monthly views)

const Dashboard = (() => {
  let currentRange = 'daily'; // daily | weekly | monthly
  let currentDate = new Date();
  let settings = null;
  let privacySettings = null;

  function getDateStr(d) {
    return d.toISOString().split('T')[0];
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatHours(ms) {
    if (ms < 60000) return '0m';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  function formatNum(n) {
    if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  async function render(container) {
    settings = await spirosAPI.getSettings();
    privacySettings = await spirosAPI.getPrivacySettings();

    container.innerHTML = `
      <div class="dashboard">
        <div class="dash-header">
          <div class="dash-nav-date">
            <button class="btn-icon" id="dash-prev">◀</button>
            <span id="dash-date-label" class="dash-date-label"></span>
            <button class="btn-icon" id="dash-next">▶</button>
            <button class="btn-icon btn-today" id="dash-today">Today</button>
          </div>
          <div class="dash-range-tabs">
            <button class="range-tab ${currentRange === 'daily' ? 'active' : ''}" data-range="daily">Daily</button>
            <button class="range-tab ${currentRange === 'weekly' ? 'active' : ''}" data-range="weekly">Weekly</button>
            <button class="range-tab ${currentRange === 'monthly' ? 'active' : ''}" data-range="monthly">Monthly</button>
          </div>
        </div>
        <div id="dash-content" class="dash-content"></div>
      </div>
    `;

    // Event listeners
    container.querySelector('#dash-prev').addEventListener('click', () => navigate(-1));
    container.querySelector('#dash-next').addEventListener('click', () => navigate(1));
    container.querySelector('#dash-today').addEventListener('click', () => { currentDate = new Date(); renderContent(); });
    container.querySelectorAll('.range-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        currentRange = btn.dataset.range;
        container.querySelectorAll('.range-tab').forEach(b => b.classList.toggle('active', b === btn));
        renderContent();
      });
    });

    renderContent();
  }

  function navigate(dir) {
    if (currentRange === 'daily') {
      currentDate.setDate(currentDate.getDate() + dir);
    } else if (currentRange === 'weekly') {
      currentDate.setDate(currentDate.getDate() + dir * 7);
    } else {
      currentDate.setMonth(currentDate.getMonth() + dir);
    }
    renderContent();
  }

  async function renderContent() {
    const label = document.getElementById('dash-date-label');
    const content = document.getElementById('dash-content');
    if (!label || !content) return;

    if (currentRange === 'daily') {
      label.textContent = formatDate(currentDate);
      await renderDaily(content);
    } else if (currentRange === 'weekly') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      label.textContent = `${formatDate(weekStart)} — ${formatDate(weekEnd)}`;
      await renderWeekly(content, weekStart, weekEnd);
    } else {
      label.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      await renderMonthly(content);
    }
  }

  // ===== DAILY VIEW =====
  function avgIndicator(current, avg, isTime, label) {
    const tag = label || 'avg';
    if (avg === null || avg === undefined) return '';
    if (!avg && !current) return `<div class="stat-avg stat-avg-flat">${tag}: 0</div>`;
    if (!avg || avg === 0) return `<div class="stat-avg stat-avg-flat">${tag}: 0</div>`;
    const diff = current - avg;
    const pct = Math.round((diff / avg) * 100);
    const absPct = Math.abs(pct);
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '▸';
    const cls = pct > 5 ? 'stat-avg-up' : pct < -5 ? 'stat-avg-down' : 'stat-avg-flat';
    const avgStr = isTime ? formatHours(avg) : formatNum(Math.round(avg));
    if (absPct < 1) return `<div class="stat-avg ${cls}">▸ ${tag} ${avgStr}</div>`;
    return `<div class="stat-avg ${cls}">${arrow} ${absPct}% vs ${avgStr} ${tag}</div>`;
  }

  async function renderDaily(container) {
    const dateStr = getDateStr(currentDate);
    let data;
    const today = getDateStr(new Date());
    if (dateStr === today) {
      data = await spirosAPI.getToday();
    } else {
      const range = await spirosAPI.getRange(dateStr, dateStr);
      data = range[0] || { date: dateStr, entries: [], summary: {
        totalMs: 0, totalClicks: 0, totalRightClicks: 0, totalKeys: 0,
        totalLetters: 0, totalWords: 0, totalScrolls: 0, totalEvents: 0,
        byCategory: {}, byApp: {}, topSites: {}
      }};
    }

    const summary = data.summary || {
      totalMs: 0, totalClicks: 0, totalRightClicks: 0, totalKeys: 0,
      totalLetters: 0, totalWords: 0, totalScrolls: 0, totalEvents: 0,
      byCategory: {}, byApp: {}, topSites: {}
    };
    const categories = settings.categories || {};

    const totalClicks = (summary.totalClicks || 0) + (summary.totalRightClicks || 0);
    const totalKeys = summary.totalKeys || 0;
    const totalWords = summary.totalWords || 0;
    const totalScrolls = summary.totalScrolls || 0;
    const totalEvents = summary.totalEvents || 0;

    // Compute daily averages from ALL available data
    let avgMs = 0, avgApps = 0, avgCategories = 0, avgEvents = 0;
    try {
      // Fetch all data up to yesterday
      const allDays = await spirosAPI.getRange('2020-01-01', getDateStr(currentDate));
      const daysWithData = allDays.filter(d => d.summary && d.summary.totalMs > 0);
      if (daysWithData.length > 0) {
        const n = daysWithData.length;
        avgMs = daysWithData.reduce((s, d) => s + (d.summary.totalMs || 0), 0) / n;
        avgApps = daysWithData.reduce((s, d) => s + Object.keys(d.summary.byApp || {}).length, 0) / n;
        avgCategories = daysWithData.reduce((s, d) => s + Object.keys(d.summary.byCategory || {}).length, 0) / n;
        avgEvents = daysWithData.reduce((s, d) => s + (d.summary.totalEvents || 0), 0) / n;
      }
    } catch (e) { /* averages unavailable */ }

    // Category donut data
    const donutData = Object.entries(summary.byCategory || {})
      .sort((a, b) => b[1] - a[1])
      .map(([cat, ms]) => ({
        label: cat,
        value: ms,
        color: (categories[cat] && categories[cat].color) || '#78909c'
      }));

    // Top apps
    const topApps = Object.entries(summary.byApp || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Top sites
    const topSites = Object.entries(summary.topSites || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Activity log: split into pinned active entries + recent history
    const allEntries = data.entries || [];

    // Find the current active fg and bg entries (only if recent)
    const now = Date.now();
    const staleThresholdMs = 180000; // 3 min — covers input-idle gaps while still filtering truly stale entries
    let activeFg = null, activeBg = null;
    for (let i = allEntries.length - 1; i >= 0; i--) {
      const e = allEntries[i];
      const entryEnd = (e.ts || 0) + (e.dur || 0);
      const isRecent = (now - entryEnd) < staleThresholdMs;
      if (!activeBg && e.bg && isRecent) activeBg = e;
      if (!activeFg && !e.bg && isRecent) activeFg = e;
      if (activeFg && activeBg) break;
      // Stop searching once entries are older than threshold
      if (!isRecent && activeFg !== null && activeBg !== null) break;
    }

    // Pinned entries (active now) — always at top
    const pinnedEntries = [activeFg, activeBg].filter(Boolean);
    const pinnedTs = new Set(pinnedEntries.map(e => e.ts));

    // Rest of the log (exclude pinned, show last 20)
    const historyEntries = allEntries.filter(e => !pinnedTs.has(e.ts)).slice(-18).reverse();

    container.innerHTML = `
      <div class="dash-stats-row">
        <div class="stat-card glass" data-tooltip="Total non-idle tracked time today">
          <div class="stat-value">${formatHours(summary.totalMs)}</div>
          <div class="stat-label">Total Active</div>
          ${avgIndicator(summary.totalMs, avgMs, true, 'avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Number of distinct apps detected">
          <div class="stat-value">${Object.keys(summary.byApp || {}).length}</div>
          <div class="stat-label">Apps Used</div>
          ${avgIndicator(Object.keys(summary.byApp || {}).length, avgApps, false, 'avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Activity types recorded today">
          <div class="stat-value">${Object.keys(summary.byCategory || {}).length}</div>
          <div class="stat-label">Categories</div>
          ${avgIndicator(Object.keys(summary.byCategory || {}).length, avgCategories, false, 'avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Total input events: clicks, keys, scrolls, app switches">
          <div class="stat-value">${formatNum(totalEvents)}</div>
          <div class="stat-label">Events</div>
          ${avgIndicator(totalEvents, avgEvents, false, 'avg')}
        </div>
      </div>

      ${privacySettings && privacySettings.trackKeystrokes ? `<div class="dash-input-stats-row">
        <div class="input-stat-card glass" data-tooltip="Left and right mouse clicks combined (${summary.totalClicks || 0} left, ${summary.totalRightClicks || 0} right)">
          <div class="input-stat-value">${formatNum(totalClicks)}</div>
          <div class="input-stat-label">Clicks</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Total keyboard key presses">
          <div class="input-stat-value">${formatNum(totalKeys)}</div>
          <div class="input-stat-label">Keystrokes</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Approximate words (space/enter presses)">
          <div class="input-stat-value">${formatNum(totalWords)}</div>
          <div class="input-stat-label">Words Typed</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Mouse scroll wheel ticks">
          <div class="input-stat-value">${formatNum(totalScrolls)}</div>
          <div class="input-stat-label">Scroll</div>
        </div>
      </div>` : ''}

      <div class="dash-grid">
        <div class="dash-card glass wide" style="position:relative">
          <h3 class="card-title" data-tooltip="Hour-by-hour activity colored by category">Timeline</h3>
          <canvas id="chart-timeline" class="chart-timeline"></canvas>
          <div id="timeline-tooltip" class="timeline-tooltip"></div>
        </div>

        <div class="dash-card glass">
          <h3 class="card-title" data-tooltip="Time split across activity types">Categories</h3>
          <canvas id="chart-donut" class="chart-donut"></canvas>
          <div class="legend" id="cat-legend"></div>
        </div>

        <div class="dash-card glass">
          <h3 class="card-title" data-tooltip="Apps ranked by total time spent">Top Apps</h3>
          <div class="app-list" id="top-apps"></div>
        </div>

        ${topSites.length > 0 && privacySettings && privacySettings.trackDomains ? `
        <div class="dash-card glass">
          <h3 class="card-title" data-tooltip="Most visited websites by time">Top Sites</h3>
          <div class="app-list" id="top-sites"></div>
        </div>` : ''}

        <div class="dash-card glass wide">
          <h3 class="card-title" data-tooltip="Live feed of activity sessions — current session highlighted">Activity Log</h3>
          <div class="activity-log-wrapper">
            <table class="activity-log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>App</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Clicks</th>
                  <th>Keys</th>
                </tr>
              </thead>
              <tbody>
                ${pinnedEntries.length === 0 && historyEntries.length === 0 ?
                  '<tr><td colspan="6" class="activity-log-empty">No activity recorded yet</td></tr>' :
                  (function() {
                    function renderRow(e, pinned) {
                      const time = new Date(e.ts);
                      const hh = String(time.getHours()).padStart(2, '0');
                      const mm = String(time.getMinutes()).padStart(2, '0');
                      const catColor = (categories[e.cat] && categories[e.cat].color) || '#78909c';
                      const rowClass = pinned ? (e.bg ? 'activity-row-active activity-row-bg' : 'activity-row-active') : (e.bg ? 'activity-row-bg' : '');
                      const durMs = e.dur || 0;
                      const durStr = durMs < 60000 ? Math.round(durMs / 1000) + 's' :
                        durMs < 3600000 ? Math.round(durMs / 60000) + 'm' :
                        Math.floor(durMs / 3600000) + 'h ' + Math.round((durMs % 3600000) / 60000) + 'm';
                      const bgBadge = e.bg ? '<span class="bg-badge">BG</span>' : '';
                      const displayKeys = (privacySettings && !privacySettings.trackKeystrokes) ? '-' : (e.keys || 0);
                      return '<tr class="' + rowClass + '">' +
                        '<td>' + hh + ':' + mm + '</td>' +
                        '<td>' + bgBadge + escapeHtml(e.app || 'Unknown') + '</td>' +
                        '<td class="activity-log-cat"><span class="cat-dot" style="background:' + catColor + '"></span>' + escapeHtml(e.cat || 'unknown') + '</td>' +
                        '<td>' + durStr + '</td>' +
                        '<td>' + ((e.clicks || 0) + (e.rightClicks || 0)) + '</td>' +
                        '<td>' + displayKeys + '</td></tr>';
                    }
                    let rows = pinnedEntries.map(e => renderRow(e, true)).join('');
                    if (pinnedEntries.length > 0 && historyEntries.length > 0) {
                      rows += '<tr class="activity-log-divider"><td colspan="6"></td></tr>';
                    }
                    rows += historyEntries.map(e => renderRow(e, false)).join('');
                    return rows;
                  })()
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="dash-card glass wide">
          <h3 class="card-title" data-tooltip="Complete challenges to earn bonus XP">Weekly Challenges</h3>
          <div id="dash-challenges" class="dash-challenges">
            <div class="lb-loading">Loading challenges...</div>
          </div>
        </div>

        ${(window.requiresTier && window.requiresTier('pro')) ? `
        <div class="dash-card glass wide" id="pro-analytics-section">
          <h3 class="card-title" data-tooltip="Advanced analytics (Pro)">Pro Analytics</h3>
          <div id="pro-analytics-content" class="lb-loading">Loading analytics...</div>
        </div>
        ` : ''}
      </div>
    `;

    // Load challenges widget after DOM update
    renderChallengesWidget();

    // Load Pro analytics if applicable
    if (window.requiresTier && window.requiresTier('pro')) {
      renderProAnalytics(data, summary, categories);
    }

    // Render charts after DOM update
    requestAnimationFrame(() => {
      const timelineCanvas = document.getElementById('chart-timeline');
      if (timelineCanvas) {
        Charts.drawTimeline(timelineCanvas, data.entries || [], categories);

        // Timeline hover tooltip
        const tooltip = document.getElementById('timeline-tooltip');
        if (tooltip) {
          timelineCanvas.addEventListener('mousemove', (e) => {
            const rect = timelineCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = Charts.getTimelineEntryAt(x, y);

            if (hit) {
              const entry = hit.entry;
              const startTime = Charts.formatTime12h(new Date(entry.ts));
              const endTime = Charts.formatTime12h(new Date(entry.ts + (entry.dur || 0)));
              const durMs = entry.dur || 0;
              const durStr = durMs < 60000 ? Math.round(durMs / 1000) + 's' :
                durMs < 3600000 ? Math.round(durMs / 60000) + 'm' :
                Math.floor(durMs / 3600000) + 'h ' + Math.round((durMs % 3600000) / 60000) + 'm';
              const app = entry.app || 'Unknown';
              const cat = entry.cat || 'other';

              tooltip.innerHTML = `<span class="tt-app">${escapeHtml(app)}</span>` +
                `<span class="tt-cat"><span class="cat-dot" style="background:${hit.catColor}"></span>${escapeHtml(cat)}</span>` +
                `<span class="tt-time">${startTime} – ${endTime}</span>` +
                `<span class="tt-dur">${durStr}</span>`;
              tooltip.style.display = 'block';

              // Position tooltip near cursor but keep in bounds
              const cardRect = timelineCanvas.closest('.dash-card').getBoundingClientRect();
              let tx = e.clientX - cardRect.left + 12;
              let ty = e.clientY - cardRect.top - tooltip.offsetHeight - 8;
              if (ty < 0) ty = e.clientY - cardRect.top + 16;
              if (tx + tooltip.offsetWidth > cardRect.width - 8) tx = tx - tooltip.offsetWidth - 24;
              tooltip.style.left = tx + 'px';
              tooltip.style.top = ty + 'px';
            } else {
              tooltip.style.display = 'none';
            }
          });

          timelineCanvas.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });
        }
      }

      const donutCanvas = document.getElementById('chart-donut');
      if (donutCanvas) Charts.drawDonutChart(donutCanvas, donutData, {
        centerLabel: formatHours(summary.totalMs),
        centerSub: 'active'
      });

      // Legend
      const legendEl = document.getElementById('cat-legend');
      if (legendEl) {
        legendEl.innerHTML = donutData.map(d => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${d.color}"></span>
            <span class="legend-label">${escapeHtml(d.label)}</span>
            <span class="legend-value">${formatHours(d.value)}</span>
          </div>
        `).join('');
      }

      // Top apps list
      const appsEl = document.getElementById('top-apps');
      if (appsEl) {
        const maxApp = topApps[0] ? topApps[0][1] : 1;
        appsEl.innerHTML = topApps.map(([app, ms]) => {
          const pct = (ms / maxApp) * 100;
          const cat = findCategoryForApp(app);
          const color = (categories[cat] && categories[cat].color) || '#78909c';
          return `
            <div class="app-item">
              <div class="app-info">
                <span class="app-name">${escapeHtml(app)}</span>
                <span class="app-time">${formatHours(ms)}</span>
              </div>
              <div class="app-bar"><div class="app-bar-fill" style="width:${pct}%;background:${color}"></div></div>
            </div>
          `;
        }).join('');
      }

      // Top sites
      const sitesEl = document.getElementById('top-sites');
      if (sitesEl && topSites.length > 0) {
        const maxSite = topSites[0][1];
        sitesEl.innerHTML = topSites.map(([site, ms]) => {
          const pct = (ms / maxSite) * 100;
          return `
            <div class="app-item">
              <div class="app-info">
                <span class="app-name">${escapeHtml(site)}</span>
                <span class="app-time">${formatHours(ms)}</span>
              </div>
              <div class="app-bar"><div class="app-bar-fill" style="width:${pct}%;background:#448aff"></div></div>
            </div>
          `;
        }).join('');
      }
    });
  }

  // ===== WEEKLY VIEW =====
  async function renderWeekly(container, weekStart, weekEnd) {
    const rangeData = await spirosAPI.getRange(getDateStr(weekStart), getDateStr(weekEnd));
    const categories = settings.categories || {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Build per-day data
    let totalMs = 0;
    let weekClicks = 0, weekKeys = 0, weekWords = 0, weekScrolls = 0, weekEvents = 0;
    const dailyTotals = [];
    const stackedData = [];
    const catTotals = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = getDateStr(d);
      const dayData = rangeData.find(r => r.date === dateStr);
      const daySummary = dayData ? dayData.summary : { totalMs: 0, byCategory: {} };

      totalMs += daySummary.totalMs;
      dailyTotals.push(daySummary.totalMs);
      weekClicks += (daySummary.totalClicks || 0) + (daySummary.totalRightClicks || 0);
      weekKeys += (daySummary.totalKeys || 0);
      weekWords += (daySummary.totalWords || 0);
      weekScrolls += (daySummary.totalScrolls || 0);
      weekEvents += (daySummary.totalEvents || 0);

      const values = {};
      for (const [cat, ms] of Object.entries(daySummary.byCategory || {})) {
        values[cat] = ms;
        catTotals[cat] = (catTotals[cat] || 0) + ms;
      }
      stackedData.push({ label: dayNames[i], values });
    }

    const avgMs = totalMs / 7;

    // Compute weekly averages from ALL available data (including current week)
    let avgWeekTotal = 0, avgWeekDailyAvg = 0, avgWeekActiveDays = 0, avgWeekEvents = 0;
    try {
      const allDays = await spirosAPI.getRange('2020-01-01', getDateStr(weekEnd));
      const weeks = {};
      for (const day of allDays) {
        if (!day.summary || !day.summary.totalMs) continue;
        const dd = new Date(day.date);
        const sun = new Date(dd); sun.setDate(dd.getDate() - dd.getDay());
        const wk = getDateStr(sun);
        if (!weeks[wk]) weeks[wk] = { totalMs: 0, activeDays: 0, events: 0 };
        weeks[wk].totalMs += day.summary.totalMs;
        if (day.summary.totalMs >= 3600000) weeks[wk].activeDays++;
        weeks[wk].events += (day.summary.totalEvents || 0);
      }
      const wkArr = Object.values(weeks);
      if (wkArr.length > 0) {
        const n = wkArr.length;
        avgWeekTotal = wkArr.reduce((s, w) => s + w.totalMs, 0) / n;
        avgWeekDailyAvg = avgWeekTotal / 7;
        avgWeekActiveDays = wkArr.reduce((s, w) => s + w.activeDays, 0) / n;
        avgWeekEvents = wkArr.reduce((s, w) => s + w.events, 0) / n;
      }
    } catch (e) { /* averages unavailable */ }

    // Category bar data
    const catBarData = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, ms]) => ({
        label: cat,
        value: ms,
        color: (categories[cat] && categories[cat].color) || '#78909c'
      }));

    const weekActiveDays = dailyTotals.filter(d => d > 3600000).length;
    container.innerHTML = `
      <div class="dash-stats-row">
        <div class="stat-card glass" data-tooltip="Total tracked time this week">
          <div class="stat-value">${formatHours(totalMs)}</div>
          <div class="stat-label">Weekly Total</div>
          ${avgIndicator(totalMs, avgWeekTotal, true, 'wk avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Average daily tracked time">
          <div class="stat-value">${formatHours(avgMs)}</div>
          <div class="stat-label">Daily Average</div>
          ${avgIndicator(avgMs, avgWeekDailyAvg, true, 'wk avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Days with over 1 hour of activity">
          <div class="stat-value">${weekActiveDays}/7</div>
          <div class="stat-label">Active Days</div>
          ${avgIndicator(weekActiveDays, avgWeekActiveDays, false, 'wk avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Total input events: clicks, keys, scrolls, app switches">
          <div class="stat-value">${formatNum(weekEvents)}</div>
          <div class="stat-label">Events</div>
          ${avgIndicator(weekEvents, avgWeekEvents, false, 'wk avg')}
        </div>
      </div>

      ${privacySettings && privacySettings.trackKeystrokes ? `<div class="dash-input-stats-row">
        <div class="input-stat-card glass" data-tooltip="Total mouse clicks this week">
          <div class="input-stat-value">${formatNum(weekClicks)}</div>
          <div class="input-stat-label">Clicks</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Total key presses this week">
          <div class="input-stat-value">${formatNum(weekKeys)}</div>
          <div class="input-stat-label">Keystrokes</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Approximate words typed this week">
          <div class="input-stat-value">${formatNum(weekWords)}</div>
          <div class="input-stat-label">Words Typed</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Scroll wheel ticks this week">
          <div class="input-stat-value">${formatNum(weekScrolls)}</div>
          <div class="input-stat-label">Scroll</div>
        </div>
      </div>` : ''}

      <div class="dash-grid">
        <div class="dash-card glass wide">
          <h3 class="card-title" data-tooltip="Daily activity stacked by category">Daily Breakdown</h3>
          <canvas id="chart-stacked" class="chart-stacked"></canvas>
        </div>

        <div class="dash-card glass">
          <h3 class="card-title" data-tooltip="Time per category this week">Category Totals</h3>
          <canvas id="chart-cat-bar" class="chart-bar"></canvas>
        </div>

        <div class="dash-card glass">
          <h3 class="card-title" data-tooltip="Proportional time split across categories">Category Split</h3>
          <canvas id="chart-week-donut" class="chart-donut"></canvas>
          <div class="legend" id="week-legend"></div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      const stackedCanvas = document.getElementById('chart-stacked');
      if (stackedCanvas) Charts.drawStackedBarChart(stackedCanvas, stackedData, categories);

      const barCanvas = document.getElementById('chart-cat-bar');
      if (barCanvas) Charts.drawBarChart(barCanvas, catBarData);

      const donutCanvas = document.getElementById('chart-week-donut');
      if (donutCanvas) Charts.drawDonutChart(donutCanvas, catBarData, {
        centerLabel: formatHours(totalMs),
        centerSub: 'this week'
      });

      const legendEl = document.getElementById('week-legend');
      if (legendEl) {
        legendEl.innerHTML = catBarData.map(d => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${d.color}"></span>
            <span class="legend-label">${escapeHtml(d.label)}</span>
            <span class="legend-value">${formatHours(d.value)}</span>
          </div>
        `).join('');
      }
    });
  }

  // ===== MONTHLY VIEW =====
  async function renderMonthly(container) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const rangeData = await spirosAPI.getRange(getDateStr(firstDay), getDateStr(lastDay));
    const categories = settings.categories || {};

    // Build heatmap data and totals
    const heatmapData = {};
    let totalMs = 0;
    let monthClicks = 0, monthKeys = 0, monthWords = 0, monthScrolls = 0, monthEvents = 0;
    const catTotals = {};
    let activeDays = 0;

    const lineData = [];

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = getDateStr(dateObj);
      const dayData = rangeData.find(r => r.date === dateStr);
      const dayMs = dayData ? dayData.summary.totalMs : 0;
      const daySummary = dayData ? dayData.summary : {};

      heatmapData[dateStr] = dayMs;
      totalMs += dayMs;
      if (dayMs >= 3600000) activeDays++;
      monthClicks += (daySummary.totalClicks || 0) + (daySummary.totalRightClicks || 0);
      monthKeys += (daySummary.totalKeys || 0);
      monthWords += (daySummary.totalWords || 0);
      monthScrolls += (daySummary.totalScrolls || 0);
      monthEvents += (daySummary.totalEvents || 0);

      lineData.push({ label: `${d}`, value: dayMs });

      if (dayData) {
        for (const [cat, ms] of Object.entries(dayData.summary.byCategory || {})) {
          catTotals[cat] = (catTotals[cat] || 0) + ms;
        }
      }
    }

    const catDonutData = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, ms]) => ({
        label: cat,
        value: ms,
        color: (categories[cat] && categories[cat].color) || '#78909c'
      }));

    // Compute monthly averages from ALL available data (including current month)
    let avgMonthTotal = 0, avgMonthActiveDays = 0, avgMonthDailyAvg = 0, avgMonthEvents = 0;
    try {
      const allDays = await spirosAPI.getRange('2020-01-01', getDateStr(lastDay));
      const months = {};
      for (const day of allDays) {
        if (!day.summary || !day.summary.totalMs) continue;
        const mk = day.date.slice(0, 7); // "YYYY-MM"
        if (!months[mk]) months[mk] = { totalMs: 0, activeDays: 0, events: 0 };
        months[mk].totalMs += day.summary.totalMs;
        if (day.summary.totalMs >= 3600000) months[mk].activeDays++;
        months[mk].events += (day.summary.totalEvents || 0);
      }
      const mArr = Object.values(months);
      if (mArr.length > 0) {
        const n = mArr.length;
        avgMonthTotal = mArr.reduce((s, m) => s + m.totalMs, 0) / n;
        avgMonthActiveDays = mArr.reduce((s, m) => s + m.activeDays, 0) / n;
        avgMonthDailyAvg = avgMonthActiveDays > 0 ? avgMonthTotal / avgMonthActiveDays : 0;
        avgMonthEvents = mArr.reduce((s, m) => s + m.events, 0) / n;
      }
    } catch (e) { /* averages unavailable */ }

    const dailyAvg = activeDays > 0 ? totalMs / activeDays : 0;
    container.innerHTML = `
      <div class="dash-stats-row">
        <div class="stat-card glass" data-tooltip="Total tracked time this month">
          <div class="stat-value">${formatHours(totalMs)}</div>
          <div class="stat-label">Monthly Total</div>
          ${avgIndicator(totalMs, avgMonthTotal, true, 'mo avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Days with over 1 hour of activity">
          <div class="stat-value">${activeDays}</div>
          <div class="stat-label">Active Days</div>
          ${avgIndicator(activeDays, avgMonthActiveDays, false, 'mo avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Average time on active days">
          <div class="stat-value">${formatHours(dailyAvg)}</div>
          <div class="stat-label">Daily Average</div>
          ${avgIndicator(dailyAvg, avgMonthDailyAvg, true, 'mo avg')}
        </div>
        <div class="stat-card glass" data-tooltip="Total input events: clicks, keys, scrolls, app switches">
          <div class="stat-value">${formatNum(monthEvents)}</div>
          <div class="stat-label">Events</div>
          ${avgIndicator(monthEvents, avgMonthEvents, false, 'mo avg')}
        </div>
      </div>

      ${privacySettings && privacySettings.trackKeystrokes ? `<div class="dash-input-stats-row">
        <div class="input-stat-card glass" data-tooltip="Total mouse clicks this month">
          <div class="input-stat-value">${formatNum(monthClicks)}</div>
          <div class="input-stat-label">Clicks</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Total key presses this month">
          <div class="input-stat-value">${formatNum(monthKeys)}</div>
          <div class="input-stat-label">Keystrokes</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Approximate words typed this month">
          <div class="input-stat-value">${formatNum(monthWords)}</div>
          <div class="input-stat-label">Words Typed</div>
        </div>
        <div class="input-stat-card glass" data-tooltip="Scroll wheel ticks this month">
          <div class="input-stat-value">${formatNum(monthScrolls)}</div>
          <div class="input-stat-label">Scroll</div>
        </div>
      </div>` : ''}

      <div class="dash-grid">
        <div class="dash-card glass wide">
          <h3 class="card-title" data-tooltip="Daily activity intensity across the month">Activity Heatmap</h3>
          <canvas id="chart-heatmap" class="chart-heatmap"></canvas>
        </div>

        <div class="dash-card glass wide">
          <h3 class="card-title" data-tooltip="Daily tracked time trend line">Daily Trend</h3>
          <canvas id="chart-trend" class="chart-line"></canvas>
        </div>

        <div class="dash-card glass">
          <h3 class="card-title" data-tooltip="Time split across activity types this month">Category Breakdown</h3>
          <canvas id="chart-month-donut" class="chart-donut"></canvas>
          <div class="legend" id="month-legend"></div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      const heatmapCanvas = document.getElementById('chart-heatmap');
      if (heatmapCanvas) Charts.drawHeatmap(heatmapCanvas, heatmapData);

      const trendCanvas = document.getElementById('chart-trend');
      if (trendCanvas) Charts.drawLineChart(trendCanvas, lineData, { color: '#00e676' });

      const donutCanvas = document.getElementById('chart-month-donut');
      if (donutCanvas) Charts.drawDonutChart(donutCanvas, catDonutData, {
        centerLabel: formatHours(totalMs),
        centerSub: 'this month'
      });

      const legendEl = document.getElementById('month-legend');
      if (legendEl) {
        legendEl.innerHTML = catDonutData.map(d => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${d.color}"></span>
            <span class="legend-label">${escapeHtml(d.label)}</span>
            <span class="legend-value">${formatHours(d.value)}</span>
          </div>
        `).join('');
      }
    });
  }

  // Helper: find category for an app name
  function findCategoryForApp(appName) {
    if (!settings || !settings.categories) return 'other';
    const lower = appName.toLowerCase();
    for (const [catName, catDef] of Object.entries(settings.categories)) {
      if (catName === 'other') continue;
      for (const pattern of catDef.patterns) {
        if (lower.includes(pattern.toLowerCase())) return catName;
      }
    }
    return 'other';
  }

  // ===== Weekly Challenges Widget =====
  async function renderChallengesWidget() {
    const widgetEl = document.getElementById('dash-challenges');
    if (!widgetEl) return;

    // Pro required for weekly challenges
    if (!(window.requiresTier && window.requiresTier('pro'))) {
      widgetEl.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:16px">
          <p>&#x1F512; Weekly Challenges require Pro</p>
          <p style="font-size:6px;color:var(--text-dim);margin-top:4px">Complete challenges to earn bonus XP each week</p>
          <button class="btn-pixel btn-sm" id="btn-upgrade-challenges" style="margin-top:8px">Upgrade to Pro</button>
        </div>
      `;
      widgetEl.querySelector('#btn-upgrade-challenges')?.addEventListener('click', () => {
        if (window.showUpgradeModal) window.showUpgradeModal('Weekly Challenges', 'pro');
      });
      return;
    }

    try {
      const challenges = await spirosAPI.getWeeklyChallenges();
      if (!challenges || challenges.length === 0) {
        widgetEl.innerHTML = '<div style="color:var(--text-dim);font-size:7px">No challenges this week</div>';
        return;
      }

      widgetEl.innerHTML = challenges.map(c => {
        const target = Number(c.target_value) || 1;
        const current = c.computed_current || 0;
        const pct = Math.min(100, Math.round((current / target) * 100));
        const completed = c.completed || pct >= 100;
        const completedClass = completed ? ' challenge-complete' : '';

        return `
          <div class="challenge-card${completedClass}" data-challenge-id="${c.id}">
            <div class="challenge-card-top">
              <div class="challenge-card-title">${completed ? '✓ ' : ''}${escapeHtml(c.title)}</div>
              <div class="challenge-reward">${c.xp_reward} XP</div>
            </div>
            <div class="challenge-card-desc">${escapeHtml(c.description)}</div>
            <div class="challenge-progress-bar">
              <div class="challenge-progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="challenge-progress-label">${pct}%${completed && !c.completed ? ' — Click to claim!' : ''}</div>
          </div>
        `;
      }).join('');

      // Wire claim click on completed but unclaimed challenges
      widgetEl.querySelectorAll('.challenge-card').forEach(card => {
        card.addEventListener('click', async () => {
          const id = card.dataset.challengeId;
          // Find challenge
          const ch = challenges.find(c => c.id === id);
          if (!ch) return;
          const target = Number(ch.target_value) || 1;
          const current = ch.computed_current || 0;
          const pct = Math.min(100, Math.round((current / target) * 100));
          if (pct >= 100 && !ch.completed) {
            const result = await spirosAPI.completeChallenge(id);
            if (result.success) {
              renderChallengesWidget();
            }
          }
        });
      });
    } catch (e) {
      widgetEl.innerHTML = '<div style="color:var(--text-dim);font-size:7px">Could not load challenges</div>';
    }
  }

  // ===== Pro Analytics (daily view extra) =====
  async function renderProAnalytics(todayData, summary, categories) {
    const el = document.getElementById('pro-analytics-content');
    if (!el) return;

    try {
      // Fetch last 28 days for trend analysis
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 27);
      const rangeData = await spirosAPI.getRange(getDateStr(startDate), getDateStr(endDate));

      // 4-week productivity trend
      const weeks = [[], [], [], []];
      for (let i = 0; i < 28; i++) {
        const weekIdx = Math.floor(i / 7);
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = getDateStr(d);
        const dayData = rangeData.find(r => r.date === dateStr);
        weeks[weekIdx].push(dayData?.summary?.totalMs || 0);
      }
      const weekTotals = weeks.map(w => w.reduce((s, v) => s + v, 0));

      // Peak hours from today's entries
      const hourBuckets = new Array(24).fill(0);
      for (const entry of (todayData.entries || [])) {
        const hour = new Date(entry.ts).getHours();
        hourBuckets[hour] += (entry.dur || 0);
      }

      // Category breakdown over time (last 7 days)
      const last7 = rangeData.slice(-7);
      const catTimeline = {};
      for (const day of last7) {
        for (const [cat, ms] of Object.entries(day.summary?.byCategory || {})) {
          if (!catTimeline[cat]) catTimeline[cat] = [];
          catTimeline[cat].push(ms);
        }
      }

      // Render
      const trendHtml = weekTotals.map((ms, i) => {
        const label = i === 3 ? 'This Week' : `${3 - i} wk ago`;
        const pct = weekTotals[0] > 0 ? Math.round((ms / Math.max(...weekTotals)) * 100) : 0;
        return `<div class="app-item"><div class="app-info"><span class="app-name">${label}</span><span class="app-time">${formatHours(ms)}</span></div><div class="app-bar"><div class="app-bar-fill" style="width:${pct}%;background:#00e676"></div></div></div>`;
      }).join('');

      const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
      const peakHoursHtml = hourBuckets.map((ms, h) => {
        const maxMs = Math.max(...hourBuckets) || 1;
        const intensity = Math.round((ms / maxMs) * 4);
        const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
        return `<div class="heatmap-cell" data-level="${intensity}" title="${label}: ${formatHours(ms)}" style="width:12px;height:12px"></div>`;
      }).join('');

      el.innerHTML = `
        <div style="margin-bottom:12px">
          <h4 style="font-size:7px;margin-bottom:6px">4-Week Productivity Trend</h4>
          ${trendHtml}
        </div>
        <div style="margin-bottom:12px">
          <h4 style="font-size:7px;margin-bottom:6px">Peak Hours Today ${peakHour >= 0 && Math.max(...hourBuckets) > 0 ? '(Peak: ' + (peakHour === 0 ? '12am' : peakHour < 12 ? peakHour + 'am' : peakHour === 12 ? '12pm' : (peakHour - 12) + 'pm') + ')' : ''}</h4>
          <div style="display:flex;gap:2px;flex-wrap:wrap">${peakHoursHtml}</div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:7px">Could not load analytics</div>';
    }
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Refresh just today's data (called on activity:update)
  async function refreshIfDaily() {
    if (currentRange !== 'daily') return;
    const todayStr = getDateStr(new Date());
    const viewStr = getDateStr(currentDate);
    if (todayStr !== viewStr) return;
    const content = document.getElementById('dash-content');
    if (content) await renderDaily(content);
  }

  return { render, refreshIfDaily, renderChallengesWidget, currentRange: () => currentRange };
})();
