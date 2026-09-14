<?php

namespace Tests\Feature;

use App\Enums\ServiceOrderType;
use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\ActionIndicator;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\LegacyImportRow;
use App\Models\Material;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationAttachment;
use App\Models\MaterialApplicationReport;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherAttachment;
use App\Models\VoucherItem;
use App\Support\MaterialTracking;
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
        $action = Action::query()->where('code', 'SPM-06-01')->sole();
        $payload = [
            'voucher_type_id' => $location->id,
            'folio' => ' 001-A ',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-24',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'action_id' => $action->id,
            'destination_ids' => [$destination->id],
            'usage_description' => 'Trabajo programado',
            'notes' => 'Trabajo programado',
            'items' => [
                ['material_id' => $first->id, 'quantity' => 10],
                ['material_id' => $second->id, 'quantity' => 3],
            ],
        ];

        $response = $this->actingAs($user)->post(route('vouchers.store'), $payload);

        $voucher = Voucher::query()->sole();
        $response
            ->assertRedirect(route('vouchers.show', $voucher))
            ->assertInertiaFlash('toast.type', 'success')
            ->assertInertiaFlash('toast.message', 'Vale 001-A capturado correctamente.')
            ->assertSessionMissing('success');
        $this->assertSame('001-A', $voucher->folio);
        $this->assertSame(2, $voucher->items()->count());
        $this->assertSame([$destination->id], $voucher->destinations()->pluck('destinations.id')->all());
        $this->assertDatabaseHas('audit_events', ['event' => 'created', 'auditable_type' => Voucher::class]);
        $this->assertSame($unit->id, $voucher->items()->orderBy('id')->firstOrFail()->unit_id);

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'folio' => '001-C',
            'items' => [
                ['material_id' => $first->id, 'quantity' => 1.5],
            ],
        ])->assertSessionHasErrors('items.0.quantity');

        $this->actingAs($user)->from(route('vouchers.create'))->post(route('vouchers.store'), [
            ...$payload,
            'folio' => '001-B',
            'items' => [[
                'material_id' => $first->id,
                'unit_id' => $unit->id,
                'quantity' => 10,
            ]],
        ])->assertSessionHasErrors('items.0.unit_id');

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

    public function test_a_material_can_be_added_while_updating_a_voucher(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $first, $second] = $this->catalogs();
        $location = StorageLocation::factory()->create();
        $first->voucherTypes()->sync([$location->id]);
        $second->voucherTypes()->sync([$location->id]);
        $destination = Destination::factory()->create();
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $location->id,
            'issued_on' => '2026-08-24',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
        ]);
        $voucher->destinations()->attach($destination);
        $item = VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $first->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $first->name,
            'quantity' => 10,
        ]);

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            'voucher_type_id' => $location->id,
            'folio' => $voucher->folio,
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => $voucher->issued_on->toDateString(),
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination_ids' => [$destination->id],
            'usage_description' => $voucher->usage_description,
            'items' => [
                [
                    'id' => $item->id,
                    'material_id' => $first->id,
                    'quantity' => 10,
                ],
                [
                    'material_id' => $second->id,
                    'quantity' => 2,
                ],
            ],
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('voucher_items', [
            'voucher_id' => $voucher->id,
            'material_id' => $first->id,
            'quantity' => 10,
        ]);
        $this->assertDatabaseHas('voucher_items', [
            'voucher_id' => $voucher->id,
            'material_id' => $second->id,
            'quantity' => 2,
        ]);
    }

    public function test_luminaire_folios_are_stored_for_operational_and_loaned_vouchers_only_on_luminaires(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, , $luminaire, $otherMaterial] = $this->catalogs();
        $luminaire->update(['is_luminaire' => true]);
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);
        $luminaire->voucherTypes()->sync([$location->id]);
        $otherMaterial->voucherTypes()->sync([$location->id]);
        $destination = Destination::factory()->create();
        $action = Action::query()->where('code', 'SPM-06-01')->sole();
        $payload = [
            'voucher_type_id' => $location->id,
            'issued_on' => '2026-09-08',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'authorized_by_id' => $issuer->id,
            'destination_ids' => [$destination->id],
            'usage_description' => 'Instalación de luminarias',
        ];

        foreach ([VoucherDirection::Exit, VoucherDirection::Entry] as $index => $direction) {
            $this->actingAs($user)->post(route('vouchers.store'), [
                ...$payload,
                'folio' => 'LUM-'.($index + 1),
                'direction' => $direction->value,
                'action_id' => $action->id,
                'items' => [[
                    'material_id' => $luminaire->id,
                    'quantity' => 3,
                    'luminaire_folios' => "  100-130, 145\n152  ",
                ]],
            ])->assertSessionHasNoErrors();
        }

        $operational = Voucher::query()->where('folio', 'LUM-1')->sole();
        $this->assertSame("100-130, 145\n152", $operational->items()->sole()->luminaire_folios);
        $this->assertSame("100-130, 145\n152", VoucherData::make($operational)['items'][0]['luminaire_folios']);
        $this->assertSame(
            "100-130, 145\n152",
            MaterialTracking::make(collect([$operational]))['rows'][0]['luminaire_folios'],
        );
        $this->actingAs($user)->get(route('vouchers.print', $operational))
            ->assertOk()
            ->assertSee('Folios:')
            ->assertSee('100-130, 145');

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'folio' => 'LUM-INVALID',
            'direction' => VoucherDirection::Exit->value,
            'action_id' => $action->id,
            'items' => [[
                'material_id' => $otherMaterial->id,
                'quantity' => 1,
                'luminaire_folios' => '200-205',
            ]],
        ])->assertSessionHasErrors([
            'items.0.luminaire_folios' => 'Los folios sólo se pueden registrar para materiales marcados como luminaria.',
        ]);

        $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => 'LUM-PRESTADO',
            'issued_on' => '2026-09-08',
            'items' => [[
                'material_id' => $luminaire->id,
                'quantity' => 2,
                'luminaire_folios' => '300, 304',
            ]],
        ])->assertSessionHasNoErrors();

        $this->assertSame(
            '300, 304',
            Voucher::query()->where('folio', 'LUM-PRESTADO')->sole()->items()->sole()->luminaire_folios,
        );
    }

    public function test_decimal_quantities_follow_the_material_unit_in_vouchers_loans_and_applications(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $unit->update(['name' => 'Metro', 'symbol' => 'm', 'decimal_places' => 1]);
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);
        $material->voucherTypes()->sync([$location->id]);
        $action = Action::query()->where('code', 'SPM-06-01')->sole();
        $payload = [
            'voucher_type_id' => $location->id,
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-09-07',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'action_id' => $action->id,
            'usage_description' => 'Prueba de cantidades decimales',
            'items' => [['material_id' => $material->id, 'quantity' => '2.555']],
        ];

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'folio' => 'DEC-1',
        ])->assertSessionHasNoErrors();

        $voucher = Voucher::query()->where('folio', 'DEC-1')->sole();
        $item = $voucher->items()->sole();
        $this->assertSame('2.555', $item->quantity);
        $this->assertSame(1, VoucherData::make($voucher)['items'][0]['unit']['decimal_places']);

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $voucher->id,
            'occurred_on' => '2026-09-07',
            'reference' => 'OS-DEC-1',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => '1.234']],
        ])->assertSessionHasNoErrors();

        $this->assertSame('1.234', $item->fresh()->usedQuantity());
        $this->assertSame('1.321', $item->fresh()->pendingQuantity());

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'folio' => 'DEC-2',
            'items' => [['material_id' => $material->id, 'quantity' => '2.55']],
        ])->assertSessionHasNoErrors();
        $this->assertSame('2.550', Voucher::query()->where('folio', 'DEC-2')->sole()->items()->sole()->quantity);

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $voucher->id,
            'occurred_on' => '2026-09-07',
            'reference' => 'OS-DEC-2',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => '1.25']],
        ])->assertSessionHasNoErrors();

        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'folio' => 'DEC-4',
            'items' => [['material_id' => $material->id, 'quantity' => '2.5555']],
        ])->assertSessionHasErrors('items.0.quantity');

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $voucher->id,
            'occurred_on' => '2026-09-07',
            'reference' => 'OS-DEC-4',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => '0.0001']],
        ])->assertSessionHasErrors('items.0.quantity');

        $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => 'DEC-3',
            'issued_on' => '2026-09-07',
            'items' => [['material_id' => $material->id, 'quantity' => '3.125']],
        ])->assertSessionHasNoErrors();

        $loaned = Voucher::query()->where('folio', 'DEC-3')->sole();
        $this->assertSame('3.125', $loaned->items()->sole()->quantity);
    }

    public function test_a_cancelled_folio_can_be_registered_without_people_or_materials(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);

        $this->actingAs($user)->post(route('vouchers.cancelled.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16575',
            'issued_on' => '2026-08-27',
            'cancellation_reason' => 'No',
        ])->assertSessionHasErrors([
            'cancellation_reason' => 'Si escribes un motivo, usa al menos 5 caracteres.',
        ]);

        $response = $this->actingAs($user)->post(route('vouchers.cancelled.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16576',
            'issued_on' => '2026-08-27',
            'cancellation_reason' => '',
        ]);

        $voucher = Voucher::query()->sole();
        $response
            ->assertRedirect(route('vouchers.show', $voucher))
            ->assertInertiaFlash('toast.type', 'success')
            ->assertInertiaFlash('toast.message', 'Folio 16576 registrado como cancelado.')
            ->assertSessionMissing('success');
        $this->assertSame(VoucherStatus::Cancelled, $voucher->status);
        $this->assertNull($voucher->direction);
        $this->assertNull($voucher->received_by_id);
        $this->assertNull($voucher->delivered_by_id);
        $this->assertSame(0, $voucher->items()->count());
        $this->assertNull($voucher->cancellation_reason);
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
        $this->assertNull($voucher->cancellation_reason);
    }

    public function test_a_cancelled_folio_can_store_private_evidence_when_created(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);

        $this->actingAs($user)->post(route('vouchers.cancelled.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16576',
            'issued_on' => '2026-08-27',
            'attachments' => [UploadedFile::fake()->create('vale-cancelado.pdf', 100, 'application/pdf')],
        ])->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $attachment = $voucher->attachments()->sole();

        $this->assertSame(VoucherStatus::Cancelled, $voucher->status);
        Storage::disk('local')->assertExists($attachment->path);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'uploaded',
            'auditable_type' => VoucherAttachment::class,
            'auditable_id' => $attachment->id,
        ]);
        $this->actingAs($user)->get(route('attachments.show', $attachment))
            ->assertDownload('vale-cancelado.pdf');
    }

    public function test_a_cancelled_folio_rejects_more_than_five_attachments(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);
        $attachments = [];
        for ($index = 1; $index <= 6; $index++) {
            $attachments[] = UploadedFile::fake()->create("vale-{$index}.pdf", 100, 'application/pdf');
        }

        $this->actingAs($user)->post(route('vouchers.cancelled.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16576',
            'issued_on' => '2026-08-27',
            'attachments' => $attachments,
        ])->assertSessionHasErrors('attachments');

        $this->assertDatabaseCount('vouchers', 0);
    }

    public function test_voucher_validation_messages_explain_the_field_that_needs_correction(): void
    {
        $user = User::factory()->create();
        [, $issuer, , $material] = $this->catalogs();
        $location = StorageLocation::factory()->create();
        $material->voucherTypes()->sync([$location->id]);

        $this->actingAs($user)->from(route('vouchers.create'))->post(route('vouchers.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '001-C',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-24',
            'received_by_id' => '',
            'delivered_by_id' => '',
            'authorized_by_id' => $issuer->id,
            'destination_ids' => ['ubicacion-invalida'],
            'items' => [
                ['material_id' => $material->id, 'quantity' => 1],
            ],
        ])->assertSessionHasErrors([
            'received_by_id' => 'Selecciona quién recibió el material.',
            'delivered_by_id' => 'Selecciona quién entregó el material.',
            'destination_ids.0' => 'La ubicación seleccionada no es válida. Vuelve a elegirla.',
        ]);
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
        $action = Action::query()->where('code', 'SPM-06-01')->sole();
        $payload = [
            'voucher_type_id' => $voucherType->id,
            'folio' => 'DEST-1',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-27',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'action_id' => $action->id,
            'destination_ids' => [$known->id],
            'new_destinations' => ['Fracc. Nuevo Horizonte'],
            'usage_description' => 'Actualización de luminarias',
            'items' => [[
                'material_id' => $material->id,
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

        $this->actingAs($user)->get(route('vouchers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sort', 'folio')
                ->where('filters.sort_direction', 'desc')
                ->where('vouchers.data.0.folio', '10')
                ->where('vouchers.data.1.folio', '2'));

        $this->actingAs($user)->get(route('vouchers.index', [
            'sort' => 'folio',
            'sort_direction' => 'asc',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'folio')
            ->where('filters.sort_direction', 'asc')
            ->where('vouchers.data.0.folio', '2')
            ->where('vouchers.data.1.folio', '10'));
    }

    public function test_voucher_index_exposes_and_sorts_material_totals_without_assigning_balances_to_non_operational_vouchers(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);
        $unit = Unit::factory()->create();
        $material = Material::factory()->create(['default_unit_id' => $unit->id]);

        $makeVoucher = function (
            string $folio,
            int $quantity,
            VoucherStatus $status = VoucherStatus::Active,
            ?VoucherDirection $direction = VoucherDirection::Exit,
        ) use ($location, $unit, $material): VoucherItem {
            $voucher = Voucher::factory()->create([
                'storage_location_id' => $location->id,
                'folio' => $folio,
                'folio_key' => Normalizer::folio($folio),
                'status' => $status,
                'direction' => $direction,
            ]);

            return VoucherItem::factory()->create([
                'voucher_id' => $voucher->id,
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'description_snapshot' => $material->name,
                'quantity' => $quantity,
            ]);
        };

        $pending = $makeVoucher('TOTAL-10', 10);
        MaterialApplication::factory()->create(['voucher_item_id' => $pending->id, 'quantity' => 6]);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $pending->id,
            'quantity' => 2,
            'voided_at' => now(),
        ]);

        $settled = $makeVoucher('TOTAL-5', 5);
        MaterialApplication::factory()->create(['voucher_item_id' => $settled->id, 'quantity' => 5]);

        $anomaly = $makeVoucher('TOTAL-2', 2);
        MaterialApplication::factory()->create(['voucher_item_id' => $anomaly->id, 'quantity' => 3]);

        $makeVoucher('ENTRY-20', 20, VoucherStatus::Active, VoucherDirection::Entry);
        $makeVoucher('LOANED-15', 15, VoucherStatus::Loaned, null);
        $makeVoucher('CANCELLED-12', 12, VoucherStatus::Cancelled, VoucherDirection::Exit);

        $this->actingAs($user)->get(route('vouchers.index', [
            'sort' => 'delivered',
            'sort_direction' => 'desc',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'delivered')
            ->where('vouchers.data.0.folio', 'ENTRY-20')
            ->where('vouchers.data.1.folio', 'LOANED-15')
            ->where('vouchers.data.2.folio', 'CANCELLED-12')
            ->where('vouchers.data.3.material_totals.registered_quantity', '10.000')
            ->where('vouchers.data.3.material_totals.applied_quantity', '6.000')
            ->where('vouchers.data.3.material_totals.pending_quantity', '4.000')
            ->where('vouchers.data.0.material_totals.applied_quantity', null)
            ->where('vouchers.data.1.material_totals.pending_quantity', null)
            ->where('vouchers.data.2.material_totals.pending_quantity', null));

        $this->actingAs($user)->get(route('vouchers.index', [
            'sort' => 'delivered',
            'sort_direction' => 'asc',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('vouchers.data.0.folio', 'TOTAL-2')
            ->where('vouchers.data.1.folio', 'TOTAL-5')
            ->where('vouchers.data.2.folio', 'TOTAL-10'));

        foreach ([
            ['used', 'desc', ['TOTAL-10', 'TOTAL-5', 'TOTAL-2']],
            ['used', 'asc', ['TOTAL-2', 'TOTAL-5', 'TOTAL-10']],
            ['pending', 'desc', ['TOTAL-10', 'TOTAL-5', 'TOTAL-2']],
            ['pending', 'asc', ['TOTAL-2', 'TOTAL-5', 'TOTAL-10']],
        ] as [$sort, $direction, $folios]) {
            $this->actingAs($user)->get(route('vouchers.index', [
                'sort' => $sort,
                'sort_direction' => $direction,
            ]))->assertOk()->assertInertia(fn (Assert $page) => $page
                ->where('filters.sort', $sort)
                ->where('filters.sort_direction', $direction)
                ->where('vouchers.data.0.folio', $folios[0])
                ->where('vouchers.data.1.folio', $folios[1])
                ->where('vouchers.data.2.folio', $folios[2]));
        }

        $this->actingAs($user)->get(route('vouchers.index', [
            'sort' => 'items_count',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'folio'));
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
                'quantity' => 1,
            ]],
        ])->assertSessionHasErrors('items.0.material_id');

        $this->assertDatabaseCount('vouchers', 0);
    }

    public function test_program_action_and_indicator_are_kept_when_changing_between_voucher_types(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $warehouse = StorageLocation::factory()->create(['code' => 'warehouse']);
        $yard = StorageLocation::factory()->create(['code' => 'yard']);
        $material->voucherTypes()->sync([$warehouse->id, $yard->id]);
        $destination = Destination::factory()->create();
        $program = Program::query()->where('code', 'SPM-06')->sole();
        $action = Action::query()->where('code', 'SPM-06-01')->sole();
        $indicator = $action->indicators()->sole();
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
                'quantity' => 1,
            ]],
        ];

        $this->actingAs($user)->post(route('vouchers.store'), $payload)
            ->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $this->assertSame($program->id, $voucher->program_id);
        $this->assertSame($action->id, $voucher->action_id);
        $this->assertSame($indicator->id, $voucher->action_indicator_id);

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            ...$payload,
            'voucher_type_id' => $yard->id,
            'items' => [[
                'id' => $voucher->items()->sole()->id,
                'material_id' => $material->id,
                'quantity' => 1,
            ]],
        ])->assertSessionHasNoErrors();

        $voucher->refresh();
        $this->assertSame($yard->id, $voucher->storage_location_id);
        $this->assertSame($program->id, $voucher->program_id);
        $this->assertSame($action->id, $voucher->action_id);
        $this->assertSame($indicator->id, $voucher->action_indicator_id);
    }

    public function test_exits_require_an_action_and_only_ask_for_an_indicator_when_ambiguous(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $yard = StorageLocation::factory()->create(['code' => 'yard']);
        $material->voucherTypes()->sync([$yard->id]);
        $destination = Destination::factory()->create();
        $action = Action::query()->where('code', 'SPM-06-06')->sole();
        $otherIndicator = Action::query()->where('code', 'SPM-06-08')->sole()->indicators()->firstOrFail();
        $indicator = $action->indicators()->orderBy('code')->firstOrFail();
        $payload = [
            'voucher_type_id' => $yard->id,
            'folio' => 'CLAS-MULTI',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-09-01',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination_ids' => [$destination->id],
            'items' => [[
                'material_id' => $material->id,
                'quantity' => 1,
            ]],
        ];

        $this->actingAs($user)->post(route('vouchers.store'), $payload)
            ->assertSessionHasErrors('action_id');
        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'action_id' => $action->id,
        ])->assertSessionHasErrors('action_indicator_id');
        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'action_id' => $action->id,
            'action_indicator_id' => $otherIndicator->id,
        ])->assertSessionHasErrors('action_indicator_id');
        $this->actingAs($user)->post(route('vouchers.store'), [
            ...$payload,
            'action_id' => $action->id,
            'action_indicator_id' => $indicator->id,
        ])->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $this->assertSame($action->id, $voucher->action_id);
        $this->assertSame($indicator->id, $voucher->action_indicator_id);
        $this->assertSame('SPM-06', $voucher->program->code);
    }

    public function test_updating_a_voucher_preserves_its_existing_review_reasons(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $warehouse = StorageLocation::factory()->create(['code' => 'warehouse']);
        $material->voucherTypes()->sync([$warehouse->id]);
        $destination = Destination::factory()->create();
        $action = Action::query()->where('code', 'SPM-06-02')->sole();
        $indicator = $action->indicators()->sole();
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $warehouse->id,
            'direction' => VoucherDirection::Exit,
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'program_id' => $action->program_id,
            'action_id' => $action->id,
            'action_indicator_id' => $indicator->id,
            'needs_review' => true,
            'review_reasons' => ['classification_requires_review', 'destination_split_uncertain'],
        ]);
        $voucher->destinations()->attach($destination);
        $item = VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
            'quantity' => 1,
        ]);
        $payload = [
            'voucher_type_id' => $warehouse->id,
            'folio' => $voucher->folio,
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => $voucher->issued_on->format('Y-m-d'),
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'action_id' => $action->id,
            'destination_ids' => [$destination->id],
            'items' => [[
                'id' => $item->id,
                'material_id' => $material->id,
                'quantity' => 1,
            ]],
        ];

        $this->actingAs($user)->put(route('vouchers.update', $voucher), $payload)
            ->assertSessionHasNoErrors();
        $voucher->refresh();
        $this->assertTrue($voucher->needs_review);
        $this->assertSame(['classification_requires_review', 'destination_split_uncertain'], $voucher->review_reasons);

        $voucher->update([
            'needs_review' => true,
            'review_reasons' => ['classification_requires_review'],
        ]);
        $this->actingAs($user)->put(route('vouchers.update', $voucher), $payload)
            ->assertSessionHasNoErrors();
        $voucher->refresh();
        $this->assertTrue($voucher->needs_review);
        $this->assertSame(['classification_requires_review'], $voucher->review_reasons);
    }

    public function test_an_unclassified_historical_voucher_can_be_updated_without_reclassification(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $warehouse = StorageLocation::factory()->create(['code' => 'warehouse']);
        $material->voucherTypes()->sync([$warehouse->id]);
        $destination = Destination::factory()->create();
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $warehouse->id,
            'direction' => VoucherDirection::Exit,
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'needs_review' => true,
            'review_reasons' => ['classification_requires_review'],
        ]);
        $voucher->destinations()->attach($destination);
        $item = VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
            'quantity' => 1,
        ]);

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            'voucher_type_id' => $warehouse->id,
            'folio' => $voucher->folio,
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => $voucher->issued_on->format('Y-m-d'),
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination_ids' => [$destination->id],
            'items' => [[
                'id' => $item->id,
                'material_id' => $material->id,
                'quantity' => 1,
            ]],
        ])->assertSessionHasNoErrors();

        $voucher->refresh();
        $this->assertNull($voucher->program_id);
        $this->assertNull($voucher->action_id);
        $this->assertNull($voucher->action_indicator_id);
        $this->assertTrue($voucher->needs_review);
        $this->assertSame(['classification_requires_review'], $voucher->review_reasons);
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

        $this->assertSame(2, $summary['total_missing']);
        $this->assertSame([16577], collect($summary['types'])->firstWhere('voucher_type.code', 'warehouse')['missing']);
        $this->assertSame([3754], collect($summary['types'])->firstWhere('voucher_type.code', 'yard')['missing']);
    }

    public function test_voucher_sequence_ignores_invalid_traces_and_bounds_large_missing_ranges(): void
    {
        config()->set('material-control.voucher_sequence_starts', ['warehouse' => 16576]);
        $warehouse = StorageLocation::factory()->create(['code' => 'warehouse', 'name' => 'Almacén']);
        Voucher::factory()->create([
            'storage_location_id' => $warehouse->id,
            'folio' => '1000000',
            'folio_key' => '1000000',
            'status' => VoucherStatus::Active,
        ]);
        LegacyImportRow::create([
            'source_hash' => str_repeat('a', 64),
            'source_name' => 'prueba.xlsx',
            'sheet_name' => 'Vale de Almacen',
            'row_number' => 10,
            'raw_data' => ['folio' => '2000000'],
            'issue_codes' => ['invalid_movement'],
        ]);

        $summary = app(VoucherSequence::class)->summary();
        $warehouseSummary = $summary['types'][0];

        $this->assertSame(983424, $summary['total_missing']);
        $this->assertSame(983424, $warehouseSummary['missing_count']);
        $this->assertCount(100, $warehouseSummary['missing']);
        $this->assertSame(16576, $warehouseSummary['missing'][0]);
        $this->assertSame(16675, $warehouseSummary['missing'][99]);
        $this->assertTrue($warehouseSummary['missing_truncated']);
        $this->assertSame(1000000, $warehouseSummary['last']);
    }

    public function test_tracking_summaries_do_not_load_detailed_report_or_attachment_relations(): void
    {
        $item = $this->voucherItem(10);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $item->id,
            'quantity' => 2,
        ]);
        $voucher = $item->voucher->fresh();

        $tracking = MaterialTracking::overview(collect([$voucher]));

        $this->assertCount(1, $tracking['rows']);
        $this->assertFalse($voucher->relationLoaded('applicationReports'));
        $this->assertFalse($voucher->relationLoaded('attachments'));
        $this->assertTrue($voucher->relationLoaded('items'));
        $this->assertFalse($voucher->items->first()->applications->first()->relationLoaded('report'));
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
        $destinationCount = Destination::query()->count();
        $secondMaterial = Material::factory()->create(['default_unit_id' => $item->unit_id]);
        $secondItem = VoucherItem::factory()->create([
            'voucher_id' => $item->voucher_id,
            'material_id' => $secondMaterial->id,
            'unit_id' => $item->unit_id,
            'description_snapshot' => $secondMaterial->name,
            'quantity' => 3,
        ]);

        $applicationResponse = $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'reference' => 'Reporte 17',
            'service_order_type' => ServiceOrderType::CitizenService072->value,
            'location' => 'Calle Constitución 125, Zona Centro',
            'items' => [
                ['voucher_item_id' => $item->id, 'quantity' => 6],
                ['voucher_item_id' => $secondItem->id, 'quantity' => 2],
            ],
        ]);
        $applicationResponse
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('toast.type', 'success')
            ->assertInertiaFlash('toast.message', 'Aplicaciones registradas correctamente.')
            ->assertSessionMissing('success');

        $item->refresh()->load('applications');
        $this->assertSame('6.000', $item->usedQuantity());
        $this->assertSame('4.000', $item->pendingQuantity());
        $this->assertSame('1.000', $secondItem->fresh()->pendingQuantity());
        $this->assertSame(1, MaterialApplicationReport::query()->count());
        $this->assertSame(2, MaterialApplication::query()->count());
        $this->assertSame(
            ['Calle Constitución 125, Zona Centro'],
            MaterialApplication::query()->distinct()->pluck('destination_snapshot')->all(),
        );
        $this->assertSame($destinationCount, Destination::query()->count());

        $this->actingAs($user)->get(route('vouchers.show', $item->voucher))
            ->assertInertia(fn (Assert $page) => $page
                ->where('applicationFormOptions.default_service_order_type', ServiceOrderType::Normal->value)
                ->where('applicationFormOptions.service_order_types.0.value', ServiceOrderType::Normal->value)
                ->where('applicationFormOptions.service_order_types.1.value', ServiceOrderType::CitizenService072->value)
                ->where('applicationFormOptions.destinations.0.name', 'Col. San Carlos'));

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'reference' => 'OS-17',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 1.5]],
        ])->assertSessionHasErrors('items.0.quantity');
        $this->assertSame(2, MaterialApplication::query()->count());
        $this->assertSame(1, MaterialApplicationReport::query()->count());

        $foreignItem = $this->voucherItem(1);
        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'reference' => 'OS-18',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [
                ['voucher_item_id' => $item->id, 'quantity' => 1],
                ['voucher_item_id' => $foreignItem->id, 'quantity' => 1],
            ],
        ])->assertSessionHasErrors('items');
        $this->assertSame(2, MaterialApplication::query()->count());
        $this->assertSame(1, MaterialApplicationReport::query()->count());
    }

    public function test_an_application_report_can_be_corrected_without_erasing_previous_quantities(): void
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
            'reference' => 'OS-2408',
            'service_order_type' => ServiceOrderType::Normal->value,
            'location' => 'Parque Guadiana',
            'items' => [
                ['voucher_item_id' => $item->id, 'quantity' => 6],
                ['voucher_item_id' => $secondItem->id, 'quantity' => 2],
            ],
        ])->assertSessionHasNoErrors();

        $report = MaterialApplicationReport::query()->sole();
        $originalApplicationIds = $report->applications()->pluck('id')->all();
        $initialData = VoucherData::make($item->voucher->fresh(), true);
        $this->assertSame('OS-2408', $initialData['application_reports'][0]['service_order']);
        $this->assertSame('normal', $initialData['application_reports'][0]['service_order_type']);
        $this->assertSame('Parque Guadiana', $initialData['application_reports'][0]['location']);
        $this->assertCount(2, $initialData['application_reports'][0]['applications']);

        $this->actingAs($user)->put(route('application-reports.update', $report), [
            'occurred_on' => '2026-08-27',
            'reference' => 'OS-24391',
            'service_order_type' => ServiceOrderType::CitizenService072->value,
            'location' => 'Blvd. Dolores del Río 40',
            'notes' => 'Luminaria instalada frente al acceso principal.',
            'correction_reason' => 'Corrección de cantidades reportadas',
            'items' => [
                ['voucher_item_id' => $item->id, 'quantity' => 4],
                ['voucher_item_id' => $secondItem->id, 'quantity' => 3],
            ],
        ])->assertSessionHasNoErrors();

        $report->refresh();
        $this->assertSame('2026-08-27', $report->occurred_on->toDateString());
        $this->assertSame('OS-24391', $report->reference);
        $this->assertSame(ServiceOrderType::CitizenService072, $report->service_order_type);
        $this->assertSame('Blvd. Dolores del Río 40', $report->location);
        $this->assertSame('Luminaria instalada frente al acceso principal.', $report->notes);
        $this->assertSame('6.000', $item->fresh()->pendingQuantity());
        $this->assertSame('0.000', $secondItem->fresh()->pendingQuantity());
        $this->assertSame(4, $report->applications()->count());
        $this->assertSame(
            [4.0, 3.0],
            $report->applications()->whereNull('voided_at')->orderBy('voucher_item_id')->pluck('quantity')->map(fn (string $quantity): float => (float) $quantity)->all(),
        );
        $this->assertSame(
            ['Corrección de cantidades reportadas'],
            MaterialApplication::query()->whereKey($originalApplicationIds)->distinct()->pluck('void_reason')->all(),
        );
        $this->assertDatabaseHas('audit_events', [
            'event' => 'corrected',
            'auditable_type' => MaterialApplicationReport::class,
            'auditable_id' => $report->id,
        ]);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'voided_for_correction',
            'auditable_type' => MaterialApplication::class,
            'auditable_id' => $originalApplicationIds[0],
        ]);

        $data = VoucherData::make($item->voucher->fresh(), true);
        $this->assertCount(1, $data['application_reports']);
        $this->assertSame('OS-24391', $data['application_reports'][0]['service_order']);
        $this->assertSame('072', $data['application_reports'][0]['service_order_type']);
        $this->assertSame('Blvd. Dolores del Río 40', $data['application_reports'][0]['location']);
        $this->assertCount(4, $data['application_reports'][0]['applications']);
    }

    public function test_correcting_an_application_report_cannot_exceed_the_available_balance(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'reference' => 'OS-2409',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 6]],
        ])->assertSessionHasNoErrors();

        $report = MaterialApplicationReport::query()->sole();
        $this->actingAs($user)->put(route('application-reports.update', $report), [
            'occurred_on' => '2026-08-24',
            'reference' => 'OS-2409',
            'service_order_type' => ServiceOrderType::Normal->value,
            'correction_reason' => 'Ajuste de cantidad capturada',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 8.5]],
        ])->assertSessionHasErrors('items.0.quantity');

        $this->assertSame(1, $report->applications()->count());
        $this->assertSame('6.000', $item->fresh()->usedQuantity());
    }

    public function test_an_application_report_can_be_annulled_by_correcting_all_its_quantities_to_zero(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-24',
            'reference' => 'OS-2410',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 6]],
        ])->assertSessionHasNoErrors();

        $report = MaterialApplicationReport::query()->sole();
        $application = $report->applications()->sole();

        $this->actingAs($user)->put(route('application-reports.update', $report), [
            'occurred_on' => '2026-08-24',
            'reference' => 'OS-2410',
            'service_order_type' => ServiceOrderType::Normal->value,
            'correction_reason' => 'Aplicación capturada por duplicado',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 0]],
        ])->assertSessionHasNoErrors();

        $this->assertNotNull($application->fresh()->voided_at);
        $this->assertSame('Aplicación capturada por duplicado', $application->fresh()->void_reason);
        $this->assertSame('10.000', $item->fresh()->pendingQuantity());
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

    public function test_cancelling_a_voucher_can_preserve_active_applications_as_read_only_history(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $application = MaterialApplication::factory()->create(['voucher_item_id' => $item->id, 'quantity' => 1]);

        $this->actingAs($user)->post(route('vouchers.cancel', $item->voucher), [
            'reason' => 'El vale ya no corresponde',
            'void_applications' => false,
        ])->assertSessionHasNoErrors();

        $voucher = $item->voucher->fresh();
        $this->assertSame(VoucherStatus::Cancelled, $voucher->status);
        $this->assertNull($application->fresh()->voided_at);
        $this->assertSame('cancelled', VoucherData::make($voucher, true)['balance_state']);
        $this->assertFalse(VoucherData::make($voucher, true)['application_reports'][0]['permissions']['update']);

        $this->actingAs($user)->post(route('applications.void', $application), [
            'reason' => 'Intento posterior a la cancelación',
        ])->assertForbidden();

        $this->actingAs($user)->get(route('reports.material-tracking', [
            'voucher_type_id' => 'all',
        ]))->assertInertia(fn (Assert $page) => $page
            ->where('metrics.delivered_vouchers', 0)
            ->has('rows', 0));
    }

    public function test_cancelling_a_voucher_can_void_all_active_applications_with_audit(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $first = MaterialApplication::factory()->create(['voucher_item_id' => $item->id, 'quantity' => 1]);
        $second = MaterialApplication::factory()->create(['voucher_item_id' => $item->id, 'quantity' => 2]);

        $this->actingAs($user)->post(route('vouchers.cancel', $item->voucher), [
            'reason' => '',
            'void_applications' => true,
        ])->assertSessionHasNoErrors();

        $this->assertSame(VoucherStatus::Cancelled, $item->voucher->fresh()->status);
        foreach ([$first, $second] as $application) {
            $application->refresh();
            $this->assertNotNull($application->voided_at);
            $this->assertSame($user->id, $application->voided_by);
            $this->assertSame("Anulada al cancelar el vale {$item->voucher->folio}.", $application->void_reason);
            $this->assertDatabaseHas('audit_events', [
                'event' => 'voided_on_voucher_cancellation',
                'auditable_type' => MaterialApplication::class,
                'auditable_id' => $application->id,
            ]);
        }
    }

    public function test_an_administrator_can_mark_an_active_voucher_as_loaned_and_keep_its_original_data(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $voucher = $item->voucher;
        $item->material->voucherTypes()->sync([$voucher->storage_location_id]);
        $destination = Destination::factory()->create();
        $action = Action::query()->where('code', 'SPM-06-01')->sole();
        $indicator = $action->indicators()->firstOrFail();
        $voucher->update([
            'authorized_by_id' => $voucher->delivered_by_id,
            'program_id' => $action->program_id,
            'action_id' => $action->id,
            'action_indicator_id' => $indicator->id,
            'usage_description' => 'Trabajo originalmente registrado',
            'notes' => 'Conservar como referencia',
            'needs_review' => true,
            'review_reasons' => ['Dato original por confirmar'],
        ]);
        $voucher->destinations()->sync([$destination->id]);
        $application = MaterialApplication::factory()->create([
            'voucher_item_id' => $item->id,
            'quantity' => 3,
        ]);
        $attachment = VoucherAttachment::create([
            'voucher_id' => $voucher->id,
            'disk' => 'local',
            'path' => 'voucher-attachments/converted-loan.pdf',
            'original_name' => 'vale.pdf',
            'mime_type' => 'application/pdf',
            'size' => 10,
            'uploaded_by' => $user->id,
        ]);

        $response = $this->actingAs($user)->post(route('vouchers.loan', $voucher), [
            'loaned_to_name' => '  Responsable externo  ',
            'void_applications' => true,
        ]);

        $voucher->refresh();
        $response
            ->assertRedirect(route('vouchers.show', $voucher))
            ->assertInertiaFlash('toast.type', 'success')
            ->assertInertiaFlash('toast.message', "Vale {$voucher->folio} marcado como prestado.");
        $this->assertSame(VoucherStatus::Loaned, $voucher->status);
        $this->assertSame('Responsable externo', $voucher->loaned_to_name);
        $this->assertSame($voucher->issued_on->toDateString(), $voucher->loaned_on?->toDateString());
        $this->assertSame(VoucherDirection::Exit, $voucher->direction);
        $this->assertSame($action->program_id, $voucher->program_id);
        $this->assertSame($action->id, $voucher->action_id);
        $this->assertSame($indicator->id, $voucher->action_indicator_id);
        $this->assertSame('Trabajo originalmente registrado', $voucher->usage_description);
        $this->assertSame('Conservar como referencia', $voucher->notes);
        $this->assertTrue($voucher->needs_review);
        $this->assertSame([$destination->id], $voucher->destinations()->pluck('destinations.id')->all());
        $this->assertDatabaseHas('voucher_items', [
            'id' => $item->id,
            'voucher_id' => $voucher->id,
            'quantity' => '10.000',
        ]);
        $this->assertDatabaseHas('voucher_attachments', ['id' => $attachment->id]);

        $application->refresh();
        $this->assertNotNull($application->voided_at);
        $this->assertSame($user->id, $application->voided_by);
        $this->assertSame("Anulada al marcar el vale {$voucher->folio} como prestado.", $application->void_reason);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'voided_on_voucher_loan',
            'auditable_type' => MaterialApplication::class,
            'auditable_id' => $application->id,
        ]);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'marked_loaned',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
            'user_id' => $user->id,
        ]);

        $data = VoucherData::make($voucher, true);
        $this->assertSame('loaned', $data['balance_state']);
        $this->assertNull($data['material_totals']['applied_quantity']);
        $this->assertNull($data['material_totals']['pending_quantity']);
        $this->assertFalse($data['permissions']['mark_loaned']);

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            'voucher_type_id' => $voucher->storage_location_id,
            'folio' => $voucher->folio,
            'issued_on' => $voucher->issued_on->toDateString(),
            'received_by_id' => $voucher->received_by_id,
            'loaned_to_name' => $voucher->loaned_to_name,
            'items' => [[
                'id' => $item->id,
                'material_id' => $item->material_id,
                'quantity' => 9,
            ]],
        ])->assertSessionHasErrors('items');
        $this->assertSame('10.000', $item->fresh()->quantity);
        $this->assertDatabaseHas('material_applications', ['id' => $application->id]);

        $this->actingAs($user)->get(route('reports.material-tracking', [
            'voucher_type_id' => 'all',
        ]))->assertInertia(fn (Assert $page) => $page
            ->where('metrics.delivered_vouchers', 0)
            ->has('rows', 0));

        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $voucher->id,
            'occurred_on' => '2026-08-29',
            'reference' => 'OS-LOAN-CONVERTED',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 1]],
        ])->assertForbidden();
    }

    public function test_marking_a_voucher_as_loaned_can_keep_applications_as_read_only_history(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $application = MaterialApplication::factory()->create([
            'voucher_item_id' => $item->id,
            'quantity' => 2,
        ]);
        $item->material->voucherTypes()->sync([$item->voucher->storage_location_id]);

        $this->actingAs($user)->post(route('vouchers.loan', $item->voucher), [
            'loaned_to_name' => '',
            'void_applications' => false,
        ])->assertSessionHasNoErrors();

        $voucher = $item->voucher->fresh();
        $this->assertSame(VoucherStatus::Loaned, $voucher->status);
        $this->assertNull($voucher->loaned_to_name);
        $this->assertNull($application->fresh()->voided_at);
        $this->assertFalse(VoucherData::make($voucher, true)['application_reports'][0]['permissions']['update']);

        $this->actingAs($user)->post(route('applications.void', $application), [
            'reason' => 'Intento posterior a la conversión',
        ])->assertForbidden();

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            'voucher_type_id' => $voucher->storage_location_id,
            'folio' => $voucher->folio,
            'issued_on' => $voucher->issued_on->toDateString(),
            'received_by_id' => $voucher->received_by_id,
            'loaned_to_name' => '',
            'items' => [[
                'id' => $item->id,
                'material_id' => $item->material_id,
                'quantity' => 9,
            ]],
        ])->assertSessionHasErrors('items');

        $this->assertSame('10.000', $item->fresh()->quantity);
        $this->assertDatabaseHas('material_applications', ['id' => $application->id]);
    }

    public function test_only_an_administrator_can_mark_an_active_voucher_as_loaned(): void
    {
        $item = $this->voucherItem(10);
        $technician = User::factory()->technician($item->voucher->receivedBy)->create();

        $this->actingAs($technician)
            ->post(route('vouchers.loan', $item->voucher))
            ->assertForbidden();
        $this->assertSame(VoucherStatus::Active, $item->voucher->fresh()->status);

        $administrator = User::factory()->create();
        $item->voucher->update(['status' => VoucherStatus::Cancelled]);
        $this->actingAs($administrator)
            ->post(route('vouchers.loan', $item->voucher))
            ->assertForbidden();
    }

    public function test_an_administrator_can_permanently_delete_a_voucher_and_its_complete_footprint(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $item = $this->voucherItem(10);
        $voucher = $item->voucher;
        $report = MaterialApplicationReport::create([
            'voucher_id' => $voucher->id,
            'occurred_on' => '2026-08-25',
            'reference' => 'OS-DELETE',
            'service_order_type' => ServiceOrderType::Normal,
            'created_by' => $user->id,
        ]);
        $application = MaterialApplication::factory()->create([
            'voucher_item_id' => $item->id,
            'application_report_id' => $report->id,
            'quantity' => 2,
        ]);
        $voucherAttachment = VoucherAttachment::create([
            'voucher_id' => $voucher->id,
            'disk' => 'local',
            'path' => 'voucher-attachments/delete-voucher.pdf',
            'original_name' => 'vale.pdf',
            'mime_type' => 'application/pdf',
            'size' => 10,
            'uploaded_by' => $user->id,
        ]);
        $applicationAttachment = MaterialApplicationAttachment::create([
            'application_report_id' => $report->id,
            'disk' => 'local',
            'path' => 'application-attachments/delete-application.pdf',
            'original_name' => 'aplicacion.pdf',
            'mime_type' => 'application/pdf',
            'size' => 10,
            'uploaded_by' => $user->id,
        ]);
        Storage::disk('local')->put($voucherAttachment->path, 'voucher');
        Storage::disk('local')->put($applicationAttachment->path, 'application');
        $trace = LegacyImportRow::create([
            'source_hash' => str_repeat('a', 64),
            'source_name' => 'control.xlsx',
            'sheet_name' => 'Vale de Almacen',
            'row_number' => 10,
            'raw_data' => ['folio' => $voucher->folio],
            'imported_type' => Voucher::class,
            'imported_id' => $voucher->id,
        ]);

        foreach ([$voucher, $item, $report, $application, $voucherAttachment, $applicationAttachment] as $auditable) {
            AuditEvent::record($auditable, 'created', null, $auditable->toArray());
        }
        AuditEvent::create([
            'user_id' => $user->id,
            'event' => 'removed',
            'auditable_type' => VoucherItem::class,
            'auditable_id' => 999999,
            'before' => ['id' => 999999, 'voucher_id' => $voucher->id],
        ]);
        $unrelatedAudit = AuditEvent::record($item->material, 'updated', null, $item->material->toArray());

        $this->actingAs($user)
            ->delete(route('vouchers.destroy', $voucher))
            ->assertRedirect(route('vouchers.index'))
            ->assertInertiaFlash('toast.type', 'success')
            ->assertInertiaFlash('toast.message', "Vale {$voucher->folio} eliminado definitivamente.")
            ->assertSessionMissing('success');

        $this->assertDatabaseMissing('vouchers', ['id' => $voucher->id]);
        $this->assertDatabaseMissing('voucher_items', ['id' => $item->id]);
        $this->assertDatabaseMissing('material_application_reports', ['id' => $report->id]);
        $this->assertDatabaseMissing('material_applications', ['id' => $application->id]);
        $this->assertDatabaseMissing('voucher_attachments', ['id' => $voucherAttachment->id]);
        $this->assertDatabaseMissing('material_application_attachments', ['id' => $applicationAttachment->id]);
        $this->assertDatabaseMissing('legacy_import_rows', ['id' => $trace->id]);
        $this->assertSame(1, AuditEvent::query()->count());
        $this->assertDatabaseHas('audit_events', ['id' => $unrelatedAudit->id]);
        Storage::disk('local')->assertMissing($voucherAttachment->path);
        Storage::disk('local')->assertMissing($applicationAttachment->path);
    }

    public function test_a_technician_cannot_permanently_delete_a_voucher(): void
    {
        $item = $this->voucherItem(10);
        $technician = User::factory()->technician($item->voucher->receivedBy)->create();

        $this->actingAs($technician)
            ->delete(route('vouchers.destroy', $item->voucher))
            ->assertForbidden();

        $this->assertDatabaseHas('vouchers', ['id' => $item->voucher_id]);
    }

    public function test_an_administrator_can_delete_cancelled_and_loaned_vouchers(): void
    {
        $user = User::factory()->create();

        foreach ([VoucherStatus::Cancelled, VoucherStatus::Loaned] as $status) {
            $voucher = Voucher::factory()->create(['status' => $status]);

            $this->actingAs($user)
                ->delete(route('vouchers.destroy', $voucher))
                ->assertRedirect(route('vouchers.index'));

            $this->assertDatabaseMissing('vouchers', ['id' => $voucher->id]);
        }
    }

    public function test_a_registered_exit_can_be_cancelled_as_unused_without_changing_its_quantities(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(10);

        $response = $this->actingAs($user)->post(route('vouchers.cancel', $item->voucher), [
            'reason' => '   ',
        ]);

        $voucher = $item->voucher->fresh();
        $response->assertRedirect(route('vouchers.show', $voucher));
        $this->assertSame(VoucherStatus::Cancelled, $voucher->status);
        $this->assertNull($voucher->cancellation_reason);
        $this->assertNotNull($voucher->cancelled_at);
        $this->assertSame($user->id, $voucher->cancelled_by);
        $this->assertSame('10.000', $item->fresh()->quantity);
        $this->assertSame('10.000', $item->fresh()->pendingQuantity());
        $this->assertSame('cancelled', VoucherData::make($voucher)['balance_state']);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'cancelled',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
            'user_id' => $user->id,
        ]);

        $this->actingAs($user)->get(route('reports.material-tracking', [
            'voucher_type_id' => 'all',
        ]))->assertInertia(fn (Assert $page) => $page
            ->where('metrics.delivered_vouchers', 0)
            ->has('rows', 0));
    }

    public function test_a_registered_entry_can_be_cancelled_with_an_optional_trimmed_reason(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(5, VoucherDirection::Entry);

        $this->actingAs($user)->post(route('vouchers.cancel', $item->voucher), [
            'reason' => '  Registro duplicado  ',
        ])->assertSessionHasNoErrors();

        $voucher = $item->voucher->fresh();
        $this->assertSame(VoucherStatus::Cancelled, $voucher->status);
        $this->assertSame('Registro duplicado', $voucher->cancellation_reason);
        $this->assertSame('5.000', $item->fresh()->quantity);
    }

    public function test_an_optional_cancellation_reason_must_be_meaningful_when_present(): void
    {
        $user = User::factory()->create();
        $item = $this->voucherItem(2);

        $this->actingAs($user)->post(route('vouchers.cancel', $item->voucher), [
            'reason' => 'No',
        ])->assertSessionHasErrors([
            'reason' => 'Si escribes un motivo, usa al menos 5 caracteres.',
        ]);
        $this->actingAs($user)->post(route('vouchers.cancel', $item->voucher), [
            'reason' => str_repeat('a', 1001),
        ])->assertSessionHasErrors([
            'reason' => 'El motivo de cancelación no puede tener más de 1,000 caracteres.',
        ]);

        $this->assertSame(VoucherStatus::Active, $item->voucher->fresh()->status);
    }

    public function test_a_loaned_folio_can_store_optional_responsibility_and_material_without_becoming_operational(): void
    {
        $user = User::factory()->create();
        [$technician, , $unit, $material, $unavailableMaterial] = $this->catalogs();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);
        $material->voucherTypes()->sync([$location->id]);
        $unavailableMaterial->voucherTypes()->detach($location->id);

        $response = $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16582',
            'issued_on' => '2026-08-27',
            'loaned_to_name' => 'Marco Ruiz',
            'received_by_id' => $technician->id,
            'items' => [['material_id' => $material->id, 'quantity' => 4]],
        ])->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $response
            ->assertRedirect(route('vouchers.show', $voucher))
            ->assertInertiaFlash('toast.type', 'success')
            ->assertInertiaFlash('toast.message', 'Folio 16582 registrado como prestado.')
            ->assertSessionMissing('success');
        $this->assertSame(VoucherStatus::Loaned, $voucher->status);
        $this->assertSame('Marco Ruiz', $voucher->loaned_to_name);
        $this->assertNull($voucher->direction);
        $this->assertSame($technician->id, $voucher->received_by_id);
        $this->assertNull($voucher->delivered_by_id);
        $this->assertNull($voucher->authorized_by_id);
        $item = $voucher->items()->sole();
        $this->assertSame($material->id, $item->material_id);
        $this->assertSame($unit->id, $item->unit_id);
        $this->assertSame('4.000', $item->quantity);
        $this->assertSame('loaned', VoucherData::make($voucher)['balance_state']);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'created_loaned',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
        ]);
        $this->actingAs($user)->post(route('applications.store'), [
            'voucher_id' => $voucher->id,
            'occurred_on' => '2026-08-29',
            'reference' => 'OS-LOANED',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 1]],
        ])->assertForbidden();

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            'voucher_type_id' => $location->id,
            'folio' => '16583',
            'issued_on' => '2026-08-28',
            'loaned_to_name' => '',
            'received_by_id' => '',
            'items' => [],
        ])->assertSessionHasNoErrors();
        $voucher->refresh();
        $this->assertSame('16583', $voucher->folio);
        $this->assertNull($voucher->loaned_to_name);
        $this->assertNull($voucher->received_by_id);
        $this->assertSame(0, $voucher->items()->count());
        $this->assertSame('2026-08-28', $voucher->loaned_on?->toDateString());
        $this->assertDatabaseHas('audit_events', [
            'event' => 'updated_loaned',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
        ]);

        $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16584',
            'issued_on' => '2026-08-29',
        ])->assertSessionHasNoErrors();
        $this->assertSame(2, Voucher::query()->count());

        $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16585',
            'issued_on' => '2026-08-29',
            'items' => [['material_id' => $unavailableMaterial->id, 'quantity' => 1]],
        ])->assertSessionHasErrors('items.0.material_id');
        $this->assertSame(2, Voucher::query()->count());

        $this->actingAs($user)->post(route('vouchers.cancel', $voucher), [
            'reason' => 'No corresponde',
        ])->assertStatus(422);
        $this->actingAs($user)->post(route('vouchers.loan', $voucher), [])
            ->assertForbidden();
        $this->actingAs($user)->post('/vouchers/'.$voucher->id.'/return', [])
            ->assertNotFound();
        $this->actingAs($user)->getJson(route('applications.vouchers.search', ['search' => '16583']))
            ->assertOk()
            ->assertJsonCount(0, 'data');

    }

    public function test_a_loaned_folio_can_store_private_evidence_when_created(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);

        $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16582',
            'issued_on' => '2026-08-27',
            'attachments' => [UploadedFile::fake()->create('vale-prestado.jpg', 100, 'image/jpeg')],
        ])->assertSessionHasNoErrors();

        $voucher = Voucher::query()->sole();
        $attachment = $voucher->attachments()->sole();

        $this->assertSame(VoucherStatus::Loaned, $voucher->status);
        $this->assertSame('loaned', VoucherData::make($voucher)['balance_state']);
        Storage::disk('local')->assertExists($attachment->path);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'uploaded',
            'auditable_type' => VoucherAttachment::class,
            'auditable_id' => $attachment->id,
        ]);
    }

    public function test_a_loaned_folio_rejects_invalid_evidence_when_created(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);

        $this->actingAs($user)->post(route('vouchers.loaned.store'), [
            'voucher_type_id' => $location->id,
            'folio' => '16582',
            'issued_on' => '2026-08-27',
            'attachments' => [UploadedFile::fake()->create('vale.exe', 100, 'application/octet-stream')],
        ])->assertSessionHasErrors('attachments.0');

        $this->assertDatabaseCount('vouchers', 0);
    }

    public function test_voucher_attachments_are_private_and_downloadable_only_after_authentication(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material] = $this->catalogs();
        $location = StorageLocation::factory()->create();
        $action = Action::query()->where('code', 'SPM-06-01')->sole();

        $this->actingAs($user)->post(route('vouchers.store'), [
            'voucher_type_id' => $location->id,
            'folio' => 'ADJ-1',
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => '2026-08-24',
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'action_id' => $action->id,
            'usage_description' => 'Taller municipal',
            'items' => [['material_id' => $material->id, 'quantity' => 2]],
            'attachments' => [UploadedFile::fake()->create('vale.pdf', 100, 'application/pdf')],
        ])->assertSessionHasNoErrors();

        $attachment = Voucher::query()->sole()->attachments()->sole();
        Storage::disk('local')->assertExists($attachment->path);
        auth()->logout();
        $this->get(route('attachments.show', $attachment))->assertRedirect(route('login'));
        $this->actingAs($user)->get(route('attachments.show', $attachment))->assertDownload('vale.pdf');
        $this->actingAs($user)->get(route('attachments.preview', $attachment))
            ->assertOk()
            ->assertHeader('content-disposition', 'inline; filename=vale.pdf');
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
            'service_order_type' => ServiceOrderType::Normal->value,
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
        $report = MaterialApplicationReport::create([
            'voucher_id' => $pending->voucher_id,
            'occurred_on' => '2026-08-25',
            'reference' => 'OS-QUICK-156',
            'service_order_type' => ServiceOrderType::Normal,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
        MaterialApplication::create([
            'voucher_item_id' => $pending->id,
            'application_report_id' => $report->id,
            'occurred_on' => '2026-08-25',
            'quantity' => 1,
            'reference' => 'OS-QUICK-156',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
        $voided = $this->voucherItem(3);
        $voidedReport = MaterialApplicationReport::create([
            'voucher_id' => $voided->voucher_id,
            'occurred_on' => '2026-08-25',
            'reference' => 'OS-ANULADA-404',
            'service_order_type' => ServiceOrderType::Normal,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
        MaterialApplication::create([
            'voucher_item_id' => $voided->id,
            'application_report_id' => $voidedReport->id,
            'occurred_on' => '2026-08-25',
            'quantity' => 1,
            'reference' => 'OS-ANULADA-404',
            'voided_at' => now(),
            'void_reason' => 'Captura duplicada',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $this->actingAs($user)
            ->getJson(route('applications.vouchers.search', ['search' => '1562']))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.folio', '15628')
            ->assertJsonPath('data.0.items.0.pending_quantity', '9.000');

        $this->actingAs($user)
            ->getJson(route('applications.vouchers.search', ['search' => 'QUICK-156']))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.folio', '15628');

        $this->actingAs($user)
            ->getJson(route('applications.vouchers.search', ['search' => 'ANULADA-404']))
            ->assertOk()
            ->assertJsonCount(0, 'data');
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
            'reference' => 'OS-ENTRADA',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 1]],
        ])->assertForbidden();
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
            ->has('rows', 2)
            ->where('rows.0.issued_on', '2026-02-10')
            ->where('rows.1.issued_on', '2026-01-10'));
    }

    public function test_tracking_text_search_finds_complete_vouchers_by_their_visible_context(): void
    {
        [$user, , , $yard] = $this->trackingSearchFixtures();

        foreach (['16583', 'jose luis', 'otinapa', 'modernización', 'lampara', 'modelo legado', '072-9981'] as $search) {
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

        $this->actingAs($user)->get(route('vouchers.index', [
            'search' => '072-9981',
            'voucher_type_id' => 'all',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('vouchers/index')
            ->has('vouchers.data', 1)
            ->where('vouchers.data.0.folio', '16-583'));

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
            'search' => '072-9981',
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
        $this->assertStringContainsString('OS-072-9981', $xml);
        $this->assertStringContainsString('Parque Guadiana, acceso norte', $xml);
        $this->assertStringContainsString('Se atendió el reporte ciudadano.', $xml);
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
            'is_luminaire' => false,
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

    public function test_catalog_corrections_are_global_and_audited(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $piece, $material] = $this->catalogs();
        $metre = Unit::factory()->create(['name' => 'Metro', 'symbol' => 'm']);
        $location = StorageLocation::factory()->create();
        $material->voucherTypes()->sync([$location->id]);
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $location->id,
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
        ]);
        $item = VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $material->id,
            'unit_id' => $piece->id,
            'description_snapshot' => 'Nombre anterior del material',
            'quantity' => 5,
        ]);

        $this->actingAs($user)->put(route('catalogs.materials.update', $material), [
            'name' => 'Cable canónico',
            'default_unit_id' => $metre->id,
            'voucher_type_ids' => [$location->id],
            'is_luminaire' => false,
        ])->assertSessionHasNoErrors();

        $item->refresh();
        $this->assertSame('Cable canónico', $item->description_snapshot);
        $this->assertSame($metre->id, $item->unit_id);
        $this->assertSame('5.000', $item->quantity);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'canonicalized',
            'auditable_type' => VoucherItem::class,
            'auditable_id' => $item->id,
            'user_id' => $user->id,
        ]);

        $this->actingAs($user)->put(route('catalogs.units.update', $metre), [
            'name' => 'Metro lineal',
            'symbol' => 'ml',
            'decimal_places' => 1,
        ])->assertSessionHasNoErrors();
        $voucherData = VoucherData::make($voucher->fresh(), true);
        $this->assertSame('Metro lineal', $voucherData['items'][0]['unit']['name']);
        $this->assertSame('ml', $voucherData['items'][0]['unit']['symbol']);

        $this->actingAs($user)->put(route('catalogs.people.update', $technician), [
            'name' => 'Técnico corregido',
            'can_receive_material' => true,
            'can_deliver_material' => false,
            'can_authorize_material' => false,
        ])->assertSessionHasNoErrors();
        $this->assertSame('Técnico corregido', VoucherData::make($voucher->fresh())['received_by']['name']);

        $action = Action::query()->where('code', 'SPM-06-02')->sole();
        $indicator = $action->indicators()->sole();
        $this->actingAs($user)->put(route('catalogs.actions.update', $action), [
            'name' => 'Acción corregida',
        ])->assertSessionHasNoErrors();
        $this->actingAs($user)->put(route('catalogs.indicators.update', $indicator), [
            'name' => 'Indicador corregido',
        ])->assertSessionHasNoErrors();
        $this->assertSame('SPM-06-02', $action->fresh()->code);
        $this->assertSame('SPM-06-02', $indicator->fresh()->code);

        $this->actingAs($user)->put(route('catalogs.actions.update', $action), [
            'name' => 'No debe guardarse',
            'code' => 'SPM-99',
        ])->assertSessionHasErrors('code');
        $this->actingAs($user)->put(route('catalogs.indicators.update', $indicator), [
            'name' => 'No debe guardarse',
            'action_id' => Action::query()->where('code', 'SPM-06-03')->sole()->id,
        ])->assertSessionHasErrors('action_id');
        $this->assertDatabaseHas('audit_events', [
            'event' => 'updated',
            'auditable_type' => ActionIndicator::class,
            'auditable_id' => $indicator->id,
        ]);
    }

    public function test_an_applied_voucher_item_requires_voiding_before_its_material_or_quantity_changes(): void
    {
        $user = User::factory()->create();
        [$technician, $issuer, $unit, $material, $otherMaterial] = $this->catalogs();
        $location = StorageLocation::factory()->create();
        $material->voucherTypes()->sync([$location->id]);
        $otherMaterial->voucherTypes()->sync([$location->id]);
        $destination = Destination::factory()->create();
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $location->id,
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
        ]);
        $voucher->destinations()->attach($destination);
        $item = VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
            'description_snapshot' => $material->name,
            'quantity' => 10,
        ]);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $item->id,
            'quantity' => 2,
        ]);
        $payload = [
            'voucher_type_id' => $location->id,
            'folio' => $voucher->folio,
            'direction' => VoucherDirection::Exit->value,
            'issued_on' => $voucher->issued_on->toDateString(),
            'received_by_id' => $technician->id,
            'delivered_by_id' => $issuer->id,
            'destination_ids' => [$destination->id],
            'usage_description' => $voucher->usage_description,
            'items' => [[
                'id' => $item->id,
                'material_id' => $material->id,
                'quantity' => 10,
            ]],
        ];

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            ...$payload,
            'notes' => 'Corrección de observación permitida',
        ])->assertSessionHasNoErrors();
        $this->assertSame('Corrección de observación permitida', $voucher->fresh()->notes);

        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            ...$payload,
            'items' => [[
                'id' => $item->id,
                'material_id' => $otherMaterial->id,
                'quantity' => 10,
            ]],
        ])->assertSessionHasErrors('items');
        $this->actingAs($user)->put(route('vouchers.update', $voucher), [
            ...$payload,
            'items' => [[
                'id' => $item->id,
                'material_id' => $material->id,
                'quantity' => 11,
            ]],
        ])->assertSessionHasErrors('items');
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
        $action = Action::query()->where('code', 'SPM-06-01')->sole();

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
            'action_id' => $action->id,
            'usage_description' => 'Prueba de funciones',
            'items' => [['material_id' => $material->id, 'quantity' => 1]],
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
        $matchingItem = VoucherItem::factory()->create([
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
        $applicationReport = MaterialApplicationReport::create([
            'voucher_id' => $matching->id,
            'occurred_on' => '2026-08-27',
            'reference' => 'OS-072-9981',
            'service_order_type' => ServiceOrderType::CitizenService072,
            'location' => 'Parque Guadiana, acceso norte',
            'notes' => 'Se atendió el reporte ciudadano.',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
        MaterialApplication::create([
            'voucher_item_id' => $matchingItem->id,
            'application_report_id' => $applicationReport->id,
            'occurred_on' => '2026-08-27',
            'quantity' => 1,
            'reference' => 'OS-072-9981',
            'destination_snapshot' => 'Parque Guadiana, acceso norte',
            'created_by' => $user->id,
            'updated_by' => $user->id,
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
