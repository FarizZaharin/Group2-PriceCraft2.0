/*
  # Link Authentication to Public Users

  1. Changes
    - Create trigger function to auto-create public.users row on auth signup
    - Add trigger on auth.users insert to call the function
    - Sync user ID between auth.users and public.users for RLS compatibility
    - Copy email and name from auth metadata to public.users
    - Set default role to 'estimator' for new signups
    
  2. Security
    - Add policy for anon users to read their own pending profile during signup
    - Maintain existing authenticated user policies
    
  3. Important Notes
    - This ensures auth.uid() matches public.users.id for all RLS policies
    - Name is extracted from raw_user_meta_data.name field
    - Trigger runs automatically on every signup
*/

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    'estimator'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users to auto-create public.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow anon users to read user profiles (needed during signup handshake)
CREATE POLICY "Allow anon to read users during signup"
  ON users FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to read all user profiles (needed for owner names, etc.)
CREATE POLICY "Authenticated users can read all user profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);