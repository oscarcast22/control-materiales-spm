<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('symbol', 20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique('symbol');
        });

        Schema::create('storage_locations', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name');
            $table->date('tracking_started_on');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('normalized_name')->unique();
            $table->foreignId('default_unit_id')->constrained('units')->restrictOnDelete();
            $table->boolean('is_active')->default(true);
            $table->boolean('needs_review')->default(false);
            $table->timestamps();
        });

        Schema::create('material_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained()->cascadeOnDelete();
            $table->string('alias');
            $table->string('normalized_alias')->unique();
            $table->timestamps();
        });

        Schema::create('people', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('normalized_name')->unique();
            $table->boolean('can_receive_material')->default(false);
            $table->boolean('can_deliver_material')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('needs_review')->default(false);
            $table->timestamps();
        });

        Schema::create('person_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->constrained()->cascadeOnDelete();
            $table->string('alias');
            $table->string('normalized_alias')->unique();
            $table->timestamps();
        });

        Schema::create('programs', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->string('code')->unique();
            $table->string('name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('storage_location_id')->constrained()->restrictOnDelete();
            $table->string('folio');
            $table->string('folio_key');
            $table->string('direction', 20);
            $table->string('reference')->nullable();
            $table->date('issued_on');
            $table->time('issued_time')->nullable();
            $table->foreignId('received_by_id')->constrained('people')->restrictOnDelete();
            $table->foreignId('delivered_by_id')->constrained('people')->restrictOnDelete();
            $table->foreignId('authorized_by_id')->nullable()->constrained('people')->nullOnDelete();
            $table->foreignId('program_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('action_id')->nullable()->constrained()->nullOnDelete();
            $table->text('destination');
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('active');
            $table->boolean('needs_review')->default(false);
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['storage_location_id', 'folio_key'], 'vouchers_location_folio_unique');
            $table->index(['issued_on', 'status']);
            $table->index(['received_by_id', 'issued_on']);
            $table->index(['storage_location_id', 'direction', 'issued_on'], 'vouchers_location_direction_date_index');
        });

        Schema::create('voucher_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained()->restrictOnDelete();
            $table->foreignId('unit_id')->constrained()->restrictOnDelete();
            $table->string('description_snapshot');
            $table->decimal('quantity', 12, 3);
            $table->boolean('legacy_anomaly')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['material_id', 'voucher_id']);
        });

        Schema::create('material_dispositions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_item_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);
            $table->date('occurred_on');
            $table->decimal('quantity', 12, 3);
            $table->string('reference')->nullable();
            $table->text('destination')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedSmallInteger('legacy_slot')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['voucher_item_id', 'voided_at']);
        });

        Schema::create('inventory_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('storage_location_id')->constrained()->restrictOnDelete();
            $table->foreignId('material_id')->constrained()->restrictOnDelete();
            $table->foreignId('unit_id')->constrained()->restrictOnDelete();
            $table->date('occurred_on');
            $table->decimal('quantity_delta', 12, 3);
            $table->text('reason');
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['storage_location_id', 'material_id', 'occurred_on'], 'adjustments_location_material_date_index');
        });

        Schema::create('voucher_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained()->cascadeOnDelete();
            $table->string('disk', 40)->default('local');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 40);
            $table->string('auditable_type');
            $table->unsignedBigInteger('auditable_id');
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->timestamps();
            $table->index(['auditable_type', 'auditable_id']);
        });

        Schema::create('legacy_import_rows', function (Blueprint $table) {
            $table->id();
            $table->string('source_hash', 64);
            $table->string('source_name');
            $table->string('sheet_name');
            $table->unsignedInteger('row_number');
            $table->json('raw_data');
            $table->json('issue_codes')->nullable();
            $table->string('imported_type')->nullable();
            $table->unsignedBigInteger('imported_id')->nullable();
            $table->timestamps();
            $table->unique(['source_hash', 'sheet_name', 'row_number'], 'legacy_source_row_unique');
            $table->index(['imported_type', 'imported_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('legacy_import_rows');
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('voucher_attachments');
        Schema::dropIfExists('inventory_adjustments');
        Schema::dropIfExists('material_dispositions');
        Schema::dropIfExists('voucher_items');
        Schema::dropIfExists('vouchers');
        Schema::dropIfExists('actions');
        Schema::dropIfExists('programs');
        Schema::dropIfExists('person_aliases');
        Schema::dropIfExists('people');
        Schema::dropIfExists('material_aliases');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('storage_locations');
        Schema::dropIfExists('units');
    }
};
