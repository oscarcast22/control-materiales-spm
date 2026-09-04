<?php

namespace App\Policies;

use App\Models\MaterialApplication;
use App\Models\User;

class MaterialApplicationPolicy
{
    public function view(User $user, MaterialApplication $application): bool
    {
        $application->loadMissing('item.voucher');

        return $user->can('view', $application->item->voucher);
    }

    public function void(User $user, MaterialApplication $application): bool
    {
        if ($user->isAdministrator()) {
            return true;
        }

        $application->loadMissing('report.voucher');

        return $application->report !== null
            && $application->report->created_by === $user->id
            && $user->can('createApplication', $application->report->voucher);
    }
}
