<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->boolean('is_luminaire')->default(false)->after('needs_review');
        });

        Schema::table('voucher_items', function (Blueprint $table) {
            $table->text('luminaire_folios')->nullable()->after('quantity');
        });

        DB::table('materials')
            ->where(function ($query): void {
                $query->where('normalized_name', 'like', 'luminaria%')
                    ->orWhere('normalized_name', 'like', 'luminario%')
                    ->orWhere('normalized_name', 'like', 'lnuminaria%');
            })
            ->update(['is_luminaire' => true]);
    }

    public function down(): void
    {
        Schema::table('voucher_items', function (Blueprint $table) {
            $table->dropColumn('luminaire_folios');
        });

        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn('is_luminaire');
        });
    }
};
