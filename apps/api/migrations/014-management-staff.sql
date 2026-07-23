CREATE TABLE management_staff (
    id INT PRIMARY KEY,

    management_id VARCHAR(30) UNIQUE,

    user_id VARCHAR(30) NOT NULL,

    branch_id VARCHAR(30),

    role_id VARCHAR(30) NOT NULL,

    user_name VARCHAR(50) NOT NULL,

    department VARCHAR(100),

    designation VARCHAR(100),

    is_active BOOLEAN DEFAULT true,

    bio TEXT,

    gender VARCHAR(20),

    date_of_birth DATE,

    marital_status VARCHAR(30),

    phone VARCHAR(15),

    alt_phone VARCHAR(15),

    address_line1 VARCHAR(100),

    address_line2 VARCHAR(100),

    city VARCHAR(50),

    state VARCHAR(50),

    postal_code VARCHAR(20),

    education VARCHAR(100),

    bank_info TEXT,

    last_otp_request TIMESTAMPTZ,

    otp_locked_until TIMESTAMPTZ,

    last_otp_attempt_ip VARCHAR(45),

    otp_attempt_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_management_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);