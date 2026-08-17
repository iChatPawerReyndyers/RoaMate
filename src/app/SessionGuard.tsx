import { useEffect, useRef } from 'react';
import { useAccount } from '@/app/AccountContext';
import { useTrip } from '@/app/TripContext';

/**
 * Renders null - purely a bridge between AccountContext and TripContext.
 * AccountProvider wraps TripProvider (see App.tsx), so AccountContext
 * itself can't call useTrip() directly to clear currentTrip on logout.
 *
 * Without this, logging out (manually, or automatically after a rejected
 * token - see client.ts's unauthorizedHandler) left TripContext's
 * currentTrip holding the previous session's tripId/members untouched.
 * RootNavigator remounts to MyTripsScreen either way so this was never
 * directly visible, but it's a real data leak waiting to happen: if a
 * different account then logs in on the same device, stale trip data from
 * someone else's account would still be sitting in memory until the next
 * screen that calls setCurrentTrip happens to overwrite it.
 */
export default function SessionGuard() {
  const { account } = useAccount();
  const { currentTrip, clearTrip } = useTrip();
  const wasLoggedIn = useRef(!!account);

  useEffect(() => {
    if (wasLoggedIn.current && !account && currentTrip) {
      clearTrip();
    }
    wasLoggedIn.current = !!account;
  }, [account, currentTrip, clearTrip]);

  return null;
}