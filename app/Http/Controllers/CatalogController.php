<?php

namespace App\Http\Controllers;

use App\Models\Action;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\MaterialTracking;
use App\Support\Normalizer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CatalogController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('manage-catalogs');

        return Inertia::render('catalogs/index', [
            'materials' => Material::query()->with(['defaultUnit', 'voucherTypes:id,name,code'])->withCount('aliases')->orderBy('name')->get(),
            'people' => Person::query()->withCount('aliases')->orderBy('name')->get(),
            'units' => Unit::query()->orderBy('name')->get(),
            'programs' => Program::query()->orderBy('code')->get(),
            'actions' => Action::query()->with('program:id,code')->orderBy('code')->get(),
            'voucherTypes' => StorageLocation::query()->orderBy('name')->get(),
            'destinations' => Destination::query()->withCount('aliases')->orderBy('name')->get(),
        ]);
    }

    public function storeDestination(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);
        $data['name'] = trim($data['name']);
        $key = Normalizer::key($data['name']);
        if ($key === '') {
            throw ValidationException::withMessages(['name' => 'Escribe un nombre válido para la ubicación.']);
        }
        if (Destination::query()->where('normalized_name', $key)->exists() || DestinationAlias::query()->where('normalized_alias', $key)->exists()) {
            throw ValidationException::withMessages(['name' => 'Ya existe una ubicación con un nombre equivalente.']);
        }
        $destination = Destination::create([...$data, 'normalized_name' => $key]);
        AuditEvent::record($destination, 'created', null, $destination->toArray());

        return back()->with('success', 'Ubicación agregada.');
    }

    public function updateDestination(Request $request, Destination $destination): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);
        $data['name'] = trim($data['name']);
        $key = Normalizer::key($data['name']);
        if ($key === '') {
            throw ValidationException::withMessages(['name' => 'Escribe un nombre válido para la ubicación.']);
        }
        $duplicate = Destination::query()->where('normalized_name', $key)->whereKeyNot($destination->id)->exists();
        $foreignAlias = DestinationAlias::query()
            ->where('normalized_alias', $key)
            ->where('destination_id', '!=', $destination->id)
            ->exists();
        if ($duplicate || $foreignAlias) {
            throw ValidationException::withMessages(['name' => 'Ese nombre pertenece a otra ubicación.']);
        }

        DB::transaction(function () use ($destination, $data, $key): void {
            $before = $destination->toArray();
            if ($destination->normalized_name !== $key) {
                DestinationAlias::firstOrCreate(
                    ['normalized_alias' => $destination->normalized_name],
                    ['destination_id' => $destination->id, 'alias' => $destination->name],
                );
            }
            DestinationAlias::query()
                ->where('destination_id', $destination->id)
                ->where('normalized_alias', $key)
                ->delete();
            $destination->update([
                'name' => $data['name'],
                'normalized_name' => $key,
                'needs_review' => false,
            ]);
            AuditEvent::record($destination, 'reviewed', $before, $destination->fresh()->toArray());
        });

        return back()->with('success', 'Ubicación revisada y actualizada.');
    }

    public function storeMaterial(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'default_unit_id' => ['required', 'exists:units,id'],
            'voucher_type_ids' => ['required', 'array', 'min:1'],
            'voucher_type_ids.*' => ['required', 'integer', 'distinct', Rule::exists('storage_locations', 'id')->where('is_active', true)],
        ]);
        $key = Normalizer::key($data['name']);
        if (Material::query()->where('normalized_name', $key)->exists() || MaterialAlias::query()->where('normalized_alias', $key)->exists()) {
            throw ValidationException::withMessages(['name' => 'Ya existe un material con un nombre equivalente.']);
        }
        $model = DB::transaction(function () use ($data, $key): Material {
            $model = Material::create([
                'name' => $data['name'],
                'default_unit_id' => $data['default_unit_id'],
                'normalized_name' => $key,
            ]);
            $model->voucherTypes()->sync($data['voucher_type_ids']);
            MaterialAlias::create(['material_id' => $model->id, 'alias' => $model->name, 'normalized_alias' => $key]);
            AuditEvent::record($model, 'created', null, [
                ...$model->toArray(),
                'voucher_type_ids' => $data['voucher_type_ids'],
            ]);

            return $model;
        });

        return back()->with('success', 'Material agregado.');
    }

    public function updateMaterial(Request $request, Material $material): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'default_unit_id' => ['required', 'exists:units,id'],
            'voucher_type_ids' => ['required', 'array', 'min:1'],
            'voucher_type_ids.*' => ['required', 'integer', 'distinct', Rule::exists('storage_locations', 'id')->where('is_active', true)],
        ]);
        $key = Normalizer::key($data['name']);
        $duplicate = Material::query()->where('normalized_name', $key)->whereKeyNot($material->id)->exists();
        $foreignAlias = MaterialAlias::query()
            ->where('normalized_alias', $key)
            ->where('material_id', '!=', $material->id)
            ->exists();
        if ($duplicate || $foreignAlias) {
            throw ValidationException::withMessages(['name' => 'Ese nombre pertenece a otro material. Usa un nombre diferente o solicita la corrección del catálogo.']);
        }

        DB::transaction(function () use ($material, $data, $key): void {
            $before = [
                ...$material->toArray(),
                'voucher_type_ids' => $material->voucherTypes()->pluck('storage_locations.id')->all(),
            ];
            MaterialAlias::firstOrCreate(
                ['normalized_alias' => $material->normalized_name],
                ['material_id' => $material->id, 'alias' => $material->name],
            );
            $material->update([
                'name' => $data['name'],
                'default_unit_id' => $data['default_unit_id'],
                'normalized_name' => $key,
                'needs_review' => false,
            ]);
            $material->voucherTypes()->sync($data['voucher_type_ids']);
            MaterialAlias::firstOrCreate(
                ['normalized_alias' => $key],
                ['material_id' => $material->id, 'alias' => $data['name']],
            );
            AuditEvent::record($material, 'reviewed', $before, [
                ...$material->fresh()->toArray(),
                'voucher_type_ids' => $data['voucher_type_ids'],
            ]);
        });

        return back()->with('success', 'Material revisado y actualizado.');
    }

    public function storePerson(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'can_receive_material' => ['required', 'boolean'],
            'can_deliver_material' => ['required', 'boolean'],
            'can_authorize_material' => ['required', 'boolean'],
        ]);
        if (! $data['can_receive_material'] && ! $data['can_deliver_material'] && ! $data['can_authorize_material']) {
            throw ValidationException::withMessages(['name' => 'Selecciona al menos una función para la persona.']);
        }
        $key = Normalizer::key($data['name']);
        if (Person::query()->where('normalized_name', $key)->exists() || PersonAlias::query()->where('normalized_alias', $key)->exists()) {
            throw ValidationException::withMessages(['name' => 'Ya existe una persona con un nombre equivalente.']);
        }
        $model = Person::create([...$data, 'normalized_name' => $key]);
        PersonAlias::create(['person_id' => $model->id, 'alias' => $model->name, 'normalized_alias' => $key]);
        AuditEvent::record($model, 'created', null, $model->toArray());

        return back()->with('success', 'Persona agregada.');
    }

    public function updatePerson(Request $request, Person $person): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'can_receive_material' => ['required', 'boolean'],
            'can_deliver_material' => ['required', 'boolean'],
            'can_authorize_material' => ['required', 'boolean'],
        ]);
        if (! $data['can_receive_material'] && ! $data['can_deliver_material'] && ! $data['can_authorize_material']) {
            throw ValidationException::withMessages(['name' => 'Selecciona al menos una función para la persona.']);
        }
        $key = Normalizer::key($data['name']);
        $duplicate = Person::query()->where('normalized_name', $key)->whereKeyNot($person->id)->exists();
        $foreignAlias = PersonAlias::query()
            ->where('normalized_alias', $key)
            ->where('person_id', '!=', $person->id)
            ->exists();
        if ($duplicate || $foreignAlias) {
            throw ValidationException::withMessages(['name' => 'Ese nombre pertenece a otra persona. Usa un nombre diferente o solicita la corrección del catálogo.']);
        }

        DB::transaction(function () use ($person, $data, $key): void {
            $before = $person->toArray();
            PersonAlias::firstOrCreate(
                ['normalized_alias' => $person->normalized_name],
                ['person_id' => $person->id, 'alias' => $person->name],
            );
            $person->update([
                ...$data,
                'normalized_name' => $key,
                'needs_review' => false,
            ]);
            PersonAlias::firstOrCreate(
                ['normalized_alias' => $key],
                ['person_id' => $person->id, 'alias' => $data['name']],
            );
            AuditEvent::record($person, 'reviewed', $before, $person->fresh()->toArray());
        });

        return back()->with('success', 'Persona revisada y actualizada.');
    }

    public function storeUnit(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'symbol' => ['required', 'string', 'max:20', Rule::unique('units', 'symbol')],
        ]);
        $model = Unit::create($data);
        AuditEvent::record($model, 'created', null, $model->toArray());

        return back()->with('success', 'Unidad agregada.');
    }

    public function storeProgram(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $request->merge(['code' => mb_strtoupper(trim((string) $request->input('code')))]);
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'regex:/^SPM-\d{2}$/', Rule::unique('programs', 'code')],
            'name' => ['nullable', 'string', 'max:255'],
        ]);
        $model = Program::create($data);
        AuditEvent::record($model, 'created', null, $model->toArray());

        return back()->with('success', 'Programa agregado.');
    }

    public function storeAction(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $request->merge(['code' => mb_strtoupper(trim((string) $request->input('code')))]);
        $data = $request->validate([
            'program_id' => ['required', 'integer', Rule::exists('programs', 'id')->where('is_active', true)],
            'code' => ['required', 'string', 'max:50', 'regex:/^SPM-\d{2}-\d{2}$/', Rule::unique('actions', 'code')],
            'name' => ['nullable', 'string', 'max:255'],
        ]);
        $program = Program::query()->findOrFail((int) $data['program_id']);
        if (! str_starts_with($data['code'], $program->code.'-')) {
            throw ValidationException::withMessages([
                'code' => 'El código de la acción debe comenzar con el código del programa seleccionado.',
            ]);
        }
        $model = Action::create($data);
        AuditEvent::record($model, 'created', null, $model->toArray());

        return back()->with('success', 'Acción agregada.');
    }

    public function storeVoucherType(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'code' => ['required', 'alpha_dash:ascii', 'max:40', Rule::unique('storage_locations', 'code')],
            'name' => ['required', 'string', 'max:100'],
        ]);
        $model = StorageLocation::create([
            ...$data,
            'tracking_started_on' => MaterialTracking::START_DATE,
        ]);
        AuditEvent::record($model, 'created', null, $model->toArray());

        return back()->with('success', 'Tipo de vale agregado.');
    }

    public function updateVoucherType(Request $request, StorageLocation $voucherType): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);
        $before = $voucherType->toArray();
        $voucherType->update($data);
        AuditEvent::record($voucherType, 'updated', $before, $voucherType->fresh()->toArray());

        return back()->with('success', 'Tipo de vale actualizado.');
    }

    public function toggle(string $type, int $id): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $class = match ($type) {
            'materials' => Material::class,
            'people' => Person::class,
            'units' => Unit::class,
            'programs' => Program::class,
            'actions' => Action::class,
            'voucher-types' => StorageLocation::class,
            'destinations' => Destination::class,
            default => abort(404),
        };
        /** @var Model $model */
        $model = $class::query()->findOrFail($id);
        $before = $model->toArray();
        $model->update(['is_active' => ! $model->getAttribute('is_active')]);
        AuditEvent::record($model, 'status_changed', $before, $model->fresh()->toArray());

        return back()->with('success', 'Estado actualizado.');
    }

    public function merge(Request $request, string $type, int $source): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate(['target_id' => ['required', 'integer', 'different:source']]);
        if ((int) $data['target_id'] === $source) {
            throw ValidationException::withMessages(['target_id' => 'El destino debe ser un registro diferente.']);
        }
        if ($type === 'materials') {
            $this->mergeMaterials($source, (int) $data['target_id']);
        } elseif ($type === 'people') {
            $this->mergePeople($source, (int) $data['target_id']);
        } elseif ($type === 'destinations') {
            $this->mergeDestinations($source, (int) $data['target_id']);
        } else {
            abort(404);
        }

        return back()->with('success', 'Registros fusionados y referencias conservadas.');
    }

    private function mergeMaterials(int $sourceId, int $targetId): void
    {
        DB::transaction(function () use ($sourceId, $targetId): void {
            $source = Material::query()->with('aliases')->lockForUpdate()->findOrFail($sourceId);
            $target = Material::query()->lockForUpdate()->findOrFail($targetId);
            VoucherItem::query()->where('material_id', $source->id)->update(['material_id' => $target->id]);
            foreach ($source->aliases as $alias) {
                $existing = MaterialAlias::query()->where('normalized_alias', $alias->normalized_alias)->first();
                $existing && $existing->id !== $alias->id ? $alias->delete() : $alias->update(['material_id' => $target->id]);
            }
            MaterialAlias::firstOrCreate(
                ['normalized_alias' => $source->normalized_name],
                ['material_id' => $target->id, 'alias' => $source->name],
            );
            AuditEvent::record($target, 'merged_material', $source->toArray(), $target->toArray());
            $source->delete();
        });
    }

    private function mergePeople(int $sourceId, int $targetId): void
    {
        DB::transaction(function () use ($sourceId, $targetId): void {
            $source = Person::query()->with('aliases')->lockForUpdate()->findOrFail($sourceId);
            $target = Person::query()->lockForUpdate()->findOrFail($targetId);
            Voucher::query()->where('received_by_id', $source->id)->update(['received_by_id' => $target->id]);
            Voucher::query()->where('delivered_by_id', $source->id)->update(['delivered_by_id' => $target->id]);
            Voucher::query()->where('authorized_by_id', $source->id)->update(['authorized_by_id' => $target->id]);
            foreach ($source->aliases as $alias) {
                $existing = PersonAlias::query()->where('normalized_alias', $alias->normalized_alias)->first();
                $existing && $existing->id !== $alias->id ? $alias->delete() : $alias->update(['person_id' => $target->id]);
            }
            PersonAlias::firstOrCreate(
                ['normalized_alias' => $source->normalized_name],
                ['person_id' => $target->id, 'alias' => $source->name],
            );
            $target->update([
                'can_receive_material' => $target->can_receive_material || $source->can_receive_material,
                'can_deliver_material' => $target->can_deliver_material || $source->can_deliver_material,
                'can_authorize_material' => $target->can_authorize_material || $source->can_authorize_material,
            ]);
            AuditEvent::record($target, 'merged_person', $source->toArray(), $target->toArray());
            $source->delete();
        });
    }

    private function mergeDestinations(int $sourceId, int $targetId): void
    {
        DB::transaction(function () use ($sourceId, $targetId): void {
            $source = Destination::query()->with(['aliases', 'vouchers:id'])->lockForUpdate()->findOrFail($sourceId);
            $target = Destination::query()->lockForUpdate()->findOrFail($targetId);
            $target->vouchers()->syncWithoutDetaching($source->vouchers->modelKeys());
            foreach ($source->aliases as $alias) {
                $existing = DestinationAlias::query()->where('normalized_alias', $alias->normalized_alias)->first();
                $existing && $existing->id !== $alias->id ? $alias->delete() : $alias->update(['destination_id' => $target->id]);
            }
            DestinationAlias::firstOrCreate(
                ['normalized_alias' => $source->normalized_name],
                ['destination_id' => $target->id, 'alias' => $source->name],
            );
            AuditEvent::record($target, 'merged_destination', $source->toArray(), $target->toArray());
            $source->delete();
        });
    }
}
