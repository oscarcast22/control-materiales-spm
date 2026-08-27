<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Voucher;
use App\Support\MaterialTracking;
use App\Support\VoucherData;
use App\Support\VoucherSequence;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(VoucherSequence $voucherSequence): Response
    {
        Gate::authorize('viewAny', Voucher::class);
        $vouchers = Voucher::query()
            ->with(['location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'destinations', 'items.material', 'items.unit', 'items.applications'])
            ->whereIn('status', VoucherStatus::operationalValues())
            ->whereDate('issued_on', '>=', MaterialTracking::START_DATE)
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
            'voucher_sequence' => $voucherSequence->summary(),
        ]);
    }
}
