<?php

namespace Tests\Feature;

use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TechnicianAccessMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION_PATH = 'database/migrations/2026_09_03_120000_add_technician_access_to_users_and_application_reports.php';

    public function test_rollback_deactivates_technicians_and_rerun_normalizes_existing_emails(): void
    {
        $administrator = User::factory()->create(['email' => 'ADMIN@EXAMPLE.COM']);
        $technicianWithEmail = User::factory()->technician(Person::factory()->create())->create([
            'email' => 'TECHNICIAN@EXAMPLE.COM',
        ]);
        $technicianWithoutEmail = User::factory()->technician(Person::factory()->create())->create([
            'email' => null,
        ]);

        $this->artisan('migrate:rollback', ['--path' => self::MIGRATION_PATH])->assertSuccessful();

        $this->assertFalse(Schema::hasColumn('users', 'role'));
        $this->assertDatabaseHas('users', [
            'id' => $administrator->id,
            'email' => 'ADMIN@EXAMPLE.COM',
            'is_active' => true,
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $technicianWithEmail->id,
            'email' => 'TECHNICIAN@EXAMPLE.COM',
            'is_active' => false,
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $technicianWithoutEmail->id,
            'email' => "rollback-user-{$technicianWithoutEmail->id}@invalid.local",
            'is_active' => false,
        ]);

        $this->artisan('migrate', ['--path' => self::MIGRATION_PATH])->assertSuccessful();

        $this->assertTrue(Schema::hasColumn('users', 'role'));
        $this->assertDatabaseHas('users', [
            'id' => $administrator->id,
            'email' => 'admin@example.com',
            'is_active' => true,
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $technicianWithEmail->id,
            'email' => 'technician@example.com',
            'is_active' => false,
        ]);
    }

    public function test_migration_stops_before_schema_or_data_changes_when_normalized_emails_collide(): void
    {
        $this->artisan('migrate:rollback', ['--path' => self::MIGRATION_PATH])->assertSuccessful();

        DB::table('users')->insert([
            [
                'name' => 'First account',
                'email' => 'COLLISION@EXAMPLE.COM',
                'password' => 'unused',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Second account',
                'email' => 'collision@example.com',
                'password' => 'unused',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        try {
            $this->artisan('migrate', ['--path' => self::MIGRATION_PATH]);
            $this->fail('La migración debía detenerse por los correos duplicados.');
        } catch (\RuntimeException $exception) {
            $this->assertSame(
                'No se puede habilitar el acceso técnico porque existen correos duplicados al ignorar mayúsculas. Corrige los datos y vuelve a ejecutar la migración.',
                $exception->getMessage(),
            );
        }

        $this->assertFalse(Schema::hasColumn('users', 'role'));
        $this->assertDatabaseHas('users', ['email' => 'COLLISION@EXAMPLE.COM']);

        DB::table('users')->where('email', 'collision@example.com')->delete();
        $this->artisan('migrate', ['--path' => self::MIGRATION_PATH])->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'collision@example.com']);
    }
}
