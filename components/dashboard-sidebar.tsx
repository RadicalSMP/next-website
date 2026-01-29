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

const dashboard_items = {
    "user": {
        title: "用户",
        items: [
            {
                title: "用户管理",
                href: "/dashboard/user/manage",
            },
        ],
    },
    "blog": {
        title: "博客",
        items: [
            {
                title: "文章管理",
                href: "/dashboard/blog/manage",
            },
        ],
    },
}

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
                                {section.items.map((item, index) => (
                                    <SidebarMenuItem key={index}>
                                        <SidebarMenuButton asChild>
                                            <Link href={item.href}>
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
        </Sidebar>
    );
}