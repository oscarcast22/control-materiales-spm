<?php

use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $normalizedEmails = [];
        $seenEmails = [];

        DB::table('users')
            ->select(['id', 'email'])
            ->whereNotNull('email')
            ->orderBy('id')
            ->each(function (object $user) use (&$normalizedEmails, &$seenEmails): void {
                $normalizedEmail = mb_strtolower(trim((string) $user->email));

                if ($normalizedEmail === '') {
                    throw new RuntimeException(
                        'No se puede habilitar el acceso técnico porque existen correos vacíos. Corrige los datos y vuelve a ejecutar la migración.',
                    );
                }

                if (isset($seenEmails[$normalizedEmail])) {
                    throw new RuntimeException(
                        'No se puede habilitar el acceso técnico porque existen correos duplicados al ignorar mayúsculas. Corrige los datos y vuelve a ejecutar la migración.',
                    );
                }

                $seenEmails[$normalizedEmail] = true;
                $normalizedEmails[(int) $user->id] = $normalizedEmail;
            });

        foreach ($normalizedEmails as $userId => $normalizedEmail) {
            DB::table('users')->where('id', $userId)->update([
                'email' => $normalizedEmail,
            ]);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->string('role', 30)->default(UserRole::Administrator->value)->index();
            $table->string('username', 60)->nullable()->unique();
            $table->foreignId('person_id')->nullable()->unique()->constrained('people')->restrictOnDelete();
            $table->string('email')->nullable()->change();
        });

        Schema::table('material_application_reports', function (Blueprint $table): void {
            $table->text('notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('material_application_reports', function (Blueprint $table): void {
            $table->dropColumn('notes');
        });

        DB::table('users')
            ->where('role', UserRole::Technician->value)
            ->update(['is_active' => false]);

        DB::table('users')->whereNull('email')->orderBy('id')->eachById(function (object $user): void {
            DB::table('users')->where('id', $user->id)->update([
                'email' => "rollback-user-{$user->id}@invalid.local",
            ]);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['person_id']);
            $table->dropConstrainedForeignId('person_id');
            $table->dropUnique(['username']);
            $table->dropIndex(['role']);
            $table->dropColumn(['role', 'username']);
            $table->string('email')->nullable(false)->change();
        });
    }
};
