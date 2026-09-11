<?php

namespace Tests\Feature;

use App\Models\Person;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Tests\TestCase;

class ValidationMessagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_standard_validation_messages_are_clear_and_in_spanish(): void
    {
        $this->app->setLocale('es');
        Person::factory()->create(['charge_number' => '12345']);

        $required = Validator::make([], ['charge_number' => ['required']]);
        $invalidFormat = Validator::make(
            ['charge_number' => 'AB-12'],
            ['charge_number' => ['required', 'regex:/^\\d+$/']],
        );
        $duplicate = Validator::make(
            ['charge_number' => '12345'],
            ['charge_number' => ['required', Rule::unique('people', 'charge_number')]],
        );
        $unavailable = Validator::make(
            ['default_unit_id' => 999999],
            ['default_unit_id' => ['required', 'exists:units,id']],
        );

        $this->assertSame('Escribe número de cobro.', $required->errors()->first('charge_number'));
        $this->assertSame('Escribe sólo números en el número de cobro.', $invalidFormat->errors()->first('charge_number'));
        $this->assertSame('Ese número de cobro ya está registrado.', $duplicate->errors()->first('charge_number'));
        $this->assertSame('La opción seleccionada ya no está disponible.', $unavailable->errors()->first('default_unit_id'));

        foreach ([$required, $invalidFormat, $duplicate, $unavailable] as $validator) {
            foreach ($validator->errors()->all() as $message) {
                $this->assertStringNotContainsString('validation.', $message);
            }
        }
    }

    public function test_account_messages_use_clear_spanish_field_names(): void
    {
        $this->app->setLocale('es');
        $invalidEmail = Validator::make(['email' => 'correo-invalido'], ['email' => ['required', 'email']]);
        $unconfirmedPassword = Validator::make(
            ['password' => 'secreto', 'password_confirmation' => 'otro'],
            ['password' => ['required', 'confirmed']],
        );

        $this->assertSame('Escribe un correo electrónico válido.', $invalidEmail->errors()->first('email'));
        $this->assertSame('Las contraseñas no coinciden.', $unconfirmedPassword->errors()->first('password'));
    }
}
