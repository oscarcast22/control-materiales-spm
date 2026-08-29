import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const [isScrolled, setIsScrolled] = useState(false);
    const hasBreadcrumbs = breadcrumbs.length > 0;

    useEffect(() => {
        const updateScrolledState = () => setIsScrolled(window.scrollY > 8);

        updateScrolledState();
        window.addEventListener('scroll', updateScrolledState, {
            passive: true,
        });

        return () => window.removeEventListener('scroll', updateScrolledState);
    }, []);

    return (
        <header
            className={cn(
                'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height,background-color,border-color,backdrop-filter] duration-200 ease-out min-[1200px]:px-8 md:px-6',
                isScrolled
                    ? 'border-border/55 bg-background/80 backdrop-blur-xl'
                    : 'border-transparent bg-transparent backdrop-blur-none',
                !hasBreadcrumbs && 'lg:hidden',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <SidebarTrigger className="-ml-1 shrink-0 lg:hidden" />
                {hasBreadcrumbs && (
                    <div className="min-w-0 overflow-hidden">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                )}
            </div>
        </header>
    );
}
