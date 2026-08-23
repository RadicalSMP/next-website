"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { navbar_routes, org } from "@/app/resource/content";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { IconType } from "react-icons";

interface NavRoute {
  href: string;
  label: string;
  icon: IconType;
  children?: NavRoute[];
}

function isRouteActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="RadicalSMP 首页"
        >
          <Image
            src={org.avatar}
            alt=""
            width={32}
            height={32}
            priority
            className="size-8 rounded-sm object-cover"
          />
          <span className="hidden font-semibold sm:inline" translate="no">RadicalSMP</span>
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-0">
              {navbar_routes.map((route: NavRoute) => (
                <NavigationMenuItem key={route.href}>
                  {route.children?.length ? (
                    <>
                      <NavigationMenuTrigger
                        className={cn(
                          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isRouteActive(pathname, route.href) && "bg-accent",
                        )}
                      >
                        <route.icon className="mr-1.5 size-4" aria-hidden="true" />
                        {route.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-40 gap-1 p-1">
                          {route.children.map((child: NavRoute) => (
                            <li key={child.href}>
                              <NavigationMenuLink asChild active={isRouteActive(pathname, child.href)}>
                                <Link href={child.href} className="flex-row items-center gap-2">
                                  <child.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                  <span>{child.label}</span>
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <NavigationMenuLink asChild active={isRouteActive(pathname, route.href)}>
                      <Link href={route.href} className="flex-row items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium">
                        <route.icon className="size-4" aria-hidden="true" />
                        {route.label}
                      </Link>
                    </NavigationMenuLink>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <UserAvatar />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="打开导航菜单"
                onClick={() => setMobileOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setMobileOpen(true);
                  }
                }}
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent className="overscroll-contain">
              <SheetHeader className="border-b">
                <SheetTitle>网站导航</SheetTitle>
                <SheetDescription>前往 RadicalSMP 的公开页面</SheetDescription>
              </SheetHeader>
              <nav aria-label="移动端主导航" className="grid gap-1 p-4">
                {navbar_routes.map((route: NavRoute) => (
                  <div key={route.href} className="grid gap-1">
                    <SheetClose asChild>
                      <Link
                        href={route.href}
                        aria-current={isRouteActive(pathname, route.href) ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isRouteActive(pathname, route.href) && "bg-accent",
                        )}
                      >
                        <route.icon className="size-5" aria-hidden="true" />
                        {route.label}
                      </Link>
                    </SheetClose>
                    {route.children?.map((child) => (
                      <SheetClose asChild key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={isRouteActive(pathname, child.href) ? "page" : undefined}
                          className={cn(
                            "ml-8 flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isRouteActive(pathname, child.href) && "bg-accent text-foreground",
                          )}
                        >
                          <child.icon className="size-4" aria-hidden="true" />
                          {child.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </div>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
