import { AlertTriangle, Check, Clock3, Inbox, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const states = {
    pending: { label: 'Pendiente', variant: 'warning', icon: Clock3 },
    settled: { label: 'Liquidado', variant: 'success', icon: Check },
    anomaly: {
        label: 'Inconsistencia',
        variant: 'destructive',
        icon: AlertTriangle,
    },
    cancelled: { label: 'Cancelado', variant: 'secondary', icon: X },
    received: { label: 'Entrada recibida', variant: 'info', icon: Inbox },
} as const;

export function StatusBadge({ state }: { state: keyof typeof states }) {
    const item = states[state];
    const Icon = item.icon;

    return (
        <Badge variant={item.variant}>
            <Icon aria-hidden="true" />
            {item.label}
        </Badge>
    );
}
