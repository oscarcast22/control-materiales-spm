import { Link, usePage } from '@inertiajs/react';
import {
    ClipboardList,
    FileSpreadsheet,
    LayoutDashboard,
    PackageSearch,
    Wrench,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { ThemeToggle } from '@/components/theme-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Resumen',
        href: '/dashboard',
        icon: LayoutDashboard,
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
    const { auth } = usePage().props;
    const technician = auth.user.role === 'technician';
    const items = technician
        ? [{ title: 'Mis vales', href: '/mis-vales', icon: Wrench }]
        : mainNavItems;
    const home = technician ? '/mis-vales' : '/dashboard';

    return (
        <Sidebar variant="inset" collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border p-3 group-data-[collapsible=icon]:px-1.5">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="h-14 rounded-xl group-data-[collapsible=icon]:h-14! hover:bg-sidebar-accent/45"
                        >
                            <Link href={home} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="pt-4">
                <NavMain items={items} />
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:px-1.5">
                <ThemeToggle />
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
