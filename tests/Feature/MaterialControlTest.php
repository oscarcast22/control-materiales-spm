<?php

namespace Tests\Feature;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\LegacyImportRow;
use App\Models\Material;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationReport;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\Normalizer;
use App\Support\VoucherData;
use App\Support\VoucherSequence;
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
        $first->voucherTypes()->sync([$location->id]);
        $second->voucherTypes()->sync([$location->id]);
        $destination = Destination::factory()->create(['name' => 'Colonia Centro', 'normalized_name' => 'colonia centro']);
        $payload = [
            'voucher_type_id' => $location->id,
            'folio' => ' 001-A ',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-24',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination_ids' => [$destination->id],
            'usage_description' => 'Trabajo programado',
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
        $this->assertSame([$destination->id], $voucher->destinations()->pluck('destinations.id')->all());
        $this->assertDatabaseHas('audit_events', ['event' => 'created', 'auditable_type' => Voucher::class]);

        $this->actingAs($user)->from(route('vouchers.create'))->post(route('vouchers.store'), [
            ...$payload,
            'folio' => '001 a',
        ])->assertSessionHasErrors('folio');
        $this->assertSame(1, Voucher::query()->count());

        $otherLocation = StorageLocation::factory()->create();
        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'voucher_type_id' => $otherLocation->id,
            'folio' => '001 a',
        ])->assertSessionHasNoErrors();
        $this->assertSame(2, Voucher::query()->count());
    }

    public function test_a_cancelled_folio_can_be_registered_without_people_or_materials(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);

        $response = $this->actingAs($user)->post(route('vouchers.cancelled.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16576',
            'issued_on' => '2026-08-27',
            'cancellation_reason' => '',
        ]);

        $voucher = Voucher::query()->sole();
        $response->assertRedirect(route('vouchers.show', $voucher));
        $this->assertSame(VoucherStatus::Cancelled, $voucher->status);
        $this->assertNull($voucher->direction);
        $this->assertNull($voucher->received_by_id);
        $this->assertNull($voucher->delivered_by_id);
        $this->assertSame(0, $voucher->items()->count());
        $this->assertSame(
            'Folio cancelado para conservar la continuidad de la numeración.',
            $voucher->cancellation_reason,
        );
        $this->assertDatabaseHas('audit_events', [
            'event' => 'created_cancelled',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
        ]);

        $this->actingAs($user)->get(route('vouchers.edit', $voucher))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('vouchers/reference-form'));
        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            'voucher_type_id' => $location->id,
            'folio' => '16577',
            'issued_on' => '2026-08-28',
        ])->assertSessionHasNoErrors();
        $voucher->refresh();
        $this->assertSame(VoucherStatus::Cancelled, $voucher->status);
        $this->assertSame('16577', $voucher->folio);
        $this->assertSame(
            'Folio cancelado para conservar la continuidad de la numeración.',
            $voucher->cancellation_reason,
        );
    }

    public function test_a_voucher_accepts_multiple_catalogued_and_inline_locations_or_only_an_activity(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $voucherType = StorageLocation::factory()->create();
        $material->voucherTypes()->sync([$voucherType->id]);
        $known = Destination::factory()->create([
            'name' => 'Poblado Otinapa',
            'normalized_name' => 'poblado otinapa',
        ]);
        $payload = [
            'voucher_type_id' => $voucherType->id,
            'folio' => 'DEST-1',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-27',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination_ids' => [$known->id],
            'new_destinations' => ['Fracc. Nuevo Horizonte'],
            'usage_description' => 'Actualización de luminarias',
            'items' => [[
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'quantity' => 1,
            ]],
        ];

        $this->actingAs($user)->post(route('vouchers.store'), $payload)->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $this->assertSame('Actualización de luminarias', $voucher->usage_description);
        $this->assertEqualsCanonicalizing(
            ['Poblado Otinapa', 'Fracc. Nuevo Horizonte'],
            $voucher->destinations()->pluck('name')->all(),
        );
        $this->assertSame(0, Destination::query()
            ->where('normalized_name', 'fracc nuevo horizonte')
            ->sole()
            ->aliases()
            ->count());
        $this->assertDatabaseHas('audit_events', [
            'event' => 'created_from_voucher',
            'auditable_type' => Destination::class,
        ]);

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'folio' => 'DEST-2',
            'destination_ids' => [],
            'new_destinations' => [],
            'usage_description' => 'Uso interno en camioneta Hilux',
        ])->assertSessionHasNoErrors();

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'folio' => 'DEST-3',
            'destination_ids' => [],
            'new_destinations' => [],
            'usage_description' => '',
        ])->assertSessionHasErrors('destination_ids');
        $this->assertSame(2, Voucher::query()->count());
    }

    public function test_voucher_dialog_payloads_and_numeric_folio_sort_are_available(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);
        foreach (['10', '2'] as $folio) {
            Voucher::factory()->create([
                'storage_location_id' => $location->id,
                'folio' => $folio,
                'folio_key' => Normalizer::folio($folio),
                'status' => VoucherStatus::Cancelled,
                'direction' => null,
            ]);
        }
        $voucher = Voucher::query()->where('folio', '2')->sole();

        $this->actingAs($user)->getJson(route('vouchers.create'))
            ->assertOk()
            ->assertJsonStructure(['voucher', 'materials', 'voucherTypes', 'receivers']);
        $this->actingAs($user)->getJson(route('vouchers.show', $voucher))
            ->assertOk()
            ->assertJsonPath('voucher.folio', '2');
        $this->actingAs($user)->getJson(route('vouchers.edit', $voucher))
            ->assertOk()
            ->assertJsonPath('voucher.status', 'cancelled')
            ->assertJsonStructure(['voucherTypes']);

        $this->actingAs($user)->get(route('vouchers.index', [
            'sort' => 'folio',
            'sort_direction' => 'asc',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'folio')
            ->where('filters.sort_direction', 'asc')
            ->where('vouchers.data.0.folio', '2')
            ->where('vouchers.data.1.folio', '10'));
    }

    public function test_destinations_can_be_created_reviewed_and_deduplicated_from_catalogs(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('catalogs.destinations.store'), [
            'name' => ' Colonia San Carlos ',
        ])->assertSessionHasNoErrors();
        $destination = Destination::query()->sole();
        $this->assertSame(0, $destination->aliases()->count());

        $this->actingAs($user)->post(route('catalogs.destinations.store'), [
            'name' => 'colonia san-cárlos',
        ])->assertSessionHasErrors('name');

        $destination->update(['needs_review' => true]);
        $this->actingAs($user)->put(route('catalogs.destinations.update', $destination), [
            'name' => 'Col. San Carlos',
        ])->assertSessionHasNoErrors();

        $destination->refresh();
        $this->assertSame('Col. San Carlos', $destination->name);
        $this->assertFalse($destination->needs_review);
        $this->assertTrue(DestinationAlias::query()
            ->where('destination_id', $destination->id)
            ->where('normalized_alias', 'colonia san carlos')
            ->exists());
        $this->assertFalse(DestinationAlias::query()
            ->where('destination_id', $destination->id)
            ->where('normalized_alias', 'col san carlos')
            ->exists());
        $this->assertSame(1, $destination->aliases()->count());

        $this->actingAs($user)->post(route('catalogs.destinations.store'), [
            'name' => 'Colonia San Carlos',
        ])->assertSessionHasErrors('name');
    }

    public function test_materials_must_belong_to_the_selected_voucher_type(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $warehouse = StorageLocation::factory()->create(['code' => 'warehouse']);
        $yard = StorageLocation::factory()->create(['code' => 'yard']);
        $material->voucherTypes()->sync([$warehouse->id]);

        $this->actingAs($user)->post(route('vouchers.store'), [
            'voucher_type_id' => $yard->id,
            'folio' => '3753',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-27',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'usage_description' => 'Prueba',
            'items' => [[
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'quantity' => 1,
            ]],
        ])->assertSessionHasErrors('items.0.material_id');

        $this->assertDatabaseCount('vouchers', 0);
    }

    public function test_program_and_action_are_kept_for_warehouse_and_cleared_for_yard(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $warehouse = StorageLocation::factory()->create(['code' => 'warehouse']);
        $yard = StorageLocation::factory()->create(['code' => 'yard']);
        $material->voucherTypes()->sync([$warehouse->id, $yard->id]);
        $destination = Destination::factory()->create();
        $program = Program::factory()->create(['code' => 'SPM-06']);
        $action = Action::factory()->create([
            'program_id' => $program->id,
            'code' => 'SPM-06-01',
        ]);
        $payload = [
            'voucher_type_id' => $warehouse->id,
            'folio' => 'CLAS-1',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-27',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'program_id' => $program->id,
            'action_id' => $action->id,
            'destination_ids' => [$destination->id],
            'items' => [[
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'quantity' => 1,
            ]],
        ];

        $this->actingAs($user)->post(route('vouchers.store'), $payload)
            ->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $this->assertSame($program->id, $voucher->program_id);
        $this->assertSame($action->id, $voucher->action_id);

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            ...$payload,
            'voucher_type_id' => $yard->id,
            'items' => [[
                'id' => $voucher->items()->sole()->id,
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'quantity' => 1,
            ]],
        ])->assertSessionHasNoErrors();

        $voucher->refresh();
        $this->assertSame($yard->id, $voucher->storage_location_id);
        $this->assertNull($voucher->program_id);
        $this->assertNull($voucher->action_id);
    }

    public function test_folio_sequence_counts_cancelled_vouchers_and_ignores_unimported_traces(): void
    {
        config()->set('material-control.voucher_sequence_starts', [
            'warehouse' => 16576,
            'yard' => 3753,
        ]);
        $warehouse = StorageLocation::factory()->create(['code' => 'warehouse', 'name' => 'Almacén']);
        $yard = StorageLocation::factory()->create(['code' => 'yard', 'name' => 'Patio']);
        foreach ([
            [$warehouse, '16576', VoucherStatus::Active],
            [$warehouse, '16578', VoucherStatus::Cancelled],
            [$warehouse, 'A-16579', VoucherStatus::Active],
            [$yard, '3753', VoucherStatus::Loaned],
            [$yard, '3755', VoucherStatus::Active],
        ] as [$location, $folio, $status]) {
            Voucher::factory()->create([
                'storage_location_id' => $location->id,
                'folio' => $folio,
                'folio_key' => Normalizer::folio($folio),
                'status' => $status,
            ]);
        }
        LegacyImportRow::create([
            'source_hash' => str_repeat('f', 64),
            'source_name' => 'prueba.xlsx',
            'sheet_name' => 'Vale de Almacen',
            'row_number' => 9,
            'raw_data' => ['folio' => '16580'],
            'issue_codes' => ['unresolved_material'],
        ]);

        $summary = app(VoucherSequence::class)->summary();

        $this->assertSame(4, $summary['total_missing']);
        $this->assertSame([16577, 16579, 16580], collect($summary['types'])->firstWhere('voucher_type.code', 'warehouse')['missing']);
        $this->assertSame([3754], collect($summary['types'])->firstWhere('voucher_type.code', 'yard')['missing']);
    }

    public function test_multiple_materials_can_be_applied_in_one_report_without_exceeding_their_balances(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $destination = Destination::factory()->create([
            'name' => 'Col. San Carlos',
            'normalized_name' => 'col san carlos',
        ]);
        $item->voucher->destinations()->attach($destination);
        $item->voucher->update(['usage_description' => 'Actualización LED']);
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
        $this->assertSame(
            ['Col. San Carlos · Actualización LED'],
            MaterialApplication::query()->distinct()->pluck('destination_snapshot')->all(),
        );

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

    public function test_a_loaned_folio_is_minimal_editable_and_never_operational(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);

        $response = $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16582',
            'issued_on' => '2026-08-27',
            'loaned_to_name' => 'Marco Ruiz',
        ])->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $response->assertRedirect(route('vouchers.show', $voucher));
        $this->assertSame(VoucherStatus::Loaned, $voucher->status);
        $this->assertSame('Marco Ruiz', $voucher->loaned_to_name);
        $this->assertNull($voucher->direction);
        $this->assertNull($voucher->received_by_id);
        $this->assertNull($voucher->delivered_by_id);
        $this->assertNull($voucher->authorized_by_id);
        $this->assertSame(0, $voucher->items()->count());
        $this->assertDatabaseHas('audit_events', [
            'event' => 'created_loaned',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
        ]);

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            'voucher_type_id' => $location->id,
            'folio' => '16583',
            'issued_on' => '2026-08-28',
            'loaned_to_name' => '',
        ])->assertSessionHasNoErrors();
        $voucher->refresh();
        $this->assertSame('16583', $voucher->folio);
        $this->assertNull($voucher->loaned_to_name);
        $this->assertSame('2026-08-28', $voucher->loaned_on?->toDateString());
        $this->assertDatabaseHas('audit_events', [
            'event' => 'updated_minimal',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
        ]);

        $this->actingAs($user)->post(route('vouchers.cancel', $voucher), [
            'reason' => 'No corresponde',
        ])->assertStatus(422);
        $this->actingAs($user)->post('/vouchers/'.$voucher->id.'/loan', [])
            ->assertNotFound();
        $this->actingAs($user)->post('/vouchers/'.$voucher->id.'/return', [])
            ->assertNotFound();
        $this->actingAs($user)->getJson(route('applications.vouchers.search', ['search' => '16583']))
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_voucher_attachments_are_private_and_downloadable_only_after_authentication(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $location = StorageLocation::factory()->create();

        $this->actingAs($user)->post(route('vouchers.store'), [
            'voucher_type_id' => $location->id,
            'folio' => 'ADJ-1',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-24',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'usage_description' => 'Taller municipal',
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
            ['issued_on' => '2026-03-03', 'direction' => VoucherDirection::Exit, 'status' => VoucherStatus::Loaned],
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
            ->where('filters.tab', 'detail')
            ->where('metrics.delivered_vouchers', 2)
            ->where('metrics.pending_vouchers', 1)
            ->where('metrics.pending_items', 1)
            ->where('metrics.settled_vouchers', 1)
            ->where('metrics.technicians_with_pending', 1)
            ->where('materials', fn ($materials) => $materials->contains(
                fn ($candidate) => $candidate['id'] === $material->id
                    && $candidate['default_unit']['symbol'] === $unit->symbol,
            ))
            ->has('by_material', 1)
            ->where('by_material.0.delivered_quantity', '15.000')
            ->where('by_material.0.used_quantity', '11.000')
            ->where('by_material.0.pending_quantity', '4.000')
            ->has('rows', 2));
    }

    public function test_tracking_text_search_finds_complete_vouchers_by_their_visible_context(): void
    {
        [$user, , , $yard] = $this->trackingSearchFixtures();

        foreach (['16583', 'jose luis', 'otinapa', 'modernización', 'lampara', 'modelo legado'] as $search) {
            $this->actingAs($user)->get(route('reports.material-tracking', [
                'search' => $search,
            ]))->assertOk()->assertInertia(fn (Assert $page) => $page
                ->component('reports/material-tracking')
                ->where('filters.search', $search)
                ->where('metrics.delivered_vouchers', 1)
                ->has('rows', 2)
                ->where('rows.0.folio', '16-583')
                ->where('rows.1.folio', '16-583'));
        }

        $this->actingAs($user)->get(route('reports.material-tracking', [
            'search' => 'jose luis',
            'voucher_type_id' => $yard->id,
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.voucher_type_id', $yard->id)
            ->where('metrics.delivered_vouchers', 1)
            ->has('rows', 1)
            ->where('rows.0.folio', '3753'));
    }

    public function test_tracking_export_uses_the_text_search_filter(): void
    {
        [$user] = $this->trackingSearchFixtures();

        $response = $this->actingAs($user)->get(route('reports.export', [
            'search' => 'jose luis',
        ]));

        $response->assertOk();
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($response->getFile()->getPathname()));
        $xml = '';

        for ($index = 0; $index < $zip->numFiles; $index++) {
            $name = $zip->getNameIndex($index);

            if ($name !== false && str_ends_with($name, '.xml')) {
                $xml .= (string) $zip->getFromIndex($index);
            }
        }

        $zip->close();
        $this->assertStringContainsString('16-583', $xml);
        $this->assertStringNotContainsString('16584', $xml);
        $this->assertStringNotContainsString('3753', $xml);
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
        $location = StorageLocation::factory()->create();
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
            'voucher_type_ids' => [$location->id],
        ])->assertSessionHasNoErrors();
        $this->actingAs($user)->put(route('catalogs.people.update', $person), [
            'name' => 'Miguel Rodríguez',
            'can_receive_material' => true,
            'can_deliver_material' => true,
            'can_authorize_material' => false,
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

    public function test_voucher_forms_only_offer_people_enabled_for_each_role_and_keep_historical_assignments(): void
    {
        $user = User::factory()->create();
        $receiver = Person::factory()->create([
            'can_receive_material' => true,
            'can_deliver_material' => false,
            'can_authorize_material' => false,
        ]);
        $deliverer = Person::factory()->create([
            'can_receive_material' => false,
            'can_deliver_material' => true,
            'can_authorize_material' => false,
        ]);
        $authorizer = Person::factory()->create([
            'can_receive_material' => false,
            'can_deliver_material' => false,
            'can_authorize_material' => true,
        ]);
        $unrelated = Person::factory()->create([
            'can_receive_material' => false,
            'can_deliver_material' => false,
            'can_authorize_material' => false,
        ]);
        $location = StorageLocation::factory()->create();
        $unit = Unit::factory()->create();
        $material = Material::factory()->create(['default_unit_id' => $unit->id]);

        $this->actingAs($user)->get(route('vouchers.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('receivers', 1)
                ->where('receivers.0.id', $receiver->id)
                ->has('deliverers', 1)
                ->where('deliverers.0.id', $deliverer->id)
                ->has('authorizers', 1)
                ->where('authorizers.0.id', $authorizer->id));

        $payload = [
            'voucher_type_id' => $location->id,
            'folio' => 'ROLES-1',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-26',
            'received_by_id' => $receiver->id,
            'delivered_by_id' => $unrelated->id,
            'authorized_by_id' => $unrelated->id,
            'usage_description' => 'Prueba de funciones',
            'items' => [['material_id' => $material->id, 'unit_id' => $unit->id, 'quantity' => 1]],
        ];

        $this->actingAs($user)->post(route('vouchers.store'), $payload)
            ->assertSessionHasErrors('delivered_by_id');

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'delivered_by_id' => $deliverer->id,
            'authorized_by_id' => $authorizer->id,
        ])->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $this->assertSame($authorizer->id, $voucher->authorized_by_id);
        $item = $voucher->items()->sole();
        $deliverer->update(['can_deliver_material' => false, 'is_active' => false]);
        $authorizer->update(['can_authorize_material' => false, 'is_active' => false]);

        $this->actingAs($user)->get(route('vouchers.edit', $voucher))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('deliverers.0.id', $deliverer->id)
                ->where('authorizers.0.id', $authorizer->id));

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            ...$payload,
            'delivered_by_id' => $deliverer->id,
            'authorized_by_id' => $authorizer->id,
            'items' => [[
                'id' => $item->id,
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'quantity' => 1,
            ]],
        ])->assertSessionHasNoErrors();

        $this->actingAs($user)->get(route('vouchers.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('deliverers', 0)
                ->has('authorizers', 0));
    }

    public function test_merging_people_preserves_every_voucher_role_and_authorization_capability(): void
    {
        $user = User::factory()->create();
        $source = Person::factory()->create(['can_authorize_material' => true]);
        $target = Person::factory()->create([
            'can_receive_material' => false,
            'can_deliver_material' => false,
            'can_authorize_material' => false,
        ]);
        $voucher = Voucher::factory()->create([
            'received_by_id' => $source->id,
            'delivered_by_id' => $source->id,
            'authorized_by_id' => $source->id,
        ]);

        $this->actingAs($user)->post(route('catalogs.merge', [
            'type' => 'people',
            'source' => $source->id,
        ]), ['target_id' => $target->id])->assertSessionHasNoErrors();

        $voucher->refresh();
        $target->refresh();
        $this->assertSame($target->id, $voucher->received_by_id);
        $this->assertSame($target->id, $voucher->delivered_by_id);
        $this->assertSame($target->id, $voucher->authorized_by_id);
        $this->assertTrue($target->can_receive_material);
        $this->assertTrue($target->can_deliver_material);
        $this->assertTrue($target->can_authorize_material);
        $this->assertDatabaseHas('person_aliases', [
            'person_id' => $target->id,
            'normalized_alias' => $source->normalized_name,
        ]);
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

    /** @return array{User, Voucher, Voucher, StorageLocation} */
    private function trackingSearchFixtures(): array
    {
        $user = User::factory()->create();
        $warehouse = StorageLocation::factory()->create([
            'code' => 'warehouse',
            'name' => 'Almacén',
        ]);
        $yard = StorageLocation::factory()->create([
            'code' => 'yard',
            'name' => 'Patio',
        ]);
        $technician = Person::factory()->create([
            'name' => 'José Luis Tajonar',
            'normalized_name' => Normalizer::key('José Luis Tajonar'),
        ]);
        $otherTechnician = Person::factory()->create([
            'name' => 'Erick Aguilar',
            'normalized_name' => Normalizer::key('Erick Aguilar'),
        ]);
        $issuer = Person::factory()->create(['can_receive_material' => false]);
        $unit = Unit::factory()->create(['name' => 'Pieza', 'symbol' => 'pza']);
        $lamp = Material::factory()->create([
            'name' => 'Lámpara LED',
            'normalized_name' => Normalizer::key('Lámpara LED'),
            'default_unit_id' => $unit->id,
        ]);
        $base = Material::factory()->create([
            'name' => 'Base para fotocelda',
            'normalized_name' => Normalizer::key('Base para fotocelda'),
            'default_unit_id' => $unit->id,
        ]);
        $otherMaterial = Material::factory()->create([
            'name' => 'Cable de prueba',
            'normalized_name' => Normalizer::key('Cable de prueba'),
            'default_unit_id' => $unit->id,
        ]);
        $destination = Destination::factory()->create([
            'name' => 'Poblado Otiñapa',
            'normalized_name' => Normalizer::key('Poblado Otiñapa'),
        ]);
        $matching = Voucher::factory()->create([
            'storage_location_id' => $warehouse->id,
            'folio' => '16-583',
            'folio_key' => Normalizer::folio('16-583'),
            'issued_on' => '2026-08-26',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'usage_description' => 'Modernización de alumbrado',
        ]);
        $matching->destinations()->attach($destination);
        VoucherItem::factory()->create([
            'voucher_id' => $matching->id,
            'material_id' => $lamp->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $lamp->name,
            'quantity' => 10,
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $matching->id,
            'material_id' => $base->id,
            'unit_id' => $unit->id,
            'description_snapshot' => 'Modelo legado para fotocelda',
            'quantity' => 4,
        ]);

        $other = Voucher::factory()->create([
            'storage_location_id' => $warehouse->id,
            'folio' => '16584',
            'folio_key' => Normalizer::folio('16584'),
            'issued_on' => '2026-08-26',
            'received_by_id' => $otherTechnician->id,
            'delivered_by_id' => $issuer->id,
            'usage_description' => 'Mantenimiento preventivo',
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $other->id,
            'material_id' => $otherMaterial->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $otherMaterial->name,
            'quantity' => 3,
        ]);

        $yardVoucher = Voucher::factory()->create([
            'storage_location_id' => $yard->id,
            'folio' => '3753',
            'folio_key' => Normalizer::folio('3753'),
            'issued_on' => '2026-08-26',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'usage_description' => 'Trabajo en patio',
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $yardVoucher->id,
            'material_id' => $otherMaterial->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $otherMaterial->name,
            'quantity' => 2,
        ]);

        return [$user, $matching, $other, $yard];
    }

    /** @return array{Person, Person, Unit, Material, Material} */
    private function catalogs(): array
    {
        $technician = Person::factory()->create(['can_deliver_material' => false]);
        $issuer = Person::factory()->create([
            'can_receive_material' => false,
            'can_authorize_material' => true,
        ]);
        $unit = Unit::factory()->create(['name' => 'Pieza', 'symbol' => fake()->unique()->lexify('p??')]);
        $first = Material::factory()->create(['default_unit_id' => $unit->id]);
        $second = Material::factory()->create(['default_unit_id' => $unit->id]);

        return [$technician, $issuer, $unit, $first, $second];
    }
}
