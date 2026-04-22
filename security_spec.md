# Security Specification - SaldaCargo

## Data Invariants
1. A Trip must have a valid `driverId` (the user who created it).
2. An Order or Expense cannot exist without a valid `tripId`.
3. Only Admins/Owners can approve Trips, Orders, and Expenses.
4. Drivers can only create/update their own Trips (as `draft`) and associated Orders/Expenses.
5. Users cannot modify their own roles or balances directly (must be done via Transactions or by Admin).

## The Dirty Dozen Payloads
1. **Identity Spoofing**: Attempt to create a trip as another driver.
2. **Role Escalation**: User tries to update their own role to 'admin'.
3. **Orphaned Write**: Create an order without a `tripId`.
4. **State Shortcutting**: Create an order directly in 'approved' status.
5. **Unauthorized Approval**: Driver tries to 'approve' their own trip.
6. **Balance Tampering**: User tries to update their `balance` field directly.
7. **Cross-User Leak**: User tries to read transactions of another user.
8. **ID Poisoning**: Create a vehicle with a 1MB string as ID.
9. **Timestamp Spoofing**: Provide a future `createdAt` date from client.
10. **Ghost Field Update**: Update a document adding a hidden field like `is_unlimited_credit: true`.
11. **Negative Money**: Create an order with a negative `amount`.
12. **Settlement Bypass**: Update an order's `settlementStatus` to 'completed' without admin approval.

## Test Runner Logic (Draft)
The `firestore.rules.test.ts` will verify these scenarios.
