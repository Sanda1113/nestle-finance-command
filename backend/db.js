// backend/db.js
const { createClient } = require('@supabase/supabase-js');

// Your Supabase Project URL based on your Project ID
const supabaseUrl = 'https://tfzpkpxiiimwoxcuhlsw.supabase.co';

// Your Anon Public Key
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmenBrcHhpaWltd294Y3VobHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzAzMzQsImV4cCI6MjA4ODkwNjMzNH0.nWNdqtYlfH3xqg68N4io58kHlBQXAVTRZX6asMjgSeY";

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;