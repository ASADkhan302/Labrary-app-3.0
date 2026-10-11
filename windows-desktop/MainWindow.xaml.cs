using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace UniversityOfLakkiMarwatLMS.Desktop
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// Hosts the ULM LMS single-page application inside Microsoft Edge WebView2 Chromium runtime.
    /// </summary>
    public partial class MainWindow : Window
    {
        private const string LocalDevUrl = "http://localhost:3000";
        private const string VirtualHostName = "ulm-lms.local";

        public MainWindow()
        {
            InitializeComponent();
            Loaded += MainWindow_Loaded;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                await InitializeWebViewAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Failed to initialize Microsoft Edge WebView2 runtime.\n\nError: {ex.Message}\n\nPlease install the Evergreen WebView2 Runtime from Microsoft.",
                    "ULM LMS Desktop Startup Error",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }

        private async Task InitializeWebViewAsync()
        {
            // Configure user data folder in LocalAppData for persistent SQLite/localStorage storage
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string userDataFolder = Path.Combine(localAppData, "UniversityOfLakkiMarwatLMS", "WebView2Data");
            Directory.CreateDirectory(userDataFolder);

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await webView.EnsureCoreWebView2Async(env);

            // Configure WebView2 settings
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

            // Handle native window messages from React frontend (Title bar commands)
            webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

            // Check if local Vite dev server is running (e.g. while debugging in Visual Studio)
            bool isDevServerActive = await CheckUrlAvailableAsync(LocalDevUrl);

            if (isDevServerActive)
            {
                // In active Visual Studio live development, navigate directly to localhost
                webView.CoreWebView2.Navigate(LocalDevUrl);
            }
            else
            {
                // In production standalone mode, map the local 'wwwroot' or 'dist' folder
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string distFolder = Path.Combine(baseDir, "wwwroot");

                if (!Directory.Exists(distFolder))
                {
                    // Fallback to relative dist folder if running directly from bin/Debug/
                    string altPath = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "dist"));
                    if (Directory.Exists(altPath))
                    {
                        distFolder = altPath;
                    }
                }

                if (Directory.Exists(distFolder))
                {
                    webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        VirtualHostName,
                        distFolder,
                        CoreWebView2HostResourceAccessKind.Allow
                    );
                    webView.CoreWebView2.Navigate($"https://{VirtualHostName}/index.html");
                }
                else
                {
                    // If dist folder doesn't exist, show helpful message
                    webView.CoreWebView2.NavigateToString(
                        "<html><body style='font-family:sans-serif;background:#0B1120;color:#F8FAFC;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'>" +
                        "<div style='text-align:center;padding:40px;border:1px solid #334155;border-radius:16px;background:#0F172A;'>" +
                        "<h2 style='color:#F59E0B;'>University of Lakki Marwat - LMS</h2>" +
                        "<p>Frontend assets not found. Please run <code>npm run build</code> in the project directory, then rebuild in Visual Studio.</p>" +
                        "<p style='color:#94A3B8;'>Or start the dev server with <code>npm run dev</code> for live reload debugging.</p>" +
                        "</div></body></html>"
                    );
                }
            }

            // Hide the startup loading overlay when navigation completes
            webView.NavigationCompleted += (s, args) =>
            {
                loadingOverlay.Visibility = Visibility.Collapsed;
            };
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string msg = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(msg)) return;

                if (msg.Contains("\"action\":\"minimize\""))
                {
                    WindowState = WindowState.Minimized;
                }
                else if (msg.Contains("\"action\":\"maximize\""))
                {
                    WindowState = (WindowState == WindowState.Maximized) ? WindowState.Normal : WindowState.Maximized;
                }
                else if (msg.Contains("\"action\":\"close\""))
                {
                    Close();
                }
                else if (msg.Contains("\"action\":\"browse-folder\""))
                {
                    Dispatcher.Invoke(() =>
                    {
                        var dialog = new Microsoft.Win32.OpenFolderDialog
                        {
                            Title = "Select Directory for ULM LMS Library Database Storage",
                            InitialDirectory = "C:\\"
                        };
                        if (dialog.ShowDialog() == true)
                        {
                            string selected = dialog.FolderName;
                            webView.CoreWebView2.PostWebMessageAsJson(
                                $"{{\"event\":\"folder-selected\",\"folderPath\":\"{selected.Replace("\\", "\\\\")}\"}}"
                            );
                        }
                    });
                }
            }
            catch
            {
                // Ignore any malformed web messages
            }
        }

        private static async Task<bool> CheckUrlAvailableAsync(string url)
        {
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(400) };
                var response = await client.GetAsync(url);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
