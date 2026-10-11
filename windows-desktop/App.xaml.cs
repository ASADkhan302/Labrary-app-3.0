using System.Windows;

namespace UniversityOfLakkiMarwatLMS.Desktop
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            // Ensure hardware acceleration and smooth rendering
            RenderOptions.ProcessRenderMode = System.Windows.Interop.RenderMode.Default;
        }
    }
}
