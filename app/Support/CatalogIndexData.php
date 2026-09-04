<?php

namespace App\Support;

use App\Models\Action;
use App\Models\ActionIndicator;
use App\Models\Destination;
use App\Models\Material;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

final class CatalogIndexData
{
    public const DEFAULT_SECTION = 'people';

    /** @var list<string> */
    private const SECTIONS = ['people', 'materials', 'destinations', 'programs'];

    public function __construct(private CatalogDeletion $catalogDeletion) {}

    /** @return array<string, mixed> */
    public function make(Request $request): array
    {
        $section = $this->section($request);
        $filters = $this->filters($request, $section);

        return [
            'section' => $section,
            'filters' => $filters,
            'navigation' => fn (): array => $this->navigation(),
            'catalog' => fn (): mixed => $this->catalog($section, $filters),
            'units' => fn () => $section === 'materials'
                ? Unit::query()
                    ->withExists(['materials', 'voucherItems', 'inventoryAdjustments'])
                    ->orderBy('name')
                    ->get(['id', 'name', 'symbol', 'is_active'])
                    ->each(fn (Unit $unit) => $this->decorateDeletion($unit))
                : [],
            'voucherTypes' => fn () => $section === 'materials'
                ? StorageLocation::query()
                    ->whereIn('code', ['warehouse', 'yard'])
                    ->orderBy('name')
                    ->get(['id', 'name', 'code', 'tracking_started_on', 'is_active'])
                : [],
        ];
    }

    private function section(Request $request): string
    {
        $section = $request->string('section')->value();

        return in_array($section, self::SECTIONS, true)
            ? $section
            : self::DEFAULT_SECTION;
    }

    /** @return array<string, string> */
    private function filters(Request $request, string $section): array
    {
        $status = in_array($request->string('status')->value(), ['active', 'inactive'], true)
            ? $request->string('status')->value()
            : 'all';
        $review = $request->string('review')->value() === 'pending' ? 'pending' : 'all';
        $role = in_array($request->string('role')->value(), ['receive', 'deliver', 'authorize'], true)
            ? $request->string('role')->value()
            : 'all';
        $voucherTypeId = $request->filled('voucher_type_id')
            && StorageLocation::query()
                ->whereKey($request->integer('voucher_type_id'))
                ->whereIn('code', ['warehouse', 'yard'])
                ->exists()
                    ? (string) $request->integer('voucher_type_id')
                    : '';

        return [
            'search' => trim($request->string('search')->value()),
            'status' => $status,
            'review' => in_array($section, ['materials', 'destinations', 'people'], true) ? $review : 'all',
            'voucher_type_id' => $section === 'materials' ? $voucherTypeId : '',
            'role' => $section === 'people' ? $role : 'all',
        ];
    }

    /** @param array<string, string> $filters */
    private function catalog(string $section, array $filters): mixed
    {
        return match ($section) {
            'destinations' => $this->destinations($filters),
            'people' => $this->people($filters),
            'programs' => $this->programs($filters),
            default => $this->materials($filters),
        };
    }

    /** @param array<string, string> $filters */
    private function materials(array $filters): mixed
    {
        $query = Material::query()
            ->select(['id', 'name', 'default_unit_id', 'is_active', 'needs_review'])
            ->with([
                'defaultUnit:id,name,symbol,is_active',
                'voucherTypes:id,name,code',
            ])
            ->withCount('aliases')
            ->withExists(['voucherItems', 'inventoryAdjustments']);

        $this->applyCommonFilters($query, $filters);
        $this->applyNormalizedSearch($query, $filters['search']);

        if ($filters['voucher_type_id'] !== '') {
            $query->whereHas(
                'voucherTypes',
                fn (Builder $voucherTypes): Builder => $voucherTypes->whereKey((int) $filters['voucher_type_id']),
            );
        }

        return $query->orderBy('name')->paginate(25)->withQueryString()
            ->through(fn (Material $material) => $this->decorateDeletion($material));
    }

    /** @param array<string, string> $filters */
    private function destinations(array $filters): mixed
    {
        $query = Destination::query()
            ->select(['id', 'name', 'is_active', 'needs_review'])
            ->withCount('aliases')
            ->withExists('vouchers');

        $this->applyCommonFilters($query, $filters);
        $this->applyNormalizedSearch($query, $filters['search']);

        return $query->orderBy('name')->paginate(25)->withQueryString()
            ->through(fn (Destination $destination) => $this->decorateDeletion($destination));
    }

    /** @param array<string, string> $filters */
    private function people(array $filters): mixed
    {
        $query = Person::query()
            ->select([
                'id', 'name', 'can_receive_material', 'can_deliver_material',
                'can_authorize_material', 'is_active', 'needs_review',
            ])
            ->withCount('aliases')
            ->with('account:id,person_id,username,email,is_active')
            ->withExists(['receivedVouchers', 'deliveredVouchers', 'authorizedVouchers', 'account']);

        $this->applyCommonFilters($query, $filters);
        $this->applyNormalizedSearch($query, $filters['search']);

        $roleColumn = match ($filters['role']) {
            'receive' => 'can_receive_material',
            'deliver' => 'can_deliver_material',
            'authorize' => 'can_authorize_material',
            default => null,
        };
        if ($roleColumn !== null) {
            $query->where($roleColumn, true);
        }

        $activeRoleCounts = $this->activeRoleCounts();

        return $query->orderBy('name')->paginate(25)->withQueryString()
            ->through(fn (Person $person) => $this->decorateDeletion($person, $activeRoleCounts));
    }

    /** @param array<string, string> $filters
     * @return array{programs: Collection<int, Program>, actions: Collection<int, Action>, indicators: Collection<int, ActionIndicator>}
     */
    private function programs(array $filters): array
    {
        $programs = Program::query()
            ->select(['id', 'code', 'name', 'is_active'])
            ->where('code', 'SPM-06')
            ->withCount('actions')
            ->withExists(['actions', 'vouchers']);
        $actions = Action::query()
            ->select(['id', 'program_id', 'code', 'name', 'is_active'])
            ->whereHas('program', fn (Builder $query): Builder => $query->where('code', 'SPM-06'))
            ->with('program:id,code,name,is_active')
            ->withCount('indicators');
        $indicators = ActionIndicator::query()
            ->select(['id', 'action_id', 'code', 'name', 'is_active'])
            ->whereHas('action.program', fn (Builder $query): Builder => $query->where('code', 'SPM-06'))
            ->with('action:id,program_id,code,name,is_active');

        if ($filters['status'] !== 'all') {
            $active = $filters['status'] === 'active';
            $actions->where('is_active', $active);
            $indicators->where('is_active', $active);
        }
        if ($filters['search'] !== '') {
            $search = '%'.mb_strtolower($filters['search']).'%';
            $actions->where(fn (Builder $query): Builder => $query
                ->whereRaw('LOWER(code) LIKE ?', [$search])
                ->orWhereRaw('LOWER(COALESCE(name, \'\')) LIKE ?', [$search]));
            $indicators->where(fn (Builder $query): Builder => $query
                ->whereRaw('LOWER(code) LIKE ?', [$search])
                ->orWhereRaw('LOWER(name) LIKE ?', [$search]));
        }

        return [
            'programs' => $programs->orderBy('code')->get()
                ->values(),
            'actions' => $actions->orderBy('code')->get(),
            'indicators' => $indicators->orderBy('code')->get(),
        ];
    }

    /** @param array<string, int>|null $activeRoleCounts */
    private function decorateDeletion(Model $model, ?array $activeRoleCounts = null): Model
    {
        $model->setAttribute('deletion', $this->catalogDeletion->eligibility($model, $activeRoleCounts));

        return $model;
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

    /** @param Builder<*> $query
     * @param  array<string, string>  $filters
     */
    private function applyCommonFilters(Builder $query, array $filters): void
    {
        if ($filters['status'] !== 'all') {
            $query->where('is_active', $filters['status'] === 'active');
        }
        if ($filters['review'] === 'pending') {
            $query->where('needs_review', true);
        }
    }

    /** @param Builder<*> $query */
    private function applyNormalizedSearch(
        Builder $query,
        string $search,
    ): void {
        if ($search === '') {
            return;
        }

        $needle = '%'.Normalizer::key($search).'%';
        $query->where(function (Builder $searchQuery) use ($needle): void {
            $searchQuery
                ->where('normalized_name', 'like', $needle)
                ->orWhereHas('aliases', fn (Builder $aliases): Builder => $aliases
                    ->where('normalized_alias', 'like', $needle));
        });
    }

    /** @return list<array{key: string, label: string, total: int, pending_review: int, secondary_total?: int}> */
    private function navigation(): array
    {
        $materials = $this->reviewCounts(Material::query());
        $destinations = $this->reviewCounts(Destination::query());
        $people = $this->reviewCounts(Person::query());

        return [
            ['key' => 'people', 'label' => 'Personas', ...$people],
            ['key' => 'materials', 'label' => 'Materiales', ...$materials],
            ['key' => 'destinations', 'label' => 'Ubicaciones', ...$destinations],
            [
                'key' => 'programs',
                'label' => 'Programa, acciones e indicadores',
                'total' => Program::query()->count(),
                'pending_review' => 0,
                'secondary_total' => Action::query()->count(),
            ],
        ];
    }

    /** @param Builder<*> $query
     * @return array{total: int, pending_review: int}
     */
    private function reviewCounts(Builder $query): array
    {
        $counts = $query
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN needs_review = ? THEN 1 ELSE 0 END) as pending_review', [true])
            ->firstOrFail();

        return [
            'total' => (int) $counts->getAttribute('total'),
            'pending_review' => (int) $counts->getAttribute('pending_review'),
        ];
    }
}
