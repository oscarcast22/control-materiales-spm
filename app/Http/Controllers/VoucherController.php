<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\ActionIndicator;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\Material;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Models\VoucherAttachment;
use App\Models\VoucherItem;
use App\Support\Normalizer;
use App\Support\VoucherData;
use App\Support\VoucherTypeScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;

class VoucherController extends Controller
{
    public function index(Request $request, VoucherTypeScope $voucherTypeScope): Response
    {
        Gate::authorize('viewAny', Voucher::class);
        $voucherTypeId = $voucherTypeScope->resolve($request);
        $query = Voucher::query()
            ->withCount('items')
            ->with(['location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action', 'actionIndicator', 'destinations', 'items.material', 'items.unit', 'items.applications']);

        if ($search = trim((string) $request->string('search'))) {
            $query->searchText($search);
        }
        if ($request->filled('from')) {
            $query->whereDate('issued_on', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('issued_on', '<=', $request->date('to'));
        }
        if ($request->filled('received_by_id')) {
            $query->where('received_by_id', $request->integer('received_by_id'));
        }
        if ($voucherTypeId !== null) {
            $query->where('storage_location_id', $voucherTypeId);
        }
        if ($request->filled('direction')) {
            $query->where('direction', $request->string('direction')->value());
        }

        $status = $request->string('status')->value();
        if ($status === 'cancelled') {
            $query->where('status', VoucherStatus::Cancelled->value);
        } elseif ($status === 'loaned') {
            $query->where('status', VoucherStatus::Loaned->value);
        } elseif ($status === 'review') {
            $query->where('needs_review', true);
        } elseif (in_array($status, ['pending', 'settled', 'anomaly'], true)) {
            $query->whereIn('status', VoucherStatus::operationalValues())->where('direction', VoucherDirection::Exit->value);
            $operator = $status === 'pending' ? '>' : ($status === 'anomaly' ? '<' : '!=');
            $method = $status === 'settled' ? 'whereDoesntHave' : 'whereHas';
            $query->{$method}('items', function (Builder $item) use ($operator): void {
                $item->whereRaw("quantity {$operator} (select COALESCE(SUM(quantity), 0) from material_applications where material_applications.voucher_item_id = voucher_items.id and voided_at is null)");
            });
        }

        $sort = in_array($request->string('sort')->value(), ['issued_on', 'folio', 'voucher_type', 'received_by', 'items_count'], true)
            ? $request->string('sort')->value()
            : 'folio';
        $sortDirection = $request->string('sort_direction')->value() === 'asc' ? 'asc' : 'desc';
        $this->applyVoucherOrder($query, $sort, $sortDirection);

        $vouchers = $query->orderBy('vouchers.id', $sortDirection)->paginate(20)->withQueryString();
        $vouchers->through(fn (Voucher $voucher): array => VoucherData::make($voucher));

        return Inertia::render('vouchers/index', [
            'vouchers' => $vouchers,
            'filters' => [
                ...$request->only(['search', 'from', 'to', 'received_by_id', 'direction', 'status']),
                'voucher_type_id' => $voucherTypeId,
                'sort' => $sort,
                'sort_direction' => $sortDirection,
            ],
            'receivers' => fn () => Person::query()->where('can_receive_material', true)->orderBy('name')->get(['id', 'name']),
            'voucherTypes' => fn () => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'tracking_started_on']),
        ]);
    }

    public function create(Request $request): Response|JsonResponse
    {
        Gate::authorize('create', Voucher::class);

        $data = ['voucher' => null, ...$this->catalogData()];

        return $request->expectsJson()
            ? response()->json($data)
            : Inertia::render('vouchers/form', $data);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Voucher::class);
        $data = $this->validateVoucher($request);
        $this->ensureUniqueFolio($data['folio'], (int) $data['storage_location_id']);

        $voucher = DB::transaction(function () use ($data, $request): Voucher {
            $destinationIds = $this->resolveDestinations($data);
            $voucher = Voucher::create([
                ...Arr::except($data, ['items', 'attachments', 'destination_ids', 'new_destinations']),
                'folio_key' => Normalizer::folio($data['folio']),
                'status' => VoucherStatus::Active,
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            $voucher->destinations()->sync($destinationIds);
            $this->syncItems($voucher, $data['items'], $request);
            AuditEvent::record($voucher, 'created', null, $this->voucherAuditData($voucher));

            return $voucher;
        });

        $this->storeAttachments($voucher, $request);

        return $this->mutationResponse($request, $voucher, "Vale {$voucher->folio} capturado correctamente.");
    }

    public function storeCancelled(Request $request): RedirectResponse
    {
        Gate::authorize('create', Voucher::class);
        $data = $request->validate([
            'voucher_type_id' => ['required', 'integer', Rule::exists('storage_locations', 'id')->where('is_active', true)],
            'folio' => ['required', 'string', 'max:50'],
            'issued_on' => ['required', 'date'],
            'cancellation_reason' => ['nullable', 'string', 'max:1000'],
        ]);
        $data['folio'] = trim($data['folio']);
        $this->ensureUniqueFolio($data['folio'], (int) $data['voucher_type_id']);

        $voucher = DB::transaction(function () use ($data, $request): Voucher {
            $voucher = Voucher::create([
                'storage_location_id' => $data['voucher_type_id'],
                'folio' => $data['folio'],
                'folio_key' => Normalizer::folio($data['folio']),
                'issued_on' => $data['issued_on'],
                'status' => VoucherStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $request->user()?->id,
                'cancellation_reason' => trim((string) ($data['cancellation_reason'] ?? ''))
                    ?: 'Folio cancelado para conservar la continuidad de la numeración.',
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($voucher, 'created_cancelled', null, $voucher->toArray());

            return $voucher;
        });

        return $this->mutationResponse($request, $voucher, "Folio {$voucher->folio} registrado como cancelado.");
    }

    public function storeLoaned(Request $request): RedirectResponse
    {
        Gate::authorize('create', Voucher::class);
        $data = $request->validate([
            'voucher_type_id' => ['required', 'integer', Rule::exists('storage_locations', 'id')->where('is_active', true)],
            'folio' => ['required', 'string', 'max:50'],
            'issued_on' => ['required', 'date'],
            'loaned_to_name' => ['nullable', 'string', 'max:255'],
        ]);
        $data['folio'] = trim($data['folio']);
        $this->ensureUniqueFolio($data['folio'], (int) $data['voucher_type_id']);

        $voucher = DB::transaction(function () use ($data, $request): Voucher {
            $voucher = Voucher::create([
                'storage_location_id' => $data['voucher_type_id'],
                'folio' => $data['folio'],
                'folio_key' => Normalizer::folio($data['folio']),
                'issued_on' => $data['issued_on'],
                'status' => VoucherStatus::Loaned,
                'loaned_to_name' => filled($data['loaned_to_name'] ?? null)
                    ? trim((string) $data['loaned_to_name'])
                    : null,
                'loaned_on' => $data['issued_on'],
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($voucher, 'created_loaned', null, $voucher->toArray());

            return $voucher;
        });

        return $this->mutationResponse($request, $voucher, "Folio {$voucher->folio} registrado como prestado.");
    }

    public function show(Request $request, Voucher $voucher): Response|JsonResponse
    {
        Gate::authorize('view', $voucher);
        $data = ['voucher' => VoucherData::make($voucher, true)];

        return $request->expectsJson()
            ? response()->json($data)
            : Inertia::render('vouchers/show', $data);
    }

    public function edit(Request $request, Voucher $voucher): Response|JsonResponse
    {
        Gate::authorize('update', $voucher);
        $data = $voucher->status === VoucherStatus::Active
            ? ['voucher' => VoucherData::make($voucher, true), ...$this->catalogData($voucher)]
            : ['voucher' => VoucherData::make($voucher, true), 'voucherTypes' => $this->voucherTypesForCorrection($voucher)];

        if ($request->expectsJson()) {
            return response()->json($data);
        }

        return Inertia::render(
            $voucher->status === VoucherStatus::Active ? 'vouchers/form' : 'vouchers/reference-form',
            $data,
        );
    }

    public function update(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);
        if ($voucher->status !== VoucherStatus::Active) {
            return $this->updateMinimalVoucher($request, $voucher);
        }
        $data = $this->validateVoucher($request, $voucher);
        $this->ensureUniqueFolio($data['folio'], (int) $data['storage_location_id'], $voucher);

        $hasMovements = $voucher->items()->whereHas('applications', fn (Builder $query) => $query->whereNull('voided_at'))->exists();
        if ($hasMovements && ($voucher->direction?->value !== $data['direction'] || $voucher->storage_location_id !== (int) $data['storage_location_id'])) {
            throw ValidationException::withMessages([
                'direction' => 'No se puede cambiar el tipo de vale o el movimiento cuando ya existen aplicaciones registradas.',
            ]);
        }

        DB::transaction(function () use ($voucher, $data, $request): void {
            $locked = Voucher::query()->with('destinations')->lockForUpdate()->findOrFail($voucher->id);
            $before = $this->voucherAuditData($locked);
            $destinationIds = $this->resolveDestinations($data);
            $locked->update([
                ...Arr::except($data, ['items', 'attachments', 'destination_ids', 'new_destinations']),
                'folio_key' => Normalizer::folio($data['folio']),
                'updated_by' => $request->user()?->id,
            ]);
            $locked->destinations()->sync($destinationIds);
            $this->syncItems($locked, $data['items'], $request);
            AuditEvent::record($locked, 'updated', $before, $this->voucherAuditData($locked));
        });

        $this->storeAttachments($voucher, $request);

        return $this->mutationResponse($request, $voucher, 'Vale actualizado correctamente.');
    }

    public function cancel(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);
        abort_unless($voucher->status === VoucherStatus::Active, 422, 'Sólo un vale activo se puede cancelar.');
        $validated = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        DB::transaction(function () use ($voucher, $validated, $request): void {
            $locked = Voucher::query()->with('items.applications')->lockForUpdate()->findOrFail($voucher->id);
            $hasAccounting = $locked->items->flatMap->applications->contains(fn ($row): bool => $row->voided_at === null);
            if ($hasAccounting) {
                throw ValidationException::withMessages(['reason' => 'No se puede cancelar un vale con aplicaciones activas.']);
            }
            $before = $locked->toArray();
            $locked->update([
                'status' => VoucherStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $request->user()?->id,
                'cancellation_reason' => $validated['reason'],
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($locked, 'cancelled', $before, $locked->fresh()->toArray());
        });

        return $this->mutationResponse($request, $voucher, 'Vale cancelado.');
    }

    public function review(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);

        DB::transaction(function () use ($voucher): void {
            $locked = Voucher::query()->lockForUpdate()->findOrFail($voucher->id);
            $before = $locked->toArray();
            $locked->update([
                'needs_review' => false,
                'updated_by' => auth()->id(),
            ]);
            AuditEvent::record($locked, 'reviewed', $before, $locked->fresh()->toArray());
        });

        return $this->mutationResponse($request, $voucher, 'La revisión del vale quedó registrada.');
    }

    public function print(Voucher $voucher): View
    {
        Gate::authorize('view', $voucher);

        return view('vouchers.print', ['voucher' => VoucherData::make($voucher, true)]);
    }

    private function updateMinimalVoucher(Request $request, Voucher $voucher): RedirectResponse
    {
        $data = $request->validate([
            'voucher_type_id' => ['required', 'integer', Rule::exists('storage_locations', 'id')->where(function ($query) use ($voucher): void {
                $query->where('is_active', true)->orWhere('id', $voucher->storage_location_id);
            })],
            'folio' => ['required', 'string', 'max:50'],
            'issued_on' => ['required', 'date'],
            'loaned_to_name' => $voucher->status === VoucherStatus::Loaned
                ? ['nullable', 'string', 'max:255']
                : ['prohibited'],
        ]);
        $data['folio'] = trim($data['folio']);
        $this->ensureUniqueFolio($data['folio'], (int) $data['voucher_type_id'], $voucher);

        DB::transaction(function () use ($voucher, $data, $request): void {
            $locked = Voucher::query()->lockForUpdate()->findOrFail($voucher->id);
            abort_if($locked->status === VoucherStatus::Active, 409, 'El estado del vale cambió; vuelve a abrir la edición.');
            $before = $locked->toArray();
            $values = [
                'storage_location_id' => (int) $data['voucher_type_id'],
                'folio' => $data['folio'],
                'folio_key' => Normalizer::folio($data['folio']),
                'issued_on' => $data['issued_on'],
                'updated_by' => $request->user()?->id,
            ];
            if ($locked->status === VoucherStatus::Loaned) {
                $values['loaned_to_name'] = filled($data['loaned_to_name'] ?? null)
                    ? trim((string) $data['loaned_to_name'])
                    : null;
                $values['loaned_on'] = $data['issued_on'];
            }
            $locked->update($values);
            AuditEvent::record($locked, 'updated_minimal', $before, $locked->fresh()->toArray());
        });

        return $this->mutationResponse($request, $voucher, "Folio {$data['folio']} corregido correctamente.");
    }

    /** @return Collection<int, StorageLocation> */
    private function voucherTypesForCorrection(Voucher $voucher): Collection
    {
        return StorageLocation::query()
            ->where('is_active', true)
            ->orWhere('id', $voucher->storage_location_id)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'tracking_started_on']);
    }

    /**
     * @param  Builder<Voucher>  $query
     * @param  'asc'|'desc'  $direction
     */
    private function applyVoucherOrder(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'folio') {
            if (DB::getDriverName() === 'pgsql') {
                $query->selectRaw("CASE WHEN folio_key ~ '^[0-9]+$' THEN 0 ELSE 1 END AS folio_is_non_numeric")
                    ->selectRaw("CASE WHEN folio_key ~ '^[0-9]+$' THEN CAST(folio_key AS NUMERIC) END AS folio_numeric_value");
            } else {
                $query->selectRaw("CASE WHEN folio_key <> '' AND folio_key NOT GLOB '*[^0-9]*' THEN 0 ELSE 1 END AS folio_is_non_numeric")
                    ->selectRaw("CASE WHEN folio_key <> '' AND folio_key NOT GLOB '*[^0-9]*' THEN CAST(folio_key AS INTEGER) END AS folio_numeric_value");
            }
            $query->orderBy('folio_is_non_numeric', $direction)
                ->orderBy('folio_numeric_value', $direction)
                ->orderBy('folio_key', $direction);

            return;
        }

        if ($sort === 'voucher_type') {
            $query->orderBy(
                StorageLocation::query()->select('name')->whereColumn('storage_locations.id', 'vouchers.storage_location_id'),
                $direction,
            );

            return;
        }

        if ($sort === 'received_by') {
            $query->orderBy(
                Person::query()->select('name')->whereColumn('people.id', 'vouchers.received_by_id'),
                $direction,
            );

            return;
        }

        $query->orderBy($sort === 'items_count' ? 'items_count' : 'issued_on', $direction);
    }

    private function mutationResponse(Request $request, Voucher $voucher, string $message): RedirectResponse
    {
        return $request->boolean('_dialog')
            ? back()->with('success', $message)
            : redirect()->route('vouchers.show', $voucher)->with('success', $message);
    }

    /** @return array<string, mixed> */
    private function catalogData(?Voucher $voucher = null): array
    {
        $programs = Program::query()->where('code', 'SPM-06')->where('is_active', true);
        if ($voucher?->program_id !== null) {
            $programs->orWhere('id', $voucher->program_id);
        }
        $fixedProgramId = Program::query()->where('code', 'SPM-06')->value('id');
        $actions = Action::query()
            ->with('program:id,code')
            ->where('program_id', $fixedProgramId)
            ->where('is_active', true);
        if ($voucher?->action_id !== null) {
            $actions->orWhere('id', $voucher->action_id);
        }
        $indicators = ActionIndicator::query()->where('is_active', true);
        if ($voucher?->action_indicator_id !== null) {
            $indicators->orWhere('id', $voucher->action_indicator_id);
        }
        $destinations = Destination::query()->where('is_active', true);
        if ($voucher !== null) {
            $destinations->orWhereIn('id', $voucher->destinations()->pluck('destinations.id'));
        }

        return [
            'materials' => Material::query()->with(['defaultUnit', 'voucherTypes:id,name,code'])->where('is_active', true)->orderBy('name')->get(),
            'voucherTypes' => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(),
            'receivers' => $this->peopleForRole('can_receive_material', $voucher?->received_by_id),
            'deliverers' => $this->peopleForRole('can_deliver_material', $voucher?->delivered_by_id),
            'authorizers' => $this->peopleForRole('can_authorize_material', $voucher?->authorized_by_id),
            'programs' => $programs->orderBy('code')->get(),
            'actions' => $actions->orderBy('code')->get(),
            'indicators' => $indicators->orderBy('code')->get(),
            'destinations' => $destinations
                ->with('aliases:id,destination_id,alias')
                ->orderBy('name')
                ->get(['id', 'name', 'is_active', 'needs_review']),
        ];
    }

    /** @return array<string, mixed> */
    private function validateVoucher(Request $request, ?Voucher $voucher = null): array
    {
        $updating = $voucher !== null;
        $currentDestinationIds = $voucher?->destinations()->pluck('destinations.id')->all() ?? [];
        $selectedVoucherType = StorageLocation::query()
            ->whereKey($request->input('voucher_type_id'))
            ->where('is_active', true)
            ->first();
        $usesClassification = $selectedVoucherType !== null
            && $request->input('direction') === VoucherDirection::Exit->value;
        $fixedProgram = $usesClassification
            ? Program::query()->where('code', 'SPM-06')->where('is_active', true)->first()
            : null;
        if ($usesClassification && $fixedProgram === null) {
            throw ValidationException::withMessages([
                'action_id' => 'El programa SPM-06 no está disponible. Revisa el catálogo antes de guardar.',
            ]);
        }
        $authorizers = $this->peopleForRole('can_authorize_material', $voucher?->authorized_by_id);
        if ($authorizers->isEmpty()) {
            throw ValidationException::withMessages([
                'authorized_by_id' => 'Configura al menos una persona que autorice material antes de guardar el vale.',
            ]);
        }
        $data = $request->validate([
            'voucher_type_id' => ['required', Rule::exists('storage_locations', 'id')->where('is_active', true)],
            'folio' => ['required', 'string', 'max:50'],
            'direction' => ['required', Rule::enum(VoucherDirection::class)],
            'issued_on' => ['required', 'date'],
            'received_by_id' => ['required', $this->personRoleRule('can_receive_material', $voucher?->received_by_id)],
            'delivered_by_id' => ['required', $this->personRoleRule('can_deliver_material', $voucher?->delivered_by_id)],
            'authorized_by_id' => [$authorizers->count() > 1 ? 'required' : 'nullable', $this->personRoleRule('can_authorize_material', $voucher?->authorized_by_id)],
            'program_id' => ['exclude'],
            'action_id' => $usesClassification
                ? ['nullable', 'integer', Rule::exists('actions', 'id')]
                : ['exclude'],
            'action_indicator_id' => $usesClassification
                ? ['nullable', 'integer', Rule::exists('action_indicators', 'id')]
                : ['exclude'],
            'destination_ids' => ['nullable', 'array', 'max:10'],
            'destination_ids.*' => ['required', 'integer', 'distinct', Rule::exists('destinations', 'id')->where(function ($query) use ($currentDestinationIds): void {
                $query->where('is_active', true);
                if ($currentDestinationIds !== []) {
                    $query->orWhereIn('id', $currentDestinationIds);
                }
            })],
            'new_destinations' => ['nullable', 'array', 'max:10'],
            'new_destinations.*' => ['required', 'string', 'max:255', 'distinct'],
            'usage_description' => ['nullable', 'string', 'max:3000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => [$updating ? 'nullable' : 'prohibited', 'integer'],
            'items.*.material_id' => ['required', Rule::exists('materials', 'id')->where('is_active', true)],
            'items.*.unit_id' => ['prohibited'],
            'items.*.quantity' => ['required', 'integer', 'gt:0', 'max:999999999'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ], $this->voucherValidationMessages());

        $eligibleMaterialIds = Material::query()
            ->whereHas('voucherTypes', fn (Builder $query) => $query->whereKey($data['voucher_type_id']))
            ->pluck('id')
            ->map(fn (int $id): int => $id)
            ->all();
        $materialErrors = [];
        foreach ($data['items'] as $index => $item) {
            if (! in_array((int) $item['material_id'], $eligibleMaterialIds, true)) {
                $materialErrors["items.{$index}.material_id"] = 'Este material no está disponible para el tipo de vale seleccionado.';
            }
        }
        if ($materialErrors !== []) {
            throw ValidationException::withMessages($materialErrors);
        }

        if ($usesClassification) {
            $actionId = isset($data['action_id']) ? (int) $data['action_id'] : null;
            $indicatorId = isset($data['action_indicator_id']) ? (int) $data['action_indicator_id'] : null;
            $keepsHistoricalClassification = $voucher !== null
                && $actionId === $voucher->action_id
                && $indicatorId === $voucher->action_indicator_id;

            if ($keepsHistoricalClassification) {
                $data['program_id'] = $voucher->program_id;
                $data['action_id'] = $voucher->action_id;
                $data['action_indicator_id'] = $voucher->action_indicator_id;
            } elseif ($actionId === null) {
                throw ValidationException::withMessages([
                    'action_id' => 'Selecciona la acción del vale.',
                ]);
            } else {
                $action = Action::query()
                    ->whereKey($actionId)
                    ->where('program_id', $fixedProgram->id)
                    ->where('is_active', true)
                    ->first();
                if ($action === null) {
                    throw ValidationException::withMessages([
                        'action_id' => 'Selecciona una acción activa del programa SPM-06.',
                    ]);
                }
                $indicators = $action->indicators()
                    ->where('is_active', true)
                    ->orderBy('code')
                    ->get();
                if ($indicators->isEmpty()) {
                    throw ValidationException::withMessages([
                        'action_id' => 'La acción seleccionada no tiene un indicador disponible.',
                    ]);
                }
                if ($indicators->count() === 1) {
                    $data['action_indicator_id'] = $indicators->firstOrFail()->id;
                } elseif ($indicatorId === null) {
                    throw ValidationException::withMessages([
                        'action_indicator_id' => 'Selecciona el indicador de la acción.',
                    ]);
                } elseif (! $indicators->contains('id', $indicatorId)) {
                    throw ValidationException::withMessages([
                        'action_indicator_id' => 'Selecciona un indicador que pertenezca a la acción elegida.',
                    ]);
                }
                $data['program_id'] = $fixedProgram->id;
            }
        }

        $data['destination_ids'] = array_values(array_map('intval', $data['destination_ids'] ?? []));
        $data['new_destinations'] = array_values(array_filter(array_map(
            fn (string $name): string => trim($name),
            $data['new_destinations'] ?? [],
        )));
        $normalizedNewDestinations = array_map(fn (string $name): string => Normalizer::key($name), $data['new_destinations']);
        if (count($normalizedNewDestinations) !== count(array_unique($normalizedNewDestinations))) {
            throw ValidationException::withMessages(['new_destinations' => 'La misma ubicación aparece más de una vez.']);
        }
        $data['usage_description'] = filled($data['usage_description'] ?? null)
            ? trim((string) $data['usage_description'])
            : null;
        if ($data['destination_ids'] === [] && $data['new_destinations'] === [] && $data['usage_description'] === null) {
            throw ValidationException::withMessages([
                'destination_ids' => 'Selecciona una ubicación o agrega una descripción de uso o actividad.',
            ]);
        }
        if (count($data['destination_ids']) + count($data['new_destinations']) > 10) {
            throw ValidationException::withMessages([
                'destination_ids' => 'Puedes asociar como máximo diez ubicaciones al mismo vale.',
            ]);
        }

        $data['storage_location_id'] = $data['voucher_type_id'];
        unset($data['voucher_type_id']);
        if ($authorizers->count() === 1) {
            $data['authorized_by_id'] = $authorizers->firstOrFail()->id;
        }
        if (! $usesClassification) {
            $data['program_id'] = null;
            $data['action_id'] = null;
            $data['action_indicator_id'] = null;
        }
        $data['folio'] = trim($data['folio']);

        return $data;
    }

    /** @return array<string, string> */
    private function voucherValidationMessages(): array
    {
        return [
            'voucher_type_id.required' => 'Selecciona el tipo de vale.',
            'voucher_type_id.exists' => 'El tipo de vale seleccionado no está disponible.',
            'folio.required' => 'Escribe el folio del vale.',
            'folio.string' => 'El folio debe contener texto válido.',
            'folio.max' => 'El folio no puede tener más de 50 caracteres.',
            'direction.required' => 'Selecciona si es una salida o una entrada.',
            'direction.enum' => 'Selecciona un movimiento válido.',
            'issued_on.required' => 'Indica la fecha del vale.',
            'issued_on.date' => 'Escribe una fecha válida.',
            'received_by_id.required' => 'Selecciona quién recibió el material.',
            'received_by_id.exists' => 'La persona que recibió el material ya no está disponible.',
            'delivered_by_id.required' => 'Selecciona quién entregó el material.',
            'delivered_by_id.exists' => 'La persona que entregó el material ya no está disponible.',
            'authorized_by_id.required' => 'Selecciona quién autorizó el material.',
            'authorized_by_id.exists' => 'La persona que autorizó el material ya no está disponible.',
            'action_id.required' => 'Selecciona la acción del vale.',
            'action_id.integer' => 'Selecciona una acción válida.',
            'action_id.exists' => 'La acción seleccionada ya no está disponible.',
            'action_indicator_id.integer' => 'Selecciona un indicador válido.',
            'action_indicator_id.exists' => 'El indicador seleccionado ya no está disponible.',
            'destination_ids.array' => 'Selecciona una ubicación válida.',
            'destination_ids.max' => 'Puedes asociar como máximo diez ubicaciones al mismo vale.',
            'destination_ids.*.required' => 'Selecciona una ubicación válida.',
            'destination_ids.*.integer' => 'La ubicación seleccionada no es válida. Vuelve a elegirla.',
            'destination_ids.*.distinct' => 'La misma ubicación está seleccionada más de una vez.',
            'destination_ids.*.exists' => 'La ubicación seleccionada ya no está disponible.',
            'new_destinations.array' => 'Escribe una ubicación válida.',
            'new_destinations.max' => 'Puedes asociar como máximo diez ubicaciones al mismo vale.',
            'new_destinations.*.required' => 'Escribe el nombre de la ubicación.',
            'new_destinations.*.string' => 'El nombre de la ubicación debe ser texto.',
            'new_destinations.*.max' => 'El nombre de la ubicación no puede tener más de 255 caracteres.',
            'new_destinations.*.distinct' => 'La misma ubicación aparece más de una vez.',
            'usage_description.string' => 'La descripción de uso debe ser texto.',
            'usage_description.max' => 'La descripción de uso no puede tener más de 3,000 caracteres.',
            'notes.string' => 'Las observaciones deben ser texto.',
            'notes.max' => 'Las observaciones no pueden tener más de 5,000 caracteres.',
            'items.required' => 'Agrega al menos un material.',
            'items.array' => 'Agrega materiales válidos.',
            'items.min' => 'Agrega al menos un material.',
            'items.*.id.prohibited' => 'Este material no se puede guardar en este vale.',
            'items.*.id.integer' => 'Este renglón del vale no es válido. Vuelve a agregar el material.',
            'items.*.material_id.required' => 'Selecciona el material.',
            'items.*.material_id.exists' => 'El material seleccionado ya no está disponible.',
            'items.*.unit_id.prohibited' => 'La unidad se toma automáticamente del material.',
            'items.*.quantity.required' => 'Escribe la cantidad.',
            'items.*.quantity.integer' => 'La cantidad debe ser un número entero.',
            'items.*.quantity.gt' => 'La cantidad debe ser mayor que cero.',
            'items.*.quantity.max' => 'La cantidad es demasiado grande.',
            'attachments.array' => 'Adjunta archivos válidos.',
            'attachments.max' => 'Puedes adjuntar como máximo cinco archivos.',
            'attachments.*.file' => 'Cada adjunto debe ser un archivo válido.',
            'attachments.*.mimes' => 'Adjunta una imagen JPG, PNG, WEBP o un archivo PDF.',
            'attachments.*.max' => 'Cada archivo puede pesar como máximo 10 MB.',
        ];
    }

    /** @param array<string, mixed> $data
     * @return list<int>
     */
    private function resolveDestinations(array $data): array
    {
        $ids = array_map('intval', $data['destination_ids'] ?? []);
        foreach ($data['new_destinations'] ?? [] as $name) {
            $key = Normalizer::key($name);
            $alias = DestinationAlias::query()->where('normalized_alias', $key)->first();
            $destination = $alias
                ? $alias->destination
                : Destination::query()->where('normalized_name', $key)->first();
            if ($destination && ! $destination->is_active) {
                throw ValidationException::withMessages([
                    'new_destinations' => "La ubicación {$destination->name} está inactiva; reactívala desde Catálogos.",
                ]);
            }
            if (! $destination) {
                $destination = Destination::create([
                    'name' => $name,
                    'normalized_name' => $key,
                ]);
                AuditEvent::record($destination, 'created_from_voucher', null, $destination->toArray());
            }
            $ids[] = $destination->id;
        }

        return array_values(array_unique($ids));
    }

    /** @return array<string, mixed> */
    private function voucherAuditData(Voucher $voucher): array
    {
        $voucher->load('destinations:id');

        return [
            ...$voucher->toArray(),
            'destination_ids' => $voucher->destinations->pluck('id')->all(),
        ];
    }

    /** @return Collection<int, Person> */
    private function peopleForRole(string $role, ?int $currentId = null): Collection
    {
        return Person::query()
            ->where(function (Builder $query) use ($role, $currentId): void {
                $query->where(function (Builder $eligible) use ($role): void {
                    $eligible->where('is_active', true)->where($role, true);
                });
                if ($currentId !== null) {
                    $query->orWhere('id', $currentId);
                }
            })
            ->orderBy('name')
            ->get();
    }

    private function personRoleRule(string $role, ?int $currentId = null): Exists
    {
        return Rule::exists('people', 'id')->where(function ($query) use ($role, $currentId): void {
            $query->where(function ($eligible) use ($role): void {
                $eligible->where('is_active', true)->where($role, true);
            });
            if ($currentId !== null) {
                $query->orWhere('id', $currentId);
            }
        });
    }

    private function ensureUniqueFolio(string $folio, int $locationId, ?Voucher $except = null): void
    {
        $query = Voucher::query()
            ->where('storage_location_id', $locationId)
            ->where('folio_key', Normalizer::folio($folio));
        if ($except) {
            $query->whereKeyNot($except->id);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages(['folio' => 'Ya existe un vale con ese folio.']);
        }
    }

    /** @param array<int, array<string, mixed>> $items */
    private function syncItems(Voucher $voucher, array $items, Request $request): void
    {
        $kept = [];
        foreach ($items as $row) {
            $material = Material::query()->findOrFail((int) $row['material_id']);
            $item = isset($row['id'])
                ? VoucherItem::query()->where('voucher_id', $voucher->id)->lockForUpdate()->findOrFail((int) $row['id'])
                : new VoucherItem;
            $accounted = $item->exists ? (float) $item->applications()->whereNull('voided_at')->sum('quantity') : 0.0;
            if ($accounted > 0.0 && $item->material_id !== $material->id) {
                throw ValidationException::withMessages([
                    'items' => "No se puede cambiar {$item->description_snapshot} porque ya tiene material aplicado. Anula primero las aplicaciones para corregirlo.",
                ]);
            }
            if ($accounted > 0.0 && abs((float) $row['quantity'] - (float) $item->quantity) > 0.0001) {
                throw ValidationException::withMessages([
                    'items' => "No se puede cambiar la cantidad de {$material->name} porque ya tiene material aplicado. Anula primero las aplicaciones para corregirla.",
                ]);
            }
            if ((float) $row['quantity'] + 0.0001 < $accounted) {
                throw ValidationException::withMessages(['items' => "La cantidad de {$material->name} no puede ser menor a {$accounted}, que ya está comprobado."]);
            }
            $before = $item->exists ? $item->toArray() : null;
            $item->fill([
                'material_id' => $material->id,
                'unit_id' => $material->default_unit_id,
                'description_snapshot' => $material->name,
                'quantity' => $row['quantity'],
                'created_by' => $item->created_by ?? $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            $voucher->items()->save($item);
            $kept[] = $item->id;
            AuditEvent::record($item, $before ? 'updated' : 'created', $before, $item->fresh()->toArray());
        }

        foreach ($voucher->items()->whereNotIn('id', $kept)->with('applications')->get() as $item) {
            if ($item->applications->whereNull('voided_at')->isNotEmpty()) {
                throw ValidationException::withMessages(['items' => 'No se puede quitar un material que ya tiene aplicaciones.']);
            }
            AuditEvent::record($item, 'removed', $item->toArray(), null);
            $item->delete();
        }
    }

    private function storeAttachments(Voucher $voucher, Request $request): void
    {
        foreach ($request->file('attachments', []) as $file) {
            $path = $file->store("vouchers/{$voucher->id}", 'local');
            $attachment = VoucherAttachment::create([
                'voucher_id' => $voucher->id,
                'disk' => 'local',
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'size' => $file->getSize(),
                'uploaded_by' => $request->user()?->id,
            ]);
            AuditEvent::record($attachment, 'uploaded', null, $attachment->toArray());
        }
    }
}
