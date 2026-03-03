import { redirect } from 'next/navigation'

export default function TournamentsPage() {
  // Redirect to the host tournament page
  redirect('/host-tournament')
}
