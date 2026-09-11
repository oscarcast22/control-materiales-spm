<?php

namespace App\Support;

use App\Models\Person;
use App\Models\User;
use Illuminate\Validation\ValidationException;

final class TechnicianCredentials
{
    public function previewUsername(Person $person): string
    {
        return str_replace(' ', '', Normalizer::key($person->name));
    }

    public function username(Person $person): string
    {
        $username = $this->previewUsername($person);

        if (mb_strlen($username) < 3 || mb_strlen($username) > 60) {
            throw ValidationException::withMessages([
                'username' => 'El nombre de la persona no permite generar un usuario válido. Corrígelo antes de crear el acceso.',
            ]);
        }

        if (User::query()->where('username', $username)->exists()) {
            throw ValidationException::withMessages([
                'username' => 'El usuario automático ya pertenece a otra cuenta. Revisa el nombre de la persona antes de crear el acceso.',
            ]);
        }

        return $username;
    }

    public function password(Person $person): string
    {
        $chargeNumber = $person->charge_number;

        if ($chargeNumber === null || $chargeNumber === '') {
            throw ValidationException::withMessages([
                'charge_number' => 'Registra un número de cobro válido antes de crear o restablecer el acceso.',
            ]);
        }

        return $chargeNumber;
    }
}
