<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\InventoryAdjustment;
use App\Models\Material;
use App\Models\StorageLocation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventoryAdjustmentController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate([
            'storage_location_id' => ['required', Rule::exists('storage_locations', 'id')->where('is_active', true)],
            'material_id' => ['required', Rule::exists('materials', 'id')->where('is_active', true)],
            'unit_id' => ['required', Rule::exists('units', 'id')->where('is_active', true)],
            'occurred_on' => ['required', 'date'],
            'direction' => ['required', Rule::in(['increase', 'decrease'])],
            'quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,3', 'max:999999999.999'],
            'reason' => ['required', 'string', 'min:5', 'max:3000'],
        ]);
        $material = Material::query()->findOrFail((int) $data['material_id']);
        $location = StorageLocation::query()->findOrFail((int) $data['storage_location_id']);
        if ($location->tracking_started_on->greaterThan($data['occurred_on'])) {
            throw ValidationException::withMessages([
                'occurred_on' => "La fecha no puede ser anterior al inicio de control ({$location->tracking_started_on->format('d/m/Y')}).",
            ]);
        }

        $adjustment = InventoryAdjustment::create([
            'storage_location_id' => $data['storage_location_id'],
            'material_id' => $material->id,
            'unit_id' => $data['unit_id'],
            'occurred_on' => $data['occurred_on'],
            'quantity_delta' => $data['direction'] === 'increase' ? $data['quantity'] : -$data['quantity'],
            'reason' => trim($data['reason']),
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);
        AuditEvent::record($adjustment, 'created', null, $adjustment->toArray());

        return back()->with('success', 'Ajuste de inventario registrado.');
    }

    public function void(Request $request, InventoryAdjustment $adjustment): RedirectResponse
    {
        Gate::authorize('manage-catalogs');
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        DB::transaction(function () use ($adjustment, $data, $request): void {
            $locked = InventoryAdjustment::query()->lockForUpdate()->findOrFail($adjustment->id);
            if ($locked->voided_at) {
                return;
            }
            $before = $locked->toArray();
            $locked->update([
                'voided_at' => now(), 'voided_by' => $request->user()?->id,
                'void_reason' => $data['reason'], 'updated_by' => $request->user()?->id,
            ]);
            AuditEvent::record($locked, 'voided', $before, $locked->fresh()->toArray());
        });

        return back()->with('success', 'Ajuste anulado.');
    }
}
