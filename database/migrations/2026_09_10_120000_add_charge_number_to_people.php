<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('people', function (Blueprint $table): void {
            // Nullable during the controlled reconciliation of current personnel.
            $table->string('charge_number', 20)->nullable()->unique()->after('normalized_name');
        });
    }

    public function down(): void
    {
        Schema::table('people', function (Blueprint $table): void {
            $table->dropUnique(['charge_number']);
            $table->dropColumn('charge_number');
        });
    }
};
