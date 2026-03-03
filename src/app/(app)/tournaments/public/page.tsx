import { redirect } from 'next/navigation'

export default function PublicTournamentsRedirect() {
  redirect('/tournament-listings')
}
