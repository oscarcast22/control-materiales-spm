<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

#[Signature('app:create-user {--name=} {--email=} {--password=}')]
#[Description('Crea una cuenta autorizada para Control de Materiales SPM')]
class CreateUser extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = (string) ($this->option('name') ?: $this->ask('Nombre'));
        $email = (string) ($this->option('email') ?: $this->ask('Correo electrónico'));
        $password = (string) ($this->option('password') ?: $this->secret('Contraseña'));
        $data = compact('name', 'email', 'password');
        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }
        User::create([
            'name' => $name,
            'email' => mb_strtolower($email),
            'password' => Hash::make($password),
            'email_verified_at' => now(),
            'is_active' => true,
        ]);
        $this->info("Cuenta creada para {$email}.");

        return self::SUCCESS;
    }
}
