import { User } from './index'

export interface SessionState {
  user: User
  is_guided: boolean
  return_account_name: string | null
  generation: number
  expires_at: string | null
}

export interface SessionToken {
  access_token: string
  token_type: string
  session: SessionState
}
