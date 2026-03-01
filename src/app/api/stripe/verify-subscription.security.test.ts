import test from 'node:test'
import assert from 'node:assert/strict'
import type Stripe from 'stripe'
import { isCheckoutSessionOwnedByUser } from '@/app/api/stripe/verify-subscription/route'

function makeCheckoutSession(
  values: Partial<Pick<Stripe.Checkout.Session, 'client_reference_id' | 'metadata' | 'customer'>>
): Pick<Stripe.Checkout.Session, 'client_reference_id' | 'metadata' | 'customer'> {
  return {
    client_reference_id: values.client_reference_id ?? null,
    metadata: values.metadata ?? null,
    customer: values.customer ?? null,
  }
}

test('isCheckoutSessionOwnedByUser allows matching client_reference_id', () => {
  const owned = isCheckoutSessionOwnedByUser(
    makeCheckoutSession({
      client_reference_id: 'user-123',
      customer: 'cus_123',
    }),
    { userId: 'user-123' }
  )
  assert.equal(owned, true)
})

test('isCheckoutSessionOwnedByUser allows matching customer fallback', () => {
  const owned = isCheckoutSessionOwnedByUser(
    makeCheckoutSession({
      client_reference_id: null,
      metadata: null,
      customer: 'cus_abc',
    }),
    { userId: 'user-123', userStripeCustomerId: 'cus_abc' }
  )
  assert.equal(owned, true)
})

test('isCheckoutSessionOwnedByUser rejects unrelated checkout sessions', () => {
  const owned = isCheckoutSessionOwnedByUser(
    makeCheckoutSession({
      client_reference_id: 'other-user',
      metadata: { userId: 'other-user' },
      customer: 'cus_other',
    }),
    { userId: 'user-123', userStripeCustomerId: 'cus_123' }
  )
  assert.equal(owned, false)
})
