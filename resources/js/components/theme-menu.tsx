import { Check, Monitor, Moon, Sun } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';

const themes = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Seguir al sistema', icon: Monitor },
] satisfies { value: Appearance; label: string; icon: typeof Sun }[];

export function ThemeMenu() {
    const { appearance, updateAppearance } = useAppearance();
    const current = themes.find((theme) => theme.value === appearance)!;
    const CurrentIcon = current.icon;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton tooltip="Cambiar tema">
                            <CurrentIcon aria-hidden="true" />
                            <span>Tema: {current.label}</span>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side="right"
                        align="end"
                        className="w-52"
                    >
                        <DropdownMenuLabel>
                            Tema de la interfaz
                        </DropdownMenuLabel>
                        <DropdownMenuGroup>
                            {themes.map(({ value, label, icon: Icon }) => (
                                <DropdownMenuItem
                                    key={value}
                                    onSelect={() => updateAppearance(value)}
                                >
                                    <Icon aria-hidden="true" />
                                    {label}
                                    {appearance === value && (
                                        <Check
                                            aria-hidden="true"
                                            className="ml-auto"
                                        />
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
