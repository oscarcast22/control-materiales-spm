<?php

namespace App\Policies;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\User;
use App\Models\Voucher;
use App\Support\MaterialTracking;
use Illuminate\Auth\Access\Response;

class VoucherPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function view(User $user, Voucher $voucher): Response
    {
        if ($user->isAdministrator() || $this->assignedTechnicianCanAccess($user, $voucher)) {
            return Response::allow();
        }

        return Response::denyAsNotFound();
    }

    public function create(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function update(User $user, Voucher $voucher): bool
    {
        return $user->isAdministrator();
    }

    public function cancel(User $user, Voucher $voucher): bool
    {
        return $user->isAdministrator();
    }

    public function review(User $user, Voucher $voucher): bool
    {
        return $user->isAdministrator();
    }

    public function print(User $user, Voucher $voucher): bool
    {
        return $user->isAdministrator();
    }

    public function createApplication(User $user, Voucher $voucher): bool
    {
        if ($voucher->direction !== VoucherDirection::Exit || $voucher->status !== VoucherStatus::Active) {
            return false;
        }

        return $user->isAdministrator() || $this->assignedTechnicianCanAccess($user, $voucher);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Voucher $voucher): bool
    {
        return false;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Voucher $voucher): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Voucher $voucher): bool
    {
        return false;
    }

    private function assignedTechnicianCanAccess(User $user, Voucher $voucher): bool
    {
        return $user->hasOperationalTechnicianAccess()
            && $voucher->received_by_id === $user->person_id
            && $voucher->direction === VoucherDirection::Exit
            && $voucher->status === VoucherStatus::Active
            && $voucher->issued_on->toDateString() >= MaterialTracking::START_DATE;
    }
}
