<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\MaterialApplicationAttachment;
use App\Models\MaterialApplicationReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MaterialApplicationAttachmentController extends Controller
{
    public function show(MaterialApplicationAttachment $attachment): StreamedResponse
    {
        $attachment->load('report.voucher');
        Gate::authorize('view', $attachment);
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name);
    }

    public function store(Request $request, MaterialApplicationReport $report): RedirectResponse
    {
        $report->load('voucher');
        Gate::authorize('replaceAttachment', $report);
        $data = $request->validate([
            'attachment' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);
        $file = $data['attachment'];
        $path = $file->store('application-reports/'.now()->format('Y/m'), 'local');

        try {
            $old = DB::transaction(function () use ($report, $request, $file, $path): ?MaterialApplicationAttachment {
                $locked = MaterialApplicationReport::query()->with('voucher')->lockForUpdate()->findOrFail($report->id);
                Gate::forUser($request->user())->authorize('replaceAttachment', $locked);
                $old = $locked->attachment()->first();
                $before = $old?->toArray();
                $old?->delete();
                $attachment = MaterialApplicationAttachment::create([
                    'application_report_id' => $locked->id,
                    'disk' => 'local',
                    'path' => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                    'size' => $file->getSize(),
                    'uploaded_by' => $request->user()?->id,
                ]);
                AuditEvent::record($attachment, $old ? 'replaced' : 'uploaded', $before, $attachment->toArray());

                return $old;
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }

        if ($old !== null) {
            Storage::disk($old->disk)->delete($old->path);
        }

        return back()->with('success', $old ? 'Evidencia reemplazada.' : 'Evidencia agregada.');
    }

    public function destroy(Request $request, MaterialApplicationReport $report): RedirectResponse
    {
        $report->load('voucher');
        Gate::authorize('removeAttachment', $report);
        $attachment = DB::transaction(function () use ($report, $request): MaterialApplicationAttachment {
            $locked = MaterialApplicationReport::query()->with('voucher')->lockForUpdate()->findOrFail($report->id);
            Gate::forUser($request->user())->authorize('removeAttachment', $locked);
            $attachment = $locked->attachment()->firstOrFail();
            AuditEvent::record($attachment, 'removed', $attachment->toArray(), null);
            $attachment->delete();

            return $attachment;
        });
        Storage::disk($attachment->disk)->delete($attachment->path);

        return back()->with('success', 'Evidencia retirada.');
    }
}
