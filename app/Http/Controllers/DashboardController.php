<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Support\MaterialTracking;
use App\Support\VoucherData;
use App\Support\VoucherSequence;
use App\Support\VoucherTypeScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        VoucherSequence $voucherSequence,
        VoucherTypeScope $voucherTypeScope,
    ): Response {
        Gate::authorize('viewAny', Voucher::class);
        $voucherTypeId = $voucherTypeScope->resolve($request);
        $vouchers = Voucher::query()
            ->with(['location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'destinations', 'items.material', 'items.unit', 'items.applications'])
            ->whereIn('status', VoucherStatus::operationalValues())
            ->whereDate('issued_on', '>=', MaterialTracking::START_DATE)
            ->when($voucherTypeId !== null, fn ($query) => $query->where('storage_location_id', $voucherTypeId))
            ->orderByDesc('issued_on')
            ->get();

        $tracking = MaterialTracking::make(
            $vouchers->filter(fn (Voucher $voucher): bool => $voucher->direction === VoucherDirection::Exit)->values(),
        );
        $pendingItems = collect($tracking['rows'])
            ->where('balance_state', 'pending')
            ->sortBy('issued_on')
            ->values();

        return Inertia::render('dashboard', [
            'metrics' => [
                'pending_vouchers' => $tracking['metrics']['pending_vouchers'],
                'pending_items' => $tracking['metrics']['pending_items'],
                'settled_vouchers' => $tracking['metrics']['settled_vouchers'],
                'anomalies' => $tracking['metrics']['anomalies'],
                'needs_review' => $vouchers->where('needs_review', true)->count(),
                'technicians_with_pending' => $tracking['metrics']['technicians_with_pending'],
            ],
            'recent' => $vouchers->take(8)->map(fn (Voucher $voucher): array => VoucherData::make($voucher))->values(),
            'oldest_pending' => $pendingItems->take(10)->values(),
            'voucher_sequence' => $voucherSequence->summary($voucherTypeId),
            'filters' => ['voucher_type_id' => $voucherTypeId],
            'voucherTypes' => fn () => StorageLocation::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'tracking_started_on']),
        ]);
    }
}
