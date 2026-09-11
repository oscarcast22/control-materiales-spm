<?php

namespace App\Http\Controllers;

use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;

class VoucherShareLinkController extends Controller
{
    public function __invoke(Voucher $voucher): JsonResponse
    {
        Gate::authorize('share', $voucher);

        $expiresAt = now()->addHours(24);

        return response()
            ->json([
                'url' => URL::temporarySignedRoute('shared-vouchers.show', $expiresAt, ['voucher' => $voucher]),
                'expires_at' => $expiresAt->toIso8601String(),
            ])
            ->withHeaders([
                'Cache-Control' => 'no-store, private',
                'Referrer-Policy' => 'no-referrer',
                'X-Robots-Tag' => 'noindex, nofollow, noarchive',
            ]);
    }
}
