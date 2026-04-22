import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-white shadow hover:bg-primary/90",
        destructive: "bg-error text-white shadow-sm hover:bg-error/90",
        outline: "border border-[#E2E8F0] bg-white shadow-sm hover:bg-workspace hover:text-navigation",
        secondary: "bg-[#F1F5F9] text-navigation shadow-sm hover:bg-[#F1F5F9]/80",
        ghost: "hover:bg-workspace hover:text-navigation",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-white shadow hover:bg-success/90",
        warning: "bg-warning text-white shadow hover:bg-warning/90",
      },
      size: {
        default: "h-12 px-6 py-2", // 48px height for touch target
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-14 rounded-md px-10 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
