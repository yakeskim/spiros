const { app, BrowserWindow, Menu, Tray, shell, ipcMain, dialog, nativeImage, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile, execSync, spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { autoUpdater } = require('electron-updater');

// ===== Security Helpers =====
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_PROFILE_FIELDS = ['avatar_color', 'custom_title', 'profile_frame', 'bio'];
const DEV_USER_IDS = ['14ce86d3-9acb-4db8-839c-8f7c2d210918'];
const ALLOWED_EXTERNAL_DOMAINS = ['spiros.app', 'getspiros.com', 'github.com', 'stripe.com', 'supabase.com'];

// ===== Cached User ID =====
let cachedUserId = null;
let cachedUserIdTime = 0;
async function getCachedUserId() {
  const now = Date.now();
  if (cachedUserId && now - cachedUserIdTime < 5 * 60 * 1000) return cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) { cachedUserId = user.id; cachedUserIdTime = now; }
  return cachedUserId;
}

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
    autoUpdate: true,
    theme: 'neutral'
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
    buildings: []
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

// Normalize app display names — consistent capitalization
const APP_DISPLAY_NAMES = {
  // Browsers
  'chrome': 'Chrome', 'firefox': 'Firefox', 'msedge': 'Edge', 'opera': 'Opera',
  'brave': 'Brave', 'vivaldi': 'Vivaldi', 'safari': 'Safari', 'arc': 'Arc',
  'iexplore': 'Internet Explorer', 'chromium': 'Chromium',
  // Dev tools
  'code': 'VS Code', 'devenv': 'Visual Studio', 'idea64': 'IntelliJ IDEA',
  'idea': 'IntelliJ IDEA', 'webstorm64': 'WebStorm', 'webstorm': 'WebStorm',
  'pycharm64': 'PyCharm', 'pycharm': 'PyCharm', 'rider64': 'Rider',
  'phpstorm64': 'PhpStorm', 'goland64': 'GoLand', 'rubymine64': 'RubyMine',
  'clion64': 'CLion', 'datagrip64': 'DataGrip', 'sublime_text': 'Sublime Text',
  'notepad++': 'Notepad++', 'notepad': 'Notepad', 'atom': 'Atom',
  'cursor': 'Cursor', 'windsurf': 'Windsurf', 'zed': 'Zed',
  // Terminals
  'powershell': 'PowerShell', 'pwsh': 'PowerShell', 'cmd': 'Command Prompt',
  'windowsterminal': 'Windows Terminal', 'wt': 'Windows Terminal',
  'conhost': 'Console Host', 'mintty': 'MinTTY', 'alacritty': 'Alacritty',
  'wezterm-gui': 'WezTerm', 'hyper': 'Hyper',
  // Communication
  'discord': 'Discord', 'slack': 'Slack', 'teams': 'Teams', 'zoom': 'Zoom',
  'telegram': 'Telegram', 'whatsapp': 'WhatsApp', 'signal': 'Signal',
  'thunderbird': 'Thunderbird', 'outlook': 'Outlook',
  // Design
  'figma': 'Figma', 'photoshop': 'Photoshop', 'illustrator': 'Illustrator',
  'afterfx': 'After Effects', 'premiere': 'Premiere Pro',
  'blender': 'Blender', 'gimp-2.10': 'GIMP', 'gimp': 'GIMP',
  'inkscape': 'Inkscape', 'canva': 'Canva',
  // Productivity
  'winword': 'Word', 'excel': 'Excel', 'powerpnt': 'PowerPoint',
  'onenote': 'OneNote', 'obsidian': 'Obsidian', 'notion': 'Notion',
  'evernote': 'Evernote', 'logseq': 'Logseq',
  // Media
  'spotify': 'Spotify', 'vlc': 'VLC', 'wmplayer': 'Windows Media Player',
  'itunes': 'iTunes', 'audacity': 'Audacity',
  // Gaming
  'steam': 'Steam', 'epicgameslauncher': 'Epic Games', 'riotclientservices': 'Riot Client',
  'battle.net': 'Battle.net',
  // System / Utils
  'explorer': 'File Explorer', 'taskmgr': 'Task Manager',
  'snippingtool': 'Snipping Tool', 'mspaint': 'Paint',
  'calc': 'Calculator', 'systemsettings': 'Settings',
  'postman': 'Postman', 'insomnia': 'Insomnia',
  'docker': 'Docker', 'wsl': 'WSL',
  'git': 'Git', 'github': 'GitHub Desktop', 'gitkraken': 'GitKraken',
  // Already nice
  'claude code': 'Claude Code',
};

function normalizeAppName(raw) {
  if (!raw || raw === 'Unknown') return raw;
  const mapped = APP_DISPLAY_NAMES[raw.toLowerCase()];
  if (mapped) return mapped;
  // Fallback: Title Case the process name (split on common delimiters)
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase → camel Case
    .replace(/[-_\.]/g, ' ')                 // kebab/snake/dot → spaces
    .replace(/\b\w/g, c => c.toUpperCase()); // capitalize each word
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

    // Normalize app display name — consistent capitalization
    appName = normalizeAppName(appName);

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
    // Sync presence to DB when activity state changes
    syncPresenceIfChanged();
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
  writePresence('online');
}

function stopTracking() {
  if (!isTracking) return;
  stopPersistentPS();
  stopBgScanner();
  isTracking = false;
  updateTrayMenu();
  syncPresenceIfChanged();
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
// Async helper: run a git command and return trimmed stdout (or fallback on error)
function gitAsync(cmd, cwd, fallback = '') {
  return new Promise((resolve) => {
    exec(cmd, { cwd, encoding: 'utf8', timeout: 5000, windowsHide: true }, (err, stdout) => {
      resolve(err ? fallback : (stdout || '').trim());
    });
  });
}

async function scanProjects(folderPath) {
  const projects = [];
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (e) { return []; }

  for (const entry of entries) {
    if (projects.length >= 100) break;
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
        // Run git commands in parallel — async so main process stays responsive
        const [branch, lastCommit, lastCommitDate, commitCountStr, statusOut] = await Promise.all([
          gitAsync('git rev-parse --abbrev-ref HEAD', projPath),
          gitAsync('git log -1 --pretty=format:%s', projPath),
          gitAsync('git log -1 --pretty=format:%aI', projPath),
          gitAsync('git rev-list --count HEAD', projPath, '0'),
          gitAsync('git status --porcelain', projPath),
        ]);
        project.branch = branch;
        project.lastCommit = lastCommit;
        project.lastCommitDate = lastCommitDate;
        project.commitCount = parseInt(commitCountStr) || 0;
        project.dirty = statusOut.length > 0;
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
                const stat = fs.statSync(full);
                if (stat.size > 0 && stat.size < 256 * 1024) {
                  const content = fs.readFileSync(full, 'utf8');
                  lineCount += content.split('\n').length;
                }
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

// ===== Subscription Tier System =====
let cachedTier = 'free';
let tierSubscription = null;

async function getUserTier() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { cachedTier = 'free'; return 'free'; }

    // Dev accounts — always max tier
    if (DEV_USER_IDS.includes(user.id)) {
      cachedTier = 'max';
      return 'max';
    }

    const { data } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .single();

    if (data && data.status === 'active' && data.tier) {
      cachedTier = data.tier;
    } else {
      cachedTier = 'free';
    }
  } catch (e) {
    logError('getUserTier', e);
    cachedTier = 'free';
  }
  return cachedTier;
}

function hasTier(required) {
  const order = { free: 0, starter: 1, pro: 2, max: 3 };
  return (order[cachedTier] || 0) >= (order[required] || 0);
}

function subscribeToTierChanges() {
  if (tierSubscription) return;
  // Poll for tier changes every 5 minutes instead of Realtime subscription
  tierSubscription = setInterval(async () => {
    try {
      const oldTier = cachedTier;
      await getUserTier();
      if (cachedTier !== oldTier && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('subscription:tierChanged', cachedTier);
        // Keep profiles table in sync
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('profiles').update({ tier: cachedTier }).eq('id', user.id);
      }
    } catch (_) {}
  }, 5 * 60 * 1000);
}

function unsubscribeTierChanges() {
  if (tierSubscription) {
    clearInterval(tierSubscription);
    tierSubscription = null;
  }
}

async function getSubscriptionDetails() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return data || null;
  } catch (e) {
    logError('getSubscriptionDetails', e);
    return null;
  }
}

async function createCheckoutSession(planKey) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Not logged in' };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ planKey })
    });

    const result = await response.json();
    if (result.url) {
      shell.openExternal(result.url);
      return { success: true };
    }
    return { error: result.error || 'Failed to create checkout' };
  } catch (e) {
    logError('createCheckoutSession', e);
    return { error: e.message };
  }
}

async function openPortalSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Not logged in' };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result.url) {
      shell.openExternal(result.url);
      return { success: true };
    }
    return { error: result.error || 'Failed to open portal' };
  } catch (e) {
    logError('openPortalSession', e);
    return { error: e.message };
  }
}

async function useStreakFreeze(userId) {
  if (!hasTier('pro')) return { success: false, error: 'Pro subscription required' };

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_freezes_used, streak_freeze_last_reset')
      .eq('id', userId)
      .single();

    if (!profile) return { success: false, error: 'Profile not found' };

    // Reset weekly on Monday
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const mondayStr = monday.toISOString().split('T')[0];

    let freezesUsed = profile.streak_freezes_used || 0;
    if (profile.streak_freeze_last_reset !== mondayStr) {
      freezesUsed = 0; // new week, reset
    }

    if (freezesUsed >= 1) {
      return { success: false, error: 'Already used streak freeze this week' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        streak_freezes_used: freezesUsed + 1,
        streak_freeze_last_reset: mondayStr
      })
      .eq('id', userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    logError('useStreakFreeze', e);
    return { success: false, error: e.message };
  }
}

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
async function authSignUp(email, password, displayName, referralCode) {
  const signupMeta = { display_name: displayName };

  // Validate referral code if provided
  if (referralCode && referralCode.trim()) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ code: referralCode.trim().toUpperCase() })
      });
      const result = await res.json();
      if (!result.valid) {
        return { success: false, error: result.error || 'Invalid referral code' };
      }
      signupMeta.referred_by_code = referralCode.trim().toUpperCase();
    } catch (err) {
      return { success: false, error: 'Could not validate referral code' };
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: signupMeta }
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
  // Initialize tier system
  getUserTier();
  subscribeToTierChanges();
  return { success: true, user: data.user, session: data.session };
}

async function authLogout() {
  stopSyncInterval();
  unsubscribeTierChanges();
  cachedTier = 'free';
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
  const sanitized = {};
  for (const key of ALLOWED_PROFILE_FIELDS) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }
  if (Object.keys(sanitized).length === 0) return { success: false, error: 'No valid fields' };
  const { error } = await supabase
    .from('profiles').update(sanitized).eq('id', user.id);
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

    // Free users: 50 messages per day rate limit
    if (!hasTier('starter')) {
      const today = new Date().toISOString().split('T')[0];
      const { data: rateRow } = await supabase.from('chat_rate_limits')
        .select('message_count')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      const count = rateRow?.message_count || 0;
      if (count >= 50) return { success: false, error: 'Free accounts are limited to 50 messages per day. Upgrade to Pro for unlimited chat.' };
      await supabase.from('chat_rate_limits').upsert({
        user_id: user.id, date: today, message_count: count + 1
      }, { onConflict: 'user_id,date' });
    }

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
    if (!UUID_RE.test(friendId)) return [];
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
    if (!UUID_RE.test(receiverId)) return { success: false, error: 'Invalid receiver' };
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

  // Starter+ only — free users don't get cloud sync
  if (!hasTier('starter')) return;

  const settings = loadSettings();
  const privacy = settings.privacy || {};
  const now = new Date();

  // Only sync today on each interval — reduces DB writes
  for (let i = 0; i < 1; i++) {
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
  await syncProfileToCloud();

  // Sync achievements and game stats
  try {
    const gs = loadGameState();
    const localAch = gs.achievements || [];
    if (localAch.length > 0) {
      const { data: { user: syncUser } } = await supabase.auth.getUser();
      if (syncUser) {
        const rows = localAch.map(id => ({ user_id: syncUser.id, achievement_id: id }));
        await supabase.from('user_achievements').upsert(rows, { onConflict: 'user_id,achievement_id' });
        if (gs.stats) {
          await supabase.from('user_game_stats').upsert(
            { user_id: syncUser.id, stats: gs.stats, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        }
      }
    }
  } catch (e) { logError('syncAchievements', e); }
}

// Download cloud data to local (runs on login / startup)
async function pullCloudToLocal() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch recent activity days from cloud (capped at 90 days)
  const { data: cloudDays, error } = await supabase
    .from('activity_days')
    .select('date, summary, entries')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(90);

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
  // Seed weekly challenges on startup
  getWeeklyChallenges().catch(e => logError('startSyncInterval:seedChallenges', e));
}

function stopSyncInterval() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}

// ===== Friends =====
async function searchUsers(query) {
  const userId = await getCachedUserId();
  if (!userId) return [];
  const user = { id: userId };
  const escaped = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, level, title')
    .ilike('display_name', `%${escaped}%`)
    .neq('id', user.id)
    .limit(20);
  return data || [];
}

async function sendFriendRequest(addresseeId) {
  if (!UUID_RE.test(addresseeId)) return { success: false, error: 'Invalid user ID' };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };
  const { error } = await supabase.from('friendships')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', friendshipId)
    .eq('addressee_id', user.id);  // Only addressee can respond
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function removeFriend(friendshipId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };
  const { error } = await supabase.from('friendships').delete()
    .eq('id', friendshipId)
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
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

// ===== Online Presence (DB-based, no Realtime) =====
// Writes presence_status ('online'|'afk'|'offline') to profiles on state changes.
// - Online: app running + user active or background
// - AFK: app running but idle (no input for 2+ min)
// - Offline: app quit / logged out
// Heartbeat every 2 min as crash safety. Friends page queries on demand.

let presenceInterval = null;
let lastPresenceStatus = null; // track to only write on change
let lastPresenceWrite = 0;     // throttle writes

async function joinPresence() {
  // Mark online on login
  await writePresence('online');
  // Heartbeat every 2 min — syncs current state + crash safety
  presenceInterval = setInterval(() => {
    const status = mapActivityToPresence();
    writePresence(status);
  }, 2 * 60 * 1000);
}

async function leavePresence() {
  if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
  await writePresence('offline');
  lastPresenceStatus = null;
}

function mapActivityToPresence() {
  if (!isTracking && userActivityState === 'idle') return 'afk';
  if (userActivityState === 'idle') return 'afk';
  return 'online'; // active or bg
}

// Called from the activity scan loop when state changes
function syncPresenceIfChanged() {
  const status = mapActivityToPresence();
  const now = Date.now();
  // Only write if status changed OR 2 min since last write (heartbeat)
  if (status !== lastPresenceStatus || now - lastPresenceWrite >= 2 * 60 * 1000) {
    writePresence(status);
  }
}

async function writePresence(status) {
  try {
    const userId = await getCachedUserId();
    if (!userId) return;
    await supabase.from('profiles').update({
      presence_status: status,
      last_seen_at: new Date().toISOString()
    }).eq('id', userId);
    lastPresenceStatus = status;
    lastPresenceWrite = Date.now();
  } catch (e) {
    logError('writePresence', e);
  }
}

async function getOnlineFriends() {
  try {
    const userId = await getCachedUserId();
    if (!userId) return {};
    const user = { id: userId };

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Get accepted friend IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (!friendships || friendships.length === 0) return {};

    const friendIds = friendships.map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    // Get friends who are online or afk (with staleness check)
    const { data: onlineFriends } = await supabase
      .from('profiles')
      .select('id, display_name, level, title, presence_status, last_seen_at')
      .in('id', friendIds)
      .in('presence_status', ['online', 'afk'])
      .gte('last_seen_at', fiveMinAgo);

    const result = {};
    for (const f of (onlineFriends || [])) {
      result[f.id] = {
        user_id: f.id,
        display_name: f.display_name,
        level: f.level || 1,
        title: f.title || 'Novice',
        activity_state: f.presence_status,
        online_at: f.last_seen_at
      };
    }
    return result;
  } catch (e) {
    logError('getOnlineFriends', e);
    return {};
  }
}

async function getCommunityStats() {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [onlineRes, activeRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .in('presence_status', ['online', 'afk']).gte('last_seen_at', fiveMinAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .gte('last_seen_at', oneWeekAgo)
    ]);

    return {
      onlineCount: onlineRes.error ? 0 : (onlineRes.count || 0),
      totalUsers: activeRes.error ? 0 : (activeRes.count || 0)
    };
  } catch (e) {
    logError('getCommunityStats', e);
    return { onlineCount: 0, totalUsers: 0 };
  }
}

// ===== Public Profile =====
async function getPublicProfile(userId) {
  try {
    if (!userId) return { profile: null };
    const { data: { user } } = await supabase.auth.getUser();

    // If it's the current user, sync game state to profiles first so data is fresh
    if (user && user.id === userId) {
      await syncProfileToCloud();
    }

    const { data, error } = await supabase.from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      logError('getPublicProfile', error);
      return { profile: null };
    }
    if (data) return { profile: data };
    return { profile: null };
  } catch (e) {
    logError('getPublicProfile', e);
    return { profile: null };
  }
}

// ===== Global Leaderboard =====
async function syncProfileToCloud() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const gs = loadGameState();
    await supabase.from('profiles').upsert({
      id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Unknown',
      level: gs.level || 1,
      xp: gs.xp || 0,
      title: gs.title || 'Novice',
      streak_current: gs.streak?.current || 0,
      streak_best: gs.streak?.best || 0,
      tier: cachedTier || 'free',
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) { logError('syncProfileToCloud', e); }
}

async function getGlobalLeaderboard(metric, limit) {
  try {
    const userId = await getCachedUserId();
    if (!userId) return { players: [], myRank: null };
    const user = { id: userId };

    // Rely on the 5-minute sync interval to keep profile stats fresh
    const validMetrics = ['level', 'xp', 'streak_current'];
    const col = validMetrics.includes(metric) ? metric : 'level';
    const topN = Math.min(Math.max(limit || 50, 10), 100);

    const { data, error } = await supabase.from('profiles')
      .select('id, display_name, level, xp, title, streak_current')
      .order(col, { ascending: false })
      .limit(topN);
    if (error) { logError('getGlobalLeaderboard', error); return { players: [], myRank: null }; }

    const players = (data || []).map((p, i) => ({
      id: p.id,
      name: p.display_name || 'Unknown',
      level: p.level || 1,
      xp: p.xp || 0,
      title: p.title || 'Novice',
      streak: p.streak_current || 0,
      rank: i + 1,
      isYou: p.id === user.id
    }));

    // Check if user is in the list
    let myRank = null;
    const meInList = players.find(p => p.isYou);
    if (meInList) {
      myRank = meInList.rank;
    } else {
      // Get user's rank by counting how many are above them
      const { data: profile } = await supabase.from('profiles')
        .select(col).eq('id', user.id).single();
      if (profile) {
        const { count } = await supabase.from('profiles')
          .select('id', { count: 'exact', head: true })
          .gt(col, profile[col]);
        myRank = (count || 0) + 1;
      }
    }

    return { players, myRank };
  } catch (e) {
    logError('getGlobalLeaderboard', e);
    return { players: [], myRank: null };
  }
}

// ===== Guilds =====
async function getGuilds(sort, search) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase.from('guilds').select('*');
    if (search) {
      const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.ilike('name', `%${escapedSearch}%`);
    }
    if (sort === 'xp') query = query.order('total_xp', { ascending: false });
    else query = query.order('member_count', { ascending: false });
    query = query.limit(50);

    const { data, error } = await query;
    if (error) { logError('getGuilds', error); return []; }
    return data || [];
  } catch (e) {
    logError('getGuilds', e);
    return [];
  }
}

async function getGuild(guildId) {
  try {
    const { data, error } = await supabase.from('guilds')
      .select('*').eq('id', guildId).single();
    if (error) { logError('getGuild', error); return null; }
    return data;
  } catch (e) {
    logError('getGuild', e);
    return null;
  }
}

async function getGuildMembers(guildId) {
  try {
    const { data, error } = await supabase.from('guild_members')
      .select('*, profile:profiles(display_name, level, title)')
      .eq('guild_id', guildId)
      .order('role', { ascending: true });
    if (error) { logError('getGuildMembers', error); return []; }
    return (data || []).map(m => ({
      ...m,
      display_name: m.profile?.display_name || 'Unknown',
      level: m.profile?.level || 1,
      title: m.profile?.title || 'Novice'
    }));
  } catch (e) {
    logError('getGuildMembers', e);
    return [];
  }
}

async function createGuild(name, description, icon, color) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };
    if (!name || name.length < 2 || name.length > 30) return { success: false, error: 'Name must be 2-30 characters' };

    // Check if user is already in a guild
    const { data: existing } = await supabase.from('guild_members')
      .select('id').eq('user_id', user.id).limit(1);
    if (existing && existing.length > 0) return { success: false, error: 'You are already in a guild' };

    const { data: guild, error } = await supabase.from('guilds').insert({
      name, description: description || '', icon: icon || '⚔', color: color || '#f5c542',
      owner_id: user.id, member_count: 1, total_xp: 0
    }).select().single();
    if (error) return { success: false, error: error.message };

    // Add creator as owner member
    await supabase.from('guild_members').insert({
      guild_id: guild.id, user_id: user.id, role: 'owner'
    });

    return { success: true, guild };
  } catch (e) {
    logError('createGuild', e);
    return { success: false, error: e.message };
  }
}

async function joinGuild(guildId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    // Check if user is already in a guild
    const { data: existing } = await supabase.from('guild_members')
      .select('id').eq('user_id', user.id).limit(1);
    if (existing && existing.length > 0) return { success: false, error: 'You are already in a guild' };

    const { error } = await supabase.from('guild_members').insert({
      guild_id: guildId, user_id: user.id, role: 'member'
    });
    if (error) return { success: false, error: error.message };

    // Increment member count
    await supabase.rpc('increment_guild_members', { guild_id_param: guildId });

    return { success: true };
  } catch (e) {
    logError('joinGuild', e);
    return { success: false, error: e.message };
  }
}

async function leaveGuild(guildId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    const { error } = await supabase.from('guild_members')
      .delete().eq('guild_id', guildId).eq('user_id', user.id);
    if (error) return { success: false, error: error.message };

    // Decrement member count
    await supabase.rpc('decrement_guild_members', { guild_id_param: guildId });

    return { success: true };
  } catch (e) {
    logError('leaveGuild', e);
    return { success: false, error: e.message };
  }
}

async function updateGuildMemberRole(guildId, userId, role) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    // Verify caller is guild owner
    const { data: guild } = await supabase.from('guilds')
      .select('owner_id').eq('id', guildId).single();
    if (!guild || guild.owner_id !== user.id) return { success: false, error: 'Only the guild owner can change roles' };

    const validRoles = ['member', 'officer'];
    if (!validRoles.includes(role)) return { success: false, error: 'Invalid role' };

    const { error } = await supabase.from('guild_members')
      .update({ role }).eq('guild_id', guildId).eq('user_id', userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    logError('updateGuildMemberRole', e);
    return { success: false, error: e.message };
  }
}

async function getMyGuild() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: membership } = await supabase.from('guild_members')
      .select('guild_id, role').eq('user_id', user.id).limit(1).single();
    if (!membership) return null;

    const guild = await getGuild(membership.guild_id);
    if (!guild) return null;
    return { ...guild, myRole: membership.role };
  } catch (e) {
    logError('getMyGuild', e);
    return null;
  }
}

// ===== Weekly Challenges =====
const CHALLENGE_TEMPLATES = [
  { key: 'code_10h', title: 'Code Warrior', description: 'Spend 10 hours coding this week', target: 36000000, metric: 'coding_ms', xp: 75 },
  { key: 'streak_5', title: 'Streak Master', description: 'Maintain a 5-day streak', target: 5, metric: 'streak', xp: 50 },
  { key: 'apps_6', title: 'Multi-Tasker', description: 'Use 6 or more different apps in a day', target: 6, metric: 'daily_apps', xp: 40 },
  { key: 'active_5d', title: 'Consistent', description: 'Be active for 5 days this week', target: 5, metric: 'active_days', xp: 50 },
  { key: 'total_20h', title: 'Dedicated', description: 'Track 20 hours of activity this week', target: 72000000, metric: 'total_ms', xp: 60 },
  { key: 'music_3h', title: 'Musician', description: 'Spend 3 hours making music', target: 10800000, metric: 'music_ms', xp: 50 },
  { key: 'design_3h', title: 'Designer', description: 'Spend 3 hours on design work', target: 10800000, metric: 'design_ms', xp: 50 },
  { key: 'clicks_5k', title: 'Clicker', description: 'Register 5,000 clicks this week', target: 5000, metric: 'clicks', xp: 35 },
  { key: 'keys_20k', title: 'Typist', description: 'Hit 20,000 keystrokes this week', target: 20000, metric: 'keys', xp: 40 },
  { key: 'cats_4', title: 'Diverse', description: 'Use 4 different categories in a day', target: 4, metric: 'daily_cats', xp: 35 },
  { key: 'browse_under_2h', title: 'Focused', description: 'Keep browsing under 2 hours this week', target: 7200000, metric: 'browsing_under_ms', xp: 60 },
  { key: 'total_30h', title: 'Grinder', description: 'Track 30 hours of activity this week', target: 108000000, metric: 'total_ms_30', xp: 100 },
  { key: 'events_10k', title: 'Active Hands', description: 'Register 10,000 input events', target: 10000, metric: 'events', xp: 45 },
  { key: 'code_5h', title: 'Code Session', description: 'Spend 5 hours coding this week', target: 18000000, metric: 'coding_ms_5', xp: 40 },
  { key: 'prod_5h', title: 'Productive', description: 'Spend 5 hours on productivity apps', target: 18000000, metric: 'productivity_ms', xp: 45 }
];

function getWeekMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

async function ensureWeeklyChallenges() {
  try {
    const weekStart = getWeekMonday();

    // Check if challenges already exist for this week
    const { data: existing } = await supabase.from('weekly_challenges')
      .select('id').eq('week_start', weekStart).limit(1);
    if (existing && existing.length > 0) return;

    // Deterministic seed from week start date
    let seed = 0;
    for (const ch of weekStart) seed = ((seed << 5) - seed + ch.charCodeAt(0)) | 0;
    const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    // Pick 4 challenges
    const shuffled = [...CHALLENGE_TEMPLATES].sort(() => rng() - 0.5);
    const picked = shuffled.slice(0, 4);

    const rows = picked.map(t => ({
      week_start: weekStart,
      challenge_key: t.key,
      title: t.title,
      description: t.description,
      target_value: t.target,
      xp_reward: t.xp,
      metric: t.metric
    }));

    await supabase.from('weekly_challenges').upsert(rows, { onConflict: 'week_start,challenge_key' });
  } catch (e) {
    logError('ensureWeeklyChallenges', e);
  }
}

async function getWeeklyChallenges() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const weekStart = getWeekMonday();
    await ensureWeeklyChallenges();

    const { data: challenges, error } = await supabase.from('weekly_challenges')
      .select('*').eq('week_start', weekStart);
    if (error) { logError('getWeeklyChallenges', error); return []; }

    // Fetch user progress
    const challengeIds = (challenges || []).map(c => c.id);
    const { data: progress } = await supabase.from('challenge_progress')
      .select('*').eq('user_id', user.id).in('challenge_id', challengeIds);
    const progressMap = {};
    for (const p of (progress || [])) progressMap[p.challenge_id] = p;

    // Compute current progress from activity data
    const weekEnd = new Date().toISOString().split('T')[0];
    let weekData = [];
    try { weekData = await loadRange(weekStart, weekEnd); } catch (_) {}

    let totalMs = 0, codingMs = 0, musicMs = 0, designMs = 0, browsingMs = 0, productivityMs = 0;
    let totalClicks = 0, totalKeys = 0, totalEvents = 0, activeDays = 0;
    let maxDailyApps = 0, maxDailyCats = 0;
    const gameState = loadGameState();

    for (const day of weekData) {
      const s = day.summary || {};
      totalMs += s.totalMs || 0;
      totalClicks += (s.totalClicks || 0) + (s.totalRightClicks || 0);
      totalKeys += s.totalKeys || 0;
      totalEvents += s.totalEvents || 0;
      if ((s.totalMs || 0) >= 3600000) activeDays++;
      const byCat = s.byCategory || {};
      codingMs += byCat.coding || 0;
      musicMs += byCat.music || 0;
      designMs += byCat.design || 0;
      browsingMs += byCat.browsing || 0;
      productivityMs += byCat.productivity || 0;
      maxDailyApps = Math.max(maxDailyApps, Object.keys(s.byApp || {}).length);
      maxDailyCats = Math.max(maxDailyCats, Object.keys(byCat).length);
    }

    return (challenges || []).map(c => {
      const prog = progressMap[c.id];
      let current = 0;
      switch (c.metric) {
        case 'coding_ms': case 'coding_ms_5': current = codingMs; break;
        case 'music_ms': current = musicMs; break;
        case 'design_ms': current = designMs; break;
        case 'productivity_ms': current = productivityMs; break;
        case 'total_ms': case 'total_ms_30': current = totalMs; break;
        case 'browsing_under_ms': current = Math.max(0, c.target_value - browsingMs); break;
        case 'streak': current = gameState.streak?.current || 0; break;
        case 'active_days': current = activeDays; break;
        case 'daily_apps': current = maxDailyApps; break;
        case 'daily_cats': current = maxDailyCats; break;
        case 'clicks': current = totalClicks; break;
        case 'keys': current = totalKeys; break;
        case 'events': current = totalEvents; break;
      }
      return {
        ...c,
        current_value: prog?.current_value || current,
        completed: prog?.completed || false,
        completed_at: prog?.completed_at || null,
        computed_current: current
      };
    });
  } catch (e) {
    logError('getWeeklyChallenges', e);
    return [];
  }
}

async function completeChallenge(challengeId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    // Check challenge exists and get xp reward
    const { data: challenge } = await supabase.from('weekly_challenges')
      .select('*').eq('id', challengeId).single();
    if (!challenge) return { success: false, error: 'Challenge not found' };

    // Upsert progress
    await supabase.from('challenge_progress').upsert({
      user_id: user.id,
      challenge_id: challengeId,
      completed: true,
      completed_at: new Date().toISOString(),
      current_value: challenge.target_value
    }, { onConflict: 'user_id,challenge_id' });

    // Award XP
    const gameState = loadGameState();
    gameState.xp = (gameState.xp || 0) + (challenge.xp_reward || 50);
    saveGameState(gameState);

    return { success: true, xpAwarded: challenge.xp_reward || 50 };
  } catch (e) {
    logError('completeChallenge', e);
    return { success: false, error: e.message };
  }
}

// ===== Chat Reactions =====
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '💯', '⚔'];

async function addReaction(messageId, messageType, emoji) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };
    if (!ALLOWED_REACTIONS.includes(emoji)) return { success: false, error: 'Invalid emoji' };

    // Toggle: check if reaction exists
    const { data: existing } = await supabase.from('chat_reactions')
      .select('id').eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji).limit(1);

    if (existing && existing.length > 0) {
      // Remove existing reaction
      await supabase.from('chat_reactions').delete().eq('id', existing[0].id);
      return { success: true, action: 'removed' };
    } else {
      // Add new reaction
      await supabase.from('chat_reactions').insert({
        message_id: messageId,
        message_type: messageType || 'channel',
        user_id: user.id,
        emoji
      });
      return { success: true, action: 'added' };
    }
  } catch (e) {
    logError('addReaction', e);
    return { success: false, error: e.message };
  }
}

async function getReactions(messageIds) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    if (!messageIds || messageIds.length === 0) return {};

    const { data, error } = await supabase.from('chat_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds);
    if (error) { logError('getReactions', error); return {}; }

    // Group: { messageId: { emoji: { count, mine } } }
    const result = {};
    for (const r of (data || [])) {
      if (!result[r.message_id]) result[r.message_id] = {};
      if (!result[r.message_id][r.emoji]) result[r.message_id][r.emoji] = { count: 0, mine: false };
      result[r.message_id][r.emoji].count++;
      if (r.user_id === user.id) result[r.message_id][r.emoji].mine = true;
    }
    return result;
  } catch (e) {
    logError('getReactions', e);
    return {};
  }
}

// ===== Projects: Git Integration =====
function runGitCommand(projectPath, args) {
  if (!projectPath || typeof projectPath !== 'string' || !path.isAbsolute(projectPath) || !fs.existsSync(projectPath)) {
    return Promise.reject(new Error('Invalid project path'));
  }
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: projectPath, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

async function getGitLog(projectPath, limit) {
  try {
    const n = Math.min(Math.max(limit || 15, 1), 50);
    const output = await runGitCommand(projectPath, ['log', `--oneline`, `--format=%H|%an|%s|%ai`, `-${n}`]);
    if (!output) return [];
    return output.split('\n').filter(Boolean).map(line => {
      const [hash, author, message, date] = line.split('|');
      return { hash: (hash || '').slice(0, 8), author, message, date };
    });
  } catch (e) {
    return [];
  }
}

async function getGitBranches(projectPath) {
  try {
    const output = await runGitCommand(projectPath, ['branch', '-a']);
    if (!output) return { branches: [], current: '' };
    const branches = [];
    let current = '';
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('* ')) {
        current = trimmed.slice(2);
        branches.push(current);
      } else {
        branches.push(trimmed);
      }
    }
    return { branches, current };
  } catch (e) {
    return { branches: [], current: '' };
  }
}

async function getGitStatus(projectPath) {
  try {
    const output = await runGitCommand(projectPath, ['status', '--porcelain']);
    if (!output) return [];
    return output.split('\n').filter(Boolean).map(line => {
      const status = line.slice(0, 2).trim();
      const file = line.slice(3);
      let type = 'modified';
      if (status === '??' || status === 'A') type = 'added';
      else if (status === 'D') type = 'deleted';
      return { file, status, type };
    });
  } catch (e) {
    return [];
  }
}

// ===== IPC Handlers =====
// Auth
ipcMain.handle('auth:signup', (e, email, password, displayName, referralCode) => authSignUp(email, password, displayName, referralCode));
ipcMain.handle('auth:login', (e, email, password) => authLogin(email, password));
ipcMain.handle('auth:resetPassword', async (e, email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://spiros.app/reset-password'
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('auth:logout', () => authLogout());
ipcMain.handle('auth:user', () => authGetUser());
ipcMain.handle('auth:updateProfile', (e, updates) => updateProfile(updates));

// Profile
ipcMain.handle('profile:changeName', (e, newName) => changeDisplayName(newName));
ipcMain.handle('profile:getPublic', (e, userId) => getPublicProfile(userId));

// Referrals
ipcMain.handle('referral:validate', async (e, code) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ code })
    });
    return await res.json();
  } catch (err) {
    return { valid: false, error: err.message };
  }
});

ipcMain.handle('referral:getCode', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { code: null };
  const { data } = await supabase
    .from('profiles').select('referral_code').eq('id', user.id).single();
  return { code: data?.referral_code || null };
});

ipcMain.handle('referral:getStats', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { referral_count: 0, referrals: [], rewards: [] };
  const [profileRes, referralsRes, rewardsRes] = await Promise.all([
    supabase.from('profiles').select('referral_code, referral_count, referred_by').eq('id', user.id).single(),
    supabase.from('referrals').select('id, referred_id, status, created_at, completed_at').eq('referrer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('referral_rewards').select('milestone, reward_type, claimed_at').eq('user_id', user.id)
  ]);
  return {
    referral_code: profileRes.data?.referral_code,
    referral_count: profileRes.data?.referral_count || 0,
    referred_by: profileRes.data?.referred_by,
    referrals: referralsRes.data || [],
    rewards: rewardsRes.data || []
  };
});

ipcMain.handle('referral:claimRewards', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Not logged in' };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/claim-referral-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({})
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
});

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

// Chat Reactions
ipcMain.handle('chat:addReaction', (e, messageId, messageType, emoji) => addReaction(messageId, messageType, emoji));
ipcMain.handle('chat:getReactions', (e, messageIds) => getReactions(messageIds));

// Leaderboard
ipcMain.handle('leaderboard:global', (e, metric, limit) => getGlobalLeaderboard(metric, limit));

// Guilds
ipcMain.handle('guilds:list', (e, sort, search) => getGuilds(sort, search));
ipcMain.handle('guilds:get', (e, guildId) => getGuild(guildId));
ipcMain.handle('guilds:members', (e, guildId) => getGuildMembers(guildId));
ipcMain.handle('guilds:create', (e, name, desc, icon, color) => createGuild(name, desc, icon, color));
ipcMain.handle('guilds:join', (e, guildId) => joinGuild(guildId));
ipcMain.handle('guilds:leave', (e, guildId) => leaveGuild(guildId));
ipcMain.handle('guilds:updateRole', (e, guildId, userId, role) => updateGuildMemberRole(guildId, userId, role));
ipcMain.handle('guilds:mine', () => getMyGuild());

// Challenges
ipcMain.handle('challenges:getWeekly', () => getWeeklyChallenges());
ipcMain.handle('challenges:complete', (e, challengeId) => completeChallenge(challengeId));

// Subscriptions
ipcMain.handle('subscription:getTier', () => getUserTier());
ipcMain.handle('subscription:getCached', () => cachedTier);
ipcMain.handle('subscription:createCheckout', (e, planKey) => createCheckoutSession(planKey));
ipcMain.handle('subscription:openPortal', () => openPortalSession());
ipcMain.handle('subscription:getDetails', () => getSubscriptionDetails());
ipcMain.handle('subscription:useStreakFreeze', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };
  return useStreakFreeze(user.id);
});

// Projects: Git
ipcMain.handle('projects:gitLog', (e, projectPath, limit) => getGitLog(projectPath, limit));
ipcMain.handle('projects:gitBranches', (e, projectPath) => getGitBranches(projectPath));
ipcMain.handle('projects:gitStatus', (e, projectPath) => getGitStatus(projectPath));

// Presence
ipcMain.handle('presence:getOnlineFriends', () => getOnlineFriends());
ipcMain.handle('presence:communityStats', () => getCommunityStats());

// Sync
ipcMain.handle('sync:now', () => syncActivityToCloud());
ipcMain.handle('sync:profile', async () => {
  try {
    await syncProfileToCloud();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('profile:localStats', () => {
  const gs = loadGameState();
  return {
    level: gs.level || 1,
    xp: gs.xp || 0,
    title: gs.title || 'Novice',
    streak: gs.streak?.current || 0,
    bestStreak: gs.streak?.best || 0
  };
});

// Achievement Sync
ipcMain.handle('achievements:sync', async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    const gs = loadGameState();
    const localAchievements = gs.achievements || [];

    // Fetch cloud achievements
    const { data: cloudRows, error: fetchErr } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', user.id);

    if (fetchErr) return { success: false, error: fetchErr.message };

    const cloudIds = new Set((cloudRows || []).map(r => r.achievement_id));
    const localSet = new Set(localAchievements);

    // Upload local-only achievements to cloud
    const toUpload = localAchievements.filter(id => !cloudIds.has(id));
    if (toUpload.length > 0) {
      const rows = toUpload.map(id => ({ user_id: user.id, achievement_id: id }));
      await supabase.from('user_achievements').upsert(rows, { onConflict: 'user_id,achievement_id' });
    }

    // Merge cloud-only achievements into local
    const fromCloud = (cloudRows || []).filter(r => !localSet.has(r.achievement_id)).map(r => r.achievement_id);
    if (fromCloud.length > 0) {
      gs.achievements = [...localAchievements, ...fromCloud];
      saveGameState(gs);
    }

    return { success: true, uploaded: toUpload.length, downloaded: fromCloud.length };
  } catch (e) {
    logError('achievements:sync', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gamestats:sync', async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    const gs = loadGameState();
    const stats = gs.stats || {};

    const { error } = await supabase
      .from('user_game_stats')
      .upsert({ user_id: user.id, stats, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    logError('gamestats:sync', e);
    return { success: false, error: e.message };
  }
});

// Tracker
ipcMain.handle('tracker:start', () => { startTracking(); return { success: true }; });
ipcMain.handle('tracker:stop', () => { stopTracking(); return { success: true }; });
ipcMain.handle('tracker:status', () => ({ isTracking, activityState: isTracking ? userActivityState : 'idle' }));
ipcMain.handle('tracker:today', () => loadTodayData());
ipcMain.handle('tracker:range', (e, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  // Cap range to 365 days
  const maxRange = 365 * 86400000;
  if (end - start > maxRange) return [];
  return loadRange(startDate, endDate);
});

// Changelog
ipcMain.handle('app:getChangelog', () => {
  try { return fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8'); }
  catch (e) { return ''; }
});

ipcMain.handle('projects:scan', async (e, folder) => {
  const settings = loadSettings();
  const folderPath = folder || settings.projectsFolder;
  if (!folderPath) return [];
  // Only allow scanning within the configured projects folder
  const resolved = path.resolve(folderPath);
  const allowed = path.resolve(settings.projectsFolder || '');
  if (allowed && !resolved.startsWith(allowed)) return [];
  try {
    return await scanProjects(folderPath);
  } catch (err) {
    console.error('projects:scan error:', err);
    return [];
  }
});

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:set', (e, newSettings) => {
  if (!newSettings || typeof newSettings !== 'object') return { success: false };
  // Enforce safe ranges
  if (newSettings.pollIntervalMs !== undefined) {
    newSettings.pollIntervalMs = Math.max(3000, Math.min(newSettings.pollIntervalMs, 60000));
  }
  if (newSettings.idleTimeoutMs !== undefined) {
    newSettings.idleTimeoutMs = Math.max(60000, Math.min(newSettings.idleTimeoutMs, 3600000));
  }
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
  if (!state || typeof state !== 'object') return { success: false };
  // Cap values to prevent impossible states in leaderboards
  if (state.xp !== undefined) state.xp = Math.max(0, Math.min(state.xp, 10000000));
  if (state.level !== undefined) state.level = Math.max(1, Math.min(state.level, 100));
  if (state.streak) {
    if (state.streak.current !== undefined) state.streak.current = Math.max(0, Math.min(state.streak.current, 3650));
    if (state.streak.best !== undefined) state.streak.best = Math.max(0, Math.min(state.streak.best, 3650));
  }
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
    if (!projPath || typeof projPath !== 'string' || !path.isAbsolute(projPath) || !fs.existsSync(projPath)) {
      return { success: false, error: 'Invalid project path' };
    }
    spawn('code', [projPath], { detached: true, stdio: 'ignore' }).unref();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:openTerminal', (e, projPath) => {
  try {
    if (!projPath || typeof projPath !== 'string' || !path.isAbsolute(projPath) || !fs.existsSync(projPath)) {
      return { success: false, error: 'Invalid project path' };
    }
    const wt = spawn('wt', ['-d', projPath], { detached: true, stdio: 'ignore' });
    wt.on('error', () => {
      spawn('cmd', ['/K', 'cd', '/d', projPath], { detached: true, stdio: 'ignore' }).unref();
    });
    wt.unref();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:exportData', async () => {
  try {
    if (!hasTier('starter')) return { success: false, error: 'Data export requires a Starter subscription.' };
    const files = fs.readdirSync(activityDir).filter(f => f.endsWith('.json'));
    const allData = files.map(f => JSON.parse(fs.readFileSync(path.join(activityDir, f), 'utf8')));
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Activity Data',
      defaultPath: 'spiros-export.json',
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'CSV', extensions: ['csv'] }
      ]
    });
    if (!result.canceled && result.filePath) {
      if (result.filePath.endsWith('.csv')) {
        // CSV export: one row per day with summary columns
        const header = 'date,totalMs,totalClicks,totalKeys,totalWords,totalScrolls,totalEvents';
        const rows = allData.map(d => {
          const s = d.summary || {};
          return `${d.date || ''},${s.totalMs || 0},${(s.totalClicks || 0) + (s.totalRightClicks || 0)},${s.totalKeys || 0},${s.totalWords || 0},${s.totalScrolls || 0},${s.totalEvents || 0}`;
        });
        fs.writeFileSync(result.filePath, header + '\n' + rows.join('\n'));
      } else {
        fs.writeFileSync(result.filePath, JSON.stringify(allData, null, 2));
      }
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
    await supabase.from('referral_rewards').delete().eq('user_id', user.id);
    await supabase.from('referrals').delete().or(`referrer_id.eq.${user.id},referred_id.eq.${user.id}`);
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
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    try {
      const hostname = new URL(url).hostname;
      if (ALLOWED_EXTERNAL_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
        shell.openExternal(url);
        return { success: true };
      }
    } catch (_) {}
  }
  return { success: false, error: 'URL not allowed' };
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
    getUserTier();
    subscribeToTierChanges();
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
