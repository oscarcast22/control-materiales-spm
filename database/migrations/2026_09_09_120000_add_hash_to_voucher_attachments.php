<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('voucher_attachments', function (Blueprint $table): void {
            $table->string('sha256', 64)->nullable()->after('size');
            $table->unique(['voucher_id', 'sha256'], 'voucher_attachments_voucher_hash_unique');
        });
    }

    public function down(): void
    {
        Schema::table('voucher_attachments', function (Blueprint $table): void {
            $table->dropUnique('voucher_attachments_voucher_hash_unique');
            $table->dropColumn('sha256');
        });
    }
};
