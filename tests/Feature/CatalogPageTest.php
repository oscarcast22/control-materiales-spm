<?php

namespace Tests\Feature;

use App\Models\Action;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\InventoryAdjustment;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CatalogPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalogs_open_with_people_first_and_only_the_paginated_people_section(): void
    {
        $user = User::factory()->create();
        Person::factory()->count(30)->create();

        $this->actingAs($user)->get(route('catalogs.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('catalogs/index')
                ->where('section', 'people')
                ->where('filters.review', 'all')
                ->has('catalog.data', 25)
                ->where('catalog.total', 30)
                ->where('catalog.per_page', 25)
                ->has('navigation', 4)
                ->where('navigation.0.key', 'people')
                ->where('navigation.1.key', 'materials')
                ->where('navigation.2.key', 'destinations')
                ->where('navigation.3.key', 'programs')
                ->has('units', 0)
                ->has('voucherTypes', 0)
                ->has('programOptions', 0)
            );
    }

    public function test_catalog_filters_search_aliases_and_only_return_the_requested_section(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();
        $material = Material::factory()->create([
            'name' => 'Cable canónico',
            'normalized_name' => 'cable canonico',
            'default_unit_id' => $unit->id,
            'needs_review' => true,
        ]);
        MaterialAlias::create([
            'material_id' => $material->id,
            'alias' => 'Cable POT anterior',
            'normalized_alias' => 'cable pot anterior',
        ]);
        Material::factory()->create(['default_unit_id' => $unit->id]);

        $this->actingAs($user)->get(route('catalogs.index', [
            'section' => 'materials',
            'search' => 'POT anterior',
            'review' => 'pending',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('section', 'materials')
            ->where('filters.search', 'POT anterior')
            ->where('filters.review', 'pending')
            ->has('catalog.data', 1)
            ->where('catalog.data.0.id', $material->id));
    }

    public function test_people_can_be_filtered_by_role_status_and_review(): void
    {
        $user = User::factory()->create();
        $authorizer = Person::factory()->create([
            'can_receive_material' => false,
            'can_deliver_material' => false,
            'can_authorize_material' => true,
            'needs_review' => true,
        ]);
        Person::factory()->create(['can_authorize_material' => false]);

        $this->actingAs($user)->get(route('catalogs.index', [
            'section' => 'people',
            'role' => 'authorize',
            'status' => 'active',
            'review' => 'pending',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('section', 'people')
            ->where('filters.role', 'authorize')
            ->has('catalog.data', 1)
            ->where('catalog.data.0.id', $authorizer->id)
            ->has('units', 0)
            ->has('voucherTypes', 0));
    }

    public function test_voucher_type_management_is_not_exposed(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::factory()->create(['code' => 'warehouse']);

        $this->actingAs($user)->post('/catalogs/voucher-types', [
            'code' => 'other',
            'name' => 'Otro',
        ])->assertNotFound();
        $this->actingAs($user)
            ->put("/catalogs/voucher-types/{$location->id}", ['name' => 'Otro'])
            ->assertNotFound();
        $this->actingAs($user)
            ->post("/catalogs/voucher-types/{$location->id}/toggle")
            ->assertNotFound();
    }

    public function test_related_catalog_records_cannot_be_deactivated_into_an_invalid_configuration(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();
        Material::factory()->create(['default_unit_id' => $unit->id]);
        $person = Person::factory()->create([
            'can_receive_material' => true,
            'can_deliver_material' => true,
            'can_authorize_material' => true,
        ]);
        $program = Program::factory()->create();
        Action::factory()->create(['program_id' => $program->id]);

        foreach ([
            ['units', $unit->id],
            ['people', $person->id],
            ['programs', $program->id],
        ] as [$type, $id]) {
            $this->actingAs($user)
                ->post(route('catalogs.toggle', ['type' => $type, 'id' => $id]))
                ->assertSessionHasErrors('status');
        }

        $this->assertTrue($unit->fresh()->is_active);
        $this->assertTrue($person->fresh()->is_active);
        $this->assertTrue($program->fresh()->is_active);
        $this->assertSame(0, AuditEvent::query()->count());
    }

    public function test_an_unreferenced_unit_can_be_deactivated_and_is_audited(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();

        $this->actingAs($user)
            ->post(route('catalogs.toggle', ['type' => 'units', 'id' => $unit->id]))
            ->assertSessionHasNoErrors();

        $this->assertFalse($unit->fresh()->is_active);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'status_changed',
            'auditable_type' => Unit::class,
            'auditable_id' => $unit->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_catalog_updates_save_the_selected_status_and_preserve_deactivation_rules(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();
        $inUseUnit = Unit::factory()->create();
        Material::factory()->create(['default_unit_id' => $inUseUnit->id]);

        $this->actingAs($user)
            ->put(route('catalogs.units.update', $unit), [
                'name' => 'Unidad corregida',
                'symbol' => 'uc',
                'is_active' => false,
            ])
            ->assertSessionHasNoErrors();

        $this->assertFalse($unit->fresh()->is_active);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'updated',
            'auditable_type' => Unit::class,
            'auditable_id' => $unit->id,
            'user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->put(route('catalogs.units.update', $inUseUnit), [
                'name' => $inUseUnit->name,
                'symbol' => $inUseUnit->symbol,
                'is_active' => false,
            ])
            ->assertSessionHasErrors('status');

        $this->assertTrue($inUseUnit->fresh()->is_active);
    }

    public function test_an_unreferenced_catalog_record_can_be_deleted_and_is_audited(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();
        $material = Material::factory()->create(['default_unit_id' => $unit->id]);
        $person = Person::factory()->create([
            'can_receive_material' => false,
            'can_deliver_material' => false,
            'can_authorize_material' => false,
        ]);
        $destination = Destination::factory()->create();
        $program = Program::factory()->create();
        $action = Action::factory()->create(['program_id' => Program::factory()->create()->id]);

        foreach ([
            ['materials', $material, Material::class],
            ['people', $person, Person::class],
            ['destinations', $destination, Destination::class],
            ['actions', $action, Action::class],
            ['programs', $program, Program::class],
        ] as [$type, $model, $class]) {
            $this->actingAs($user)
                ->delete(route('catalogs.destroy', ['type' => $type, 'id' => $model->id]))
                ->assertSessionHasNoErrors();

            $this->assertModelMissing($model);
            $this->assertDatabaseHas('audit_events', [
                'event' => 'deleted',
                'auditable_type' => $class,
                'auditable_id' => $model->id,
                'user_id' => $user->id,
            ]);
        }

        $this->actingAs($user)
            ->delete(route('catalogs.destroy', ['type' => 'units', 'id' => $unit->id]))
            ->assertSessionHasNoErrors();

        $this->assertModelMissing($unit);
    }

    public function test_catalog_records_referenced_by_a_voucher_cannot_be_deleted(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();
        $material = Material::factory()->create(['default_unit_id' => $unit->id]);
        $receiver = Person::factory()->create();
        $deliverer = Person::factory()->create();
        $authorizer = Person::factory()->create();
        $destination = Destination::factory()->create();
        $program = Program::factory()->create();
        $action = Action::factory()->create(['program_id' => $program->id]);
        $voucher = Voucher::factory()->create([
            'received_by_id' => $receiver->id,
            'delivered_by_id' => $deliverer->id,
            'authorized_by_id' => $authorizer->id,
            'program_id' => $program->id,
            'action_id' => $action->id,
        ]);
        $voucher->destinations()->attach($destination);
        VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
        ]);

        foreach ([
            ['materials', $material],
            ['units', $unit],
            ['people', $receiver],
            ['people', $deliverer],
            ['people', $authorizer],
            ['destinations', $destination],
            ['programs', $program],
            ['actions', $action],
        ] as [$type, $model]) {
            $this->actingAs($user)
                ->delete(route('catalogs.destroy', ['type' => $type, 'id' => $model->id]))
                ->assertSessionHasErrors('delete');

            $this->assertModelExists($model);
        }

        $this->assertSame(0, AuditEvent::query()->where('event', 'deleted')->count());
    }

    public function test_catalog_deletion_preserves_catalog_configuration_and_reserved_adjustments(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();
        $material = Material::factory()->create(['default_unit_id' => $unit->id]);
        $program = Program::factory()->create();
        Action::factory()->create(['program_id' => $program->id, 'is_active' => false]);

        $this->actingAs($user)
            ->delete(route('catalogs.destroy', ['type' => 'units', 'id' => $unit->id]))
            ->assertSessionHasErrors('delete');
        $this->actingAs($user)
            ->delete(route('catalogs.destroy', ['type' => 'programs', 'id' => $program->id]))
            ->assertSessionHasErrors('delete');

        $adjustment = InventoryAdjustment::factory()->create([
            'material_id' => $material->id,
            'unit_id' => $unit->id,
        ]);
        $this->actingAs($user)
            ->delete(route('catalogs.destroy', ['type' => 'materials', 'id' => $material->id]))
            ->assertSessionHasErrors('delete');

        $this->assertModelExists($adjustment);
        $this->assertModelExists($material);
        $this->assertModelExists($unit);
        $this->assertModelExists($program);
    }

    public function test_the_last_active_person_for_a_required_role_cannot_be_deleted(): void
    {
        $user = User::factory()->create();
        $person = Person::factory()->create([
            'can_receive_material' => true,
            'can_deliver_material' => false,
            'can_authorize_material' => false,
        ]);

        $this->actingAs($user)
            ->delete(route('catalogs.destroy', ['type' => 'people', 'id' => $person->id]))
            ->assertSessionHasErrors('delete');

        $this->assertModelExists($person);
    }

    public function test_merging_destinations_still_preserves_voucher_links_before_deleting_the_source(): void
    {
        $user = User::factory()->create();
        $source = Destination::factory()->create();
        $target = Destination::factory()->create();
        $voucher = Voucher::factory()->create();
        $voucher->destinations()->attach($source);

        $this->actingAs($user)->post(route('catalogs.merge', [
            'type' => 'destinations',
            'source' => $source->id,
        ]), ['target_id' => $target->id])->assertSessionHasNoErrors();

        $this->assertModelMissing($source);
        $this->assertDatabaseHas('destination_voucher', [
            'destination_id' => $target->id,
            'voucher_id' => $voucher->id,
        ]);
        $this->assertDatabaseMissing('destination_voucher', [
            'destination_id' => $source->id,
            'voucher_id' => $voucher->id,
        ]);
    }

    public function test_catalog_index_exposes_deletion_eligibility(): void
    {
        $user = User::factory()->create();
        $unit = Unit::factory()->create();
        $material = Material::factory()->create(['default_unit_id' => $unit->id]);
        $voucher = Voucher::factory()->create();
        VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'material_id' => $material->id,
            'unit_id' => $unit->id,
        ]);

        $this->actingAs($user)->get(route('catalogs.index', ['section' => 'materials']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('catalog.data.0.deletion.can_delete', false)
                ->where('catalog.data.0.deletion.blocked_reason', 'No se puede eliminar porque este material ya está asignado a un vale.'));
    }
}
