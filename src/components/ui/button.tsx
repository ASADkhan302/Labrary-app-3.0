import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { playClickSound } from "@/services/audio"
import { BookSpinesLoader } from "@/components/decorative/BookSpinesLoader"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0B450] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141214] active:scale-[0.98] select-none cursor-pointer overflow-hidden min-h-[32px] min-w-fit isolate",
  {
    variants: {
      variant: {
        default:
          "btn-primary",
        primary:
          "btn-primary",
        secondary:
          "btn-secondary",
        outline:
          "btn-secondary",
        destructive:
          "btn-danger",
        danger:
          "btn-danger",
        ghost:
          "btn-ghost",
        tertiary:
          "btn-tertiary",
        link:
          "text-[#E0B450] underline-offset-4 hover:underline p-0 h-auto border-none bg-transparent min-h-0 min-w-0 font-medium",
        segmented:
          "btn-segmented",
        icon:
          "btn-icon",
      },
      size: {
        default: "h-9 px-3.5 text-[13px]",
        md: "h-9 px-3.5 text-[13px]",
        sm: "h-8 px-3 text-[12px]",
        compact: "h-8 px-3 text-[12px]",
        lg: "h-10 px-4 text-[14px]",
        icon: "h-8 w-8 min-w-[32px] min-h-[32px] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  success?: boolean
  playSound?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      success = false,
      playSound = true,
      children,
      disabled,
      onClick,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading
    const buttonRef = React.useRef<HTMLButtonElement | null>(null)
    const [fixedWidth, setFixedWidth] = React.useState<number | undefined>(undefined)

    // Preserve width during loading / success state to prevent CLS
    React.useEffect(() => {
      if (loading || success) {
        if (buttonRef.current && !fixedWidth) {
          setFixedWidth(buttonRef.current.offsetWidth)
        }
      } else {
        setFixedWidth(undefined)
      }
    }, [loading, success])

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (playSound && !disabled && !loading) {
        try {
          playClickSound()
        } catch {
          // ignore
        }
      }

      // Soft radial ripple animation from click point
      const btn = e.currentTarget
      if (btn) {
        const rect = btn.getBoundingClientRect()
        const ripple = document.createElement("span")
        const diameter = Math.max(rect.width, rect.height) * 1.5
        const radius = diameter / 2
        ripple.className = "btn-ripple-wave"
        ripple.style.width = `${diameter}px`
        ripple.style.height = `${diameter}px`
        ripple.style.left = `${e.clientX - rect.left - radius}px`
        ripple.style.top = `${e.clientY - rect.top - radius}px`
        btn.appendChild(ripple)
        setTimeout(() => {
          ripple.remove()
        }, 400)
      }

      if (onClick) {
        onClick(e)
      }
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={(node) => {
          buttonRef.current = node as HTMLButtonElement | null
          if (typeof ref === "function") {
            ref(node)
          } else if (ref) {
            ;(ref as React.MutableRefObject<HTMLButtonElement | null>).current = node as HTMLButtonElement | null
          }
        }}
        disabled={isDisabled}
        onClick={handleClick}
        style={{
          width: fixedWidth ? `${fixedWidth}px` : undefined,
          ...props.style,
        }}
        {...props}
      >
        {loading ? (
          <span className="btn-label relative z-[1] inline-flex items-center justify-center gap-1.5">
            <BookSpinesLoader />
            <Loader2 className="w-4 h-4 animate-spin text-current" />
            <span className="text-[12px] font-medium">Processing...</span>
          </span>
        ) : success ? (
          <span className="btn-label relative z-[1] inline-flex items-center justify-center gap-1.5 text-emerald-400 font-semibold animate-in zoom-in-75 duration-200">
            <Check className="w-4 h-4 stroke-[3]" />
            <span className="text-[12px]">Success</span>
          </span>
        ) : (
          <span className="btn-label relative z-[1] inline-flex items-center justify-center gap-2">
            {children}
          </span>
        )}
      </Comp>
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
