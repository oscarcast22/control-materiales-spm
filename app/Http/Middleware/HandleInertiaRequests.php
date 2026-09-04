<?php

namespace App\Http\Middleware;

use App\Models\Voucher;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'capabilities' => [
                'manage_catalogs' => fn (): bool => $request->user()?->can('manage-catalogs') ?? false,
                'view_reports' => fn (): bool => $request->user()?->can('view-reports') ?? false,
                'manage_accounts' => fn (): bool => $request->user()?->can('manage-accounts') ?? false,
                'manage_vouchers' => fn (): bool => $request->user()?->can('create', Voucher::class) ?? false,
                'view_my_vouchers' => fn (): bool => $request->user()?->hasOperationalTechnicianAccess() ?? false,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
