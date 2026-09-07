<?php

namespace App\Http\Controllers;

use App\Enums\VoucherStatus;
use App\Models\Voucher;
use App\Support\MaterialApplicationFormOptions;
use App\Support\VoucherData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MyVoucherController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->hasOperationalTechnicianAccess(), 404);
        $data = $request->validate([
            'tab' => ['nullable', Rule::in(['pending', 'history', 'settled'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $tab = ($data['tab'] ?? 'pending') === 'settled' ? 'history' : ($data['tab'] ?? 'pending');
        $search = trim((string) ($data['search'] ?? ''));
        $baseQuery = Voucher::query()->visibleTo($user);
        $pendingCount = (clone $baseQuery)->whereHas('items', fn (Builder $item) => $this->unsettled($item))->count();
        $settledCount = (clone $baseQuery)->whereDoesntHave('items', fn (Builder $item) => $this->unsettled($item))->count();
        $loanedCount = Voucher::query()
            ->visibleInTechnicianHistory($user)
            ->where('status', VoucherStatus::Loaned->value)
            ->count();

        $query = Voucher::query()
            ->when(
                $tab === 'history',
                fn (Builder $builder) => $builder->visibleInTechnicianHistory($user),
                fn (Builder $builder) => $builder->visibleTo($user),
            )
            ->withCount('items')
            ->with([
                'location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action', 'actionIndicator',
                'destinations', 'items.material', 'items.unit', 'items.applications',
            ]);
        if ($search !== '') {
            $query->searchText($search);
        }
        if ($tab === 'history') {
            $query->where(function (Builder $history): void {
                $history
                    ->where('status', VoucherStatus::Loaned->value)
                    ->orWhere(function (Builder $settled): void {
                        $settled
                            ->where('status', VoucherStatus::Active->value)
                            ->whereDoesntHave('items', fn (Builder $item) => $this->unsettled($item));
                    });
            });
        } else {
            $query->whereHas('items', fn (Builder $item) => $this->unsettled($item));
        }

        $vouchers = $query->orderBy('issued_on')->orderBy('id')->paginate(20)->withQueryString();
        $vouchers->through(fn (Voucher $voucher): array => VoucherData::make($voucher, false, $user));

        return Inertia::render('my-vouchers/index', [
            'vouchers' => $vouchers,
            'filters' => ['tab' => $tab, 'search' => $search],
            'counts' => ['pending' => $pendingCount, 'history' => $settledCount + $loanedCount],
        ]);
    }

    public function show(Request $request, int $voucher): Response
    {
        $user = $request->user();
        abort_unless($user?->hasOperationalTechnicianAccess(), 404);
        $model = Voucher::query()->visibleInTechnicianHistory($user)->findOrFail($voucher);
        Gate::authorize('view', $model);

        $belongsInHistory = $model->status === VoucherStatus::Loaned
            || ! $model->items()->whereRaw(
                'quantity != (select COALESCE(SUM(quantity), 0) from material_applications where material_applications.voucher_item_id = voucher_items.id and voided_at is null)'
            )->exists();

        return Inertia::render('vouchers/show', [
            'voucher' => VoucherData::make($model, true, $user),
            'applicationFormOptions' => MaterialApplicationFormOptions::make(),
            'backUrl' => route('my-vouchers.index', [
                'tab' => $belongsInHistory ? 'history' : 'pending',
            ]),
        ]);
    }

    /**
     * @param  Builder<Model>  $query
     * @return Builder<Model>
     */
    private function unsettled(Builder $query): Builder
    {
        return $query->whereRaw(
            'quantity != (select COALESCE(SUM(quantity), 0) from material_applications where material_applications.voucher_item_id = voucher_items.id and voided_at is null)'
        );
    }
}
