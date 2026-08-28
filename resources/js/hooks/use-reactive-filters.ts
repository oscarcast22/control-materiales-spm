import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type FilterState = Record<string, string>;

type ReactiveFilterOptions<T extends FilterState> = {
    initial: T;
    url: string;
    only: string[];
    serialize?: (filters: T) => Record<string, string>;
    debounceMs?: number;
};

export function useReactiveFilters<T extends FilterState>({
    initial,
    url,
    only,
    serialize = (filters) => filters,
    debounceMs = 350,
}: ReactiveFilterOptions<T>) {
    const [filters, setFilters] = useState(initial);
    const latest = useRef(initial);
    const timeout = useRef<number | null>(null);

    const cancelPending = useCallback(() => {
        if (timeout.current !== null) {
            window.clearTimeout(timeout.current);
            timeout.current = null;
        }
    }, []);

    const navigate = useCallback(
        (next: T) => {
            router.get(url, serialize(next), {
                only,
                preserveScroll: true,
                preserveState: true,
                replace: true,
            });
        },
        [only, serialize, url],
    );

    const replaceFilters = useCallback(
        (next: T, debounce = false) => {
            cancelPending();
            latest.current = next;
            setFilters(next);

            if (debounce) {
                timeout.current = window.setTimeout(() => {
                    timeout.current = null;
                    navigate(latest.current);
                }, debounceMs);

                return;
            }

            navigate(next);
        },
        [cancelPending, debounceMs, navigate],
    );

    const updateFilter = useCallback(
        (key: keyof T, value: string, debounce = false) => {
            replaceFilters({ ...latest.current, [key]: value }, debounce);
        },
        [replaceFilters],
    );

    const flush = useCallback(() => {
        cancelPending();
        navigate(latest.current);
    }, [cancelPending, navigate]);

    useEffect(() => cancelPending, [cancelPending]);

    return { filters, flush, replaceFilters, updateFilter };
}
