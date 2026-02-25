import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const serverSession = {
  get() {
    return getServerSession(authOptions)
  },
}
