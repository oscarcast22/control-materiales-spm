<?php

return [
    'voucher_sequence_starts' => [
        'warehouse' => (int) env('VOUCHER_SEQUENCE_START_WAREHOUSE', 16576),
        'yard' => (int) env('VOUCHER_SEQUENCE_START_YARD', 3753),
    ],
];
