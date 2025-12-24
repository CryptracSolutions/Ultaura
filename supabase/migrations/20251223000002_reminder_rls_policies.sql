-- Add missing RLS policies for ultaura_reminders table
-- The original schema only had SELECT policy, but we need INSERT, UPDATE, DELETE for dashboard actions

-- Allow users to create reminders for their accounts
create policy "Users can insert reminders for their accounts"
  on ultaura_reminders for insert
  with check (can_access_ultaura_account(account_id));

-- Allow users to update reminders for their accounts (e.g., cancel)
create policy "Users can update reminders for their accounts"
  on ultaura_reminders for update
  using (can_access_ultaura_account(account_id));

-- Allow users to delete reminders for their accounts
create policy "Users can delete reminders for their accounts"
  on ultaura_reminders for delete
  using (can_access_ultaura_account(account_id));
