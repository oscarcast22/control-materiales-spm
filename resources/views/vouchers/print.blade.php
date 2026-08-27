<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Vale {{ $voucher['folio'] }}</title>
    <style>
        @page { size: letter; margin: 12mm; }
        body { font-family: Arial, sans-serif; color: #172033; font-size: 12px; }
        header { display: flex; justify-content: space-between; border-bottom: 2px solid #184e77; padding-bottom: 10px; }
        h1 { font-size: 20px; margin: 0 0 3px; } h2 { font-size: 14px; margin: 22px 0 8px; }
        .muted { color: #5f6b7a; } .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 24px; margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #c9d2dc; padding: 7px; text-align: left; }
        th { background: #eef5f9; } .number { text-align: right; white-space: nowrap; }
        .pending { font-weight: bold; color: #9a3412; } .settled { color: #166534; }
        .no-print { margin-bottom: 15px; } @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <button class="no-print" onclick="window.print()">Imprimir</button>
    <header>
        <div><h1>Control de Materiales SPM</h1><div class="muted">Dirección Municipal de Servicios Públicos</div></div>
        <div><strong>{{ $voucher['location']['name'] }} · {{ $voucher['direction'] === 'entry' ? 'Entrada' : 'Salida' }} · Vale {{ $voucher['folio'] }}</strong><br><span class="muted">{{ $voucher['issued_on'] }}</span></div>
    </header>
    <div class="grid">
        <div><strong>Recibió:</strong> {{ $voucher['received_by']['name'] ?? '—' }}</div>
        <div><strong>Entregó:</strong> {{ $voucher['delivered_by']['name'] ?? '—' }}</div>
        <div><strong>Autorizó:</strong> {{ $voucher['authorized_by']['name'] ?? '—' }}</div>
        <div style="grid-column: 1 / -1"><strong>Destino:</strong> {{ $voucher['destination'] }}</div>
    </div>
    <h2>Material {{ $voucher['direction'] === 'entry' ? 'recibido' : 'entregado y comprobación' }}</h2>
    <table>
        <thead><tr><th>Material</th><th>Unidad</th><th class="number">{{ $voucher['direction'] === 'entry' ? 'Recibido' : 'Entregado' }}</th>@if ($voucher['direction'] === 'exit')<th class="number">Aplicado</th><th class="number">Pendiente</th>@endif</tr></thead>
        <tbody>
        @foreach ($voucher['items'] as $item)
            <tr>
                <td>{{ $item['description'] }}</td><td>{{ $item['unit']['symbol'] ?? '' }}</td>
                <td class="number">{{ $item['quantity'] }}</td>
                @if ($voucher['direction'] === 'exit')
                    <td class="number">{{ $item['used_quantity'] }}</td>
                    <td class="number {{ (float) $item['pending_quantity'] === 0.0 ? 'settled' : 'pending' }}">{{ $item['pending_quantity'] }}</td>
                @endif
            </tr>
        @endforeach
        </tbody>
    </table>
    @if ($voucher['notes'])<h2>Observaciones</h2><p>{{ $voucher['notes'] }}</p>@endif
</body>
</html>
