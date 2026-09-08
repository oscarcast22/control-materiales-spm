import { VoucherDialogsProvider } from '@/components/voucher-dialogs';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs}>
            <VoucherDialogsProvider>{children}</VoucherDialogsProvider>
        </AppLayoutTemplate>
    );
}
