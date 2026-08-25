<?php

namespace Tests\Feature;

use App\Enums\DispositionType;
use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\InventoryAdjustment;
use App\Models\Material;
use App\Models\MaterialDisposition;
use App\Models\Person;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\InventorySummary;
use App\Support\VoucherData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

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

    public function test_consumption_and_return_update_the_balance_and_cannot_exceed_delivery(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);

        $this->actingAs($user)->post(route('dispositions.store', $item), [
            'type' => DispositionType::Consumption->value,
            'occurred_on' => '2026-08-24',
            'quantity' => 6,
            'reference' => 'Reporte 17',
        ])->assertSessionHasNoErrors();
        $this->actingAs($user)->post(route('dispositions.store', $item), [
            'type' => DispositionType::Return->value,
            'occurred_on' => '2026-08-24',
            'quantity' => 2,
        ])->assertSessionHasNoErrors();

        $item->refresh()->load('dispositions');
        $this->assertSame('6.000', $item->usedQuantity());
        $this->assertSame('2.000', $item->returnedQuantity());
        $this->assertSame('2.000', $item->pendingQuantity());

        $this->actingAs($user)->post(route('dispositions.store', $item), [
            'type' => DispositionType::Consumption->value,
            'occurred_on' => '2026-08-24',
            'quantity' => 2.001,
        ])->assertSessionHasErrors('quantity');
        $this->assertSame(2, MaterialDisposition::query()->count());
    }

    public function test_voiding_a_movement_recalculates_balance_and_is_audited(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $movement = MaterialDisposition::factory()->create([
            'voucher_item_id' => $item->id,
            'type' => DispositionType::Consumption,
            'quantity' => 4,
        ]);

        $this->actingAs($user)->post(route('dispositions.void', $movement), [
            'reason' => 'Captura duplicada',
        ])->assertSessionHasNoErrors();

        $this->assertNotNull($movement->fresh()->voided_at);
        $this->assertSame('10.000', $item->fresh()->pendingQuantity());
        $this->assertDatabaseHas('audit_events', [
            'event' => 'voided',
            'auditable_type' => MaterialDisposition::class,
            'auditable_id' => $movement->id,
        ]);
    }

    public function test_a_voucher_with_active_movements_cannot_be_cancelled(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        MaterialDisposition::factory()->create(['voucher_item_id' => $item->id, 'quantity' => 1]);

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

    public function test_balance_report_exports_a_valid_xlsx_file(): void
    {
        $user = User::factory()->create();
        $this->voucherItem(10);

        $response = $this->actingAs($user)->get(route('reports.export'));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringContainsString('.xlsx', (string) $response->headers->get('content-disposition'));
    }

    public function test_an_independent_entry_is_received_and_cannot_have_dispositions(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10, VoucherDirection::Entry);

        $data = VoucherData::make($item->voucher, true);
        $this->assertSame('received', $data['balance_state']);
        $this->assertSame('0.000', $data['items'][0]['pending_quantity']);

        $this->actingAs($user)->post(route('dispositions.store', $item), [
            'type' => DispositionType::Consumption->value,
            'occurred_on' => '2026-08-24',
            'quantity' => 1,
        ])->assertUnprocessable();
        $this->assertDatabaseCount('material_dispositions', 0);
    }

    public function test_inventory_combines_entries_exits_returns_and_audited_adjustments(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $location = StorageLocation::factory()->create(['tracking_started_on' => '2026-08-01']);

        $entry = Voucher::factory()->create([
            'storage_location_id' => $location->id, 'direction' => VoucherDirection::Entry,
            'issued_on' => '2026-08-05', 'received_by_id' => $technician->id, 'delivered_by_id' => $issuer->id,
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $entry->id, 'material_id' => $material->id, 'unit_id' => $unit->id,
            'description_snapshot' => $material->name, 'quantity' => 20,
        ]);
        $exit = Voucher::factory()->create([
            'storage_location_id' => $location->id, 'direction' => VoucherDirection::Exit,
            'issued_on' => '2026-08-10', 'received_by_id' => $technician->id, 'delivered_by_id' => $issuer->id,
        ]);
        $exitItem = VoucherItem::factory()->create([
            'voucher_id' => $exit->id, 'material_id' => $material->id, 'unit_id' => $unit->id,
            'description_snapshot' => $material->name, 'quantity' => 10,
        ]);
        MaterialDisposition::factory()->create([
            'voucher_item_id' => $exitItem->id, 'type' => DispositionType::Consumption,
            'occurred_on' => '2026-08-11', 'quantity' => 4,
        ]);
        MaterialDisposition::factory()->create([
            'voucher_item_id' => $exitItem->id, 'type' => DispositionType::Return,
            'occurred_on' => '2026-08-12', 'quantity' => 2,
        ]);
        MaterialDisposition::factory()->create([
            'voucher_item_id' => $exitItem->id, 'type' => DispositionType::Return,
            'occurred_on' => '2026-08-12', 'quantity' => 1, 'voided_at' => now(),
        ]);
        $cancelledEntry = Voucher::factory()->create([
            'storage_location_id' => $location->id, 'direction' => VoucherDirection::Entry,
            'status' => VoucherStatus::Cancelled, 'issued_on' => '2026-08-06',
            'received_by_id' => $technician->id, 'delivered_by_id' => $issuer->id,
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $cancelledEntry->id, 'material_id' => $material->id, 'unit_id' => $unit->id,
            'description_snapshot' => $material->name, 'quantity' => 50,
        ]);
        $historical = Voucher::factory()->create([
            'storage_location_id' => $location->id, 'direction' => VoucherDirection::Exit,
            'issued_on' => '2026-07-01', 'received_by_id' => $technician->id, 'delivered_by_id' => $issuer->id,
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $historical->id, 'material_id' => $material->id, 'unit_id' => $unit->id,
            'description_snapshot' => $material->name, 'quantity' => 99,
        ]);

        $this->actingAs($user)->post(route('inventory-adjustments.store'), [
            'storage_location_id' => $location->id, 'material_id' => $material->id, 'unit_id' => $unit->id,
            'occurred_on' => '2026-07-31', 'direction' => 'increase', 'quantity' => 100,
            'reason' => 'Intento anterior al inicio',
        ])->assertSessionHasErrors('occurred_on');

        $this->actingAs($user)->post(route('inventory-adjustments.store'), [
            'storage_location_id' => $location->id, 'material_id' => $material->id, 'unit_id' => $unit->id,
            'occurred_on' => '2026-08-13', 'direction' => 'decrease', 'quantity' => 1,
            'reason' => 'Diferencia en conteo físico',
        ])->assertSessionHasNoErrors();

        $row = InventorySummary::rows($location->id, $material->id, '2026-08-31')[0];
        $this->assertSame('20.000', $row['entries']);
        $this->assertSame('10.000', $row['exits']);
        $this->assertSame('2.000', $row['returns']);
        $this->assertSame('-1.000', $row['adjustments']);
        $this->assertSame('11.000', $row['available']);

        $adjustment = InventoryAdjustment::query()->sole();
        $this->actingAs($user)->post(route('inventory-adjustments.void', $adjustment), [
            'reason' => 'El conteo fue corregido',
        ])->assertSessionHasNoErrors();
        $this->assertSame('12.000', InventorySummary::rows($location->id, $material->id, '2026-08-31')[0]['available']);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'voided', 'auditable_type' => InventoryAdjustment::class, 'auditable_id' => $adjustment->id,
        ]);
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

    private function voucherItem(float $quantity, VoucherDirection $direction = VoucherDirection::Exit): VoucherItem
    {
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $voucher = Voucher::factory()->create([
            'direction' => $direction,
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
