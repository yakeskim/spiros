// dashboard.js — Dashboard renderer (daily/weekly/monthly views)

const Dashboard = (() => {
  let currentRange = 'daily'; // daily | weekly | monthly
  let currentDate = new Date();
  let settings = null;

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
    settings = await synchronAPI.getSettings();

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
  async function renderDaily(container) {
    const dateStr = getDateStr(currentDate);
    let data;
    const today = getDateStr(new Date());
    if (dateStr === today) {
      data = await synchronAPI.getToday();
    } else {
      const range = await synchronAPI.getRange(dateStr, dateStr);
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

    // Find the current active fg and bg entries
    let activeFg = null, activeBg = null;
    for (let i = allEntries.length - 1; i >= 0; i--) {
      if (!activeBg && allEntries[i].bg) activeBg = allEntries[i];
      if (!activeFg && !allEntries[i].bg) activeFg = allEntries[i];
      if (activeFg && activeBg) break;
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
        </div>
        <div class="stat-card glass" data-tooltip="Number of distinct apps detected">
          <div class="stat-value">${Object.keys(summary.byApp || {}).length}</div>
          <div class="stat-label">Apps Used</div>
        </div>
        <div class="stat-card glass" data-tooltip="Activity types recorded today">
          <div class="stat-value">${Object.keys(summary.byCategory || {}).length}</div>
          <div class="stat-label">Categories</div>
        </div>
        <div class="stat-card glass" data-tooltip="Total input events: clicks, keys, scrolls, app switches">
          <div class="stat-value">${formatNum(totalEvents)}</div>
          <div class="stat-label">Events</div>
        </div>
      </div>

      <div class="dash-input-stats-row">
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
      </div>

      <div class="dash-grid">
        <div class="dash-card glass wide">
          <h3 class="card-title" data-tooltip="Hour-by-hour activity colored by category">Timeline</h3>
          <canvas id="chart-timeline" class="chart-timeline"></canvas>
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

        ${topSites.length > 0 ? `
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
                  <th>Title</th>
                  <th>Cat</th>
                  <th>Duration</th>
                  <th>Clicks</th>
                  <th>Keys</th>
                </tr>
              </thead>
              <tbody>
                ${pinnedEntries.length === 0 && historyEntries.length === 0 ?
                  '<tr><td colspan="7" class="activity-log-empty">No activity recorded yet</td></tr>' :
                  (function() {
                    function renderRow(e, pinned) {
                      const time = new Date(e.ts);
                      const hh = String(time.getHours()).padStart(2, '0');
                      const mm = String(time.getMinutes()).padStart(2, '0');
                      const titleShort = (e.title || '').length > 40 ? (e.title || '').slice(0, 40) + '...' : (e.title || '');
                      const catColor = (categories[e.cat] && categories[e.cat].color) || '#78909c';
                      const rowClass = pinned ? (e.bg ? 'activity-row-active activity-row-bg' : 'activity-row-active') : (e.bg ? 'activity-row-bg' : '');
                      const durMs = e.dur || 0;
                      const durStr = durMs < 60000 ? Math.round(durMs / 1000) + 's' :
                        durMs < 3600000 ? Math.round(durMs / 60000) + 'm' :
                        Math.floor(durMs / 3600000) + 'h ' + Math.round((durMs % 3600000) / 60000) + 'm';
                      const bgBadge = e.bg ? '<span class="bg-badge">BG</span>' : '';
                      return '<tr class="' + rowClass + '">' +
                        '<td>' + hh + ':' + mm + '</td>' +
                        '<td>' + bgBadge + (e.app || 'Unknown') + '</td>' +
                        '<td class="activity-log-title" title="' + (e.title || '').replace(/"/g, '&quot;') + '">' + titleShort + '</td>' +
                        '<td><span class="cat-dot" style="background:' + catColor + '"></span></td>' +
                        '<td>' + durStr + '</td>' +
                        '<td>' + ((e.clicks || 0) + (e.rightClicks || 0)) + '</td>' +
                        '<td>' + (e.keys || 0) + '</td></tr>';
                    }
                    let rows = pinnedEntries.map(e => renderRow(e, true)).join('');
                    if (pinnedEntries.length > 0 && historyEntries.length > 0) {
                      rows += '<tr class="activity-log-divider"><td colspan="7"></td></tr>';
                    }
                    rows += historyEntries.map(e => renderRow(e, false)).join('');
                    return rows;
                  })()
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Render charts after DOM update
    requestAnimationFrame(() => {
      const timelineCanvas = document.getElementById('chart-timeline');
      if (timelineCanvas) Charts.drawTimeline(timelineCanvas, data.entries || [], categories);

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
            <span class="legend-label">${d.label}</span>
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
                <span class="app-name">${app}</span>
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
                <span class="app-name">${site}</span>
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
    const rangeData = await synchronAPI.getRange(getDateStr(weekStart), getDateStr(weekEnd));
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

    // Category bar data
    const catBarData = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, ms]) => ({
        label: cat,
        value: ms,
        color: (categories[cat] && categories[cat].color) || '#78909c'
      }));

    container.innerHTML = `
      <div class="dash-stats-row">
        <div class="stat-card glass" data-tooltip="Total tracked time this week">
          <div class="stat-value">${formatHours(totalMs)}</div>
          <div class="stat-label">Weekly Total</div>
        </div>
        <div class="stat-card glass" data-tooltip="Average daily tracked time">
          <div class="stat-value">${formatHours(avgMs)}</div>
          <div class="stat-label">Daily Average</div>
        </div>
        <div class="stat-card glass" data-tooltip="Days with over 1 hour of activity">
          <div class="stat-value">${dailyTotals.filter(d => d > 3600000).length}/7</div>
          <div class="stat-label">Active Days</div>
        </div>
        <div class="stat-card glass" data-tooltip="Total input events: clicks, keys, scrolls, app switches">
          <div class="stat-value">${formatNum(weekEvents)}</div>
          <div class="stat-label">Events</div>
        </div>
      </div>

      <div class="dash-input-stats-row">
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
      </div>

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
            <span class="legend-label">${d.label}</span>
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

    const rangeData = await synchronAPI.getRange(getDateStr(firstDay), getDateStr(lastDay));
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

    container.innerHTML = `
      <div class="dash-stats-row">
        <div class="stat-card glass" data-tooltip="Total tracked time this month">
          <div class="stat-value">${formatHours(totalMs)}</div>
          <div class="stat-label">Monthly Total</div>
        </div>
        <div class="stat-card glass" data-tooltip="Days with over 1 hour of activity">
          <div class="stat-value">${activeDays}</div>
          <div class="stat-label">Active Days</div>
        </div>
        <div class="stat-card glass" data-tooltip="Average time on active days">
          <div class="stat-value">${formatHours(activeDays > 0 ? totalMs / activeDays : 0)}</div>
          <div class="stat-label">Daily Average</div>
        </div>
        <div class="stat-card glass" data-tooltip="Total input events: clicks, keys, scrolls, app switches">
          <div class="stat-value">${formatNum(monthEvents)}</div>
          <div class="stat-label">Events</div>
        </div>
      </div>

      <div class="dash-input-stats-row">
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
      </div>

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
            <span class="legend-label">${d.label}</span>
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

  // Refresh just today's data (called on activity:update)
  async function refreshIfDaily() {
    if (currentRange !== 'daily') return;
    const todayStr = getDateStr(new Date());
    const viewStr = getDateStr(currentDate);
    if (todayStr !== viewStr) return;
    const content = document.getElementById('dash-content');
    if (content) await renderDaily(content);
  }

  return { render, refreshIfDaily, currentRange: () => currentRange };
})();
