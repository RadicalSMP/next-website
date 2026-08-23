"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { org } from "@/app/resource/content";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "./ui/sidebar";
import { dashboard_items } from "@/app/resource/content";
import { RiArrowLeftLine } from "react-icons/ri";

export function DashboardSidebar() {
    const pathname = usePathname();

    const isActive = (href: string) => href === "/dashboard"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);

    return (
        <Sidebar>
            <SidebarHeader>
                <div className="px-2 py-1">
                    <h2 className="text-lg font-semibold">{org.name}</h2>
                    <p className="text-xs text-muted-foreground">管理后台</p>
                </div>
            </SidebarHeader>

            <SidebarContent>
                {Object.entries(dashboard_items).map(([key, section]) => (
                    <SidebarGroup key={key}>
                        <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {section.items.map((item, index) => {
                                    const IconComponent = item.icon;
                                    return (
                                        <SidebarMenuItem key={index}>
                                            <SidebarMenuButton asChild isActive={isActive(item.href)}>
                                                <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                                                    <IconComponent className="size-4" aria-hidden="true" />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/">
                                <RiArrowLeftLine className="size-4" aria-hidden="true" />
                                <span>返回主站</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
