<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('vouchers', function (Blueprint $table): void {
            $table->dropForeign(['authorized_by_id']);
            $table->dropForeign(['program_id']);
            $table->dropForeign(['action_id']);
            $table->foreign('authorized_by_id')->references('id')->on('people')->restrictOnDelete();
            $table->foreign('program_id')->references('id')->on('programs')->restrictOnDelete();
            $table->foreign('action_id')->references('id')->on('actions')->restrictOnDelete();
        });

        Schema::table('actions', function (Blueprint $table): void {
            $table->dropForeign(['program_id']);
            $table->foreign('program_id')->references('id')->on('programs')->restrictOnDelete();
        });

        Schema::table('destination_voucher', function (Blueprint $table): void {
            $table->dropForeign(['destination_id']);
            $table->foreign('destination_id')->references('id')->on('destinations')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('destination_voucher', function (Blueprint $table): void {
            $table->dropForeign(['destination_id']);
            $table->foreign('destination_id')->references('id')->on('destinations')->cascadeOnDelete();
        });

        Schema::table('actions', function (Blueprint $table): void {
            $table->dropForeign(['program_id']);
            $table->foreign('program_id')->references('id')->on('programs')->cascadeOnDelete();
        });

        Schema::table('vouchers', function (Blueprint $table): void {
            $table->dropForeign(['authorized_by_id']);
            $table->dropForeign(['program_id']);
            $table->dropForeign(['action_id']);
            $table->foreign('authorized_by_id')->references('id')->on('people')->nullOnDelete();
            $table->foreign('program_id')->references('id')->on('programs')->nullOnDelete();
            $table->foreign('action_id')->references('id')->on('actions')->nullOnDelete();
        });
    }
};
