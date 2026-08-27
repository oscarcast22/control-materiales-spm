<?php

declare(strict_types=1);

use App\Support\Normalizer;
use OpenSpout\Reader\XLSX\Options;
use OpenSpout\Reader\XLSX\Reader;

require dirname(__DIR__).'/vendor/autoload.php';

$path = $argv[1] ?? null;
if (! is_string($path) || ! is_file($path)) {
    fwrite(STDERR, "Uso: php scripts/build-destination-catalog.php /ruta/libro.xlsx\n");
    exit(1);
}

$overrides = [
    'actualizacion led 2026 av circuito interior' => [
        'destinations' => ['Av. Circuito Interior'],
        'usage_description' => 'Actualización LED 2026',
    ],
    'actualizacion led 2026 blvd guadiana' => [
        'destinations' => ['Blvd. Guadiana'],
        'usage_description' => 'Actualización LED 2026',
    ],
    'actualizacion led 2026 col san carlos' => [
        'destinations' => ['Col. San Carlos'],
        'usage_description' => 'Actualización LED 2026',
    ],
    'av camino a la loma av san juan led 2026' => [
        'destinations' => ['Av. Camino a la Loma', 'Av. San Juan'],
        'usage_description' => 'Actualización LED 2026',
    ],
    'cambio de tecnologia hid a led 5 de mayo' => [
        'destinations' => ['Poblado 5 de Mayo'],
        'usage_description' => 'Cambio de tecnología HID a LED',
    ],
    'carretera mezquital fracc jardines de durango' => [
        'destinations' => ['Carretera Mezquital', 'Fracc. Jardines de Durango'],
        'usage_description' => null,
    ],
    'poblado otinapa' => [
        'destinations' => ['Poblado Otinapa'],
        'usage_description' => null,
    ],
    'poblados valle florido el manzanal y sebastian lerdo de tejada led 2026' => [
        'destinations' => ['Poblado Valle Florido', 'Poblado El Manzanal', 'Poblado Sebastián Lerdo de Tejada'],
        'usage_description' => 'Actualización LED 2026',
    ],
    '5 de mayo' => [
        'destinations' => ['Poblado 5 de Mayo'],
        'usage_description' => null,
    ],
    'vientisiete de noviembre' => [
        'destinations' => ['Poblado Veintisiete de Noviembre'],
        'usage_description' => null,
    ],
    'veintisiete de noviembre' => [
        'destinations' => ['Poblado Veintisiete de Noviembre'],
        'usage_description' => null,
    ],
    'col 20 de noviembre fortalecimiento' => [
        'destinations' => ['Col. 20 de Noviembre'],
        'usage_description' => 'Fortalecimiento',
    ],
    'col valle florido atencion a reportes' => [
        'destinations' => ['Col. Valle Florido'],
        'usage_description' => 'Atención a reportes',
    ],
    'pob morcillo mantenimiento' => [
        'destinations' => ['Poblado Morcillo'],
        'usage_description' => 'Mantenimiento',
    ],
    'fabricacion tapas registros fracc barcelona' => [
        'destinations' => ['Fracc. Barcelona'],
        'usage_description' => 'Fabricación de tapas para registros',
    ],
    'fos la virgen' => [
        'destinations' => ['La Virgen'],
        'usage_description' => 'FOS',
        'needs_review' => true,
    ],
    'col fos la virgen' => [
        'destinations' => ['Col. La Virgen'],
        'usage_description' => 'FOS',
        'needs_review' => true,
    ],
    'col praderas fos la virgen' => [
        'destinations' => [],
        'usage_description' => 'Col. Praderas FOS La Virgen',
        'needs_review' => true,
    ],
];

$manualAliases = [
    'Poblado 5 de Mayo' => ['5 de Mayo'],
    'Poblado Otinapa' => ['Otinapa'],
    'Poblado Veintisiete de Noviembre' => ['Veintisiete de Noviembre', 'Vientisiete de Noviembre'],
    'Fracc. Jardines de Durango' => ['Jardines de Durango', 'Jardines de Dgo.'],
    'Poblado Sebastián Lerdo de Tejada' => ['Sebastián Lerdo de Tejada'],
];

$activityPattern = '/\b(actualizacion|atencion|alumbrado|cableado|cambio|construccion|domo|elaboracion|fabricacion|fortalecimiento|fortalecimineto|iluminacion|instalacion|limpieza|mantenimiento|modernizacion|pintura|rehabilitacion|remodelacion|reparacion|reportes?|reposicion|reubicacion|retiro|sellado|servicio|soldado|solucion|suministro|sustitucion|trabajo|uso)\b/';
$assetPattern = '/\b(camioneta|grua|herramienta|hilux|silverado|vehiculo|equipo de cuadrilla|oficinas?|consumo interno)\b/';
$geographicPattern = '/\b(acceso|almacen|area verde|av|avenida|barrio|blvd|boulevard|calle|camino|carretera|carr|circuito|col|colonia|ejido|fracc|fraccionamiento|jardines|parque|plaza|pob|poblado|puente|taller|unidad deportiva|valle|villas|zona centro)\b/';
$geographicStartPattern = '/^(acceso|almacen|area verde|av|avenida|barrio|blvd|boulevard|calle|camino|carretera|carr|circuito|col|colonia|ejido|fracc|fraccionamiento|jardines|parque|plaza|pob|poblado|puente|taller|unidad deportiva|valle|villas|zona centro)\b/';
$nonLocationRemainderPattern = '/^(atencion|circuitos?|espacios publicos|herramienta|oficinas?|poblados|privada|rehabilitacion|reparacion|reportes?|subestaciones y controles)\b/';
$compoundDestinationPattern = '/\s(?:y|e)\s|\s*[,\/]\s*/';
$compoundNameExceptions = [
    'el carmen y anexos',
    'carmen y anexos',
    'independencia y libertad',
    'poblado independencia y libertad',
];
$leadingActivityRules = [
    [
        'pattern' => '/^\s*(?:mto|mnto|mtno|mantenimiento)\.?\s*/iu',
        'activity' => 'Mantenimiento',
        'accept_bare_destination' => true,
    ],
    [
        'pattern' => '/^\s*(?:fortalecimiento|fortalecimineto|fort)\b\.?\s*/iu',
        'activity' => 'Fortalecimiento',
        'accept_bare_destination' => true,
    ],
    [
        'pattern' => '/^\s*domo\s+/iu',
        'activity' => 'Domo',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*alumbrado\s+(?:del\s+)?/iu',
        'activity' => 'Alumbrado',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*iluminacion\s+/iu',
        'activity' => 'Iluminación',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*circuitos?\s+/iu',
        'activity' => 'Circuitos',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*ciclovia\s+ovalo\s+/iu',
        'activity' => 'Ciclovía óvalo',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*estructura\s+materiales\s+/iu',
        'activity' => 'Estructura de materiales',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*dif\s+municipal\s+/iu',
        'activity' => 'DIF Municipal',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*reportes?\s+072(?:\s+a)?\s*/iu',
        'activity' => 'Reportes 072',
        'accept_bare_destination' => false,
    ],
    [
        'pattern' => '/^\s*reportes?\s+/iu',
        'activity' => 'Reportes',
        'accept_bare_destination' => false,
    ],
];

$groups = [];
$reader = new Reader(new Options(SHOULD_PRESERVE_EMPTY_ROWS: true));
$reader->open($path);

try {
    foreach ($reader->getSheetIterator() as $sheet) {
        $sheetKey = Normalizer::key($sheet->getName());
        if (! in_array($sheetKey, ['vale de almacen', 'vale de patio'], true)) {
            continue;
        }

        $destinationIndex = null;
        foreach ($sheet->getRowIterator() as $row) {
            $values = $row->toArray();
            if ($destinationIndex === null) {
                $headers = array_map(
                    fn (mixed $value): string => Normalizer::key(trim((string) ($value ?? ''))),
                    $values,
                );
                $found = array_search('destino', $headers, true);
                if ($found === false) {
                    continue;
                }
                $destinationIndex = $found;

                continue;
            }

            $raw = trim((string) ($values[$destinationIndex] ?? ''));
            $key = Normalizer::key($raw);
            if ($key === '') {
                continue;
            }
            $groups[$key][$raw] = ($groups[$key][$raw] ?? 0) + 1;
        }
    }
} finally {
    $reader->close();
}

ksort($groups);
$destinations = [];
$aliasOwners = [];
$mappings = [];

$registerDestination = static function (string $name, array $aliases = [], bool $needsReview = false) use (&$destinations, &$aliasOwners): string {
    $key = Normalizer::key($name);
    $owner = $aliasOwners[$key] ?? $key;
    $destinations[$owner] ??= [
        'name' => $name,
        'aliases' => [],
        'needs_review' => $needsReview,
    ];
    $aliasOwners[$key] = $owner;
    $destinations[$owner]['needs_review'] = $destinations[$owner]['needs_review'] || $needsReview;
    foreach ($aliases as $alias) {
        $aliasKey = Normalizer::key($alias);
        if ($aliasKey !== '' && $aliasKey !== $owner && ! isset($aliasOwners[$aliasKey])) {
            $destinations[$owner]['aliases'][$alias] = true;
            $aliasOwners[$aliasKey] = $owner;
        }
    }

    return $destinations[$owner]['name'];
};

$prettify = static function (string $value): string {
    $name = mb_convert_case(mb_strtolower(preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value)), MB_CASE_TITLE, 'UTF-8');
    $name = preg_replace_callback(
        '/\b(Av|Blvd|Carr|Col|Frac|Fracc|Pob)\b(?!\.)/u',
        fn (array $match): string => ($match[1] === 'Frac' ? 'Fracc' : $match[1]).'.',
        $name,
    ) ?? $name;
    $name = str_replace([' Dgo.', ' Led ', ' Spm ', ' Dif ', ' Fos '], [' Durango', ' LED ', ' SPM ', ' DIF ', ' FOS '], $name);
    $name = str_replace(
        [' De ', ' Del ', ' La ', ' Las ', ' El ', ' Los ', ' Y ', ' E ', ' A ', ' Al ', ' En '],
        [' de ', ' del ', ' la ', ' las ', ' el ', ' los ', ' y ', ' e ', ' a ', ' al ', ' en '],
        $name,
    );

    return str_replace(
        ['Almacen', 'Area', 'Atencion', 'Fabricacion', 'Iluminacion', 'Mexico', 'Reparacion', 'Santillan', 'Sebastian'],
        ['Almacén', 'Área', 'Atención', 'Fabricación', 'Iluminación', 'México', 'Reparación', 'Santillán', 'Sebastián'],
        $name,
    );
};

$classifyLeadingActivity = static function (string $source) use (
    $activityPattern,
    $assetPattern,
    $compoundDestinationPattern,
    $compoundNameExceptions,
    $geographicPattern,
    $geographicStartPattern,
    $leadingActivityRules,
    $nonLocationRemainderPattern,
    $prettify,
): ?array {
    foreach ($leadingActivityRules as $rule) {
        if (preg_match($rule['pattern'], $source) !== 1) {
            continue;
        }

        $remainder = trim((string) preg_replace($rule['pattern'], '', $source, 1));
        if ($rule['activity'] === 'Mantenimiento' && preg_match('/^en\s+/iu', $remainder) === 1) {
            $remainder = trim((string) preg_replace('/^en\s+/iu', '', $remainder, 1));
        }
        $remainderKey = Normalizer::key($remainder);
        if ($remainderKey === '') {
            return [
                'destinations' => [],
                'usage_description' => $rule['activity'],
                'needs_review' => false,
            ];
        }

        $containsGeography = preg_match($geographicPattern, $remainderKey) === 1;
        $isNonLocation = preg_match($nonLocationRemainderPattern, $remainderKey) === 1;
        $containsAnotherActivity = preg_match($activityPattern, $remainderKey) === 1;
        $containsAsset = preg_match($assetPattern, $remainderKey) === 1;
        if ($isNonLocation || $containsAnotherActivity || ($containsAsset && ! $containsGeography)) {
            return [
                'destinations' => [],
                'usage_description' => $prettify($rule['activity'].': '.$remainder),
                'needs_review' => $containsGeography,
            ];
        }

        $isCompound = preg_match($compoundDestinationPattern, $remainderKey) === 1
            && ! in_array($remainderKey, $compoundNameExceptions, true);
        if ($isCompound) {
            $parts = preg_split('/\s*(?:,|\/|\s+y\s+|\s+e\s+)\s*/iu', $remainder) ?: [];
            $parts = array_values(array_filter(array_map('trim', $parts)));
            $allExplicitLocations = count($parts) > 1;
            foreach ($parts as $part) {
                if (preg_match($geographicStartPattern, Normalizer::key($part)) !== 1) {
                    $allExplicitLocations = false;
                    break;
                }
            }
            if ($allExplicitLocations) {
                return [
                    'destinations' => array_map($prettify, $parts),
                    'usage_description' => $rule['activity'],
                    'needs_review' => false,
                ];
            }

            return [
                'destinations' => [],
                'usage_description' => $prettify($rule['activity'].': '.$remainder),
                'needs_review' => true,
            ];
        }

        if (! $rule['accept_bare_destination'] && ! $containsGeography) {
            return [
                'destinations' => [],
                'usage_description' => $prettify($rule['activity'].': '.$remainder),
                'needs_review' => true,
            ];
        }

        return [
            'destinations' => [$prettify($remainder)],
            'usage_description' => $rule['activity'],
            'needs_review' => false,
        ];
    }

    return null;
};

foreach ($manualAliases as $name => $aliases) {
    $registerDestination($name, $aliases);
}

foreach ($groups as $key => $variants) {
    arsort($variants);
    $source = (string) array_key_first($variants);

    if (isset($overrides[$key])) {
        $mapping = $overrides[$key];
        $needsReview = $mapping['needs_review'] ?? false;
        foreach ($mapping['destinations'] as $destination) {
            $aliases = count($mapping['destinations']) === 1 && $mapping['usage_description'] === null
                ? array_keys($variants)
                : [];
            $registerDestination($destination, $aliases);
        }
        $mappings[] = [
            'source' => $source,
            'destinations' => $mapping['destinations'],
            'usage_description' => $mapping['usage_description'],
            'needs_review' => $needsReview,
        ];

        continue;
    }

    $activityMapping = $classifyLeadingActivity($source);
    if ($activityMapping !== null) {
        $canonicalDestinations = [];
        foreach ($activityMapping['destinations'] as $destination) {
            $canonicalDestinations[] = $registerDestination($destination);
        }
        $mappings[] = [
            'source' => $source,
            'destinations' => array_values(array_unique($canonicalDestinations)),
            'usage_description' => $activityMapping['usage_description'],
            'needs_review' => $activityMapping['needs_review'],
        ];

        continue;
    }

    $isActivity = preg_match($activityPattern, $key) === 1;
    $isAssetOrInternalUse = preg_match($assetPattern, $key) === 1;
    if ($isActivity || $isAssetOrInternalUse) {
        $mappings[] = [
            'source' => $source,
            'destinations' => [],
            'usage_description' => $source,
            'needs_review' => $isActivity && preg_match($geographicPattern, $key) === 1,
        ];

        continue;
    }

    $name = $prettify($source);
    $registerDestination($name, array_keys($variants));
    $mappings[] = [
        'source' => $source,
        'destinations' => [$name],
        'usage_description' => null,
        'needs_review' => false,
    ];
}

foreach ($destinations as &$destination) {
    $destination['aliases'] = array_values(array_keys($destination['aliases']));
    sort($destination['aliases'], SORT_NATURAL | SORT_FLAG_CASE);
}
unset($destination);
uasort($destinations, fn (array $left, array $right): int => strnatcasecmp($left['name'], $right['name']));

$jsonOptions = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR;
file_put_contents(dirname(__DIR__).'/database/data/destinations.json', json_encode(array_values($destinations), $jsonOptions)."\n");
file_put_contents(dirname(__DIR__).'/database/data/legacy-destination-mappings.json', json_encode($mappings, $jsonOptions)."\n");

$reviewMappings = count(array_filter($mappings, fn (array $row): bool => $row['needs_review']));
fwrite(STDOUT, sprintf(
    "%d textos normalizados, %d ubicaciones canónicas y %d mapeos por revisar.\n",
    count($groups),
    count($destinations),
    $reviewMappings,
));
