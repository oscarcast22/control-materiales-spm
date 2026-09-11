<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\VoucherPhotoImport\PhotoImportManifest;
use App\Services\VoucherPhotoImport\PhotoImportService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use JsonException;
use Throwable;

#[Signature('vouchers:import-photo-backlog
    {manifest : Ruta al manifiesto JSON privado}
    {images : Carpeta privada que contiene las fotografías}
    {--apply : Escribe los casos listos; sin esta opción sólo simula}
    {--actor= : ID de una cuenta administradora activa, obligatorio al aplicar}')]
#[Description('Valida e importa el rezago fotográfico de vales de agosto de 2026')]
final class ImportVoucherPhotoBacklog extends Command
{
    public function handle(PhotoImportManifest $loader, PhotoImportService $importer): int
    {
        try {
            $manifest = $loader->load((string) $this->argument('manifest'), (string) $this->argument('images'));
            if ($this->option('apply')) {
                $actorId = filter_var($this->option('actor'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                if ($actorId === false) {
                    $this->error('--actor debe indicar el ID de una cuenta administradora activa.');

                    return self::INVALID;
                }
                $actor = User::query()->find($actorId);
                if (! $actor) {
                    $this->error('No se encontró la cuenta indicada en --actor.');

                    return self::INVALID;
                }
                $plan = $importer->apply($manifest, $actor);
                $this->info('Importación local aplicada. Los casos bloqueados no se modificaron.');
            } else {
                $plan = $importer->plan($manifest);
                $this->line('Simulación completa. No se modificaron vales, catálogos ni archivos.');
            }

            $this->printPlan($plan);
            $this->storeReport($plan, (bool) $this->option('apply'));

            return self::SUCCESS;
        } catch (Throwable $exception) {
            report($exception);
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    /** @param array<string, mixed> $plan */
    private function printPlan(array $plan): void
    {
        $summary = $plan['summary'];
        $this->table(['Fotografías', 'Folios', 'Nuevos listos', 'Adjuntos listos', 'Conciliaciones', 'Por revisar', 'Bloqueados'], [[
            $summary['images'], $summary['folios'], $summary['ready_to_create'], $summary['ready_to_attach'], $summary['ready_to_reconcile'], $summary['marked_for_review'], $summary['blocked'],
        ]]);
        $attention = [];
        foreach ($this->rows($plan['rows'] ?? []) as $row) {
            if (($row['ready'] ?? false) !== true || ($row['comparison_notes'] ?? []) !== []) {
                $attention[] = $row;
            }
        }
        if ($attention !== []) {
            $this->warn('Folios que requieren atención:');
            $tableRows = [];
            foreach ($attention as $row) {
                $tableRows[] = [
                    $row['voucher_type'],
                    $row['folio'],
                    $row['ready'] ? $row['decision'] : 'blocked',
                    implode(' | ', [...$row['issues'], ...$row['comparison_notes']]),
                ];
            }
            $this->table(['Tipo', 'Folio', 'Decisión', 'Detalle'], $tableRows);
        }
    }

    /** @param array<string, mixed> $plan */
    private function storeReport(array $plan, bool $applied): void
    {
        try {
            $safe = $plan;
            foreach ($safe['rows'] as &$row) {
                unset($row['resolved']);
                foreach ($row['source']['images'] as &$image) {
                    unset($image['_path'], $image['_mime'], $image['_size']);
                }
                unset($image);
            }
            unset($row);
            $safe['applied'] = $applied;
            $safe['generated_at'] = now()->toIso8601String();
            $path = 'voucher-photo-imports/reports/'.$safe['batch'].'-'.now()->format('Ymd-His').($applied ? '-applied' : '-dry-run').'.json';
            Storage::disk('local')->put($path, json_encode($safe, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR).PHP_EOL);
            $this->line("Reporte privado: storage/app/private/{$path}");
        } catch (JsonException) {
            $this->warn('No se pudo serializar el reporte privado.');
        }
    }

    /** @return list<array<string, mixed>> */
    private function rows(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }
        $rows = [];
        foreach ($value as $row) {
            if (is_array($row)) {
                $rows[] = $row;
            }
        }

        return $rows;
    }
}
