import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
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
import type { Material, Person, Program, StorageLocation, Unit } from '@/types';

type Props = {
    materials: Material[];
    people: Person[];
    units: Unit[];
    programs: Program[];
    locations: StorageLocation[];
};

export default function Catalogs({
    materials,
    people,
    units,
    programs,
    locations,
}: Props) {
    return (
        <>
            <Head title="Catálogos" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-7">
                <div>
                    <h1 className="text-3xl font-bold">Catálogos</h1>
                    <p className="text-muted-foreground">
                        Evitan volver a escribir nombres y conservan unidades
                        consistentes.
                    </p>
                </div>
                <div className="grid gap-6 xl:grid-cols-2">
                    <LocationSection locations={locations} />
                    <MaterialSection materials={materials} units={units} />
                    <PeopleSection people={people} />
                    <UnitSection units={units} />
                    <ProgramSection programs={programs} />
                </div>
            </div>
        </>
    );
}

function LocationSection({ locations }: { locations: StorageLocation[] }) {
    const form = useForm({
        code: '',
        name: '',
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Áreas de resguardo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Identifican el área que entregó o recibió cada vale.
                </p>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/catalogs/locations', {
                            preserveScroll: true,
                            onSuccess: () => form.reset('code', 'name'),
                        });
                    }}
                    className="grid gap-2 sm:grid-cols-[120px_1fr_auto]"
                >
                    <Input
                        value={form.data.code}
                        onChange={(event) =>
                            form.setData('code', event.target.value)
                        }
                        placeholder="Código"
                    />
                    <Input
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        placeholder="Nombre"
                    />
                    <Button>
                        <Plus className="size-4" />
                    </Button>
                </form>
                <InputError message={form.errors.code ?? form.errors.name} />
                <div className="space-y-2">
                    {locations.map((location) => (
                        <LocationRow key={location.id} location={location} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function LocationRow({ location }: { location: StorageLocation }) {
    const form = useForm({
        name: location.name,
    });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put(`/catalogs/locations/${location.id}`, {
                    preserveScroll: true,
                });
            }}
            className="grid items-center gap-2 rounded-lg border p-2 sm:grid-cols-[90px_1fr_auto_auto]"
        >
            <span className="px-2 text-xs font-medium text-muted-foreground">
                {location.code}
            </span>
            <Input
                value={form.data.name}
                onChange={(event) => form.setData('name', event.target.value)}
            />
            <Button type="submit" variant="outline" size="sm">
                Guardar
            </Button>
            <Toggle
                type="locations"
                id={location.id}
                active={Boolean(location.is_active)}
            />
        </form>
    );
}

function MaterialSection({
    materials,
    units,
}: {
    materials: Material[];
    units: Unit[];
}) {
    const form = useForm({ name: '', default_unit_id: '' });
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
            <CardContent className="space-y-4">
                <form
                    onSubmit={submit}
                    className="grid grid-cols-[1fr_150px_auto] gap-2"
                >
                    <div>
                        <Input
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="Nombre del material"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.data.default_unit_id}
                        onChange={(e) =>
                            form.setData('default_unit_id', e.target.value)
                        }
                    >
                        <option value="">Unidad</option>
                        {units
                            .filter((u) => u.is_active)
                            .map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.symbol}
                                </option>
                            ))}
                    </select>
                    <Button disabled={form.processing}>
                        <Plus className="size-4" />
                    </Button>
                </form>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar material"
                        className="sm:max-w-xs"
                    />
                    <Label className="flex items-center gap-2 text-sm">
                        <Checkbox
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
                    headers={['Nombre', 'Unidad', 'Estado', '']}
                    rows={visibleMaterials.map((m) => [
                        <span key="n">
                            {m.name}
                            {m.needs_review && (
                                <Badge
                                    variant="outline"
                                    className="ml-2 border-amber-400"
                                >
                                    Revisar
                                </Badge>
                            )}
                        </span>,
                        m.default_unit?.symbol ?? '—',
                        m.is_active ? 'Activo' : 'Inactivo',
                        <div key="a" className="flex justify-end gap-2">
                            <MaterialReviewControl material={m} units={units} />
                            <MergeControl
                                type="materials"
                                source={m.id}
                                options={materials.filter((x) => x.id !== m.id)}
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
            <CardContent className="space-y-4">
                <form onSubmit={submit} className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                                placeholder="Nombre completo"
                            />
                            <InputError message={form.errors.name} />
                        </div>
                        <Button disabled={form.processing}>
                            <Plus className="size-4" />
                        </Button>
                    </div>
                    <div className="flex gap-5 text-sm">
                        <Label className="flex items-center gap-2">
                            <Checkbox
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
                        <Label className="flex items-center gap-2">
                            <Checkbox
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
                    </div>
                </form>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar persona"
                        className="sm:max-w-xs"
                    />
                    <Label className="flex items-center gap-2 text-sm">
                        <Checkbox
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
                    headers={['Nombre', 'Funciones', 'Estado', '']}
                    rows={visiblePeople.map((p) => [
                        <span key="n">
                            {p.name}
                            {p.needs_review && (
                                <Badge
                                    variant="outline"
                                    className="ml-2 border-amber-400"
                                >
                                    Revisar
                                </Badge>
                            )}
                        </span>,
                        [
                            p.can_receive_material ? 'Técnico' : null,
                            p.can_deliver_material ? 'Entrega' : null,
                        ]
                            .filter(Boolean)
                            .join(', '),
                        p.is_active ? 'Activo' : 'Inactivo',
                        <div key="a" className="flex justify-end gap-2">
                            <PersonReviewControl person={p} />
                            <MergeControl
                                type="people"
                                source={p.id}
                                options={people.filter((x) => x.id !== p.id)}
                            />
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
}: {
    material: Material;
    units: Unit[];
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        name: material.name,
        default_unit_id: String(material.default_unit_id),
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
                    className="space-y-4"
                >
                    <DialogHeader>
                        <DialogTitle>Revisar material</DialogTitle>
                        <DialogDescription>
                            Confirma el nombre canónico y su unidad habitual. El
                            nombre anterior se conservará como alias.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
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
                    <div className="space-y-2">
                        <Label htmlFor={`material-unit-${material.id}`}>
                            Unidad predeterminada
                        </Label>
                        <select
                            id={`material-unit-${material.id}`}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            value={form.data.default_unit_id}
                            onChange={(event) =>
                                form.setData(
                                    'default_unit_id',
                                    event.target.value,
                                )
                            }
                        >
                            {units.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                    {unit.name} ({unit.symbol})
                                </option>
                            ))}
                        </select>
                        <InputError message={form.errors.default_unit_id} />
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

function PersonReviewControl({ person }: { person: Person }) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        name: person.name,
        can_receive_material: person.can_receive_material,
        can_deliver_material: person.can_deliver_material,
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
                    className="space-y-4"
                >
                    <DialogHeader>
                        <DialogTitle>Revisar persona</DialogTitle>
                        <DialogDescription>
                            Corrige abreviaturas y confirma qué funciones puede
                            realizar. El nombre anterior se conservará como
                            alias.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
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
                    <div className="space-y-3">
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
            <CardContent className="space-y-4">
                <form
                    onSubmit={submit}
                    className="grid grid-cols-[1fr_100px_auto] gap-2"
                >
                    <Input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="Ej. Rollo"
                    />
                    <Input
                        value={form.data.symbol}
                        onChange={(e) => form.setData('symbol', e.target.value)}
                        placeholder="Símbolo"
                    />
                    <Button>
                        <Plus className="size-4" />
                    </Button>
                </form>
                <CatalogTable
                    headers={['Nombre', 'Símbolo', 'Estado', '']}
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
    const action = useForm({ program_id: '', code: '', name: '' });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Programas y acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        program.post('/catalogs/programs', {
                            preserveScroll: true,
                            onSuccess: () => program.reset(),
                        });
                    }}
                    className="grid grid-cols-[140px_1fr_auto] gap-2"
                >
                    <Input
                        value={program.data.code}
                        onChange={(e) =>
                            program.setData('code', e.target.value)
                        }
                        placeholder="SPM-00"
                    />
                    <Input
                        value={program.data.name}
                        onChange={(e) =>
                            program.setData('name', e.target.value)
                        }
                        placeholder="Nombre opcional"
                    />
                    <Button>
                        <Plus className="size-4" />
                    </Button>
                </form>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        action.post('/catalogs/actions', {
                            preserveScroll: true,
                            onSuccess: () => action.reset(),
                        });
                    }}
                    className="grid grid-cols-[140px_160px_1fr_auto] gap-2"
                >
                    <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={action.data.program_id}
                        onChange={(e) =>
                            action.setData('program_id', e.target.value)
                        }
                    >
                        <option value="">Programa</option>
                        {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.code}
                            </option>
                        ))}
                    </select>
                    <Input
                        value={action.data.code}
                        onChange={(e) => action.setData('code', e.target.value)}
                        placeholder="SPM-00-00"
                    />
                    <Input
                        value={action.data.name}
                        onChange={(e) => action.setData('name', e.target.value)}
                        placeholder="Nombre opcional"
                    />
                    <Button>
                        <Plus className="size-4" />
                    </Button>
                </form>
                <div className="space-y-2">
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
                            <div className="mt-2 flex flex-wrap gap-2">
                                {p.actions.map((a) => (
                                    <Badge key={a.id} variant="outline">
                                        {a.code}
                                    </Badge>
                                ))}
                            </div>
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
        <div className="max-h-96 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-t">
                            {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
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
function MergeControl({
    type,
    source,
    options,
}: {
    type: string;
    source: number;
    options: { id: number; name: string }[];
}) {
    const merge = (target: string) => {
        if (
            target &&
            window.confirm(
                'La fusión reasignará todo el historial al registro elegido. ¿Continuar?',
            )
        ) {
            router.post(
                `/catalogs/${type}/${source}/merge`,
                { target_id: Number(target) },
                { preserveScroll: true },
            );
        }
    };

    return (
        <select
            aria-label="Fusionar con"
            className="h-8 max-w-28 rounded border bg-background px-2 text-xs"
            defaultValue=""
            onChange={(e) => {
                merge(e.target.value);
                e.target.value = '';
            }}
        >
            <option value="">Fusionar…</option>
            {options.map((o) => (
                <option key={o.id} value={o.id}>
                    {o.name}
                </option>
            ))}
        </select>
    );
}
