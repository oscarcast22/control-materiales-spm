import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div
                data-slot="app-logo-mark"
                className="relative flex aspect-square size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent/80 text-sidebar-primary shadow-[var(--shadow-control)]"
            >
                <AppLogoIcon className="size-6" />
            </div>
            <div className="ml-1 grid flex-1 text-left">
                <span className="truncate text-sm leading-tight font-bold tracking-[-0.015em] text-foreground">
                    Control de materiales
                </span>
                <span className="mt-0.5 truncate text-[10px] font-semibold tracking-[0.13em] text-sidebar-foreground/65 uppercase">
                    SPM · Operación
                </span>
            </div>
        </>
    );
}
