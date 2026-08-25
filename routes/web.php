<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InventoryAdjustmentController;
use App\Http\Controllers\MaterialDispositionController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\VoucherAttachmentController;
use App\Http\Controllers\VoucherController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => auth()->check() ? redirect()->route('dashboard') : redirect()->route('login'))->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::resource('vouchers', VoucherController::class)->except('destroy');
    Route::post('vouchers/{voucher}/cancel', [VoucherController::class, 'cancel'])->name('vouchers.cancel');
    Route::get('vouchers/{voucher}/print', [VoucherController::class, 'print'])->name('vouchers.print');
    Route::post('voucher-items/{item}/dispositions', [MaterialDispositionController::class, 'store'])->name('dispositions.store');
    Route::post('dispositions/{disposition}/void', [MaterialDispositionController::class, 'void'])->name('dispositions.void');
    Route::get('attachments/{attachment}', [VoucherAttachmentController::class, 'show'])->name('attachments.show');
    Route::delete('attachments/{attachment}', [VoucherAttachmentController::class, 'destroy'])->name('attachments.destroy');

    Route::get('catalogs', [CatalogController::class, 'index'])->name('catalogs.index');
    Route::post('catalogs/materials', [CatalogController::class, 'storeMaterial'])->name('catalogs.materials.store');
    Route::put('catalogs/materials/{material}', [CatalogController::class, 'updateMaterial'])->name('catalogs.materials.update');
    Route::post('catalogs/people', [CatalogController::class, 'storePerson'])->name('catalogs.people.store');
    Route::put('catalogs/people/{person}', [CatalogController::class, 'updatePerson'])->name('catalogs.people.update');
    Route::post('catalogs/units', [CatalogController::class, 'storeUnit'])->name('catalogs.units.store');
    Route::post('catalogs/programs', [CatalogController::class, 'storeProgram'])->name('catalogs.programs.store');
    Route::post('catalogs/actions', [CatalogController::class, 'storeAction'])->name('catalogs.actions.store');
    Route::post('catalogs/locations', [CatalogController::class, 'storeLocation'])->name('catalogs.locations.store');
    Route::put('catalogs/locations/{location}', [CatalogController::class, 'updateLocation'])->name('catalogs.locations.update');
    Route::post('catalogs/{type}/{id}/toggle', [CatalogController::class, 'toggle'])->name('catalogs.toggle');
    Route::post('catalogs/{type}/{source}/merge', [CatalogController::class, 'merge'])->name('catalogs.merge');

    Route::get('reports/balances', [ReportController::class, 'balances'])->name('reports.balances');
    Route::get('reports/inventory', [ReportController::class, 'inventory'])->name('reports.inventory');
    Route::get('reports/export', [ReportController::class, 'export'])->name('reports.export');
    Route::post('inventory-adjustments', [InventoryAdjustmentController::class, 'store'])->name('inventory-adjustments.store');
    Route::post('inventory-adjustments/{adjustment}/void', [InventoryAdjustmentController::class, 'void'])->name('inventory-adjustments.void');
});

require __DIR__.'/settings.php';
