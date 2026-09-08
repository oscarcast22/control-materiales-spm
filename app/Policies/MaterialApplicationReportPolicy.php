<?php

namespace App\Policies;

use App\Enums\VoucherStatus;
use App\Models\MaterialApplicationReport;
use App\Models\User;

class MaterialApplicationReportPolicy
{
    public function view(User $user, MaterialApplicationReport $report): bool
    {
        return $user->can('view', $report->voucher);
    }

    public function update(User $user, MaterialApplicationReport $report): bool
    {
        $report->loadMissing('voucher');

        if ($report->voucher->status !== VoucherStatus::Active) {
            return false;
        }

        if ($user->isAdministrator()) {
            return true;
        }

        return $report->created_by === $user->id
            && $user->can('createApplication', $report->voucher);
    }

    public function replaceAttachment(User $user, MaterialApplicationReport $report): bool
    {
        return $this->update($user, $report);
    }

    public function removeAttachment(User $user, MaterialApplicationReport $report): bool
    {
        return $this->update($user, $report);
    }
}
