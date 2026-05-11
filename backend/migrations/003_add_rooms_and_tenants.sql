-- Create rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(50) NOT NULL,
  price_per_month NUMERIC(12, 2) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'available', -- available, occupied
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  ktp_url TEXT,
  selfie_url TEXT,
  entry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
