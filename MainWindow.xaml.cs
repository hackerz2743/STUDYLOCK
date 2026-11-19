using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace StudyLock
{
    public partial class MainWindow : Window
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_SYSKEYDOWN = 0x0104;

        private static IntPtr _hookId = IntPtr.Zero;
        private static LowLevelKeyboardProc? _hookProc;
        private static MainWindow? _instance;

        private bool _isLockIn = false;
        private double _prevLeft = 100;
        private double _prevTop = 100;
        private double _prevWidth = 1280;
        private double _prevHeight = 840;
        private WindowState _prevWindowState = WindowState.Normal;

        private readonly string _localDataPath;
        private readonly string _appDataPath;
        private string _activeSessionJson = string.Empty;

        public MainWindow()
        {
            InitializeComponent();
            _instance = this;

            _localDataPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "study_data.json");
            string appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "StudyLock");
            Directory.CreateDirectory(appDataDir);
            _appDataPath = Path.Combine(appDataDir, "study_data.json");

            Loaded += MainWindow_Loaded;
            Closing += MainWindow_Closing;
            Deactivated += MainWindow_Deactivated;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                string webViewUserData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "StudyLock", "WebViewData");
                Directory.CreateDirectory(webViewUserData);

                var env = await CoreWebView2Environment.CreateAsync(null, webViewUserData);
                await StudyWebView.EnsureCoreWebView2Async(env);

                // Determine and prepare wwwroot directory (standalone extraction fallback)
                string wwwroot = EnsureWwwroot();

                StudyWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "studylock.local",
                    wwwroot,
                    CoreWebView2HostResourceAccessKind.Allow
                );

                StudyWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                StudyWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                StudyWebView.CoreWebView2.Settings.AreDevToolsEnabled = true;

                StudyWebView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                StudyWebView.CoreWebView2.Navigate("https://studylock.local/index.html");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to initialize StudyLock WebView: {ex.Message}", "StudyLock Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private string EnsureWwwroot()
        {
            string localWwwroot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            if (Directory.Exists(localWwwroot) && File.Exists(Path.Combine(localWwwroot, "index.html")))
            {
                return localWwwroot;
            }

            // Fallback for standalone single portable EXE moved to any folder
            string appDataWwwroot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "StudyLock", "wwwroot");
            Directory.CreateDirectory(appDataWwwroot);

            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                foreach (string resName in assembly.GetManifestResourceNames())
                {
                    if (resName.Contains("wwwroot."))
                    {
                        int idx = resName.IndexOf("wwwroot.");
                        string fileName = resName.Substring(idx + 8);
                        using var stream = assembly.GetManifestResourceStream(resName);
                        if (stream != null)
                        {
                            string destFile = Path.Combine(appDataWwwroot, fileName);
                            using var fs = File.Create(destFile);
                            stream.CopyTo(fs);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to unpack embedded resources: {ex.Message}");
            }

            return appDataWwwroot;
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string message = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(message)) return;

                using var doc = JsonDocument.Parse(message);
                var root = doc.RootElement;
                if (!root.TryGetProperty("action", out var actionProp)) return;

                string action = actionProp.GetString() ?? "";

                switch (action)
                {
                    case "setLockIn":
                        bool enableLock = root.TryGetProperty("enabled", out var enabledProp) && enabledProp.GetBoolean();
                        if (enableLock) EnableLockIn();
                        else DisableLockIn();
                        break;

                    case "saveData":
                        if (root.TryGetProperty("data", out var dataProp))
                        {
                            string jsonToSave = dataProp.GetRawText();
                            SaveDataToDisk(jsonToSave);
                        }
                        break;

                    case "getData":
                        string storedData = LoadDataFromDisk();
                        PostToWeb(new { type = "loadDataResponse", data = storedData });
                        break;

                    case "sessionTick":
                        if (root.TryGetProperty("session", out var sessionProp))
                        {
                            _activeSessionJson = sessionProp.GetRawText();
                        }
                        break;

                    case "sessionEnded":
                        _activeSessionJson = string.Empty;
                        break;

                    case "minimize":
                        WindowState = WindowState.Minimized;
                        break;

                    case "maximize":
                        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
                        break;

                    case "close":
                        Close();
                        break;

                    case "dragWindow":
                        if (!_isLockIn && Mouse.LeftButton == MouseButtonState.Pressed)
                        {
                            DragMove();
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error handling web message: {ex.Message}");
            }
        }

        public void PostToWeb(object messageObj)
        {
            Dispatcher.Invoke(() =>
            {
                try
                {
                    string json = JsonSerializer.Serialize(messageObj);
                    StudyWebView.CoreWebView2?.PostWebMessageAsString(json);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Failed to post to webview: {ex.Message}");
                }
            });
        }

        private void EnableLockIn()
        {
            if (_isLockIn) return;
            _isLockIn = true;

            _prevLeft = Left;
            _prevTop = Top;
            _prevWidth = Width;
            _prevHeight = Height;
            _prevWindowState = WindowState;

            WindowState = WindowState.Normal;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            Topmost = true;

            Left = 0;
            Top = 0;
            Width = SystemParameters.PrimaryScreenWidth;
            Height = SystemParameters.PrimaryScreenHeight;

            InstallKeyboardHook();
            Activate();
            Focus();
        }

        private void DisableLockIn()
        {
            if (!_isLockIn) return;
            _isLockIn = false;

            UninstallKeyboardHook();

            Topmost = false;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.CanResize;

            Left = _prevLeft;
            Top = _prevTop;
            Width = _prevWidth;
            Height = _prevHeight;
            WindowState = _prevWindowState;
        }

        private void MainWindow_Deactivated(object? sender, EventArgs e)
        {
            if (_isLockIn)
            {
                Dispatcher.BeginInvoke(new Action(() =>
                {
                    if (_isLockIn)
                    {
                        Topmost = true;
                        Activate();
                        Focus();
                    }
                }));
            }
        }

        private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            UninstallKeyboardHook();

            // Emergency auto-save: If there's an active session, notify webview to finish and commit
            if (!string.IsNullOrEmpty(_activeSessionJson))
            {
                try
                {
                    PostToWeb(new { type = "forceAutoSaveBeforeClose" });
                }
                catch { }
            }
        }

        #region Keyboard Hook & Failsafe

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        private void InstallKeyboardHook()
        {
            if (_hookId == IntPtr.Zero)
            {
                _hookProc = HookCallback;
                using var curProcess = Process.GetCurrentProcess();
                using var curModule = curProcess.MainModule;
                if (curModule?.ModuleName != null)
                {
                    _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _hookProc, GetModuleHandle(curModule.ModuleName), 0);
                }
            }
        }

        private void UninstallKeyboardHook()
        {
            if (_hookId != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookId);
                _hookId = IntPtr.Zero;
            }
        }

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN))
            {
                int vkCode = Marshal.ReadInt32(lParam);
                int flags = Marshal.ReadInt32(lParam, 8);
                bool isAltDown = (flags & 0x20) != 0;

                bool isCtrl = (GetKeyState(0x11) & 0x8000) != 0;
                bool isAlt = isAltDown || (GetKeyState(0x12) & 0x8000) != 0;
                bool isShift = (GetKeyState(0x10) & 0x8000) != 0;

                // Hard Failsafe: Ctrl + Alt + Shift + F12 (VK_F12 = 0x7B)
                if (vkCode == 0x7B && isCtrl && isAlt && isShift)
                {
                    _instance?.Dispatcher.Invoke(() =>
                    {
                        _instance.DisableLockIn();
                        _instance.PostToWeb(new { type = "failsafeTriggered" });
                    });
                    return (IntPtr)1; // Suppress
                }

                // If Lock-In mode is active, block task switching keys
                if (_instance != null && _instance._isLockIn)
                {
                    // Win Keys: VK_LWIN (0x5B), VK_RWIN (0x5C)
                    if (vkCode == 0x5B || vkCode == 0x5C) return (IntPtr)1;

                    // Alt + Tab (VK_TAB = 0x09)
                    if (vkCode == 0x09 && isAlt) return (IntPtr)1;

                    // Alt + Esc (VK_ESCAPE = 0x1B)
                    if (vkCode == 0x1B && isAlt) return (IntPtr)1;

                    // Alt + F4 (VK_F4 = 0x73)
                    if (vkCode == 0x73 && isAlt) return (IntPtr)1;

                    // Ctrl + Esc
                    if (vkCode == 0x1B && isCtrl) return (IntPtr)1;

                    // Win + Tab
                    bool isWinDown = (GetKeyState(0x5B) & 0x8000) != 0 || (GetKeyState(0x5C) & 0x8000) != 0;
                    if (vkCode == 0x09 && isWinDown) return (IntPtr)1;
                }
            }

            return CallNextHookEx(_hookId, nCode, wParam, lParam);
        }

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern short GetKeyState(int nVirtKey);

        #endregion

        #region Disk Persistence

        private void SaveDataToDisk(string json)
        {
            try
            {
                File.WriteAllText(_localDataPath, json);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to write to localDataPath: {ex.Message}");
            }

            try
            {
                File.WriteAllText(_appDataPath, json);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to write to appDataPath: {ex.Message}");
            }
        }

        private string LoadDataFromDisk()
        {
            try
            {
                if (File.Exists(_localDataPath))
                {
                    return File.ReadAllText(_localDataPath);
                }
                if (File.Exists(_appDataPath))
                {
                    return File.ReadAllText(_appDataPath);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to read data from disk: {ex.Message}");
            }

            return string.Empty;
        }

        #endregion
    }
}
