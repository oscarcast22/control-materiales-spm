<?php

namespace App\Services\VoucherPhotoImport;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\AuditEvent;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherAttachment;
use App\Models\VoucherItem;
use App\Support\Normalizer;
use App\Support\QuantityPrecision;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

final class PhotoImportService
{
    /** @param array<string, mixed> $manifest
     * @return array<string, mixed>
     */
    public function plan(array $manifest): array
    {
        $catalogAdditions = $this->associativeArray($manifest['catalog_additions'] ?? []);
        $newMaterials = collect($this->rows($catalogAdditions['materials'] ?? []))->keyBy(fn (array $row): string => Normalizer::key($this->string($row['name'] ?? null)));
        $newDestinations = collect($this->rows($catalogAdditions['destinations'] ?? []))->keyBy(fn (array $row): string => Normalizer::key($this->string($row['name'] ?? null)));
        $rows = [];
        $seenFolios = [];
        $sources = $this->rows($manifest['vouchers'] ?? []);

        foreach ($sources as $source) {
            $issues = $this->strings($source['blocking_reasons'] ?? []);
            $decision = $this->string($source['decision'] ?? null);
            $voucherType = $this->string($source['voucher_type'] ?? null);
            $folio = $this->string($source['folio'] ?? null);
            $key = $voucherType.'|'.Normalizer::folio($folio);
            if (isset($seenFolios[$key])) {
                $issues[] = 'El tipo y folio están repetidos en el manifiesto.';
            }
            $seenFolios[$key] = true;

            $resolved = null;
            if ($decision === 'blocked') {
                if ($issues === []) {
                    $issues[] = 'El análisis dejó este vale bloqueado para revisión.';
                }
            } elseif ($decision === 'attach_only') {
                $resolved = $this->resolveExisting($source, $issues);
            } elseif ($decision === 'reconcile_existing') {
                $resolved = $this->resolveReconciliation($source, $issues);
            } else {
                $resolved = $this->resolveNew($source, $issues, $newMaterials->all(), $newDestinations->all());
                if (($resolved['already_imported'] ?? false) === true) {
                    $decision = 'attach_only';
                }
            }

            $rows[] = [
                'folio' => trim($folio),
                'voucher_type' => $voucherType,
                'decision' => $decision,
                'ready' => $this->string($source['decision'] ?? null) !== 'blocked' && $issues === [],
                'issues' => array_values(array_unique($issues)),
                'comparison_notes' => $this->strings($source['comparison_notes'] ?? []),
                'source' => $source,
                'resolved' => $resolved,
            ];
        }

        $encodedManifest = json_encode($this->publicManifest($manifest), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $imageCount = 0;
        foreach ($sources as $source) {
            $imageCount += count($this->rows($source['images'] ?? []));
        }
        $readyToCreate = $readyToAttach = $readyToReconcile = $markedForReview = $blocked = 0;
        foreach ($rows as $row) {
            if (! $row['ready']) {
                $blocked++;
            } elseif ($row['decision'] === 'create') {
                $readyToCreate++;
            } elseif ($row['decision'] === 'attach_only') {
                $readyToAttach++;
            } elseif ($row['decision'] === 'reconcile_existing') {
                $readyToReconcile++;
            }
            if ($row['ready'] && $this->strings($row['source']['review_reasons'] ?? []) !== []) {
                $markedForReview++;
            }
        }

        return [
            'schema_version' => 1,
            'batch' => $manifest['batch'],
            'manifest_sha256' => hash('sha256', $encodedManifest),
            'rows' => $rows,
            'summary' => [
                'images' => $imageCount,
                'folios' => count($rows),
                'ready_to_create' => $readyToCreate,
                'ready_to_attach' => $readyToAttach,
                'ready_to_reconcile' => $readyToReconcile,
                'marked_for_review' => $markedForReview,
                'blocked' => $blocked,
            ],
        ];
    }

    /** @param array<string, mixed> $manifest
     * @return array<string, mixed>
     */
    public function apply(array $manifest, User $actor): array
    {
        if (! $actor->isAdministrator()) {
            throw new RuntimeException('El actor de la importación debe ser una cuenta administradora activa.');
        }

        $initialPlan = $this->plan($manifest);
        $readySources = [];
        foreach ($this->rows($initialPlan['rows'] ?? []) as $row) {
            if (($row['ready'] ?? false) === true) {
                $readySources[] = $this->associativeArray($row['source'] ?? []);
            }
        }
        $writtenPaths = [];

        try {
            DB::transaction(function () use ($manifest, $readySources, $actor, &$writtenPaths): void {
                $this->createCatalogAdditions($manifest, $readySources, $actor);
                $plan = $this->plan($manifest);
                foreach ($this->rows($plan['rows'] ?? []) as $row) {
                    if (! $row['ready']) {
                        continue;
                    }
                    $resolved = $this->associativeArray($row['resolved'] ?? []);
                    $voucher = match ($row['decision']) {
                        'attach_only' => Voucher::query()->lockForUpdate()->whereKey($resolved['voucher_id'])->firstOrFail(),
                        'reconcile_existing' => $this->reconcileVoucher($row, $actor),
                        default => $this->createVoucher($row, $actor),
                    };
                    $source = $this->associativeArray($row['source'] ?? []);
                    foreach ($this->rows($source['images'] ?? []) as $image) {
                        $this->attachImage($voucher, $image, $actor, $writtenPaths);
                    }
                }
            });
        } catch (Throwable $exception) {
            foreach ($writtenPaths as $path) {
                Storage::disk('local')->delete($path);
            }
            throw $exception;
        }

        return $this->plan($manifest);
    }

    /** @param array<string, mixed> $source
     * @param  list<string>  $issues
     * @return array<string, mixed>|null
     */
    private function resolveExisting(array $source, array &$issues): ?array
    {
        $location = StorageLocation::query()->where('code', $source['voucher_type'])->first();
        if (! $location) {
            $issues[] = 'No existe el tipo de vale objetivo.';

            return null;
        }
        $matches = Voucher::query()
            ->where('storage_location_id', $location->id)
            ->where('folio_key', Normalizer::folio($source['folio']))
            ->get();
        if ($matches->count() !== 1) {
            $issues[] = $matches->isEmpty()
                ? 'No existe un único vale productivo al cual adjuntar la fotografía.'
                : 'Existe más de un vale del mismo tipo y folio; no se eligió automáticamente.';

            return null;
        }
        $voucher = $matches->firstOrFail();

        return ['voucher_id' => $voucher->id];
    }

    /** @param array<string, mixed> $source
     * @param  list<string>  $issues
     * @return array<string, mixed>|null
     */
    private function resolveReconciliation(array $source, array &$issues): ?array
    {
        $location = StorageLocation::query()->where('code', $source['voucher_type'])->where('is_active', true)->first();
        if (! $location) {
            $issues[] = 'El tipo de vale no está activo en producción.';

            return null;
        }

        $matches = Voucher::query()
            ->where('storage_location_id', $location->id)
            ->where('folio_key', Normalizer::folio($source['folio']))
            ->get();
        if ($matches->count() !== 1) {
            $issues[] = $matches->isEmpty()
                ? 'No existe un único vale productivo para conciliar.'
                : 'Existe más de un vale del mismo tipo y folio; no se eligió automáticamente.';

            return null;
        }
        $voucher = $matches->firstOrFail();
        if ($this->reconciliationAlreadyApplied($voucher, $source)) {
            return ['voucher_id' => $voucher->id, 'already_reconciled' => true];
        }

        if ($voucher->updated_at?->format('Y-m-d H:i:s') !== $source['expected_updated_at']) {
            $issues[] = 'El vale cambió desde que se preparó la conciliación.';
        }
        if ($voucher->attachments()->count() !== (int) $source['expected_attachment_count']) {
            $issues[] = 'La cantidad de adjuntos cambió desde que se preparó la conciliación.';
        }

        $updates = $this->associativeArray($source['updates'] ?? []);
        $destinationIds = [];
        foreach ($this->strings($updates['add_destinations'] ?? []) as $name) {
            $destination = $this->destination($name);
            if (! $destination?->is_active) {
                $issues[] = "No se resolvió una ubicación activa para agregar: {$name}.";

                continue;
            }
            $destinationIds[] = $destination->id;
        }

        $itemUpdates = [];
        foreach ($this->rows($updates['items'] ?? []) as $itemUpdate) {
            $currentMaterial = $this->material($this->string($itemUpdate['current_material'] ?? null));
            if (! $currentMaterial) {
                $issues[] = "No se resolvió el material actual: {$itemUpdate['current_material']}.";

                continue;
            }
            $items = $voucher->items()
                ->where('material_id', $currentMaterial->id)
                ->where('quantity', $itemUpdate['quantity'])
                ->get();
            if ($items->count() !== 1) {
                $issues[] = "No se encontró una única partida de {$currentMaterial->name} con la cantidad indicada.";

                continue;
            }
            $item = $items->firstOrFail();
            $targetMaterialName = isset($itemUpdate['material'])
                ? $this->string($itemUpdate['material'])
                : $currentMaterial->name;
            $targetMaterial = $this->material($targetMaterialName);
            if (! $targetMaterial) {
                $issues[] = "No se resolvió el material corregido: {$targetMaterialName}.";

                continue;
            }
            if (! $targetMaterial->voucherTypes()->whereKey($location->id)->exists()) {
                $issues[] = "El material {$targetMaterial->name} no está disponible para este tipo de vale.";
            }
            if (! QuantityPrecision::accepts($item->quantity, $targetMaterial->defaultUnit->decimal_places)) {
                $issues[] = "La cantidad de {$targetMaterial->name} no es compatible con su unidad.";
            }
            if ($targetMaterial->id !== $currentMaterial->id && $item->applications()->exists()) {
                $issues[] = "No se puede cambiar {$currentMaterial->name} porque conserva aplicaciones.";
            }
            if (array_key_exists('luminaire_folios', $itemUpdate)
                && filled($itemUpdate['luminaire_folios'])
                && ! $targetMaterial->is_luminaire) {
                $issues[] = "{$targetMaterial->name} no admite folios de luminaria.";
            }
            $itemUpdates[] = [
                'item_id' => $item->id,
                'current_material_id' => $currentMaterial->id,
                'quantity' => $item->quantity,
                'material' => $targetMaterial,
                'has_luminaire_folios' => array_key_exists('luminaire_folios', $itemUpdate),
                'luminaire_folios' => $itemUpdate['luminaire_folios'] ?? null,
            ];
        }

        return compact('voucher', 'destinationIds', 'itemUpdates');
    }

    /** @param array<string, mixed> $source
     * @param  list<string>  $issues
     * @param  array<string, array<string, mixed>>  $newMaterials
     * @param  array<string, array<string, mixed>>  $newDestinations
     * @return array<string, mixed>|null
     */
    private function resolveNew(array $source, array &$issues, array $newMaterials, array $newDestinations): ?array
    {
        $location = StorageLocation::query()->where('code', $source['voucher_type'])->where('is_active', true)->first();
        if (! $location) {
            $issues[] = 'El tipo de vale no está activo en producción.';

            return null;
        }
        $existing = Voucher::query()
            ->where('storage_location_id', $location->id)
            ->where('folio_key', Normalizer::folio($source['folio']))
            ->first();
        if ($existing) {
            $hashes = array_column($this->rows($source['images'] ?? []), 'sha256');
            $wasImported = AuditEvent::query()
                ->where('auditable_type', Voucher::class)
                ->where('auditable_id', $existing->id)
                ->whereIn('event', ['created_from_photo_import', 'created_cancelled_from_photo_import'])
                ->exists();
            $hasSourceImage = $existing->attachments()->whereIn('sha256', $hashes)->exists();
            if ($wasImported && $hasSourceImage) {
                return ['voucher_id' => $existing->id, 'already_imported' => true];
            }
            $issues[] = 'El folio ya existe en producción y no se importará como nuevo.';
        }
        $date = $source['issued_on'] ?? null;
        if (! is_string($date) || $date < '2026-08-01' || $date > '2026-08-31') {
            $issues[] = 'La fecha debe pertenecer a agosto de 2026.';
        }
        $status = $source['status'] ?? null;
        if (! in_array($status, [VoucherStatus::Active->value, VoucherStatus::Cancelled->value], true)) {
            $issues[] = 'El estado nuevo debe ser activo o cancelado.';
        }
        if ($status === VoucherStatus::Cancelled->value) {
            return ['location' => $location];
        }
        if (($source['direction'] ?? null) !== VoucherDirection::Exit->value) {
            $issues[] = 'Este lote sólo admite salidas activas.';
        }

        $receiver = $this->person($source['received_by'] ?? null, 'can_receive_material');
        $deliverer = $this->person($source['delivered_by'] ?? null, 'can_deliver_material');
        $authorizer = $this->person($source['authorized_by'] ?? null, 'can_authorize_material');
        if (! $receiver) {
            $issues[] = 'No se resolvió un receptor activo del catálogo.';
        }
        if (! $deliverer) {
            $issues[] = 'No se resolvió un entregador activo del catálogo.';
        }
        if (! $authorizer) {
            $authorizers = Person::query()->where('is_active', true)->where('can_authorize_material', true)->get();
            $authorizer = blank($source['authorized_by'] ?? null) && $authorizers->count() === 1 ? $authorizers->first() : null;
        }
        if (! $authorizer) {
            $issues[] = 'No se resolvió un autorizador único del catálogo.';
        }

        $program = Program::query()->where('code', 'SPM-06')->where('is_active', true)->first();
        $action = $program ? Action::query()->where('program_id', $program->id)->where('code', strtoupper((string) ($source['action'] ?? '')))->where('is_active', true)->first() : null;
        if (! $program || ! $action) {
            $issues[] = 'No se resolvió la acción activa de SPM-06.';
        }
        $indicator = null;
        if ($action) {
            $indicators = $action->indicators()->where('is_active', true)->get();
            $indicator = filled($source['action_indicator'] ?? null)
                ? $indicators->firstWhere('code', strtoupper((string) $source['action_indicator']))
                : ($indicators->count() === 1 ? $indicators->first() : null);
            if (! $indicator) {
                $issues[] = 'No se resolvió el indicador requerido para la acción.';
            }
        }

        $destinationIds = [];
        foreach ($source['destinations'] ?? [] as $name) {
            $destination = $this->destination($name);
            if ($destination?->is_active) {
                $destinationIds[] = $destination->id;
            } elseif (! isset($newDestinations[Normalizer::key($name)])) {
                $issues[] = "No se resolvió la ubicación: {$name}.";
            }
        }
        if ($destinationIds === [] && ($source['destinations'] ?? []) === [] && blank($source['usage_description'] ?? null)) {
            $issues[] = 'Falta una ubicación o descripción de uso.';
        }

        $items = [];
        foreach ($source['items'] ?? [] as $item) {
            $material = $this->material($item['material']);
            $definition = $newMaterials[Normalizer::key($item['material'])] ?? null;
            $unit = $material ? $material->defaultUnit : ($definition ? Unit::query()->where('symbol', $definition['unit_symbol'])->where('is_active', true)->first() : null);
            if (! $material && ! $definition) {
                $issues[] = "No se resolvió el material: {$item['material']}.";

                continue;
            }
            if (! $unit || ! QuantityPrecision::accepts($item['quantity'], $unit->decimal_places)) {
                $issues[] = "La cantidad o unidad de {$item['material']} no es válida.";
            }
            $isAvailable = $material
                ? $material->voucherTypes()->whereKey($location->id)->exists()
                : in_array($source['voucher_type'], $definition['voucher_types'], true);
            if (! $isAvailable) {
                $issues[] = "El material {$item['material']} no está disponible para este tipo de vale.";
            }
            $isLuminaire = $material ? $material->is_luminaire : (bool) ($definition['is_luminaire'] ?? false);
            if (filled($item['luminaire_folios'] ?? null) && ! $isLuminaire) {
                $issues[] = "{$item['material']} no admite folios de luminaria.";
            }
            $items[] = [
                'material' => $material,
                'material_name' => $item['material'],
                'quantity' => $item['quantity'],
                'luminaire_folios' => $item['luminaire_folios'] ?? null,
                'requires_review' => $definition !== null,
            ];
        }
        if ($items === []) {
            $issues[] = 'Falta al menos una partida de material.';
        }

        $hasNewDestination = false;
        foreach ($this->strings($source['destinations'] ?? []) as $name) {
            $hasNewDestination = $hasNewDestination || isset($newDestinations[Normalizer::key($name)]);
        }

        return compact('location', 'receiver', 'deliverer', 'authorizer', 'program', 'action', 'indicator', 'destinationIds', 'items', 'hasNewDestination');
    }

    /** @param array<string, mixed> $manifest
     * @param  list<array<string, mixed>>  $readySources
     */
    private function createCatalogAdditions(array $manifest, array $readySources, User $actor): void
    {
        $usedMaterials = collect($readySources)->flatMap(fn (array $row): array => array_column($row['items'] ?? [], 'material'))->map(fn (string $name): string => Normalizer::key($name))->unique();
        foreach ($manifest['catalog_additions']['materials'] ?? [] as $definition) {
            if (! $usedMaterials->contains(Normalizer::key($definition['name'])) || $this->material($definition['name'])) {
                continue;
            }
            $unit = Unit::query()->where('symbol', $definition['unit_symbol'])->where('is_active', true)->firstOrFail();
            $material = Material::create([
                'name' => trim($definition['name']),
                'normalized_name' => Normalizer::key($definition['name']),
                'default_unit_id' => $unit->id,
                'is_active' => true,
                'needs_review' => true,
                'is_luminaire' => (bool) $definition['is_luminaire'],
            ]);
            $material->voucherTypes()->sync(StorageLocation::query()->whereIn('code', $definition['voucher_types'])->pluck('id'));
            AuditEvent::record($material, 'created_from_photo_import', null, $material->fresh()->toArray(), $actor->id);
        }

        $usedDestinations = collect($readySources)->flatMap(fn (array $row): array => $row['destinations'] ?? [])->map(fn (string $name): string => Normalizer::key($name))->unique();
        foreach ($manifest['catalog_additions']['destinations'] ?? [] as $definition) {
            if (! $usedDestinations->contains(Normalizer::key($definition['name'])) || $this->destination($definition['name'])) {
                continue;
            }
            $destination = Destination::create(['name' => trim($definition['name']), 'normalized_name' => Normalizer::key($definition['name']), 'is_active' => true, 'needs_review' => true]);
            AuditEvent::record($destination, 'created_from_photo_import', null, $destination->toArray(), $actor->id);
        }
    }

    /** @param array<string, mixed> $source */
    private function reconciliationAlreadyApplied(Voucher $voucher, array $source): bool
    {
        $hashes = array_column($this->rows($source['images'] ?? []), 'sha256');
        if ($voucher->attachments()->whereIn('sha256', $hashes)->count() !== count($hashes)) {
            return false;
        }

        $updates = $this->associativeArray($source['updates'] ?? []);
        if (isset($updates['issued_on']) && $voucher->issued_on->toDateString() !== $updates['issued_on']) {
            return false;
        }
        if (array_key_exists('usage_description', $updates)) {
            $usage = filled($updates['usage_description']) ? trim((string) $updates['usage_description']) : null;
            if ($voucher->usage_description !== $usage) {
                return false;
            }
        }

        foreach ($this->strings($updates['add_destinations'] ?? []) as $name) {
            $destination = $this->destination($name);
            if (! $destination || ! $voucher->destinations()->whereKey($destination->id)->exists()) {
                return false;
            }
        }

        foreach ($this->rows($updates['items'] ?? []) as $itemUpdate) {
            $materialName = isset($itemUpdate['material'])
                ? $this->string($itemUpdate['material'])
                : $this->string($itemUpdate['current_material'] ?? null);
            $material = $this->material($materialName);
            if (! $material) {
                return false;
            }
            $items = $voucher->items()
                ->where('material_id', $material->id)
                ->where('quantity', $itemUpdate['quantity'])
                ->get();
            if ($items->count() !== 1) {
                return false;
            }
            if (array_key_exists('luminaire_folios', $itemUpdate)) {
                $folios = filled($itemUpdate['luminaire_folios']) ? trim((string) $itemUpdate['luminaire_folios']) : null;
                if ($items->firstOrFail()->luminaire_folios !== $folios) {
                    return false;
                }
            }
        }

        $reviewReasons = $this->strings($source['review_reasons'] ?? []);
        if ($reviewReasons !== []) {
            $existingReasons = $voucher->review_reasons ?? [];
            if (! $voucher->needs_review || array_diff($reviewReasons, $existingReasons) !== []) {
                return false;
            }
        }

        return true;
    }

    /** @param array<string, mixed> $row */
    private function reconcileVoucher(array $row, User $actor): Voucher
    {
        $resolved = $this->associativeArray($row['resolved'] ?? []);
        $voucher = Voucher::query()->lockForUpdate()->whereKey($resolved['voucher_id'] ?? $resolved['voucher']?->id)->firstOrFail();
        if (($resolved['already_reconciled'] ?? false) === true) {
            return $voucher;
        }

        $source = $this->associativeArray($row['source'] ?? []);
        if ($voucher->updated_at?->format('Y-m-d H:i:s') !== $source['expected_updated_at']
            || $voucher->attachments()->count() !== (int) $source['expected_attachment_count']) {
            throw new RuntimeException('El vale cambió mientras se preparaba la conciliación; no se aplicó ningún cambio.');
        }

        $updates = $this->associativeArray($source['updates'] ?? []);
        $beforeVoucher = $this->voucherAuditData($voucher);
        $voucherValues = [];

        if (isset($updates['issued_on']) && $voucher->issued_on->toDateString() !== $updates['issued_on']) {
            $voucherValues['issued_on'] = $updates['issued_on'];
        }
        if (array_key_exists('usage_description', $updates)) {
            $usage = filled($updates['usage_description']) ? trim((string) $updates['usage_description']) : null;
            if ($voucher->usage_description !== $usage) {
                $voucherValues['usage_description'] = $usage;
            }
        }

        $reviewReasons = array_values(array_unique([
            ...($voucher->review_reasons ?? []),
            ...$this->strings($source['review_reasons'] ?? []),
        ]));
        if ($this->strings($source['review_reasons'] ?? []) !== []) {
            $voucherValues['needs_review'] = true;
            $voucherValues['review_reasons'] = $reviewReasons;
        }

        $destinationIds = array_values(array_unique(array_map('intval', $resolved['destinationIds'] ?? [])));
        $missingDestinationIds = array_values(array_diff(
            $destinationIds,
            $voucher->destinations()->pluck('destinations.id')->map(fn (mixed $id): int => (int) $id)->all(),
        ));
        if ($voucherValues !== [] || $missingDestinationIds !== []) {
            $voucher->update([...$voucherValues, 'updated_by' => $actor->id]);
            if ($missingDestinationIds !== []) {
                $voucher->destinations()->syncWithoutDetaching($missingDestinationIds);
            }
            AuditEvent::record($voucher, 'reconciled_from_photo_import', $beforeVoucher, $this->voucherAuditData($voucher), $actor->id);
        }

        foreach ($this->rows($resolved['itemUpdates'] ?? []) as $itemUpdate) {
            $item = VoucherItem::query()
                ->where('voucher_id', $voucher->id)
                ->lockForUpdate()
                ->findOrFail((int) $itemUpdate['item_id']);
            if ($item->material_id !== (int) $itemUpdate['current_material_id']
                || $item->quantity !== $itemUpdate['quantity']) {
                throw new RuntimeException('Una partida cambió mientras se preparaba la conciliación; no se aplicó ningún cambio.');
            }
            $material = $itemUpdate['material'];
            if (! $material instanceof Material) {
                throw new RuntimeException('La conciliación contiene un material resuelto inválido.');
            }
            $values = [
                'material_id' => $material->id,
                'unit_id' => $material->default_unit_id,
                'description_snapshot' => $material->name,
                'updated_by' => $actor->id,
            ];
            if (($itemUpdate['has_luminaire_folios'] ?? false) === true) {
                $values['luminaire_folios'] = filled($itemUpdate['luminaire_folios'] ?? null)
                    ? trim((string) $itemUpdate['luminaire_folios'])
                    : null;
            }
            $beforeItem = $item->toArray();
            $item->fill($values);
            if ($item->isDirty()) {
                $item->save();
                AuditEvent::record($item, 'reconciled_from_photo_import', $beforeItem, $item->fresh()->toArray(), $actor->id);
            }
        }

        return $voucher->fresh();
    }

    /** @param array<string, mixed> $row */
    private function createVoucher(array $row, User $actor): Voucher
    {
        $source = $row['source'];
        $resolved = $row['resolved'];
        if ($source['status'] === VoucherStatus::Cancelled->value) {
            $voucher = Voucher::create([
                'storage_location_id' => $resolved['location']->id,
                'folio' => trim($source['folio']),
                'folio_key' => Normalizer::folio($source['folio']),
                'issued_on' => $source['issued_on'],
                'status' => VoucherStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => 'Cancelado en el vale físico; importado desde fotografía.',
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);
            AuditEvent::record($voucher, 'created_cancelled_from_photo_import', null, $voucher->toArray(), $actor->id);

            return $voucher;
        }

        $reviewReasons = array_values(array_unique($source['review_reasons'] ?? []));
        foreach ($this->rows($resolved['items'] ?? []) as $resolvedItem) {
            if (($resolvedItem['requires_review'] ?? false) === true) {
                $reviewReasons[] = 'material_created_from_photo';
                break;
            }
        }
        if ($resolved['hasNewDestination']) {
            $reviewReasons[] = 'destination_created_from_photo';
        }
        $reviewReasons = array_values(array_unique($reviewReasons));

        $voucher = Voucher::create([
            'storage_location_id' => $resolved['location']->id,
            'folio' => trim($source['folio']),
            'folio_key' => Normalizer::folio($source['folio']),
            'direction' => VoucherDirection::Exit,
            'issued_on' => $source['issued_on'],
            'received_by_id' => $resolved['receiver']->id,
            'delivered_by_id' => $resolved['deliverer']->id,
            'authorized_by_id' => $resolved['authorizer']->id,
            'program_id' => $resolved['program']->id,
            'action_id' => $resolved['action']->id,
            'action_indicator_id' => $resolved['indicator']->id,
            'usage_description' => filled($source['usage_description'] ?? null) ? trim($source['usage_description']) : null,
            'notes' => filled($source['notes'] ?? null) ? trim($source['notes']) : null,
            'status' => VoucherStatus::Active,
            'needs_review' => $reviewReasons !== [],
            'review_reasons' => $reviewReasons ?: null,
            'created_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);
        $destinationIds = [];
        foreach ($source['destinations'] ?? [] as $name) {
            $destinationIds[] = $this->destination($name)?->id;
        }
        $voucher->destinations()->sync(array_values(array_filter(array_unique($destinationIds))));
        foreach ($resolved['items'] as $rowItem) {
            $material = $this->material($rowItem['material_name']) ?? throw new RuntimeException("No se encontró {$rowItem['material_name']} después de preparar el catálogo.");
            $item = $voucher->items()->create([
                'material_id' => $material->id,
                'unit_id' => $material->default_unit_id,
                'description_snapshot' => $material->name,
                'quantity' => $rowItem['quantity'],
                'luminaire_folios' => filled($rowItem['luminaire_folios']) ? trim($rowItem['luminaire_folios']) : null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);
            AuditEvent::record($item, 'created_from_photo_import', null, $item->toArray(), $actor->id);
        }
        AuditEvent::record($voucher, 'created_from_photo_import', null, $voucher->fresh()->toArray(), $actor->id);

        return $voucher;
    }

    /** @return array<string, mixed> */
    private function voucherAuditData(Voucher $voucher): array
    {
        $voucher->load('destinations:id');

        return [
            ...$voucher->toArray(),
            'destination_ids' => $voucher->destinations->pluck('id')->all(),
        ];
    }

    /** @param array<string, mixed> $image
     * @param  list<string>  $writtenPaths
     */
    private function attachImage(Voucher $voucher, array $image, User $actor, array &$writtenPaths): void
    {
        if ($voucher->attachments()->where('sha256', $image['sha256'])->exists()) {
            return;
        }
        $extension = strtolower(pathinfo($image['file'], PATHINFO_EXTENSION));
        $path = "vouchers/{$voucher->id}/{$image['sha256']}.{$extension}";
        $stream = fopen($image['_path'], 'rb');
        if ($stream === false || ! Storage::disk('local')->put($path, $stream)) {
            if (is_resource($stream)) {
                fclose($stream);
            }
            throw new RuntimeException("No se pudo guardar la fotografía {$image['file']}.");
        }
        fclose($stream);
        $writtenPaths[] = $path;
        $attachment = VoucherAttachment::create([
            'voucher_id' => $voucher->id,
            'disk' => 'local',
            'path' => $path,
            'original_name' => $image['original_name'] ?? basename($image['file']),
            'mime_type' => $image['_mime'],
            'size' => $image['_size'],
            'sha256' => $image['sha256'],
            'uploaded_by' => $actor->id,
        ]);
        AuditEvent::record($attachment, 'uploaded_from_photo_import', null, $attachment->toArray(), $actor->id);
    }

    private function person(?string $name, string $role): ?Person
    {
        $key = Normalizer::key($name);
        if ($key === '') {
            return null;
        }
        $alias = PersonAlias::query()->where('normalized_alias', $key)->first();
        $person = $alias ? $alias->person : Person::query()->where('normalized_name', $key)->first();

        return $person?->is_active && $person->{$role} ? $person : null;
    }

    private function material(string $name): ?Material
    {
        $key = Normalizer::key($name);
        $alias = MaterialAlias::query()->where('normalized_alias', $key)->first();
        $exact = $alias ? $alias->material : Material::query()->where('normalized_name', $key)->first();
        if ($exact?->is_active) {
            return $exact;
        }

        $signature = $this->tokenSignature($key);
        $matches = Material::query()
            ->where('is_active', true)
            ->with('aliases:id,material_id,normalized_alias')
            ->get()
            ->filter(function (Material $material) use ($signature): bool {
                if ($this->tokenSignature($material->normalized_name) === $signature) {
                    return true;
                }

                return $material->aliases->contains(fn (MaterialAlias $alias): bool => $this->tokenSignature($alias->normalized_alias) === $signature);
            });

        return $matches->count() === 1 ? $matches->first() : null;
    }

    private function destination(string $name): ?Destination
    {
        $key = Normalizer::key($name);
        $alias = DestinationAlias::query()->where('normalized_alias', $key)->first();

        return $alias ? $alias->destination : Destination::query()->where('normalized_name', $key)->first();
    }

    private function tokenSignature(string $value): string
    {
        $tokens = array_values(array_filter(explode(' ', $value)));
        sort($tokens);

        return implode('|', $tokens);
    }

    /** @return array<string, mixed> */
    private function associativeArray(mixed $value): array
    {
        if (! is_array($value)) {
            throw new RuntimeException('El manifiesto validado contiene un objeto inválido.');
        }

        return $value;
    }

    /** @return list<array<string, mixed>> */
    private function rows(mixed $value): array
    {
        if (! is_array($value)) {
            throw new RuntimeException('El manifiesto validado contiene una lista inválida.');
        }
        $rows = [];
        foreach ($value as $row) {
            $rows[] = $this->associativeArray($row);
        }

        return $rows;
    }

    /** @return list<string> */
    private function strings(mixed $value): array
    {
        if (! is_array($value)) {
            throw new RuntimeException('El manifiesto validado contiene una lista de texto inválida.');
        }
        $strings = [];
        foreach ($value as $item) {
            $strings[] = $this->string($item);
        }

        return $strings;
    }

    private function string(mixed $value): string
    {
        if (! is_string($value)) {
            throw new RuntimeException('El manifiesto validado contiene texto inválido.');
        }

        return $value;
    }

    /** @param array<string, mixed> $manifest
     * @return array<string, mixed>
     */
    private function publicManifest(array $manifest): array
    {
        foreach ($manifest['vouchers'] as &$voucher) {
            foreach ($voucher['images'] as &$image) {
                unset($image['_path'], $image['_mime'], $image['_size']);
            }
            unset($image);
        }
        unset($voucher);

        return $manifest;
    }
}
