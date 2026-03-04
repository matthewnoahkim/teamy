import Stripe from 'stripe'

export type CheckoutSessionOwnershipInput = Pick<
  Stripe.Checkout.Session,
  'client_reference_id' | 'metadata' | 'customer'
>

export type CheckoutSessionOwnershipContext = {
  userId: string
  userStripeCustomerId?: string | null
}

function getCheckoutCustomerId(checkoutSession: CheckoutSessionOwnershipInput): string | null {
  return typeof checkoutSession.customer === 'string'
    ? checkoutSession.customer
    : checkoutSession.customer?.id ?? null
}

export function isCheckoutSessionOwnedByUser(
  checkoutSession: CheckoutSessionOwnershipInput,
  context: CheckoutSessionOwnershipContext
): boolean {
  if (checkoutSession.client_reference_id === context.userId) {
    return true
  }

  if (checkoutSession.metadata?.userId === context.userId) {
    return true
  }

  const checkoutCustomerId = getCheckoutCustomerId(checkoutSession)
  if (
    checkoutCustomerId &&
    context.userStripeCustomerId &&
    checkoutCustomerId === context.userStripeCustomerId
  ) {
    return true
  }

  return false
}

export function getCheckoutCustomerIdForSession(
  checkoutSession: CheckoutSessionOwnershipInput
): string | null {
  return getCheckoutCustomerId(checkoutSession)
}
