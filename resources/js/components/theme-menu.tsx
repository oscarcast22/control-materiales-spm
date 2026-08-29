import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAppearance } from '@/hooks/use-appearance';

export function ThemeToggle() {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const mounted = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false,
    );
    const isDark = mounted && resolvedAppearance === 'dark';
    const CurrentIcon = isDark ? Moon : Sun;
    const currentLabel = mounted ? (isDark ? 'Oscuro' : 'Claro') : 'Tema';
    const nextLabel = isDark ? 'claro' : 'oscuro';
    const accessibleLabel = mounted
        ? `Cambiar a tema ${nextLabel}`
        : 'Cambiar tema';

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    tooltip={accessibleLabel}
                    aria-label={accessibleLabel}
                    onClick={() => updateAppearance(isDark ? 'light' : 'dark')}
                    className="h-10 rounded-lg px-3 transition-[background-color,color] duration-150 ease-out"
                >
                    <CurrentIcon aria-hidden="true" />
                    <span>
                        {mounted ? `Tema: ${currentLabel}` : currentLabel}
                    </span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
