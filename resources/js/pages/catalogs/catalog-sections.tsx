import { useForm } from '@inertiajs/react';
import {
    Boxes,
    KeyRound,
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
import PasswordInput from '@/components/password-input';
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
    ActionIndicator,
    Destination,
    Material,
    Paginated,
    Person,
    Unit,
    VoucherType,
} from '@/types';
import type {
    CatalogFilters,
    CatalogNavigationItem,
    ProgramsCatalog,
} from './catalog-types';
import {
    CatalogDeleteAction,
    CatalogEmpty,
    CatalogPagination,
    CatalogStatusField,
    CatalogToolbar,
    MobileDatum,
    MobileRecord,
} from './catalog-ui';

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

export function MaterialSection({
    page,
    filters,
    summary,
    units,
    voucherTypes,
}: {
    page: Paginated<Material>;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
    units: Unit[];
    voucherTypes: VoucherType[];
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
                                        <TableHead className="w-[35%]">
                                            Nombre
                                        </TableHead>
                                        <TableHead className="w-[12%]">
                                            Unidad
                                        </TableHead>
                                        <TableHead className="w-[25%]">
                                            Disponible en
                                        </TableHead>
                                        <TableHead className="w-[28%] text-right">
                                            Editar
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
        is_active: boolean;
    }>({
        name: material?.name ?? '',
        default_unit_id: material ? String(material.default_unit_id) : '',
        voucher_type_ids:
            material?.voucher_types?.map((type) => String(type.id)) ?? [],
        is_active: material?.is_active ?? true,
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
                    {material && (
                        <CatalogStatusField
                            value={form.data.is_active}
                            onValueChange={(value) =>
                                form.setData('is_active', value)
                            }
                        />
                    )}
                    <DialogFooter
                        className={material ? 'sm:justify-between' : undefined}
                    >
                        {material && (
                            <CatalogDeleteAction
                                target={{
                                    type: 'materials',
                                    id: material.id,
                                    name: material.name,
                                    deletion: material.deletion,
                                }}
                                onDeleted={() => onOpenChange(false)}
                            />
                        )}
                        <div className="flex gap-2">
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
                        </div>
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
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    units: Unit[];
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
                        <UnitRow key={unit.id} unit={unit} />
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function UnitRow({ unit }: { unit: Unit }) {
    const form = useForm({
        name: unit.name,
        symbol: unit.symbol,
        is_active: unit.is_active ?? true,
    });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put(`/catalogs/units/${unit.id}`, {
                    preserveScroll: true,
                    onSuccess: () => form.setDefaults(),
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
            <CatalogDeleteAction
                target={{
                    type: 'units',
                    id: unit.id,
                    name: unit.name,
                    deletion: unit.deletion,
                }}
                onDeleted={() => undefined}
            />
            <div className="sm:col-span-4">
                <CatalogStatusField
                    value={form.data.is_active}
                    onValueChange={(value) => form.setData('is_active', value)}
                />
            </div>
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
}: {
    page: Paginated<Destination>;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
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
                                        <TableHead className="w-[55%]">
                                            Ubicación
                                        </TableHead>
                                        <TableHead className="w-[20%]">
                                            Otros nombres
                                        </TableHead>
                                        <TableHead className="w-[25%] text-right">
                                            Editar
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
    const form = useForm({
        name: destination?.name ?? '',
        is_active: destination?.is_active ?? true,
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
                    {destination && (
                        <CatalogStatusField
                            value={form.data.is_active}
                            onValueChange={(value) =>
                                form.setData('is_active', value)
                            }
                        />
                    )}
                    <DialogFooter
                        className={
                            destination ? 'sm:justify-between' : undefined
                        }
                    >
                        {destination && (
                            <CatalogDeleteAction
                                target={{
                                    type: 'destinations',
                                    id: destination.id,
                                    name: destination.name,
                                    deletion: destination.deletion,
                                }}
                                onDeleted={() => onOpenChange(false)}
                            />
                        )}
                        <div className="flex gap-2">
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
                        </div>
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
}: {
    page: Paginated<Person>;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<Person | null>(null);
    const [accountPerson, setAccountPerson] = useState<Person | null>(null);

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
                                        <TableHead className="w-[32%]">
                                            Nombre
                                        </TableHead>
                                        <TableHead className="w-[28%]">
                                            Funciones
                                        </TableHead>
                                        <TableHead className="w-[20%]">
                                            Acceso
                                        </TableHead>
                                        <TableHead className="w-[20%] text-right">
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
                                            <TableCell className="whitespace-normal">
                                                {person.account ? (
                                                    <div>
                                                        <Badge
                                                            variant={
                                                                person.account
                                                                    .is_active
                                                                    ? 'success'
                                                                    : 'secondary'
                                                            }
                                                        >
                                                            {person.account
                                                                .is_active
                                                                ? 'Acceso activo'
                                                                : 'Acceso pausado'}
                                                        </Badge>
                                                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                            {
                                                                person.account
                                                                    .username
                                                            }
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline">
                                                        Sin cuenta
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setAccountPerson(
                                                                person,
                                                            )
                                                        }
                                                        disabled={
                                                            !person.can_receive_material ||
                                                            !person.is_active
                                                        }
                                                    >
                                                        <KeyRound aria-hidden="true" />
                                                        {person.account
                                                            ? 'Acceso'
                                                            : 'Crear acceso'}
                                                    </Button>
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
                                    <MobileDatum label="Acceso técnico">
                                        {person.account
                                            ? `${person.account.username} · ${person.account.is_active ? 'activo' : 'pausado'}`
                                            : 'Sin cuenta'}
                                    </MobileDatum>
                                </div>
                                <div className="mt-4 flex justify-end gap-1 border-t border-border pt-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setAccountPerson(person)}
                                        disabled={
                                            !person.can_receive_material ||
                                            !person.is_active
                                        }
                                    >
                                        <KeyRound aria-hidden="true" />
                                        {person.account
                                            ? 'Acceso'
                                            : 'Crear acceso'}
                                    </Button>
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
            {accountPerson && (
                <TechnicianAccountDialog
                    key={accountPerson.id}
                    person={accountPerson}
                    open
                    onOpenChange={(open) => !open && setAccountPerson(null)}
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
        is_active: person?.is_active ?? true,
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
                                        disabled={
                                            key === 'can_receive_material' &&
                                            Boolean(person?.account)
                                        }
                                        onCheckedChange={(value) =>
                                            form.setData(key, Boolean(value))
                                        }
                                    />
                                    {label}
                                </Label>
                            ))}
                        </div>
                    </fieldset>
                    {person && (
                        <CatalogStatusField
                            value={form.data.is_active}
                            onValueChange={(value) =>
                                form.setData('is_active', value)
                            }
                        />
                    )}
                    <DialogFooter
                        className={person ? 'sm:justify-between' : undefined}
                    >
                        {person && (
                            <CatalogDeleteAction
                                target={{
                                    type: 'people',
                                    id: person.id,
                                    name: person.name,
                                    deletion: person.deletion,
                                }}
                                onDeleted={() => onOpenChange(false)}
                            />
                        )}
                        <div className="flex gap-2">
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
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function TechnicianAccountDialog({
    person,
    open,
    onOpenChange,
}: {
    person: Person;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const account = person.account;
    const details = useForm({
        username: account?.username ?? '',
        email: account?.email ?? '',
        is_active: account?.is_active ?? true,
        password: '',
        password_confirmation: '',
    });
    const reset = useForm({ password: '', password_confirmation: '' });
    const submitDetails = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        };

        if (account) {
            details.put(`/catalogs/people/${person.id}/account`, options);
        } else {
            details.post(`/catalogs/people/${person.id}/account`, options);
        }
    };
    const submitReset = (event: FormEvent) => {
        event.preventDefault();
        reset.put(`/catalogs/people/${person.id}/account/password`, {
            preserveScroll: true,
            onSuccess: () => reset.reset(),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {account
                            ? 'Administrar acceso técnico'
                            : 'Crear acceso técnico'}
                    </DialogTitle>
                    <DialogDescription>
                        Cuenta vinculada a {person.name}. El nombre de usuario
                        será el identificador principal para iniciar sesión.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitDetails} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="technician-username">
                            Nombre de usuario
                        </Label>
                        <Input
                            id="technician-username"
                            value={details.data.username}
                            onChange={(event) =>
                                details.setData(
                                    'username',
                                    event.target.value.toLowerCase(),
                                )
                            }
                            placeholder="nombre.apellido"
                            autoComplete="off"
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Sólo letras minúsculas, números, punto, guion y
                            guion bajo.
                        </p>
                        <InputError message={details.errors.username} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="technician-email">
                            Correo (opcional)
                        </Label>
                        <Input
                            id="technician-email"
                            type="email"
                            value={details.data.email}
                            onChange={(event) =>
                                details.setData('email', event.target.value)
                            }
                            placeholder="nombre@ejemplo.com"
                            autoComplete="off"
                        />
                        <InputError message={details.errors.email} />
                    </div>
                    {!account && (
                        <div className="grid gap-4 rounded-xl border bg-muted/25 p-4">
                            <div className="grid gap-2">
                                <Label htmlFor="technician-password">
                                    Contraseña temporal
                                </Label>
                                <PasswordInput
                                    id="technician-password"
                                    value={details.data.password}
                                    onChange={(event) =>
                                        details.setData(
                                            'password',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    required
                                />
                                <InputError message={details.errors.password} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="technician-password-confirmation">
                                    Confirmar contraseña
                                </Label>
                                <PasswordInput
                                    id="technician-password-confirmation"
                                    value={details.data.password_confirmation}
                                    onChange={(event) =>
                                        details.setData(
                                            'password_confirmation',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                        </div>
                    )}
                    {account && (
                        <Label className="flex items-center gap-3 rounded-xl border p-3">
                            <Checkbox
                                checked={details.data.is_active}
                                onCheckedChange={(value) =>
                                    details.setData('is_active', Boolean(value))
                                }
                            />
                            <span>
                                <span className="block font-medium">
                                    Acceso activo
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    Al pausarlo, la persona no podrá iniciar ni
                                    conservar sesión.
                                </span>
                            </span>
                        </Label>
                    )}
                    <InputError
                        message={
                            (details.errors as Record<string, string>).account
                        }
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button disabled={details.processing}>
                            {account ? 'Guardar acceso' : 'Crear cuenta'}
                        </Button>
                    </div>
                </form>
                {account && (
                    <form
                        onSubmit={submitReset}
                        className="mt-2 grid gap-4 border-t pt-5"
                    >
                        <div>
                            <h3 className="font-semibold">
                                Restablecer contraseña
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Define una nueva contraseña; la anterior nunca
                                se muestra.
                            </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="reset-technician-password">
                                    Nueva contraseña
                                </Label>
                                <PasswordInput
                                    id="reset-technician-password"
                                    value={reset.data.password}
                                    onChange={(event) =>
                                        reset.setData(
                                            'password',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    required
                                />
                                <InputError message={reset.errors.password} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="reset-technician-password-confirmation">
                                    Confirmar
                                </Label>
                                <PasswordInput
                                    id="reset-technician-password-confirmation"
                                    value={reset.data.password_confirmation}
                                    onChange={(event) =>
                                        reset.setData(
                                            'password_confirmation',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={reset.processing}
                            className="justify-self-start"
                        >
                            <KeyRound data-icon="inline-start" /> Restablecer
                            contraseña
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function ProgramsSection({
    catalog,
    filters,
    summary,
}: {
    catalog: ProgramsCatalog;
    filters: CatalogFilters;
    summary: CatalogNavigationItem;
}) {
    const [editingAction, setEditingAction] = useState<Action | null>(null);
    const [editingIndicator, setEditingIndicator] =
        useState<ActionIndicator | null>(null);
    const program = catalog.programs[0];

    return (
        <SectionShell
            eyebrow="Clasificación de Almacén"
            title="Programa, acciones e indicadores"
            description="Consulta la clasificación oficial de las salidas de Almacén. Los códigos y relaciones son estructurales; sólo se corrigen nombres y estados."
            icon={<Workflow className="size-5" aria-hidden="true" />}
            count={summary.total}
            actions={null}
        >
            <CatalogToolbar
                section="programs"
                initial={filters}
                voucherTypes={[]}
                pendingReview={0}
            />
            <CardContent className="grid gap-6 py-6">
                <ClassificationBlock
                    title="Programa fijo"
                    count={catalog.programs.length}
                    description="Se asigna automáticamente a toda salida de Almacén."
                >
                    {!program ? (
                        <CatalogEmpty title="No se encontraron programas" />
                    ) : (
                        <div className="flex flex-col gap-1 p-4 sm:p-5">
                            <span className="font-mono text-xs font-bold text-primary">
                                {program.code}
                            </span>
                            <span className="font-medium">
                                {program.name ?? 'Alumbrado público'}
                            </span>
                        </div>
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
                        />
                    )}
                </ClassificationBlock>
                <ClassificationBlock
                    title="Indicadores"
                    count={catalog.indicators.length}
                    description="Resultados subordinados a cada acción; el formulario los asigna o solicita según corresponda."
                >
                    {catalog.indicators.length === 0 ? (
                        <CatalogEmpty title="No se encontraron indicadores" />
                    ) : (
                        <ClassificationTable
                            kind="indicator"
                            rows={catalog.indicators}
                            onEdit={(row) =>
                                setEditingIndicator(row as ActionIndicator)
                            }
                        />
                    )}
                </ClassificationBlock>
            </CardContent>
            {editingAction && (
                <ActionDialog
                    key={editingAction.id}
                    open
                    action={editingAction}
                    onOpenChange={(open) => !open && setEditingAction(null)}
                />
            )}
            {editingIndicator && (
                <IndicatorDialog
                    key={editingIndicator.id}
                    open
                    indicator={editingIndicator}
                    onOpenChange={(open) => !open && setEditingIndicator(null)}
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
}: {
    kind: 'action' | 'indicator';
    rows: (Action | ActionIndicator)[];
    onEdit: (row: Action | ActionIndicator) => void;
}) {
    return (
        <>
            <div className="hidden md:block">
                <Table className="table-fixed">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[22%]">Código</TableHead>
                            <TableHead className="w-[20%]">
                                {kind === 'action' ? 'Programa' : 'Acción'}
                            </TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="w-[12%]">Estado</TableHead>
                            <TableHead className="w-[17%] text-right">
                                Editar
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell className="font-mono text-xs font-semibold">
                                    {row.code}
                                </TableCell>
                                <TableCell>
                                    {kind === 'action'
                                        ? (row as Action).program?.code
                                        : (row as ActionIndicator).action?.code}
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    {row.name || (
                                        <span className="text-muted-foreground">
                                            Sin nombre
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            row.is_active
                                                ? 'success'
                                                : 'secondary'
                                        }
                                    >
                                        {row.is_active ? 'Activo' : 'Inactivo'}
                                    </Badge>
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
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <MobileDatum
                                label={
                                    kind === 'action' ? 'Programa' : 'Acción'
                                }
                            >
                                {kind === 'action'
                                    ? (row as Action).program?.code
                                    : (row as ActionIndicator).action?.code}
                            </MobileDatum>
                            <MobileDatum label="Estado">
                                {row.is_active ? 'Activo' : 'Inactivo'}
                            </MobileDatum>
                        </div>
                        <div className="mt-4 flex justify-end gap-1 border-t border-border pt-3">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit(row)}
                            >
                                <Pencil aria-hidden="true" />
                                Editar
                            </Button>
                        </div>
                    </MobileRecord>
                ))}
            </div>
        </>
    );
}

function ActionDialog({
    open,
    onOpenChange,
    action,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    action: Action;
}) {
    const form = useForm({
        name: action.name ?? '',
        is_active: action.is_active ?? true,
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

        form.put(`/catalogs/actions/${action.id}`, options);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>Editar acción</DialogTitle>
                        <DialogDescription>
                            El código y el programa son parte del catálogo
                            oficial y no pueden modificarse.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="action-program">Programa</Label>
                            <div
                                id="action-program"
                                className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm font-semibold"
                            >
                                {action.program?.code ?? 'SPM-06'}
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                            <div className="grid gap-2">
                                <Label htmlFor="action-code">Código</Label>
                                <div
                                    id="action-code"
                                    className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm font-semibold"
                                >
                                    {action.code}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="action-name">Nombre</Label>
                                <Input
                                    id="action-name"
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    placeholder="Nombre breve"
                                />
                                <InputError message={form.errors.name} />
                            </div>
                        </div>
                    </div>
                    <CatalogStatusField
                        value={form.data.is_active}
                        onValueChange={(value) =>
                            form.setData('is_active', value)
                        }
                    />
                    <DialogFooter>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button disabled={form.processing}>
                                Guardar cambios
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function IndicatorDialog({
    open,
    onOpenChange,
    indicator,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    indicator: ActionIndicator;
}) {
    const form = useForm({
        name: indicator.name,
        is_active: indicator.is_active ?? true,
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(`/catalogs/indicators/${indicator.id}`, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>Editar indicador</DialogTitle>
                        <DialogDescription>
                            El código y la acción son parte del catálogo oficial
                            y no pueden modificarse.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="indicator-action">Acción</Label>
                            <div
                                id="indicator-action"
                                className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm font-semibold"
                            >
                                {indicator.action?.code ?? '—'}
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                            <div className="grid gap-2">
                                <Label htmlFor="indicator-code">Código</Label>
                                <div
                                    id="indicator-code"
                                    className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm font-semibold"
                                >
                                    {indicator.code}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="indicator-name">Nombre</Label>
                                <Input
                                    id="indicator-name"
                                    autoFocus
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    placeholder="Nombre breve"
                                />
                                <InputError message={form.errors.name} />
                            </div>
                        </div>
                    </div>
                    <CatalogStatusField
                        value={form.data.is_active}
                        onValueChange={(value) =>
                            form.setData('is_active', value)
                        }
                    />
                    <DialogFooter>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button disabled={form.processing}>
                                Guardar cambios
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
