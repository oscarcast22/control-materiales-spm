<?php

namespace App\Policies;

use App\Models\MaterialApplicationAttachment;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Auth\Access\Response;

class MaterialApplicationAttachmentPolicy
{
    public function view(User $user, MaterialApplicationAttachment $attachment): Response
    {
        $attachment->loadMissing('report.voucher');

        $visible = Voucher::query()
            ->visibleTo($user)
            ->whereKey($attachment->report->voucher_id)
            ->exists();

        return $visible ? Response::allow() : Response::denyAsNotFound();
    }
}
