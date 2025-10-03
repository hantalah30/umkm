/*
  # UMKM Tracking Application Schema

  ## Overview
  This migration creates the complete database schema for an UMKM (Micro, Small, and Medium Enterprises) tracking application.
  
  ## New Tables
  
  ### 1. `profiles`
  User profile table extending Supabase auth.users
  - `id` (uuid, primary key, references auth.users)
  - `full_name` (text) - User's full name
  - `phone` (text) - Contact phone number
  - `user_type` (text) - Either 'vendor' or 'customer'
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. `vendors`
  Information specific to UMKM vendors
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles) - Links to user profile
  - `business_name` (text) - Name of the UMKM business
  - `business_type` (text) - Type of business (e.g., food, beverages, crafts)
  - `description` (text) - Business description
  - `is_active` (boolean) - Whether vendor is currently active/online
  - `current_latitude` (decimal) - Current GPS latitude
  - `current_longitude` (decimal) - Current GPS longitude
  - `last_location_update` (timestamptz) - When location was last updated
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 3. `subscriptions`
  Monthly subscription tracking for vendors
  - `id` (uuid, primary key)
  - `vendor_id` (uuid, references vendors)
  - `start_date` (date) - Subscription start date
  - `end_date` (date) - Subscription end date
  - `amount` (integer) - Payment amount in rupiah (5000)
  - `status` (text) - 'active', 'expired', or 'pending'
  - `payment_date` (timestamptz) - When payment was made
  - `created_at` (timestamptz)
  
  ### 4. `customer_calls`
  Records of customer calls to vendors
  - `id` (uuid, primary key)
  - `customer_id` (uuid, references profiles) - Customer making the call
  - `vendor_id` (uuid, references vendors) - Vendor being called
  - `customer_latitude` (decimal) - Customer's GPS latitude
  - `customer_longitude` (decimal) - Customer's GPS longitude
  - `status` (text) - 'pending', 'acknowledged', or 'completed'
  - `created_at` (timestamptz) - When call was made
  - `acknowledged_at` (timestamptz) - When vendor acknowledged
  - `completed_at` (timestamptz) - When call was completed
  
  ## Security
  
  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Profiles: Users can read/update their own profile
  - Vendors: Public can view active vendors; vendors can update their own data
  - Subscriptions: Vendors can view their own subscriptions
  - Customer Calls: Customers can create calls and view their own; vendors can view calls to them
  
  ## Important Notes
  1. Subscription amount is set to 5000 rupiah per month
  2. Location tracking uses decimal type for precision
  3. Real-time features will be implemented via Supabase Realtime
  4. All timestamps use timestamptz for timezone awareness
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  user_type text NOT NULL CHECK (user_type IN ('vendor', 'customer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  business_name text NOT NULL,
  business_type text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT false,
  current_latitude decimal(10, 8),
  current_longitude decimal(11, 8),
  last_location_update timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active vendors"
  ON vendors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Vendors can update own data"
  ON vendors FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Vendors can insert own data"
  ON vendors FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  amount integer DEFAULT 5000,
  status text NOT NULL CHECK (status IN ('active', 'expired', 'pending')) DEFAULT 'pending',
  payment_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can insert own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Create customer_calls table
CREATE TABLE IF NOT EXISTS customer_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  customer_latitude decimal(10, 8) NOT NULL,
  customer_longitude decimal(11, 8) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'acknowledged', 'completed')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE customer_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own calls"
  ON customer_calls FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Vendors can view calls to them"
  ON customer_calls FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create calls"
  ON customer_calls FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Vendors can update calls to them"
  ON customer_calls FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors(current_latitude, current_longitude);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor_id ON subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_calls_vendor_id ON customer_calls(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_calls_customer_id ON customer_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_calls_status ON customer_calls(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();