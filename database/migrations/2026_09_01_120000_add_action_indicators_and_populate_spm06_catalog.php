<?php

use App\Support\CuratedProgramCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_indicators', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('action_id')->constrained()->restrictOnDelete();
            $table->string('code')->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['action_id', 'is_active']);
        });

        Schema::table('vouchers', function (Blueprint $table): void {
            $table->foreignId('action_indicator_id')
                ->nullable()
                ->after('action_id')
                ->constrained('action_indicators')
                ->restrictOnDelete();
        });

        DB::transaction(function (): void {
            $catalog = app(CuratedProgramCatalog::class)->program();
            $now = now();
            $program = DB::table('programs')->where('code', $catalog['code'])->first();
            if ($program === null) {
                $programId = DB::table('programs')->insertGetId([
                    'code' => $catalog['code'],
                    'name' => $catalog['name'],
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            } else {
                $programId = (int) $program->id;
                if (! filled($program->name)) {
                    DB::table('programs')->where('id', $programId)->update([
                        'name' => $catalog['name'],
                        'updated_at' => $now,
                    ]);
                }
            }

            foreach ($catalog['actions'] as $actionData) {
                $action = DB::table('actions')->where('code', $actionData['code'])->first();
                if ($action === null) {
                    $actionId = DB::table('actions')->insertGetId([
                        'program_id' => $programId,
                        'code' => $actionData['code'],
                        'name' => $actionData['name'],
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                } else {
                    if ((int) $action->program_id !== $programId) {
                        throw new RuntimeException("La acción {$actionData['code']} pertenece a otro programa.");
                    }
                    $actionId = (int) $action->id;
                    if (! filled($action->name)) {
                        DB::table('actions')->where('id', $actionId)->update([
                            'name' => $actionData['name'],
                            'updated_at' => $now,
                        ]);
                    }
                }
                foreach ($actionData['indicators'] as $indicatorData) {
                    $indicator = DB::table('action_indicators')->where('code', $indicatorData['code'])->first();
                    if ($indicator === null) {
                        $indicatorId = DB::table('action_indicators')->insertGetId([
                            'action_id' => $actionId,
                            'code' => $indicatorData['code'],
                            'name' => $indicatorData['name'],
                            'is_active' => true,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    } else {
                        if ((int) $indicator->action_id !== $actionId) {
                            throw new RuntimeException("El indicador {$indicatorData['code']} pertenece a otra acción.");
                        }
                        $indicatorId = (int) $indicator->id;
                        if (! filled($indicator->name)) {
                            DB::table('action_indicators')->where('id', $indicatorId)->update([
                                'name' => $indicatorData['name'],
                                'updated_at' => $now,
                            ]);
                        }
                    }
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('action_indicator_id');
        });
        Schema::dropIfExists('action_indicators');
    }
};
