"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navbar_routes } from "@/app/resource";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { IconType } from "react-icons";

interface NavRoute {
  href: string;
  label: string;
  icon: IconType;
  children?: NavRoute[];
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-center">
      <NavigationMenu viewport={false} className="rounded-full border bg-background/80 backdrop-blur-sm px-2 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <NavigationMenuList className="gap-0">
          {navbar_routes.map((route: NavRoute) => (
            <NavigationMenuItem key={route.href}>
              {route.children && route.children.length > 0 ? (
                // 有子菜单的项目
                <>
                  <NavigationMenuTrigger
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "data-[state=open]:bg-accent",
                      pathname.startsWith(route.href) && "bg-accent"
                    )}
                  >
                    <route.icon className="mr-1.5 size-4" />
                    {route.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[140px] gap-4">
                      {route.children.map((child: NavRoute) => (
                        <li key={child.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={child.href}
                              className="flex-row items-center gap-2"
                            >
                              <child.icon className="size-4 text-muted-foreground shrink-0" />
                              <span>{child.label}</span>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </>
              ) : (
                // 无子菜单的普通链接
                <Link
                  href={route.href}
                  className={cn(
                    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    pathname === route.href && "bg-accent"
                  )}
                >
                  <route.icon className="mr-1.5 size-4" />
                  {route.label}
                </Link>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
