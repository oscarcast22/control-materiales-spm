<?php

namespace App\Console\Commands;

use App\Models\AuditEvent;
use App\Models\LegacyImportRow;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Unit;
use App\Models\VoucherItem;
use App\Support\CuratedMaterialCatalog;
use App\Support\Normalizer;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('catalog:sync-material-units {--apply : Aplica los cambios después de revisar la simulación}')]
#[Description('Sincroniza unidades curadas en el catálogo y en partidas de la importación histórica')]
class SyncMaterialUnits extends Command
{
    public function handle(CuratedMaterialCatalog $catalog): int
    {
        $plan = $this->plan($catalog);

        $this->table(['Dato', 'Por actualizar'], [
            ['Materiales del catálogo', count($plan['materials'])],
            ['Partidas históricas', count($plan['items'])],
        ]);

        if ($plan['item_counts'] !== []) {
            $this->table(
                ['Unidad final', 'Partidas'],
                collect($plan['item_counts'])
                    ->sortKeys()
                    ->map(fn (int $count, string $symbol): array => [$symbol, $count])
                    ->values()
                    ->all(),
            );
        }

        if (! $this->option('apply')) {
            $this->comment('Simulación completa. Usa --apply para guardar estos cambios.');

            return self::SUCCESS;
        }

        [$materialsUpdated, $itemsUpdated] = DB::transaction(
            fn (): array => $this->apply($catalog, $plan),
        );

        $this->info("Sincronización terminada: {$materialsUpdated} materiales y {$itemsUpdated} partidas históricas actualizadas.");

        return self::SUCCESS;
    }

    /**
     * @return array{
     *     materials: list<array{id: int, symbol: string}>,
     *     items: list<array{id: int, symbol: string}>,
     *     item_counts: array<string, int>
     * }
     */
    private function plan(CuratedMaterialCatalog $catalog): array
    {
        $materials = [];
        $targetSymbols = [];

        foreach ($catalog->materials() as $data) {
            $key = Normalizer::key($data['name']);
            $alias = MaterialAlias::query()->with('material.defaultUnit')->where('normalized_alias', $key)->first();
            $material = $alias
                ? $alias->material
                : Material::query()->with('defaultUnit')->where('normalized_name', $key)->first();
            if (! $material) {
                continue;
            }

            $currentSymbol = $material->defaultUnit->symbol;
            $targetSymbol = $currentSymbol === 's/e' ? $data['unit'] : $currentSymbol;
            $targetSymbols[$material->id] = $targetSymbol;

            if ($currentSymbol === 's/e' && $targetSymbol !== 's/e') {
                $materials[] = ['id' => $material->id, 'symbol' => $targetSymbol];
            }
        }

        $legacyItemIds = LegacyImportRow::query()
            ->where('imported_type', VoucherItem::class)
            ->whereNotNull('imported_id')
            ->pluck('imported_id')
            ->all();
        $items = [];
        $itemCounts = [];

        VoucherItem::query()
            ->with('unit')
            ->whereIn('id', $legacyItemIds)
            ->whereIn('material_id', array_keys($targetSymbols))
            ->orderBy('id')
            ->each(function (VoucherItem $item) use (&$items, &$itemCounts, $targetSymbols): void {
                $targetSymbol = $targetSymbols[$item->material_id];
                if ($item->unit->symbol !== 's/e' || $targetSymbol === 's/e') {
                    return;
                }

                $items[] = ['id' => $item->id, 'symbol' => $targetSymbol];
                $itemCounts[$targetSymbol] = ($itemCounts[$targetSymbol] ?? 0) + 1;
            });

        return ['materials' => $materials, 'items' => $items, 'item_counts' => $itemCounts];
    }

    /**
     * @param  array{
     *     materials: list<array{id: int, symbol: string}>,
     *     items: list<array{id: int, symbol: string}>,
     *     item_counts: array<string, int>
     * }  $plan
     * @return array{int, int}
     */
    private function apply(CuratedMaterialCatalog $catalog, array $plan): array
    {
        /** @var array<string, Unit> $units */
        $units = Unit::query()->get()->keyBy('symbol')->all();
        foreach ($catalog->units() as $data) {
            $units[$data['symbol']] = Unit::firstOrCreate(['symbol' => $data['symbol']], $data);
        }
        $unspecifiedId = $units['s/e']->id;
        $materialsUpdated = 0;
        $itemsUpdated = 0;

        foreach ($plan['materials'] as $change) {
            $material = Material::query()->lockForUpdate()->findOrFail($change['id']);
            if ($material->default_unit_id !== $unspecifiedId) {
                continue;
            }

            $before = $material->toArray();
            $material->update(['default_unit_id' => $units[$change['symbol']]->id]);
            AuditEvent::record($material, 'curated_unit_applied', $before, $material->fresh()->toArray());
            $materialsUpdated++;
        }

        foreach ($plan['items'] as $change) {
            $item = VoucherItem::query()->lockForUpdate()->findOrFail($change['id']);
            if ($item->unit_id !== $unspecifiedId) {
                continue;
            }

            $before = $item->toArray();
            $item->update(['unit_id' => $units[$change['symbol']]->id]);
            AuditEvent::record($item, 'curated_unit_applied', $before, $item->fresh()->toArray());
            $itemsUpdated++;
        }

        return [$materialsUpdated, $itemsUpdated];
    }
}
