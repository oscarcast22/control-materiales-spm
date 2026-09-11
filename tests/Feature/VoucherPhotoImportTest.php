<?php

namespace Tests\Feature;

use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\ActionIndicator;
use App\Models\Destination;
use App\Models\Material;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Support\Normalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VoucherPhotoImportTest extends TestCase
{
    use RefreshDatabase;

    private string $temporaryDirectory;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->temporaryDirectory = sys_get_temp_dir().'/voucher-photo-import-'.bin2hex(random_bytes(5));
        File::makeDirectory($this->temporaryDirectory);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->temporaryDirectory);
        parent::tearDown();
    }

    public function test_dry_run_writes_nothing_and_apply_imports_an_audited_private_photo(): void
    {
        $catalog = $this->catalog();
        $actor = User::factory()->create();
        $image = $this->image('nuevo.jpeg');
        $manifest = $this->manifest([[
            'decision' => 'create',
            'voucher_type' => 'warehouse',
            'folio' => '17001',
            'issued_on' => '2026-08-12',
            'status' => 'active',
            'direction' => 'exit',
            'received_by' => $catalog['receiver']->name,
            'delivered_by' => $catalog['deliverer']->name,
            'authorized_by' => $catalog['authorizer']->name,
            'action' => $catalog['action']->code,
            'destinations' => [$catalog['destination']->name],
            'usage_description' => 'Mantenimiento preventivo',
            'items' => [['material' => '14 calibre POT Cable', 'quantity' => '3']],
            'images' => [$image],
        ]]);

        $this->artisan('vouchers:import-photo-backlog', ['manifest' => $manifest, 'images' => $this->temporaryDirectory])
            ->expectsOutputToContain('Simulación completa')
            ->assertSuccessful();
        $this->assertDatabaseCount('vouchers', 0);
        $this->assertDatabaseCount('voucher_attachments', 0);

        $this->artisan('vouchers:import-photo-backlog', ['manifest' => $manifest, 'images' => $this->temporaryDirectory, '--apply' => true, '--actor' => $actor->id])
            ->expectsOutputToContain('Importación local aplicada')
            ->assertSuccessful();

        $voucher = Voucher::query()->with(['items.material', 'attachments'])->sole();
        $this->assertSame('17001', $voucher->folio);
        $this->assertSame($catalog['material']->id, $voucher->items->sole()->material_id);
        $this->assertSame($actor->id, $voucher->created_by);
        $this->assertSame($image['sha256'], $voucher->attachments->sole()->sha256);
        Storage::disk('local')->assertExists($voucher->attachments->sole()->path);
        $this->assertDatabaseHas('audit_events', ['event' => 'created_from_photo_import', 'auditable_type' => Voucher::class, 'auditable_id' => $voucher->id, 'user_id' => $actor->id]);

        $this->artisan('vouchers:import-photo-backlog', ['manifest' => $manifest, 'images' => $this->temporaryDirectory, '--apply' => true, '--actor' => $actor->id])->assertSuccessful();
        $this->assertDatabaseCount('vouchers', 1);
        $this->assertDatabaseCount('voucher_attachments', 1);
    }

    public function test_existing_voucher_only_receives_the_photo_and_preserves_its_data(): void
    {
        $catalog = $this->catalog();
        $actor = User::factory()->create();
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $catalog['location']->id,
            'folio' => '16590',
            'folio_key' => '16590',
            'issued_on' => '2026-08-27',
            'status' => VoucherStatus::Cancelled,
            'notes' => 'Dato productivo que no debe cambiar',
        ]);
        Voucher::factory()->create([
            'storage_location_id' => StorageLocation::query()->where('code', 'yard')->value('id'),
            'folio' => '16590',
            'folio_key' => '16590',
        ]);
        $before = [
            ...$voucher->only(['storage_location_id', 'status', 'notes', 'needs_review']),
            'issued_on' => $voucher->issued_on->toDateString(),
        ];
        $image = $this->image('16590.jpeg');
        $manifest = $this->manifest([[
            'decision' => 'attach_only',
            'voucher_type' => 'warehouse',
            'folio' => '16590',
            'comparison_notes' => ['La fotografía muestra un dato diferente.'],
            'images' => [$image],
        ]]);

        $this->artisan('vouchers:import-photo-backlog', ['manifest' => $manifest, 'images' => $this->temporaryDirectory, '--apply' => true, '--actor' => $actor->id])->assertSuccessful();

        $fresh = $voucher->fresh();
        $this->assertSame($before, [
            ...$fresh->only(['storage_location_id', 'status', 'notes', 'needs_review']),
            'issued_on' => $fresh->issued_on->toDateString(),
        ]);
        $this->assertDatabaseHas('voucher_attachments', ['voucher_id' => $voucher->id, 'sha256' => $image['sha256'], 'uploaded_by' => $actor->id]);
    }

    public function test_clear_catalog_addition_is_reviewable_while_blocked_rows_are_skipped(): void
    {
        $catalog = $this->catalog();
        $actor = User::factory()->create();
        $readyImage = $this->image('nuevo-material.jpeg');
        $blockedImage = $this->image('ilegible.jpeg', true);
        $manifest = $this->manifest([
            [
                'decision' => 'create',
                'voucher_type' => 'warehouse',
                'folio' => '17002',
                'issued_on' => '2026-08-13',
                'status' => 'active',
                'direction' => 'exit',
                'received_by' => $catalog['receiver']->name,
                'delivered_by' => $catalog['deliverer']->name,
                'authorized_by' => $catalog['authorizer']->name,
                'action' => $catalog['action']->code,
                'destinations' => [$catalog['destination']->name],
                'items' => [['material' => 'Conector cerámico especial', 'quantity' => '2']],
                'images' => [$readyImage],
            ],
            [
                'decision' => 'blocked',
                'voucher_type' => 'warehouse',
                'folio' => '17003',
                'blocking_reasons' => ['La cantidad no es legible.'],
                'images' => [$blockedImage],
            ],
        ], [
            'materials' => [[
                'name' => 'Conector cerámico especial',
                'unit_symbol' => $catalog['unit']->symbol,
                'voucher_types' => ['warehouse'],
                'is_luminaire' => false,
            ]],
        ]);

        $this->artisan('vouchers:import-photo-backlog', ['manifest' => $manifest, 'images' => $this->temporaryDirectory, '--apply' => true, '--actor' => $actor->id])
            ->expectsOutputToContain('Bloqueados')
            ->assertSuccessful();

        $material = Material::query()->where('normalized_name', Normalizer::key('Conector cerámico especial'))->sole();
        $voucher = Voucher::query()->where('folio_key', '17002')->sole();
        $this->assertTrue($material->needs_review);
        $this->assertTrue($voucher->needs_review);
        $this->assertContains('material_created_from_photo', $voucher->review_reasons);
        $this->assertDatabaseMissing('vouchers', ['folio_key' => '17003']);
    }

    public function test_existing_voucher_can_be_reconciled_and_repeated_without_duplicate_changes(): void
    {
        $catalog = $this->catalog();
        $actor = User::factory()->create();
        $sourceMaterial = Material::factory()->create([
            'name' => 'Luminaria genérica 150 W',
            'normalized_name' => Normalizer::key('Luminaria genérica 150 W'),
            'default_unit_id' => $catalog['unit']->id,
            'is_luminaire' => true,
        ]);
        $targetMaterial = Material::factory()->create([
            'name' => 'Luminaria City Plus 150 W',
            'normalized_name' => Normalizer::key('Luminaria City Plus 150 W'),
            'default_unit_id' => $catalog['unit']->id,
            'is_luminaire' => true,
        ]);
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $catalog['location']->id,
            'folio' => '03605',
            'folio_key' => '03605',
            'issued_on' => '0026-07-01',
            'usage_description' => null,
        ]);
        $item = $voucher->items()->create([
            'material_id' => $sourceMaterial->id,
            'unit_id' => $sourceMaterial->default_unit_id,
            'description_snapshot' => $sourceMaterial->name,
            'quantity' => 2,
        ]);
        $image = $this->image('03605.jpeg');
        $manifest = $this->manifest([[
            'decision' => 'reconcile_existing',
            'voucher_type' => 'warehouse',
            'folio' => '03605',
            'expected_updated_at' => $voucher->updated_at->format('Y-m-d H:i:s'),
            'expected_attachment_count' => 0,
            'updates' => [
                'issued_on' => '2026-07-01',
                'usage_description' => 'Mantenimiento de poblados',
                'add_destinations' => [$catalog['destination']->name],
                'items' => [[
                    'current_material' => $sourceMaterial->name,
                    'quantity' => 2,
                    'material' => $targetMaterial->name,
                    'luminaire_folios' => '1001, S/F',
                ]],
            ],
            'review_reasons' => ['La persona que entregó no aparece escrita en la fotografía.'],
            'images' => [$image],
        ]]);

        $this->artisan('vouchers:import-photo-backlog', ['manifest' => $manifest, 'images' => $this->temporaryDirectory])
            ->expectsOutputToContain('Simulación completa')
            ->assertSuccessful();
        $this->assertSame('0026-07-01', $voucher->fresh()->issued_on->toDateString());
        $this->assertDatabaseCount('voucher_attachments', 0);

        $arguments = ['manifest' => $manifest, 'images' => $this->temporaryDirectory, '--apply' => true, '--actor' => $actor->id];
        $this->artisan('vouchers:import-photo-backlog', $arguments)->assertSuccessful();
        $this->artisan('vouchers:import-photo-backlog', $arguments)->assertSuccessful();

        $voucher->refresh();
        $item->refresh();
        $this->assertSame('2026-07-01', $voucher->issued_on->toDateString());
        $this->assertSame('Mantenimiento de poblados', $voucher->usage_description);
        $this->assertTrue($voucher->needs_review);
        $this->assertContains('La persona que entregó no aparece escrita en la fotografía.', $voucher->review_reasons);
        $this->assertTrue($voucher->destinations()->whereKey($catalog['destination']->id)->exists());
        $this->assertSame($targetMaterial->id, $item->material_id);
        $this->assertSame('1001, S/F', $item->luminaire_folios);
        $this->assertDatabaseCount('voucher_attachments', 1);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'reconciled_from_photo_import',
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
            'user_id' => $actor->id,
        ]);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'reconciled_from_photo_import',
            'auditable_type' => $item::class,
            'auditable_id' => $item->id,
            'user_id' => $actor->id,
        ]);
    }

    public function test_reconciliation_is_blocked_when_the_expected_state_or_exact_folio_changed(): void
    {
        $catalog = $this->catalog();
        $actor = User::factory()->create();
        $voucher = Voucher::factory()->create([
            'storage_location_id' => $catalog['location']->id,
            'folio' => '03758',
            'folio_key' => '03758',
        ]);
        $image = $this->image('03758.jpeg');
        $manifest = $this->manifest([[
            'decision' => 'reconcile_existing',
            'voucher_type' => 'warehouse',
            'folio' => '3758',
            'expected_updated_at' => $voucher->updated_at->format('Y-m-d H:i:s'),
            'expected_attachment_count' => 0,
            'updates' => [],
            'images' => [$image],
        ]]);

        $this->artisan('vouchers:import-photo-backlog', [
            'manifest' => $manifest,
            'images' => $this->temporaryDirectory,
            '--apply' => true,
            '--actor' => $actor->id,
        ])->assertSuccessful();

        $this->assertDatabaseCount('voucher_attachments', 0);
        $this->assertSame('03758', $voucher->fresh()->folio_key);
    }

    public function test_private_image_preview_requires_authorization_and_is_inline(): void
    {
        $catalog = $this->catalog();
        $user = User::factory()->create();
        $voucher = Voucher::factory()->create(['storage_location_id' => $catalog['location']->id]);
        Storage::disk('local')->put('vouchers/example.jpeg', 'image-bytes');
        $attachment = $voucher->attachments()->create([
            'disk' => 'local', 'path' => 'vouchers/example.jpeg', 'original_name' => 'vale.jpeg',
            'mime_type' => 'image/jpeg', 'size' => 11, 'sha256' => str_repeat('a', 64), 'uploaded_by' => $user->id,
        ]);

        $this->get(route('attachments.preview', $attachment))->assertRedirect(route('login'));
        $this->actingAs($user)->get(route('attachments.preview', $attachment))
            ->assertOk()
            ->assertHeader('content-disposition', 'inline; filename=vale.jpeg')
            ->assertHeader('x-content-type-options', 'nosniff');
    }

    /** @return array<string, mixed> */
    private function catalog(): array
    {
        $location = StorageLocation::query()->firstOrCreate(['code' => 'warehouse'], ['name' => 'Almacén', 'tracking_started_on' => '2026-01-01', 'is_active' => true]);
        StorageLocation::query()->firstOrCreate(['code' => 'yard'], ['name' => 'Patio', 'tracking_started_on' => '2026-01-01', 'is_active' => true]);
        $unit = Unit::factory()->create(['name' => 'Pieza', 'symbol' => 'pza', 'decimal_places' => 0]);
        $material = Material::factory()->create(['name' => 'Cable POT calibre 14', 'normalized_name' => Normalizer::key('Cable POT calibre 14'), 'default_unit_id' => $unit->id]);
        $receiver = Person::factory()->create(['name' => 'Técnico receptor', 'normalized_name' => Normalizer::key('Técnico receptor'), 'can_receive_material' => true, 'can_deliver_material' => false]);
        $deliverer = Person::factory()->create(['name' => 'Auxiliar entrega', 'normalized_name' => Normalizer::key('Auxiliar entrega'), 'can_receive_material' => false, 'can_deliver_material' => true]);
        $authorizer = Person::factory()->create(['name' => 'Persona autoriza', 'normalized_name' => Normalizer::key('Persona autoriza'), 'can_receive_material' => false, 'can_deliver_material' => false, 'can_authorize_material' => true]);
        $program = Program::query()->where('code', 'SPM-06')->firstOrFail();
        $action = Action::query()->where('program_id', $program->id)->where('code', 'SPM-06-01')->firstOrFail();
        if (! $action->indicators()->where('is_active', true)->exists()) {
            ActionIndicator::factory()->create(['action_id' => $action->id, 'code' => 'SPM-06-01-01']);
        }
        $destination = Destination::factory()->create(['name' => 'Taller municipal', 'normalized_name' => Normalizer::key('Taller municipal')]);

        return compact('location', 'unit', 'material', 'receiver', 'deliverer', 'authorizer', 'action', 'destination');
    }

    /** @param list<array<string, mixed>> $vouchers
     * @param  array<string, mixed>  $catalogAdditions
     */
    private function manifest(array $vouchers, array $catalogAdditions = []): string
    {
        $path = $this->temporaryDirectory.'/manifest-'.bin2hex(random_bytes(3)).'.json';
        file_put_contents($path, json_encode([
            'schema_version' => 1,
            'batch' => 'prueba-local',
            'catalog_additions' => $catalogAdditions,
            'vouchers' => $vouchers,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return $path;
    }

    /** @return array{file: string, sha256: string} */
    private function image(string $name, bool $different = false): array
    {
        $jpeg = base64_decode($different
            ? '/9j/4AAQSkZJRgABAQEASABIAAD/2Q=='
            : '/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==');
        file_put_contents($this->temporaryDirectory.'/'.$name, $jpeg);

        return ['file' => $name, 'sha256' => hash_file('sha256', $this->temporaryDirectory.'/'.$name)];
    }
}
