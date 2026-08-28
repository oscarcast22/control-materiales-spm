import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="relative flex aspect-square size-10 items-center justify-center overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent/80 text-sidebar-primary shadow-[0_6px_16px_rgb(39_83_132/0.1),inset_0_1px_0_rgb(255_255_255/0.62)] group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:rounded-lg dark:shadow-[0_6px_16px_rgb(0_0_0/0.16),inset_0_1px_0_rgb(255_255_255/0.06)]">
                <AppLogoIcon className="size-6 group-data-[collapsible=icon]:size-5" />
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
