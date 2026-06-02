import * as React from "react"
import { cn } from "../../lib/utils"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          "h-10 px-4 py-2",
          variant === 'primary' && "bg-primary text-white hover:bg-blue-800 shadow-md",
          variant === 'secondary' && "bg-primary-light text-primary hover:bg-blue-100",
          variant === 'outline' && "border border-slate-200 bg-transparent hover:bg-slate-100 text-slate-700",
          variant === 'ghost' && "hover:bg-slate-100 hover:text-slate-900 text-slate-600",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
