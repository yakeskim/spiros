const { app, BrowserWindow, Menu, Tray, shell, ipcMain, dialog, nativeImage, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile, execSync, spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { autoUpdater } = require('electron-updater');

// Set app identity early — makes Task Manager show "Spiros" instead of "Electron"
app.setAppUserModelId('com.jrbay.spiros');

let mainWindow;
let tray = null;
let tracker = null;
let isTracking = false;
let lastUserInputTime = 0;    // timestamp of last real user input
let userActivityState = 'idle'; // 'active' | 'bg' | 'idle'

// ===== Paths =====
const userDataPath = app.getPath('userData');
const activityDir = path.join(userDataPath, 'activity');
const settingsPath = path.join(userDataPath, 'settings.json');
const gameStatePath = path.join(userDataPath, 'game-state.json');
const logPath = path.join(userDataPath, 'spiros.log');

// ===== Error Logging =====
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

function logError(context, err) {
  const msg = `[${new Date().toISOString()}] ERROR ${context}: ${err?.message || err}\n`;
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_SIZE) {
      fs.renameSync(logPath, logPath + '.old');
    }
    fs.appendFileSync(logPath, msg);
  } catch (_) { /* logging should never crash the app */ }
}

function logInfo(context, message) {
  const msg = `[${new Date().toISOString()}] INFO ${context}: ${message}\n`;
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_SIZE) {
      fs.renameSync(logPath, logPath + '.old');
    }
    fs.appendFileSync(logPath, msg);
  } catch (_) {}
}

// Ensure directories exist
function ensureDirs() {
  fs.mkdirSync(activityDir, { recursive: true });
}

// ===== Settings =====
function getDefaultSettings() {
  return {
    projectsFolder: '',
    pollIntervalMs: 5000,
    categories: {
      music: { patterns: ['FL Studio', 'Ableton', 'Audacity', 'REAPER', 'Logic Pro', 'GarageBand', 'Bitwig', 'Cubase', 'Pro Tools', 'Bandlab', 'Soundtrap'], icon: 'music-note', color: '#e040fb' },
      coding: { patterns: ['Code', 'Visual Studio', 'Terminal', 'cmd.exe', 'WindowsTerminal', 'node', 'python', 'Claude Code', 'IntelliJ', 'PyCharm', 'WebStorm', 'Sublime Text', 'Atom', 'Vim', 'Neovim', 'Emacs', 'Android Studio', 'Xcode', 'Eclipse', 'NetBeans', 'Rider', 'CLion', 'GoLand', 'RustRover', 'cursor', 'Warp', 'Alacritty', 'iTerm', 'Hyper', 'Postman', 'Insomnia', 'GitKraken', 'GitHub Desktop'], icon: 'code', color: '#00e676' },
      gaming: { patterns: [
        'Steam', 'Epic Games', 'Minecraft', 'Terraria', 'Roblox', 'javaw',
        'Skate', 'Fortnite', 'Valorant', 'League of Legends', 'Overwatch',
        'Apex Legends', 'Call of Duty', 'Counter-Strike', 'csgo', 'cs2',
        'Destiny 2', 'Genshin', 'Hades', 'Hollow Knight', 'Celeste',
        'Elden Ring', 'Dark Souls', 'Baldur', 'Cyberpunk', 'Witcher',
        'GTA', 'Red Dead', 'Rocket League', 'Fall Guys', 'Among Us',
        'Stardew', 'Factorio', 'Satisfactory', 'Rust', 'ARK', 'Palworld',
        'Lethal Company', 'Phasmophobia', 'Dead by Daylight', 'Warframe',
        'Path of Exile', 'Diablo', 'World of Warcraft', 'Lost Ark',
        'FIFA', 'NBA 2K', 'Madden', 'Forza', 'Gran Turismo',
        'Civilization', 'Total War', 'Age of Empires', 'Stellaris',
        'Slay the Spire', 'Halo', 'Doom', 'Battlefield', 'Rainbow Six',
        'Dota', 'PUBG', 'Hunt Showdown', 'Escape from Tarkov',
        'Sea of Thieves', 'No Man', 'Subnautica', 'Valheim',
        'The Sims', 'Animal Crossing', 'Zelda', 'Mario',
        'GOG Galaxy', 'Battle.net', 'Origin', 'EA App', 'Ubisoft Connect',
        'Xbox', 'GeForce NOW', 'Moonlight', 'Parsec',
        'UnityEditor', 'UE4Editor', 'UE5Editor', 'Godot'
      ], icon: 'gamepad', color: '#ff5252' },
      browsing: { patterns: ['Chrome', 'Firefox', 'Edge', 'Opera', 'Brave', 'msedge', 'chrome', 'Safari', 'Arc', 'Vivaldi', 'Waterfox', 'Tor Browser'], icon: 'globe', color: '#448aff' },
      design: { patterns: ['Figma', 'Photoshop', 'GIMP', 'Illustrator', 'Blender', 'Canva', 'Sketch', 'InDesign', 'Affinity', 'Krita', 'Paint.NET', 'Aseprite', 'Pixlr'], icon: 'brush', color: '#ff6e40' },
      communication: { patterns: ['Discord', 'Slack', 'Teams', 'Zoom', 'Telegram', 'Signal', 'WhatsApp', 'Skype', 'Google Meet', 'Webex', 'Mumble', 'TeamSpeak'], icon: 'chat', color: '#26c6da' },
      productivity: { patterns: ['Word', 'Excel', 'PowerPoint', 'Notion', 'Obsidian', 'OneNote', 'Google Docs', 'Google Sheets', 'WINWORD', 'EXCEL', 'POWERPNT', 'Acrobat', 'Trello', 'Asana', 'Jira', 'Linear', 'ClickUp', 'Todoist', 'Evernote', 'Bear', 'Craft', 'Logseq', 'Roam'], icon: 'briefcase', color: '#ffd740' },
      video: { patterns: ['YouTube', 'Netflix', 'Twitch', 'Spotify', 'VLC', 'Disney+', 'Hulu', 'mpv', 'Plex', 'Prime Video', 'HBO Max', 'Crunchyroll', 'Apple TV', 'Peacock', 'Paramount+', 'Tidal', 'Apple Music', 'Deezer', 'Pandora', 'SoundCloud'], icon: 'film', color: '#ff4081' },
      email: { patterns: ['Outlook', 'Gmail', 'Thunderbird', 'Mail', 'OUTLOOK', 'Proton Mail', 'Fastmail', 'Mailbird', 'Spark'], icon: 'mail', color: '#80cbc4' },
      education: { patterns: ['Udemy', 'Coursera', 'Khan Academy', 'Anki', 'Duolingo', 'Canvas', 'Blackboard', 'edX', 'Skillshare', 'Brilliant', 'Pluralsight', 'Codecademy', 'LeetCode', 'HackerRank'], icon: 'book', color: '#b388ff' },
      'video-editing': { patterns: ['Premiere', 'DaVinci Resolve', 'After Effects', 'CapCut', 'Filmora', 'Kdenlive', 'Shotcut', 'OBS', 'Streamlabs', 'HitFilm', 'Vegas Pro', 'Final Cut'], icon: 'video', color: '#ea80fc' },
      social: { patterns: ['Reddit', 'Twitter', 'Instagram', 'TikTok', 'Facebook', 'Snapchat', 'X.com', 'Threads', 'Mastodon', 'Bluesky', 'LinkedIn', 'Pinterest', 'Tumblr'], icon: 'users', color: '#69f0ae' },
      finance: { patterns: ['Robinhood', 'Coinbase', 'TradingView', 'Binance', 'MetaTrader', 'Fidelity', 'Schwab', 'Webull', 'Kraken', 'Thinkorswim', 'E*TRADE', 'Wealthsimple', 'Mint', 'YNAB'], icon: 'dollar-sign', color: '#ffd54f' },
      system: { patterns: ['Explorer', 'Task Manager', 'Settings', 'Control Panel', 'Installer', 'regedit', 'msconfig', 'Device Manager', 'Disk Management', 'Event Viewer', 'Services'], icon: 'settings', color: '#90a4ae' },
      other: { patterns: [], icon: 'box', color: '#78909c' }
    },
    categoryOverrides: {},
    blockedApps: ['conhost'],
    idleTimeoutMs: 300000,
    inputIdleTimeoutMs: 120000,
    startMinimized: false,
    startWithWindows: false,
    privacy: {
      trackWindowTitles: false,
      trackKeystrokes: true,
      trackDomains: true,
      syncKeystrokesToCloud: false,
      syncEntriesToCloud: false,
      shareDetailedStats: false,
      dataRetentionDays: 90
    },
    consentAccepted: false,
    autoUpdate: true
  };
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const defaults = getDefaultSettings();
      // Merge categories: keep user customizations but add any new default categories/patterns
      const mergedCats = { ...defaults.categories };
      if (data.categories) {
        for (const [catName, catDef] of Object.entries(data.categories)) {
          if (mergedCats[catName]) {
            // Merge patterns: user patterns + any new default patterns not already present
            const userPatterns = catDef.patterns || [];
            const defaultPatterns = mergedCats[catName].patterns || [];
            const userLower = new Set(userPatterns.map(p => p.toLowerCase()));
            const merged = [...userPatterns];
            for (const dp of defaultPatterns) {
              if (!userLower.has(dp.toLowerCase())) merged.push(dp);
            }
            mergedCats[catName] = { ...mergedCats[catName], ...catDef, patterns: merged };
          } else {
            mergedCats[catName] = catDef;
          }
        }
      }
      return {
        ...defaults,
        ...data,
        categories: mergedCats,
        blockedApps: data.blockedApps || defaults.blockedApps,
        categoryOverrides: data.categoryOverrides || defaults.categoryOverrides,
        privacy: { ...defaults.privacy, ...(data.privacy || {}) }
      };
    }
  } catch (e) { logError('loadSettings', e); }
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
    buildings: [],
    village: null
  };
}

function loadGameState() {
  try {
    if (fs.existsSync(gameStatePath)) {
      return { ...getDefaultGameState(), ...JSON.parse(fs.readFileSync(gameStatePath, 'utf8')) };
    }
  } catch (e) { logError('loadGameState', e); }
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
let noInputCount = 0;
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
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    private static POINT _lastCursorPos;
    private static bool _cursorInitialized = false;
    private static int _mouseMoved = 0;

    // XInput controller detection
    [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState", SetLastError = true)]
    private static extern int XInputGetState1_4(int dwUserIndex, out XINPUT_STATE pState);

    [DllImport("xinput9_1_0.dll", EntryPoint = "XInputGetState", SetLastError = true)]
    private static extern int XInputGetState9_1_0(int dwUserIndex, out XINPUT_STATE pState);

    [StructLayout(LayoutKind.Sequential)]
    private struct XINPUT_STATE {
        public uint dwPacketNumber;
        public XINPUT_GAMEPAD Gamepad;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct XINPUT_GAMEPAD {
        public ushort wButtons;
        public byte bLeftTrigger;
        public byte bRightTrigger;
        public short sThumbLX;
        public short sThumbLY;
        public short sThumbRX;
        public short sThumbRY;
    }

    private static uint[] _lastPacket = new uint[4];
    private static bool _xinput14 = true;
    private static int _controllerActive = 0;

    private static int SafeXInputGetState(int index, out XINPUT_STATE state) {
        try {
            if (_xinput14) return XInputGetState1_4(index, out state);
        } catch (DllNotFoundException) { _xinput14 = false; }
        try {
            return XInputGetState9_1_0(index, out state);
        } catch (DllNotFoundException) {
            state = default(XINPUT_STATE);
            return -1; // no XInput available
        }
    }

    public static void CheckControllerInput() {
        for (int i = 0; i < 4; i++) {
            XINPUT_STATE state;
            if (SafeXInputGetState(i, out state) == 0) {
                if (state.dwPacketNumber != _lastPacket[i]) {
                    Interlocked.Exchange(ref _controllerActive, 1);
                    _lastPacket[i] = state.dwPacketNumber;
                }
            }
        }
    }

    public static int GetAndResetControllerActive() {
        return Interlocked.Exchange(ref _controllerActive, 0);
    }

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
    private static int _clickCount = 0;
    private static int _rClickCount = 0;
    private static LowLevelMouseProc _mouseProc;
    private static IntPtr _hookId = IntPtr.Zero;

    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int msg = (int)wParam;
            if (msg == 0x0201) Interlocked.Increment(ref _clickCount);       // WM_LBUTTONDOWN
            else if (msg == 0x0204) Interlocked.Increment(ref _rClickCount); // WM_RBUTTONDOWN
            else if (msg == 0x020A) Interlocked.Increment(ref _scrollCount); // WM_MOUSEWHEEL
        }
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    public static void StartMouseHook() {
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

    public static int GetAndResetClicks() {
        return Interlocked.Exchange(ref _clickCount, 0);
    }

    public static int GetAndResetRightClicks() {
        return Interlocked.Exchange(ref _rClickCount, 0);
    }

    public static void CheckMouseMovement() {
        POINT cur;
        if (GetCursorPos(out cur)) {
            if (_cursorInitialized) {
                if (cur.X != _lastCursorPos.X || cur.Y != _lastCursorPos.Y) {
                    Interlocked.Exchange(ref _mouseMoved, 1);
                }
            }
            _lastCursorPos = cur;
            _cursorInitialized = true;
        }
    }

    public static int GetAndResetMouseMoved() {
        return Interlocked.Exchange(ref _mouseMoved, 0);
    }

    public static string GetForegroundInfo() {
        IntPtr hwnd = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hwnd, sb, 256);
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        string procName = "";
        try { procName = Process.GetProcessById((int)pid).ProcessName; } catch {}
        return sb.ToString().Replace("|", "/") + "|" + procName.Replace("|", "/") + "|" + pid;
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
        int keys = 0, letters = 0, spaces = 0;
        // Keyboard only — mouse clicks are tracked via hook
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
        return keys + "|" + letters + "|" + spaces;
    }
}
"@

try { [Win32Input]::StartMouseHook() } catch {}

$pollCycles = ${cycles}
while ($true) {
    $tk = 0; $tl = 0; $ts = 0

    for ($i = 0; $i -lt $pollCycles; $i++) {
        $res = [Win32Input]::PollInputs()
        [Win32Input]::CheckMouseMovement()
        [Win32Input]::CheckControllerInput()
        $p = $res.Split('|')
        $tk += [int]$p[0]
        $tl += [int]$p[1]
        $ts += [int]$p[2]
        Start-Sleep -Milliseconds 200
    }

    $fg = [Win32Input]::GetForegroundInfo()
    $sc = [Win32Input]::GetAndResetScrolls()
    $tc = [Win32Input]::GetAndResetClicks()
    $tr = [Win32Input]::GetAndResetRightClicks()
    $mm = [Win32Input]::GetAndResetMouseMoved()
    $gp = [Win32Input]::GetAndResetControllerActive()
    $tw = $ts
    [Console]::WriteLine("POLL:" + $fg + "|" + $tc + "|" + $tr + "|" + $tk + "|" + $tl + "|" + $tw + "|" + $sc + "|" + $mm + "|" + $gp)
    [Console]::Out.Flush()
}
`;

  fs.writeFileSync(PS_SCRIPT_PATH, script, 'utf8');
}

function startPersistentPS() {
  if (psProcess) return;

  ensurePollScript();

  psProcess = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'RemoteSigned', '-File', PS_SCRIPT_PATH
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
    // Format: title|processName|pid|clicks|rightClicks|keys|letters|words|scrolls|mouseMoved|controller
    // Note: title and processName have pipe chars replaced with "/" by GetForegroundInfo()
    const parts = result.split('|');
    if (parts.length < 11) return; // strict: expect exactly 11 fields

    const [title, processName, pidStr, clicksStr, rightStr, keysStr, lettersStr, wordsStr, scrollsStr] = parts;
    const mouseMovedStr = parts[9] || '0';
    const controllerStr = parts[10] || '0';
    const pid = parseInt(pidStr) || 0;
    let clicks = parseInt(clicksStr) || 0;
    let rightClicks = parseInt(rightStr) || 0;
    let keys = parseInt(keysStr) || 0;
    const letters = parseInt(lettersStr) || 0;
    const words = parseInt(wordsStr) || 0;
    let scrolls = parseInt(scrollsStr) || 0;
    const mouseMoved = parseInt(mouseMovedStr) || 0;
    const controller = parseInt(controllerStr) || 0;

    if (!title && !processName) return;

    const settings = loadSettings();

    // Sanity cap: reject obviously bogus values (e.g. from malformed pipe parsing)
    // Max ~20 clicks/sec × poll interval; 50 keys/sec is fast typing; 100 scrolls/sec
    const pollSec = (settings.pollIntervalMs || 5000) / 1000;
    const maxClicks = Math.ceil(20 * pollSec);
    const maxKeys = Math.ceil(50 * pollSec);
    const maxScrolls = Math.ceil(100 * pollSec);
    if (clicks > maxClicks) clicks = 0;
    if (rightClicks > maxClicks) rightClicks = 0;
    if (keys > maxKeys) keys = 0;
    if (scrolls > maxScrolls) scrolls = 0;
    const now = Date.now();

    // Self-filter: skip if detected PID is our PS child process
    if (pid === psPid) return;
    // Self-filter: skip if detected PID is our Electron main or renderer process
    if (pid === process.pid) return;
    if (mainWindow && !mainWindow.isDestroyed() && pid === mainWindow.webContents.getOSProcessId()) return;

    // Smart app naming: detect Claude Code in terminal windows
    const lowerProc = (processName || '').toLowerCase();
    const lowerTitle = (title || '').toLowerCase();

    // Self-filter: skip Spiros's own processes by name
    const selfNames = ['electron', 'spiros'];
    if (selfNames.includes(lowerProc)) return;

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

    // Categorize early — needed for idle exemption decisions
    const cat = categorizeWindow(title, appName);

    // Idle detection: same title for too long
    if (title === lastTitle) {
      idleCount++;
      if (idleCount * settings.pollIntervalMs >= settings.idleTimeoutMs) {
        return; // idle, don't record
      }
    } else {
      idleCount = 0;
    }

    // Input-based idle detection: no input activity at all for too long
    // Exempt: AI tools (run autonomously), gaming (controller may not be detected), music
    const inputIdleExemptApps = ['Claude Code'];
    const inputIdleExemptCats = ['gaming', 'music'];
    const totalInput = clicks + rightClicks + keys + scrolls + mouseMoved + controller;
    const inputIdleMs = settings.inputIdleTimeoutMs || 120000; // default 2 minutes
    const isExempt = inputIdleExemptApps.includes(appName) || inputIdleExemptCats.includes(cat);

    // Update user activity state for the status indicator
    const isSpirosFocused = mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused();
    if (totalInput > 0) {
      lastUserInputTime = now;
      userActivityState = 'active';
    } else if (now - lastUserInputTime < 15000) {
      // Brief pause (<15s) — still considered active
      userActivityState = 'active';
    } else if (isSpirosFocused) {
      // Spiros is focused but no input — background/waiting state
      userActivityState = 'bg';
    } else {
      // Not focused and no input — idle
      userActivityState = now - lastUserInputTime < inputIdleMs ? 'bg' : 'idle';
    }
    if (totalInput === 0 && !isExempt) {
      noInputCount++;
      if (noInputCount * settings.pollIntervalMs >= inputIdleMs) {
        return; // no input for too long — user is away/AFK
      }
    } else {
      noInputCount = 0;
    }

    // Track window switches — reset input idle on app change
    if (appName !== lastApp && lastApp !== '') {
      windowSwitchCount++;
      noInputCount = 0; // switching apps is intentional user action
    }
    lastApp = appName;
    lastTitle = title || '';
    const privacy = settings.privacy || {};
    const storedTitle = privacy.trackWindowTitles ? (title || '') : '';
    const site = (cat === 'browsing' && privacy.trackDomains) ? extractDomain(title) : null;
    const storedKeys = privacy.trackKeystrokes ? keys : 0;
    const storedLetters = privacy.trackKeystrokes ? letters : 0;
    const storedWords = privacy.trackKeystrokes ? words : 0;

    const data = loadTodayData();

    // Find last foreground entry (skip bg entries) to merge with
    let lastFg = null;
    for (let i = data.entries.length - 1; i >= 0; i--) {
      if (!data.entries[i].bg) { lastFg = data.entries[i]; break; }
    }

    // Apps whose terminal title changes constantly — merge by app name only
    const mergeByAppOnly = ['Claude Code'];
    const canMerge = lastFg && lastFg.app === appName &&
      (mergeByAppOnly.includes(appName) || lastFg.title === storedTitle);

    if (canMerge) {
      lastFg.dur += settings.pollIntervalMs;
      lastFg.clicks += clicks;
      lastFg.rightClicks += rightClicks;
      lastFg.keys += storedKeys;
      lastFg.letters += storedLetters;
      lastFg.words += storedWords;
      lastFg.scrolls += scrolls;
    } else {
      // New foreground activity
      const entry = {
        ts: now,
        app: appName,
        title: storedTitle,
        cat,
        dur: settings.pollIntervalMs,
        clicks,
        rightClicks,
        keys: storedKeys,
        letters: storedLetters,
        words: storedWords,
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
    logError('handlePollResult', e);
  }
}

function categorizeWindow(title, processName) {
  const settings = loadSettings();
  const combined = `${title} ${processName}`.toLowerCase();

  // Check user overrides first (appName -> category)
  const overrides = settings.categoryOverrides || {};
  const lowerProc = (processName || '').toLowerCase();
  for (const [appPattern, cat] of Object.entries(overrides)) {
    if (combined.includes(appPattern.toLowerCase())) {
      return cat;
    }
  }

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
  } catch (e) { logError('loadTodayData', e); }
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
  // Check for Claude Code running as claude.exe or as node.exe with "claude" in command line
  // execFile avoids spawning cmd.exe (which can flash a console window)
  execFile('wmic', ['process', 'where', "name='claude.exe' or name='node.exe'", 'get', 'processid,name,commandline', '/format:csv'], {
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
      const pidStr = parts[parts.length - 1].trim();
      const pid = parseInt(pidStr) || 0;
      const procName = (parts[parts.length - 2] || '').trim().toLowerCase();
      const cmdLine = parts.slice(1, -2).join(',').toLowerCase();

      // Detect Claude Code: claude.exe directly, or node.exe with "claude" in command line
      if (procName === 'claude.exe') {
        activeClaude.add(pid);
      } else if (procName === 'node.exe' && cmdLine.includes('claude') && !cmdLine.includes('spiros')) {
        activeClaude.add(pid);
      }
    }

    if (activeClaude.size === 0) {
      lastBgClaude.clear();
      return;
    }

    // Skip BG tracking if Claude Code is the foreground app — it's already tracked by the main poll
    const fgApp = lastApp.toLowerCase();
    const fgIsClaude = fgApp === 'claude code';
    if (fgIsClaude) {
      lastBgClaude = activeClaude;
      return;
    }

    // Claude is running in the background — log as bg entry
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
    } catch (e) { logError('loadRange', e); }
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

      try {
        const hasGit = fs.existsSync(path.join(projPath, '.git'));
        const project = {
          name: entry.name,
          path: projPath,
          hasGit,
          projectType: detectProjectType(projPath),
          branch: '',
          lastCommit: '',
          lastCommitDate: '',
          commitCount: 0,
          dirty: false,
          languages: {},
          fileCount: 0,
          lineCount: 0
        };

        if (hasGit) {
          const gitOpts = { cwd: projPath, encoding: 'utf8', timeout: 5000, windowsHide: true };
          try { project.branch = execSync('git rev-parse --abbrev-ref HEAD', gitOpts).trim(); } catch (e) {}
          try { project.lastCommit = execSync('git log -1 --pretty=format:%s', gitOpts).trim(); } catch (e) {}
          try { project.lastCommitDate = execSync('git log -1 --pretty=format:%aI', gitOpts).trim(); } catch (e) {}
          try { project.commitCount = parseInt(execSync('git rev-list --count HEAD', gitOpts).trim()) || 0; } catch (e) {}
          try { project.dirty = execSync('git status --porcelain', gitOpts).trim().length > 0; } catch (e) {}
        } else {
          // Use directory mtime as lastCommitDate fallback for sorting
          try { project.lastCommitDate = fs.statSync(projPath).mtime.toISOString(); } catch (e) {}
        }

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

function detectProjectType(projPath) {
  const markers = [
    ['package.json', 'Node.js'],
    ['Cargo.toml', 'Rust'],
    ['requirements.txt', 'Python'],
    ['setup.py', 'Python'],
    ['pyproject.toml', 'Python'],
    ['go.mod', 'Go'],
    ['Gemfile', 'Ruby'],
    ['pom.xml', 'Java'],
    ['build.gradle', 'Java'],
    ['*.sln', 'C#'],
    ['composer.json', 'PHP'],
    ['pubspec.yaml', 'Flutter'],
    ['CMakeLists.txt', 'C/C++'],
    ['Makefile', 'Make'],
    ['index.html', 'Web'],
  ];
  for (const [file, type] of markers) {
    if (file.startsWith('*')) {
      // glob-style: check if any file matches the extension
      const ext = file.slice(1);
      try {
        const items = fs.readdirSync(projPath);
        if (items.some(f => f.endsWith(ext))) return type;
      } catch (_) {}
    } else {
      if (fs.existsSync(path.join(projPath, file))) return type;
    }
  }
  return 'Folder';
}

// ===== Window =====
function createWindow() {
  const settings = loadSettings();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets/icon.ico'),
    title: 'Spiros',
    backgroundColor: '#0f0e17',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (settings.startMinimized) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.loadFile('index.html');
  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') mainWindow.setFullScreen(!mainWindow.isFullScreen());
    if (input.key === 'F12' && !app.isPackaged) mainWindow.webContents.toggleDevTools();
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
  tray.setToolTip('Spiros — Activity Tracker');

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
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
    if (!fs.existsSync(sessionPath)) return null;
    const raw = fs.readFileSync(sessionPath);
    // Try decrypting (encrypted sessions are Buffer, not valid JSON directly)
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const decrypted = safeStorage.decryptString(raw);
        return JSON.parse(decrypted);
      } catch (_) {
        // Fallback: try reading as plaintext JSON (migration from old format)
        try {
          const plaintext = JSON.parse(raw.toString('utf8'));
          // Auto-upgrade: re-persist as encrypted
          persistSession(plaintext);
          logInfo('session', 'Migrated plaintext session to encrypted');
          return plaintext;
        } catch (e2) {
          logError('loadPersistedSession', e2);
          return null;
        }
      }
    } else {
      // safeStorage not available — read as plaintext
      return JSON.parse(raw.toString('utf8'));
    }
  } catch (e) {
    logError('loadPersistedSession', e);
  }
  return null;
}

function persistSession(session) {
  try {
    const json = JSON.stringify(session);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json);
      fs.writeFileSync(sessionPath, encrypted);
    } else {
      fs.writeFileSync(sessionPath, json);
    }
  } catch (e) {
    logError('persistSession', e);
  }
}

function clearPersistedSession() {
  try { if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath); } catch (e) { logError('clearPersistedSession', e); }
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
  joinPresence();
  return { success: true, user: data.user, session: data.session };
}

async function authLogout() {
  stopSyncInterval();
  await leavePresence();
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

// ===== Content Moderation =====
// Banned words — covers profanity, slurs, hate speech
const BANNED_WORDS = [
  'fuck','fucker','fucking','fucked','fucks','motherfucker','motherfucking',
  'shit','shitty','bullshit','shitting','shits',
  'ass','asshole','assholes','asses','dumbass','jackass','smartass',
  'bitch','bitches','bitching','bitchy',
  'damn','goddamn','dammit',
  'dick','dicks','dickhead',
  'cock','cocks','cocksucker',
  'pussy','pussies',
  'cunt','cunts',
  'bastard','bastards',
  'whore','whores',
  'slut','sluts',
  'piss','pissed','pissing',
  'crap','crappy',
  'nigger','nigga','niggas','niggers',
  'faggot','faggots','fag','fags',
  'retard','retarded','retards',
  'spic','spics','wetback','wetbacks',
  'chink','chinks','gook','gooks',
  'kike','kikes',
  'tranny','trannies',
  'dyke','dykes',
  'beaner','beaners',
  'coon','coons','darkie','darkies',
  'raghead','ragheads','towelhead','towelheads',
  'cracker','crackers',
  'honky','honkey',
  'jap','japs',
  'paki','pakis',
  'wop','wops','dago','dagos',
  'nazi','nazis','heil','sieg',
  'rape','raping','rapist',
  'pedophile','pedo','pedos',
  'molest','molester',
  'kys','killself','killyourself',
  'stfu','gtfo'
];

// Build regex: match whole words, case-insensitive, catches common l33t substitutions
const LEET_MAP = { a: '[a@4]', e: '[e3]', i: '[i1!|]', o: '[o0]', s: '[s$5]', t: '[t7]', l: '[l1|]', g: '[g9]' };

function buildBannedRegex() {
  const patterns = BANNED_WORDS.map(word => {
    const leetPattern = word.split('').map(ch => LEET_MAP[ch] || ch).join('[\\s._-]*');
    return leetPattern;
  });
  return new RegExp('(?:^|\\b|\\s)(?:' + patterns.join('|') + ')(?:\\b|\\s|$)', 'i');
}

const BANNED_REGEX = buildBannedRegex();

function moderateContent(text) {
  if (!text) return { ok: true };
  // Strip zero-width chars and normalize
  const cleaned = text.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '').trim();
  if (BANNED_REGEX.test(cleaned)) {
    return { ok: false, error: 'Message contains inappropriate language' };
  }
  return { ok: true };
}

// ===== Helper: Fetch display name for current user =====
async function getCurrentDisplayName(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles').select('display_name').eq('id', userId).single();
    if (!error && profile && profile.display_name) return profile.display_name;
  } catch (_) {}
  // Fallback: try user metadata
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.display_name) return user.user_metadata.display_name;
    if (user?.email) return user.email.split('@')[0];
  } catch (_) {}
  return 'Anonymous';
}

// ===== Profile: Change Display Name (rate-limited 2x/month) =====
async function changeDisplayName(newName) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  // Validate length
  const trimmed = (newName || '').trim();
  if (trimmed.length < 1 || trimmed.length > 24) {
    return { success: false, error: 'Name must be 1-24 characters' };
  }

  // Fetch current rate-limit state
  const { data: profile, error: fetchErr } = await supabase
    .from('profiles').select('display_name_changed_count, display_name_changed_month').eq('id', user.id).single();
  if (fetchErr) return { success: false, error: fetchErr.message };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let count = profile.display_name_changed_count || 0;
  const savedMonth = profile.display_name_changed_month || '';

  // Reset count if new month
  if (savedMonth !== currentMonth) {
    count = 0;
  }

  if (count >= 2) {
    return { success: false, error: 'You can only change your name 2 times per month' };
  }

  // Update profile
  const { error: updateErr } = await supabase.from('profiles').update({
    display_name: trimmed,
    display_name_changed_count: count + 1,
    display_name_changed_month: currentMonth
  }).eq('id', user.id);

  if (updateErr) return { success: false, error: updateErr.message };

  // Re-track presence with new name
  if (presenceChannel) {
    try {
      await presenceChannel.track({
        user_id: user.id,
        display_name: trimmed,
        level: profile.level || 1,
        title: profile.title || 'Novice',
        activity_state: userActivityState,
        online_at: new Date().toISOString()
      });
    } catch (_) {}
  }

  return { success: true };
}

// ===== Community Projects =====
async function getCommunityProjects(filter, sort) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase.from('community_projects')
    .select('*, profiles!community_projects_user_id_fkey(display_name)');

  if (filter) query = query.eq('category', filter);

  if (sort === 'top') {
    // Sort by score (upvotes - downvotes) descending
    query = query.order('upvotes', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.limit(50);
  const { data, error } = await query;
  if (error) { logError('getCommunityProjects', error); return []; }

  return (data || []).map(p => ({
    ...p,
    _isOwner: p.user_id === user.id
  }));
}

async function submitCommunityProject(title, desc, url, category) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  // Validate
  if (!title || title.length < 1 || title.length > 100) return { success: false, error: 'Title must be 1-100 characters' };
  if (!desc || desc.length < 1 || desc.length > 500) return { success: false, error: 'Description must be 1-500 characters' };
  if (!url || !/^https?:\/\//.test(url)) return { success: false, error: 'URL must start with http:// or https://' };
  if (!['SaaS', 'Social', 'Creative', 'Dev Tools', 'Other'].includes(category)) return { success: false, error: 'Invalid category' };

  // Moderation check on title + description
  const modTitle = moderateContent(title);
  if (!modTitle.ok) return { success: false, error: modTitle.error };
  const modDesc = moderateContent(desc);
  if (!modDesc.ok) return { success: false, error: modDesc.error };

  const { error } = await supabase.from('community_projects').insert({
    user_id: user.id, title, description: desc, url, category
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function voteCommunityProject(projectId, voteType) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  // Check existing vote
  const { data: existing } = await supabase.from('project_votes')
    .select('id, vote_type')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .single();

  if (existing) {
    if (existing.vote_type === voteType) {
      // Same vote — remove it
      await supabase.from('project_votes').delete().eq('id', existing.id);
    } else {
      // Different vote — switch
      await supabase.from('project_votes').update({ vote_type: voteType }).eq('id', existing.id);
    }
  } else {
    // New vote
    await supabase.from('project_votes').insert({
      user_id: user.id, project_id: projectId, vote_type: voteType
    });
  }

  return { success: true };
}

async function getUserVotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('project_votes')
    .select('project_id, vote_type')
    .eq('user_id', user.id);
  return data || [];
}

async function getProjectComments(projectId) {
  const { data } = await supabase.from('project_comments')
    .select('*, profiles!project_comments_user_id_fkey(display_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return data || [];
}

async function addProjectComment(projectId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };
  if (!content || content.length < 1 || content.length > 1000) return { success: false, error: 'Comment must be 1-1000 characters' };

  // Moderation check
  const mod = moderateContent(content);
  if (!mod.ok) return { success: false, error: mod.error };

  const { error } = await supabase.from('project_comments').insert({
    project_id: projectId, user_id: user.id, content
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function deleteCommunityProject(projectId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const { error } = await supabase.from('community_projects')
    .delete().eq('id', projectId).eq('user_id', user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ===== Live Chat =====
let chatSubscription = null;
let dmSubscription = null;

async function getChatMessages(channel) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) { logError('getChatMessages', error); return []; }
    return data || [];
  } catch (e) {
    logError('getChatMessages', e);
    return [];
  }
}

async function sendChatMessage(channel, content) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };
    if (!content || content.length < 1 || content.length > 500) return { success: false, error: 'Message must be 1-500 characters' };

    // Moderation check
    const mod = moderateContent(content);
    if (!mod.ok) return { success: false, error: mod.error };

    const displayName = await getCurrentDisplayName(user.id);

    const { error } = await supabase.from('chat_messages').insert({
      channel,
      user_id: user.id,
      display_name: displayName,
      content
    });
    if (error) { logError('sendChatMessage', error); return { success: false, error: error.message }; }
    return { success: true };
  } catch (e) {
    logError('sendChatMessage', e);
    return { success: false, error: e.message || 'Send failed' };
  }
}

async function getDirectMessages(friendId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.from('direct_messages')
      .select('*, sender:profiles!direct_messages_sender_id_fkey(display_name), receiver:profiles!direct_messages_receiver_id_fkey(display_name)')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) { logError('getDirectMessages', error); return []; }

    // Flatten display_name into a top-level field for consistency
    return (data || []).map(m => ({
      ...m,
      display_name: m.sender?.display_name || 'Unknown'
    }));
  } catch (e) {
    logError('getDirectMessages', e);
    return [];
  }
}

async function sendDirectMessage(receiverId, content) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };
    if (!content || content.length < 1 || content.length > 500) return { success: false, error: 'Message must be 1-500 characters' };

    // Moderation check
    const mod = moderateContent(content);
    if (!mod.ok) return { success: false, error: mod.error };

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content
    });
    if (error) { logError('sendDirectMessage', error); return { success: false, error: error.message }; }
    return { success: true };
  } catch (e) {
    logError('sendDirectMessage', e);
    return { success: false, error: e.message || 'Send failed' };
  }
}

async function subscribeChatChannel(channel) {
  // Unsubscribe previous
  unsubscribeChat();

  chatSubscription = supabase.channel(`chat:${channel}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `channel=eq.${channel}`
    }, (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat:newMessage', payload.new);
      }
    })
    .subscribe();
}

async function subscribeDMChannel(friendId) {
  unsubscribeChat();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Create a deterministic pair key for the channel
  const ids = [user.id, friendId].sort();
  const pairKey = `dm:${ids[0]}:${ids[1]}`;

  dmSubscription = supabase.channel(pairKey)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages'
    }, async (payload) => {
      const msg = payload.new;
      // Only forward if relevant to this pair
      if ((msg.sender_id === user.id && msg.receiver_id === friendId) ||
          (msg.sender_id === friendId && msg.receiver_id === user.id)) {
        // Fetch display name
        const { data: profile } = await supabase.from('profiles')
          .select('display_name').eq('id', msg.sender_id).single();
        msg.display_name = profile?.display_name || 'Unknown';
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat:newDM', msg);
        }
      }
    })
    .subscribe();
}

function unsubscribeChat() {
  if (chatSubscription) {
    supabase.removeChannel(chatSubscription);
    chatSubscription = null;
  }
  if (dmSubscription) {
    supabase.removeChannel(dmSubscription);
    dmSubscription = null;
  }
}

// ===== Activity Sync =====
let syncInterval = null;

// Upload local data to cloud
async function syncActivityToCloud() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const settings = loadSettings();
  const privacy = settings.privacy || {};
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const localPath = path.join(activityDir, `${dateStr}.json`);

    if (!fs.existsSync(localPath)) continue;
    try {
      const localData = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      // Strip keystroke data from summary unless opted in
      let cloudSummary = { ...(localData.summary || {}) };
      if (!privacy.syncKeystrokesToCloud) {
        cloudSummary.totalKeys = 0;
        cloudSummary.totalLetters = 0;
        cloudSummary.totalWords = 0;
      }
      // Only send entries if opted in
      const cloudEntries = privacy.syncEntriesToCloud ? (localData.entries || []) : [];
      await supabase.from('activity_days').upsert({
        user_id: user.id,
        date: dateStr,
        summary: cloudSummary,
        entries: cloudEntries
      }, { onConflict: 'user_id,date' });
    } catch (e) { logError('syncActivityToCloud', e); }
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
  } catch (e) { logError('syncProfile', e); }
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

  // Delete any existing declined row so re-requests work (unique constraint)
  await supabase.from('friendships').delete()
    .eq('requester_id', user.id)
    .eq('addressee_id', addresseeId)
    .eq('status', 'declined');
  // Also check if they declined our request in the other direction
  await supabase.from('friendships').delete()
    .eq('requester_id', addresseeId)
    .eq('addressee_id', user.id)
    .eq('status', 'declined');

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
      .select('id, display_name, avatar_url, level, title, streak_current, last_seen_at')
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

// Sanitize friend data — only return category-level info, no app names/keystroke details
function sanitizeFriendSummary(summary) {
  if (!summary) return { totalMs: 0, totalEvents: 0, byCategory: {} };
  return {
    totalMs: summary.totalMs || 0,
    totalEvents: summary.totalEvents || 0,
    byCategory: summary.byCategory || {}
  };
}

async function getFriendActivity(friendId, date) {
  const { data } = await supabase
    .from('activity_days')
    .select('date, summary')
    .eq('user_id', friendId)
    .eq('date', date)
    .single();
  if (!data) return null;
  return { date: data.date, summary: sanitizeFriendSummary(data.summary) };
}

async function getFriendStats(friendId, startDate, endDate) {
  const { data } = await supabase
    .from('activity_days')
    .select('date, summary')
    .eq('user_id', friendId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');
  if (!data) return [];
  return data.map(day => ({
    date: day.date,
    summary: sanitizeFriendSummary(day.summary)
  }));
}

// ===== Online Presence =====
let presenceChannel = null;
let lastSeenInterval = null;
let onlineUsers = {}; // { visitorKey: { user_id, display_name, level, title, activity_state } }

async function joinPresence() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch our profile for display info
  const { data: profile } = await supabase
    .from('profiles').select('display_name, level, title').eq('id', user.id).single();

  presenceChannel = supabase.channel('online-users', {
    config: { presence: { key: user.id } }
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onlineUsers = {};
      for (const [key, entries] of Object.entries(state)) {
        if (entries && entries.length > 0) {
          onlineUsers[key] = entries[0];
        }
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('presence:sync', onlineUsers);
      }
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (newPresences && newPresences.length > 0) {
        onlineUsers[key] = newPresences[0];
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('presence:join', { key, data: newPresences?.[0] });
      }
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      delete onlineUsers[key];
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('presence:leave', { key });
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id: user.id,
          display_name: profile?.display_name || 'Unknown',
          level: profile?.level || 1,
          title: profile?.title || 'Novice',
          activity_state: userActivityState,
          online_at: new Date().toISOString()
        });
      }
    });

  // Update last_seen_at every 60s
  await updateLastSeen();
  lastSeenInterval = setInterval(updateLastSeen, 60000);
}

async function leavePresence() {
  if (lastSeenInterval) { clearInterval(lastSeenInterval); lastSeenInterval = null; }
  if (presenceChannel) {
    await presenceChannel.untrack();
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
  onlineUsers = {};
}

async function updateLastSeen() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
  } catch (e) {
    logError('updateLastSeen', e);
  }
}

function getOnlineFriends() {
  return onlineUsers;
}

async function getCommunityStats() {
  try {
    const onlineCount = Object.keys(onlineUsers).length;
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', oneWeekAgo);
    const activeUsers = error ? 0 : (count || 0);
    return { onlineCount, totalUsers: activeUsers };
  } catch (e) {
    logError('getCommunityStats', e);
    return { onlineCount: Object.keys(onlineUsers).length, totalUsers: 0 };
  }
}

// ===== IPC Handlers =====
// Auth
ipcMain.handle('auth:signup', (e, email, password, displayName) => authSignUp(email, password, displayName));
ipcMain.handle('auth:login', (e, email, password) => authLogin(email, password));
ipcMain.handle('auth:logout', () => authLogout());
ipcMain.handle('auth:user', () => authGetUser());
ipcMain.handle('auth:updateProfile', (e, updates) => updateProfile(updates));

// Profile
ipcMain.handle('profile:changeName', (e, newName) => changeDisplayName(newName));

// Friends
ipcMain.handle('friends:search', (e, query) => searchUsers(query));
ipcMain.handle('friends:list', () => getFriends());
ipcMain.handle('friends:request', (e, addresseeId) => sendFriendRequest(addresseeId));
ipcMain.handle('friends:respond', (e, friendshipId, accept) => respondFriendRequest(friendshipId, accept));
ipcMain.handle('friends:remove', (e, friendshipId) => removeFriend(friendshipId));
ipcMain.handle('friends:activity', (e, friendId, date) => getFriendActivity(friendId, date));
ipcMain.handle('friends:stats', (e, friendId, startDate, endDate) => getFriendStats(friendId, startDate, endDate));

// Community
ipcMain.handle('community:getProjects', (e, filter, sort) => getCommunityProjects(filter, sort));
ipcMain.handle('community:submit', (e, title, desc, url, cat) => submitCommunityProject(title, desc, url, cat));
ipcMain.handle('community:vote', (e, projectId, voteType) => voteCommunityProject(projectId, voteType));
ipcMain.handle('community:getUserVotes', () => getUserVotes());
ipcMain.handle('community:getComments', (e, projectId) => getProjectComments(projectId));
ipcMain.handle('community:addComment', (e, projectId, content) => addProjectComment(projectId, content));
ipcMain.handle('community:delete', (e, projectId) => deleteCommunityProject(projectId));

// Chat
ipcMain.handle('chat:getMessages', (e, channel) => getChatMessages(channel));
ipcMain.handle('chat:send', (e, channel, content) => sendChatMessage(channel, content));
ipcMain.handle('chat:getDMs', (e, friendId) => getDirectMessages(friendId));
ipcMain.handle('chat:sendDM', (e, receiverId, content) => sendDirectMessage(receiverId, content));
ipcMain.handle('chat:subscribeChannel', (e, channel) => subscribeChatChannel(channel));
ipcMain.handle('chat:subscribeDM', (e, friendId) => subscribeDMChannel(friendId));
ipcMain.handle('chat:unsubscribe', () => unsubscribeChat());

// Presence
ipcMain.handle('presence:getOnlineFriends', () => getOnlineFriends());
ipcMain.handle('presence:communityStats', () => getCommunityStats());

// Sync
ipcMain.handle('sync:now', () => syncActivityToCloud());

// Tracker
ipcMain.handle('tracker:start', () => { startTracking(); return { success: true }; });
ipcMain.handle('tracker:stop', () => { stopTracking(); return { success: true }; });
ipcMain.handle('tracker:status', () => ({ isTracking, activityState: isTracking ? userActivityState : 'idle' }));
ipcMain.handle('tracker:today', () => loadTodayData());
ipcMain.handle('tracker:range', (e, startDate, endDate) => loadRange(startDate, endDate));

// Changelog
ipcMain.handle('app:getChangelog', () => {
  try { return fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8'); }
  catch (e) { return ''; }
});

ipcMain.handle('projects:scan', (e, folder) => {
  const settings = loadSettings();
  const folderPath = folder || settings.projectsFolder;
  if (!folderPath) return [];
  return scanProjects(folderPath);
});

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:set', (e, newSettings) => {
  saveSettings(newSettings);
  if (newSettings.autoUpdate !== undefined) {
    autoUpdater.autoDownload = newSettings.autoUpdate !== false;
  }
  return { success: true };
});

// Category override: map an app name pattern to a category
ipcMain.handle('settings:setCategoryOverride', (e, appPattern, category) => {
  const settings = loadSettings();
  if (!settings.categoryOverrides) settings.categoryOverrides = {};
  if (category === null || category === undefined) {
    delete settings.categoryOverrides[appPattern];
  } else {
    settings.categoryOverrides[appPattern] = category;
  }
  saveSettings(settings);
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
      defaultPath: 'spiros-export.json',
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

// ===== Privacy & Consent IPC Handlers =====
ipcMain.handle('privacy:getConsent', () => {
  const settings = loadSettings();
  return { consentAccepted: !!settings.consentAccepted };
});

ipcMain.handle('privacy:acceptConsent', () => {
  const settings = loadSettings();
  settings.consentAccepted = true;
  saveSettings(settings);
  // Start tracking now that consent is given
  startTracking();
  return { success: true };
});

ipcMain.handle('privacy:getSettings', () => {
  const settings = loadSettings();
  return settings.privacy || getDefaultSettings().privacy;
});

ipcMain.handle('privacy:setSettings', (e, privacySettings) => {
  const settings = loadSettings();
  settings.privacy = { ...(settings.privacy || {}), ...privacySettings };
  saveSettings(settings);
  return { success: true };
});

ipcMain.handle('app:deleteAccount', async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };
    // Delete all user data from cloud tables
    await supabase.from('activity_days').delete().eq('user_id', user.id);
    await supabase.from('friendships').delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    await supabase.from('profiles').delete().eq('id', user.id);
    // Clear local data
    const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.json'));
    for (const f of files) fs.unlinkSync(path.join(activityDir, f));
    // Sign out
    stopSyncInterval();
    await supabase.auth.signOut();
    clearPersistedSession();
    logInfo('deleteAccount', `Account data deleted for ${user.id}`);
    return { success: true };
  } catch (e) {
    logError('deleteAccount', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('app:openExternal', (e, url) => {
  // Only allow http/https URLs
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL' };
});

ipcMain.handle('app:version', () => {
  const pkg = require('./package.json');
  return { version: pkg.version, name: pkg.productName || pkg.name };
});

// ===== Auto-Update =====
const settings = loadSettings();
autoUpdater.autoDownload = settings.autoUpdate !== false;
autoUpdater.autoInstallOnAppQuit = true;

function sendUpdateStatus(status, info) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', { status, ...info });
  }
}

autoUpdater.on('checking-for-update', () => {
  sendUpdateStatus('checking', {});
});

autoUpdater.on('update-available', (info) => {
  sendUpdateStatus('available', { version: info.version, releaseDate: info.releaseDate });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdateStatus('up-to-date', { version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('downloading', { percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateStatus('ready', { version: info.version });
});

autoUpdater.on('error', (err) => {
  logError('auto-updater', err);
  sendUpdateStatus('error', { message: err.message || 'Update check failed' });
});

ipcMain.handle('update:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (err) {
    logError('update:check', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    logError('update:download', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ===== Data Retention =====
function runDataRetention() {
  try {
    const settings = loadSettings();
    const retentionDays = settings.privacy?.dataRetentionDays;
    if (!retentionDays || retentionDays <= 0) return; // 0 or null = keep forever

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.json'));
    let deleted = 0;
    for (const f of files) {
      const dateStr = f.replace('.json', '');
      if (dateStr < cutoffStr) {
        fs.unlinkSync(path.join(activityDir, f));
        deleted++;
      }
    }
    if (deleted > 0) logInfo('dataRetention', `Deleted ${deleted} files older than ${retentionDays} days`);
  } catch (e) {
    logError('runDataRetention', e);
  }
}

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

  // Only start tracking if user has given consent
  const settings = loadSettings();
  if (settings.consentAccepted) {
    startTracking();
  }

  // Run data retention cleanup on startup
  runDataRetention();

  // Restore auth session and start cloud sync if logged in
  const session = await restoreSession();
  if (session) {
    startSyncInterval();
    joinPresence();
  }
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  leavePresence();
  stopTracking();
});
