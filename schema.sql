-- Create Types/Enums (PostgreSQL specific)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('employee', 'manager');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE leave_type_enum AS ENUM ('vacation', 'sick', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  vacation_balance INT DEFAULT 20,
  sick_leave_balance INT DEFAULT 10
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type leave_type_enum NOT NULL,
  reason TEXT,
  status leave_status DEFAULT 'pending',
  manager_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Seed data
INSERT INTO users (username, password, role) VALUES 
('admin', 'admin123', 'manager'),
('john', 'john123', 'employee'),
('jane', 'jane123', 'employee')
ON CONFLICT (username) DO NOTHING;
