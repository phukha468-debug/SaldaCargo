"use client"

import { Toaster as Sonner } from "sonner"

export function Toaster() {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-navigation group-[.toaster]:border-[#E2E8F0] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-accent-secondary",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-workspace group-[.toast]:text-accent-secondary",
          success: "group-[.toast]:border-success group-[.toast]:text-success",
          error: "group-[.toast]:border-error group-[.toast]:text-error",
          warning: "group-[.toast]:border-warning group-[.toast]:text-warning",
        },
      }}
    />
  )
}
