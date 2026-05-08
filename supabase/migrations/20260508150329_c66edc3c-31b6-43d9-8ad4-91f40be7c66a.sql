CREATE POLICY "Users can request own boost transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND type = 'listing_boost'::transaction_type
  AND status = 'pending'::transaction_status
);