// charts.js — Pixel-art Canvas chart renderers
// Chunky, no anti-aliasing, hard edges, retro RPG stat screens

const Charts = (() => {
  const PIXEL_FONT = '"Press Start 2P", monospace';
  const GRID_COLOR = 'rgba(255,255,255,0.06)';
  const LABEL_COLOR = '#8888aa';
  const BORDER_COLOR = '#4a4e6e';
  const BG_INSET = '#0f0e17';

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

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barWidth = Math.max(8, Math.floor((chartW / data.length) * 0.6));
    const totalSlot = chartW / data.length;

    // Grid lines (dashed pixel style)
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(padding.top + (chartH * i / 4));
      ctx.fillStyle = GRID_COLOR;
      for (let px = padding.left; px < padding.left + chartW; px += 4) {
        ctx.fillRect(px, y, 2, 1);
      }
      // Label
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const labelVal = maxVal * (1 - i / 4);
      ctx.fillText(formatDuration(labelVal), padding.left - 6, y);
    }

    // Bars
    data.forEach((d, i) => {
      const x = Math.round(padding.left + i * totalSlot + (totalSlot - barWidth) / 2);
      const barH = Math.round((d.value / maxVal) * chartH);
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
      ctx.font = `7px ${PIXEL_FONT}`;
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
      ctx.font = `7px ${PIXEL_FONT}`;
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
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, x + barWidth / 2, padding.top + chartH + 6);
    });
  }

  // ===== DONUT CHART (pixel octagon style) =====
  function drawDonutChart(canvas, data, opts = {}) {
    if (!canvas || !data || !data.length) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 16;
    const innerRadius = radius * 0.52;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;

    let angle = -Math.PI / 2;

    // Draw each slice
    data.forEach(d => {
      const sliceAngle = (d.value / total) * Math.PI * 2;

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
    ctx.fillStyle = '#1a1a2e';
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
      ctx.font = `10px ${PIXEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.centerLabel, cx, cy - 6);
    }
    if (opts.centerSub) {
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(opts.centerSub, cx, cy + 8);
    }
  }

  // ===== TIMELINE (hour blocks — pixel segments) =====
  function drawTimeline(canvas, data, categories, opts = {}) {
    if (!canvas) return;
    const { ctx, w, h } = setupHiDPI(canvas);
    clearCanvas(ctx, w * 2, h * 2);

    const padding = { left: 28, right: 8, top: 8, bottom: 18 };
    const trackH = h - padding.top - padding.bottom;
    const trackW = w - padding.left - padding.right;

    // Inset track background
    drawInsetBg(ctx, padding.left, padding.top, trackW, trackH);

    // Hour markers (pixel dashed)
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = `6px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let hr = 0; hr < 24; hr += 3) {
      const x = Math.round(padding.left + (hr / 24) * trackW);
      ctx.fillText(`${hr}`, x, padding.top + trackH + 4);
      // Tick marks
      ctx.fillStyle = GRID_COLOR;
      for (let py = padding.top; py < padding.top + trackH; py += 3) {
        ctx.fillRect(x, py, 1, 1);
      }
      ctx.fillStyle = LABEL_COLOR;
    }

    // Activity blocks
    if (!data || !data.length) return;

    for (const entry of data) {
      const d = new Date(entry.ts);
      const hourFrac = d.getHours() + d.getMinutes() / 60;
      const x = Math.round(padding.left + (hourFrac / 24) * trackW);
      const blockW = Math.max(2, Math.round((entry.dur / (24 * 3600000)) * trackW));

      const catColor = (categories[entry.cat] && categories[entry.cat].color) || '#78909c';
      pxRect(ctx, x, padding.top + 2, blockW, trackH - 4, catColor);
    }
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
    ctx.font = `6px ${PIXEL_FONT}`;
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
        ctx.font = `6px ${PIXEL_FONT}`;
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
      const dateStr = current.toISOString().split('T')[0];
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
    ctx.font = `6px ${PIXEL_FONT}`;
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
    drawTimeline,
    drawHeatmap,
    drawLineChart,
    formatDuration,
    setupHiDPI
  };
})();
