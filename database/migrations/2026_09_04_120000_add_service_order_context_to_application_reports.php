<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_application_reports', function (Blueprint $table): void {
            $table->string('service_order_type', 40)->nullable()->after('reference');
            $table->string('location', 500)->nullable()->after('service_order_type');
        });
    }

    public function down(): void
    {
        Schema::table('material_application_reports', function (Blueprint $table): void {
            $table->dropColumn(['service_order_type', 'location']);
        });
    }
};
