<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\VoucherAttachment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
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

    public function destroy(VoucherAttachment $attachment): RedirectResponse
    {
        $attachment->load('voucher');
        Gate::authorize('update', $attachment->voucher);
        AuditEvent::record($attachment, 'removed', $attachment->toArray(), null);
        Storage::disk($attachment->disk)->delete($attachment->path);
        $attachment->delete();

        return back()->with('success', 'Archivo eliminado.');
    }
}
