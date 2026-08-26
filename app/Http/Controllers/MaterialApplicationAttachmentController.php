<?php

namespace App\Http\Controllers;

use App\Models\MaterialApplicationAttachment;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MaterialApplicationAttachmentController extends Controller
{
    public function show(MaterialApplicationAttachment $attachment): StreamedResponse
    {
        $attachment->load('report.voucher');
        Gate::authorize('view', $attachment->report->voucher);
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name);
    }
}
