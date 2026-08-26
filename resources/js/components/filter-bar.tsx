import type { ReactNode } from 'react';

export function FilterBar({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-lg border bg-surface-subtle/65 p-3 sm:p-4">
            {children}
        </div>
    );
}
