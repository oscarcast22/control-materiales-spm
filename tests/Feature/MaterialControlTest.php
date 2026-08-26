<?php

namespace Tests\Feature;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Material;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationReport;
use App\Models\Person;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\VoucherData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

class MaterialControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_inactive_user_cannot_use_the_application(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_a_voucher_with_multiple_items_can_be_created_and_duplicate_folios_are_rejected(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $first, $second] = $this->catalogs();
        $location = StorageLocation::factory()->create();
        $payload = [
            'storage_location_id' => $location->id,
            'folio' => ' 001-A ',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-24',
            'issued_time' => '09:30',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination' => 'Colonia Centro',
            'notes' => 'Trabajo programado',
            'items' => [
                ['material_id' => $first->id, 'unit_id' => $unit->id, 'quantity' => 10],
                ['material_id' => $second->id, 'unit_id' => $unit->id, 'quantity' => 3.5],
            ],
        ];

        $response = $this->actingAs($user)->post(route('vouchers.store'), $payload);

        $voucher = Voucher::query()->sole();
        $response->assertRedirect(route('vouchers.show', $voucher));
        $this->assertSame('001-A', $voucher->folio);
        $this->assertSame(2, $voucher->items()->count());
        $this->assertDatabaseHas('audit_events', ['event' => 'created', 'auditable_type' => Voucher::class]);

        $this->actingAs($user)->from(route('vouchers.create'))->post(route('vouchers.store'), [
            ...$payload,
            'folio' => '001 a',
        ])->assertSessionHasErrors('folio');
        $this->assertSame(1, Voucher::query()->count());

        $otherLocation = StorageLocation::factory()->create();
        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'storage_location_id' => $otherLocation->id,
            'folio' => '001 a',
        ])->assertSessionHasNoErrors();
        $this->assertSame(2, Voucher::query()->count());
    }

    public function test_multiple_materials_can_be_applied_in_one_report_without_exceeding_their_balances(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $secondMaterial = Material::factory()->create(['default_unit_id' => $item->unit_id]);
        $secondItem = VoucherItem::factory()->create([
            'voucher_id' => $item->voucher_id,
            'material_id' => $secondMaterial->id,
            'unit_id' => $item->unit_id,
            'description_snapshot' => $secondMaterial->name,
            'quantity' => 3,
        ]);

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'reference' => 'Reporte 17',
            'items' => [
                ['voucher_item_id' => $item->id, 'quantity' => 6],
                ['voucher_item_id' => $secondItem->id, 'quantity' => 2],
            ],
        ])->assertSessionHasNoErrors();

        $item->refresh()->load('applications');
        $this->assertSame('6.000', $item->usedQuantity());
        $this->assertSame('4.000', $item->pendingQuantity());
        $this->assertSame('1.000', $secondItem->fresh()->pendingQuantity());
        $this->assertSame(1, MaterialApplicationReport::query()->count());
        $this->assertSame(2, MaterialApplication::query()->count());

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 4.001]],
        ])->assertSessionHasErrors('items.0.quantity');
        $this->assertSame(2, MaterialApplication::query()->count());
        $this->assertSame(1, MaterialApplicationReport::query()->count());

        $foreignItem = $this->voucherItem(1);
        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'items' => [
                ['voucher_item_id' => $item->id, 'quantity' => 1],
                ['voucher_item_id' => $foreignItem->id, 'quantity' => 1],
            ],
        ])->assertSessionHasErrors('items');
        $this->assertSame(2, MaterialApplication::query()->count());
        $this->assertSame(1, MaterialApplicationReport::query()->count());
    }

    public function test_voiding_an_application_recalculates_balance_and_is_audited(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $application = MaterialApplication::factory()->create([
            'voucher_item_id' => $item->id,
            'quantity' => 4,
        ]);

        $this->actingAs($user)->post(route('applications.void', $application), [
            'reason' => 'Captura duplicada',
        ])->assertSessionHasNoErrors();

        $this->assertNotNull($application->fresh()->voided_at);
        $this->assertSame('10.000', $item->fresh()->pendingQuantity());
        $this->assertDatabaseHas('audit_events', [
            'event' => 'voided',
            'auditable_type' => MaterialApplication::class,
            'auditable_id' => $application->id,
        ]);
    }

    public function test_a_voucher_with_active_movements_cannot_be_cancelled(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        MaterialApplication::factory()->create(['voucher_item_id' => $item->id, 'quantity' => 1]);

        $this->actingAs($user)->post(route('vouchers.cancel', $item->voucher), [
            'reason' => 'El vale ya no corresponde',
        ])->assertSessionHasErrors('reason');

        $this->assertSame(VoucherStatus::Active, $item->voucher->fresh()->status);
    }

    public function test_voucher_attachments_are_private_and_downloadable_only_after_authentication(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $location = StorageLocation::factory()->create();

        $this->actingAs($user)->post(route('vouchers.store'), [
            'storage_location_id' => $location->id,
            'folio' => 'ADJ-1',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-24',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination' => 'Taller municipal',
            'items' => [['material_id' => $material->id, 'unit_id' => $unit->id, 'quantity' => 2]],
            'attachments' => [UploadedFile::fake()->create('vale.pdf', 100, 'application/pdf')],
        ])->assertSessionHasNoErrors();

        $attachment = Voucher::query()->sole()->attachments()->sole();
        Storage::disk('local')->assertExists($attachment->path);
        auth()->logout();
        $this->get(route('attachments.show', $attachment))->assertRedirect(route('login'));
        $this->actingAs($user)->get(route('attachments.show', $attachment))->assertDownload('vale.pdf');
    }

    public function test_application_evidence_is_private_and_linked_to_the_batch_report(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $item = $this->voucherItem(10);

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-26',
            'reference' => 'A-24391',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 3]],
            'attachment' => UploadedFile::fake()->create('orden.jpg', 100, 'image/jpeg'),
        ])->assertSessionHasNoErrors();

        $report = MaterialApplicationReport::query()->with('attachment')->sole();
        $this->assertNotNull($report->attachment);
        Storage::disk('local')->assertExists($report->attachment->path);
        $this->assertSame('A-24391', $report->reference);

        auth()->logout();
        $this->get(route('application-attachments.show', $report->attachment))->assertRedirect(route('login'));
        $this->actingAs($user)->get(route('application-attachments.show', $report->attachment))->assertDownload('orden.jpg');
    }

    public function test_quick_application_search_only_returns_active_exits_with_pending_material(): void
    {
        $user = User::factory()->create();
        $pending = $this->voucherItem(10);
        $pending->voucher->update(['folio' => '15628', 'folio_key' => '15628']);
        $settled = $this->voucherItem(2);
        $settled->voucher->update(['folio' => '15629', 'folio_key' => '15629']);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $settled->id,
            'quantity' => 2,
        ]);

        $this->actingAs($user)
            ->getJson(route('applications.vouchers.search', ['search' => '1562']))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.folio', '15628')
            ->assertJsonPath('data.0.items.0.pending_quantity', '10.000');
    }

    public function test_tracking_report_exports_the_operational_sheets_as_a_valid_xlsx_file(): void
    {
        $user = User::factory()->create();
        $this->voucherItem(10);

        $response = $this->actingAs($user)->get(route('reports.export'));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringContainsString('.xlsx', (string) $response->headers->get('content-disposition'));

        $zip = new ZipArchive;
        $this->assertTrue($zip->open($response->getFile()->getPathname()));
        $workbook = $zip->getFromName('xl/workbook.xml');
        $this->assertIsString($workbook);
        $this->assertStringContainsString('Resumen por material', $workbook);
        $this->assertStringContainsString('Resumen por técnico', $workbook);
        $this->assertStringContainsString('Detalle de vales', $workbook);
        $this->assertStringContainsString('Aplicaciones', $workbook);
        $this->assertStringNotContainsString('Existencias', $workbook);
        $zip->close();
    }

    public function test_an_independent_entry_is_received_and_cannot_have_applications(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10, VoucherDirection::Entry);

        $data = VoucherData::make($item->voucher, true);
        $this->assertSame('received', $data['balance_state']);
        $this->assertSame('0.000', $data['items'][0]['pending_quantity']);

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 1]],
        ])->assertSessionHasErrors('voucher_id');
        $this->assertDatabaseCount('material_applications', 0);
    }

    public function test_tracking_reports_only_active_exits_since_2026_and_separates_each_balance(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material, $otherMaterial] = $this->catalogs();
        $location = StorageLocation::factory()->create();

        $pendingVoucher = Voucher::factory()->create([
            'storage_location_id' => $location->id,
            'direction' => VoucherDirection::Exit,
            'issued_on' => '2026-01-10',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
        ]);
        $pendingItem = VoucherItem::factory()->create([
            'voucher_id' => $pendingVoucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $material->name,
            'quantity' => 10,
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $pendingVoucher->id,
            'material_id' => $otherMaterial->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $otherMaterial->name,
            'quantity' => 3,
        ]);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $pendingItem->id,
            'occurred_on' => '2026-01-11',
            'quantity' => 6,
        ]);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $pendingItem->id,
            'occurred_on' => '2026-01-12',
            'quantity' => 1,
            'voided_at' => now(),
        ]);

        $settledVoucher = Voucher::factory()->create([
            'storage_location_id' => $location->id,
            'direction' => VoucherDirection::Exit,
            'issued_on' => '2026-02-10',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
        ]);
        $settledItem = VoucherItem::factory()->create([
            'voucher_id' => $settledVoucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $material->name,
            'quantity' => 5,
        ]);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $settledItem->id,
            'occurred_on' => '2026-02-11',
            'quantity' => 5,
        ]);

        foreach ([
            ['issued_on' => '2025-12-31', 'direction' => VoucherDirection::Exit, 'status' => VoucherStatus::Active],
            ['issued_on' => '2026-03-01', 'direction' => VoucherDirection::Entry, 'status' => VoucherStatus::Active],
            ['issued_on' => '2026-03-02', 'direction' => VoucherDirection::Exit, 'status' => VoucherStatus::Cancelled],
        ] as $excluded) {
            $voucher = Voucher::factory()->create([
                ...$excluded,
                'storage_location_id' => $location->id,
                'received_by_id' => $technician->id,
                'delivered_by_id' => $issuer->id,
            ]);
            VoucherItem::factory()->create([
                'voucher_id' => $voucher->id,
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'description_snapshot' => $material->name,
                'quantity' => 99,
            ]);
        }

        $this->actingAs($user)->get(route('reports.material-tracking', [
            'from' => '2025-01-01',
            'material_id' => $material->id,
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('reports/material-tracking')
            ->where('filters.from', '2026-01-01')
            ->where('metrics.delivered_vouchers', 2)
            ->where('metrics.pending_vouchers', 1)
            ->where('metrics.pending_items', 1)
            ->where('metrics.settled_vouchers', 1)
            ->where('metrics.technicians_with_pending', 1)
            ->has('by_material', 1)
            ->where('by_material.0.delivered_quantity', '15.000')
            ->where('by_material.0.used_quantity', '11.000')
            ->where('by_material.0.pending_quantity', '4.000')
            ->has('rows', 2));
    }

    public function test_old_reports_redirect_to_tracking_and_inventory_adjustments_are_not_exposed(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/reports/balances?state=pending')
            ->assertRedirect(route('reports.material-tracking', ['state' => 'pending']));
        $this->actingAs($user)->get('/reports/inventory')
            ->assertRedirect(route('reports.material-tracking'));
        $this->actingAs($user)->post('/inventory-adjustments', [])->assertNotFound();
    }

    public function test_imported_catalog_records_can_be_corrected_reviewed_and_keep_their_old_aliases(): void
    {
        $user = User::factory()->create();
        $piece = Unit::factory()->create(['symbol' => 'pza']);
        $metre = Unit::factory()->create(['symbol' => 'm']);
        $material = Material::factory()->create([
            'name' => 'Cable POT viejo',
            'normalized_name' => 'cable pot viejo',
            'default_unit_id' => $piece->id,
            'needs_review' => true,
        ]);
        $person = Person::factory()->create([
            'name' => 'MIGUELRDGZ',
            'normalized_name' => 'miguelrdgz',
            'can_receive_material' => true,
            'can_deliver_material' => false,
            'needs_review' => true,
        ]);

        $this->actingAs($user)->put(route('catalogs.materials.update', $material), [
            'name' => 'Cable POT calibre 14',
            'default_unit_id' => $metre->id,
        ])->assertSessionHasNoErrors();
        $this->actingAs($user)->put(route('catalogs.people.update', $person), [
            'name' => 'Miguel Rodríguez',
            'can_receive_material' => true,
            'can_deliver_material' => true,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('materials', [
            'id' => $material->id,
            'name' => 'Cable POT calibre 14',
            'default_unit_id' => $metre->id,
            'needs_review' => false,
        ]);
        $this->assertDatabaseHas('material_aliases', [
            'material_id' => $material->id,
            'normalized_alias' => 'cable pot viejo',
        ]);
        $this->assertDatabaseHas('people', [
            'id' => $person->id,
            'name' => 'Miguel Rodríguez',
            'can_deliver_material' => true,
            'needs_review' => false,
        ]);
        $this->assertDatabaseHas('person_aliases', [
            'person_id' => $person->id,
            'normalized_alias' => 'miguelrdgz',
        ]);
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_an_import_review_can_be_marked_as_attended_and_is_audited(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $item->voucher->update([
            'needs_review' => true,
            'review_reasons' => ['La fecha fue inferida.'],
        ]);

        $this->actingAs($user)
            ->post(route('vouchers.review', $item->voucher))
            ->assertRedirect(route('vouchers.show', $item->voucher));

        $voucher = $item->voucher->fresh();
        $this->assertFalse($voucher->needs_review);
        $this->assertSame(['La fecha fue inferida.'], $voucher->review_reasons);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'reviewed',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
            'user_id' => $user->id,
        ]);
    }

    private function voucherItem(float $quantity, VoucherDirection $direction = VoucherDirection::Exit): VoucherItem
    {
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $voucher = Voucher::factory()->create([
            'direction' => $direction,
            'issued_on' => '2026-08-24',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
        ]);

        return VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $material->name,
            'quantity' => $quantity,
        ]);
    }

    /** @return array{Person, Person, Unit, Material, Material} */
    private function catalogs(): array
    {
        $technician = Person::factory()->create(['can_deliver_material' => false]);
        $issuer = Person::factory()->create(['can_receive_material' => false]);
        $unit = Unit::factory()->create(['name' => 'Pieza', 'symbol' => fake()->unique()->lexify('p??')]);
        $first = Material::factory()->create(['default_unit_id' => $unit->id]);
        $second = Material::factory()->create(['default_unit_id' => $unit->id]);

        return [$technician, $issuer, $unit, $first, $second];
    }
}
