<?php

namespace App\Http\Controllers;

use App\Models\Voucher;
use App\Models\VoucherAttachment;
use App\Support\SharedVoucherData;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SharedVoucherController extends Controller
{
    public function show(Request $request, Voucher $voucher): Response
    {
        $expiresAt = CarbonImmutable::createFromTimestamp((int) $request->query('expires'));
        $response = Inertia::render('shared-voucher/show', [
            'voucher' => SharedVoucherData::make($voucher, $expiresAt),
            'expiresAt' => $expiresAt->toIso8601String(),
        ])->toResponse($request);

        return $this->withPrivacyHeaders($response);
    }

    public function previewAttachment(Voucher $voucher, VoucherAttachment $attachment): StreamedResponse
    {
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->response(
            $attachment->path,
            $attachment->original_name,
            $this->privacyHeaders(),
            'inline',
        );
    }

    public function downloadAttachment(Voucher $voucher, VoucherAttachment $attachment): StreamedResponse
    {
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download(
            $attachment->path,
            $attachment->original_name,
            $this->privacyHeaders(),
        );
    }

    /** @return array<string, string> */
    private function privacyHeaders(): array
    {
        return [
            'Cache-Control' => 'no-store, private',
            'Referrer-Policy' => 'no-referrer',
            'X-Content-Type-Options' => 'nosniff',
            'X-Robots-Tag' => 'noindex, nofollow, noarchive',
        ];
    }

    private function withPrivacyHeaders(Response $response): Response
    {
        $response->headers->add($this->privacyHeaders());

        return $response;
    }
}
