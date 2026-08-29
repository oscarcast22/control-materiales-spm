import { useForm } from '@inertiajs/react';
import {
    Boxes,
    MapPin,
    Pencil,
    Plus,
    Ruler,
    UsersRound,
    Workflow,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { DataTableSurface } from '@/components/data-table';
import InputError from '@/components/input-error';
import { SimpleSelect } from '@/components/simple-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type {
    Action,
    Destination,
    Material,
    Paginated,
    Person,
    Program,
    Unit,
    VoucherType,
} from '@/types';
import type {
    CatalogFilters,
    CatalogNavigationItem,
    ProgramsCatalog,
    StatusTarget,
} from './catalog-types';
import {
    CatalogEmpty,
    CatalogPagination,
    CatalogToolbar,
    MobileDatum,
    MobileRecord,
    StatusAction,
} from './catalog-ui';

type StatusHandler = (target: StatusTarget) => void;

function SectionShell({
    eyebrow,
    title,
    description,
    icon,
    count,
    pending,
    actions,
    children,
}: {
    eyebrow: string;
    title: string;
    description: string;
    icon: ReactNode;
    count: number;
    pending?: number;
    actions: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary">
                        {icon}
                    </span>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-[0.13em] text-primary uppercase">
                            {eyebrow}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold tracking-[-0.025em] text-foreground">
                                {title}
                            </h2>
                            <Badge variant="secondary">{count}</Badge>
                            {Boolean(pending) && (
                                <Badge variant="warning">
                                    {pending} por revisar
                                </Badge>
                            )}
                        </div>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 pl-[60px] md:pl-0">
                    {actions}
                </div>
            </div>
            {children}
        </Card>
    );
}

function RecordName({
    name,
    needsReview,
}: {
    name: string;
    needsReview?: boolean;
}) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium whitespace-normal text-foreground">
                {name}
            </span>
            {needsReview && <Badge variant="warning">Revisar</Badge>}
        </div>
    );
}

function StateBadge({ active }: { active?: boolean }) {
    return (
        <Badge variant={active ? 'success' : 'outline'}>
            {active ? 'Activo' : 'Inactivo'}
        </Badge>
    );
}

export function MaterialSection({
    page,
    filters,
    summary,
    units,
    voucherTypes,
    onStatus,
}: {
    page: Paginated<Material>;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
    units: Unit[];
    voucherTypes: VoucherType[];
    onStatus: StatusHandler;
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Material | null>(null);
    const [unitsOpen, setUnitsOpen] = useState(false);

    return (
        <SectionShell
            eyebrow="Catálogo operativo"
            title="Materiales"
            description="Define el nombre, la unidad habitual y en qué tipo de vale puede utilizarse cada material."
            icon={<Boxes className="size-5" aria-hidden="true" />}
            count={summary.total}
            pending={summary.pending_review}
            actions={
                <>
                    <Button
                        variant="outline"
                        onClick={() => setUnitsOpen(true)}
                    >
                        <Ruler aria-hidden="true" />
                        Gestionar unidades
                    </Button>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus aria-hidden="true" />
                        Nuevo material
                    </Button>
                </>
            }
        >
            <CatalogToolbar
                section="materials"
                initial={filters}
                voucherTypes={voucherTypes}
                pendingReview={summary.pending_review}
            />
            {page.data.length === 0 ? (
                <CatalogEmpty title="No se encontraron materiales" />
            ) : (
                <>
                    <div className="hidden p-4 sm:p-6 md:block">
                        <DataTableSurface label="Materiales del catálogo">
                            <Table className="table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[29%]">
                                            Nombre
                                        </TableHead>
                                        <TableHead className="w-[12%]">
                                            Unidad
                                        </TableHead>
                                        <TableHead className="w-[18%]">
                                            Disponible en
                                        </TableHead>
                                        <TableHead className="w-[12%]">
                                            Estado
                                        </TableHead>
                                        <TableHead className="w-[29%] text-right">
                                            Acciones
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {page.data.map((material) => (
                                        <TableRow key={material.id}>
                                            <TableCell className="whitespace-normal">
                                                <RecordName
                                                    name={material.name}
                                                    needsReview={
                                                        material.needs_review
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs font-semibold">
                                                    {material.default_unit
                                                        ?.symbol ?? '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                <div className="flex flex-wrap gap-1">
                                                    {material.voucher_types?.map(
                                                        (type) => (
                                                            <Badge
                                                                key={type.id}
                                                                variant="outline"
                                                            >
                                                                {type.name}
                                                            </Badge>
                                                        ),
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <StateBadge
                                                    active={material.is_active}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setEditing(material)
                                                        }
                                                    >
                                                        <Pencil aria-hidden="true" />
                                                        {material.needs_review
                                                            ? 'Revisar'
                                                            : 'Editar'}
                                                    </Button>
                                                    <StatusAction
                                                        target={{
                                                            type: 'materials',
                                                            id: material.id,
                                                            name: material.name,
                                                            active: Boolean(
                                                                material.is_active,
                                                            ),
                                                        }}
                                                        onRequest={onStatus}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </DataTableSurface>
                    </div>
                    <div className="grid gap-3 p-4 md:hidden">
                        {page.data.map((material) => (
                            <MobileRecord key={material.id}>
                                <RecordName
                                    name={material.name}
                                    needsReview={material.needs_review}
                                />
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <MobileDatum label="Unidad">
                                        {material.default_unit?.symbol ?? '—'}
                                    </MobileDatum>
                                    <MobileDatum label="Estado">
                                        <StateBadge
                                            active={material.is_active}
                                        />
                                    </MobileDatum>
                                    <div className="col-span-2">
                                        <MobileDatum label="Disponible en">
                                            <div className="flex flex-wrap gap-1">
                                                {material.voucher_types?.map(
                                                    (type) => (
                                                        <Badge
                                                            key={type.id}
                                                            variant="outline"
                                                        >
                                                            {type.name}
                                                        </Badge>
                                                    ),
                                                )}
                                            </div>
                                        </MobileDatum>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap justify-end gap-1 border-t border-border pt-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditing(material)}
                                    >
                                        <Pencil aria-hidden="true" />
                                        {material.needs_review
                                            ? 'Revisar'
                                            : 'Editar'}
                                    </Button>
                                    <StatusAction
                                        target={{
                                            type: 'materials',
                                            id: material.id,
                                            name: material.name,
                                            active: Boolean(material.is_active),
                                        }}
                                        onRequest={onStatus}
                                    />
                                </div>
                            </MobileRecord>
                        ))}
                    </div>
                </>
            )}
            <CatalogPagination page={page} />
            <MaterialDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                units={units}
                voucherTypes={voucherTypes}
            />
            {editing && (
                <MaterialDialog
                    key={editing.id}
                    open
                    material={editing}
                    onOpenChange={(open) => !open && setEditing(null)}
                    units={units}
                    voucherTypes={voucherTypes}
                />
            )}
            <UnitManager
                open={unitsOpen}
                onOpenChange={setUnitsOpen}
                units={units}
                onStatus={onStatus}
            />
        </SectionShell>
    );
}

function MaterialDialog({
    open,
    onOpenChange,
    material,
    units,
    voucherTypes,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    material?: Material;
    units: Unit[];
    voucherTypes: VoucherType[];
}) {
    const form = useForm<{
        name: string;
        default_unit_id: string;
        voucher_type_ids: string[];
    }>({
        name: material?.name ?? '',
        default_unit_id: material ? String(material.default_unit_id) : '',
        voucher_type_ids:
            material?.voucher_types?.map((type) => String(type.id)) ?? [],
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        };

        if (material) {
            form.put(`/catalogs/materials/${material.id}`, options);
        } else {
            form.post('/catalogs/materials', options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {material
                                ? material.needs_review
                                    ? 'Revisar material'
                                    : 'Editar material'
                                : 'Nuevo material'}
                        </DialogTitle>
                        <DialogDescription>
                            La unidad y el nombre canónicos se reflejan en los
                            vales relacionados sin convertir cantidades.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="material-name">
                            Nombre del material
                        </Label>
                        <Input
                            id="material-name"
                            autoFocus
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            aria-invalid={Boolean(form.errors.name)}
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="material-unit">Unidad habitual</Label>
                        <SimpleSelect
                            id="material-unit"
                            value={form.data.default_unit_id}
                            onValueChange={(value) =>
                                form.setData('default_unit_id', value)
                            }
                            options={units
                                .filter(
                                    (unit) =>
                                        unit.is_active ||
                                        unit.id === material?.default_unit_id,
                                )
                                .map((unit) => ({
                                    value: String(unit.id),
                                    label: `${unit.name} (${unit.symbol})`,
                                }))}
                            placeholder="Seleccionar unidad"
                            invalid={Boolean(form.errors.default_unit_id)}
                        />
                        <InputError message={form.errors.default_unit_id} />
                    </div>
                    <fieldset className="grid gap-2">
                        <legend className="text-sm font-medium">
                            Disponible en
                        </legend>
                        <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-surface-subtle p-3">
                            {voucherTypes.map((type) => {
                                const value = String(type.id);

                                return (
                                    <Label
                                        key={type.id}
                                        className="flex items-center gap-2"
                                    >
                                        <Checkbox
                                            checked={form.data.voucher_type_ids.includes(
                                                value,
                                            )}
                                            onCheckedChange={(checked) =>
                                                form.setData(
                                                    'voucher_type_ids',
                                                    checked
                                                        ? [
                                                              ...form.data
                                                                  .voucher_type_ids,
                                                              value,
                                                          ]
                                                        : form.data.voucher_type_ids.filter(
                                                              (id) =>
                                                                  id !== value,
                                                          ),
                                                )
                                            }
                                        />
                                        {type.name}
                                    </Label>
                                );
                            })}
                        </div>
                        <InputError message={form.errors.voucher_type_ids} />
                    </fieldset>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {material?.needs_review
                                ? 'Guardar como revisado'
                                : material
                                  ? 'Guardar cambios'
                                  : 'Agregar material'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function UnitManager({
    open,
    onOpenChange,
    units,
    onStatus,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    units: Unit[];
    onStatus: StatusHandler;
}) {
    const form = useForm({ name: '', symbol: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/catalogs/units', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Gestionar unidades</DialogTitle>
                    <DialogDescription>
                        Las unidades son compartidas por los materiales.
                        Renombrarlas actualiza cómo se muestran los vales
                        relacionados.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={submit}
                    className="grid gap-3 rounded-xl border border-border bg-surface-subtle p-4 sm:grid-cols-[1fr_130px_auto]"
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="new-unit-name">Nombre</Label>
                        <Input
                            id="new-unit-name"
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            placeholder="Ej. Litro"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="new-unit-symbol">Símbolo</Label>
                        <Input
                            id="new-unit-symbol"
                            value={form.data.symbol}
                            onChange={(event) =>
                                form.setData('symbol', event.target.value)
                            }
                            placeholder="l"
                        />
                        <InputError message={form.errors.symbol} />
                    </div>
                    <Button className="self-end" disabled={form.processing}>
                        <Plus aria-hidden="true" />
                        Agregar
                    </Button>
                </form>
                <div className="grid gap-2">
                    {units.map((unit) => (
                        <UnitRow
                            key={unit.id}
                            unit={unit}
                            onStatus={onStatus}
                        />
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function UnitRow({ unit, onStatus }: { unit: Unit; onStatus: StatusHandler }) {
    const form = useForm({ name: unit.name, symbol: unit.symbol });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put(`/catalogs/units/${unit.id}`, {
                    preserveScroll: true,
                });
            }}
            className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_110px_auto_auto] sm:items-center"
        >
            <Input
                aria-label={`Nombre de ${unit.name}`}
                value={form.data.name}
                onChange={(event) => form.setData('name', event.target.value)}
            />
            <Input
                aria-label={`Símbolo de ${unit.name}`}
                value={form.data.symbol}
                onChange={(event) => form.setData('symbol', event.target.value)}
            />
            <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={form.processing}
            >
                Guardar
            </Button>
            <StatusAction
                target={{
                    type: 'units',
                    id: unit.id,
                    name: unit.name,
                    active: Boolean(unit.is_active),
                }}
                onRequest={onStatus}
            />
            <div className="sm:col-span-4">
                <InputError message={form.errors.name ?? form.errors.symbol} />
            </div>
        </form>
    );
}

export function DestinationSection({
    page,
    filters,
    summary,
    onStatus,
}: {
    page: Paginated<Destination>;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
    onStatus: StatusHandler;
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Destination | null>(null);

    return (
        <SectionShell
            eyebrow="Catálogo operativo"
            title="Ubicaciones"
            description="Colonias, poblados y lugares reutilizables. Las actividades se describen por separado en cada vale."
            icon={<MapPin className="size-5" aria-hidden="true" />}
            count={summary.total}
            pending={summary.pending_review}
            actions={
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden="true" />
                    Nueva ubicación
                </Button>
            }
        >
            <CatalogToolbar
                section="destinations"
                initial={filters}
                voucherTypes={[]}
                pendingReview={summary.pending_review}
            />
            {page.data.length === 0 ? (
                <CatalogEmpty title="No se encontraron ubicaciones" />
            ) : (
                <>
                    <div className="hidden p-4 sm:p-6 md:block">
                        <DataTableSurface label="Ubicaciones del catálogo">
                            <Table className="table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[45%]">
                                            Ubicación
                                        </TableHead>
                                        <TableHead className="w-[15%]">
                                            Otros nombres
                                        </TableHead>
                                        <TableHead className="w-[15%]">
                                            Estado
                                        </TableHead>
                                        <TableHead className="w-[25%] text-right">
                                            Acciones
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {page.data.map((destination) => (
                                        <TableRow key={destination.id}>
                                            <TableCell className="whitespace-normal">
                                                <RecordName
                                                    name={destination.name}
                                                    needsReview={
                                                        destination.needs_review
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {destination.aliases_count ?? 0}
                                            </TableCell>
                                            <TableCell>
                                                <StateBadge
                                                    active={
                                                        destination.is_active
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setEditing(
                                                                destination,
                                                            )
                                                        }
                                                    >
                                                        <Pencil aria-hidden="true" />
                                                        {destination.needs_review
                                                            ? 'Revisar'
                                                            : 'Editar'}
                                                    </Button>
                                                    <StatusAction
                                                        target={{
                                                            type: 'destinations',
                                                            id: destination.id,
                                                            name: destination.name,
                                                            active: Boolean(
                                                                destination.is_active,
                                                            ),
                                                        }}
                                                        onRequest={onStatus}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </DataTableSurface>
                    </div>
                    <div className="grid gap-3 p-4 md:hidden">
                        {page.data.map((destination) => (
                            <MobileRecord key={destination.id}>
                                <RecordName
                                    name={destination.name}
                                    needsReview={destination.needs_review}
                                />
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <MobileDatum label="Otros nombres">
                                        {destination.aliases_count ?? 0}
                                    </MobileDatum>
                                    <MobileDatum label="Estado">
                                        <StateBadge
                                            active={destination.is_active}
                                        />
                                    </MobileDatum>
                                </div>
                                <div className="mt-4 flex justify-end gap-1 border-t border-border pt-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditing(destination)}
                                    >
                                        <Pencil aria-hidden="true" />
                                        {destination.needs_review
                                            ? 'Revisar'
                                            : 'Editar'}
                                    </Button>
                                    <StatusAction
                                        target={{
                                            type: 'destinations',
                                            id: destination.id,
                                            name: destination.name,
                                            active: Boolean(
                                                destination.is_active,
                                            ),
                                        }}
                                        onRequest={onStatus}
                                    />
                                </div>
                            </MobileRecord>
                        ))}
                    </div>
                </>
            )}
            <CatalogPagination page={page} />
            <DestinationDialog open={createOpen} onOpenChange={setCreateOpen} />
            {editing && (
                <DestinationDialog
                    key={editing.id}
                    open
                    destination={editing}
                    onOpenChange={(open) => !open && setEditing(null)}
                />
            )}
        </SectionShell>
    );
}

function DestinationDialog({
    open,
    onOpenChange,
    destination,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    destination?: Destination;
}) {
    const form = useForm({ name: destination?.name ?? '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        };

        if (destination) {
            form.put(`/catalogs/destinations/${destination.id}`, options);
        } else {
            form.post('/catalogs/destinations', options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {destination
                                ? destination.needs_review
                                    ? 'Revisar ubicación'
                                    : 'Editar ubicación'
                                : 'Nueva ubicación'}
                        </DialogTitle>
                        <DialogDescription>
                            El nombre anterior se conservará como otro nombre
                            conocido para reconocer el histórico.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="destination-name">
                            Nombre de la ubicación
                        </Label>
                        <Input
                            id="destination-name"
                            autoFocus
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button disabled={form.processing}>
                            {destination?.needs_review
                                ? 'Guardar como revisada'
                                : destination
                                  ? 'Guardar cambios'
                                  : 'Agregar ubicación'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function personRoles(person: Person): string[] {
    return [
        person.can_receive_material ? 'Recibe / técnico' : '',
        person.can_deliver_material ? 'Entrega' : '',
        person.can_authorize_material ? 'Autoriza' : '',
    ].filter(Boolean);
}

export function PeopleSection({
    page,
    filters,
    summary,
    onStatus,
}: {
    page: Paginated<Person>;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
    onStatus: StatusHandler;
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Person | null>(null);

    return (
        <SectionShell
            eyebrow="Catálogo operativo"
            title="Personas"
            description="Define quién recibe, entrega o autoriza material para que cada persona aparezca en el campo correcto."
            icon={<UsersRound className="size-5" aria-hidden="true" />}
            count={summary.total}
            pending={summary.pending_review}
            actions={
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden="true" />
                    Nueva persona
                </Button>
            }
        >
            <CatalogToolbar
                section="people"
                initial={filters}
                voucherTypes={[]}
                pendingReview={summary.pending_review}
            />
            {page.data.length === 0 ? (
                <CatalogEmpty title="No se encontraron personas" />
            ) : (
                <>
                    <div className="hidden p-4 sm:p-6 md:block">
                        <DataTableSurface label="Personas del catálogo">
                            <Table className="table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[35%]">
                                            Nombre
                                        </TableHead>
                                        <TableHead className="w-[25%]">
                                            Funciones
                                        </TableHead>
                                        <TableHead className="w-[15%]">
                                            Estado
                                        </TableHead>
                                        <TableHead className="w-[25%] text-right">
                                            Acciones
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {page.data.map((person) => (
                                        <TableRow key={person.id}>
                                            <TableCell className="whitespace-normal">
                                                <RecordName
                                                    name={person.name}
                                                    needsReview={
                                                        person.needs_review
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                <div className="flex flex-wrap gap-1">
                                                    {personRoles(person).map(
                                                        (role) => (
                                                            <Badge
                                                                key={role}
                                                                variant="outline"
                                                            >
                                                                {role}
                                                            </Badge>
                                                        ),
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <StateBadge
                                                    active={person.is_active}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setEditing(person)
                                                        }
                                                    >
                                                        <Pencil aria-hidden="true" />
                                                        {person.needs_review
                                                            ? 'Revisar'
                                                            : 'Editar'}
                                                    </Button>
                                                    <StatusAction
                                                        target={{
                                                            type: 'people',
                                                            id: person.id,
                                                            name: person.name,
                                                            active: Boolean(
                                                                person.is_active,
                                                            ),
                                                        }}
                                                        onRequest={onStatus}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </DataTableSurface>
                    </div>
                    <div className="grid gap-3 p-4 md:hidden">
                        {page.data.map((person) => (
                            <MobileRecord key={person.id}>
                                <RecordName
                                    name={person.name}
                                    needsReview={person.needs_review}
                                />
                                <div className="mt-4 grid gap-4">
                                    <MobileDatum label="Funciones">
                                        <div className="flex flex-wrap gap-1">
                                            {personRoles(person).map((role) => (
                                                <Badge
                                                    key={role}
                                                    variant="outline"
                                                >
                                                    {role}
                                                </Badge>
                                            ))}
                                        </div>
                                    </MobileDatum>
                                    <MobileDatum label="Estado">
                                        <StateBadge active={person.is_active} />
                                    </MobileDatum>
                                </div>
                                <div className="mt-4 flex justify-end gap-1 border-t border-border pt-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditing(person)}
                                    >
                                        <Pencil aria-hidden="true" />
                                        {person.needs_review
                                            ? 'Revisar'
                                            : 'Editar'}
                                    </Button>
                                    <StatusAction
                                        target={{
                                            type: 'people',
                                            id: person.id,
                                            name: person.name,
                                            active: Boolean(person.is_active),
                                        }}
                                        onRequest={onStatus}
                                    />
                                </div>
                            </MobileRecord>
                        ))}
                    </div>
                </>
            )}
            <CatalogPagination page={page} />
            <PersonDialog open={createOpen} onOpenChange={setCreateOpen} />
            {editing && (
                <PersonDialog
                    key={editing.id}
                    open
                    person={editing}
                    onOpenChange={(open) => !open && setEditing(null)}
                />
            )}
        </SectionShell>
    );
}

function PersonDialog({
    open,
    onOpenChange,
    person,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    person?: Person;
}) {
    const form = useForm({
        name: person?.name ?? '',
        can_receive_material: person?.can_receive_material ?? true,
        can_deliver_material: person?.can_deliver_material ?? false,
        can_authorize_material: person?.can_authorize_material ?? false,
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        };

        if (person) {
            form.put(`/catalogs/people/${person.id}`, options);
        } else {
            form.post('/catalogs/people', options);
        }
    };
    const roles = [
        ['can_receive_material', 'Recibe / técnico'],
        ['can_deliver_material', 'Entrega material'],
        ['can_authorize_material', 'Autoriza material'],
    ] as const;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {person
                                ? person.needs_review
                                    ? 'Revisar persona'
                                    : 'Editar persona'
                                : 'Nueva persona'}
                        </DialogTitle>
                        <DialogDescription>
                            Selecciona todas las funciones que puede realizar.
                            Debe conservar al menos una.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="person-name">Nombre completo</Label>
                        <Input
                            id="person-name"
                            autoFocus
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <fieldset className="grid gap-2">
                        <legend className="text-sm font-medium">
                            Funciones
                        </legend>
                        <div className="grid gap-3 rounded-xl border border-border bg-surface-subtle p-4 sm:grid-cols-2">
                            {roles.map(([key, label]) => (
                                <Label
                                    key={key}
                                    className="flex items-center gap-2"
                                >
                                    <Checkbox
                                        checked={form.data[key]}
                                        onCheckedChange={(value) =>
                                            form.setData(key, Boolean(value))
                                        }
                                    />
                                    {label}
                                </Label>
                            ))}
                        </div>
                    </fieldset>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button disabled={form.processing}>
                            {person?.needs_review
                                ? 'Guardar como revisado'
                                : person
                                  ? 'Guardar cambios'
                                  : 'Agregar persona'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function ProgramsSection({
    catalog,
    filters,
    summary,
    programOptions,
    onStatus,
}: {
    catalog: ProgramsCatalog;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
    programOptions: Program[];
    onStatus: StatusHandler;
}) {
    const [programOpen, setProgramOpen] = useState(false);
    const [actionOpen, setActionOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState<Program | null>(null);
    const [editingAction, setEditingAction] = useState<Action | null>(null);

    return (
        <SectionShell
            eyebrow="Clasificación de Almacén"
            title="Programas y acciones"
            description="Organiza las clasificaciones opcionales de los vales de Almacén. Cada acción pertenece a un programa."
            icon={<Workflow className="size-5" aria-hidden="true" />}
            count={summary.total}
            actions={
                <>
                    <Button
                        variant="outline"
                        onClick={() => setActionOpen(true)}
                        disabled={programOptions.length === 0}
                    >
                        <Plus aria-hidden="true" />
                        Nueva acción
                    </Button>
                    <Button onClick={() => setProgramOpen(true)}>
                        <Plus aria-hidden="true" />
                        Nuevo programa
                    </Button>
                </>
            }
        >
            <CatalogToolbar
                section="programs"
                initial={filters}
                voucherTypes={[]}
                pendingReview={0}
            />
            <CardContent className="grid gap-6 py-6">
                <ClassificationBlock
                    title="Programas"
                    count={catalog.programs.length}
                    description="Código principal y nombre descriptivo."
                >
                    {catalog.programs.length === 0 ? (
                        <CatalogEmpty title="No se encontraron programas" />
                    ) : (
                        <ClassificationTable
                            kind="program"
                            rows={catalog.programs}
                            onEdit={(row) => setEditingProgram(row as Program)}
                            onStatus={onStatus}
                        />
                    )}
                </ClassificationBlock>
                <ClassificationBlock
                    title="Acciones"
                    count={catalog.actions.length}
                    description="Clasificaciones subordinadas a un programa."
                >
                    {catalog.actions.length === 0 ? (
                        <CatalogEmpty title="No se encontraron acciones" />
                    ) : (
                        <ClassificationTable
                            kind="action"
                            rows={catalog.actions}
                            onEdit={(row) => setEditingAction(row as Action)}
                            onStatus={onStatus}
                        />
                    )}
                </ClassificationBlock>
            </CardContent>
            <ProgramDialog open={programOpen} onOpenChange={setProgramOpen} />
            {editingProgram && (
                <ProgramDialog
                    key={editingProgram.id}
                    open
                    program={editingProgram}
                    onOpenChange={(open) => !open && setEditingProgram(null)}
                />
            )}
            <ActionDialog
                open={actionOpen}
                onOpenChange={setActionOpen}
                programs={programOptions}
            />
            {editingAction && (
                <ActionDialog
                    key={editingAction.id}
                    open
                    action={editingAction}
                    programs={programOptions}
                    onOpenChange={(open) => !open && setEditingAction(null)}
                />
            )}
        </SectionShell>
    );
}

function ClassificationBlock({
    title,
    count,
    description,
    children,
}: {
    title: string;
    count: number;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
            <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-subtle px-4 py-3 sm:px-5">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{title}</h3>
                        <Badge variant="secondary">{count}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>
            {children}
        </section>
    );
}

function ClassificationTable({
    kind,
    rows,
    onEdit,
    onStatus,
}: {
    kind: 'program' | 'action';
    rows: (Program | Action)[];
    onEdit: (row: Program | Action) => void;
    onStatus: StatusHandler;
}) {
    return (
        <>
            <div className="hidden md:block">
                <Table className="table-fixed">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[22%]">Código</TableHead>
                            {kind === 'action' && (
                                <TableHead className="w-[20%]">
                                    Programa
                                </TableHead>
                            )}
                            <TableHead>Nombre</TableHead>
                            <TableHead className="w-[13%]">Estado</TableHead>
                            <TableHead className="w-[24%] text-right">
                                Acciones
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell className="font-mono text-xs font-semibold">
                                    {row.code}
                                </TableCell>
                                {kind === 'action' && (
                                    <TableCell>
                                        {(row as Action).program?.code}
                                    </TableCell>
                                )}
                                <TableCell className="whitespace-normal">
                                    {row.name || (
                                        <span className="text-muted-foreground">
                                            Sin nombre
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <StateBadge active={row.is_active} />
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onEdit(row)}
                                        >
                                            <Pencil aria-hidden="true" />
                                            Editar
                                        </Button>
                                        <StatusAction
                                            target={{
                                                type:
                                                    kind === 'program'
                                                        ? 'programs'
                                                        : 'actions',
                                                id: row.id,
                                                name: row.code,
                                                active: Boolean(row.is_active),
                                            }}
                                            onRequest={onStatus}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
                {rows.map((row) => (
                    <MobileRecord key={row.id}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-mono text-xs font-bold text-primary">
                                    {row.code}
                                </p>
                                <p className="mt-1 font-medium">
                                    {row.name || 'Sin nombre'}
                                </p>
                            </div>
                            <StateBadge active={row.is_active} />
                        </div>
                        {kind === 'action' && (
                            <div className="mt-3">
                                <MobileDatum label="Programa">
                                    {(row as Action).program?.code}
                                </MobileDatum>
                            </div>
                        )}
                        <div className="mt-4 flex justify-end gap-1 border-t border-border pt-3">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit(row)}
                            >
                                <Pencil aria-hidden="true" />
                                Editar
                            </Button>
                            <StatusAction
                                target={{
                                    type:
                                        kind === 'program'
                                            ? 'programs'
                                            : 'actions',
                                    id: row.id,
                                    name: row.code,
                                    active: Boolean(row.is_active),
                                }}
                                onRequest={onStatus}
                            />
                        </div>
                    </MobileRecord>
                ))}
            </div>
        </>
    );
}

function ProgramDialog({
    open,
    onOpenChange,
    program,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    program?: Program;
}) {
    const form = useForm({
        code: program?.code ?? '',
        name: program?.name ?? '',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        };

        if (program) {
            form.transform((data) => ({ name: data.name }));
            form.put(`/catalogs/programs/${program.id}`, options);
        } else {
            form.post('/catalogs/programs', options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {program ? 'Editar programa' : 'Nuevo programa'}
                        </DialogTitle>
                        <DialogDescription>
                            {program
                                ? 'El código identifica al programa y no puede modificarse.'
                                : 'Usa el formato SPM-00 para conservar la clasificación institucional.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                        <div className="grid gap-2">
                            <Label htmlFor="program-code">Código</Label>
                            <Input
                                id="program-code"
                                value={form.data.code}
                                onChange={(event) =>
                                    form.setData('code', event.target.value)
                                }
                                disabled={Boolean(program)}
                                placeholder="SPM-00"
                            />
                            <InputError message={form.errors.code} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="program-name">Nombre</Label>
                            <Input
                                id="program-name"
                                autoFocus={Boolean(program)}
                                value={form.data.name}
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                                placeholder="Nombre opcional"
                            />
                            <InputError message={form.errors.name} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button disabled={form.processing}>
                            {program ? 'Guardar cambios' : 'Agregar programa'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ActionDialog({
    open,
    onOpenChange,
    action,
    programs,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    action?: Action;
    programs: Program[];
}) {
    const form = useForm({
        program_id: action ? String(action.program_id) : '',
        code: action?.code ?? '',
        name: action?.name ?? '',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        };

        if (action) {
            form.transform((data) => ({ name: data.name }));
            form.put(`/catalogs/actions/${action.id}`, options);
        } else {
            form.post('/catalogs/actions', options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {action ? 'Editar acción' : 'Nueva acción'}
                        </DialogTitle>
                        <DialogDescription>
                            {action
                                ? 'El código y programa asociados no pueden modificarse.'
                                : 'La acción debe comenzar con el código del programa seleccionado.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="action-program">Programa</Label>
                            <SimpleSelect
                                id="action-program"
                                value={form.data.program_id}
                                onValueChange={(value) =>
                                    form.setData('program_id', value)
                                }
                                options={programs.map((program) => ({
                                    value: String(program.id),
                                    label: `${program.code}${program.name ? ` · ${program.name}` : ''}`,
                                }))}
                                placeholder="Seleccionar programa"
                                disabled={Boolean(action)}
                                invalid={Boolean(form.errors.program_id)}
                            />
                            <InputError message={form.errors.program_id} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                            <div className="grid gap-2">
                                <Label htmlFor="action-code">Código</Label>
                                <Input
                                    id="action-code"
                                    value={form.data.code}
                                    onChange={(event) =>
                                        form.setData('code', event.target.value)
                                    }
                                    disabled={Boolean(action)}
                                    placeholder="SPM-06-01"
                                />
                                <InputError message={form.errors.code} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="action-name">Nombre</Label>
                                <Input
                                    id="action-name"
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    placeholder="Nombre opcional"
                                />
                                <InputError message={form.errors.name} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button disabled={form.processing}>
                            {action ? 'Guardar cambios' : 'Agregar acción'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
