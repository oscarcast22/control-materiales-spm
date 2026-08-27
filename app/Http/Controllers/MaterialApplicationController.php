<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\AuditEvent;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationAttachment;
use App\Models\MaterialApplicationReport;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\Normalizer;
use App\Support\VoucherData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class MaterialApplicationController extends Controller
{
    public function searchVouchers(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Voucher::class);
        $data = $request->validate(['search' => ['required', 'string', 'max:50']]);
        $folioKey = Normalizer::folio($data['search']);

        if ($folioKey === '') {
            return response()->json(['data' => []]);
        }

        $vouchers = Voucher::query()
            ->with(['location', 'receivedBy', 'destinations', 'items.material', 'items.unit', 'items.applications'])
            ->whereIn('status', VoucherStatus::operationalValues())
            ->where('direction', VoucherDirection::Exit->value)
            ->where('folio_key', 'like', "%{$folioKey}%")
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
            'reference' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.voucher_item_id' => ['required', 'integer', 'distinct', 'exists:voucher_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,3', 'max:999999999.999'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $voucher = Voucher::query()->findOrFail((int) $data['voucher_id']);
        Gate::authorize('update', $voucher);
        $file = $request->file('attachment');
        $storedPath = $file?->store('application-reports/'.now()->format('Y/m'), 'local');

        try {
            DB::transaction(function () use ($data, $request, $file, $storedPath): void {
                $voucher = Voucher::query()->with('destinations')->lockForUpdate()->findOrFail((int) $data['voucher_id']);
                if ($voucher->direction !== VoucherDirection::Exit || ! in_array($voucher->status->value, VoucherStatus::operationalValues(), true)) {
                    throw ValidationException::withMessages([
                        'voucher_id' => 'Sólo se pueden registrar aplicaciones en vales de salida activos o prestados.',
                    ]);
                }

                $itemIds = array_map(
                    fn (mixed $id): int => (int) $id,
                    array_column($data['items'], 'voucher_item_id'),
                );
                $items = VoucherItem::query()
                    ->with('applications')
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
                    'reference' => filled($data['reference'] ?? null) ? trim((string) $data['reference']) : null,
                    'created_by' => $request->user()?->id,
                    'updated_by' => $request->user()?->id,
                ]);
                AuditEvent::record($report, 'created', null, $report->toArray());

                foreach ($data['items'] as $index => $row) {
                    $item = $items->get((int) $row['voucher_item_id']);
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
                        'destination_snapshot' => VoucherData::destinationSummary($voucher),
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

        return back()->with('success', count($data['items']) === 1
            ? 'Aplicación registrada correctamente.'
            : 'Aplicaciones registradas correctamente.');
    }

    public function void(Request $request, MaterialApplication $application): RedirectResponse
    {
        $application->load('item.voucher');
        Gate::authorize('update', $application->item->voucher);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        DB::transaction(function () use ($application, $data, $request): void {
            $locked = MaterialApplication::query()->lockForUpdate()->findOrFail($application->id);
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

        return back()->with('success', 'Aplicación anulada; el saldo fue recalculado.');
    }
}
