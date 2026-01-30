import Link from "next/link";
import { org } from "@/app/resource";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { dashboard_items } from "@/app/resource/content";

export function DashboardSidebar() {
    return (
        <Sidebar>
            <SidebarHeader>
                <div className="px-2 py-1">
                    <h2 className="text-lg font-semibold">{org.name}</h2>
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
                                            <SidebarMenuButton asChild>
                                                <Link href={item.href}>
                                                    <IconComponent className="size-4" />
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
        </Sidebar>
    );
}