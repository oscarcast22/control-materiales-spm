<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\VoucherAttachment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VoucherAttachmentController extends Controller
{
    public function show(VoucherAttachment $attachment): StreamedResponse
    {
        $attachment->load('voucher');
        Gate::authorize('view', $attachment->voucher);
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name);
    }

    public function preview(VoucherAttachment $attachment): StreamedResponse
    {
        $attachment->load('voucher');
        Gate::authorize('view', $attachment->voucher);
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->response(
            $attachment->path,
            $attachment->original_name,
            ['X-Content-Type-Options' => 'nosniff'],
            'inline',
        );
    }

    public function destroy(VoucherAttachment $attachment): RedirectResponse
    {
        $attachment->load('voucher');
        Gate::authorize('update', $attachment->voucher);
        AuditEvent::record($attachment, 'removed', $attachment->toArray(), null);
        Storage::disk($attachment->disk)->delete($attachment->path);
        $attachment->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Archivo eliminado.']);

        return back();
    }
}
