import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wwquxjhyvbwmiivzkkib.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3cXV4amh5dmJ3bWlpdnpra2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTA3NDksImV4cCI6MjA3ODQ2Njc0OX0.otxONlq6ib7YwIzArnx2alx_UIFzGvLnBeqv0qQrgi0';

export const supabase = createClient(supabaseUrl, supabaseKey);
