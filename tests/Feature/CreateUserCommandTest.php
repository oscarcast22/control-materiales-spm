<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateUserCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_command_rejects_an_invalid_password(): void
    {
        $this->artisan('app:create-user', [
            '--name' => 'Usuaria de prueba',
            '--email' => 'usuaria@example.com',
            '--password' => 'corta',
        ])->assertFailed();

        $this->assertDatabaseMissing('users', ['email' => 'usuaria@example.com']);
    }

    public function test_the_command_creates_an_active_verified_user_with_a_valid_password(): void
    {
        $password = 'Segura-para-pruebas-2026!';

        $this->artisan('app:create-user', [
            '--name' => 'Usuaria de prueba',
            '--email' => 'USUARIA@example.com',
            '--password' => $password,
        ])->assertSuccessful();

        $user = User::query()->sole();
        $this->assertSame('usuaria@example.com', $user->email);
        $this->assertSame('Usuaria de prueba', $user->name);
        $this->assertTrue($user->is_active);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check($password, $user->password));
    }
}
