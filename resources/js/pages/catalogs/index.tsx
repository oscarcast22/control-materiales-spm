import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import InputError from '@/components/input-error';
import { Page, PageHeader } from '@/components/page';
import { SimpleSelect } from '@/components/simple-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
    Person,
    Program,
    Unit,
    VoucherType,
} from '@/types';

type Props = {
    materials: Material[];
    people: Person[];
    units: Unit[];
    programs: Program[];
    actions: Action[];
    voucherTypes: VoucherType[];
    destinations: Destination[];
};

export default function Catalogs({
    materials,
    people,
    units,
    programs,
    actions,
    voucherTypes,
    destinations,
}: Props) {
    return (
        <>
            <Head title="Catálogos" />
            <Page width="wide">
                <PageHeader
                    title="Catálogos"
                    description="Administra nombres, unidades y clasificaciones reutilizables sin alterar el historial registrado."
                />
                <div className="grid gap-6 xl:grid-cols-2">
                    <VoucherTypeSection voucherTypes={voucherTypes} />
                    <DestinationSection destinations={destinations} />
                    <MaterialSection
                        materials={materials}
                        units={units}
                        voucherTypes={voucherTypes}
                    />
                    <PeopleSection people={people} />
                    <UnitSection units={units} />
                    <ProgramSection programs={programs} />
                    <ActionSection actions={actions} programs={programs} />
                </div>
            </Page>
        </>
    );
}

function DestinationSection({ destinations }: { destinations: Destination[] }) {
    const form = useForm({ name: '' });
    const [query, setQuery] = useState('');
    const [reviewOnly, setReviewOnly] = useState(
        destinations.some((destination) => destination.needs_review),
    );
    const visibleDestinations = destinations.filter(
        (destination) =>
            (!reviewOnly || destination.needs_review) &&
            destination.name
                .toLocaleLowerCase('es-MX')
                .includes(query.toLocaleLowerCase('es-MX')),
    );

    return (
        <Card className="xl:col-span-2">
            <CardHeader>
                <CardTitle>
                    Ubicaciones{' '}
                    <Badge variant="secondary">{destinations.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    Colonias, poblados y lugares reutilizables en los vales. Las
                    actividades se describen por separado durante la captura.
                </p>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/catalogs/destinations', {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                    className="flex gap-2"
                >
                    <div className="flex-1">
                        <Input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            placeholder="Ej. Poblado Otinapa"
                            aria-label="Nombre de la ubicación"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <Button
                        disabled={form.processing}
                        aria-label="Agregar ubicación"
                    >
                        <Plus />
                    </Button>
                </form>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        aria-label="Buscar ubicación"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar ubicación"
                        className="sm:max-w-xs"
                    />
                    <Label
                        htmlFor="destination-review-only"
                        className="flex items-center gap-2 text-sm"
                    >
                        <Checkbox
                            id="destination-review-only"
                            checked={reviewOnly}
                            onCheckedChange={(value) =>
                                setReviewOnly(Boolean(value))
                            }
                        />
                        Sólo pendientes de revisión
                    </Label>
                    <span className="text-xs text-muted-foreground">
                        {visibleDestinations.length} visibles
                    </span>
                </div>
                <CatalogTable
                    headers={[
                        'Ubicación',
                        'Otros nombres',
                        'Estado',
                        'Acciones',
                    ]}
                    rows={visibleDestinations.map((destination) => [
                        <span key="name">
                            {destination.name}
                            {destination.needs_review && (
                                <Badge
                                    variant="outline"
                                    className="ml-2 border-warning/40 bg-warning-subtle text-warning"
                                >
                                    Revisar
                                </Badge>
                            )}
                        </span>,
                        destination.aliases_count ?? 0,
                        destination.is_active ? 'Activo' : 'Inactivo',
                        <div key="actions" className="flex justify-end gap-2">
                            <DestinationReviewControl
                                destination={destination}
                            />
                            <Toggle
                                type="destinations"
                                id={destination.id}
                                active={Boolean(destination.is_active)}
                            />
                        </div>,
                    ])}
                />
            </CardContent>
        </Card>
    );
}

function DestinationReviewControl({
    destination,
}: {
    destination: Destination;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({ name: destination.name });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                    <Pencil className="size-3.5" />
                    Revisar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put(`/catalogs/destinations/${destination.id}`, {
                            preserveScroll: true,
                            onSuccess: () => setOpen(false),
                        });
                    }}
                    className="flex flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>Revisar ubicación</DialogTitle>
                        <DialogDescription>
                            Corrige el nombre canónico. El nombre anterior se
                            conservará como alias para reconocer el histórico.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`destination-name-${destination.id}`}>
                            Nombre
                        </Label>
                        <Input
                            id={`destination-name-${destination.id}`}
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={form.processing}>
                            Guardar como revisada
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function VoucherTypeSection({ voucherTypes }: { voucherTypes: VoucherType[] }) {
    const form = useForm({
        code: '',
        name: '',
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tipos de vale</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    Distinguen el formato y la serie de folios del vale.
                </p>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/catalogs/voucher-types', {
                            preserveScroll: true,
                            onSuccess: () => form.reset('code', 'name'),
                        });
                    }}
                    className="grid gap-2 sm:grid-cols-[120px_1fr_auto]"
                >
                    <Input
                        aria-label="Código del tipo de vale"
                        value={form.data.code}
                        onChange={(event) =>
                            form.setData('code', event.target.value)
                        }
                        placeholder="Código"
                    />
                    <Input
                        aria-label="Nombre del tipo de vale"
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        placeholder="Nombre"
                    />
                    <Button aria-label="Agregar tipo de vale">
                        <Plus />
                    </Button>
                </form>
                <InputError message={form.errors.code ?? form.errors.name} />
                <div className="flex flex-col gap-2">
                    {voucherTypes.map((voucherType) => (
                        <VoucherTypeRow
                            key={voucherType.id}
                            voucherType={voucherType}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function VoucherTypeRow({ voucherType }: { voucherType: VoucherType }) {
    const form = useForm({
        name: voucherType.name,
    });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put(`/catalogs/voucher-types/${voucherType.id}`, {
                    preserveScroll: true,
                });
            }}
            className="grid items-center gap-2 rounded-lg border p-2 sm:grid-cols-[90px_1fr_auto_auto]"
        >
            <span className="px-2 text-xs font-medium text-muted-foreground">
                {voucherType.code}
            </span>
            <Input
                value={form.data.name}
                onChange={(event) => form.setData('name', event.target.value)}
            />
            <Button type="submit" variant="outline" size="sm">
                Guardar
            </Button>
            <Toggle
                type="voucher-types"
                id={voucherType.id}
                active={Boolean(voucherType.is_active)}
            />
        </form>
    );
}

function MaterialSection({
    materials,
    units,
    voucherTypes,
}: {
    materials: Material[];
    units: Unit[];
    voucherTypes: VoucherType[];
}) {
    const form = useForm<{
        name: string;
        default_unit_id: string;
        voucher_type_ids: string[];
    }>({ name: '', default_unit_id: '', voucher_type_ids: [] });
    const [query, setQuery] = useState('');
    const [reviewOnly, setReviewOnly] = useState(
        materials.some((material) => material.needs_review),
    );
    const visibleMaterials = materials.filter(
        (material) =>
            (!reviewOnly || material.needs_review) &&
            material.name
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
    );
    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/catalogs/materials', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Materiales{' '}
                    <Badge variant="secondary">{materials.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <form
                    onSubmit={submit}
                    className="grid gap-3 sm:grid-cols-[1fr_170px_auto]"
                >
                    <div>
                        <Input
                            aria-label="Nombre del material"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="Nombre del material"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <SimpleSelect
                        id="new-material-unit"
                        ariaLabel="Unidad del material"
                        value={form.data.default_unit_id}
                        onValueChange={(value) =>
                            form.setData('default_unit_id', value)
                        }
                        options={units
                            .filter((u) => u.is_active)
                            .map((unit) => ({
                                value: String(unit.id),
                                label: `${unit.name} (${unit.symbol})`,
                            }))}
                        placeholder="Seleccionar unidad"
                        emptyLabel="Unidad"
                        invalid={Boolean(form.errors.default_unit_id)}
                    />
                    <Button
                        disabled={form.processing}
                        aria-label="Agregar material"
                    >
                        <Plus />
                    </Button>
                    <div className="sm:col-span-3">
                        <VoucherTypeChecks
                            voucherTypes={voucherTypes}
                            selected={form.data.voucher_type_ids}
                            onChange={(value) =>
                                form.setData('voucher_type_ids', value)
                            }
                        />
                        <InputError message={form.errors.voucher_type_ids} />
                    </div>
                </form>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        aria-label="Buscar material"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar material"
                        className="sm:max-w-xs"
                    />
                    <Label
                        htmlFor="material-review-only"
                        className="flex items-center gap-2 text-sm"
                    >
                        <Checkbox
                            id="material-review-only"
                            checked={reviewOnly}
                            onCheckedChange={(value) =>
                                setReviewOnly(Boolean(value))
                            }
                        />
                        Sólo pendientes de revisión
                    </Label>
                    <span className="text-xs text-muted-foreground">
                        {visibleMaterials.length} visibles
                    </span>
                </div>
                <CatalogTable
                    headers={[
                        'Nombre',
                        'Unidad',
                        'Tipos',
                        'Estado',
                        'Acciones',
                    ]}
                    rows={visibleMaterials.map((m) => [
                        <span key="n">
                            {m.name}
                            {m.needs_review && (
                                <Badge
                                    variant="outline"
                                    className="ml-2 border-warning/40 bg-warning-subtle text-warning"
                                >
                                    Revisar
                                </Badge>
                            )}
                        </span>,
                        m.default_unit?.symbol ?? '—',
                        <div key="types" className="flex flex-wrap gap-1">
                            {m.voucher_types?.map((voucherType) => (
                                <Badge key={voucherType.id} variant="outline">
                                    {voucherType.name}
                                </Badge>
                            ))}
                        </div>,
                        m.is_active ? 'Activo' : 'Inactivo',
                        <div key="a" className="flex justify-end gap-2">
                            <MaterialReviewControl
                                material={m}
                                units={units}
                                voucherTypes={voucherTypes}
                            />
                            <Toggle
                                type="materials"
                                id={m.id}
                                active={Boolean(m.is_active)}
                            />
                        </div>,
                    ])}
                />
            </CardContent>
        </Card>
    );
}

function PeopleSection({ people }: { people: Person[] }) {
    const form = useForm({
        name: '',
        can_receive_material: true,
        can_deliver_material: false,
        can_authorize_material: false,
    });
    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/catalogs/people', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };
    const [query, setQuery] = useState('');
    const [reviewOnly, setReviewOnly] = useState(
        people.some((person) => person.needs_review),
    );
    const visiblePeople = people.filter(
        (person) =>
            (!reviewOnly || person.needs_review) &&
            person.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Personas <Badge variant="secondary">{people.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <form onSubmit={submit} className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                aria-label="Nombre completo de la persona"
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                                placeholder="Nombre completo"
                            />
                            <InputError message={form.errors.name} />
                        </div>
                        <Button
                            disabled={form.processing}
                            aria-label="Agregar persona"
                        >
                            <Plus />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-5 text-sm">
                        <Label
                            htmlFor="person-can-receive"
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                id="person-can-receive"
                                checked={form.data.can_receive_material}
                                onCheckedChange={(v) =>
                                    form.setData(
                                        'can_receive_material',
                                        Boolean(v),
                                    )
                                }
                            />
                            Recibe / técnico
                        </Label>
                        <Label
                            htmlFor="person-can-deliver"
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                id="person-can-deliver"
                                checked={form.data.can_deliver_material}
                                onCheckedChange={(v) =>
                                    form.setData(
                                        'can_deliver_material',
                                        Boolean(v),
                                    )
                                }
                            />
                            Entrega material
                        </Label>
                        <Label
                            htmlFor="person-can-authorize"
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                id="person-can-authorize"
                                checked={form.data.can_authorize_material}
                                onCheckedChange={(v) =>
                                    form.setData(
                                        'can_authorize_material',
                                        Boolean(v),
                                    )
                                }
                            />
                            Autoriza material
                        </Label>
                    </div>
                </form>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        aria-label="Buscar persona"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar persona"
                        className="sm:max-w-xs"
                    />
                    <Label
                        htmlFor="person-review-only"
                        className="flex items-center gap-2 text-sm"
                    >
                        <Checkbox
                            id="person-review-only"
                            checked={reviewOnly}
                            onCheckedChange={(value) =>
                                setReviewOnly(Boolean(value))
                            }
                        />
                        Sólo pendientes de revisión
                    </Label>
                    <span className="text-xs text-muted-foreground">
                        {visiblePeople.length} visibles
                    </span>
                </div>
                <CatalogTable
                    headers={['Nombre', 'Funciones', 'Estado', 'Acciones']}
                    rows={visiblePeople.map((p) => [
                        <span key="n">
                            {p.name}
                            {p.needs_review && (
                                <Badge
                                    variant="outline"
                                    className="ml-2 border-warning/40 bg-warning-subtle text-warning"
                                >
                                    Revisar
                                </Badge>
                            )}
                        </span>,
                        [
                            p.can_receive_material ? 'Técnico' : null,
                            p.can_deliver_material ? 'Entrega' : null,
                            p.can_authorize_material ? 'Autoriza' : null,
                        ]
                            .filter(Boolean)
                            .join(', '),
                        p.is_active ? 'Activo' : 'Inactivo',
                        <div key="a" className="flex justify-end gap-2">
                            <PersonReviewControl person={p} />
                            <Toggle
                                type="people"
                                id={p.id}
                                active={Boolean(p.is_active)}
                            />
                        </div>,
                    ])}
                />
            </CardContent>
        </Card>
    );
}

function MaterialReviewControl({
    material,
    units,
    voucherTypes,
}: {
    material: Material;
    units: Unit[];
    voucherTypes: VoucherType[];
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        name: material.name,
        default_unit_id: String(material.default_unit_id),
        voucher_type_ids:
            material.voucher_types?.map((voucherType) =>
                String(voucherType.id),
            ) ?? [],
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                    <Pencil className="size-3.5" />
                    Revisar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put(`/catalogs/materials/${material.id}`, {
                            preserveScroll: true,
                            onSuccess: () => setOpen(false),
                        });
                    }}
                    className="flex flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>Revisar material</DialogTitle>
                        <DialogDescription>
                            Confirma el nombre canónico y su unidad habitual. El
                            nombre anterior se conservará como alias.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`material-name-${material.id}`}>
                            Nombre
                        </Label>
                        <Input
                            id={`material-name-${material.id}`}
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`material-unit-${material.id}`}>
                            Unidad predeterminada
                        </Label>
                        <SimpleSelect
                            id={`material-unit-${material.id}`}
                            value={form.data.default_unit_id}
                            onValueChange={(value) =>
                                form.setData('default_unit_id', value)
                            }
                            options={units.map((unit) => ({
                                value: String(unit.id),
                                label: `${unit.name} (${unit.symbol})`,
                            }))}
                            placeholder="Seleccionar unidad"
                            invalid={Boolean(form.errors.default_unit_id)}
                        />
                        <InputError message={form.errors.default_unit_id} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label>Disponible en</Label>
                        <VoucherTypeChecks
                            voucherTypes={voucherTypes}
                            selected={form.data.voucher_type_ids}
                            onChange={(value) =>
                                form.setData('voucher_type_ids', value)
                            }
                        />
                        <InputError message={form.errors.voucher_type_ids} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={form.processing}>
                            Guardar como revisado
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function VoucherTypeChecks({
    voucherTypes,
    selected,
    onChange,
}: {
    voucherTypes: VoucherType[];
    selected: string[];
    onChange: (value: string[]) => void;
}) {
    return (
        <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 px-3 py-2.5">
            {voucherTypes
                .filter((voucherType) => voucherType.is_active)
                .map((voucherType) => {
                    const id = String(voucherType.id);

                    return (
                        <Label
                            key={voucherType.id}
                            className="flex items-center gap-2 text-sm"
                        >
                            <Checkbox
                                checked={selected.includes(id)}
                                onCheckedChange={(checked) =>
                                    onChange(
                                        checked
                                            ? [...selected, id]
                                            : selected.filter(
                                                  (value) => value !== id,
                                              ),
                                    )
                                }
                            />
                            {voucherType.name}
                        </Label>
                    );
                })}
        </div>
    );
}

function PersonReviewControl({ person }: { person: Person }) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        name: person.name,
        can_receive_material: person.can_receive_material,
        can_deliver_material: person.can_deliver_material,
        can_authorize_material: person.can_authorize_material,
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                    <Pencil className="size-3.5" />
                    Revisar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put(`/catalogs/people/${person.id}`, {
                            preserveScroll: true,
                            onSuccess: () => setOpen(false),
                        });
                    }}
                    className="flex flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>Revisar persona</DialogTitle>
                        <DialogDescription>
                            Corrige abreviaturas y confirma qué funciones puede
                            realizar. El nombre anterior se conservará como
                            alias.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`person-name-${person.id}`}>
                            Nombre
                        </Label>
                        <Input
                            id={`person-name-${person.id}`}
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="flex flex-col gap-3">
                        <Label className="flex items-center gap-2">
                            <Checkbox
                                checked={form.data.can_receive_material}
                                onCheckedChange={(value) =>
                                    form.setData(
                                        'can_receive_material',
                                        Boolean(value),
                                    )
                                }
                            />
                            Recibe material / técnico
                        </Label>
                        <Label className="flex items-center gap-2">
                            <Checkbox
                                checked={form.data.can_deliver_material}
                                onCheckedChange={(value) =>
                                    form.setData(
                                        'can_deliver_material',
                                        Boolean(value),
                                    )
                                }
                            />
                            Entrega material
                        </Label>
                        <Label className="flex items-center gap-2">
                            <Checkbox
                                checked={form.data.can_authorize_material}
                                onCheckedChange={(value) =>
                                    form.setData(
                                        'can_authorize_material',
                                        Boolean(value),
                                    )
                                }
                            />
                            Autoriza material
                        </Label>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={form.processing}>
                            Guardar como revisado
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function UnitSection({ units }: { units: Unit[] }) {
    const form = useForm({ name: '', symbol: '' });
    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/catalogs/units', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Unidades</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <form
                    onSubmit={submit}
                    className="grid gap-2 sm:grid-cols-[1fr_100px_auto]"
                >
                    <Input
                        aria-label="Nombre de la unidad"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="Ej. Rollo"
                    />
                    <Input
                        aria-label="Símbolo de la unidad"
                        value={form.data.symbol}
                        onChange={(e) => form.setData('symbol', e.target.value)}
                        placeholder="Símbolo"
                    />
                    <Button aria-label="Agregar unidad">
                        <Plus />
                    </Button>
                </form>
                <CatalogTable
                    headers={['Nombre', 'Símbolo', 'Estado', 'Acciones']}
                    rows={units.map((u) => [
                        u.name,
                        u.symbol,
                        u.is_active ? 'Activo' : 'Inactivo',
                        <Toggle
                            key="t"
                            type="units"
                            id={u.id}
                            active={Boolean(u.is_active)}
                        />,
                    ])}
                />
            </CardContent>
        </Card>
    );
}

function ProgramSection({ programs }: { programs: Program[] }) {
    const program = useForm({ code: '', name: '' });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Programas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        program.post('/catalogs/programs', {
                            preserveScroll: true,
                            onSuccess: () => program.reset(),
                        });
                    }}
                    className="grid gap-2 sm:grid-cols-[140px_1fr_auto]"
                >
                    <Input
                        aria-label="Código del programa"
                        value={program.data.code}
                        onChange={(e) =>
                            program.setData('code', e.target.value)
                        }
                        placeholder="SPM-00"
                    />
                    <Input
                        aria-label="Nombre del programa"
                        value={program.data.name}
                        onChange={(e) =>
                            program.setData('name', e.target.value)
                        }
                        placeholder="Nombre opcional"
                    />
                    <Button aria-label="Agregar programa">
                        <Plus />
                    </Button>
                </form>
                <div className="flex flex-col gap-2">
                    {programs.map((p) => (
                        <div key={p.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                                <strong>
                                    {p.code} {p.name && `· ${p.name}`}
                                </strong>
                                <Toggle
                                    type="programs"
                                    id={p.id}
                                    active={Boolean(p.is_active)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function ActionSection({
    actions,
    programs,
}: {
    actions: Action[];
    programs: Program[];
}) {
    const form = useForm({ program_id: '', code: '', name: '' });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <p className="text-sm text-muted-foreground">
                    Cada acción pertenece a un programa y conserva su código
                    completo.
                </p>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/catalogs/actions', {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                    className="grid gap-2 sm:grid-cols-[150px_150px_1fr_auto]"
                >
                    <SimpleSelect
                        id="new-action-program"
                        ariaLabel="Programa de la acción"
                        value={form.data.program_id}
                        onValueChange={(value) =>
                            form.setData('program_id', value)
                        }
                        options={programs
                            .filter((program) => program.is_active)
                            .map((program) => ({
                                value: String(program.id),
                                label: program.code,
                            }))}
                        placeholder="Programa"
                        invalid={Boolean(form.errors.program_id)}
                    />
                    <Input
                        value={form.data.code}
                        onChange={(event) =>
                            form.setData('code', event.target.value)
                        }
                        placeholder="SPM-06-01"
                        aria-label="Código de acción"
                    />
                    <Input
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        placeholder="Nombre opcional"
                        aria-label="Nombre de acción"
                    />
                    <Button aria-label="Agregar acción">
                        <Plus />
                    </Button>
                </form>
                <InputError
                    message={
                        form.errors.program_id ??
                        form.errors.code ??
                        form.errors.name
                    }
                />
                <div className="flex flex-col gap-2">
                    {actions.map((action) => (
                        <div
                            key={action.id}
                            className="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                            <div>
                                <strong>{action.code}</strong>
                                {action.name && (
                                    <p className="text-sm text-muted-foreground">
                                        {action.name}
                                    </p>
                                )}
                            </div>
                            <Toggle
                                type="actions"
                                id={action.id}
                                active={Boolean(action.is_active)}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function CatalogTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: React.ReactNode[][];
}) {
    return (
        <DataTableSurface label="Resultados del catálogo">
            <Table
                className="min-w-[560px]"
                containerClassName="max-h-96 overflow-auto"
            >
                <TableHeader>
                    <TableRow>
                        {headers.map((h, i) => (
                            <TableHead
                                key={i}
                                className={
                                    i === headers.length - 1
                                        ? 'text-right'
                                        : undefined
                                }
                            >
                                {h}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, i) => (
                        <TableRow key={i}>
                            {row.map((cell, j) => (
                                <TableCell
                                    key={j}
                                    className={
                                        j === headers.length - 1
                                            ? 'text-right'
                                            : undefined
                                    }
                                >
                                    {cell}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                    {rows.length === 0 && (
                        <TableEmpty
                            colSpan={headers.length}
                            title="Sin resultados"
                            description="Ajusta la búsqueda o crea un registro nuevo."
                        />
                    )}
                </TableBody>
            </Table>
        </DataTableSurface>
    );
}
function Toggle({
    type,
    id,
    active,
}: {
    type: string;
    id: number;
    active: boolean;
}) {
    return (
        <Button
            size="sm"
            variant="ghost"
            onClick={() =>
                router.post(
                    `/catalogs/${type}/${id}/toggle`,
                    {},
                    { preserveScroll: true },
                )
            }
        >
            {active ? 'Desactivar' : 'Activar'}
        </Button>
    );
}
