<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$tables = [
    'actions',
    'audit_events',
    'destination_aliases',
    'destination_voucher',
    'destinations',
    'inventory_adjustments',
    'legacy_import_rows',
    'material_aliases',
    'material_application_attachments',
    'material_application_reports',
    'material_applications',
    'material_storage_location',
    'materials',
    'migrations',
    'passkeys',
    'people',
    'person_aliases',
    'programs',
    'storage_locations',
    'units',
    'users',
    'voucher_attachments',
    'voucher_items',
    'vouchers',
];

$counts = [];
foreach ($tables as $table) {
    $counts[$table] = DB::table($table)->count();
}

$privateRoot = storage_path('app/private');
$privateCount = 0;
$privateBytes = 0;
if (is_dir($privateRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($privateRoot, FilesystemIterator::SKIP_DOTS),
    );

    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getFilename() !== '.gitignore') {
            $privateCount++;
            $privateBytes += $file->getSize();
        }
    }
}

echo json_encode([
    'tables' => $counts,
    'private_files' => $privateCount,
    'private_bytes' => $privateBytes,
], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT).PHP_EOL;
