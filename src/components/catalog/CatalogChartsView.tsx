import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid,
  Legend
} from 'recharts';
import { 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  ArrowRightLeft, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Calendar, 
  MapPin,
  LayoutGrid,
  List,
  Filter
} from 'lucide-react';
import { Book, Transaction } from '../../types/library';

interface CatalogChartsViewProps {
  books: Book[];
  transactions: Transaction[];
  onSelectCategory: (category: string) => void;
  onSwitchView: (mode: 'grid' | 'list') => void;
}

const CATEGORY_COLORS = [
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
];

export const CatalogChartsView: React.FC<CatalogChartsViewProps> = ({
  books,
  transactions,
  onSelectCategory,
  onSwitchView,
}) => {
  const activeBooks = useMemo(() => books.filter(b => b.is_active), [books]);

  const chartTheme = useMemo(() => ({
    tickColor: '#94A3B8',
    gridColor: 'rgba(148, 163, 184, 0.15)',
    tooltipStyle: {
      backgroundColor: '#0B1220',
      borderColor: '#334155',
      borderRadius: '8px',
      color: '#F1F5F9',
      fontSize: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    },
  }), []);

  // Overall totals
  const totalTitles = activeBooks.length;
  const totalCopies = activeBooks.reduce((sum, b) => sum + b.total_quantity, 0);
  const totalAvailable = activeBooks.reduce((sum, b) => sum + b.available_quantity, 0);
  const totalIssued = totalCopies - totalAvailable;
  const availabilityRate = totalCopies > 0 ? Math.round((totalAvailable / totalCopies) * 100) : 100;

  // 1. Category Distribution Data
  const categoryData = useMemo(() => {
    const map = new Map<string, { category: string; titles: number; totalCopies: number; available: number; issued: number }>();
    activeBooks.forEach(b => {
      const cur = map.get(b.category) || { 
        category: b.category, 
        titles: 0, 
        totalCopies: 0, 
        available: 0, 
        issued: 0 
      };
      cur.titles += 1;
      cur.totalCopies += b.total_quantity;
      cur.available += b.available_quantity;
      cur.issued += (b.total_quantity - b.available_quantity);
      map.set(b.category, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.totalCopies - a.totalCopies);
  }, [activeBooks]);

  // 2. Shelf Stock Donut Data
  const stockRatioData = useMemo(() => {
    if (totalCopies === 0) {
      return [{ name: 'No Active Stock', value: 1, color: '#94A3B8' }];
    }
    return [
      { name: 'Available on Shelf', value: totalAvailable, color: '#10B981' },
      { name: 'Currently Loaned', value: totalIssued, color: '#F59E0B' },
    ];
  }, [totalCopies, totalAvailable, totalIssued]);

  // 3. Publication Era Distribution
  const eraData = useMemo(() => {
    const eras: Record<string, { era: string; count: number; copies: number }> = {
      '2020s (Modern)': { era: '2020-Present', count: 0, copies: 0 },
      '2010s': { era: '2010-2019', count: 0, copies: 0 },
      '2000s': { era: '2000-2009', count: 0, copies: 0 },
      'Earlier Era': { era: 'Pre-2000', count: 0, copies: 0 },
    };

    activeBooks.forEach(b => {
      const yr = b.publication_year;
      if (yr >= 2020) {
        eras['2020s (Modern)'].count += 1;
        eras['2020s (Modern)'].copies += b.total_quantity;
      } else if (yr >= 2010) {
        eras['2010s'].count += 1;
        eras['2010s'].copies += b.total_quantity;
      } else if (yr >= 2000) {
        eras['2000s'].count += 1;
        eras['2000s'].copies += b.total_quantity;
      } else {
        eras['Earlier Era'].count += 1;
        eras['Earlier Era'].copies += b.total_quantity;
      }
    });

    return Object.values(eras);
  }, [activeBooks]);

  // 4. Shelf Location Density
  const shelfData = useMemo(() => {
    const map = new Map<string, { shelf: string; titles: number; copies: number }>();
    activeBooks.forEach(b => {
      const key = b.shelf || 'Unassigned';
      const cur = map.get(key) || { shelf: key, titles: 0, copies: 0 };
      cur.titles += 1;
      cur.copies += b.total_quantity;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.shelf.localeCompare(b.shelf));
  }, [activeBooks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner with Quick Actions */}
      <div className="bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Catalog Visual Analytics</span>
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {totalTitles} Registered Academic Titles
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#F1F5F9] font-cinzel">
            Campus Catalog Holdings & Stock Breakdown
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Interactive chart view mapping discipline distributions, physical volume allocations, and shelf utilization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSwitchView('grid')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Card Grid</span>
          </button>
          <button
            onClick={() => onSwitchView('list')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <List className="w-3.5 h-3.5" />
            <span>Table List</span>
          </button>
        </div>
      </div>

      {/* Row 1: Primary Discipline Breakdown (Large Bar Chart) & Stock Health (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Discipline Volumes Bar Chart (2 cols) */}
        <div className="lg:col-span-2 bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-[#1E293B] pb-3">
            <div>
              <h4 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <span>Volumes by Academic Discipline (Available vs Issued)</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Click any bar or discipline tag to filter books in this category
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Issued
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridColor} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 11, fill: chartTheme.tickColor }} 
                  angle={-15} 
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.tickColor }} />
                <Tooltip 
                  contentStyle={chartTheme.tooltipStyle}
                  cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                />
                <Bar dataKey="available" name="Available Copies" fill="#10B981" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                <Bar dataKey="issued" name="Issued Copies" fill="#F59E0B" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Quick Filter:
            </span>
            {categoryData.map((cat, idx) => (
              <button
                key={cat.category}
                onClick={() => {
                  onSelectCategory(cat.category);
                  onSwitchView('grid');
                }}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {cat.category} ({cat.totalCopies})
              </button>
            ))}
          </div>
        </div>

        {/* Shelf Stock Donut Gauge (1 col) */}
        <div className="bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E293B] pb-3">
              <h4 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-emerald-500" />
                <span>Inventory Availability Rate</span>
              </h4>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {availabilityRate}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Physical inventory on shelf vs active student/faculty loans
            </p>
          </div>

          <div className="relative h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockRatioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-out"
                >
                  {stockRatioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={chartTheme.tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Gauge Callout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-mono text-[#F1F5F9]">
                {totalCopies}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Volumes
              </span>
            </div>
          </div>

          {/* Breakdown Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
              <p className="text-[10px] uppercase font-mono text-emerald-700 dark:text-emerald-400 font-semibold">On Shelf</p>
              <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalAvailable}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
              <p className="text-[10px] uppercase font-mono text-amber-700 dark:text-amber-400 font-semibold">In Circulation</p>
              <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">{totalIssued}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Row 2: Publication Eras & Physical Shelf Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Publication Eras Chart */}
        <div className="bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E293B] pb-3">
            <h4 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-500" />
              <span>Publication Era & Vintage Timeline</span>
            </h4>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Collection Age Analysis
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={eraData}
                margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="era" tick={{ fontSize: 11, fill: chartTheme.tickColor }} />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.tickColor }} />
                <Tooltip 
                  contentStyle={chartTheme.tooltipStyle}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                />
                <Bar dataKey="copies" name="Physical Volumes" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                <Bar dataKey="count" name="Unique Titles" fill="#8B5CF6" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Modern editions (2020+) are prioritized for reserve lending desks and engineering labs.
          </p>
        </div>

        {/* Shelf & Stack Location Distribution */}
        <div className="bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E293B] pb-3">
            <h4 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-500" />
              <span>Library Stacks & Shelf Density</span>
            </h4>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {shelfData.length} Active Shelves
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            {shelfData.map((shelf) => (
              <div 
                key={shelf.shelf}
                className="p-3 rounded-xl bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-[#334155] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#F1F5F9]">
                    {shelf.shelf}
                  </span>
                  <MapPin className="w-3 h-3 text-amber-500" />
                </div>
                <div className="mt-2">
                  <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                    {shelf.copies}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {shelf.titles} {shelf.titles === 1 ? 'title' : 'titles'} cataloged
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center pt-1 border-t border-slate-100 dark:border-slate-800/80">
            Automated location labels map books directly to campus physical aisles and rows.
          </p>
        </div>

      </div>

    </div>
  );
};
