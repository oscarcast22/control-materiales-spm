<?php

namespace App\Support;

use App\Models\Action;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\Material;
use App\Models\Person;
use App\Models\Program;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CatalogDeletion
{
    /**
     * @param  array<string, int>|null  $activeRoleCounts
     * @return array{can_delete: bool, blocked_reason: string|null}
     */
    public function eligibility(Model $model, ?array $activeRoleCounts = null): array
    {
        $reason = match (true) {
            $model instanceof Material => $this->materialReason($model),
            $model instanceof Unit => $this->unitReason($model),
            $model instanceof Person => $this->personReason($model, $activeRoleCounts),
            $model instanceof Destination => $this->destinationReason($model),
            $model instanceof Action => $this->actionReason($model),
            $model instanceof Program => $this->programReason($model),
            default => 'Este registro no se puede eliminar desde Catálogos.',
        };

        return ['can_delete' => $reason === null, 'blocked_reason' => $reason];
    }

    public function delete(string $type, int $id): void
    {
        DB::transaction(function () use ($type, $id): void {
            $model = $this->classFor($type)::query()->lockForUpdate()->findOrFail($id);
            $eligibility = $this->eligibility($model);

            if (! $eligibility['can_delete']) {
                throw ValidationException::withMessages(['delete' => $eligibility['blocked_reason']]);
            }

            AuditEvent::record($model, 'deleted', $this->snapshot($model), null);
            $model->delete();
        });
    }

    /** @return class-string<Model> */
    public function classFor(string $type): string
    {
        return match ($type) {
            'materials' => Material::class,
            'people' => Person::class,
            'units' => Unit::class,
            'programs' => Program::class,
            'actions' => Action::class,
            'destinations' => Destination::class,
            default => abort(404),
        };
    }

    private function materialReason(Material $material): ?string
    {
        if ($this->exists($material, 'voucherItems')) {
            return 'No se puede eliminar porque este material ya está asignado a un vale.';
        }

        return $this->exists($material, 'inventoryAdjustments')
            ? 'No se puede eliminar porque este material participa en un ajuste contable reservado.'
            : null;
    }

    private function unitReason(Unit $unit): ?string
    {
        if ($this->exists($unit, 'voucherItems')) {
            return 'No se puede eliminar porque esta unidad ya está asignada a un vale.';
        }
        if ($this->exists($unit, 'inventoryAdjustments')) {
            return 'No se puede eliminar porque esta unidad participa en un ajuste contable reservado.';
        }

        return $this->exists($unit, 'materials')
            ? 'No se puede eliminar porque todavía es la unidad habitual de un material.'
            : null;
    }

    /** @param array<string, int>|null $activeRoleCounts */
    private function personReason(Person $person, ?array $activeRoleCounts): ?string
    {
        if ($this->exists($person, 'receivedVouchers')
            || $this->exists($person, 'deliveredVouchers')
            || $this->exists($person, 'authorizedVouchers')) {
            return 'No se puede eliminar porque esta persona ya está asignada a un vale.';
        }
        if (! $person->is_active) {
            return null;
        }

        $counts = $activeRoleCounts ?? $this->activeRoleCounts();
        $roles = collect([
            'can_receive_material' => 'recibir material',
            'can_deliver_material' => 'entregar material',
            'can_authorize_material' => 'autorizar material',
        ])->filter(fn (string $label, string $column): bool => $person->{$column}
            && ($counts[$column] ?? 0) <= 1)->values();

        return $roles->isNotEmpty()
            ? 'No se puede eliminar porque es la última persona disponible para '.$roles->join(', ', ' y ').'.'
            : null;
    }

    private function destinationReason(Destination $destination): ?string
    {
        return $this->exists($destination, 'vouchers')
            ? 'No se puede eliminar porque esta ubicación ya está asignada a un vale.'
            : null;
    }

    private function actionReason(Action $action): ?string
    {
        return $this->exists($action, 'vouchers')
            ? 'No se puede eliminar porque esta acción ya está asignada a un vale.'
            : null;
    }

    private function programReason(Program $program): ?string
    {
        if ($this->exists($program, 'vouchers')) {
            return 'No se puede eliminar porque este programa ya está asignado a un vale.';
        }

        return $this->exists($program, 'actions')
            ? 'No se puede eliminar porque todavía contiene acciones. Elimínalas primero.'
            : null;
    }

    private function exists(Model $model, string $relation): bool
    {
        $attribute = Str::snake($relation).'_exists';

        if ($model->getAttribute($attribute) !== null) {
            return (bool) $model->getAttribute($attribute);
        }

        return $model->{$relation}()->exists();
    }

    /** @return array<string, int> */
    private function activeRoleCounts(): array
    {
        $counts = Person::query()
            ->where('is_active', true)
            ->selectRaw('SUM(CASE WHEN can_receive_material THEN 1 ELSE 0 END) as can_receive_material')
            ->selectRaw('SUM(CASE WHEN can_deliver_material THEN 1 ELSE 0 END) as can_deliver_material')
            ->selectRaw('SUM(CASE WHEN can_authorize_material THEN 1 ELSE 0 END) as can_authorize_material')
            ->firstOrFail();

        return [
            'can_receive_material' => (int) $counts->getAttribute('can_receive_material'),
            'can_deliver_material' => (int) $counts->getAttribute('can_deliver_material'),
            'can_authorize_material' => (int) $counts->getAttribute('can_authorize_material'),
        ];
    }

    /** @return array<string, mixed> */
    private function snapshot(Model $model): array
    {
        if ($model instanceof Material) {
            $model->load(['aliases', 'voucherTypes:id']);
        } elseif ($model instanceof Person || $model instanceof Destination) {
            $model->load('aliases');
        }

        return $model->toArray();
    }
}
