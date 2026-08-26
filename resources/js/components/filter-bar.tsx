import type { ReactNode } from 'react';

export function FilterBar({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-lg border bg-surface-subtle p-4 sm:p-6">
            {children}
        </div>
    );
}
