<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MaterialApplicationAttachmentController;
use App\Http\Controllers\MaterialApplicationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\VoucherAttachmentController;
use App\Http\Controllers\VoucherController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => auth()->check() ? redirect()->route('dashboard') : redirect()->route('login'))->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::resource('vouchers', VoucherController::class)->except('destroy');
    Route::post('vouchers/cancelled', [VoucherController::class, 'storeCancelled'])->name('vouchers.cancelled.store');
    Route::post('vouchers/loaned', [VoucherController::class, 'storeLoaned'])->name('vouchers.loaned.store');
    Route::post('vouchers/{voucher}/cancel', [VoucherController::class, 'cancel'])->name('vouchers.cancel');
    Route::post('vouchers/{voucher}/review', [VoucherController::class, 'review'])->name('vouchers.review');
    Route::get('vouchers/{voucher}/print', [VoucherController::class, 'print'])->name('vouchers.print');
    Route::get('material-applications/vouchers', [MaterialApplicationController::class, 'searchVouchers'])->name('applications.vouchers.search');
    Route::post('material-applications', [MaterialApplicationController::class, 'store'])->name('applications.store');
    Route::post('material-applications/{application}/void', [MaterialApplicationController::class, 'void'])->name('applications.void');
    Route::get('material-application-attachments/{attachment}', [MaterialApplicationAttachmentController::class, 'show'])->name('application-attachments.show');
    Route::get('attachments/{attachment}', [VoucherAttachmentController::class, 'show'])->name('attachments.show');
    Route::delete('attachments/{attachment}', [VoucherAttachmentController::class, 'destroy'])->name('attachments.destroy');

    Route::get('catalogs', [CatalogController::class, 'index'])->name('catalogs.index');
    Route::post('catalogs/materials', [CatalogController::class, 'storeMaterial'])->name('catalogs.materials.store');
    Route::put('catalogs/materials/{material}', [CatalogController::class, 'updateMaterial'])->name('catalogs.materials.update');
    Route::post('catalogs/people', [CatalogController::class, 'storePerson'])->name('catalogs.people.store');
    Route::put('catalogs/people/{person}', [CatalogController::class, 'updatePerson'])->name('catalogs.people.update');
    Route::post('catalogs/destinations', [CatalogController::class, 'storeDestination'])->name('catalogs.destinations.store');
    Route::put('catalogs/destinations/{destination}', [CatalogController::class, 'updateDestination'])->name('catalogs.destinations.update');
    Route::post('catalogs/units', [CatalogController::class, 'storeUnit'])->name('catalogs.units.store');
    Route::put('catalogs/units/{unit}', [CatalogController::class, 'updateUnit'])->name('catalogs.units.update');
    Route::post('catalogs/programs', [CatalogController::class, 'storeProgram'])->name('catalogs.programs.store');
    Route::put('catalogs/programs/{program}', [CatalogController::class, 'updateProgram'])->name('catalogs.programs.update');
    Route::post('catalogs/actions', [CatalogController::class, 'storeAction'])->name('catalogs.actions.store');
    Route::put('catalogs/actions/{action}', [CatalogController::class, 'updateAction'])->name('catalogs.actions.update');
    Route::post('catalogs/{type}/{id}/toggle', [CatalogController::class, 'toggle'])->name('catalogs.toggle');
    Route::post('catalogs/{type}/{source}/merge', [CatalogController::class, 'merge'])->name('catalogs.merge');

    Route::get('reports/material-tracking', [ReportController::class, 'tracking'])->name('reports.material-tracking');
    Route::get('reports/balances', fn (Request $request) => redirect()->route('reports.material-tracking', $request->query()))->name('reports.balances');
    Route::get('reports/inventory', fn (Request $request) => redirect()->route('reports.material-tracking', $request->query()))->name('reports.inventory');
    Route::get('reports/export', [ReportController::class, 'export'])->name('reports.export');
});

require __DIR__.'/settings.php';
