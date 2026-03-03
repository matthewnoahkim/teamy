import { redirect } from 'next/navigation'

export default function CreateTournamentRedirect() {
  // Tournament hosting requests now go through the webhook form on the public page
  redirect('/tournaments')
}
