-- Phase 2: PostgreSQL Schema for NEET Counselling Tracking

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE confidence_enum AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE validation_status AS ENUM ('VERIFIED', 'NEEDS_VERIFICATION', 'CONFLICTING', 'UNKNOWN');
CREATE TYPE state_type_enum AS ENUM ('STATE', 'UT', 'CENTRAL');

CREATE TABLE states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type state_type_enum NOT NULL
);

CREATE TABLE counselling_authorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_id UUID REFERENCES states(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    primary_website VARCHAR(255),
    portal_website VARCHAR(255)
);

CREATE TABLE counselling_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    authority_id UUID REFERENCES counselling_authorities(id) ON DELETE CASCADE,
    year INT NOT NULL,
    current_status VARCHAR(50) NOT NULL,
    status_validation validation_status DEFAULT 'UNKNOWN',
    UNIQUE(authority_id, year)
);

CREATE TABLE counselling_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES counselling_cycles(id) ON DELETE CASCADE,
    round_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    UNIQUE(cycle_id, round_name)
);

CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID REFERENCES counselling_rounds(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_date TIMESTAMP,
    is_tentative BOOLEAN DEFAULT FALSE
);

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(1024) NOT NULL,
    source_type VARCHAR(50),
    confidence confidence_enum,
    content_hash VARCHAR(64),
    published_at TIMESTAMP,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES counselling_cycles(id) ON DELETE CASCADE,
    status_before VARCHAR(50),
    status_after VARCHAR(50) NOT NULL,
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- Indexes for performance
CREATE INDEX idx_cycles_status ON counselling_cycles(current_status);
CREATE INDEX idx_history_cycle ON status_history(cycle_id);
CREATE INDEX idx_sources_url ON sources(url);
