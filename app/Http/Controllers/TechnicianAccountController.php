<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\Person;
use App\Models\User;
use App\Support\TechnicianCredentials;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TechnicianAccountController extends Controller
{
    public function __construct(private readonly TechnicianCredentials $credentials) {}

    public function store(Person $person): RedirectResponse
    {
        Gate::authorize('manage-accounts');

        $user = DB::transaction(function () use ($person): User {
            $lockedPerson = Person::query()->lockForUpdate()->findOrFail($person->id);
            $this->ensureEligiblePerson($lockedPerson);
            abort_if($lockedPerson->account()->exists(), 409, 'Esta persona ya tiene una cuenta técnica.');
            $user = User::create([
                'name' => $lockedPerson->name,
                'username' => $this->credentials->username($lockedPerson),
                'email' => null,
                'email_verified_at' => null,
                'password' => $this->credentials->password($lockedPerson),
                'role' => UserRole::Technician,
                'person_id' => $lockedPerson->id,
                'is_active' => true,
            ]);
            AuditEvent::record($user, 'technician_account_created', null, $this->auditData($user));

            return $user;
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Acceso técnico creado para {$user->username}.",
        ]);

        return back();
    }

    public function update(Request $request, Person $person): RedirectResponse
    {
        Gate::authorize('manage-accounts');
        $this->ensureEligiblePerson($person);
        $account = $person->account()->firstOrFail();
        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
            'username' => ['prohibited'],
            'email' => ['prohibited'],
            'password' => ['prohibited'],
        ]);

        DB::transaction(function () use ($account, $person, $data): void {
            $locked = User::query()->lockForUpdate()->findOrFail($account->id);
            $before = $this->auditData($locked);
            $locked->update([
                'name' => $person->name,
                'is_active' => $data['is_active'],
            ]);
            AuditEvent::record($locked, 'technician_account_updated', $before, $this->auditData($locked->fresh()));
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Acceso técnico actualizado.']);

        return back();
    }

    public function resetPassword(Person $person): RedirectResponse
    {
        Gate::authorize('manage-accounts');
        $account = $person->account()->firstOrFail();
        $account->update(['password' => $this->credentials->password($person)]);
        AuditEvent::record($account, 'technician_password_reset', null, [
            'reset_at' => now()->toIso8601String(),
            'source' => 'charge_number',
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'La contraseña se restableció al número de cobro registrado.',
        ]);

        return back();
    }

    private function ensureEligiblePerson(Person $person): void
    {
        if (! $person->is_active || ! $person->can_receive_material) {
            throw ValidationException::withMessages([
                'account' => 'La persona debe estar activa y tener la función “Recibe / técnico”.',
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function auditData(User $user): array
    {
        return $user->only([
            'id', 'name', 'username', 'email', 'role', 'person_id', 'is_active', 'email_verified_at',
        ]);
    }
}
