"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus,
  CalendarDays,
  Settings,
  LogOut,
  UserCircle,
} from "lucide-react";
import { TimeWiseLogo } from "@/components/icons/TimeWiseLogo";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppSidebarProps {
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function AppSidebar({ userName, userEmail, userAvatar }: AppSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const navItems = [
    { href: "/send-event", label: "Send Event", icon: CalendarPlus },
    { href: "/calendar-overview", label: "Calendar Overview", icon: CalendarDays },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <Link href="/send-event" className="block group-data-[collapsible=icon]:hidden">
            <TimeWiseLogo />
          </Link>
          <div className="md:hidden"> {/* Show trigger only on small screens if sidebar is collapsible icon */}
            <SidebarTrigger />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <SidebarMenu className="p-2">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                  className="justify-start"
                >
                  <a> {/* Anchor tag for full-width clickability */}
                    <item.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-2 mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start p-2 h-auto group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userAvatar} alt={userName || "User"} data-ai-hint="professional avatar"/>
                <AvatarFallback>
                  {userName ? userName.charAt(0).toUpperCase() : <UserCircle />}
                </AvatarFallback>
              </Avatar>
              <div className="ml-2 text-left group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium text-sidebar-foreground">{userName}</p>
                <p className="text-xs text-sidebar-foreground/70">{userEmail}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-56">
            <DropdownMenuLabel>{userName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
