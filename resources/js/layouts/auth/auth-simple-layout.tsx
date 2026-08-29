import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background p-4 md:p-6">
            <div className="pointer-events-none absolute top-[12%] left-[8%] size-64 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="pointer-events-none absolute right-[7%] bottom-[10%] size-72 rounded-full bg-violet/10 blur-3xl" />
            <div className="glass-panel relative w-full max-w-md rounded-3xl border p-7 sm:p-9">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href={home()}
                            className="flex flex-col items-center gap-3 font-medium"
                        >
                            <div className="relative mb-1 flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-primary-subtle text-primary shadow-[var(--shadow-control)]">
                                <AppLogoIcon className="size-8" />
                            </div>
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="flex flex-col gap-2 text-center">
                            <p className="text-xs font-semibold tracking-[0.07em] text-primary uppercase">
                                Servicios Públicos Municipales
                            </p>
                            <h1 className="text-2xl font-bold tracking-[-0.025em]">
                                {title}
                            </h1>
                            <p className="text-center text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
