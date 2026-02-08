
import { User, Session, AuthError } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
    interface SupabaseAuthClient {
        getUser(token?: string): Promise<{ data: { user: User | null }; error: AuthError | null }>;
        getSession(): Promise<{ data: { session: Session | null }; error: AuthError | null }>;
    }
}
