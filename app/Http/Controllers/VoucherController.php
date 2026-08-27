<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\Material;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\Voucher;
use App\Models\VoucherAttachment;
use App\Models\VoucherItem;
use App\Support\Normalizer;
use App\Support\VoucherData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
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
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Voucher::class);
        $query = Voucher::query()->with(['location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action', 'destinations', 'items.material', 'items.unit', 'items.applications']);

        if ($search = trim((string) $request->string('search'))) {
            $needle = '%'.mb_strtolower($search).'%';
            $query->where(function (Builder $query) use ($needle): void {
                $query->whereRaw('LOWER(folio) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(usage_description) LIKE ?', [$needle])
                    ->orWhereHas('destinations', fn (Builder $destination) => $destination->whereRaw('LOWER(name) LIKE ?', [$needle]))
                    ->orWhereRaw('LOWER(loaned_to_name) LIKE ?', [$needle])
                    ->orWhereHas('receivedBy', fn (Builder $person) => $person->whereRaw('LOWER(name) LIKE ?', [$needle]))
                    ->orWhereHas('items.material', fn (Builder $material) => $material->whereRaw('LOWER(name) LIKE ?', [$needle]));
            });
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
        if ($request->filled('voucher_type_id')) {
            $query->where('storage_location_id', $request->integer('voucher_type_id'));
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

        $vouchers = $query->orderByDesc('issued_on')->orderByDesc('id')->paginate(20)->withQueryString();
        $vouchers->through(fn (Voucher $voucher): array => VoucherData::make($voucher));

        return Inertia::render('vouchers/index', [
            'vouchers' => $vouchers,
            'filters' => $request->only(['search', 'from', 'to', 'received_by_id', 'voucher_type_id', 'direction', 'status']),
            'receivers' => Person::query()->where('can_receive_material', true)->orderBy('name')->get(['id', 'name']),
            'voucherTypes' => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'tracking_started_on']),
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', Voucher::class);

        return Inertia::render('vouchers/form', ['voucher' => null, ...$this->catalogData()]);
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

        return redirect()->route('vouchers.show', $voucher)->with('success', "Vale {$voucher->folio} capturado correctamente.");
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

        return redirect()->route('vouchers.show', $voucher)->with('success', "Folio {$voucher->folio} registrado como cancelado.");
    }

    public function show(Voucher $voucher): Response
    {
        Gate::authorize('view', $voucher);

        return Inertia::render('vouchers/show', ['voucher' => VoucherData::make($voucher, true)]);
    }

    public function edit(Voucher $voucher): Response
    {
        Gate::authorize('update', $voucher);
        abort_if($voucher->status === VoucherStatus::Cancelled, 422, 'Un vale cancelado no se puede editar.');

        return Inertia::render('vouchers/form', ['voucher' => VoucherData::make($voucher, true), ...$this->catalogData($voucher)]);
    }

    public function update(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);
        abort_if($voucher->status === VoucherStatus::Cancelled, 422, 'Un vale cancelado no se puede editar.');
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

        return redirect()->route('vouchers.show', $voucher)->with('success', 'Vale actualizado correctamente.');
    }

    public function cancel(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);
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

        return redirect()->route('vouchers.show', $voucher)->with('success', 'Vale cancelado.');
    }

    public function loan(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);
        abort_unless($voucher->status === VoucherStatus::Active, 422, 'Sólo un vale activo se puede marcar como prestado.');
        $data = $request->validate([
            'loaned_to_name' => ['required', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($voucher, $data, $request): void {
            $locked = Voucher::query()->lockForUpdate()->findOrFail($voucher->id);
            $before = $locked->toArray();
            $locked->update([
                'status' => VoucherStatus::Loaned,
                'loaned_to_name' => trim($data['loaned_to_name']),
                'loaned_on' => now()->toDateString(),
                'returned_on' => null,
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($locked, 'loaned', $before, $locked->fresh()->toArray());
        });

        return back()->with('success', 'El vale quedó marcado como prestado.');
    }

    public function returnLoan(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);
        abort_unless($voucher->status === VoucherStatus::Loaned, 422, 'Este vale no está marcado como prestado.');

        if (
            $voucher->direction === null
            || $voucher->received_by_id === null
            || $voucher->delivered_by_id === null
            || ($voucher->destinations()->doesntExist() && trim((string) $voucher->usage_description) === '')
            || ! $voucher->items()->exists()
        ) {
            throw ValidationException::withMessages([
                'loaned_to_name' => 'Completa el movimiento, las personas, el destino y los materiales antes de marcar el vale como devuelto.',
            ]);
        }

        DB::transaction(function () use ($voucher, $request): void {
            $locked = Voucher::query()->lockForUpdate()->findOrFail($voucher->id);
            $before = $locked->toArray();
            $locked->update([
                'status' => VoucherStatus::Active,
                'returned_on' => now()->toDateString(),
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($locked, 'returned', $before, $locked->fresh()->toArray());
        });

        return back()->with('success', 'El vale quedó marcado como devuelto.');
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

        return redirect()->route('vouchers.show', $voucher)->with('success', 'La revisión del vale quedó registrada.');
    }

    public function print(Voucher $voucher): View
    {
        Gate::authorize('view', $voucher);

        return view('vouchers.print', ['voucher' => VoucherData::make($voucher, true)]);
    }

    /** @return array<string, mixed> */
    private function catalogData(?Voucher $voucher = null): array
    {
        $programs = Program::query()->where('is_active', true);
        if ($voucher?->program_id !== null) {
            $programs->orWhere('id', $voucher->program_id);
        }
        $actions = Action::query()->with('program:id,code')->where('is_active', true);
        if ($voucher?->action_id !== null) {
            $actions->orWhere('id', $voucher->action_id);
        }
        $destinations = Destination::query()->where('is_active', true);
        if ($voucher !== null) {
            $destinations->orWhereIn('id', $voucher->destinations()->pluck('destinations.id'));
        }

        return [
            'materials' => Material::query()->with(['defaultUnit', 'voucherTypes:id,name,code'])->where('is_active', true)->orderBy('name')->get(),
            'units' => Unit::query()->where('is_active', true)->orderBy('name')->get(),
            'voucherTypes' => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(),
            'receivers' => $this->peopleForRole('can_receive_material', $voucher?->received_by_id),
            'deliverers' => $this->peopleForRole('can_deliver_material', $voucher?->delivered_by_id),
            'authorizers' => $this->peopleForRole('can_authorize_material', $voucher?->authorized_by_id),
            'programs' => $programs->orderBy('code')->get(),
            'actions' => $actions->orderBy('code')->get(),
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
        $usesProgramAndAction = $selectedVoucherType?->code === 'warehouse';
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
            'program_id' => $usesProgramAndAction
                ? ['nullable', 'integer', Rule::exists('programs', 'id')->where('is_active', true)]
                : ['exclude'],
            'action_id' => $usesProgramAndAction
                ? ['nullable', 'integer', Rule::exists('actions', 'id')->where('is_active', true)]
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
            'items.*.unit_id' => ['required', Rule::exists('units', 'id')->where('is_active', true)],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,3', 'max:999999999.999'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

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
        if (! $usesProgramAndAction) {
            $data['program_id'] = null;
            $data['action_id'] = null;
        } elseif (! empty($data['action_id'])) {
            $actionBelongsToProgram = ! empty($data['program_id'])
                && Action::query()->whereKey($data['action_id'])->where('program_id', $data['program_id'])->exists();
            if (! $actionBelongsToProgram) {
                throw ValidationException::withMessages([
                    'action_id' => 'Selecciona una acción que pertenezca al programa elegido.',
                ]);
            }
        }
        $data['folio'] = trim($data['folio']);

        return $data;
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
            if ((float) $row['quantity'] + 0.0001 < $accounted) {
                throw ValidationException::withMessages(['items' => "La cantidad de {$material->name} no puede ser menor a {$accounted}, que ya está comprobado."]);
            }
            $before = $item->exists ? $item->toArray() : null;
            $item->fill([
                'material_id' => $material->id,
                'unit_id' => $row['unit_id'],
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
