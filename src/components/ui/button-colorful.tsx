import React from "react";
import { cn } from "@/lib/utils";

interface ButtonColorfulProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: React.ReactNode;
  gradient?: "gold" | "emerald" | "aurora" | "matrix" | "ruby";
  glow?: boolean;
}

export const ButtonColorful = React.forwardRef<HTMLButtonElement, ButtonColorfulProps>(
  ({ className, children, label, icon, gradient = "gold", glow = true, ...props }, ref) => {
    const gradients = {
      gold: "from-amber-500 via-amber-400 to-yellow-500 text-slate-950 shadow-amber-500/25 hover:shadow-amber-500/40",
      emerald: "from-emerald-500 via-teal-500 to-emerald-600 text-[#F1F5F9] shadow-emerald-500/25 hover:shadow-emerald-500/40",
      aurora: "from-indigo-500 via-purple-500 to-pink-500 text-[#F1F5F9] shadow-purple-500/25 hover:shadow-purple-500/40",
      matrix: "from-emerald-400 via-green-500 to-teal-600 text-slate-950 shadow-emerald-400/25 hover:shadow-emerald-400/40",
      ruby: "from-rose-500 via-red-500 to-orange-500 text-[#F1F5F9] shadow-rose-500/25 hover:shadow-rose-500/40",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-xs font-bold tracking-wide transition-all duration-300 active:scale-[0.96] hover:-translate-y-0.5 cursor-pointer bg-gradient-to-r",
          gradients[gradient],
          glow && "shadow-lg hover:shadow-xl",
          className
        )}
        {...props}
      >
        {/* Shimmer sweep light */}
        <span
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-300/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          aria-hidden="true"
        />
        
        {/* Subtle inner top highlight */}
        <span
          className="absolute inset-x-0 top-0 h-px bg-amber-400/20"
          aria-hidden="true"
        />

        {icon && (
          <span className="shrink-0 transition-transform duration-300 group-hover:scale-110">
            {icon}
          </span>
        )}
        <span className="relative z-10">{label || children}</span>
      </button>
    );
  }
);

ButtonColorful.displayName = "ButtonColorful";

export default ButtonColorful;
