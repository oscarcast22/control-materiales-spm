import { Link } from '@inertiajs/react';
import {
    ClipboardList,
    FileSpreadsheet,
    LayoutDashboard,
    PackageSearch,
    Warehouse,
    PlusCircle,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
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
        title: 'Saldos',
        href: '/reports/balances',
        icon: FileSpreadsheet,
    },
    {
        title: 'Existencias',
        href: '/reports/inventory',
        icon: Warehouse,
    },
    {
        title: 'Catálogos',
        href: '/catalogs',
        icon: PackageSearch,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
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
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
