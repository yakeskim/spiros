import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://acdjnobbiwiobvmijans.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZGpub2JiaXdpb2J2bWlqYW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjA4NDAsImV4cCI6MjA4NzQ5Njg0MH0.DGdR8JhI5MeRduDaTuz6jIHz-kwCzaRThfwK9vOUS_g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
