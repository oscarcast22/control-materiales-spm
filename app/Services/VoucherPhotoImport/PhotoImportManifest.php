<?php

namespace App\Services\VoucherPhotoImport;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use JsonException;
use RuntimeException;

final class PhotoImportManifest
{
    /** @return array<string, mixed> */
    public function load(string $manifestPath, string $imagesDirectory): array
    {
        $manifestPath = realpath($manifestPath) ?: throw new RuntimeException('No se encontró el manifiesto indicado.');
        $imagesDirectory = realpath($imagesDirectory) ?: throw new RuntimeException('No se encontró la carpeta de imágenes indicada.');
        if (! is_file($manifestPath) || ! is_dir($imagesDirectory)) {
            throw new RuntimeException('El manifiesto o la carpeta de imágenes no son válidos.');
        }

        try {
            $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('El manifiesto no contiene JSON válido.', previous: $exception);
        }
        if (! is_array($manifest)) {
            throw new RuntimeException('El manifiesto debe contener un objeto JSON.');
        }

        Validator::make($manifest, [
            'schema_version' => ['required', 'integer', 'in:1'],
            'batch' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9][a-z0-9-]*$/'],
            'catalog_additions' => ['sometimes', 'array'],
            'catalog_additions.materials' => ['sometimes', 'array'],
            'catalog_additions.materials.*.name' => ['required', 'string', 'max:255'],
            'catalog_additions.materials.*.unit_symbol' => ['required', 'string', 'max:30'],
            'catalog_additions.materials.*.voucher_types' => ['required', 'array', 'min:1'],
            'catalog_additions.materials.*.voucher_types.*' => ['required', 'string', 'in:warehouse,yard', 'distinct'],
            'catalog_additions.materials.*.is_luminaire' => ['required', 'boolean'],
            'catalog_additions.destinations' => ['sometimes', 'array'],
            'catalog_additions.destinations.*.name' => ['required', 'string', 'max:255'],
            'vouchers' => ['required', 'array', 'min:1'],
            'vouchers.*.decision' => ['required', 'string', 'in:create,attach_only,reconcile_existing,blocked'],
            'vouchers.*.voucher_type' => ['required', 'string', 'in:warehouse,yard'],
            'vouchers.*.folio' => ['required', 'string', 'max:50'],
            'vouchers.*.issued_on' => ['nullable', 'date_format:Y-m-d'],
            'vouchers.*.status' => ['nullable', 'string', 'in:active,cancelled,loaned'],
            'vouchers.*.direction' => ['nullable', 'string', 'in:entry,exit'],
            'vouchers.*.received_by' => ['nullable', 'string', 'max:255'],
            'vouchers.*.delivered_by' => ['nullable', 'string', 'max:255'],
            'vouchers.*.authorized_by' => ['nullable', 'string', 'max:255'],
            'vouchers.*.action' => ['nullable', 'string', 'max:50'],
            'vouchers.*.action_indicator' => ['nullable', 'string', 'max:50'],
            'vouchers.*.destinations' => ['sometimes', 'array', 'max:10'],
            'vouchers.*.destinations.*' => ['required', 'string', 'max:255'],
            'vouchers.*.usage_description' => ['nullable', 'string', 'max:3000'],
            'vouchers.*.notes' => ['nullable', 'string', 'max:5000'],
            'vouchers.*.items' => ['sometimes', 'array'],
            'vouchers.*.items.*.material' => ['required', 'string', 'max:255'],
            'vouchers.*.items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'vouchers.*.items.*.luminaire_folios' => ['nullable', 'string', 'max:5000'],
            'vouchers.*.review_reasons' => ['sometimes', 'array'],
            'vouchers.*.review_reasons.*' => ['required', 'string', 'max:120'],
            'vouchers.*.comparison_notes' => ['sometimes', 'array'],
            'vouchers.*.comparison_notes.*' => ['required', 'string', 'max:500'],
            'vouchers.*.blocking_reasons' => ['sometimes', 'array'],
            'vouchers.*.blocking_reasons.*' => ['required', 'string', 'max:500'],
            'vouchers.*.expected_updated_at' => ['required_if:vouchers.*.decision,reconcile_existing', 'date_format:Y-m-d H:i:s'],
            'vouchers.*.expected_attachment_count' => ['required_if:vouchers.*.decision,reconcile_existing', 'integer', 'min:0'],
            'vouchers.*.updates' => ['sometimes', 'array'],
            'vouchers.*.updates.issued_on' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:2026-01-01'],
            'vouchers.*.updates.usage_description' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'vouchers.*.updates.add_destinations' => ['sometimes', 'array', 'max:10'],
            'vouchers.*.updates.add_destinations.*' => ['required', 'string', 'max:255', 'distinct'],
            'vouchers.*.updates.items' => ['sometimes', 'array'],
            'vouchers.*.updates.items.*.current_material' => ['required', 'string', 'max:255'],
            'vouchers.*.updates.items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'vouchers.*.updates.items.*.material' => ['sometimes', 'string', 'max:255'],
            'vouchers.*.updates.items.*.luminaire_folios' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'vouchers.*.images' => ['required', 'array', 'min:1', 'max:5'],
            'vouchers.*.images.*.file' => ['required', 'string', 'max:255'],
            'vouchers.*.images.*.original_name' => ['sometimes', 'string', 'max:255'],
            'vouchers.*.images.*.sha256' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
        ])->validate();

        $seenHashes = [];
        foreach ($manifest['vouchers'] as $voucherIndex => &$voucher) {
            foreach ($voucher['images'] as $imageIndex => &$image) {
                $file = $image['file'];
                $normalizedFile = str_replace('\\', '/', $file);
                if ($normalizedFile !== $file || str_starts_with($file, '/') || in_array('..', explode('/', $file), true)) {
                    throw ValidationException::withMessages(["vouchers.{$voucherIndex}.images.{$imageIndex}.file" => 'La ruta de la imagen debe ser relativa y permanecer dentro de la carpeta autorizada.']);
                }
                $path = realpath($imagesDirectory.DIRECTORY_SEPARATOR.$file);
                if ($path === false || ! is_file($path) || ! str_starts_with($path, $imagesDirectory.DIRECTORY_SEPARATOR)) {
                    throw ValidationException::withMessages(["vouchers.{$voucherIndex}.images.{$imageIndex}.file" => 'No se encontró la imagen dentro de la carpeta autorizada.']);
                }
                $hash = hash_file('sha256', $path);
                if ($hash === false || ! hash_equals($image['sha256'], $hash)) {
                    throw ValidationException::withMessages(["vouchers.{$voucherIndex}.images.{$imageIndex}.sha256" => 'La huella de la imagen no coincide con el manifiesto.']);
                }
                if (isset($seenHashes[$hash])) {
                    throw ValidationException::withMessages(["vouchers.{$voucherIndex}.images.{$imageIndex}.sha256" => 'La misma fotografía aparece más de una vez en el manifiesto.']);
                }
                $mime = mime_content_type($path) ?: '';
                if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], true) || filesize($path) > 10 * 1024 * 1024) {
                    throw ValidationException::withMessages(["vouchers.{$voucherIndex}.images.{$imageIndex}.file" => 'El archivo debe ser JPG, PNG, WebP o PDF y medir como máximo 10 MB.']);
                }
                $seenHashes[$hash] = true;
                $image['_path'] = $path;
                $image['_mime'] = $mime;
                $image['_size'] = filesize($path);
            }
            unset($image);
        }
        unset($voucher);

        return $manifest;
    }
}
