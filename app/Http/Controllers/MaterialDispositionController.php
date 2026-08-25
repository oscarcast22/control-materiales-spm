<?php

namespace App\Http\Controllers;

use App\Enums\DispositionType;
use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\AuditEvent;
use App\Models\MaterialDisposition;
use App\Models\VoucherItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MaterialDispositionController extends Controller
{
    public function store(Request $request, VoucherItem $item): RedirectResponse
    {
        $item->load('voucher');
        Gate::authorize('update', $item->voucher);
        abort_if($item->voucher->direction === VoucherDirection::Entry, 422, 'Las entradas independientes no generan comprobaciones ni devoluciones.');
        abort_if($item->voucher->status === VoucherStatus::Cancelled, 422, 'El vale está cancelado.');
        $data = $request->validate([
            'type' => ['required', Rule::enum(DispositionType::class)],
            'occurred_on' => ['required', 'date'],
            'quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,3', 'max:999999999.999'],
            'reference' => ['nullable', 'string', 'max:255'],
            'destination' => ['nullable', 'string', 'max:3000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        DB::transaction(function () use ($item, $data, $request): void {
            $locked = VoucherItem::query()->with('dispositions')->lockForUpdate()->findOrFail($item->id);
            $pending = (float) $locked->pendingQuantity();
            if ((float) $data['quantity'] > $pending + 0.0001) {
                throw ValidationException::withMessages([
                    'quantity' => "La cantidad supera el saldo pendiente de {$pending}.",
                ]);
            }
            $disposition = MaterialDisposition::create([
                ...$data,
                'voucher_item_id' => $locked->id,
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($disposition, 'created', null, $disposition->toArray());
        });

        return back()->with('success', $data['type'] === DispositionType::Return->value ? 'Devolución registrada.' : 'Aplicación registrada.');
    }

    public function void(Request $request, MaterialDisposition $disposition): RedirectResponse
    {
        $disposition->load('item.voucher');
        Gate::authorize('update', $disposition->item->voucher);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        DB::transaction(function () use ($disposition, $data, $request): void {
            $locked = MaterialDisposition::query()->lockForUpdate()->findOrFail($disposition->id);
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

        return back()->with('success', 'Movimiento anulado; el saldo fue recalculado.');
    }
}
