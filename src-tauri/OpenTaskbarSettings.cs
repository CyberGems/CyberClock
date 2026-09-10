using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

/// <summary>
/// Opens Windows Taskbar settings and, on Windows 10, invokes the nested
/// "Select which icons appear on the taskbar" hyperlink via UI Automation.
/// Win11 has no nested page — the parent ms-settings:taskbar page is enough.
///
/// Do not launch the legacy Control Panel CLSID {05d7b0f4-…}: that applet is
/// hosted by explorer.exe and can crash Explorer on Windows 10.
///
/// The XAML tree (hyperlinks) lives on Windows.UI.Core.CoreWindow inside the
/// ApplicationFrameWindow. Searching the frame window by title never sees them.
/// </summary>
internal static class Program
{
    private const string TaskbarSettingsUri = "ms-settings:taskbar";
    private const string CoreWindowClass = "Windows.UI.Core.CoreWindow";
    private const string SettingsFrameClass = "ApplicationFrameWindow";

    private static readonly string[] IconListLinkFragments =
    {
        "icons appear on the taskbar",
        "iconos que aparecen",
        "iconos que aparecer",
        "seleccionar qué iconos",
        "seleccionar que iconos",
        "seleccionar los iconos",
        "symbole in der taskleiste",
        "icônes qui s'affichent",
        "icones qui s'affichent",
        "タスク",
        "选择哪些图标",
        "選擇哪些圖示"
    };

    private static readonly string[] IconListPageFragments =
    {
        "always show all icons in the notification area",
        "mostrar siempre todos los iconos",
        "alle symbole im infobereich",
        "toujours afficher toutes les icônes",
        "toujours afficher toutes les icones",
        "通知領域",
        "始终在通知区域",
        "始終在通知區域"
    };

    private static readonly string[] SettingsWindowTitles =
    {
        "Settings",
        "Configuración",
        "Einstellungen",
        "Paramètres",
        "設定",
        "设置"
    };

    private static readonly string LogPath = Path.Combine(
        Path.GetTempPath(),
        "cyberclock-open-taskbar-settings.log");

    [STAThread]
    public static void Main()
    {
        try
        {
            try { File.WriteAllText(LogPath, ""); } catch { }
            Log("start");
            if (!TryStartUri(TaskbarSettingsUri))
            {
                Log("failed to launch ms-settings:taskbar");
                return;
            }

            if (TryOpenIconListPage())
                Log("opened nested icon-list page");
            else
                Log("nested icon-list link was not found (ok on Win11)");
        }
        catch (Exception ex)
        {
            Log("fatal: " + ex.Message);
        }
    }

    private static bool TryOpenIconListPage()
    {
        var deadline = DateTime.UtcNow.AddSeconds(12);
        while (DateTime.UtcNow < deadline)
        {
            var window = FindSettingsWindow();
            if (window != null)
            {
                if (HasNamedFragment(window, IconListPageFragments))
                    return true;
                if (TryInvokeIconListLink(window))
                    return true;
            }

            Thread.Sleep(250);
        }

        return false;
    }

    private static AutomationElement FindSettingsWindow()
    {
        var hwnd = FindSystemSettingsHwnd();
        if (hwnd == IntPtr.Zero)
            return null;

        var core = FindDescendantByClass(hwnd, CoreWindowClass);
        if (core != IntPtr.Zero)
        {
            try
            {
                return AutomationElement.FromHandle(core);
            }
            catch
            {
            }
        }

        try
        {
            return AutomationElement.FromHandle(hwnd);
        }
        catch
        {
            return null;
        }
    }

    private static IntPtr FindSystemSettingsHwnd()
    {
        foreach (var title in SettingsWindowTitles)
        {
            var hwnd = FindWindow(SettingsFrameClass, title);
            if (IsCandidate(hwnd))
                return hwnd;
        }

        _enumFound = IntPtr.Zero;
        EnumWindows(EnumSettingsProc, IntPtr.Zero);
        return _enumFound;
    }

    private static IntPtr _enumFound;

    private static bool EnumSettingsProc(IntPtr hwnd, IntPtr lParam)
    {
        if (!IsCandidate(hwnd))
            return true;
        if (!ClassNameEquals(hwnd, SettingsFrameClass))
            return true;

        var title = GetWindowTitle(hwnd);
        foreach (var expected in SettingsWindowTitles)
        {
            if (title.IndexOf(expected, StringComparison.OrdinalIgnoreCase) >= 0)
            {
                _enumFound = hwnd;
                return false;
            }
        }

        return true;
    }

    private static bool IsCandidate(IntPtr hwnd)
    {
        return hwnd != IntPtr.Zero && IsWindowVisible(hwnd);
    }

    private static IntPtr FindDescendantByClass(IntPtr parent, string className)
    {
        var direct = FindWindowEx(parent, IntPtr.Zero, className, null);
        if (direct != IntPtr.Zero)
            return direct;

        var child = IntPtr.Zero;
        while (true)
        {
            child = FindWindowEx(parent, child, null, null);
            if (child == IntPtr.Zero)
                break;
            var nested = FindDescendantByClass(child, className);
            if (nested != IntPtr.Zero)
                return nested;
        }

        return IntPtr.Zero;
    }

    private static bool TryInvokeIconListLink(AutomationElement window)
    {
        if (InvokeMatching(window, ControlType.Hyperlink))
            return true;
        if (InvokeMatching(window, ControlType.Button))
            return true;
        return InvokeMatching(window, null);
    }

    private static bool InvokeMatching(AutomationElement window, ControlType controlType)
    {
        try
        {
            Condition condition = controlType != null
                ? (Condition)new PropertyCondition(AutomationElement.ControlTypeProperty, controlType)
                : Condition.TrueCondition;

            var nodes = window.FindAll(TreeScope.Descendants, condition);
            foreach (AutomationElement node in nodes)
            {
                string name;
                try
                {
                    name = node.Current.Name;
                }
                catch
                {
                    continue;
                }

                if (string.IsNullOrWhiteSpace(name) || !ContainsAny(name, IconListLinkFragments))
                    continue;

                if (TryInvoke(node))
                {
                    Log("invoked '" + name + "'");
                    return true;
                }
            }
        }
        catch
        {
        }

        return false;
    }

    private static bool TryInvoke(AutomationElement node)
    {
        try
        {
            object pattern;
            if (node.TryGetCurrentPattern(InvokePattern.Pattern, out pattern))
            {
                var invoke = pattern as InvokePattern;
                if (invoke != null)
                {
                    invoke.Invoke();
                    return true;
                }
            }
        }
        catch
        {
        }

        return false;
    }

    private static bool HasNamedFragment(AutomationElement window, string[] fragments)
    {
        try
        {
            var nodes = window.FindAll(TreeScope.Descendants, Condition.TrueCondition);
            foreach (AutomationElement node in nodes)
            {
                string name;
                try
                {
                    name = node.Current.Name;
                }
                catch
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(name) && ContainsAny(name, fragments))
                    return true;
            }
        }
        catch
        {
        }

        return false;
    }

    private static bool ContainsAny(string text, string[] fragments)
    {
        foreach (var fragment in fragments)
        {
            if (text.IndexOf(fragment, StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
        }

        return false;
    }

    private static bool TryStartUri(string uri)
    {
        try
        {
            Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string GetWindowTitle(IntPtr hwnd)
    {
        var sb = new StringBuilder(256);
        var len = GetWindowText(hwnd, sb, sb.Capacity);
        return len > 0 ? sb.ToString() : string.Empty;
    }

    private static bool ClassNameEquals(IntPtr hwnd, string className)
    {
        var sb = new StringBuilder(256);
        var len = GetClassName(hwnd, sb, sb.Capacity);
        return len > 0 && string.Equals(sb.ToString(), className, StringComparison.Ordinal);
    }

    private static void Log(string message)
    {
        try
        {
            File.AppendAllText(LogPath, DateTime.Now.ToString("HH:mm:ss.fff") + " " + message + Environment.NewLine);
        }
        catch
        {
        }
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
}
