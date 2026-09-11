<?php

namespace App\Support;

use App\Enums\ServiceOrderType;
use App\Models\Voucher;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\URL;

final class SharedVoucherData
{
    /** @return array<string, mixed> */
    public static function make(Voucher $voucher, CarbonInterface $expiresAt): array
    {
        $data = VoucherData::make($voucher, true, null);

        return [
            'voucher_type' => [
                'name' => $data['voucher_type']['name'],
            ],
            'folio' => $data['folio'],
            'direction' => $data['direction'],
            'issued_on' => $data['issued_on'],
            'received_by' => $data['received_by']['name'] ?? null,
            'delivered_by' => $data['delivered_by']['name'] ?? null,
            'authorized_by' => $data['authorized_by']['name'] ?? null,
            'program' => self::classification($data['program']),
            'action' => self::classification($data['action']),
            'indicator' => self::indicator($data['indicator']),
            'destinations' => array_values(array_map(
                fn (array $destination): string => $destination['name'],
                $data['destinations']->all(),
            )),
            'usage_description' => $data['usage_description'],
            'notes' => $data['notes'],
            'status' => $data['status'],
            'loaned_to_name' => $data['loaned_to_name'],
            'loaned_on' => $data['loaned_on'],
            'cancellation_reason' => $data['cancellation_reason'],
            'balance_state' => $data['balance_state'],
            'items' => array_values(array_map(fn (array $item): array => [
                'material' => $item['material']['name'],
                'unit' => [
                    'name' => $item['unit']['name'],
                    'symbol' => $item['unit']['symbol'],
                    'decimal_places' => $item['unit']['decimal_places'],
                ],
                'description' => $item['description'],
                'quantity' => $item['quantity'],
                'used_quantity' => $item['used_quantity'],
                'pending_quantity' => $item['pending_quantity'],
                'luminaire_folios' => $item['luminaire_folios'],
                'balance_state' => $item['balance_state'],
            ], $data['items']->all())),
            'application_reports' => self::applicationReports($data['application_reports']),
            'attachments' => $voucher->attachments
                ->map(fn ($attachment): array => [
                    'original_name' => $attachment->original_name,
                    'mime_type' => $attachment->mime_type,
                    'size' => $attachment->size,
                    'preview_url' => URL::temporarySignedRoute(
                        'shared-vouchers.attachments.preview',
                        $expiresAt,
                        ['voucher' => $voucher, 'attachment' => $attachment],
                    ),
                    'download_url' => URL::temporarySignedRoute(
                        'shared-vouchers.attachments.download',
                        $expiresAt,
                        ['voucher' => $voucher, 'attachment' => $attachment],
                    ),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array{id: int, code: string, name: string|null}|null  $value
     * @return array{code: string, name: string|null}|null
     */
    private static function classification(?array $value): ?array
    {
        if ($value === null) {
            return null;
        }

        return ['code' => $value['code'], 'name' => $value['name']];
    }

    /**
     * @param  array{id: int, action_id: int, code: string, name: string}|null  $value
     * @return array{code: string, name: string}|null
     */
    private static function indicator(?array $value): ?array
    {
        if ($value === null) {
            return null;
        }

        return ['code' => $value['code'], 'name' => $value['name']];
    }

    /**
     * @param  array<int, array<string, mixed>>  $reports
     * @return array<int, array<string, mixed>>
     */
    private static function applicationReports(array $reports): array
    {
        $shared = [];

        foreach ($reports as $report) {
            $applications = array_values(array_map(
                fn (array $application): array => [
                    'material' => $application['material']['name'],
                    'unit' => [
                        'name' => $application['unit']['name'],
                        'symbol' => $application['unit']['symbol'],
                        'decimal_places' => $application['unit']['decimal_places'],
                    ],
                    'quantity' => $application['quantity'],
                ],
                array_filter(
                    self::applicationRows($report['applications']),
                    fn (array $application): bool => $application['voided_at'] === null,
                ),
            ));

            if ($applications === []) {
                continue;
            }

            $type = $report['service_order_type'] !== null
                ? ServiceOrderType::tryFrom($report['service_order_type'])
                : null;

            $shared[] = [
                'key' => $report['key'],
                'occurred_on' => $report['occurred_on'],
                'service_order' => $report['service_order'],
                'service_order_type' => $type?->label(),
                'location' => $report['location'],
                'notes' => $report['notes'],
                'applications' => $applications,
            ];
        }

        return $shared;
    }

    /** @return array<int, array<string, mixed>> */
    private static function applicationRows(mixed $value): array
    {
        if (! is_iterable($value)) {
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
