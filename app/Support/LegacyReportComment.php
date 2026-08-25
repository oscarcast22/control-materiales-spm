<?php

namespace App\Support;

final class LegacyReportComment
{
    /**
     * @return array{occurred_on: string, reference: string|null, destination: string|null, notes: string, issue: string|null}
     */
    public static function parse(?string $comment, string $fallbackDate, int $slot): array
    {
        $original = trim((string) $comment);
        $content = preg_replace('/^[^\r\n]{1,120}:\s*(?:\r?\n)?/u', '', $original) ?? $original;
        $content = trim($content);
        $occurredOn = $fallbackDate;
        $issue = null;
        $matchedDate = null;

        if (preg_match('/(?<!\d)(\d{1,2})[\/.-](\d{1,2})[\/.-](26|2026)(?!\d)/', $content, $match, PREG_OFFSET_CAPTURE)) {
            $day = (int) $match[1][0];
            $month = (int) $match[2][0];
            if (checkdate($month, $day, 2026)) {
                $occurredOn = sprintf('2026-%02d-%02d', $month, $day);
                $matchedDate = $match[0];
            } else {
                $issue = 'application_date_invalid';
            }
        } elseif (preg_match('/(?<!\d)\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?!\d)/', $content)) {
            $issue = 'application_date_invalid';
        } else {
            $issue = 'application_date_missing';
        }

        $detail = $content;
        if (is_array($matchedDate)) {
            $offset = (int) $matchedDate[1];
            $detail = substr_replace($detail, ' ', $offset, strlen((string) $matchedDate[0]));
        }
        $detail = trim(preg_replace('/\s+/u', ' ', $detail) ?? $detail, " \t\n\r\0\x0B,;:-");

        $reference = null;
        if (preg_match('/(?:^|\s)(\d{4,}(?:-\d+)?)$/', $detail, $referenceMatch, PREG_OFFSET_CAPTURE)) {
            $reference = $referenceMatch[1][0];
            $offset = (int) $referenceMatch[0][1];
            $detail = trim(substr($detail, 0, $offset), " \t\n\r\0\x0B,;:-");
        }

        $destination = preg_match('/\p{L}/u', $detail) ? $detail : null;
        $notes = $original !== ''
            ? $original
            : "Importado de REPORTE {$slot}; la celda no contiene comentario identificador.";

        return [
            'occurred_on' => $occurredOn,
            'reference' => $reference,
            'destination' => $destination,
            'notes' => $notes,
            'issue' => $issue,
        ];
    }
}
