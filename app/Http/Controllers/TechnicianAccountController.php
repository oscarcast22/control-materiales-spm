<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\Person;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class TechnicianAccountController extends Controller
{
    public function store(Request $request, Person $person): RedirectResponse
    {
        Gate::authorize('manage-accounts');
        $this->ensureEligiblePerson($person);
        abort_if($person->account()->exists(), 409, 'Esta persona ya tiene una cuenta técnica.');
        $this->normalizeIdentifiers($request);
        $data = $request->validate([
            'username' => $this->usernameRules(),
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Password::default()],
        ]);

        $user = DB::transaction(function () use ($person, $data): User {
            $user = User::create([
                'name' => $person->name,
                'username' => $data['username'],
                'email' => $data['email'] ?? null,
                'email_verified_at' => filled($data['email'] ?? null) ? now() : null,
                'password' => $data['password'],
                'role' => UserRole::Technician,
                'person_id' => $person->id,
                'is_active' => true,
            ]);
            AuditEvent::record($user, 'technician_account_created', null, $this->auditData($user));

            return $user;
        });

        return back()->with('success', "Acceso técnico creado para {$user->username}.");
    }

    public function update(Request $request, Person $person): RedirectResponse
    {
        Gate::authorize('manage-accounts');
        $this->ensureEligiblePerson($person);
        $account = $person->account()->firstOrFail();
        $this->normalizeIdentifiers($request);
        $data = $request->validate([
            'username' => $this->usernameRules($account),
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($account)],
            'is_active' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($account, $person, $data): void {
            $locked = User::query()->lockForUpdate()->findOrFail($account->id);
            $before = $this->auditData($locked);
            $emailChanged = $locked->email !== ($data['email'] ?? null);
            $locked->update([
                'name' => $person->name,
                'username' => $data['username'],
                'email' => $data['email'] ?? null,
                'email_verified_at' => $emailChanged
                    ? (filled($data['email'] ?? null) ? now() : null)
                    : $locked->email_verified_at,
                'is_active' => $data['is_active'],
            ]);
            AuditEvent::record($locked, 'technician_account_updated', $before, $this->auditData($locked->fresh()));
        });

        return back()->with('success', 'Acceso técnico actualizado.');
    }

    public function resetPassword(Request $request, Person $person): RedirectResponse
    {
        Gate::authorize('manage-accounts');
        $account = $person->account()->firstOrFail();
        $data = $request->validate([
            'password' => ['required', 'confirmed', Password::default()],
        ]);

        $account->update(['password' => $data['password']]);
        AuditEvent::record($account, 'technician_password_reset', null, [
            'reset_at' => now()->toIso8601String(),
        ]);

        return back()->with('success', 'Contraseña restablecida. La contraseña anterior no se puede consultar.');
    }

    private function ensureEligiblePerson(Person $person): void
    {
        if (! $person->is_active || ! $person->can_receive_material) {
            throw ValidationException::withMessages([
                'account' => 'La persona debe estar activa y tener la función “Recibe / técnico”.',
            ]);
        }
    }

    private function normalizeIdentifiers(Request $request): void
    {
        $request->merge([
            'username' => mb_strtolower(trim((string) $request->input('username'))),
            'email' => filled($request->input('email'))
                ? mb_strtolower(trim((string) $request->input('email')))
                : null,
        ]);
    }

    /** @return array<int, mixed> */
    private function usernameRules(?User $account = null): array
    {
        $unique = Rule::unique('users', 'username');
        if ($account !== null) {
            $unique->ignore($account);
        }

        return ['required', 'string', 'min:3', 'max:60', 'regex:/^[a-z0-9._-]+$/', $unique];
    }

    /** @return array<string, mixed> */
    private function auditData(User $user): array
    {
        return $user->only([
            'id', 'name', 'username', 'email', 'role', 'person_id', 'is_active', 'email_verified_at',
        ]);
    }
}
