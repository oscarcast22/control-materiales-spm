import { Link } from '@inertiajs/react';
import { Palette, ShieldCheck, UserRound } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { NavItem } from '@/types';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Perfil',
        href: edit(),
        icon: UserRound,
    },
    {
        title: 'Seguridad',
        href: editSecurity(),
        icon: ShieldCheck,
    },
    {
        title: 'Apariencia',
        href: editAppearance(),
        icon: Palette,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <Page width="content">
            <PageHeader
                eyebrow="Cuenta y preferencias"
                title="Configuración"
                description="Administra los datos y la seguridad de tu cuenta."
            />

            <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,720px)] lg:gap-7">
                <aside className="glass-panel rounded-2xl border p-2 lg:sticky lg:top-24">
                    <nav
                        className="grid grid-cols-3 gap-1 lg:flex lg:flex-col"
                        aria-label="Configuración"
                    >
                        {sidebarNavItems.map((item, index) => (
                            <Button
                                key={`${toUrl(item.href)}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn(
                                    'h-11 w-full justify-center rounded-xl px-2 lg:justify-start lg:px-3',
                                    {
                                        'bg-selected text-primary':
                                            isCurrentOrParentUrl(item.href),
                                    },
                                )}
                            >
                                <Link href={item.href}>
                                    {item.icon && <item.icon />}
                                    {item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <div className="glass-panel min-w-0 rounded-2xl border p-5 sm:p-7 lg:p-8">
                    <section className="flex max-w-xl flex-col gap-12">
                        {children}
                    </section>
                </div>
            </div>
        </Page>
    );
}
