<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Voucher;
use App\Support\MaterialTracking;
use App\Support\VoucherData;
use App\Support\VoucherSequence;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(
        VoucherSequence $voucherSequence,
    ): Response|RedirectResponse {
        if (request()->user()?->isTechnician()) {
            return redirect()->route('my-vouchers.index');
        }

        Gate::authorize('viewAny', Voucher::class);
        $trackingVouchers = Voucher::query()
            ->with(['location', 'receivedBy', 'destinations', 'items.material', 'items.unit', 'items.applications'])
            ->whereIn('status', VoucherStatus::operationalValues())
            ->where('direction', VoucherDirection::Exit->value)
            ->whereDate('issued_on', '>=', MaterialTracking::START_DATE)
            ->get();
        $recentVouchers = Voucher::query()
            ->with([
                'location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action', 'actionIndicator',
                'destinations', 'items.material', 'items.unit', 'items.applications',
            ])
            ->whereIn('status', VoucherStatus::operationalValues())
            ->whereDate('issued_on', '>=', MaterialTracking::START_DATE)
            ->orderByDesc('issued_on')
            ->orderByDesc('id')
            ->limit(8)
            ->get();

        $tracking = MaterialTracking::overview($trackingVouchers);
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
                'needs_review' => Voucher::query()
                    ->whereIn('status', VoucherStatus::operationalValues())
                    ->whereDate('issued_on', '>=', MaterialTracking::START_DATE)
                    ->where('needs_review', true)
                    ->count(),
                'technicians_with_pending' => $tracking['metrics']['technicians_with_pending'],
            ],
            'recent' => $recentVouchers->map(fn (Voucher $voucher): array => VoucherData::make($voucher))->values(),
            'oldest_pending' => $pendingItems->take(10)->values(),
            'voucher_sequence' => $voucherSequence->summary(),
        ]);
    }
}
