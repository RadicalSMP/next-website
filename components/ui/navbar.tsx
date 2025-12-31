"use client"

import * as React from "react"
import Link from "next/link"

import { useIsMobile } from "@/hooks/use-mobile"
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

import { tools } from "@/app/resource"

export function Navbar() {
    const isMobile = useIsMobile()

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
            <NavigationMenu className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-lg px-6 py-1 shadow-lg dark:bg-black/80 dark:border-gray-800" viewport={ isMobile }>
                <NavigationMenuList className="flex space-x-6">
                    {[
                        { href: "/", label: "首页" },
                        { href: "/blogs", label: "博客" },
                        { href: "/about", label: "关于" }
                    ].map(({ href, label }) => (
                        <NavigationMenuItem key={href}>
                            <NavigationMenuLink
                                href={href}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-black transition-colors dark:text-gray-300 dark:hover:text-white"
                            >
                                {label}
                            </NavigationMenuLink>
                        </NavigationMenuItem>
                    ))}
                    <NavigationMenuItem>
                        <NavigationMenuTrigger className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-black transition-colors dark:text-gray-300 dark:hover:text-white">
                            工具箱
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                            <ul className="grid gap-2 sm:w-[200px]">
                                {tools.map((tools) => (
                                    <ListItem
                                        key={tools.title}
                                        title={tools.title}
                                        href={tools.href}
                                    >
                                        {tools.desc}
                                    </ListItem>
                                ))}
                            </ul>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>
        </div>

    )
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  )
}
