<?php

namespace Tests\Feature;

use App\Enums\VoucherDirection;
use App\Models\Material;
use App\Models\Person;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\Normalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

class VoucherTypeScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_voucher_views_default_to_warehouse_and_allow_yard_or_all_explicitly(): void
    {
        [$user, $warehouse, $yard] = $this->scopedVouchers();

        $this->actingAs($user)->get(route('vouchers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.voucher_type_id', $warehouse->id)
                ->has('vouchers.data', 1)
                ->where('vouchers.data.0.folio', '16576'));

        $this->actingAs($user)->get(route('vouchers.index', ['voucher_type_id' => $yard->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.voucher_type_id', $yard->id)
                ->has('vouchers.data', 1)
                ->where('vouchers.data.0.folio', '3753'));

        $this->actingAs($user)->get(route('vouchers.index', ['voucher_type_id' => 'all']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.voucher_type_id', null)
                ->has('vouchers.data', 2));

        $this->actingAs($user)->get(route('vouchers.index', ['voucher_type_id' => 'invalid']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.voucher_type_id', $warehouse->id)
                ->has('vouchers.data', 1)
                ->where('vouchers.data.0.folio', '16576'));
    }

    public function test_tracking_defaults_to_warehouse_and_allows_all_types_explicitly(): void
    {
        [$user, $warehouse] = $this->scopedVouchers();

        $this->actingAs($user)->get(route('reports.material-tracking'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.voucher_type_id', $warehouse->id)
                ->where('metrics.delivered_vouchers', 1)
                ->has('rows', 1));

        $this->actingAs($user)->get(route('reports.material-tracking', ['voucher_type_id' => 'all']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.voucher_type_id', null)
                ->where('metrics.delivered_vouchers', 2)
                ->has('rows', 2));
    }

    public function test_dashboard_always_shows_the_general_summary_for_all_voucher_types(): void
    {
        [$user, , $yard] = $this->scopedVouchers();

        $this->actingAs($user)->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('filters')
                ->missing('voucherTypes')
                ->where('metrics.pending_vouchers', 2)
                ->has('recent', 2)
                ->has('voucher_sequence.types', 2));

        $this->actingAs($user)->get(route('dashboard', ['voucher_type_id' => $yard->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('metrics.pending_vouchers', 2)
                ->has('recent', 2)
                ->has('voucher_sequence.types', 2));
    }

    public function test_tracking_export_honours_the_selected_voucher_type(): void
    {
        [$user, , $yard] = $this->scopedVouchers();

        $response = $this->actingAs($user)->get(route('reports.export', [
            'voucher_type_id' => $yard->id,
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
        $this->assertStringContainsString('3753', $xml);
        $this->assertStringNotContainsString('16576', $xml);
    }

    /** @return array{User, StorageLocation, StorageLocation} */
    private function scopedVouchers(): array
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
        $technician = Person::factory()->create();
        $issuer = Person::factory()->create();
        $unit = Unit::factory()->create(['name' => 'Pieza', 'symbol' => 'pza']);
        $material = Material::factory()->create([
            'name' => 'Luminaria de prueba',
            'normalized_name' => 'luminaria de prueba',
            'default_unit_id' => $unit->id,
        ]);

        foreach ([[$warehouse, '16576'], [$yard, '3753']] as [$location, $folio]) {
            $voucher = Voucher::factory()->create([
                'storage_location_id' => $location->id,
                'folio' => $folio,
                'folio_key' => Normalizer::folio($folio),
                'direction' => VoucherDirection::Exit,
                'issued_on' => '2026-08-20',
                'received_by_id' => $technician->id,
                'delivered_by_id' => $issuer->id,
            ]);
            VoucherItem::factory()->create([
                'voucher_id' => $voucher->id,
                'material_id' => $material->id,
                'unit_id' => $unit->id,
                'description_snapshot' => $material->name,
                'quantity' => 5,
            ]);
        }

        return [$user, $warehouse, $yard];
    }
}
