<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Voucher;
use App\Support\InventorySummary;
use App\Support\VoucherData;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        Gate::authorize('viewAny', Voucher::class);
        $vouchers = Voucher::query()
            ->with(['location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'items.material', 'items.unit', 'items.dispositions'])
            ->where('status', VoucherStatus::Active->value)
            ->orderByDesc('issued_on')
            ->get()
            ->map(fn (Voucher $voucher): array => VoucherData::make($voucher));

        $pendingItems = $vouchers
            ->where('direction', VoucherDirection::Exit->value)
            ->flatMap(fn (array $voucher) => collect(VoucherData::itemRows($voucher['items']))->map(fn (array $item) => [
                'voucher_id' => $voucher['id'],
                'folio' => $voucher['folio'],
                'location' => $voucher['location'],
                'issued_on' => $voucher['issued_on'],
                'received_by' => $voucher['received_by'],
                ...$item,
            ]))->filter(fn (array $item): bool => (float) $item['pending_quantity'] > 0)->values();
        $inventory = collect(InventorySummary::rows());

        return Inertia::render('dashboard', [
            'metrics' => [
                'pending_vouchers' => $vouchers->where('balance_state', 'pending')->count(),
                'pending_items' => $pendingItems->count(),
                'settled_vouchers' => $vouchers->where('balance_state', 'settled')->count(),
                'anomalies' => $vouchers->where('balance_state', 'anomaly')->count(),
                'needs_review' => $vouchers->where('needs_review', true)->count(),
                'negative_inventory' => $inventory->filter(fn (array $row): bool => (float) $row['available'] < 0)->count(),
            ],
            'recent' => $vouchers->take(8)->values(),
            'oldest_pending' => $pendingItems->sortBy('issued_on')->take(10)->values(),
            'negative_inventory' => $inventory->filter(fn (array $row): bool => (float) $row['available'] < 0)->take(10)->values(),
        ]);
    }
}
