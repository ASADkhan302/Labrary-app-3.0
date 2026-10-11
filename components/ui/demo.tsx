import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Sparkles, Palette, CheckCircle2, Monitor } from "lucide-react"

function DefaultToggle() {
  return (
    <div className="space-y-2 text-center">
      <div className="flex justify-center">
        <ThemeToggle />
      </div>
    </div>
  )
}

export function ThemeToggleShowcase() {
  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8 bg-card/60 dark:bg-slate-900/60 rounded-2xl border border-border/60 shadow-xl backdrop-blur-md">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Theme Toggle & Color Palette Integration</h3>
            <p className="text-xs text-muted-foreground">
              Integrated with LMS button palettes: Default Zinc, Amber Gold (Add Book), Emerald Teal (Excel Export), and Colorful.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Variants */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Amber Gold Variant */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-[#F59E0B]/30 flex flex-col items-center justify-between gap-4 text-center">
          <div>
            <span className="text-xs font-semibold text-amber-400">Amber Gold Palette</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Matches "+ Add Book" button</p>
          </div>
          <ThemeToggle variant="amber" />
          <span className="text-[10px] font-mono text-amber-400/80">variant="amber"</span>
        </div>

        {/* 2. Emerald Teal Variant */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-[#34D399]/30 flex flex-col items-center justify-between gap-4 text-center">
          <div>
            <span className="text-xs font-semibold text-emerald-400">Emerald Teal Palette</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Matches "Export Excel" button</p>
          </div>
          <ThemeToggle variant="emerald" />
          <span className="text-[10px] font-mono text-emerald-400/80">variant="emerald"</span>
        </div>

        {/* 3. Colorful Gradient Variant */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-purple-500/30 flex flex-col items-center justify-between gap-4 text-center">
          <div>
            <span className="text-xs font-semibold text-purple-400">Colorful Gradient</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Matches "ButtonColorful"</p>
          </div>
          <ThemeToggle variant="colorful" />
          <span className="text-[10px] font-mono text-purple-400/80">variant="colorful"</span>
        </div>

        {/* 4. Default Zinc Variant */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-zinc-800 flex flex-col items-center justify-between gap-4 text-center">
          <div>
            <span className="text-xs font-semibold text-zinc-300">Default Zinc & White</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Standard shadcn primitive</p>
          </div>
          <ThemeToggle variant="default" />
          <span className="text-[10px] font-mono text-zinc-400">variant="default"</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/40 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Smooth 300ms CSS transitions & tactile keyboard navigation support (Enter / Space)</span>
        </div>
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-amber-400" />
          <span>Tested for full responsiveness across all screen sizes (mobile to 4K)</span>
        </div>
      </div>
    </div>
  )
}

export { DefaultToggle }
export default DefaultToggle
