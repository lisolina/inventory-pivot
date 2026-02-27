-- Add DELETE policy on forwarded_emails for authenticated users
CREATE POLICY "Authenticated users can delete forwarded emails"
ON public.forwarded_emails
FOR DELETE
USING (true);

-- Add DELETE policy on email_orders for authenticated users
CREATE POLICY "Authenticated users can delete email orders"
ON public.email_orders
FOR DELETE
USING (true);