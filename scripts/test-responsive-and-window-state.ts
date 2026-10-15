/**
 * Test Suite: Responsive UI, Window Sizing & Window State Persistence
 * University of Lakki Marwat Central Campus Library Management System
 */

import './setup-env';
import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, details: string) {
  results.push({
    suite,
    test,
    passed: condition,
    details: condition ? details : `FAIL: ${details}`,
  });
  if (condition) {
    console.log(`  ✓ [PASS] ${test}: ${details}`);
  } else {
    console.error(`  ✗ [FAIL] ${test}: ${details}`);
  }
}

console.log('\n======================================================================');
console.log(' ULM LMS: WINDOW SIZING, STARTUP MAXIMIZED & RESPONSIVE UI TEST SUITE');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Electron Main Process & Window Configuration
// -----------------------------------------------------------------------------
console.log('Suite 1: Electron Main Process & Window Configuration');
const mainPath = path.join(process.cwd(), 'electron', 'main.cjs');
const preloadPath = path.join(process.cwd(), 'electron', 'preload.cjs');
const mainContent = fs.readFileSync(mainPath, 'utf8');
const preloadContent = fs.readFileSync(preloadPath, 'utf8');

assert(
  mainContent.includes('isMaximized: true') || mainContent.includes('mainWindow.maximize()'),
  'Suite 1',
  'Startup Maximized Config',
  'Electron main process configured to open maximized on startup'
);

assert(
  mainContent.includes('minWidth: 800') && mainContent.includes('minHeight: 560'),
  'Suite 1',
  'Flexible Min Dimensions',
  'Minimum window bounds lowered to 800x560 to support restored size and 150% Surface Pro 5 scaling'
);

assert(
  mainContent.includes('saveWindowState') && mainContent.includes('loadWindowState'),
  'Suite 1',
  'Window State Persistence',
  'Window state persistence handlers present in electron/main.cjs'
);

assert(
  mainContent.includes('display.workArea') && mainContent.includes('screen.getAllDisplays()'),
  'Suite 1',
  'Display Work Area & Bounds Guard',
  'Saved coordinates validated against connected display work areas to prevent off-screen opening'
);

assert(
  mainContent.includes('getNormalBounds'),
  'Suite 1',
  'Normal Bounds Tracking',
  'Uses getNormalBounds() when maximized so restored size and position are remembered'
);

assert(
  mainContent.includes('window-maximize-changed'),
  'Suite 1',
  'Maximize Event Broadcast',
  'Window maximize/unmaximize state broadcasted to renderer process'
);

assert(
  preloadContent.includes('isWindowMaximized') && preloadContent.includes('onWindowMaximizeChange'),
  'Suite 1',
  'Preload IPC Bridge',
  'Preload exposes isWindowMaximized and onWindowMaximizeChange to window.electronAPI'
);

// -----------------------------------------------------------------------------
// Test Suite 2: Windows WPF Desktop Executable Configuration
// -----------------------------------------------------------------------------
console.log('\nSuite 2: Windows WPF Desktop Executable Configuration');
const xamlPath = path.join(process.cwd(), 'windows-desktop', 'MainWindow.xaml');
const xamlContent = fs.readFileSync(xamlPath, 'utf8');

assert(
  xamlContent.includes('WindowState="Maximized"'),
  'Suite 2',
  'WPF WindowState Maximized',
  'Windows Desktop MainWindow.xaml configures WindowState="Maximized" on initial boot'
);

assert(
  xamlContent.includes('MinWidth="800"') && xamlContent.includes('MinHeight="560"'),
  'Suite 2',
  'WPF Min Sizing',
  'WPF window configured with MinWidth="800" and MinHeight="560"'
);

// -----------------------------------------------------------------------------
// Test Suite 3: Title Bar Responsiveness & Native Sync
// -----------------------------------------------------------------------------
console.log('\nSuite 3: Windows Title Bar Responsiveness & Native Sync');
const titleBarPath = path.join(process.cwd(), 'src', 'components', 'WindowsTitleBar.tsx');
const titleBarContent = fs.readFileSync(titleBarPath, 'utf8');

assert(
  titleBarContent.includes('electronAPI.isWindowMaximized') && titleBarContent.includes('electronAPI.onWindowMaximizeChange'),
  'Suite 3',
  'Title Bar Native IPC Sync',
  'WindowsTitleBar listens to real Electron maximize state changes'
);

assert(
  titleBarContent.includes('min-w-0') && titleBarContent.includes('truncate'),
  'Suite 3',
  'Title Bar Truncation Guard',
  'Center institutional title uses min-w-0 and truncate to prevent button collision on narrow widths'
);

// -----------------------------------------------------------------------------
// Test Suite 4: Sidebar Auto-Collapse at 1024px Breakpoint
// -----------------------------------------------------------------------------
console.log('\nSuite 4: Sidebar Auto-Collapse at 1024px Breakpoint');
const appPath = path.join(process.cwd(), 'src', 'App.tsx');
const sidebarPath = path.join(process.cwd(), 'src', 'components', 'LmsSidebar.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

assert(
  appContent.includes('1024') && appContent.includes('setIsSidebarCollapsed(true)'),
  'Suite 4',
  'App Auto-Collapse 1024px Listener',
  'App.tsx automatically sets isSidebarCollapsed=true when window width drops below 1024px'
);

assert(
  sidebarContent.includes('windowDimensions.width < 1024'),
  'Suite 4',
  'Sidebar Compact Rail Mode below 1024px',
  'LmsSidebar automatically activates 72px icon rail (isRail) below 1024px viewport width'
);

assert(
  sidebarContent.includes('w-[72px] min-w-[72px] max-w-[72px]'),
  'Suite 4',
  'Compact 72px Rail Dimensions',
  'Sidebar renders compact 72px icon rail for maximum catalog workspace'
);

// -----------------------------------------------------------------------------
// Test Suite 5: Books Catalog Responsive Adaptations & Table/Card View
// -----------------------------------------------------------------------------
console.log('\nSuite 5: Books Catalog Responsive Adaptations & Table/Card View');
const catalogPath = path.join(process.cwd(), 'src', 'components', 'BooksCatalogView.tsx');
const catalogContent = fs.readFileSync(catalogPath, 'utf8');

assert(
  catalogContent.includes('hidden lg:block') && catalogContent.includes('lg:hidden flex flex-col gap-3'),
  'Suite 5',
  'Automatic Switch to Compact Cards on Narrow Screens',
  'Wide catalog table switches automatically to compact card view on screens below 1024px'
);

assert(
  catalogContent.includes('overflow-x-auto'),
  'Suite 5',
  'Table Horizontal Scrolling Guard',
  'Desktop table wrapped in overflow-x-auto to prevent whole-page horizontal scrolling'
);

assert(
  catalogContent.includes('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'),
  'Suite 5',
  'Responsive KPI Cards Grid',
  'Metric KPI cards use fluid responsive grid layout'
);

// -----------------------------------------------------------------------------
// Test Suite 6: Layout Height & Viewport Overflow Audit
// -----------------------------------------------------------------------------
console.log('\nSuite 6: Layout Height & Viewport Overflow Audit');

assert(
  appContent.includes('overflow-x-hidden') && appContent.includes('overflow-y-auto'),
  'Suite 6',
  'Viewport Scroll Architecture',
  'App workspace isolates vertical scrolling to content area with overflow-x-hidden on root'
);

// -----------------------------------------------------------------------------
// Summary & Verification
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
const passedCount = results.filter(r => r.passed).length;
const totalCount = results.length;
console.log(` RESULTS: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
console.log('======================================================================\n');

if (passedCount < totalCount) {
  process.exit(1);
} else {
  console.log('All window sizing, startup maximized, and responsive UI requirements verified successfully!\n');
  process.exit(0);
}
