import { router, useForm } from '@inertiajs/react';
import {
    Boxes,
    MapPin,
    PackageSearch,
    Search,
    SlidersHorizontal,
    UsersRound,
    Workflow,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useReactiveFilters } from '@/hooks/use-reactive-filters';
import { cn } from '@/lib/utils';
import type { Paginated, VoucherType } from '@/types';
import type {
    CatalogFilters,
    CatalogDeleteTarget,
    CatalogNavigationItem,
    CatalogSection,
} from './catalog-types';

const catalogReloadProps = ['catalog', 'filters'];

const sectionIcons = {
    materials: Boxes,
    destinations: MapPin,
    people: UsersRound,
    programs: Workflow,
} satisfies Record<CatalogSection, typeof Boxes>;

const catalogSummary = (item: CatalogNavigationItem) => {
    if (item.key === 'programs') {
        const programs = `${item.total} ${item.total === 1 ? 'programa' : 'programas'}`;
        const actions = `${item.secondary_total ?? 0} ${(item.secondary_total ?? 0) === 1 ? 'acción' : 'acciones'}`;

        return `${programs} · ${actions}`;
    }

    return `${item.total} ${item.total === 1 ? 'registro' : 'registros'}`;
};

export function CatalogNavigation({
    section,
    items,
}: {
    section: CatalogSection;
    items: CatalogNavigationItem[];
}) {
    const changeSection = (next: CatalogSection) => {
        router.get('/catalogs', { section: next }, { preserveScroll: false });
    };

    return (
        <nav
            aria-label="Catálogos disponibles"
            className="glass-panel rounded-2xl border p-1.5"
        >
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
                {items.map((item) => {
                    const Icon = sectionIcons[item.key];
                    const active = item.key === section;

                    return (
                        <button
                            key={item.key}
                            type="button"
                            aria-current={active ? 'page' : undefined}
                            onClick={() => changeSection(item.key)}
                            className={cn(
                                'group relative flex min-h-[4.5rem] min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-[background-color,border-color,color,box-shadow] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/20 sm:gap-3 sm:px-4',
                                active
                                    ? 'border-primary/30 bg-primary-subtle text-primary shadow-[var(--shadow-control)]'
                                    : 'border-transparent text-text-secondary hover:border-border hover:bg-hover hover:text-foreground active:bg-primary-subtle/60',
                            )}
                        >
                            <span
                                className={cn(
                                    'grid size-9 shrink-0 place-items-center rounded-lg border',
                                    active
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-surface-subtle',
                                )}
                            >
                                <Icon className="size-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm leading-5 font-semibold text-pretty">
                                    {item.label}
                                </span>
                                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground tabular-nums">
                                    {catalogSummary(item)}
                                    {item.pending_review > 0 && (
                                        <>
                                            <span aria-hidden="true"> · </span>
                                            <span className="font-semibold text-warning">
                                                {item.pending_review} por
                                                revisar
                                            </span>
                                        </>
                                    )}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

export function CatalogToolbar({
    section,
    initial,
    voucherTypes,
    pendingReview,
}: {
    section: CatalogSection;
    initial: CatalogFilters;
    voucherTypes: VoucherType[];
    pendingReview: number;
}) {
    const { filters, replaceFilters, updateFilter } = useReactiveFilters({
        initial,
        url: '/catalogs',
        only: catalogReloadProps,
        serialize: (next) => ({
            section,
            ...(next.search ? { search: next.search } : {}),
            ...(next.status !== 'all' ? { status: next.status } : {}),
            ...(next.review !== 'all' ? { review: next.review } : {}),
            ...(next.voucher_type_id
                ? { voucher_type_id: next.voucher_type_id }
                : {}),
            ...(next.role !== 'all' ? { role: next.role } : {}),
        }),
    });
    const activeFilters = [
        filters.search,
        filters.status === 'all' ? '' : filters.status,
        filters.review === 'all' ? '' : filters.review,
        filters.voucher_type_id,
        filters.role === 'all' ? '' : filters.role,
    ].filter(Boolean).length;
    const clear = () =>
        replaceFilters({
            search: '',
            status: 'all',
            review: 'all',
            voucher_type_id: '',
            role: 'all',
        });

    return (
        <div className="border-y border-border bg-surface-subtle/55 px-4 py-4 sm:px-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_190px_auto]">
                <div className="grid gap-1.5">
                    <Label htmlFor={`${section}-search`}>Buscar</Label>
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            id={`${section}-search`}
                            value={filters.search}
                            onChange={(event) =>
                                updateFilter('search', event.target.value, true)
                            }
                            placeholder={
                                section === 'programs'
                                    ? 'Código o nombre'
                                    : 'Nombre u otro nombre conocido'
                            }
                            className="pl-9"
                        />
                    </div>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor={`${section}-status`}>Estado</Label>
                    <NativeSelect
                        id={`${section}-status`}
                        value={filters.status}
                        onChange={(event) =>
                            updateFilter('status', event.target.value)
                        }
                    >
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </NativeSelect>
                </div>
                {['materials', 'destinations', 'people'].includes(section) && (
                    <div className="grid gap-1.5">
                        <Label htmlFor={`${section}-review`}>Revisión</Label>
                        <NativeSelect
                            id={`${section}-review`}
                            value={filters.review}
                            onChange={(event) =>
                                updateFilter('review', event.target.value)
                            }
                        >
                            <option value="all">Todos los registros</option>
                            <option value="pending">
                                Por revisar ({pendingReview})
                            </option>
                        </NativeSelect>
                    </div>
                )}
                {section === 'materials' && (
                    <div className="grid gap-1.5">
                        <Label htmlFor="material-voucher-type">
                            Disponible en
                        </Label>
                        <NativeSelect
                            id="material-voucher-type"
                            value={filters.voucher_type_id}
                            onChange={(event) =>
                                updateFilter(
                                    'voucher_type_id',
                                    event.target.value,
                                )
                            }
                        >
                            <option value="">Almacén y Patio</option>
                            {voucherTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                )}
                {section === 'people' && (
                    <div className="grid gap-1.5">
                        <Label htmlFor="person-role">Función</Label>
                        <NativeSelect
                            id="person-role"
                            value={filters.role}
                            onChange={(event) =>
                                updateFilter('role', event.target.value)
                            }
                        >
                            <option value="all">Todas las funciones</option>
                            <option value="receive">Recibe / técnico</option>
                            <option value="deliver">Entrega material</option>
                            <option value="authorize">Autoriza material</option>
                        </NativeSelect>
                    </div>
                )}
                <div className="flex items-end">
                    {activeFilters > 0 ? (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={clear}
                            className="w-full xl:w-auto"
                        >
                            <X aria-hidden="true" />
                            Limpiar {activeFilters}{' '}
                            {activeFilters === 1 ? 'filtro' : 'filtros'}
                        </Button>
                    ) : (
                        <div className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
                            <SlidersHorizontal
                                className="size-4"
                                aria-hidden="true"
                            />
                            Sin filtros activos
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function CatalogPagination<T>({ page }: { page: Paginated<T> }) {
    return (
        <div className="border-t border-border px-4 py-4 sm:px-6">
            <Pagination
                from={page.from}
                to={page.to}
                total={page.total}
                hasPrevious={Boolean(page.prev_page_url)}
                hasNext={Boolean(page.next_page_url)}
                onPrevious={() =>
                    page.prev_page_url &&
                    router.get(
                        page.prev_page_url,
                        {},
                        {
                            only: catalogReloadProps,
                            preserveState: true,
                            preserveScroll: true,
                        },
                    )
                }
                onNext={() =>
                    page.next_page_url &&
                    router.get(
                        page.next_page_url,
                        {},
                        {
                            only: catalogReloadProps,
                            preserveState: true,
                            preserveScroll: true,
                        },
                    )
                }
            />
        </div>
    );
}

export function CatalogEmpty({
    title = 'No se encontraron registros',
}: {
    title?: string;
}) {
    return (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
            <div className="max-w-sm">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-surface-subtle text-muted-foreground">
                    <PackageSearch className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Ajusta los filtros o crea un registro nuevo para continuar.
                </p>
            </div>
        </div>
    );
}

export function MobileRecord({ children }: { children: ReactNode }) {
    return (
        <article className="rounded-xl border border-border bg-surface-raised p-4 shadow-[0_3px_12px_rgb(24_54_88/0.045)]">
            {children}
        </article>
    );
}

export function MobileDatum({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-0.5">
            <span className="text-xs font-semibold tracking-[0.055em] text-text-secondary uppercase">
                {label}
            </span>
            <div className="text-sm text-foreground">{children}</div>
        </div>
    );
}

export function CatalogStatusField({
    value,
    onValueChange,
}: {
    value: boolean;
    onValueChange: (value: boolean) => void;
}) {
    return (
        <section className="grid gap-3 rounded-xl border border-border bg-surface-subtle p-4">
            <div className="grid gap-1">
                <p className="text-sm font-semibold text-foreground">Estado</p>
                <p className="text-sm text-text-secondary">
                    {value
                        ? 'Activo: disponible para nuevas capturas.'
                        : 'Inactivo: no disponible para nuevas capturas.'}
                </p>
            </div>
            <div
                role="radiogroup"
                aria-label="Estado del registro"
                className="inline-flex min-h-11 w-fit overflow-hidden rounded-lg border border-border-strong bg-surface-raised"
            >
                <button
                    type="button"
                    role="radio"
                    aria-checked={value}
                    className={`min-h-11 px-4 text-sm font-semibold transition-[background-color,color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:ring-inset ${
                        value
                            ? 'bg-success-subtle text-success'
                            : 'text-text-secondary hover:bg-hover hover:text-foreground'
                    }`}
                    onClick={() => onValueChange(true)}
                >
                    Activo
                </button>
                <button
                    type="button"
                    role="radio"
                    aria-checked={!value}
                    className={`min-h-11 border-l border-border px-4 text-sm font-semibold transition-[background-color,color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:ring-inset ${
                        !value
                            ? 'bg-secondary text-foreground'
                            : 'text-text-secondary hover:bg-hover hover:text-foreground'
                    }`}
                    onClick={() => onValueChange(false)}
                >
                    Inactivo
                </button>
            </div>
        </section>
    );
}

export function CatalogDeleteAction({
    target,
    onDeleted,
}: {
    target: CatalogDeleteTarget;
    onDeleted: () => void;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm<{ delete: string }>({ delete: '' });
    const eligibility = target.deletion ?? {
        can_delete: false,
        blocked_reason: 'Verifica primero si este registro se puede eliminar.',
    };

    const remove = () => {
        form.delete(`/catalogs/${target.type}/${target.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                onDeleted();
            },
        });
    };

    if (!eligibility.can_delete) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="destructive">
                    Eliminar registro
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>¿Eliminar {target.name}?</DialogTitle>
                    <DialogDescription>
                        Esta acción es permanente. Sólo se elimina porque no
                        tiene vales ni otras dependencias que conservar.
                    </DialogDescription>
                </DialogHeader>
                <InputError message={form.errors.delete} />
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                    >
                        Volver
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={form.processing}
                        onClick={remove}
                    >
                        Eliminar definitivamente
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
