import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none transition-colors border select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#93C5FD]/15 text-[#93C5FD] border-[#93C5FD]/30 light:bg-[#DBEAFE] light:text-[#1E40AF] light:border-[#93C5FD]/40",
        available:
          "bg-[#86EFAC]/15 text-[#86EFAC] border-[#86EFAC]/30 light:bg-[#DCFCE7] light:text-[#166534] light:border-[#86EFAC]/40",
        success:
          "bg-[#86EFAC]/15 text-[#86EFAC] border-[#86EFAC]/30 light:bg-[#DCFCE7] light:text-[#166534] light:border-[#86EFAC]/40",
        dueSoon:
          "bg-[#FCD34D]/15 text-[#FCD34D] border-[#FCD34D]/30 light:bg-[#FEF3C7] light:text-[#92400E] light:border-[#FCD34D]/40",
        warning:
          "bg-[#FCD34D]/15 text-[#FCD34D] border-[#FCD34D]/30 light:bg-[#FEF3C7] light:text-[#92400E] light:border-[#FCD34D]/40",
        overdue:
          "bg-[#FCA5A5]/15 text-[#FCA5A5] border-[#FCA5A5]/30 light:bg-[#FEE2E2] light:text-[#991B1B] light:border-[#FCA5A5]/40",
        destructive:
          "bg-[#FCA5A5]/15 text-[#FCA5A5] border-[#FCA5A5]/30 light:bg-[#FEE2E2] light:text-[#991B1B] light:border-[#FCA5A5]/40",
        secondary:
          "bg-slate-500/15 text-[#CBD5E1] border-slate-500/30 light:bg-[#F1F5F9] light:text-[#334155] light:border-slate-300",
        outline:
          "bg-transparent text-[#F1F5F9] light:text-[#0F172A] border-slate-700 light:border-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
