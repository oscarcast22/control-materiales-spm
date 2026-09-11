<?php

namespace Tests\Feature;

use App\Enums\ServiceOrderType;
use App\Enums\UserRole;
use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\AuditEvent;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationReport;
use App\Models\Person;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\VoucherData;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passkeys\Passkey;
use Laravel\Passkeys\Passkeys;
use Tests\TestCase;

class TechnicianAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_username_login_is_normalized_and_technicians_land_on_my_vouchers(): void
    {
        $person = Person::factory()->create();
        $technician = User::factory()->technician($person)->create([
            'username' => 'tecnico.uno',
            'email' => null,
        ]);

        $response = $this->post(route('login.store'), [
            'login' => '  TECNICO.UNO  ',
            'password' => 'password',
        ]);

        $this->assertAuthenticatedAs($technician);
        $response->assertRedirect('/dashboard');
        $this->get(route('dashboard'))->assertRedirect(route('my-vouchers.index'));
    }

    public function test_inactive_or_ineligible_accounts_cannot_authenticate(): void
    {
        $inactiveAdministrator = User::factory()->create(['is_active' => false]);

        $this->post(route('login.store'), [
            'login' => $inactiveAdministrator->email,
            'password' => 'password',
        ]);
        $this->assertGuest();

        foreach ([
            ['is_active' => false, 'can_receive_material' => true],
            ['is_active' => true, 'can_receive_material' => false],
        ] as $index => $state) {
            $person = Person::factory()->create($state);
            User::factory()->technician($person)->create([
                'username' => "tecnico.{$index}",
                'email' => null,
            ]);

            $this->post(route('login.store'), [
                'login' => "tecnico.{$index}",
                'password' => 'password',
            ]);
            $this->assertGuest();
        }
    }

    public function test_passkeys_use_the_same_application_access_rules_as_password_login(): void
    {
        $activePerson = Person::factory()->create();
        $inactivePerson = Person::factory()->create(['is_active' => false]);
        $ineligiblePerson = Person::factory()->create(['can_receive_material' => false]);

        $accounts = [
            [User::factory()->create(), true],
            [User::factory()->create(['is_active' => false]), false],
            [User::factory()->technician($activePerson)->create(), true],
            [User::factory()->technician(Person::factory()->create())->create(['is_active' => false]), false],
            [User::factory()->technician($inactivePerson)->create(), false],
            [User::factory()->technician($ineligiblePerson)->create(), false],
        ];

        foreach ($accounts as [$user, $expected]) {
            $passkey = new Passkey;
            $passkey->setRelation('user', $user);

            $this->assertSame($expected, $user->canAccessApplication());
            $this->assertSame(
                $expected,
                Passkeys::allowsLogin(Request::create('/passkeys/login', 'POST'), $passkey),
            );
        }
    }

    public function test_administrator_can_create_pause_and_reset_an_automatic_technical_account_without_auditing_the_charge_number(): void
    {
        $administrator = User::factory()->create();
        $person = Person::factory()->create([
            'name' => 'Técnico Dos',
            'charge_number' => '12345',
        ]);

        $response = $this->actingAs($administrator)->post(route('catalogs.people.account.store', $person));
        $response
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('toast.type', 'success')
            ->assertInertiaFlash('toast.message', 'Acceso técnico creado para tecnicodos.')
            ->assertSessionMissing('success');

        $account = $person->account()->sole();
        $this->assertSame('tecnicodos', $account->username);
        $this->assertNull($account->email);
        $this->assertSame(UserRole::Technician, $account->role);
        $this->assertTrue(Hash::check('12345', $account->password));

        $otherPerson = Person::factory()->create([
            'name' => 'Tecnico Dos',
            'charge_number' => '67890',
        ]);
        $this->actingAs($administrator)->post(route('catalogs.people.account.store', $otherPerson))
            ->assertSessionHasErrors('account');

        $this->actingAs($administrator)->put(route('catalogs.people.account.update', $person), [
            'is_active' => false,
        ])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('users', [
            'id' => $account->id,
            'username' => 'tecnicodos',
            'email' => null,
            'is_active' => false,
        ]);

        $this->actingAs($administrator)->put(route('catalogs.people.account.password', $person))
            ->assertSessionHasNoErrors();
        $this->assertTrue(Hash::check('12345', $account->fresh()->password));
        $this->assertStringNotContainsString(
            '12345',
            (string) AuditEvent::query()->where('auditable_type', User::class)->get()->toJson(),
        );
    }

    public function test_changing_a_technicians_charge_number_resets_its_password(): void
    {
        $administrator = User::factory()->create();
        $person = Person::factory()->create(['charge_number' => '12345']);
        $account = User::factory()->technician($person)->create(['password' => '12345']);

        $this->actingAs($administrator)->put(route('catalogs.people.update', $person), [
            'name' => $person->name,
            'charge_number' => '67890',
            'can_receive_material' => true,
            'can_deliver_material' => $person->can_deliver_material,
            'can_authorize_material' => $person->can_authorize_material,
            'is_active' => true,
        ])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('67890', $account->fresh()->password));
        $this->assertStringNotContainsString('67890', AuditEvent::query()->get()->toJson());
    }

    public function test_an_account_without_email_requires_administrative_password_reset(): void
    {
        Notification::fake();
        $person = Person::factory()->create();
        User::factory()->technician($person)->create(['email' => null]);

        $this->post(route('password.email'), ['email' => ''])
            ->assertSessionHasErrors('email');
        Notification::assertNothingSent();
        Notification::assertNotSentTo(User::query()->sole(), ResetPassword::class);
    }

    public function test_technicians_cannot_manage_accounts_catalogs_reports_or_vouchers(): void
    {
        $person = Person::factory()->create();
        $technician = User::factory()->technician($person)->create();

        $this->actingAs($technician)->get(route('vouchers.index'))->assertForbidden();
        $this->actingAs($technician)->get(route('catalogs.index'))->assertForbidden();
        $this->actingAs($technician)->get(route('reports.material-tracking'))->assertForbidden();
        $this->actingAs($technician)->get(route('profile.edit'))->assertForbidden();
        $this->actingAs($technician)->get(route('my-vouchers.index'))->assertOk();
    }

    public function test_my_vouchers_only_contains_assigned_active_exits_since_2026_and_separates_history(): void
    {
        $person = Person::factory()->create();
        $other = Person::factory()->create();
        $technician = User::factory()->technician($person)->create();
        $pending = $this->voucherItem($person, '2026-01-01', 10);
        $pending->voucher->update(['folio' => 'MIO-1', 'folio_key' => 'mio1']);
        $report = MaterialApplicationReport::create([
            'voucher_id' => $pending->voucher_id,
            'occurred_on' => '2026-01-02',
            'reference' => 'OS-MIO-777',
            'service_order_type' => ServiceOrderType::Normal,
            'created_by' => $technician->id,
            'updated_by' => $technician->id,
        ]);
        MaterialApplication::create([
            'voucher_item_id' => $pending->id,
            'application_report_id' => $report->id,
            'occurred_on' => '2026-01-02',
            'quantity' => 1,
            'reference' => 'OS-MIO-777',
            'created_by' => $technician->id,
            'updated_by' => $technician->id,
        ]);
        $settled = $this->voucherItem($person, '2026-02-01', 4);
        $settled->voucher->update(['folio' => 'MIO-2', 'folio_key' => 'mio2']);
        MaterialApplication::factory()->create([
            'voucher_item_id' => $settled->id,
            'quantity' => 4,
        ]);
        $this->voucherItem($other, '2026-03-01', 2);
        $this->voucherItem($person, '2025-12-31', 2);
        $entry = $this->voucherItem($person, '2026-03-01', 2);
        $entry->voucher->update(['direction' => VoucherDirection::Entry]);
        $cancelled = $this->voucherItem($person, '2026-03-01', 2);
        $cancelled->voucher->update(['status' => VoucherStatus::Cancelled]);
        $loaned = Voucher::factory()->create([
            'folio' => 'MIO-PRESTADO',
            'folio_key' => 'mioprestado',
            'issued_on' => '2026-03-02',
            'received_by_id' => $person->id,
            'delivered_by_id' => null,
            'direction' => null,
            'status' => VoucherStatus::Loaned,
            'loaned_to_name' => 'Responsable externo',
        ]);
        VoucherItem::factory()->create([
            'voucher_id' => $loaned->id,
            'material_id' => $settled->material_id,
            'unit_id' => $settled->unit_id,
            'description_snapshot' => $settled->description_snapshot,
            'quantity' => 7,
        ]);

        $this->actingAs($technician)->get(route('my-vouchers.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('my-vouchers/index')
                ->has('vouchers.data', 1)
                ->where('vouchers.data.0.folio', 'MIO-1')
                ->where('counts.pending', 1)
                ->where('counts.history', 2));

        $this->actingAs($technician)->get(route('my-vouchers.index', ['tab' => 'history']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.tab', 'history')
                ->has('vouchers.data', 2)
                ->where('vouchers.data.0.folio', 'MIO-2')
                ->where('vouchers.data.1.folio', 'MIO-PRESTADO')
                ->where('vouchers.data.1.balance_state', 'loaned'));

        $this->actingAs($technician)->get(route('my-vouchers.index', ['tab' => 'settled']))
            ->assertInertia(fn (Assert $page) => $page->where('filters.tab', 'history'));

        $this->actingAs($technician)->get(route('my-vouchers.show', $loaned))
            ->assertInertia(fn (Assert $page) => $page
                ->where('voucher.status', 'loaned')
                ->where('voucher.loaned_to_name', 'Responsable externo')
                ->where('voucher.permissions.create_application', false)
                ->where('voucher.permissions.update', false));
        $this->actingAs(User::factory()->technician($other)->create())
            ->get(route('my-vouchers.show', $loaned))
            ->assertNotFound();

        $this->actingAs($technician)->get(route('my-vouchers.index', ['search' => 'MIO-777']))
            ->assertInertia(fn (Assert $page) => $page
                ->has('vouchers.data', 1)
                ->where('vouchers.data.0.folio', 'MIO-1'));

        $foreign = $this->voucherItem($other, '2026-04-01', 1)->voucher;
        $this->actingAs($technician)->get(route('my-vouchers.show', $foreign))->assertNotFound();
        $this->actingAs($technician)->get(route('vouchers.show', $foreign))->assertNotFound();
    }

    public function test_technician_can_register_and_correct_only_own_reports_with_required_order_and_notes(): void
    {
        $person = Person::factory()->create();
        $technician = User::factory()->technician($person)->create();
        $administrator = User::factory()->create();
        $item = $this->voucherItem($person, '2026-08-24', 10);

        $this->actingAs($technician)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-25',
            'reference' => 'OS-499',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 2]],
        ])->assertSessionHasErrors('service_order_type');

        $this->actingAs($technician)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-25',
            'service_order_type' => ServiceOrderType::Normal->value,
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 2]],
        ])->assertSessionHasErrors('reference');

        $this->actingAs($technician)->post(route('applications.store'), [
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-25',
            'reference' => 'OS-500',
            'service_order_type' => ServiceOrderType::Normal->value,
            'location' => 'Priv. Fresno 18',
            'notes' => 'Trabajo concluido en el parque.',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 2]],
        ])->assertSessionHasNoErrors();
        $own = MaterialApplicationReport::query()->sole();
        $this->assertSame($technician->id, $own->created_by);
        $this->assertSame(ServiceOrderType::Normal, $own->service_order_type);
        $this->assertSame('Priv. Fresno 18', $own->location);
        $this->assertSame('Trabajo concluido en el parque.', $own->notes);

        $foreign = MaterialApplicationReport::create([
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-26',
            'reference' => 'OS-ADMIN',
            'service_order_type' => ServiceOrderType::Normal->value,
            'created_by' => $administrator->id,
            'updated_by' => $administrator->id,
        ]);
        MaterialApplication::create([
            'voucher_item_id' => $item->id,
            'application_report_id' => $foreign->id,
            'occurred_on' => '2026-08-26',
            'quantity' => 1,
            'reference' => 'OS-ADMIN',
            'created_by' => $administrator->id,
            'updated_by' => $administrator->id,
        ]);

        $this->actingAs($technician)->put(route('application-reports.update', $foreign), [
            'occurred_on' => '2026-08-26',
            'reference' => 'OS-ADMIN',
            'correction_reason' => 'Intento no autorizado',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 1]],
        ])->assertForbidden();

        $this->actingAs($technician)->put(route('application-reports.update', $own), [
            'occurred_on' => '2026-08-27',
            'reference' => 'OS-501',
            'service_order_type' => ServiceOrderType::CitizenService072->value,
            'location' => 'Poblado El Nayar',
            'notes' => 'Se corrigió la cantidad.',
            'correction_reason' => 'El reporte físico indica otra cantidad',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 3]],
        ])->assertSessionHasNoErrors();
        $this->assertSame('4.000', $item->fresh()->usedQuantity());
        $this->assertSame('6.000', $item->fresh()->pendingQuantity());

        $this->actingAs($technician)->get(route('my-vouchers.show', $item->voucher))
            ->assertInertia(fn (Assert $page) => $page
                ->where('voucher.application_reports.0.permissions.update', true)
                ->where('voucher.application_reports.1.permissions.update', false));
    }

    public function test_technician_can_replace_and_remove_evidence_only_from_an_own_report(): void
    {
        Storage::fake('local');
        $person = Person::factory()->create();
        $technician = User::factory()->technician($person)->create();
        $item = $this->voucherItem($person, '2026-08-24', 10);
        $report = MaterialApplicationReport::create([
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-25',
            'reference' => 'OS-700',
            'created_by' => $technician->id,
            'updated_by' => $technician->id,
        ]);

        $this->actingAs($technician)->post(route('application-attachments.store', $report), [
            'attachment' => UploadedFile::fake()->create('primera.jpg', 20, 'image/jpeg'),
        ])->assertSessionHasNoErrors();
        $firstPath = $report->attachment()->sole()->path;
        Storage::disk('local')->assertExists($firstPath);

        $this->actingAs($technician)->post(route('application-attachments.store', $report), [
            'attachment' => UploadedFile::fake()->create('segunda.pdf', 20, 'application/pdf'),
        ])->assertSessionHasNoErrors();
        Storage::disk('local')->assertMissing($firstPath);
        $second = $report->attachment()->sole();
        Storage::disk('local')->assertExists($second->path);

        $this->actingAs($technician)->delete(route('application-attachments.destroy', $report))
            ->assertSessionHasNoErrors();
        Storage::disk('local')->assertMissing($second->path);
        $this->assertDatabaseMissing('material_application_attachments', ['id' => $second->id]);
    }

    public function test_a_person_with_a_technical_account_cannot_lose_receiver_eligibility_or_be_deleted(): void
    {
        $administrator = User::factory()->create();
        $person = Person::factory()->create();
        User::factory()->technician($person)->create();

        $this->actingAs($administrator)->put(route('catalogs.people.update', $person), [
            'name' => $person->name,
            'can_receive_material' => false,
            'can_deliver_material' => true,
            'can_authorize_material' => false,
            'is_active' => true,
        ])->assertSessionHasErrors('can_receive_material');

        $this->actingAs($administrator)->delete(route('catalogs.destroy', ['type' => 'people', 'id' => $person->id]))
            ->assertSessionHasErrors('delete');
        $this->assertDatabaseHas('people', ['id' => $person->id]);
    }

    public function test_historical_reports_without_an_order_remain_visible_but_new_corrections_require_one(): void
    {
        $administrator = User::factory()->create();
        $person = Person::factory()->create();
        $item = $this->voucherItem($person, '2026-08-24', 10);
        $report = MaterialApplicationReport::create([
            'voucher_id' => $item->voucher_id,
            'occurred_on' => '2026-08-25',
            'reference' => null,
            'created_by' => $administrator->id,
            'updated_by' => $administrator->id,
        ]);
        MaterialApplication::create([
            'voucher_item_id' => $item->id,
            'application_report_id' => $report->id,
            'occurred_on' => '2026-08-25',
            'quantity' => 1,
            'reference' => null,
            'created_by' => $administrator->id,
            'updated_by' => $administrator->id,
        ]);

        $this->actingAs($administrator);
        $data = VoucherData::make($item->voucher, true, $administrator);
        $this->assertNull($data['application_reports'][0]['service_order']);

        $this->put(route('application-reports.update', $report), [
            'occurred_on' => '2026-08-26',
            'reference' => '',
            'service_order_type' => ServiceOrderType::Normal->value,
            'correction_reason' => 'Corrección del reporte histórico',
            'items' => [['voucher_item_id' => $item->id, 'quantity' => 1]],
        ])->assertSessionHasErrors('reference');
        $this->assertNull($report->fresh()->reference);
    }

    private function voucherItem(Person $person, string $issuedOn, int $quantity): VoucherItem
    {
        $voucher = Voucher::factory()->create([
            'received_by_id' => $person->id,
            'issued_on' => $issuedOn,
            'direction' => VoucherDirection::Exit,
            'status' => VoucherStatus::Active,
        ]);

        return VoucherItem::factory()->create([
            'voucher_id' => $voucher->id,
            'quantity' => $quantity,
        ]);
    }
}
