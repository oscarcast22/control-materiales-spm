<?php

namespace Tests\Unit;

use App\Support\LegacyReportComment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class LegacyReportCommentTest extends TestCase
{
    /**
     * @param  array{occurred_on: string, reference: string|null, destination: string|null, issue: string|null}  $expected
     */
    #[DataProvider('comments')]
    public function test_report_comments_are_parsed_conservatively(string $comment, array $expected): void
    {
        $parsed = LegacyReportComment::parse($comment, '2026-02-01', 1);

        foreach ($expected as $key => $value) {
            $this->assertSame($value, $parsed[$key]);
        }
        $this->assertSame($comment, $parsed['notes']);
    }

    /** @return iterable<string, array{string, array<string, string|null>}> */
    public static function comments(): iterable
    {
        yield 'date, destination and reference' => [
            "Revisor:\n15/4/26 patio 22072",
            [
                'occurred_on' => '2026-04-15',
                'reference' => '22072',
                'destination' => 'patio',
                'issue' => null,
            ],
        ];

        yield 'reference that must not become a date' => [
            "Revisor:\n260131-54",
            [
                'occurred_on' => '2026-02-01',
                'reference' => '260131-54',
                'destination' => null,
                'issue' => 'application_date_missing',
            ],
        ];

        yield 'year outside the accepted period' => [
            "Revisor:\n10/2/2002 Centro",
            [
                'occurred_on' => '2026-02-01',
                'reference' => null,
                'destination' => '10/2/2002 Centro',
                'issue' => 'application_date_invalid',
            ],
        ];
    }
}
