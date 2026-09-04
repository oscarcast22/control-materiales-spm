<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Material;
use App\Models\Person;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Support\MaterialTracking;
use App\Support\VoucherTypeScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public function __construct(private VoucherTypeScope $voucherTypeScope) {}

    public function tracking(Request $request): Response
    {
        Gate::authorize('view-reports');
        $filters = $this->trackingFilters($request);
        $tracking = MaterialTracking::make($this->trackingVoucherQuery($filters)->get(), $filters);

        return Inertia::render('reports/material-tracking', [
            ...$tracking,
            'filters' => $filters,
            'cutoff' => MaterialTracking::START_DATE,
            'receivers' => fn () => Person::query()->where('can_receive_material', true)->orderBy('name')->get(['id', 'name']),
            'materials' => fn () => Material::query()
                ->with('defaultUnit:id,name,symbol')
                ->orderBy('name')
                ->get(['id', 'name', 'default_unit_id']),
            'voucherTypes' => fn () => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'tracking_started_on']),
        ]);
    }

    public function export(Request $request): BinaryFileResponse
    {
        Gate::authorize('view-reports');
        $filters = $this->trackingFilters($request);
        $vouchers = $this->trackingVoucherQuery($filters, true)->get();
        $tracking = MaterialTracking::make($vouchers, $filters);
        $itemIds = array_fill_keys(collect($tracking['rows'])->pluck('id')->all(), true);
        $path = tempnam(sys_get_temp_dir(), 'spm-export-');
        abort_if($path === false, 500, 'No fue posible crear el archivo temporal.');

        $writer = new Writer;
        $writer->openToFile($path);
        $writer->getCurrentSheet()->setName('Resumen por material');
        $writer->addRow(Row::fromValues([
            'Material', 'Unidad', 'Vales', 'Técnicos', 'Entregado', 'Aplicado', 'Pendiente',
        ]));
        foreach ($tracking['by_material'] as $row) {
            $writer->addRow(Row::fromValues([
                self::safe($row['material']['name']), self::safe($row['unit']['symbol']), $row['vouchers_count'],
                $row['technicians_count'], (float) $row['delivered_quantity'], (float) $row['used_quantity'],
                (float) $row['pending_quantity'],
            ]));
        }

        $sheet = $writer->addNewSheetAndMakeItCurrent();
        $sheet->setName('Resumen por técnico');
        $writer->addRow(Row::fromValues([
            'Técnico', 'Vales', 'Materiales distintos', 'Partidas pendientes', 'Partidas liquidadas', 'Inconsistencias',
        ]));
        foreach ($tracking['by_technician'] as $row) {
            $writer->addRow(Row::fromValues([
                self::safe($row['technician']['name']), $row['vouchers_count'], $row['materials_count'],
                $row['pending_items_count'], $row['settled_items_count'], $row['anomalies_count'],
            ]));
        }

        $sheet = $writer->addNewSheetAndMakeItCurrent();
        $sheet->setName('Detalle de vales');
        $writer->addRow(Row::fromValues([
            'Folio', 'Fecha', 'Tipo de vale', 'Técnico', 'Destino', 'Material', 'Unidad', 'Entregado', 'Aplicado', 'Pendiente', 'Estado',
        ]));
        foreach ($tracking['rows'] as $row) {
            $writer->addRow(Row::fromValues([
                self::safe($row['folio']), $row['issued_on'], self::safe($row['voucher_type']['name']), self::safe($row['received_by']['name']),
                self::safe($row['destination_summary'] ?? ''), self::safe($row['description']), self::safe($row['unit']['symbol']),
                (float) $row['quantity'], (float) $row['used_quantity'], (float) $row['pending_quantity'], $row['balance_state'],
            ]));
        }

        $sheet = $writer->addNewSheetAndMakeItCurrent();
        $sheet->setName('Aplicaciones');
        $writer->addRow(Row::fromValues([
            'Folio', 'Material', 'Fecha', 'Cantidad', 'Referencia', 'Destino', 'Notas',
        ]));
        foreach ($vouchers as $voucher) {
            foreach ($voucher->items as $item) {
                if (! isset($itemIds[$item->id])) {
                    continue;
                }
                foreach ($item->applications as $application) {
                    if ($application->voided_at !== null) {
                        continue;
                    }
                    $writer->addRow(Row::fromValues([
                        self::safe($voucher->folio), self::safe($item->description_snapshot), $application->occurred_on->format('Y-m-d'),
                        (float) $application->quantity, self::safe($application->reference), self::safe($application->destination_snapshot),
                        self::safe($application->application_report_id !== null
                            ? ($application->report->notes ?? $application->notes)
                            : $application->notes),
                    ]));
                }
            }
        }
        $writer->close();

        return response()->download($path, 'seguimiento-material-'.now()->format('Y-m-d-His').'.xlsx')->deleteFileAfterSend(true);
    }

    /**
     * @param  array{search: string, from: string, to: string|null, received_by_id: int|null, material_id: int|null, voucher_type_id: int|null, state: string|null, tab: string}  $filters
     * @return Builder<Voucher>
     */
    private function trackingVoucherQuery(array $filters, bool $includeReportNotes = false): Builder
    {
        $relations = [
            'location', 'receivedBy', 'destinations',
            'items.material', 'items.unit', 'items.applications',
        ];
        if ($includeReportNotes) {
            $relations[] = 'items.applications.report';
        }

        $query = Voucher::query()->with($relations)
            ->whereIn('status', VoucherStatus::operationalValues())
            ->where('direction', VoucherDirection::Exit->value)
            ->whereDate('issued_on', '>=', $filters['from']);

        if ($filters['search'] !== '') {
            $query->searchText($filters['search']);
        }
        if ($filters['to']) {
            $query->whereDate('issued_on', '<=', $filters['to']);
        }
        if ($filters['received_by_id']) {
            $query->where('received_by_id', $filters['received_by_id']);
        }
        if ($filters['voucher_type_id']) {
            $query->where('storage_location_id', $filters['voucher_type_id']);
        }
        if ($filters['material_id']) {
            $query->whereHas('items', fn (Builder $items) => $items->where('material_id', $filters['material_id']));
        }

        return $query->orderByDesc('issued_on')->orderByDesc('id');
    }

    /** @return array{search: string, from: string, to: string|null, received_by_id: int|null, material_id: int|null, voucher_type_id: int|null, state: string|null, tab: string} */
    private function trackingFilters(Request $request): array
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'received_by_id' => ['nullable', 'integer', 'exists:people,id'],
            'material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'state' => ['nullable', Rule::in(['pending', 'settled', 'anomaly'])],
            'tab' => ['nullable', Rule::in(['material', 'technician', 'detail'])],
        ]);

        $cutoff = Carbon::parse(MaterialTracking::START_DATE);
        $from = isset($data['from']) ? Carbon::parse($data['from']) : $cutoff->clone();
        if ($from->lessThan($cutoff)) {
            $from = $cutoff->clone();
        }
        $to = isset($data['to']) ? Carbon::parse($data['to']) : null;
        if ($to?->lessThan($from)) {
            $to = $from->clone();
        }

        return [
            'search' => trim((string) ($data['search'] ?? '')),
            'from' => $from->toDateString(),
            'to' => $to?->toDateString(),
            'received_by_id' => isset($data['received_by_id']) ? (int) $data['received_by_id'] : null,
            'material_id' => isset($data['material_id']) ? (int) $data['material_id'] : null,
            'voucher_type_id' => $this->voucherTypeScope->resolve($request),
            'state' => $data['state'] ?? null,
            'tab' => $data['tab'] ?? 'detail',
        ];
    }

    private static function safe(?string $value): string
    {
        $value ??= '';

        return preg_match('/^[=+\-@]/', $value) ? "'{$value}" : $value;
    }
}
