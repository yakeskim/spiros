const { app, BrowserWindow, Menu, Tray, shell, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync, spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// Set app identity early — makes Task Manager show "Synchron" instead of "Electron"
app.setAppUserModelId('com.jrbay.synchron');

let mainWindow;
let tray = null;
let tracker = null;
let isTracking = false;

// ===== Paths =====
const userDataPath = app.getPath('userData');
const activityDir = path.join(userDataPath, 'activity');
const settingsPath = path.join(userDataPath, 'settings.json');
const gameStatePath = path.join(userDataPath, 'game-state.json');

// Ensure directories exist
function ensureDirs() {
  fs.mkdirSync(activityDir, { recursive: true });
}

// ===== Settings =====
function getDefaultSettings() {
  return {
    projectsFolder: 'C:\\Users\\jrbay\\Documents\\claude sandbox',
    pollIntervalMs: 5000,
    categories: {
      music: { patterns: ['FL Studio', 'Ableton', 'Audacity', 'REAPER'], icon: 'music-note', color: '#e040fb' },
      coding: { patterns: ['Code', 'Visual Studio', 'Terminal', 'cmd.exe', 'WindowsTerminal', 'node', 'python', 'Claude Code'], icon: 'code', color: '#00e676' },
      gaming: { patterns: ['Steam', 'Epic Games', 'Minecraft', 'Terraria', 'Roblox', 'javaw'], icon: 'gamepad', color: '#ff5252' },
      browsing: { patterns: ['Chrome', 'Firefox', 'Edge', 'Opera', 'Brave', 'msedge', 'chrome'], icon: 'globe', color: '#448aff' },
      design: { patterns: ['Figma', 'Photoshop', 'GIMP', 'Illustrator', 'Blender'], icon: 'brush', color: '#ff6e40' },
      communication: { patterns: ['Discord', 'Slack', 'Teams', 'Zoom', 'Telegram'], icon: 'chat', color: '#26c6da' },
      other: { patterns: [], icon: 'box', color: '#78909c' }
    },
    blockedApps: ['conhost'],
    idleTimeoutMs: 300000,
    startMinimized: false,
    startWithWindows: false
  };
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const defaults = getDefaultSettings();
      return { ...defaults, ...data, blockedApps: data.blockedApps || defaults.blockedApps };
    }
  } catch (e) { /* use defaults */ }
  return getDefaultSettings();
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

// ===== Game State =====
function getDefaultGameState() {
  return {
    xp: 0,
    level: 1,
    title: 'Novice',
    streak: { current: 0, best: 0, lastDate: null },
    achievements: [],
    resources: { gold: 0, gems: 0, wood: 0, stone: 0 },
    buildings: []
  };
}

function loadGameState() {
  try {
    if (fs.existsSync(gameStatePath)) {
      return { ...getDefaultGameState(), ...JSON.parse(fs.readFileSync(gameStatePath, 'utf8')) };
    }
  } catch (e) { /* use defaults */ }
  return getDefaultGameState();
}

function saveGameState(state) {
  fs.writeFileSync(gameStatePath, JSON.stringify(state, null, 2));
}

// ===== Persistent PowerShell Activity Tracker =====
let psProcess = null;
let psPid = null;
let pollInterval = null;
let lastApp = '';
let lastTitle = '';
let idleCount = 0;
let windowSwitchCount = 0;

// Write the poll script to a .ps1 file (avoids stdin piping issues)
const PS_SCRIPT_PATH = path.join(userDataPath, 'poll-loop.ps1');

function ensurePollScript() {
  const settings = loadSettings();
  const cycles = Math.round(settings.pollIntervalMs / 200);

  // Single C# class with all functionality including scroll hook thread
  const script = `$ErrorActionPreference = 'SilentlyContinue'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
using System.Threading;

public class Win32Input {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);

    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll")] private static extern IntPtr GetModuleHandle(string lpModuleName);
    [DllImport("user32.dll")] private static extern bool GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref MSG lpMsg);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG lpMsg);

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG {
        public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam;
        public uint time; public int pt_x; public int pt_y;
    }

    private static int _scrollCount = 0;
    private static LowLevelMouseProc _mouseProc;
    private static IntPtr _hookId = IntPtr.Zero;

    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && (int)wParam == 0x020A) {
            Interlocked.Increment(ref _scrollCount);
        }
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    public static void StartScrollHook() {
        Thread t = new Thread(() => {
            _mouseProc = MouseHookCallback;
            _hookId = SetWindowsHookEx(14, _mouseProc, GetModuleHandle(null), 0);
            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0)) {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.IsBackground = true;
        t.Start();
    }

    public static int GetAndResetScrolls() {
        return Interlocked.Exchange(ref _scrollCount, 0);
    }

    public static string GetForegroundInfo() {
        IntPtr hwnd = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hwnd, sb, 256);
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        string procName = "";
        try { procName = Process.GetProcessById((int)pid).ProcessName; } catch {}
        return sb.ToString() + "|" + procName + "|" + pid;
    }

    // Edge detection: only count the up-to-down transition, not every poll while held
    private static bool[] _prevDown = new bool[256];

    private static bool IsNewPress(int vk) {
        short state = GetAsyncKeyState(vk);
        bool down = (state & 0x8000) != 0;
        bool wasDown = _prevDown[vk];
        _prevDown[vk] = down;
        // Rising edge: was not down, now is down
        if (down && !wasDown) return true;
        // Brief press between polls: bit 0 set, key already released, wasn't down before
        if (!down && !wasDown && (state & 1) != 0) return true;
        return false;
    }

    public static string PollInputs() {
        int clicks = 0, rClicks = 0, keys = 0, letters = 0, spaces = 0;
        if (IsNewPress(0x01)) clicks++;
        if (IsNewPress(0x02)) rClicks++;
        for (int k = 0x41; k <= 0x5A; k++) { if (IsNewPress(k)) { keys++; letters++; } }
        for (int k = 0x30; k <= 0x39; k++) { if (IsNewPress(k)) keys++; }
        if (IsNewPress(0x20)) { keys++; spaces++; }
        if (IsNewPress(0x0D)) { keys++; spaces++; }
        if (IsNewPress(0x09)) keys++;
        if (IsNewPress(0x08)) keys++;
        int[] oem = {0xBA,0xBB,0xBC,0xBD,0xBE,0xBF,0xC0,0xDB,0xDC,0xDD,0xDE,0xDF};
        foreach (int k in oem) { if (IsNewPress(k)) keys++; }
        int[] nav = {0x25,0x26,0x27,0x28,0x2E,0x24,0x23,0x21,0x22};
        foreach (int k in nav) { if (IsNewPress(k)) keys++; }
        return clicks + "|" + rClicks + "|" + keys + "|" + letters + "|" + spaces;
    }
}
"@

try { [Win32Input]::StartScrollHook() } catch {}

$pollCycles = ${cycles}
while ($true) {
    $tc = 0; $tr = 0; $tk = 0; $tl = 0; $ts = 0

    for ($i = 0; $i -lt $pollCycles; $i++) {
        $res = [Win32Input]::PollInputs()
        $p = $res.Split('|')
        $tc += [int]$p[0]
        $tr += [int]$p[1]
        $tk += [int]$p[2]
        $tl += [int]$p[3]
        $ts += [int]$p[4]
        Start-Sleep -Milliseconds 200
    }

    $fg = [Win32Input]::GetForegroundInfo()
    $sc = [Win32Input]::GetAndResetScrolls()
    $tw = $ts
    [Console]::WriteLine("POLL:" + $fg + "|" + $tc + "|" + $tr + "|" + $tk + "|" + $tl + "|" + $tw + "|" + $sc)
    [Console]::Out.Flush()
}
`;

  fs.writeFileSync(PS_SCRIPT_PATH, script, 'utf8');
}

function startPersistentPS() {
  if (psProcess) return;

  ensurePollScript();

  psProcess = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_SCRIPT_PATH
  ], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  psPid = psProcess.pid;
  let buffer = '';

  psProcess.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('POLL:')) {
        handlePollResult(trimmed.slice(5));
      }
    }
  });

  psProcess.stderr.on('data', (chunk) => {
    // Ignore PS stderr noise (Add-Type warnings, etc.)
  });

  psProcess.on('close', () => {
    psProcess = null;
    psPid = null;
    // Restart if we're still supposed to be tracking
    if (isTracking) {
      setTimeout(startPersistentPS, 2000);
    }
  });
}

function stopPersistentPS() {
  if (psProcess) {
    try { psProcess.kill(); } catch (e) {}
    psProcess = null;
    psPid = null;
  }
}

function handlePollResult(result) {
  try {
    // Format: title|processName|pid|clicks|rightClicks|keys|letters|words|scrolls
    const parts = result.split('|');
    if (parts.length < 9) return;

    const [title, processName, pidStr, clicksStr, rightStr, keysStr, lettersStr, wordsStr, scrollsStr] = parts;
    const pid = parseInt(pidStr) || 0;
    const clicks = parseInt(clicksStr) || 0;
    const rightClicks = parseInt(rightStr) || 0;
    const keys = parseInt(keysStr) || 0;
    const letters = parseInt(lettersStr) || 0;
    const words = parseInt(wordsStr) || 0;
    const scrolls = parseInt(scrollsStr) || 0;

    if (!title && !processName) return;

    const settings = loadSettings();
    const now = Date.now();

    // Self-filter: skip if detected PID is our PS child process
    if (pid === psPid) return;

    // Smart app naming: detect Claude Code in terminal windows
    const lowerProc = (processName || '').toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    const terminalProcs = ['powershell', 'pwsh', 'cmd', 'windowsterminal', 'conhost', 'wt'];
    let appName = processName || 'Unknown';
    if (terminalProcs.includes(lowerProc) && (lowerTitle.includes('claude') || lowerTitle.includes('❯ claude'))) {
      appName = 'Claude Code';
    }

    // Blocked apps filter (uses resolved app name, so "Claude Code" won't be blocked)
    const checkName = appName.toLowerCase();
    if (settings.blockedApps && settings.blockedApps.some(b => checkName.includes(b.toLowerCase()))) {
      return;
    }

    // Idle detection: same title for too long
    if (title === lastTitle) {
      idleCount++;
      if (idleCount * settings.pollIntervalMs >= settings.idleTimeoutMs) {
        return; // idle, don't record
      }
    } else {
      idleCount = 0;
    }

    // Track window switches
    if (appName !== lastApp && lastApp !== '') {
      windowSwitchCount++;
    }
    lastApp = appName;
    lastTitle = title || '';

    const cat = categorizeWindow(title, appName);
    const site = (cat === 'browsing') ? extractDomain(title) : null;

    const data = loadTodayData();

    // Find last foreground entry (skip bg entries) to merge with
    let lastFg = null;
    for (let i = data.entries.length - 1; i >= 0; i--) {
      if (!data.entries[i].bg) { lastFg = data.entries[i]; break; }
    }

    // Merge with previous foreground entry if same app + title
    if (lastFg && lastFg.app === appName && lastFg.title === (title || '')) {
      lastFg.dur += settings.pollIntervalMs;
      lastFg.clicks += clicks;
      lastFg.rightClicks += rightClicks;
      lastFg.keys += keys;
      lastFg.letters += letters;
      lastFg.words += words;
      lastFg.scrolls += scrolls;
    } else {
      // New foreground activity
      const entry = {
        ts: now,
        app: appName,
        title: title || '',
        cat,
        dur: settings.pollIntervalMs,
        clicks,
        rightClicks,
        keys,
        letters,
        words,
        scrolls
      };
      if (site) entry.site = site;
      data.entries.push(entry);
    }

    updateSummary(data);
    saveTodayData(data);

    // Push update to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('activity:update', null);
    }
  } catch (e) {
    // parse error — skip this poll
  }
}

function categorizeWindow(title, processName) {
  const settings = loadSettings();
  const combined = `${title} ${processName}`.toLowerCase();

  for (const [catName, catDef] of Object.entries(settings.categories)) {
    if (catName === 'other') continue;
    for (const pattern of catDef.patterns) {
      if (combined.includes(pattern.toLowerCase())) {
        return catName;
      }
    }
  }
  return 'other';
}

function extractDomain(title) {
  const browserSuffixes = [' - Google Chrome', ' - Mozilla Firefox', ' - Microsoft Edge', ' - Opera', ' - Brave'];
  for (const suffix of browserSuffixes) {
    if (title.endsWith(suffix)) {
      const pageTitle = title.slice(0, -suffix.length);
      const domainMatch = pageTitle.match(/(?:^|\s-\s)([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)$/i);
      if (domainMatch) return domainMatch[1].toLowerCase();
    }
  }
  return null;
}

function getTodayPath() {
  const d = new Date();
  const dateStr = d.toISOString().split('T')[0];
  return path.join(activityDir, `${dateStr}.json`);
}

function loadTodayData() {
  const p = getTodayPath();
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) { /* fresh day */ }
  const d = new Date();
  return {
    date: d.toISOString().split('T')[0],
    entries: [],
    summary: {
      totalMs: 0,
      totalClicks: 0, totalRightClicks: 0,
      totalKeys: 0, totalLetters: 0, totalWords: 0,
      totalScrolls: 0, totalEvents: 0,
      byCategory: {}, byApp: {}, topSites: {}
    }
  };
}

function saveTodayData(data) {
  fs.writeFileSync(getTodayPath(), JSON.stringify(data, null, 2));
}

function updateSummary(data) {
  const summary = {
    totalMs: 0,
    totalClicks: 0, totalRightClicks: 0,
    totalKeys: 0, totalLetters: 0, totalWords: 0,
    totalScrolls: 0, totalEvents: 0,
    byCategory: {}, byApp: {}, topSites: {}
  };

  let prevApp = '';
  let switches = 0;

  for (const entry of data.entries) {
    if (entry.idle) continue;
    summary.totalMs += entry.dur;
    summary.totalClicks += (entry.clicks || 0);
    summary.totalRightClicks += (entry.rightClicks || 0);
    summary.totalKeys += (entry.keys || 0);
    summary.totalLetters += (entry.letters || 0);
    summary.totalWords += (entry.words || 0);
    summary.totalScrolls += (entry.scrolls || 0);

    summary.byCategory[entry.cat] = (summary.byCategory[entry.cat] || 0) + entry.dur;
    summary.byApp[entry.app] = (summary.byApp[entry.app] || 0) + entry.dur;
    if (entry.site) {
      summary.topSites[entry.site] = (summary.topSites[entry.site] || 0) + entry.dur;
    }

    if (entry.app !== prevApp && prevApp !== '') switches++;
    prevApp = entry.app;
  }

  // totalEvents = clicks + rightClicks + keys + scrolls + windowSwitches
  summary.totalEvents = summary.totalClicks + summary.totalRightClicks +
    summary.totalKeys + summary.totalScrolls + switches;

  data.summary = summary;
}

// ===== Background Process Scanner (Claude Code, etc.) =====
let bgScanInterval = null;
let lastBgClaude = new Set(); // track which Claude PIDs we saw last scan

function startBgScanner() {
  if (bgScanInterval) return;
  // Scan every poll interval for background Claude Code processes
  const settings = loadSettings();
  bgScanInterval = setInterval(scanBackgroundProcesses, settings.pollIntervalMs);
}

function stopBgScanner() {
  if (bgScanInterval) { clearInterval(bgScanInterval); bgScanInterval = null; }
}

function scanBackgroundProcesses() {
  // Use wmic to find node.exe processes with "claude" in the command line
  exec('wmic process where "name=\'node.exe\'" get processid,commandline /format:csv', {
    windowsHide: true, timeout: 5000
  }, (err, stdout) => {
    if (err || !stdout) return;

    const settings = loadSettings();
    const now = Date.now();
    const activeClaude = new Set();

    const lines = stdout.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const cmdLine = parts.slice(1, -1).join(',').toLowerCase();
      const pidStr = parts[parts.length - 1].trim();
      const pid = parseInt(pidStr) || 0;

      // Detect Claude Code: node process with "claude" in the command line
      if (cmdLine.includes('claude') && !cmdLine.includes('synchron')) {
        activeClaude.add(pid);
      }
    }

    if (activeClaude.size === 0) {
      lastBgClaude.clear();
      return;
    }

    // Check if any Claude process is NOT the foreground window
    // (foreground Claude is already handled by the main poll)
    const fgApp = lastApp.toLowerCase();
    const fgIsClaude = fgApp === 'claude code';

    // If Claude is running (foreground or background), log as bg track
    if (activeClaude.size > 0) {
      const data = loadTodayData();
      const bgTitle = `Background (${activeClaude.size} instance${activeClaude.size > 1 ? 's' : ''})`;

      // Find last bg entry to merge with
      let lastBg = null;
      for (let i = data.entries.length - 1; i >= 0; i--) {
        if (data.entries[i].bg) { lastBg = data.entries[i]; break; }
      }

      // Merge if last bg entry was also Claude Code
      if (lastBg && lastBg.app === 'Claude Code') {
        lastBg.dur += settings.pollIntervalMs;
        lastBg.title = bgTitle; // update instance count
      } else {
        data.entries.push({
          ts: now,
          app: 'Claude Code',
          title: bgTitle,
          cat: 'coding',
          dur: settings.pollIntervalMs,
          clicks: 0, rightClicks: 0, keys: 0,
          letters: 0, words: 0, scrolls: 0,
          bg: true
        });
      }

      updateSummary(data);
      saveTodayData(data);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('activity:update', data.entries[data.entries.length - 1]);
      }
    }

    lastBgClaude = activeClaude;
  });
}

function startTracking() {
  if (isTracking) return;
  ensureDirs();
  startPersistentPS();
  startBgScanner();
  isTracking = true;
  updateTrayMenu();
}

function stopTracking() {
  if (!isTracking) return;
  stopPersistentPS();
  stopBgScanner();
  isTracking = false;
  updateTrayMenu();
}

// ===== Load activity for date range =====
function loadRange(startDate, endDate) {
  const results = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const p = path.join(activityDir, `${dateStr}.json`);
    try {
      if (fs.existsSync(p)) {
        results.push(JSON.parse(fs.readFileSync(p, 'utf8')));
      }
    } catch (e) { /* skip bad files */ }
    current.setDate(current.getDate() + 1);
  }
  return results;
}

// ===== Projects Scanner =====
function scanProjects(folderPath) {
  const projects = [];
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projPath = path.join(folderPath, entry.name);
      const gitDir = path.join(projPath, '.git');
      if (!fs.existsSync(gitDir)) continue;

      try {
        const project = {
          name: entry.name,
          path: projPath,
          branch: '',
          lastCommit: '',
          lastCommitDate: '',
          commitCount: 0,
          dirty: false,
          languages: {},
          fileCount: 0,
          lineCount: 0
        };

        const gitOpts = { cwd: projPath, encoding: 'utf8', timeout: 5000, windowsHide: true };
        try { project.branch = execSync('git rev-parse --abbrev-ref HEAD', gitOpts).trim(); } catch (e) {}
        try { project.lastCommit = execSync('git log -1 --pretty=format:%s', gitOpts).trim(); } catch (e) {}
        try { project.lastCommitDate = execSync('git log -1 --pretty=format:%aI', gitOpts).trim(); } catch (e) {}
        try { project.commitCount = parseInt(execSync('git rev-list --count HEAD', gitOpts).trim()) || 0; } catch (e) {}
        try { project.dirty = execSync('git status --porcelain', gitOpts).trim().length > 0; } catch (e) {}

        const exts = {};
        let fileCount = 0;
        let lineCount = 0;
        const ignore = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.cache', 'vendor']);

        function walk(dir, depth) {
          if (depth > 4 || fileCount > 500) return;
          try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
              if (fileCount > 500) return;
              if (ignore.has(item.name)) continue;
              const full = path.join(dir, item.name);
              if (item.isDirectory()) {
                walk(full, depth + 1);
              } else if (item.isFile()) {
                fileCount++;
                const ext = path.extname(item.name).toLowerCase();
                if (ext) {
                  exts[ext] = (exts[ext] || 0) + 1;
                }
                try {
                  const content = fs.readFileSync(full, 'utf8');
                  lineCount += content.split('\n').length;
                } catch (e) { /* binary or unreadable */ }
              }
            }
          } catch (e) { /* permission error */ }
        }

        walk(projPath, 0);
        project.fileCount = fileCount;
        project.lineCount = lineCount;

        const langMap = {
          '.js': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript',
          '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust',
          '.java': 'Java', '.kt': 'Kotlin', '.cs': 'C#', '.cpp': 'C++', '.c': 'C',
          '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS',
          '.json': 'JSON', '.md': 'Markdown', '.yml': 'YAML', '.yaml': 'YAML',
          '.php': 'PHP', '.swift': 'Swift', '.dart': 'Dart', '.vue': 'Vue',
          '.svelte': 'Svelte', '.lua': 'Lua', '.sh': 'Shell'
        };
        for (const [ext, count] of Object.entries(exts)) {
          const lang = langMap[ext] || ext;
          project.languages[lang] = (project.languages[lang] || 0) + count;
        }

        projects.push(project);
      } catch (e) { /* skip broken repos */ }
    }
  } catch (e) { /* folder not found */ }

  projects.sort((a, b) => (b.lastCommitDate || '').localeCompare(a.lastCommitDate || ''));
  return projects;
}

// ===== Window =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets/icon.ico'),
    title: 'Synchron',
    backgroundColor: '#0f0e17',
    show: !loadSettings().startMinimized,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') mainWindow.setFullScreen(!mainWindow.isFullScreen());
    if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ===== Tray =====
function createTray() {
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));

  tray = new Tray(trayIcon);
  tray.setToolTip('Synchron — Activity Tracker');

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } }
    },
    { type: 'separator' },
    {
      label: isTracking ? 'Pause Tracking' : 'Resume Tracking',
      click: () => { isTracking ? stopTracking() : startTracking(); }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

// ===== Supabase =====
const SUPABASE_URL = 'https://acdjnobbiwiobvmijans.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZGpub2JiaXdpb2J2bWlqYW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjA4NDAsImV4cCI6MjA4NzQ5Njg0MH0.DGdR8JhI5MeRduDaTuz6jIHz-kwCzaRThfwK9vOUS_g';

const sessionPath = path.join(userDataPath, 'session.json');

function loadPersistedSession() {
  try {
    if (fs.existsSync(sessionPath)) return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch (e) {}
  return null;
}

function persistSession(session) {
  try { fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2)); } catch (e) {}
}

function clearPersistedSession() {
  try { if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath); } catch (e) {}
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false // we handle persistence ourselves
  }
});

// Restore session on startup
async function restoreSession() {
  const saved = loadPersistedSession();
  if (saved && saved.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token
    });
    if (data.session) {
      persistSession(data.session);
      return data.session;
    }
  }
  return null;
}

// Listen for auth state changes to persist tokens
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    persistSession(session);
  } else if (event === 'SIGNED_OUT') {
    clearPersistedSession();
  }
});

// ===== Auth Handlers =====
async function authSignUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) return { success: false, error: error.message };
  if (data.session) startSyncInterval();
  return { success: true, user: data.user, session: data.session };
}

async function authLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  // Start cloud sync on login — pull data from cloud, then start push interval
  startSyncInterval();
  return { success: true, user: data.user, session: data.session };
}

async function authLogout() {
  stopSyncInterval();
  await supabase.auth.signOut();
  clearPersistedSession();
  return { success: true };
}

async function authGetUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { user: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null };
  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();
  return { user: { ...user, profile } };
}

async function updateProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };
  const { error } = await supabase
    .from('profiles').update(updates).eq('id', user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ===== Activity Sync =====
let syncInterval = null;

// Upload local data to cloud
async function syncActivityToCloud() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const localPath = path.join(activityDir, `${dateStr}.json`);

    if (!fs.existsSync(localPath)) continue;
    try {
      const localData = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      await supabase.from('activity_days').upsert({
        user_id: user.id,
        date: dateStr,
        summary: localData.summary || {},
        entries: localData.entries || []
      }, { onConflict: 'user_id,date' });
    } catch (e) { /* skip bad files */ }
  }

  // Also sync game state + profile to cloud
  try {
    const gs = loadGameState();
    await supabase.from('profiles').update({
      level: gs.level,
      xp: gs.xp,
      title: gs.title,
      streak_current: gs.streak?.current || 0,
      streak_best: gs.streak?.best || 0
    }).eq('id', user.id);
  } catch (e) {}
}

// Download cloud data to local (runs on login / startup)
async function pullCloudToLocal() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch all activity days from cloud
  const { data: cloudDays, error } = await supabase
    .from('activity_days')
    .select('date, summary, entries')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (error || !cloudDays || cloudDays.length === 0) return;

  ensureDirs();
  const todayStr = new Date().toISOString().split('T')[0];

  for (const day of cloudDays) {
    const localPath = path.join(activityDir, `${day.date}.json`);
    const isToday = day.date === todayStr;

    if (isToday && fs.existsSync(localPath)) {
      // For today: merge — local wins since it has live tracking data
      // But if local has fewer entries, cloud is newer (e.g. from another PC)
      try {
        const localData = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        const localEntries = localData.entries?.length || 0;
        const cloudEntries = day.entries?.length || 0;
        if (cloudEntries > localEntries) {
          // Cloud has more data for today — use cloud
          fs.writeFileSync(localPath, JSON.stringify({
            date: day.date,
            entries: day.entries || [],
            summary: day.summary || {}
          }, null, 2));
        }
        // Otherwise keep local (it's actively tracking)
      } catch (e) { /* keep local on error */ }
    } else if (!fs.existsSync(localPath)) {
      // Past day not on this machine — download from cloud
      fs.writeFileSync(localPath, JSON.stringify({
        date: day.date,
        entries: day.entries || [],
        summary: day.summary || {}
      }, null, 2));
    }
    // Past days that exist locally: keep local (already synced up)
  }
}

function startSyncInterval() {
  if (syncInterval) return;
  // Sync every 5 minutes
  syncInterval = setInterval(syncActivityToCloud, 5 * 60 * 1000);
  // Pull from cloud first, then push after 10 seconds
  pullCloudToLocal().then(() => {
    setTimeout(syncActivityToCloud, 10000);
  });
}

function stopSyncInterval() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}

// ===== Friends =====
async function searchUsers(query) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, level, title')
    .ilike('display_name', `%${query}%`)
    .neq('id', user.id)
    .limit(20);
  return data || [];
}

async function sendFriendRequest(addresseeId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };
  const { error } = await supabase.from('friendships').insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: 'pending'
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function respondFriendRequest(friendshipId, accept) {
  const { error } = await supabase.from('friendships')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', friendshipId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function removeFriend(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function getFriends() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { friends: [], pending: [], requests: [] };

  const { data: allFriendships } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (!allFriendships) return { friends: [], pending: [], requests: [] };

  const friends = [];
  const pending = [];   // I sent, waiting
  const requests = [];  // They sent, waiting on me

  // Collect all friend user IDs to fetch profiles
  const friendIds = new Set();
  for (const f of allFriendships) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    friendIds.add(otherId);
  }

  // Fetch profiles for all friends
  const profileMap = {};
  if (friendIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, level, title, streak_current')
      .in('id', [...friendIds]);
    if (profiles) {
      for (const p of profiles) profileMap[p.id] = p;
    }
  }

  for (const f of allFriendships) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    const profile = profileMap[otherId] || { display_name: 'Unknown' };
    const entry = { ...f, profile };

    if (f.status === 'accepted') {
      friends.push(entry);
    } else if (f.status === 'pending') {
      if (f.requester_id === user.id) pending.push(entry);
      else requests.push(entry);
    }
  }

  return { friends, pending, requests };
}

async function getFriendActivity(friendId, date) {
  const { data } = await supabase
    .from('activity_days')
    .select('date, summary')
    .eq('user_id', friendId)
    .eq('date', date)
    .single();
  return data || null;
}

async function getFriendStats(friendId, startDate, endDate) {
  const { data } = await supabase
    .from('activity_days')
    .select('date, summary')
    .eq('user_id', friendId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');
  return data || [];
}

// ===== IPC Handlers =====
// Auth
ipcMain.handle('auth:signup', (e, email, password, displayName) => authSignUp(email, password, displayName));
ipcMain.handle('auth:login', (e, email, password) => authLogin(email, password));
ipcMain.handle('auth:logout', () => authLogout());
ipcMain.handle('auth:user', () => authGetUser());
ipcMain.handle('auth:updateProfile', (e, updates) => updateProfile(updates));

// Friends
ipcMain.handle('friends:search', (e, query) => searchUsers(query));
ipcMain.handle('friends:list', () => getFriends());
ipcMain.handle('friends:request', (e, addresseeId) => sendFriendRequest(addresseeId));
ipcMain.handle('friends:respond', (e, friendshipId, accept) => respondFriendRequest(friendshipId, accept));
ipcMain.handle('friends:remove', (e, friendshipId) => removeFriend(friendshipId));
ipcMain.handle('friends:activity', (e, friendId, date) => getFriendActivity(friendId, date));
ipcMain.handle('friends:stats', (e, friendId, startDate, endDate) => getFriendStats(friendId, startDate, endDate));

// Sync
ipcMain.handle('sync:now', () => syncActivityToCloud());

// Tracker
ipcMain.handle('tracker:start', () => { startTracking(); return { success: true }; });
ipcMain.handle('tracker:stop', () => { stopTracking(); return { success: true }; });
ipcMain.handle('tracker:status', () => ({ isTracking }));
ipcMain.handle('tracker:today', () => loadTodayData());
ipcMain.handle('tracker:range', (e, startDate, endDate) => loadRange(startDate, endDate));

ipcMain.handle('projects:scan', (e, folder) => {
  const settings = loadSettings();
  const folderPath = folder || settings.projectsFolder;
  return scanProjects(folderPath);
});

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:set', (e, newSettings) => {
  saveSettings(newSettings);
  return { success: true };
});

ipcMain.handle('game:get', () => loadGameState());
ipcMain.handle('game:set', (e, state) => {
  saveGameState(state);
  return { success: true };
});

ipcMain.handle('app:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('app:openInVSCode', (e, projPath) => {
  try {
    exec(`code "${projPath}"`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:openTerminal', (e, projPath) => {
  try {
    exec(`wt -d "${projPath}"`, (err) => {
      if (err) exec(`cmd /K cd /d "${projPath}"`, { detached: true });
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:exportData', async () => {
  try {
    const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.json'));
    const allData = files.map(f => JSON.parse(fs.readFileSync(path.join(activityDir, f), 'utf8')));
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Activity Data',
      defaultPath: 'synchron-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(allData, null, 2));
      return { success: true, path: result.filePath };
    }
    return { success: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:clearHistory', async () => {
  try {
    // Clear local files
    const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      fs.unlinkSync(path.join(activityDir, f));
    }
    // Clear cloud data if logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('activity_days').delete().eq('user_id', user.id);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ===== App Lifecycle =====

// Single instance lock — if user double-clicks shortcut while app is in tray,
// bring existing window to front instead of launching a second instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  ensureDirs();
  createWindow();
  createTray();
  startTracking();

  // Restore auth session and start cloud sync if logged in
  const session = await restoreSession();
  if (session) startSyncInterval();
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopTracking();
});
