<?php

namespace App\Support;

use App\Models\Action;
use App\Models\Destination;
use App\Models\Material;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

final class CatalogIndexData
{
    public const DEFAULT_SECTION = 'people';

    /** @var list<string> */
    private const SECTIONS = ['people', 'materials', 'destinations', 'programs'];

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
                ? Unit::query()->orderBy('name')->get(['id', 'name', 'symbol', 'is_active'])
                : [],
            'voucherTypes' => fn () => $section === 'materials'
                ? StorageLocation::query()
                    ->whereIn('code', ['warehouse', 'yard'])
                    ->orderBy('name')
                    ->get(['id', 'name', 'code', 'tracking_started_on', 'is_active'])
                : [],
            'programOptions' => fn () => $section === 'programs'
                ? Program::query()->where('is_active', true)->orderBy('code')->get(['id', 'code', 'name', 'is_active'])
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
            ->withCount('aliases');

        $this->applyCommonFilters($query, $filters);
        $this->applyNormalizedSearch($query, $filters['search']);

        if ($filters['voucher_type_id'] !== '') {
            $query->whereHas(
                'voucherTypes',
                fn (Builder $voucherTypes): Builder => $voucherTypes->whereKey((int) $filters['voucher_type_id']),
            );
        }

        return $query->orderBy('name')->paginate(25)->withQueryString();
    }

    /** @param array<string, string> $filters */
    private function destinations(array $filters): mixed
    {
        $query = Destination::query()
            ->select(['id', 'name', 'is_active', 'needs_review'])
            ->withCount('aliases');

        $this->applyCommonFilters($query, $filters);
        $this->applyNormalizedSearch($query, $filters['search']);

        return $query->orderBy('name')->paginate(25)->withQueryString();
    }

    /** @param array<string, string> $filters */
    private function people(array $filters): mixed
    {
        $query = Person::query()
            ->select([
                'id', 'name', 'can_receive_material', 'can_deliver_material',
                'can_authorize_material', 'is_active', 'needs_review',
            ])
            ->withCount('aliases');

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

        return $query->orderBy('name')->paginate(25)->withQueryString();
    }

    /** @param array<string, string> $filters
     * @return array{programs: Collection<int, Program>, actions: Collection<int, Action>}
     */
    private function programs(array $filters): array
    {
        $programs = Program::query()
            ->select(['id', 'code', 'name', 'is_active'])
            ->withCount('actions');
        $actions = Action::query()
            ->select(['id', 'program_id', 'code', 'name', 'is_active'])
            ->with('program:id,code,name,is_active');

        if ($filters['status'] !== 'all') {
            $active = $filters['status'] === 'active';
            $programs->where('is_active', $active);
            $actions->where('is_active', $active);
        }
        if ($filters['search'] !== '') {
            $search = '%'.mb_strtolower($filters['search']).'%';
            $programs->where(fn (Builder $query): Builder => $query
                ->whereRaw('LOWER(code) LIKE ?', [$search])
                ->orWhereRaw('LOWER(COALESCE(name, \'\')) LIKE ?', [$search]));
            $actions->where(fn (Builder $query): Builder => $query
                ->whereRaw('LOWER(code) LIKE ?', [$search])
                ->orWhereRaw('LOWER(COALESCE(name, \'\')) LIKE ?', [$search]));
        }

        return [
            'programs' => $programs->orderBy('code')->get(),
            'actions' => $actions->orderBy('code')->get(),
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
                'label' => 'Programas y acciones',
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
