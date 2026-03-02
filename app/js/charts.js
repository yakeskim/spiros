// charts.js — Pixel-art Canvas chart renderers
// Chunky, no anti-aliasing, hard edges, retro RPG stat screens

const Charts = (() => {
  const PIXEL_FONT = '"Press Start 2P", monospace';
  const NEUTRAL_FONT = '"Inter", sans-serif';
  const GRID_COLOR = 'rgba(255,255,255,0.06)';
  const LABEL_COLOR = '#8888aa';
  const BORDER_COLOR = '#4a4e6e';
  const BG_INSET = '#0f0e17';

  function getFont() {
    const theme = document.documentElement.dataset.theme;
    if (theme === 'neutral') return NEUTRAL_FONT;
    if (theme === 'matrix') return '"JetBrains Mono", "Fira Code", monospace';
    return PIXEL_FONT;
  }

  /** Scale canvas font size by theme — pixel fonts render larger at same px */
  function fs(basePx) {
    const theme = document.documentElement.dataset.theme;
    if (theme === 'neutral') return Math.round(basePx * 1.5);
    if (theme === 'matrix') return Math.round(basePx * 1.3);
    return basePx;
  }

  function getInnerCircleFill() {
    const theme = document.documentElement.dataset.theme;
    return theme === 'neutral' ? '#1e1e2e' : '#1a1a2e';
  }

  function clearCanvas(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // Disable anti-aliasing for pixel look
    ctx.imageSmoothingEnabled = false;
    return { ctx, w: rect.width, h: rect.height };
  }

  // Pixel-perfect rectangle (snapped to integer coords)
  function pxRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // Pixel border around a rect (1px inset highlight, 1px shadow)
  function pxBorder(ctx, x, y, w, h) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    // Dark outer border
    ctx.fillStyle = '#111122';
    ctx.fillRect(x - 1, y - 1, w + 2, 1);
    ctx.fillRect(x - 1, y - 1, 1, h + 2);
    ctx.fillRect(x + w, y - 1, 1, h + 2);
    ctx.fillRect(x - 1, y + h, w + 2, 1);
  }

  // Draw inset panel background
  function drawInsetBg(ctx, x, y, w, h) {
    pxRect(ctx, x, y, w, h, BG_INSET);
    // Top-left shadow (dark)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    // Bottom-right highlight
    ctx.fillStyle = BORDER_COLOR;
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  /** Snap a ms value up to a nice round max so grid labels (max/4 steps) are clean times */
  function niceTimeMax(val) {
    // Each entry = step size; grid max = step * 4
    const steps = [
      60000, 120000, 300000, 600000, 900000,           // 1m 2m 5m 10m 15m
      1800000, 2700000, 3600000, 5400000,               // 30m 45m 1h 1.5h
      7200000, 10800000, 14400000, 18000000, 21600000,  // 2h 3h 4h 5h 6h
      28800000, 36000000, 43200000                       // 8h 10h 12h
    ];
    for (const step of steps) {
      if (step * 4 >= val) return step * 4;
    }
    // Fallback: round up to next 4-hour multiple
    return Math.ceil(val / 14400000) * 14400000;
  }

  // ===== BAR CHART =====
  function drawBarChart(canvas, data, opts = {}) {
    if (!canvas || !data || !data.length) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const padding = { top: 16, right: 16, bottom: 36, left: 48 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Inset background
    drawInsetBg(ctx, padding.left, padding.top, chartW, chartH);

    const rawMax = Math.max(...data.map(d => d.value), 1);
    const barWidth = Math.max(8, Math.floor((chartW / data.length) * 0.6));
    const totalSlot = chartW / data.length;
    const useLog = opts.log && rawMax > 0;
    const logMax = useLog ? Math.log10(rawMax + 1) : 0;
    const maxVal = useLog ? rawMax : niceTimeMax(rawMax);

    // Grid lines (dashed pixel style)
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(padding.top + (chartH * i / 4));
      ctx.fillStyle = GRID_COLOR;
      for (let px = padding.left; px < padding.left + chartW; px += 4) {
        ctx.fillRect(px, y, 2, 1);
      }
      // Label
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `${fs(7)}px ${getFont()}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const labelVal = useLog
        ? Math.pow(10, (1 - i / 4) * logMax) - 1
        : maxVal * (1 - i / 4);
      ctx.fillText(formatDuration(labelVal), padding.left - 6, y);
    }

    // Bars
    data.forEach((d, i) => {
      const x = Math.round(padding.left + i * totalSlot + (totalSlot - barWidth) / 2);
      const barH = useLog
        ? Math.round((Math.log10(d.value + 1) / logMax) * chartH)
        : Math.round((d.value / maxVal) * chartH);
      const y = padding.top + chartH - barH;

      // Bar body
      pxRect(ctx, x, y, barWidth, barH, d.color || '#4488ff');

      // Highlight stripe on left (2px lighter)
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x, y, 2, barH);

      // Shadow stripe on right
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + barWidth - 2, y, 2, barH);

      // Top highlight pixel line
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x, y, barWidth, 1);

      // Label
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `${fs(7)}px ${getFont()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = d.label.length > 5 ? d.label.slice(0, 4) + '..' : d.label;
      ctx.fillText(label, x + barWidth / 2, padding.top + chartH + 6);
    });
  }

  // ===== STACKED BAR CHART =====
  function drawStackedBarChart(canvas, data, categories, opts = {}) {
    if (!canvas || !data || !data.length) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const padding = { top: 16, right: 16, bottom: 36, left: 48 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    drawInsetBg(ctx, padding.left, padding.top, chartW, chartH);

    let maxVal = 1;
    for (const d of data) {
      let total = 0;
      for (const cat of Object.keys(categories)) total += (d.values[cat] || 0);
      maxVal = Math.max(maxVal, total);
    }

    const barWidth = Math.max(12, Math.floor((chartW / data.length) * 0.6));
    const totalSlot = chartW / data.length;

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(padding.top + (chartH * i / 4));
      ctx.fillStyle = GRID_COLOR;
      for (let px = padding.left; px < padding.left + chartW; px += 4) {
        ctx.fillRect(px, y, 2, 1);
      }
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `${fs(7)}px ${getFont()}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatDuration(maxVal * (1 - i / 4)), padding.left - 6, y);
    }

    // Stacked bars
    data.forEach((d, i) => {
      const x = Math.round(padding.left + i * totalSlot + (totalSlot - barWidth) / 2);
      let y = padding.top + chartH;

      for (const cat of Object.keys(categories)) {
        const val = d.values[cat] || 0;
        if (val === 0) continue;
        const barH = Math.round((val / maxVal) * chartH);
        y -= barH;

        pxRect(ctx, x, y, barWidth, barH, categories[cat].color || '#78909c');

        // Segment separator (1px dark line)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, y + barH - 1, barWidth, 1);
      }

      // Top highlight
      const topY = y;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, topY, barWidth, 1);

      // Label
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `${fs(7)}px ${getFont()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, x + barWidth / 2, padding.top + chartH + 6);
    });
  }

  // ===== DONUT CHART (pixel octagon style) =====
  // Donut slice hitbox storage
  let _donutSlices = [];
  let _donutCenter = { cx: 0, cy: 0, innerR: 0, outerR: 0 };

  function drawDonutChart(canvas, data, opts = {}) {
    if (!canvas || !data || !data.length) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 16;
    if (radius < 10) return; // canvas too small to draw
    const innerRadius = radius * 0.52;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;

    let angle = -Math.PI / 2;
    _donutSlices = [];
    _donutCenter = { cx, cy, innerR: innerRadius, outerR: radius };

    // Draw each slice
    data.forEach(d => {
      const sliceAngle = (d.value / total) * Math.PI * 2;
      _donutSlices.push({ startAngle: angle, endAngle: angle + sliceAngle, label: d.label, value: d.value, color: d.color, pct: ((d.value / total) * 100).toFixed(1) });

      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle, angle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, angle + sliceAngle, angle, true);
      ctx.closePath();
      ctx.fillStyle = d.color || '#4488ff';
      ctx.fill();

      // Hard separator line between slices (2px dark)
      ctx.strokeStyle = '#0f0e17';
      ctx.lineWidth = 2;
      ctx.stroke();

      angle += sliceAngle;
    });

    // Inner circle dark fill
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius - 1, 0, Math.PI * 2);
    ctx.fillStyle = getInnerCircleFill();
    ctx.fill();
    ctx.strokeStyle = '#111122';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight ring
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius - 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center text
    if (opts.centerLabel) {
      ctx.fillStyle = '#fffffe';
      ctx.font = `${fs(10)}px ${getFont()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.centerLabel, cx, cy - 6);
    }
    if (opts.centerSub) {
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `${fs(7)}px ${getFont()}`;
      ctx.textAlign = 'center';
      ctx.fillText(opts.centerSub, cx, cy + 8);
    }
  }

  function getDonutSliceAt(x, y) {
    const { cx, cy, innerR, outerR } = _donutCenter;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < innerR || dist > outerR) return null;
    let angle = Math.atan2(dy, dx);
    // Normalize to match start at -PI/2
    if (angle < -Math.PI / 2) angle += Math.PI * 2;
    for (const s of _donutSlices) {
      let start = s.startAngle, end = s.endAngle;
      // Normalize
      if (start < -Math.PI / 2) start += Math.PI * 2;
      if (end < -Math.PI / 2) end += Math.PI * 2;
      if (angle >= start && angle < end) return s;
    }
    return null;
  }

  function drawPieChart(canvas, data, opts = {}) {
    if (!canvas || !data || !data.length) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 16;
    if (radius < 10) return;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;

    let angle = -Math.PI / 2;
    _donutSlices = [];
    _donutCenter = { cx, cy, innerR: 0, outerR: radius };

    data.forEach(d => {
      const sliceAngle = (d.value / total) * Math.PI * 2;
      _donutSlices.push({ startAngle: angle, endAngle: angle + sliceAngle, label: d.label, value: d.value, color: d.color, pct: ((d.value / total) * 100).toFixed(1) });

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = d.color || '#4488ff';
      ctx.fill();
      ctx.strokeStyle = '#0f0e17';
      ctx.lineWidth = 2;
      ctx.stroke();

      angle += sliceAngle;
    });
  }

  // ===== TIMELINE (hour blocks — pixel segments) =====
  // Stores hitbox data for the last-drawn timeline (for tooltip hover)
  let _timelineHitboxes = [];
  let _timelinePadding = null;
  let _timelineTrackH = 0;
  let _viewStart = 0, _viewEnd = 24;

  function setTimelineView(start, end) {
    _viewStart = Math.max(0, Math.min(start, 23));
    _viewEnd = Math.max(_viewStart + 1, Math.min(end, 24));
    if (_viewEnd - _viewStart < 1) _viewEnd = _viewStart + 1;
  }

  function getTimelineView() {
    return { start: _viewStart, end: _viewEnd };
  }

  function formatTime12h(date) {
    let hrs = date.getHours();
    const mins = date.getMinutes();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    return mins === 0 ? `${hrs} ${ampm}` : `${hrs}:${String(mins).padStart(2, '0')} ${ampm}`;
  }

  function formatHour12h(hr24) {
    const ampm = hr24 >= 12 ? 'PM' : 'AM';
    const hr = hr24 % 12 || 12;
    return `${hr}${ampm}`;
  }

  function drawTimeline(canvas, data, categories, opts = {}) {
    if (!canvas) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const padding = { left: 36, right: 8, top: 8, bottom: 18 };
    const trackH = h - padding.top - padding.bottom;
    const trackW = w - padding.left - padding.right;
    const viewRange = _viewEnd - _viewStart;

    _timelinePadding = { ...padding, trackW, trackH };

    // Inset track background
    drawInsetBg(ctx, padding.left, padding.top, trackW, trackH);

    // Hour markers — adaptive tick spacing based on zoom
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = `${fs(6)}px ${getFont()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let tickStep;
    if (viewRange <= 3) tickStep = 0.25;
    else if (viewRange <= 6) tickStep = 0.5;
    else if (viewRange <= 12) tickStep = 1;
    else tickStep = 3;

    const firstTick = Math.ceil(_viewStart / tickStep) * tickStep;
    for (let hr = firstTick; hr <= _viewEnd; hr += tickStep) {
      const x = Math.round(padding.left + ((hr - _viewStart) / viewRange) * trackW);
      if (x < padding.left || x > padding.left + trackW) continue;

      // Label
      if (hr === Math.floor(hr)) {
        ctx.fillText(formatHour12h(hr % 24), x, padding.top + trackH + 4);
      } else {
        const wholeHr = Math.floor(hr);
        const mins = Math.round((hr - wholeHr) * 60);
        const ampm = wholeHr >= 12 ? 'PM' : 'AM';
        const dispHr = wholeHr % 12 || 12;
        ctx.fillText(`${dispHr}:${String(mins).padStart(2, '0')}`, x, padding.top + trackH + 4);
      }

      // Tick marks
      ctx.fillStyle = GRID_COLOR;
      for (let py = padding.top; py < padding.top + trackH; py += 3) {
        ctx.fillRect(x, py, 1, 1);
      }
      ctx.fillStyle = LABEL_COLOR;
    }

    // Activity blocks — build hitboxes for tooltip
    _timelineHitboxes = [];
    if (!data || !data.length) return;

    for (const entry of data) {
      if (!entry || !entry.ts) continue;
      const d = new Date(entry.ts);
      const hourFrac = d.getHours() + d.getMinutes() / 60;
      const durHrs = (entry.dur || 0) / 3600000;
      const entryEnd = hourFrac + durHrs;

      // Skip entries entirely outside view
      if (entryEnd <= _viewStart || hourFrac >= _viewEnd) continue;

      // Clip to view range
      const clippedStart = Math.max(hourFrac, _viewStart);
      const clippedEnd = Math.min(entryEnd, _viewEnd);

      const x = Math.round(padding.left + ((clippedStart - _viewStart) / viewRange) * trackW);
      const blockW = Math.max(2, Math.round(((clippedEnd - clippedStart) / viewRange) * trackW));

      const catColor = (categories[entry.cat] && categories[entry.cat].color) || '#78909c';
      pxRect(ctx, x, padding.top + 2, blockW, trackH - 4, catColor);

      _timelineHitboxes.push({
        x, w: blockW,
        y: padding.top + 2, h: trackH - 4,
        entry, catColor
      });
    }
  }

  function getTimelineEntryAt(canvasX, canvasY) {
    for (let i = _timelineHitboxes.length - 1; i >= 0; i--) {
      const hb = _timelineHitboxes[i];
      if (canvasX >= hb.x && canvasX <= hb.x + hb.w &&
          canvasY >= hb.y && canvasY <= hb.y + hb.h) {
        return hb;
      }
    }
    return null;
  }

  // ===== HEATMAP (pixel grid calendar) =====
  function drawHeatmap(canvas, data, opts = {}) {
    if (!canvas) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const padding = { left: 28, right: 8, top: 22, bottom: 8 };
    const cellSize = Math.min(12, Math.floor((w - padding.left - padding.right) / 53));
    const cellGap = 2;

    // Day labels
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = `${fs(6)}px ${getFont()}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const dayLabels = ['', 'M', '', 'W', '', 'F', ''];
    dayLabels.forEach((d, i) => {
      if (d) ctx.fillText(d, padding.left - 4, padding.top + i * (cellSize + cellGap) + cellSize / 2);
    });

    const values = Object.values(data || {});
    const maxMs = Math.max(...values, 3600000);

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Month labels
    let lastMonth = -1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let week = 0; week < 53; week++) {
      const tempDate = new Date(startDate);
      tempDate.setDate(startDate.getDate() + week * 7);
      const month = tempDate.getMonth();
      if (month !== lastMonth) {
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = `${fs(6)}px ${getFont()}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(monthNames[month], padding.left + week * (cellSize + cellGap), padding.top - 4);
        lastMonth = month;
      }
    }

    // Cells
    let col = 0;
    const current = new Date(startDate);

    while (current <= today) {
      const dateStr = localDateStr(current);
      const dayOfWeek = current.getDay();

      const x = Math.round(padding.left + col * (cellSize + cellGap));
      const y = Math.round(padding.top + dayOfWeek * (cellSize + cellGap));

      const ms = (data && data[dateStr]) || 0;
      const intensity = Math.min(ms / maxMs, 1);

      if (intensity === 0) {
        pxRect(ctx, x, y, cellSize, cellSize, '#1a1a2e');
        // Border
        ctx.fillStyle = '#222244';
        ctx.fillRect(x, y, cellSize, 1);
        ctx.fillRect(x, y, 1, cellSize);
      } else {
        // Green intensity with pixel steps (4 levels)
        const level = Math.ceil(intensity * 4);
        const colors = ['#1a3a2a', '#2a6a3a', '#3aaa4a', '#2ee67a'];
        pxRect(ctx, x, y, cellSize, cellSize, colors[level - 1]);
        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, y, cellSize, 1);
      }

      current.setDate(current.getDate() + 1);
      if (current.getDay() === 0) col++;
    }
  }

  // ===== LINE CHART (pixel step-line) =====
  function drawLineChart(canvas, data, opts = {}) {
    if (!canvas || !data || !data.length) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const padding = { top: 16, right: 16, bottom: 28, left: 48 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    drawInsetBg(ctx, padding.left, padding.top, chartW, chartH);

    const maxVal = Math.max(...data.map(d => d.value), 1);

    // Grid (pixel dashed)
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(padding.top + (chartH * i / 4));
      ctx.fillStyle = GRID_COLOR;
      for (let px = padding.left; px < padding.left + chartW; px += 4) {
        ctx.fillRect(px, y, 2, 1);
      }
    }

    const color = opts.color || '#4488ff';
    const points = [];

    data.forEach((d, i) => {
      const x = Math.round(padding.left + (i / (data.length - 1 || 1)) * chartW);
      const y = Math.round(padding.top + chartH - (d.value / maxVal) * chartH);
      points.push({ x, y });
    });

    // Area fill (solid columns from point to bottom — pixel style)
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const stepX = p2.x - p1.x;

      // Fill column under the line
      for (let x = p1.x; x < p2.x; x++) {
        const t = (x - p1.x) / stepX;
        const y = Math.round(p1.y + (p2.y - p1.y) * t);
        const fillH = padding.top + chartH - y;
        ctx.fillStyle = adjustAlpha(color, 0.12);
        ctx.fillRect(x, y, 1, fillH);
      }
    }

    // Line (2px thick, step-style between points)
    ctx.fillStyle = color;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Draw line pixel by pixel (Bresenham-ish but simple)
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const px = Math.round(p1.x + dx * t);
        const py = Math.round(p1.y + dy * t);
        ctx.fillRect(px, py, 2, 2);
      }
    }

    // Dots (pixel squares)
    points.forEach(p => {
      // Outer
      ctx.fillStyle = '#0f0e17';
      ctx.fillRect(p.x - 3, p.y - 3, 7, 7);
      // Inner
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 2, p.y - 2, 5, 5);
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    });

    // X labels
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = `${fs(6)}px ${getFont()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = Math.max(1, Math.floor(data.length / 8));
    data.forEach((d, i) => {
      if (i % step === 0) {
        const x = Math.round(padding.left + (i / (data.length - 1 || 1)) * chartW);
        ctx.fillText(d.label || '', x, padding.top + chartH + 6);
      }
    });
  }

  // ===== Helpers =====
  function formatDuration(ms) {
    if (ms < 60000) return '0m';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }

  function adjustAlpha(hex, alpha) {
    if (hex.startsWith('rgba')) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return {
    drawBarChart,
    drawStackedBarChart,
    drawDonutChart,
    drawPieChart,
    drawTimeline,
    setTimelineView,
    getTimelineView,
    drawHeatmap,
    drawLineChart,
    formatDuration,
    formatTime12h,
    getTimelineEntryAt,
    getDonutSliceAt,
    setupHiDPI
  };
})();
