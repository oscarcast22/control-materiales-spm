<?php

namespace App\Http\Controllers;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\InventoryAdjustment;
use App\Models\Material;
use App\Models\Person;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\Voucher;
use App\Support\InventorySummary;
use App\Support\VoucherData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public function balances(Request $request): Response
    {
        Gate::authorize('view-reports');
        $rows = $this->voucherQuery($request)->where('direction', VoucherDirection::Exit->value)->get()->flatMap(function (Voucher $voucher) {
            $data = VoucherData::make($voucher, true);

            return collect(VoucherData::itemRows($data['items']))->map(fn (array $item) => [
                'voucher_id' => $voucher->id,
                'folio' => $voucher->folio,
                'location' => $data['location'],
                'issued_on' => $data['issued_on'],
                'received_by' => $data['received_by'],
                'destination' => $voucher->destination,
                ...$item,
            ]);
        })->filter(fn (array $row): bool => (float) $row['pending_quantity'] !== 0.0)->values();

        return Inertia::render('reports/balances', [
            'rows' => $rows,
            'filters' => $request->only(['from', 'to', 'received_by_id', 'material_id', 'storage_location_id']),
            'receivers' => Person::query()->where('can_receive_material', true)->orderBy('name')->get(['id', 'name']),
            'materials' => Material::query()->orderBy('name')->get(['id', 'name']),
            'locations' => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function inventory(Request $request): Response
    {
        Gate::authorize('view-reports');
        $locationId = $request->filled('storage_location_id') ? $request->integer('storage_location_id') : null;
        $materialId = $request->filled('material_id') ? $request->integer('material_id') : null;

        return Inertia::render('reports/inventory', [
            'rows' => InventorySummary::rows($locationId, $materialId, $request->string('as_of')->value() ?: null),
            'filters' => $request->only(['storage_location_id', 'material_id', 'as_of']),
            'locations' => StorageLocation::query()->where('is_active', true)->orderBy('name')->get(),
            'materials' => Material::query()->with('defaultUnit')->where('is_active', true)->orderBy('name')->get(),
            'units' => Unit::query()->where('is_active', true)->orderBy('name')->get(),
            'adjustments' => InventoryAdjustment::query()->with(['location', 'material', 'unit'])
                ->orderByDesc('occurred_on')->orderByDesc('id')->limit(30)->get(),
        ]);
    }

    public function export(Request $request): BinaryFileResponse
    {
        Gate::authorize('view-reports');
        $vouchers = $this->voucherQuery($request, false)->get();
        $path = tempnam(sys_get_temp_dir(), 'spm-export-');
        abort_if($path === false, 500, 'No fue posible crear el archivo temporal.');

        $writer = new Writer;
        $writer->openToFile($path);
        $writer->getCurrentSheet()->setName('Vales');
        $writer->addRow(Row::fromValues([
            'Área', 'Tipo', 'Folio', 'Referencia', 'Fecha', 'Programa', 'Acción', 'Recibió', 'Entregó', 'Autorizó', 'Origen / destino', 'Material', 'Unidad',
            'Entregado', 'Usado', 'Devuelto', 'Pendiente', 'Estado', 'Revisión',
        ]));
        foreach ($vouchers as $voucher) {
            $data = VoucherData::make($voucher, true);
            foreach ($data['items'] as $item) {
                $writer->addRow(Row::fromValues([
                    self::safe($data['location']['name']), $data['direction'], self::safe($data['folio']), self::safe($data['reference'] ?? ''),
                    $data['issued_on'], self::safe($data['program']['code'] ?? ''),
                    self::safe($data['action']['code'] ?? ''), self::safe($data['received_by']['name'] ?? ''),
                    self::safe($data['delivered_by']['name'] ?? ''), self::safe($data['authorized_by']['name'] ?? ''),
                    self::safe($data['destination']), self::safe($item['description']),
                    self::safe($item['unit']['symbol'] ?? ''), (float) $item['quantity'], (float) $item['used_quantity'],
                    (float) $item['returned_quantity'], (float) $item['pending_quantity'], $data['balance_state'],
                    $data['needs_review'] ? 'Sí' : 'No',
                ]));
            }
        }

        $sheet = $writer->addNewSheetAndMakeItCurrent();
        $sheet->setName('Aplicaciones');
        $writer->addRow(Row::fromValues([
            'Folio', 'Material', 'Tipo', 'Fecha', 'Cantidad', 'Referencia', 'Destino', 'Notas', 'Anulado',
        ]));
        foreach ($vouchers as $voucher) {
            $data = VoucherData::make($voucher, true);
            foreach ($data['items'] as $item) {
                foreach ($item['dispositions'] as $row) {
                    $writer->addRow(Row::fromValues([
                        self::safe($data['folio']), self::safe($item['description']), $row['type'], $row['occurred_on'],
                        (float) $row['quantity'], self::safe($row['reference'] ?? ''), self::safe($row['destination'] ?? ''),
                        self::safe($row['notes'] ?? ''), $row['voided_at'] ? 'Sí' : 'No',
                    ]));
                }
            }
        }

        $sheet = $writer->addNewSheetAndMakeItCurrent();
        $sheet->setName('Existencias');
        $writer->addRow(Row::fromValues([
            'Área', 'Inicio de control', 'Material', 'Unidad', 'Entradas', 'Salidas', 'Devoluciones', 'Ajustes', 'Existencia neta',
        ]));
        foreach (InventorySummary::rows(
            $request->filled('storage_location_id') ? $request->integer('storage_location_id') : null,
            $request->filled('material_id') ? $request->integer('material_id') : null,
            $request->string('to')->value() ?: null,
        ) as $row) {
            $writer->addRow(Row::fromValues([
                self::safe($row['location']['name']), $row['location']['tracking_started_on'], self::safe($row['material']['name']),
                self::safe($row['unit']['symbol']), (float) $row['entries'], (float) $row['exits'], (float) $row['returns'],
                (float) $row['adjustments'], (float) $row['available'],
            ]));
        }
        $writer->close();

        return response()->download($path, 'control-materiales-'.now()->format('Y-m-d-His').'.xlsx')->deleteFileAfterSend(true);
    }

    /** @return Builder<Voucher> */
    private function voucherQuery(Request $request, bool $activeOnly = true): Builder
    {
        $query = Voucher::query()->with([
            'location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action',
            'items.material', 'items.unit', 'items.dispositions',
        ]);
        if ($activeOnly) {
            $query->where('status', VoucherStatus::Active->value);
        }
        if ($request->filled('from')) {
            $query->whereDate('issued_on', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('issued_on', '<=', $request->date('to'));
        }
        if ($request->filled('received_by_id')) {
            $query->where('received_by_id', $request->integer('received_by_id'));
        }
        if ($request->filled('storage_location_id')) {
            $query->where('storage_location_id', $request->integer('storage_location_id'));
        }
        if ($request->filled('direction')) {
            $query->where('direction', $request->string('direction')->value());
        }
        if ($request->filled('material_id')) {
            $query->whereHas('items', fn (Builder $items) => $items->where('material_id', $request->integer('material_id')));
        }

        return $query->orderByDesc('issued_on')->orderByDesc('id');
    }

    private static function safe(?string $value): string
    {
        $value ??= '';

        return preg_match('/^[=+\-@]/', $value) ? "'{$value}" : $value;
    }
}
