'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { CLERK_ENABLED } from '@/lib/clerk-available';
import { useRouter } from 'next/navigation';

function ClerkSignOutItem() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignOutButton } = require('@clerk/nextjs');
  return (
    <DropdownMenuItem>
      <SignOutButton redirectUrl='/auth/sign-in' />
    </DropdownMenuItem>
  );
}

function useClerkUser() {
  if (!CLERK_ENABLED) return { user: null };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require('@clerk/nextjs');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return clerk.useUser();
}

export function UserNav() {
  const { user } = useClerkUser();
  const router = useRouter();
  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <UserAvatarProfile user={user} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className='w-56'
          align='end'
          sideOffset={10}
          forceMount
        >
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col space-y-1'>
              <p className='text-sm leading-none font-medium'>
                {user.fullName}
              </p>
              <p className='text-muted-foreground text-xs leading-none'>
                {user.emailAddresses[0].emailAddress}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>New Team</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {CLERK_ENABLED && <ClerkSignOutItem />}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
