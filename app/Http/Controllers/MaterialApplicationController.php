<?php

namespace App\Http\Controllers;

use App\Enums\ServiceOrderType;
use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\AuditEvent;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationAttachment;
use App\Models\MaterialApplicationReport;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\Normalizer;
use App\Support\QuantityPrecision;
use App\Support\VoucherData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Throwable;

class MaterialApplicationController extends Controller
{
    public function searchVouchers(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Voucher::class);
        $data = $request->validate(['search' => ['required', 'string', 'max:50']]);
        $search = trim($data['search']);

        if ($search === '') {
            return response()->json(['data' => []]);
        }

        $folioKey = Normalizer::folio($search);

        $vouchers = Voucher::query()
            ->with(['location', 'receivedBy', 'destinations', 'items.material', 'items.unit', 'items.applications'])
            ->whereIn('status', VoucherStatus::operationalValues())
            ->where('direction', VoucherDirection::Exit->value)
            ->searchFolioOrServiceOrder($search)
            ->whereHas('items', fn ($item) => $item->whereRaw(
                'quantity > (select COALESCE(SUM(quantity), 0) from material_applications where material_applications.voucher_item_id = voucher_items.id and voided_at is null)'
            ))
            ->orderByRaw('CASE WHEN folio_key = ? THEN 0 ELSE 1 END', [$folioKey])
            ->orderByDesc('issued_on')
            ->limit(8)
            ->get()
            ->map(fn (Voucher $voucher): array => [
                'id' => $voucher->id,
                'folio' => $voucher->folio,
                'issued_on' => $voucher->issued_on->format('Y-m-d'),
                'voucher_type' => $voucher->location->only(['id', 'name', 'code']),
                'received_by' => $voucher->receivedBy?->only(['id', 'name']),
                'destination_summary' => VoucherData::destinationSummary($voucher),
                'items' => $voucher->items
                    ->map(fn (VoucherItem $item): array => VoucherData::item($item))
                    ->filter(fn (array $item): bool => (float) $item['pending_quantity'] > 0)
                    ->values(),
            ]);

        return response()->json(['data' => $vouchers]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'voucher_id' => ['required', 'integer', 'exists:vouchers,id'],
            'occurred_on' => ['required', 'date'],
            'reference' => ['required', 'string', 'max:255'],
            'service_order_type' => ['required', Rule::enum(ServiceOrderType::class)],
            'location' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.voucher_item_id' => ['required', 'integer', 'distinct', 'exists:voucher_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:'.QuantityPrecision::MAX_VALUE],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ], $this->applicationValidationMessages());

        $user = $request->user();
        $voucher = Voucher::query()->visibleTo($user)->findOrFail((int) $data['voucher_id']);
        Gate::authorize('createApplication', $voucher);
        $file = $request->file('attachment');
        $storedPath = $file?->store('application-reports/'.now()->format('Y/m'), 'local');

        try {
            DB::transaction(function () use ($data, $request, $file, $storedPath, $user): void {
                $voucher = Voucher::query()->visibleTo($user)->lockForUpdate()->findOrFail((int) $data['voucher_id']);
                Gate::forUser($user)->authorize('createApplication', $voucher);
                if ($voucher->direction !== VoucherDirection::Exit || ! in_array($voucher->status->value, VoucherStatus::operationalValues(), true)) {
                    throw ValidationException::withMessages([
                        'voucher_id' => 'Sólo se pueden registrar aplicaciones en vales de salida activos.',
                    ]);
                }

                $itemIds = array_map(
                    fn (mixed $id): int => (int) $id,
                    array_column($data['items'], 'voucher_item_id'),
                );
                $items = VoucherItem::query()
                    ->with(['applications', 'unit'])
                    ->where('voucher_id', $voucher->id)
                    ->whereKey($itemIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                if ($items->count() !== count($itemIds)) {
                    throw ValidationException::withMessages([
                        'items' => 'Uno o más materiales no pertenecen al vale seleccionado.',
                    ]);
                }

                $report = MaterialApplicationReport::create([
                    'voucher_id' => $voucher->id,
                    'occurred_on' => $data['occurred_on'],
                    'reference' => trim((string) $data['reference']),
                    'service_order_type' => $data['service_order_type'],
                    'location' => filled($data['location'] ?? null) ? trim((string) $data['location']) : null,
                    'notes' => filled($data['notes'] ?? null) ? trim((string) $data['notes']) : null,
                    'created_by' => $request->user()?->id,
                    'updated_by' => $request->user()?->id,
                ]);
                AuditEvent::record($report, 'created', null, $report->toArray());

                foreach ($data['items'] as $index => $row) {
                    $item = $items->get((int) $row['voucher_item_id']);
                    if (! QuantityPrecision::accepts($row['quantity'], $item->unit->decimal_places)) {
                        throw ValidationException::withMessages([
                            "items.{$index}.quantity" => QuantityPrecision::message($item->unit),
                        ]);
                    }
                    $pending = (float) $item->pendingQuantity();
                    if ((float) $row['quantity'] > $pending + 0.0001) {
                        throw ValidationException::withMessages([
                            "items.{$index}.quantity" => "La cantidad supera el saldo pendiente de {$pending}.",
                        ]);
                    }

                    $application = MaterialApplication::create([
                        'voucher_item_id' => $item->id,
                        'application_report_id' => $report->id,
                        'occurred_on' => $data['occurred_on'],
                        'quantity' => $row['quantity'],
                        'reference' => $report->reference,
                        'destination_snapshot' => $report->location,
                        'created_by' => $request->user()?->id,
                        'updated_by' => $request->user()?->id,
                    ]);
                    AuditEvent::record($application, 'created', null, $application->toArray());
                }

                if ($file && $storedPath) {
                    $attachment = MaterialApplicationAttachment::create([
                        'application_report_id' => $report->id,
                        'disk' => 'local',
                        'path' => $storedPath,
                        'original_name' => $file->getClientOriginalName(),
                        'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                        'size' => $file->getSize(),
                        'uploaded_by' => $request->user()?->id,
                    ]);
                    AuditEvent::record($attachment, 'uploaded', null, $attachment->toArray());
                }
            });
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }

            throw $exception;
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => count($data['items']) === 1
                ? 'Aplicación registrada correctamente.'
                : 'Aplicaciones registradas correctamente.',
        ]);

        return back();
    }

    public function update(Request $request, MaterialApplicationReport $report): RedirectResponse
    {
        $report->load('voucher');
        Gate::authorize('update', $report);
        $data = $request->validate([
            'occurred_on' => ['required', 'date'],
            'reference' => ['required', 'string', 'max:255'],
            'service_order_type' => ['required', Rule::enum(ServiceOrderType::class)],
            'location' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'correction_reason' => ['required', 'string', 'min:5', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.voucher_item_id' => ['required', 'integer', 'distinct', 'exists:voucher_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gte:0', 'max:'.QuantityPrecision::MAX_VALUE],
        ], $this->applicationValidationMessages());

        $itemRows = VoucherData::itemRows($data['items'] ?? null);

        DB::transaction(function () use ($report, $data, $itemRows, $request): void {
            $lockedReport = MaterialApplicationReport::query()
                ->with('voucher')
                ->lockForUpdate()
                ->findOrFail($report->id);
            $voucher = $lockedReport->voucher;
            Gate::forUser($request->user())->authorize('update', $lockedReport);

            if ($voucher->direction !== VoucherDirection::Exit || $voucher->status !== VoucherStatus::Active) {
                throw ValidationException::withMessages([
                    'items' => 'Sólo se pueden corregir aplicaciones de vales de salida activos.',
                ]);
            }

            $itemIds = array_map(
                fn (mixed $id): int => (int) $id,
                array_column($itemRows, 'voucher_item_id'),
            );
            $items = VoucherItem::query()
                ->with('unit')
                ->where('voucher_id', $voucher->id)
                ->whereKey($itemIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($items->count() !== count($itemIds)) {
                throw ValidationException::withMessages([
                    'items' => 'Uno o más materiales no pertenecen a este vale.',
                ]);
            }

            $activeApplications = MaterialApplication::query()
                ->where('application_report_id', $lockedReport->id)
                ->whereNull('voided_at')
                ->lockForUpdate()
                ->get()
                ->keyBy('voucher_item_id');
            $reference = trim((string) $data['reference']);
            $location = filled($data['location'] ?? null) ? trim((string) $data['location']) : null;
            $notes = filled($data['notes'] ?? null) ? trim((string) $data['notes']) : null;
            $reason = trim((string) $data['correction_reason']);
            $beforeReport = $lockedReport->toArray();

            foreach ($itemRows as $index => $row) {
                $item = $items->get((int) $row['voucher_item_id']);
                $quantity = (float) $row['quantity'];
                $usedOutsideReport = (float) MaterialApplication::query()
                    ->where('voucher_item_id', $item->id)
                    ->whereNull('voided_at')
                    ->where(fn ($query) => $query
                        ->whereNull('application_report_id')
                        ->orWhere('application_report_id', '!=', $lockedReport->id))
                    ->sum('quantity');
                $available = (float) $item->quantity - $usedOutsideReport;

                if ($quantity > $available + 0.0001) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => "La cantidad supera el máximo disponible de {$available}.",
                    ]);
                }

                $currentCandidate = $activeApplications->get($item->id);
                $current = $currentCandidate instanceof MaterialApplication ? $currentCandidate : null;
                $quantityChanged = ! $current || abs((float) $current->quantity - $quantity) > 0.0001;

                if ($quantityChanged && ! QuantityPrecision::accepts($row['quantity'], $item->unit->decimal_places)) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => QuantityPrecision::message($item->unit),
                    ]);
                }

                if ($current && $quantityChanged) {
                    $before = $current->toArray();
                    $current->update([
                        'voided_at' => now(),
                        'voided_by' => $request->user()?->id,
                        'void_reason' => $reason,
                        'updated_by' => $request->user()?->id,
                    ]);
                    AuditEvent::record($current, 'voided_for_correction', $before, $current->fresh()->toArray());
                }

                if ($quantityChanged && $quantity > 0) {
                    $replacement = MaterialApplication::create([
                        'voucher_item_id' => $item->id,
                        'application_report_id' => $lockedReport->id,
                        'occurred_on' => $data['occurred_on'],
                        'quantity' => $quantity,
                        'reference' => $reference,
                        'destination_snapshot' => $location,
                        'created_by' => $request->user()?->id,
                        'updated_by' => $request->user()?->id,
                    ]);
                    AuditEvent::record($replacement, 'created_as_correction', null, [
                        ...$replacement->toArray(),
                        'correction_reason' => $reason,
                    ]);
                }

                if ($current && ! $quantityChanged &&
                    ($current->occurred_on->format('Y-m-d') !== $data['occurred_on'] ||
                        $current->reference !== $reference || $current->destination_snapshot !== $location)) {
                    $before = $current->toArray();
                    $current->update([
                        'occurred_on' => $data['occurred_on'],
                        'reference' => $reference,
                        'destination_snapshot' => $location,
                        'updated_by' => $request->user()?->id,
                    ]);
                    AuditEvent::record($current, 'corrected_metadata', $before, [
                        ...$current->fresh()->toArray(),
                        'correction_reason' => $reason,
                    ]);
                }
            }

            $lockedReport->update([
                'occurred_on' => $data['occurred_on'],
                'reference' => $reference,
                'service_order_type' => $data['service_order_type'],
                'location' => $location,
                'notes' => $notes,
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($lockedReport, 'corrected', $beforeReport, [
                ...$lockedReport->fresh()->toArray(),
                'correction_reason' => $reason,
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Aplicación corregida; el saldo fue recalculado.']);

        return back();
    }

    /** @return array<string, string> */
    private function applicationValidationMessages(): array
    {
        return [
            'service_order_type.required' => 'Selecciona el tipo de orden de servicio.',
            'service_order_type.enum' => 'Selecciona un tipo de orden de servicio válido.',
            'location.string' => 'La ubicación o dirección debe ser texto.',
            'location.max' => 'La ubicación o dirección no puede tener más de 500 caracteres.',
            'notes.string' => 'Los detalles deben ser texto.',
            'notes.max' => 'Los detalles no pueden tener más de 3,000 caracteres.',
            'items.*.quantity.required' => 'Escribe la cantidad aplicada.',
            'items.*.quantity.numeric' => 'La cantidad aplicada debe ser un número válido.',
            'items.*.quantity.gt' => 'La cantidad aplicada debe ser mayor que cero.',
            'items.*.quantity.gte' => 'La cantidad aplicada no puede ser negativa.',
            'items.*.quantity.max' => 'La cantidad aplicada es demasiado grande.',
        ];
    }

    public function void(Request $request, MaterialApplication $application): RedirectResponse
    {
        $application->load('item.voucher');
        Gate::authorize('void', $application);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        DB::transaction(function () use ($application, $data, $request): void {
            $locked = MaterialApplication::query()->lockForUpdate()->findOrFail($application->id);
            Gate::forUser($request->user())->authorize('void', $locked);
            if ($locked->voided_at) {
                return;
            }
            $before = $locked->toArray();
            $locked->update([
                'voided_at' => now(),
                'voided_by' => $request->user()?->id,
                'void_reason' => $data['reason'],
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($locked, 'voided', $before, $locked->fresh()->toArray());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Aplicación anulada; el saldo fue recalculado.']);

        return back();
    }
}
