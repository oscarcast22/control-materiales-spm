<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\AuditEvent;
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
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;

class VoucherController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Voucher::class);
        $query = Voucher::query()->with(['location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action', 'items.material', 'items.unit', 'items.applications']);

        if ($search = trim((string) $request->string('search'))) {
            $needle = '%'.mb_strtolower($search).'%';
            $query->where(function (Builder $query) use ($needle): void {
                $query->whereRaw('LOWER(folio) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(destination) LIKE ?', [$needle])
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
        if ($request->filled('storage_location_id')) {
            $query->where('storage_location_id', $request->integer('storage_location_id'));
        }
        if ($request->filled('direction')) {
            $query->where('direction', $request->string('direction')->value());
        }

        $status = $request->string('status')->value();
        if ($status === 'cancelled') {
            $query->where('status', VoucherStatus::Cancelled->value);
        } elseif ($status === 'review') {
            $query->where('needs_review', true);
        } elseif (in_array($status, ['pending', 'settled', 'anomaly'], true)) {
            $query->where('status', VoucherStatus::Active->value)->where('direction', VoucherDirection::Exit->value);
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
            'filters' => $request->only(['search', 'from', 'to', 'received_by_id', 'storage_location_id', 'direction', 'status']),
            'receivers' => Person::query()->where('can_receive_material', true)->orderBy('name')->get(['id', 'name']),
            'locations' => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
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
            $voucher = Voucher::create([
                ...Arr::except($data, ['items', 'attachments']),
                'folio_key' => Normalizer::folio($data['folio']),
                'status' => VoucherStatus::Active,
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            $this->syncItems($voucher, $data['items'], $request);
            AuditEvent::record($voucher, 'created', null, $voucher->fresh()->toArray());

            return $voucher;
        });

        $this->storeAttachments($voucher, $request);

        return redirect()->route('vouchers.show', $voucher)->with('success', "Vale {$voucher->folio} capturado correctamente.");
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

        return Inertia::render('vouchers/form', ['voucher' => VoucherData::make($voucher, true), ...$this->catalogData()]);
    }

    public function update(Request $request, Voucher $voucher): RedirectResponse
    {
        Gate::authorize('update', $voucher);
        abort_if($voucher->status === VoucherStatus::Cancelled, 422, 'Un vale cancelado no se puede editar.');
        $data = $this->validateVoucher($request, true);
        $this->ensureUniqueFolio($data['folio'], (int) $data['storage_location_id'], $voucher);

        $hasMovements = $voucher->items()->whereHas('applications', fn (Builder $query) => $query->whereNull('voided_at'))->exists();
        if ($hasMovements && ($voucher->direction->value !== $data['direction'] || $voucher->storage_location_id !== (int) $data['storage_location_id'])) {
            throw ValidationException::withMessages([
                'direction' => 'No se puede cambiar el área o el tipo de un vale que ya tiene aplicaciones registradas.',
            ]);
        }

        DB::transaction(function () use ($voucher, $data, $request): void {
            $locked = Voucher::query()->lockForUpdate()->findOrFail($voucher->id);
            $before = $locked->toArray();
            $locked->update([
                ...Arr::except($data, ['items', 'attachments']),
                'folio_key' => Normalizer::folio($data['folio']),
                'updated_by' => $request->user()?->id,
            ]);
            $this->syncItems($locked, $data['items'], $request);
            AuditEvent::record($locked, 'updated', $before, $locked->fresh()->toArray());
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
    private function catalogData(): array
    {
        return [
            'materials' => Material::query()->with('defaultUnit')->where('is_active', true)->orderBy('name')->get(),
            'units' => Unit::query()->where('is_active', true)->orderBy('name')->get(),
            'locations' => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(),
            'receivers' => Person::query()->where('is_active', true)->where('can_receive_material', true)->orderBy('name')->get(),
            'deliverers' => Person::query()->where('is_active', true)->where('can_deliver_material', true)->orderBy('name')->get(),
            'authorizers' => Person::query()->where('is_active', true)->orderBy('name')->get(),
            'programs' => Program::query()->with(['actions' => fn ($query) => $query->where('is_active', true)->orderBy('code')])->where('is_active', true)->orderBy('code')->get(),
        ];
    }

    /** @return array<string, mixed> */
    private function validateVoucher(Request $request, bool $updating = false): array
    {
        $data = $request->validate([
            'storage_location_id' => ['required', Rule::exists('storage_locations', 'id')->where('is_active', true)],
            'folio' => ['required', 'string', 'max:50'],
            'direction' => ['required', Rule::enum(VoucherDirection::class)],
            'reference' => ['nullable', 'string', 'max:255'],
            'issued_on' => ['required', 'date'],
            'issued_time' => ['nullable', 'date_format:H:i'],
            'received_by_id' => ['required', Rule::exists('people', 'id')->where('can_receive_material', true)->where('is_active', true)],
            'delivered_by_id' => ['required', Rule::exists('people', 'id')->where('can_deliver_material', true)->where('is_active', true)],
            'authorized_by_id' => ['nullable', Rule::exists('people', 'id')->where('is_active', true)],
            'program_id' => ['nullable', Rule::exists('programs', 'id')->where('is_active', true)],
            'action_id' => ['nullable', 'exists:actions,id'],
            'destination' => ['required', 'string', 'max:3000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => [$updating ? 'nullable' : 'prohibited', 'integer'],
            'items.*.material_id' => ['required', Rule::exists('materials', 'id')->where('is_active', true)],
            'items.*.unit_id' => ['required', Rule::exists('units', 'id')->where('is_active', true)],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,3', 'max:999999999.999'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $data['folio'] = trim($data['folio']);
        $data['destination'] = trim($data['destination']);

        if (! empty($data['action_id']) && ! Action::query()->whereKey($data['action_id'])->where('program_id', $data['program_id'])->exists()) {
            throw ValidationException::withMessages(['action_id' => 'La acción no pertenece al programa seleccionado.']);
        }

        return $data;
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
