"use client"

import * as React from "react"
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ThemeName = "light" | "dark" | "system"

interface ThemeOption {
  name: ThemeName
  label: string
  icon: LucideIcon
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  { name: "light", label: "明亮", icon: Sun },
  { name: "dark", label: "黑暗", icon: Moon },
  { name: "system", label: "自动", icon: Monitor },
]

const BUTTON_STYLES =
  "relative rounded-full border-border/70 bg-background/85 shadow-sm backdrop-blur-md touch-manipulation transition-[color,background-color,border-color,box-shadow,transform] duration-200 hover:border-foreground/20 hover:bg-accent hover:shadow-md active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"

function subscribeToHydration() {
  return () => undefined
}

function getThemeOption(theme: string | undefined) {
  return (
    THEME_OPTIONS.find((option) => option.name === theme) ??
    THEME_OPTIONS[2]
  )
}

export function getNextTheme(theme: string | undefined): ThemeName {
  const currentIndex = THEME_OPTIONS.indexOf(getThemeOption(theme))

  return THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length].name
}

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  )

  // 挂载前保持按钮尺寸稳定，并避免读取客户端主题造成 hydration mismatch。
  if (!mounted) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={BUTTON_STYLES}
        aria-label="正在加载主题设置"
        disabled
      >
        <Monitor className="size-[1.15rem] opacity-50" aria-hidden="true" />
      </Button>
    )
  }

  const currentTheme = getThemeOption(theme)
  const nextTheme = getThemeOption(getNextTheme(theme))
  const ThemeIcon = currentTheme.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={BUTTON_STYLES}
          aria-label={`当前为${currentTheme.label}模式，切换至${nextTheme.label}模式`}
          data-theme={currentTheme.name}
          onClick={() => setTheme(nextTheme.name)}
        >
          <ThemeIcon
            key={currentTheme.name}
            className="size-[1.15rem] animate-in fade-in-0 zoom-in-75 duration-200 motion-reduce:animate-none"
            aria-hidden="true"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>
        {currentTheme.label}模式
      </TooltipContent>
    </Tooltip>
  )
}
