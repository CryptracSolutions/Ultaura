# Ultaura Manual Testing Checklist

## Pre-Flight Checks

- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Telephony server running
- [ ] ngrok tunnel active (development)
- [ ] Stripe test mode enabled

## Account & Lines

- [ ] Create new account via signup
- [ ] Add a line with real phone number
- [ ] Receive SMS verification code
- [ ] Receive voice verification code (test fallback)
- [ ] Enter code and verify line becomes "Active"
- [ ] Attempt to add line beyond plan limit (should fail)
- [ ] Update line settings (timezone, quiet hours)
- [ ] Delete a line

## Inbound Calling

- [ ] Call Twilio number from verified phone
- [ ] Hear greeting with your name
- [ ] Have 2-minute conversation
- [ ] Hang up
- [ ] Check dashboard shows call in activity
- [ ] Check usage minutes updated

## Outbound Calling

- [ ] Create a schedule (e.g., every day at current time + 5 min)
- [ ] Wait for scheduled call
- [ ] Receive incoming call
- [ ] Verify conversation works
- [ ] Check schedule updated to next run time

## Test Call

- [ ] Click "Test call now" button
- [ ] Receive call within 30 seconds
- [ ] Verify conversation works

## DTMF

- [ ] During call, press 1 — should repeat last response
- [ ] Press 9 — should ask to confirm opt-out
- [ ] Press 9 again — should confirm and end call
- [ ] Check line shows do_not_call = true
- [ ] Re-enable calling from dashboard

## Voice Commands

- [ ] Say "stop calling me" — should trigger opt-out flow
- [ ] Say "forget that" after sharing info — should acknowledge
- [ ] Say "don't tell my family about that" — should confirm privacy

## Billing

- [ ] Click "Upgrade Plan"
- [ ] Complete Stripe checkout (use test card 4242 4242 4242 4242)
- [ ] Verify subscription appears in dashboard
- [ ] Check minutes increased to new plan

## Trial Limits

- [ ] Use trial account until < 5 minutes remaining
- [ ] Make call and verify low minutes warning
- [ ] Continue until 0 minutes
- [ ] Verify call ends gracefully
- [ ] Verify cannot make new calls

## Overage (Paid Plans)

- [ ] On paid plan, use beyond included minutes
- [ ] Verify call continues (overage allowed)
- [ ] Check Stripe dashboard for usage record

## Quiet Hours

- [ ] Set quiet hours to current time
- [ ] Trigger outbound call
- [ ] Verify call is suppressed

## Safety Detection

- [ ] During call, express sadness
- [ ] Check safety_events table for low-tier event

## Error Handling

- [ ] Stop telephony server, attempt call
- [ ] Verify graceful error message
- [ ] Start telephony server, retry call
- [ ] Verify works correctly

## Performance

- [ ] Make 5 concurrent test calls (use multiple verified numbers)
- [ ] Verify all connect successfully
- [ ] Check for any timeout errors in logs
