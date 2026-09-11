<?php

namespace Tests\Feature;

use App\Enums\ServiceOrderType;
use App\Enums\VoucherStatus;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationAttachment;
use App\Models\MaterialApplicationReport;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherAttachment;
use App\Models\VoucherItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class VoucherSharingTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_an_administrator_can_generate_a_temporary_voucher_link(): void
    {
        $voucher = Voucher::factory()->create();
        $technician = User::factory()->technician($voucher->receivedBy)->create();

        $this->get(route('vouchers.share-link', $voucher))->assertRedirect(route('login'));
        $this->actingAs($technician)
            ->getJson(route('vouchers.share-link', $voucher))
            ->assertForbidden();

        $admin = User::factory()->create();
        $response = $this->actingAs($admin)
            ->getJson(route('vouchers.share-link', $voucher))
            ->assertOk()
            ->assertHeader('cache-control', 'no-store, private')
            ->assertJsonStructure(['url', 'expires_at']);

        $this->assertStringContainsString('/vales-compartidos/'.$voucher->id, $response->json('url'));
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_a_valid_link_shares_current_voucher_details_and_only_its_attachments(): void
    {
        Storage::fake('local');
        [$admin, $voucher, $attachment] = $this->voucherWithEvidence();
        $shareUrl = $this->shareUrl($admin, $voucher);
        auth()->logout();

        $response = $this->get($shareUrl)
            ->assertOk()
            ->assertHeader('cache-control', 'no-store, private')
            ->assertHeader('referrer-policy', 'no-referrer')
            ->assertHeader('x-robots-tag', 'noindex, nofollow, noarchive')
            ->assertInertia(fn (Assert $page) => $page
                ->component('shared-voucher/show')
                ->where('auth.user', null)
                ->where('voucher.folio', $voucher->folio)
                ->where('voucher.items.0.pending_quantity', '3.000')
                ->where('voucher.application_reports.0.service_order', 'OS-100')
                ->where('voucher.attachments.0.original_name', 'vale.jpg')
                ->missing('voucher.needs_review')
                ->missing('voucher.review_reasons')
                ->missing('voucher.permissions')
                ->missing('voucher.application_reports.0.attachment'));

        $page = $response->viewData('page');
        $sharedAttachment = $page['props']['voucher']['attachments'][0];

        $this->get($sharedAttachment['preview_url'])
            ->assertOk()
            ->assertHeader('content-disposition', 'inline; filename=vale.jpg')
            ->assertHeader('cache-control', 'no-store, private');
        $this->get($sharedAttachment['download_url'])->assertDownload('vale.jpg');

        $this->get(route('application-attachments.show', MaterialApplicationAttachment::query()->sole()))
            ->assertRedirect(route('login'));

        $otherVoucher = Voucher::factory()->create();
        Storage::disk('local')->put('voucher-attachments/other.jpg', 'other-image');
        $otherAttachment = $otherVoucher->attachments()->create([
            'disk' => 'local',
            'path' => 'voucher-attachments/other.jpg',
            'original_name' => 'other.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 11,
            'sha256' => str_repeat('b', 64),
            'uploaded_by' => $admin->id,
        ]);
        $foreignAttachmentUrl = URL::temporarySignedRoute(
            'shared-vouchers.attachments.preview',
            now()->addDay(),
            ['voucher' => $voucher, 'attachment' => $otherAttachment],
        );

        $this->get($foreignAttachmentUrl)->assertNotFound();
        $this->assertSame($attachment->id, VoucherAttachment::query()->where('voucher_id', $voucher->id)->sole()->id);
    }

    public function test_a_shared_link_rejects_tampering_and_expiration(): void
    {
        $admin = User::factory()->create();
        $voucher = Voucher::factory()->create();
        $shareUrl = $this->shareUrl($admin, $voucher);
        auth()->logout();

        $this->get($shareUrl.'&extra=altered')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page
                ->component('shared-voucher/unavailable')
                ->where('title', 'Enlace no disponible'));

        $this->travel(24)->hours();
        $this->travel(1)->second();

        $this->get($shareUrl)->assertForbidden();
    }

    public function test_links_can_be_generated_for_all_voucher_statuses_and_show_current_data(): void
    {
        $admin = User::factory()->create();
        $statuses = [VoucherStatus::Active, VoucherStatus::Cancelled, VoucherStatus::Loaned];

        foreach ($statuses as $status) {
            $voucher = Voucher::factory()->create(['status' => $status]);
            $url = $this->shareUrl($admin, $voucher);
            auth()->logout();

            $this->get($url)
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('shared-voucher/show')
                    ->where('voucher.status', $status->value));
        }

        $voucher = Voucher::factory()->create(['notes' => 'Dato original']);
        $url = $this->shareUrl($admin, $voucher);
        $voucher->update(['notes' => 'Dato corregido']);
        auth()->logout();

        $this->get($url)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('voucher.notes', 'Dato corregido'));
    }

    /** @return array{User, Voucher, VoucherAttachment} */
    private function voucherWithEvidence(): array
    {
        $admin = User::factory()->create();
        $voucher = Voucher::factory()->create([
            'folio' => 'COMP-100',
            'folio_key' => 'comp100',
            'needs_review' => true,
        ]);
        $item = VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'quantity' => 5,
        ]);
        $report = MaterialApplicationReport::create([
            'voucher_id' => $voucher->id,
            'occurred_on' => '2026-09-10',
            'reference' => 'OS-100',
            'service_order_type' => ServiceOrderType::Normal,
            'location' => 'Ubicación de aplicación',
            'notes' => 'Detalle de aplicación',
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);
        MaterialApplication::create([
            'voucher_item_id' => $item->id,
            'application_report_id' => $report->id,
            'occurred_on' => '2026-09-10',
            'quantity' => 2,
            'reference' => 'OS-100',
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);
        Storage::disk('local')->put('voucher-attachments/vale.jpg', 'voucher-image');
        $attachment = $voucher->attachments()->create([
            'disk' => 'local',
            'path' => 'voucher-attachments/vale.jpg',
            'original_name' => 'vale.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 13,
            'sha256' => str_repeat('a', 64),
            'uploaded_by' => $admin->id,
        ]);
        Storage::disk('local')->put('application-attachments/reporte.jpg', 'report-image');
        MaterialApplicationAttachment::create([
            'application_report_id' => $report->id,
            'disk' => 'local',
            'path' => 'application-attachments/reporte.jpg',
            'original_name' => 'reporte.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 12,
            'uploaded_by' => $admin->id,
        ]);

        return [$admin, $voucher, $attachment];
    }

    private function shareUrl(User $admin, Voucher $voucher): string
    {
        return $this->actingAs($admin)
            ->getJson(route('vouchers.share-link', $voucher))
            ->assertOk()
            ->json('url');
    }
}
