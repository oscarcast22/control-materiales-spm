import { Link } from '@inertiajs/react';
import {
    ClipboardList,
    FileSpreadsheet,
    LayoutDashboard,
    PackageSearch,
    PlusCircle,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { ThemeMenu } from '@/components/theme-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Resumen',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'Nuevo vale',
        href: '/vouchers/create',
        icon: PlusCircle,
    },
    {
        title: 'Vales',
        href: '/vouchers',
        icon: ClipboardList,
    },
    {
        title: 'Seguimiento',
        href: '/reports/material-tracking',
        icon: FileSpreadsheet,
    },
    {
        title: 'Catálogos',
        href: '/catalogs',
        icon: PackageSearch,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <ThemeMenu />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
