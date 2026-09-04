<?php

namespace App\Http\Controllers;

use App\Models\Action;
use App\Models\ActionIndicator;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\Unit;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\CatalogDeletion;
use App\Support\CatalogIndexData;
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
    public function index(Request $request, CatalogIndexData $catalogIndexData): Response
    {
        Gate::authorize('manage-catalogs');

        return Inertia::render('catalogs/index', $catalogIndexData->make($request));
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
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
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
                ...$this->statusAttributes($destination, $data),
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
            'is_active' => ['sometimes', 'boolean'],
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

        DB::transaction(function () use ($material, $data, $key, $request): void {
            $locked = Material::query()->lockForUpdate()->findOrFail($material->id);
            $before = [
                ...$locked->toArray(),
                'voucher_type_ids' => $locked->voucherTypes()->pluck('storage_locations.id')->all(),
            ];
            MaterialAlias::firstOrCreate(
                ['normalized_alias' => $locked->normalized_name],
                ['material_id' => $locked->id, 'alias' => $locked->name],
            );
            $locked->update([
                'name' => $data['name'],
                'default_unit_id' => $data['default_unit_id'],
                'normalized_name' => $key,
                'needs_review' => false,
                ...$this->statusAttributes($locked, $data),
            ]);
            $locked->voucherTypes()->sync($data['voucher_type_ids']);
            MaterialAlias::firstOrCreate(
                ['normalized_alias' => $key],
                ['material_id' => $locked->id, 'alias' => $data['name']],
            );

            VoucherItem::query()
                ->where('material_id', $locked->id)
                ->lockForUpdate()
                ->get()
                ->each(function (VoucherItem $item) use ($locked, $request): void {
                    if ($item->description_snapshot === $locked->name
                        && $item->unit_id === $locked->default_unit_id) {
                        return;
                    }

                    $itemBefore = $item->toArray();
                    $item->update([
                        'description_snapshot' => $locked->name,
                        'unit_id' => $locked->default_unit_id,
                        'updated_by' => $request->user()?->id,
                    ]);
                    AuditEvent::record($item, 'canonicalized', $itemBefore, $item->fresh()->toArray());
                });

            AuditEvent::record($locked, 'reviewed', $before, [
                ...$locked->fresh()->toArray(),
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
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (! $data['can_receive_material'] && ! $data['can_deliver_material'] && ! $data['can_authorize_material']) {
            throw ValidationException::withMessages(['name' => 'Selecciona al menos una función para la persona.']);
        }
        if ($person->account()->exists()
            && (! $data['can_receive_material'] || (array_key_exists('is_active', $data) && ! $data['is_active']))) {
            throw ValidationException::withMessages([
                'can_receive_material' => 'Conserva activa la función “Recibe / técnico” mientras exista una cuenta vinculada.',
            ]);
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
            $this->statusAttributes($person, $data);
            PersonAlias::firstOrCreate(
                ['normalized_alias' => $person->normalized_name],
                ['person_id' => $person->id, 'alias' => $person->name],
            );
            $person->update([
                ...$data,
                'normalized_name' => $key,
                'needs_review' => false,
            ]);
            $account = $person->account()->lockForUpdate()->first();
            if ($account !== null && $account->name !== $person->name) {
                $accountBefore = $account->only(['id', 'name', 'username', 'email', 'role', 'person_id', 'is_active']);
                $account->update(['name' => $person->name]);
                AuditEvent::record($account, 'technician_account_updated', $accountBefore, $account->fresh()->only([
                    'id', 'name', 'username', 'email', 'role', 'person_id', 'is_active',
                ]));
            }
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

    public function updateUnit(Request $request, Unit $unit): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'symbol' => ['required', 'string', 'max:20', Rule::unique('units', 'symbol')->ignore($unit)],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $before = $unit->toArray();
        $this->statusAttributes($unit, $data);
        $unit->update($data);
        AuditEvent::record($unit, 'updated', $before, $unit->fresh()->toArray());

        return back()->with('success', 'Unidad actualizada en todos los vales relacionados.');
    }

    public function updateAction(Request $request, Action $action): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['prohibited'],
            'program_id' => ['prohibited'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $before = $action->toArray();
        $action->update([
            'name' => trim($data['name']),
            ...$this->statusAttributes($action, $data),
        ]);
        AuditEvent::record($action, 'updated', $before, $action->fresh()->toArray());

        return back()->with('success', 'Acción actualizada.');
    }

    public function updateIndicator(Request $request, ActionIndicator $indicator): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['prohibited'],
            'action_id' => ['prohibited'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $before = $indicator->toArray();
        $indicator->update([
            'name' => trim($data['name']),
            ...$this->statusAttributes($indicator, $data),
        ]);
        AuditEvent::record($indicator, 'updated', $before, $indicator->fresh()->toArray());

        return back()->with('success', 'Indicador actualizado.');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, bool>
     */
    private function statusAttributes(Model $model, array $data): array
    {
        if (! array_key_exists('is_active', $data)) {
            return [];
        }

        $isActive = (bool) $data['is_active'];
        if ((bool) $model->getAttribute('is_active') && ! $isActive) {
            $this->ensureCanDeactivate($model);
        }

        return ['is_active' => $isActive];
    }

    public function toggle(string $type, int $id): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $class = match ($type) {
            'materials' => Material::class,
            'people' => Person::class,
            'units' => Unit::class,
            'actions' => Action::class,
            'indicators' => ActionIndicator::class,
            'destinations' => Destination::class,
            default => abort(404),
        };
        /** @var Model $model */
        $model = $class::query()->findOrFail($id);
        if ((bool) $model->getAttribute('is_active')) {
            $this->ensureCanDeactivate($model);
        }
        $before = $model->toArray();
        $model->update(['is_active' => ! $model->getAttribute('is_active')]);
        AuditEvent::record($model, 'status_changed', $before, $model->fresh()->toArray());

        return back()->with('success', 'Estado actualizado.');
    }

    public function destroy(string $type, int $id, CatalogDeletion $catalogDeletion): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $catalogDeletion->delete($type, $id);

        return back()->with('success', 'Registro eliminado.');
    }

    private function ensureCanDeactivate(Model $model): void
    {
        if ($model instanceof Unit) {
            $materials = $model->materials()->where('is_active', true)->count();
            if ($materials > 0) {
                throw ValidationException::withMessages([
                    'status' => "Esta unidad se usa en {$materials} materiales activos. Cambia primero la unidad de esos materiales.",
                ]);
            }
        }

        if ($model instanceof Person) {
            if ($model->account()->exists()) {
                throw ValidationException::withMessages([
                    'status' => 'No se puede desactivar una persona que tiene una cuenta técnica vinculada.',
                ]);
            }
            $requiredRoles = collect([
                'can_receive_material' => 'recibir material',
                'can_deliver_material' => 'entregar material',
                'can_authorize_material' => 'autorizar material',
            ])->filter(fn (string $label, string $column): bool => (bool) $model->getAttribute($column))
                ->filter(fn (string $label, string $column): bool => Person::query()
                    ->where('is_active', true)
                    ->where($column, true)
                    ->whereKeyNot($model->getKey())
                    ->doesntExist())
                ->values();

            if ($requiredRoles->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'status' => 'No se puede desactivar porque es la última persona disponible para '.$requiredRoles->join(', ', ' y ').'.',
                ]);
            }
        }

        if ($model instanceof Action) {
            $remainingActions = $model->program->actions()
                ->where('is_active', true)
                ->whereKeyNot($model->id)
                ->count();
            if ($remainingActions === 0) {
                throw ValidationException::withMessages([
                    'status' => 'No se puede desactivar la última acción disponible del programa SPM-06.',
                ]);
            }
        }

        if ($model instanceof ActionIndicator && $model->action->is_active) {
            $remainingIndicators = $model->action->indicators()
                ->where('is_active', true)
                ->whereKeyNot($model->id)
                ->count();
            if ($remainingIndicators === 0) {
                throw ValidationException::withMessages([
                    'status' => 'No se puede desactivar el último indicador disponible de una acción activa.',
                ]);
            }
        }
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
            $source = Person::query()->with(['aliases', 'account'])->lockForUpdate()->findOrFail($sourceId);
            $target = Person::query()->with('account')->lockForUpdate()->findOrFail($targetId);
            if ($source->account !== null && $target->account !== null) {
                throw ValidationException::withMessages([
                    'target_id' => 'No se pueden fusionar dos personas que ya tienen cuentas técnicas.',
                ]);
            }
            if ($source->account !== null && ! $target->is_active) {
                throw ValidationException::withMessages([
                    'target_id' => 'Activa primero a la persona destino para transferirle la cuenta técnica.',
                ]);
            }
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
            if ($source->account !== null) {
                $account = $source->account;
                $beforeAccount = $account->only(['id', 'name', 'username', 'email', 'role', 'person_id', 'is_active']);
                $account->update(['person_id' => $target->id, 'name' => $target->name]);
                AuditEvent::record($account, 'technician_account_transferred', $beforeAccount, $account->fresh()->only([
                    'id', 'name', 'username', 'email', 'role', 'person_id', 'is_active',
                ]));
            }
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
            $source->vouchers()->detach();
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
