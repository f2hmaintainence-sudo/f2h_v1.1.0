--
-- PostgreSQL database dump
--

\restrict g4PpIesoFxrfsJlXehMYbAsNhzMtbOvoDnlbd7K5VdYU5cuYZuwMIxUG5KDnnwC

-- Dumped from database version 18.4 (Ubuntu 18.4-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

--
-- Name: customer_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.customer_status_enum AS ENUM (
    'active',
    'inactive',
    'blocked'
);

--
-- Name: delivery_slot_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_slot_enum AS ENUM (
    'morning',
    'evening'
);

--
-- Name: fulfillment_mode_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fulfillment_mode_enum AS ENUM (
    'bulk',
    'prepacked'
);

--
-- Name: order_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status_enum AS ENUM (
    'pending',
    'placed',
    'confirmed',
    'packed',
    'assigned',
    'out_for_delivery',
    'delivered',
    'cancelled'
);

--
-- Name: product_unit_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_unit_enum AS ENUM (
    'kg',
    'ltr',
    'ml',
    'gm',
    'piece',
    'pack'
);

--
-- Name: refund_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refund_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'processed',
    'cancelled'
);

--
-- Name: subscription_billing_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_billing_status_enum AS ENUM (
    'pending',
    'invoiced',
    'paid'
);

--
-- Name: subscription_delivery_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_delivery_status_enum AS ENUM (
    'pending',
    'packed',
    'dispatched',
    'delivered',
    'failed'
);

--
-- Name: subscription_override_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_override_type_enum AS ENUM (
    'extra',
    'replace',
    'cancel',
    'cod'
);

--
-- Name: subscription_payment_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_payment_type_enum AS ENUM (
    'prepaid',
    'postpaid'
);

--
-- Name: subscription_schedule_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_schedule_type_enum AS ENUM (
    'weekly',
    'custom_dates'
);

--
-- Name: subscription_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status_enum AS ENUM (
    'active',
    'paused',
    'expired',
    'cancelled'
);

--
-- Name: support_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.support_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);

--
-- Name: true_or_false; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.true_or_false AS ENUM (
    'true',
    'false'
);

--
-- Name: update_batch_planning_jobs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_batch_planning_jobs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_logs (
    id integer NOT NULL,
    admin_id character varying NOT NULL,
    admin_name character varying(200) DEFAULT NULL::character varying,
    action character varying(50) NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id character varying,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(50) DEFAULT NULL::character varying,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_audit_logs_id_seq OWNED BY public.admin_audit_logs.id;

--
-- Name: api_integrations_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_integrations_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category character varying(50) NOT NULL,
    config_key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    provider character varying(100),
    is_active boolean DEFAULT true,
    config_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

--
-- Name: app_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_configs (
    id integer NOT NULL,
    platform character varying(50) NOT NULL,
    latest_version character varying(20) NOT NULL,
    min_version character varying(20) NOT NULL,
    force_update boolean DEFAULT false,
    store_url character varying(255) NOT NULL,
    update_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    update_title character varying(255) DEFAULT 'New Update Available'::character varying,
    release_notes text DEFAULT 'Bug fixes and performance improvements.'::text,
    file_size character varying(50) DEFAULT '0 MB'::character varying,
    build_number integer DEFAULT 1,
    published_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

--
-- Name: app_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: app_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_configs_id_seq OWNED BY public.app_configs.id;

--
-- Name: auth_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_logs (
    id bigint NOT NULL,
    user_id character varying(30) DEFAULT NULL::character varying,
    email character varying(50) NOT NULL,
    device_info text,
    ip_address character varying(255) DEFAULT NULL::character varying,
    session_token text,
    login_at timestamp without time zone,
    login_via character varying(30) DEFAULT NULL::character varying,
    logout_at timestamp without time zone,
    is_online smallint DEFAULT '0'::smallint NOT NULL,
    last_activity_at timestamp without time zone,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: auth_otp_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_otp_challenges (
    id bigint NOT NULL,
    contact character varying(255) NOT NULL,
    channel character varying(10) NOT NULL,
    purpose character varying(30) NOT NULL,
    otp_hash character varying(64) NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT auth_otp_challenges_channel_check CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'phone'::character varying])::text[]))),
    CONSTRAINT auth_otp_challenges_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['registration'::character varying, 'forgot_password'::character varying])::text[])))
);

--
-- Name: auth_otp_challenges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_otp_challenges_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: auth_otp_challenges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auth_otp_challenges_id_seq OWNED BY public.auth_otp_challenges.id;

--
-- Name: branch_sectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_sectors (
    id integer NOT NULL,
    branch_id character varying(30) NOT NULL,
    sector_index integer NOT NULL,
    sector_name character varying(100) DEFAULT ''::character varying,
    delivery_partner_id character varying(30),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: branch_sectors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_sectors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: branch_sectors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_sectors_id_seq OWNED BY public.branch_sectors.id;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id bigint NOT NULL,
    branch_id character varying(30) NOT NULL,
    branch_name character varying(100) NOT NULL,
    branch_code character varying(20),
    city character varying(100),
    state character varying(100),
    lat numeric(10,7),
    lng numeric(10,7),
    delivery_radius_km numeric(5,2) DEFAULT 5,
    beffer_zone numeric(5,2) DEFAULT 0,
    allow_buffer_order boolean DEFAULT false,
    sector_count integer DEFAULT 3,
    manager_id character varying(30),
    contact_mobile character varying(20),
    email character varying(150),
    address text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    hex_shape character varying(50) DEFAULT 'hexagon'::character varying
);

--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;
--
-- Name: breakdown_incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.breakdown_incidents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL,
    deleted_at timestamp without time zone
);

--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration integer NOT NULL,
    deleted_at timestamp without time zone
);

--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    user_id character varying(30) NOT NULL,
    cart_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    category_id character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    image_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    parent_id character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(100),
    updated_by character varying(100),
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_path text
);

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;

--
-- Name: contact_enquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_enquiries (
    id integer NOT NULL,
    enquiry_id character varying(30) NOT NULL,
    full_name character varying(150) NOT NULL,
    phone character varying(20) NOT NULL,
    product_id character varying(20) DEFAULT NULL::character varying,
    product_name character varying(150) DEFAULT NULL::character varying,
    quantity numeric(8,2) DEFAULT 1.00 NOT NULL,
    unit_type character varying(20) DEFAULT 'litre'::character varying,
    address text NOT NULL,
    address_line1 character varying(255) DEFAULT NULL::character varying,
    city character varying(100) DEFAULT NULL::character varying,
    state character varying(100) DEFAULT NULL::character varying,
    pincode character varying(10) DEFAULT NULL::character varying,
    map_url character varying(255) DEFAULT NULL::character varying,
    notes text,
    status character varying(255) DEFAULT 'new'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

--
-- Name: containers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.containers (
    id bigint NOT NULL,
    container_id character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    is_returnable boolean DEFAULT true,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    warehouse_id character varying(100) DEFAULT NULL::character varying
);

--
-- Name: containers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.containers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: containers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.containers_id_seq OWNED BY public.containers.id;

--
-- Name: customer_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_activity_logs (
    id bigint NOT NULL,
    customer_id character varying(30) NOT NULL,
    activity_type character varying(50) NOT NULL,
    activity_data jsonb,
    ip_address character varying(100),
    device_info text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: customer_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customer_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_activity_logs_id_seq OWNED BY public.customer_activity_logs.id;

--
-- Name: customer_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_addresses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id bigint DEFAULT nextval('public.customer_addresses_id_seq'::regclass) NOT NULL,
    address_id character varying(30) NOT NULL,
    customer_id character varying(30) NOT NULL,
    is_default boolean DEFAULT false,
    status boolean NOT NULL,
    address_type character varying(20) DEFAULT 'home'::character varying,
    contact_name character varying(150),
    contact_mobile character varying(20),
    flat_no character varying(50),
    floor_no character varying(50),
    building_name character varying(150),
    landmark character varying(255),
    street character varying(255),
    area character varying(150),
    city character varying(100),
    state character varying(100),
    pincode character varying(20),
    address_line text,
    branch_id character varying(30),
    delivery_note text,
    latitude numeric(18,15),
    longitude numeric(18,15),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id character varying(30)
);

--
-- Name: customer_bill_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_bill_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customer_bill_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_bill_items (
    id bigint DEFAULT nextval('public.customer_bill_items_id_seq'::regclass) NOT NULL,
    bill_id character varying(30) NOT NULL,
    reference_type character varying(20) NOT NULL,
    reference_id character varying(30) NOT NULL,
    product_variant_id character varying(30) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) DEFAULT '0'::numeric,
    tax_amount numeric(12,2) DEFAULT '0'::numeric,
    total_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: customer_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_bills (
    bill_id character varying(30) NOT NULL,
    customer_id character varying(30) NOT NULL,
    bill_type character varying(20) NOT NULL,
    reference_id character varying(30) NOT NULL,
    payment_type character varying(20) NOT NULL,
    payment_method character varying(20) NOT NULL,
    billing_from date,
    billing_to date,
    due_date date,
    subtotal numeric(12,2) DEFAULT '0'::numeric,
    discount_amount numeric(12,2) DEFAULT '0'::numeric,
    tax_amount numeric(12,2) DEFAULT '0'::numeric,
    total_amount numeric(12,2) NOT NULL,
    paid_amount numeric(12,2) DEFAULT '0'::numeric,
    due_amount numeric(12,2) DEFAULT '0'::numeric,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: customer_container_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_container_balances (
    id bigint NOT NULL,
    customer_id character varying(30) NOT NULL,
    container_id character varying(30) CONSTRAINT customer_container_balances_packaging_type_id_not_null NOT NULL,
    issued_quantity integer DEFAULT 0,
    returned_quantity integer DEFAULT 0,
    damaged_quantity integer DEFAULT 0,
    lost_quantity integer DEFAULT 0,
    balance_quantity integer GENERATED ALWAYS AS ((((issued_quantity - returned_quantity) - damaged_quantity) - lost_quantity)) STORED,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: customer_container_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_container_balances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customer_container_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_container_balances_id_seq OWNED BY public.customer_container_balances.id;

--
-- Name: customer_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_feedback (
    id bigint NOT NULL,
    customer_id character varying(30) NOT NULL,
    reference_type character varying(30),
    reference_id character varying(30),
    rating smallint,
    feedback_type character varying(30),
    feedback text,
    status character varying(20) DEFAULT 'open'::character varying,
    resolved_by character varying(30),
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: customer_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_feedback_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customer_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_feedback_id_seq OWNED BY public.customer_feedback.id;
--
-- Name: customer_variant_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_variant_prices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: customer_wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_wallet_transactions (
    id bigint NOT NULL,
    transaction_id character varying(20) DEFAULT ('WTR_'::text || upper(substr((gen_random_uuid())::text, 1, 12))),
    customer_id character varying(30) NOT NULL,
    transaction_type character varying(20) NOT NULL,
    amount numeric(12,2) NOT NULL,
    balance_after numeric(12,2),
    reference_type character varying(30),
    reference_id character varying(30),
    remarks text,
    created_by character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: customer_wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_wallet_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customer_wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_wallet_transactions_id_seq OWNED BY public.customer_wallet_transactions.id;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    customer_id character varying(30) CONSTRAINT customers_new_customer_id_not_null NOT NULL,
    customer_status character varying(30) DEFAULT 'active'::character varying,
    customer_type character varying(30) DEFAULT 'retail'::character varying,
    is_blocked boolean DEFAULT false,
    subscription_number character varying(50),
    block_reason text,
    is_postpaid_enabled boolean DEFAULT false,
    postpaid_credit_limit numeric(10,2) DEFAULT 0.00,
    first_order_completed boolean DEFAULT false,
    wallet_balance numeric(10,2) DEFAULT 0.00,
    reward_points integer DEFAULT 0,
    gender character varying(20),
    dob date,
    alternate_mobile character varying(20),
    notes text,
    branch_id character varying(30),
    referral_status character varying(30) DEFAULT 'unlocked'::character varying,
    referred_by character varying(30),
    created_by character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);

--
-- Name: delivery_calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_calendar (
    id integer NOT NULL,
    calendar_id character varying(20) NOT NULL,
    zone_id integer,
    date date NOT NULL,
    day_type character varying(255) NOT NULL,
    delivery_slot character varying(255) DEFAULT 'both'::character varying,
    reason character varying(255) DEFAULT NULL::character varying,
    is_blocked smallint DEFAULT '1'::smallint NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by integer,
    deleted_at timestamp without time zone,
    deleted_by integer
);

-- =========================================================
-- DELIVERY DISPATCH STATUS
-- =========================================================

CREATE TYPE delivery_dispatch_status_enum AS ENUM (
    'draft',
    'loaded',
    'collected',
    'in_progress',
    'return_pending',
    'completed'
);


-- =========================================================
-- DELIVERY DISPATCH
-- =========================================================

CREATE TABLE public.delivery_dispatch (
    id BIGSERIAL PRIMARY KEY,

    dispatch_id VARCHAR(30) UNIQUE NOT NULL,

    warehouse_id VARCHAR(30) NOT NULL,

    delivery_run_id VARCHAR(30) NOT NULL
        REFERENCES delivery_runs(id)
        ON DELETE CASCADE,

    status delivery_dispatch_status_enum
        NOT NULL DEFAULT 'draft',

    loaded_at TIMESTAMPTZ,

    collected_at TIMESTAMPTZ,

    returned_at TIMESTAMPTZ,

    loaded_by VARCHAR(30),

    return_collected_by VARCHAR(30),

    created_by VARCHAR(30),

    updated_by VARCHAR(30),

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    deleted_at TIMESTAMPTZ,

    UNIQUE (delivery_run_id)
);

CREATE INDEX idx_delivery_dispatch_warehouse
ON public.delivery_dispatch(warehouse_id);

CREATE INDEX idx_delivery_dispatch_run
ON public.delivery_dispatch(delivery_run_id);

CREATE INDEX idx_delivery_dispatch_status
ON public.delivery_dispatch(status);


--
-- Name: delivery_dispatch_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_dispatch_items (
    id bigint NOT NULL,
    dispatch_id character varying(30) NOT NULL,
    warehouse_id character varying(30) NOT NULL,
    delivery_run_id character varying(30) NOT NULL,
    product_variant_id character varying(30) NOT NULL,
    planned_qty numeric(10,2) DEFAULT 0 NOT NULL,
    loaded_qty numeric(10,2) DEFAULT 0 NOT NULL,
    delivered_qty numeric(10,2) DEFAULT 0 NOT NULL,
    returned_qty numeric(10,2) DEFAULT 0 NOT NULL,
    damaged_qty numeric(10,2) DEFAULT 0 NOT NULL,
    extra_sold_qty numeric(10,2) DEFAULT 0 NOT NULL,
    unit character varying(20),
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: delivery_dispatch_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_dispatch_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: delivery_dispatch_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_dispatch_items_id_seq OWNED BY public.delivery_dispatch_items.id;

--
-- Name: delivery_leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_leave_requests (
    id integer NOT NULL,
    delivery_partner_id character varying(30) NOT NULL,
    leave_date date NOT NULL,
    end_date date,
    leave_type character varying(50) DEFAULT 'FULL_DAY'::character varying,
    half_day_shift character varying(50),
    reason text,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    admin_remarks text,
    notified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone
);

--
-- Name: delivery_leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: delivery_leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_leave_requests_id_seq OWNED BY public.delivery_leave_requests.id;

--
-- Name: delivery_location_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_location_logs (
    id integer NOT NULL,
    delivery_partner_id integer NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    battery integer,
    speed numeric(6,2),
    user_id character varying(30),
    accuracy numeric(8,2)
);

--
-- Name: delivery_location_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_location_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: delivery_location_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_location_logs_id_seq OWNED BY public.delivery_location_logs.id;

--
-- Name: delivery_partner_locations; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.delivery_partner_locations AS
 SELECT id,
    user_id AS delivery_partner_id,
    user_id,
    latitude AS lat,
    longitude AS lng,
    latitude,
    longitude,
    speed,
    battery,
    accuracy,
    recorded_at,
    recorded_at AS updated_at
   FROM public.delivery_location_logs;

--
-- Name: delivery_partner_referral_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_partner_referral_bonuses (
    id bigint NOT NULL,
    bonus_id character varying(30) NOT NULL,
    partner_id character varying(50) NOT NULL,
    refer_id character varying(30),
    referee_name character varying(150),
    referee_phone character varying(30),
    order_id character varying(30),
    amount numeric(10,2) DEFAULT 75.00 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    remarks text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT delivery_partner_referral_bonuses_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'cancelled'::character varying])::text[])))
);

--
-- Name: delivery_partner_referral_bonuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_partner_referral_bonuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: delivery_partner_referral_bonuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_partner_referral_bonuses_id_seq OWNED BY public.delivery_partner_referral_bonuses.id;

--
-- Name: delivery_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_partners (
    delivery_partner_id character varying(30) CONSTRAINT delivery_partners_new_delivery_partner_id_not_null NOT NULL,
    user_id character varying(30),
    is_active boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    is_available boolean DEFAULT true,
    is_online boolean DEFAULT false,
    vehicle_type character varying(50),
    vehicle_number character varying(30),
    daily_salary numeric(10,2) DEFAULT 0.00,
    bank_account_number character varying(50),
    bank_ifsc character varying(20),
    bank_name character varying(100),
    account_holder_name character varying(150),
    profile_photo_url text,
    id_proof_url text,
    aadhaar_url text,
    current_lat numeric(10,7),
    current_lng numeric(10,7),
    last_location_at timestamp with time zone,
    average_rating numeric(3,2) DEFAULT 5.00,
    total_runs integer DEFAULT 0,
    total_deliveries integer DEFAULT 0,
    joined_date date,
    max_daily_orders integer DEFAULT 50,
    breakdown_reason text,
    breakdown_reported_at timestamp with time zone,
    breakdown_latitude numeric(10,7),
    breakdown_longitude numeric(10,7),
    emergency_contact character varying(100),
    emergency_contact_number character varying(20),
    date_of_birth date,
    gender character varying(20),
    residential_address text,
    branch_id character varying(30),
    referred_by character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);

--
-- Name: delivery_run_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_run_addresses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;

--
-- Name: delivery_run_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_run_addresses (
    id integer DEFAULT nextval('public.delivery_run_addresses_id_seq'::regclass) NOT NULL,
    run_id character varying(30) NOT NULL,
    customer_id character varying(30) NOT NULL,
    address_id character varying,
    sequence_no integer DEFAULT 0 NOT NULL,
    delivery_status character varying(20) DEFAULT 'pending'::character varying,
    order_ids text,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    CONSTRAINT delivery_run_addresses_delivery_status_check CHECK (((delivery_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('in_transit'::character varying)::text, ('arrived'::character varying)::text, ('delivered'::character varying)::text, ('failed'::character varying)::text, ('skipped'::character varying)::text, ('returned'::character varying)::text])))
);

--
-- Name: delivery_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_runs (
    id integer NOT NULL,
    run_id character varying(30) NOT NULL,
    delivery_partner_id character varying(30) NOT NULL,
    branch_id character varying,
    run_date date DEFAULT CURRENT_DATE NOT NULL,
    delivery_slot character varying(30) DEFAULT 'morning'::character varying NOT NULL,
    status character varying(20) DEFAULT 'planned'::character varying,
    assignment_method character varying(30) DEFAULT 'auto_balanced'::character varying,
    total_addresses integer DEFAULT 0,
    completed_addresses integer DEFAULT 0,
    failed_addresses integer DEFAULT 0,
    planned_start_time timestamp with time zone,
    actual_start_time timestamp with time zone,
    actual_end_time timestamp with time zone,
    total_distance_km numeric(8,2) DEFAULT NULL::numeric,
    assigned_by character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    CONSTRAINT delivery_runs_assignment_method_check CHECK (((assignment_method)::text = ANY ((ARRAY['auto_history'::character varying, 'auto_cluster'::character varying, 'auto_balanced'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT delivery_runs_delivery_slot_check CHECK (((delivery_slot)::text = ANY ((ARRAY['morning'::character varying, 'evening'::character varying])::text[]))),
    CONSTRAINT delivery_runs_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'assigned'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'partial'::character varying])::text[])))
);

--
-- Name: delivery_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: delivery_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_runs_id_seq OWNED BY public.delivery_runs.id;

--
-- Name: device_information; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_information (
    device_id character varying(255) NOT NULL,
    brand character varying(100),
    model character varying(100),
    hardware character varying(100),
    os_version character varying(50),
    current_version character varying(50),
    target_version character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

--
-- Name: device_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_sessions (
    id uuid NOT NULL,
    user_id character varying(30) NOT NULL,
    refresh_jti uuid NOT NULL,
    refresh_token_hash character varying(64) NOT NULL,
    device_id character varying(255),
    fcm_token text,
    ip_address character varying(64),
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);
--
-- Name: dispatch_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispatch_balances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: dispatch_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispatch_requirements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: notification_recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_recipients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: notification_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_recipients (
    id bigint DEFAULT nextval('public.notification_recipients_id_seq'::regclass) NOT NULL,
    notification_id character varying(30) NOT NULL,
    user_id character varying(30) NOT NULL,
    html text,
    image character varying(30) DEFAULT NULL::character varying,
    status character varying(255) DEFAULT 'unread'::character varying,
    notified_at timestamp without time zone,
    read_at timestamp without time zone,
    remind_at timestamp without time zone,
    created_by character varying(30) NOT NULL,
    updated_by character varying(30) DEFAULT NULL::character varying,
    delete_on timestamp without time zone,
    restored_at timestamp without time zone,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint DEFAULT nextval('public.notifications_id_seq'::regclass) NOT NULL,
    notification_id character varying(30) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    medium character varying(30) DEFAULT NULL::character varying,
    type character varying(255) DEFAULT NULL::character varying,
    priority character varying(255) DEFAULT 'medium'::character varying,
    sender_id character varying(30) DEFAULT NULL::character varying,
    status character varying(255) DEFAULT 'active'::character varying,
    created_by character varying(30) NOT NULL,
    updated_by character varying(30) DEFAULT NULL::character varying,
    delete_on timestamp without time zone,
    restored_at timestamp without time zone,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: order_batch_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_batch_items (
    id bigint NOT NULL,
    batch_id character varying(30) NOT NULL,
    variant_id character varying(100) NOT NULL,
    product_id character varying(100),
    required_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    prepared_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit character varying(20) DEFAULT 'pcs'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: order_batch_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_batch_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: order_batch_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_batch_items_id_seq OWNED BY public.order_batch_items.id;

--
-- Name: order_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_batches (
    batch_id character varying(30) NOT NULL,
    branch_id character varying(30) NOT NULL,
    production_date date NOT NULL,
    slot character varying(20),
    product_id character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    total_quantity numeric(12,3) DEFAULT 0,
    prepared_quantity numeric(12,3) DEFAULT 0,
    total_orders integer DEFAULT 0,
    order_ids json DEFAULT '{}'::json,
    notes text,
    created_by character varying(30),
    updated_by character varying(30),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);
--
-- Name: order_containers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_containers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer DEFAULT nextval('public.order_items_id_seq'::regclass) NOT NULL,
    order_id character varying(50) NOT NULL,
    variant_id character varying(30) DEFAULT NULL::character varying,
    subscription_item_id character varying(30) DEFAULT NULL::character varying,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    discount_id character varying(30),
    coupon_id character varying(30),
    discount_amount numeric(10,2) DEFAULT 0,
    coupon_amount numeric(10,2) DEFAULT 0,
    is_free boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    final_price numeric(10,2) GENERATED ALWAYS AS (GREATEST((((unit_price * quantity) - discount_amount) - coupon_amount), (0)::numeric)) STORED,
    total_price numeric(10,2) DEFAULT 0,
    status character varying(50) DEFAULT 'placed'::character varying,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: order_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_logs (
    id integer NOT NULL,
    order_id character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    notes text,
    changed_by character varying(100),
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: order_status_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_status_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: order_status_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_status_logs_id_seq OWNED BY public.order_status_logs.id;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_id character varying(30) DEFAULT ('ORD_'::text || upper(substr((gen_random_uuid())::text, 1, 12))) NOT NULL,
    customer_id character varying(30) NOT NULL,
    customer_name character varying(150) NOT NULL,
    order_source character varying(20),
    subscription_id character varying(30) DEFAULT NULL::character varying,
    generation_type character varying(20),
    address_id character varying(30) NOT NULL,
    address_line character varying(150) NOT NULL,
    contact_number character varying(15) NOT NULL,
    branch_id character varying(30) DEFAULT NULL::character varying,
    delivery_slot character varying(20) NOT NULL,
    scheduled_date date NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    gst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_mode character varying(20) DEFAULT NULL::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    delivery_partner_id character varying(30) DEFAULT NULL::character varying,
    delivery_run_id character varying(30) DEFAULT NULL::character varying,
    special_instructions text,
    is_arriving_notified boolean,
    run_sequence integer,
    assignment_method character varying(30),
    assigned_at timestamp without time zone,
    invoice_image character varying(255) DEFAULT NULL::character varying,
    delivery_image character varying(255) DEFAULT NULL::character varying,
    payment_screenshot character varying(255) DEFAULT NULL::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(50) DEFAULT 'SYSTEM'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    delivery_time timestamp without time zone
);

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

--
-- Name: otp_rate_limit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_rate_limit_logs (
    id integer NOT NULL,
    phone character varying(20) NOT NULL,
    type character varying(30) NOT NULL,
    attempt_number integer NOT NULL,
    ip_address character varying(45) NOT NULL,
    deleted_at timestamp with time zone,
    created_by character varying(100) DEFAULT NULL::character varying,
    updated_by character varying(100) DEFAULT NULL::character varying,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: password_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_history (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    payment_id character varying(30) NOT NULL,
    bill_id character varying(30) NOT NULL,
    customer_id character varying(30) NOT NULL,
    payment_method character varying(20) NOT NULL,
    amount numeric(12,2) NOT NULL,
    transaction_reference character varying(100),
    payment_status character varying(20) NOT NULL,
    paid_at timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: product_banner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_banner (
    id integer NOT NULL,
    title character varying(255),
    discount_text character varying(255),
    action_type character varying(100),
    action_value character varying(255),
    cta_label character varying(100),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    image_url text,
    image_path text,
    created_by character varying(50),
    updated_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    description text,
    background_color character varying(50)
);

--
-- Name: product_banner_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_banner_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: product_banner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_banner_id_seq OWNED BY public.product_banner.id;

--
-- Name: product_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_batches (
    id integer NOT NULL,
    warehouse_id character varying(30) NOT NULL,
    batch_id text NOT NULL,
    product_id character varying(30) NOT NULL,
    variant_id character varying(30) DEFAULT NULL::character varying,
    manufactured_at date,
    expiry_at date,
    quantity numeric(18,4) DEFAULT 0 NOT NULL,
    available_quantity numeric(18,4) DEFAULT 0 NOT NULL,
    damaged_quantity numeric(18,4) DEFAULT 0 NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_by text,
    deleted_at timestamp with time zone
);

--
-- Name: product_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: product_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_batches_id_seq OWNED BY public.product_batches.id;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id character varying(50),
    variant_id character varying(50),
    url text,
    storage_key text,
    alt_text character varying(255),
    width integer,
    height integer,
    sort_order integer,
    is_primary boolean DEFAULT false,
    created_by character varying(50),
    updated_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);

--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id integer NOT NULL,
    variant_id character varying(100) NOT NULL,
    product_id character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    sku character varying(100),
    price numeric(10,2) NOT NULL,
    subscription_price numeric(10,2),
    unit_value numeric(10,3),
    unit_type public.product_unit_enum,
    fulfillment_mode public.fulfillment_mode_enum DEFAULT 'prepacked'::public.fulfillment_mode_enum NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    manageable_qty integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by character varying(100),
    updated_by character varying(100),
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    low_stock_threshold integer DEFAULT 10 NOT NULL,
    packaging_type_id character varying(30),
    container_id character varying(30) DEFAULT NULL::character varying,
    original_price numeric(10,2),
    discount bigint
);

--
-- Name: product_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: product_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_variants_id_seq OWNED BY public.product_variants.id;

--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    product_id character varying(100) NOT NULL,
    sku character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    slug character varying(200) NOT NULL,
    category_id character varying(100) NOT NULL,
    vendor_id character varying(100),
    description text,
    highlights text,
    ingredients text,
    legal_info text,
    is_subscribable boolean DEFAULT false NOT NULL,
    is_one_time boolean DEFAULT true NOT NULL,
    is_returnable boolean DEFAULT false NOT NULL,
    batch_product boolean DEFAULT false NOT NULL,
    unit_type public.product_unit_enum NOT NULL,
    lift_days integer,
    gst_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(100),
    updated_by character varying(100),
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_out_of_stock boolean DEFAULT false NOT NULL
);

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

--
-- Name: purchase_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_entries (
    id integer NOT NULL,
    purchase_number character varying(30) NOT NULL,
    vendor_id integer,
    warehouse_id integer,
    variant_id character varying NOT NULL,
    product_id character varying,
    quantity integer NOT NULL,
    unit_cost numeric(10,2) DEFAULT 0,
    total_cost numeric(12,2) DEFAULT 0,
    batch_number character varying(50) DEFAULT NULL::character varying,
    manufacturing_date date,
    expiry_date date,
    received_by character varying,
    status character varying(20) DEFAULT 'received'::character varying,
    quality_notes text,
    invoice_number character varying(50) DEFAULT NULL::character varying,
    invoice_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    CONSTRAINT purchase_entries_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT purchase_entries_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'received'::character varying, 'inspected'::character varying, 'rejected'::character varying, 'returned'::character varying])::text[])))
);

--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id bigint NOT NULL,
    refer_id character varying(30) NOT NULL,
    referrer_customer_id character varying(30) NOT NULL,
    referred_customer_id character varying(30) NOT NULL,
    referral_code character varying(30),
    referrer_reward_amount numeric(10,2) DEFAULT 0,
    referred_reward_amount numeric(10,2) DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    rewarded_at timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    CONSTRAINT referrals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'registered'::character varying, 'first_order'::character varying, 'rewarded'::character varying, 'cancelled'::character varying])::text[])))
);

--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;

--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id bigint NOT NULL,
    refund_number character varying(50) NOT NULL,
    customer_id character varying(30) NOT NULL,
    order_id character varying(30),
    refund_amount numeric(12,2) NOT NULL,
    refund_type character varying(30) DEFAULT 'wallet'::character varying,
    status public.refund_status_enum DEFAULT 'pending'::public.refund_status_enum,
    reason text,
    approved_by character varying(30),
    approved_at timestamp with time zone,
    processed_at timestamp with time zone,
    transaction_id character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    CONSTRAINT refunds_refund_type_check CHECK (((refund_type)::text = ANY ((ARRAY['wallet'::character varying, 'bank_transfer'::character varying, 'cash'::character varying, 'upi'::character varying])::text[])))
);

--
-- Name: refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refunds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: refunds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refunds_id_seq OWNED BY public.refunds.id;

--
-- Name: role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_assignments (
    id bigint NOT NULL,
    user_id character varying(30) NOT NULL,
    role_id character varying(30) NOT NULL,
    is_active smallint DEFAULT 1 NOT NULL,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    sno character varying(10) NOT NULL,
    role_id character varying(30) NOT NULL,
    name character varying(255) DEFAULT NULL::character varying,
    description text,
    parent_role_id character varying(30) DEFAULT NULL::character varying,
    is_system_role smallint DEFAULT '0'::smallint NOT NULL,
    is_active smallint DEFAULT '1'::smallint NOT NULL,
    created_by character varying(30) DEFAULT NULL::character varying,
    updated_by character varying(30) DEFAULT NULL::character varying,
    delete_on timestamp without time zone,
    restored_at timestamp without time zone,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_balances (
    id bigint NOT NULL,
    warehouse_id character varying(30) NOT NULL,
    product_variant_id character varying(30) NOT NULL,
    available_quantity numeric(12,2) DEFAULT 0 NOT NULL,
    reserved_quantity numeric(12,2) DEFAULT 0 NOT NULL,
    dispatched_quantity numeric(12,2) DEFAULT 0 NOT NULL,
    damaged_quantity numeric(12,2) DEFAULT 0 NOT NULL,
    low_stock_threshold numeric(12,2) DEFAULT 10,
    is_out_of_stock boolean GENERATED ALWAYS AS ((available_quantity <= (0)::numeric)) STORED,
    last_stock_update timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100),
    updated_by character varying(100),
    deleted_at timestamp without time zone
);

--
-- Name: stock_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_balances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: stock_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_balances_id_seq OWNED BY public.stock_balances.id;

--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    movement_id character varying(100) NOT NULL,
    warehouse_id character varying(30) NOT NULL,
    product_variant_id character varying(30) NOT NULL,
    batch_id character varying(50),
    movement_type character varying(30) NOT NULL,
    direction smallint NOT NULL,
    quantity numeric(12,2) NOT NULL,
    quantity_before numeric(12,2) NOT NULL,
    quantity_after numeric(12,2) NOT NULL,
    unit_cost numeric(12,4),
    reference_type character varying(50),
    reference_id character varying(100),
    notes text,
    created_by character varying(30),
    updated_by character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT stock_movements_direction_check CHECK ((direction = ANY (ARRAY['-1'::integer, 1]))),
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['stock_in'::character varying, 'stock_out'::character varying, 'purchase'::character varying, 'production'::character varying, 'stock_transfer'::character varying, 'dispatch'::character varying, 'delivery_return'::character varying, 'customer_return'::character varying, 'stock_adjustment'::character varying, 'damage'::character varying, 'expiry'::character varying, 'opening_stock'::character varying, 'closing_stock'::character varying])::text[])))
);

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;

--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfers (
    id bigint NOT NULL,
    transfer_id character varying(100) NOT NULL,
    from_warehouse_id character varying(30) NOT NULL,
    to_warehouse_id character varying(30) NOT NULL,
    product_variant_id character varying(30) NOT NULL,
    batch_id character varying(50),
    uom character varying(20) NOT NULL,
    quantity numeric(12,2) NOT NULL,
    quantity_dispatched numeric(12,2) DEFAULT 0,
    quantity_received numeric(12,2) DEFAULT 0,
    transfer_type character varying(30),
    reason_code character varying(50),
    transfer_status character varying(30) DEFAULT 'pending'::character varying,
    notes text,
    created_by character varying(30),
    updated_by character varying(30),
    approved_by character varying(30),
    dispatched_by character varying(30),
    received_by character varying(30),
    expected_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT stock_transfers_transfer_status_check CHECK (((transfer_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'dispatched'::character varying, 'partially_received'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT stock_transfers_transfer_type_check CHECK (((transfer_type)::text = ANY ((ARRAY['warehouse_transfer'::character varying, 'branch_transfer'::character varying, 'stock_return'::character varying, 'vendor_return'::character varying, 'adjustment'::character varying])::text[])))
);

--
-- Name: stock_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_transfers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: stock_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_transfers_id_seq OWNED BY public.stock_transfers.id;

--
-- Name: subscription_custom_dates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_custom_dates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subscription_custom_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_custom_schedule (
    id integer DEFAULT nextval('public.subscription_custom_dates_id_seq'::regclass) NOT NULL,
    subscription_id character varying(30) NOT NULL,
    subscription_item_id character varying(30) NOT NULL,
    delivery_date date NOT NULL,
    m_quantity numeric(10,2) DEFAULT '0'::numeric,
    e_quantity numeric(10,2) DEFAULT '0'::numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: subscription_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subscription_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_items (
    id integer DEFAULT nextval('public.subscription_items_id_seq'::regclass) NOT NULL,
    subscription_item_id character varying(30) NOT NULL,
    subscription_id character varying(30) NOT NULL,
    product_variant_id character varying(30),
    unit_price numeric(10,2) NOT NULL,
    discount_id character varying(30),
    coupon_id character varying(30),
    discount_amount numeric(10,2) DEFAULT '0'::numeric,
    coupon_amount numeric(10,2) DEFAULT '0'::numeric,
    final_price numeric(10,2) GENERATED ALWAYS AS (GREATEST(((unit_price - discount_amount) - coupon_amount), (0)::numeric)) STORED,
    is_free boolean DEFAULT false NOT NULL,
    status public.subscription_status_enum DEFAULT 'active'::public.subscription_status_enum,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);

--
-- Name: subscription_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_logs (
    id bigint NOT NULL,
    subscription_id character varying(30),
    subscription_item_id character varying(30),
    action character varying(50) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_by character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: subscription_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subscription_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_logs_id_seq OWNED BY public.subscription_logs.id;

--
-- Name: subscription_pauses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_pauses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subscription_pauses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_pauses (
    id bigint DEFAULT nextval('public.subscription_pauses_id_seq'::regclass) NOT NULL,
    subscription_id character varying(30) NOT NULL,
    subscription_item_id character varying(30),
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    status character varying(32) DEFAULT 'paused'::character varying,
    is_refunded boolean DEFAULT false,
    updated_at timestamp with time zone
);

--
-- Name: subscription_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_refunds (
    id character varying(64) NOT NULL,
    subscription_id character varying(64) NOT NULL,
    customer_id character varying(64) NOT NULL,
    refund_date date NOT NULL,
    refund_month character varying(7) NOT NULL,
    total_paused_days integer NOT NULL,
    refund_amount numeric(10,2) NOT NULL,
    wallet_transaction_id character varying(64),
    created_at timestamp with time zone DEFAULT now(),
    status character varying(32) DEFAULT 'pending'::character varying
);

--
-- Name: subscription_renewal_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_renewal_attempts (
    id bigint NOT NULL,
    subscription_id character varying(50) NOT NULL,
    customer_id character varying(30) NOT NULL,
    attempt_type character varying(20) NOT NULL,
    payment_type character varying(20) NOT NULL,
    renewal_amount numeric(12,2) NOT NULL,
    wallet_balance_at_attempt numeric(12,2),
    bill_id character varying(30),
    status character varying(20) NOT NULL,
    failure_reason text,
    old_end_date date,
    new_end_date date,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: subscription_renewal_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_renewal_attempts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subscription_renewal_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_renewal_attempts_id_seq OWNED BY public.subscription_renewal_attempts.id;

--
-- Name: subscription_weekly_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_weekly_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subscription_weekly_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_weekly_schedule (
    id bigint DEFAULT nextval('public.subscription_weekly_schedule_id_seq'::regclass) NOT NULL,
    subscription_id character varying(30),
    subscription_item_id character varying(30) NOT NULL,
    day_of_week smallint NOT NULL,
    m_quantity numeric(10,2) DEFAULT '0'::numeric,
    e_quantity numeric(10,2) DEFAULT '0'::numeric,
    effective_from date,
    effective_to date,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    CONSTRAINT subscription_weekly_schedule_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    subscription_id character varying(50) NOT NULL,
    subscription_number character varying(50) NOT NULL,
    customer_id character varying(30) NOT NULL,
    schedule_type public.subscription_schedule_type_enum NOT NULL,
    branch_id character varying(30) DEFAULT NULL::character varying,
    address_id character varying(30) NOT NULL,
    payment_type public.subscription_payment_type_enum NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying,
    start_date date NOT NULL,
    end_date date,
    auto_renew boolean DEFAULT false,
    renewal_grace_days integer DEFAULT 3,
    status character varying(20) DEFAULT 'active'::character varying,
    pause_from_date date,
    pause_to_date date,
    pause_reason text,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    notes text,
    metadata jsonb,
    created_by character varying(30),
    updated_by character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    monthly_estimate money
);

--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;

--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    ticket_id character varying(30) NOT NULL,
    user_id character varying(50) NOT NULL,
    user_type character varying(30) NOT NULL,
    category character varying(100) NOT NULL,
    subject character varying(255) NOT NULL,
    description text,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status public.support_status DEFAULT 'open'::public.support_status,
    attachments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp without time zone
);

--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_devices (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    device_id character varying(255) NOT NULL,
    device_name character varying(255) DEFAULT NULL::character varying,
    device_info json,
    ip_address text,
    is_active smallint DEFAULT '1'::smallint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_used timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamp without time zone,
    deleted_at timestamp without time zone
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id character varying(30) CONSTRAINT users_new_user_id_not_null NOT NULL,
    phone character varying(20),
    email character varying(150),
    password character varying(255),
    user_name character varying(50),
    first_name character varying(100) DEFAULT ''::character varying,
    last_name character varying(100) DEFAULT ''::character varying,
    role_id character varying(30) DEFAULT 'CUSTOMER'::character varying,
    account_status character varying(30) DEFAULT 'active'::character varying,
    referral_code character varying(30),
    must_change_password smallint DEFAULT 0,
    email_verified_at timestamp with time zone,
    password_changed_at timestamp with time zone,
    locked_at timestamp with time zone,
    max_logins integer,
    fcm_token text,
    last_login_at timestamp with time zone,
    referred_by character varying(30),
    created_by character varying(30),
    updated_by character varying(250),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);

--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id bigint NOT NULL,
    warehouse_id character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    warehouse_type character varying(50) NOT NULL,
    address_line_1 character varying(255),
    address_line_2 character varying(255),
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'India'::character varying,
    pincode character varying(20),
    latitude numeric(10,7),
    longitude numeric(10,7),
    manager_name character varying(150),
    manager_phone character varying(20),
    manager_email character varying(150),
    capacity numeric(12,2),
    capacity_unit character varying(20) DEFAULT 'ltr'::character varying,
    temperature_type character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by character varying(50),
    updated_by character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

--
-- Name: warehouses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: warehouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehouses_id_seq OWNED BY public.warehouses.id;

--
-- Name: admin_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_logs_id_seq'::regclass);

--
-- Name: app_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_configs ALTER COLUMN id SET DEFAULT nextval('public.app_configs_id_seq'::regclass);

--
-- Name: auth_otp_challenges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_otp_challenges ALTER COLUMN id SET DEFAULT nextval('public.auth_otp_challenges_id_seq'::regclass);

--
-- Name: branch_sectors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_sectors ALTER COLUMN id SET DEFAULT nextval('public.branch_sectors_id_seq'::regclass);

--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);
--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);

--
-- Name: containers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers ALTER COLUMN id SET DEFAULT nextval('public.containers_id_seq'::regclass);

--
-- Name: customer_activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.customer_activity_logs_id_seq'::regclass);

--
-- Name: customer_container_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_container_balances ALTER COLUMN id SET DEFAULT nextval('public.customer_container_balances_id_seq'::regclass);

--
-- Name: customer_feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback ALTER COLUMN id SET DEFAULT nextval('public.customer_feedback_id_seq'::regclass);
--
-- Name: customer_wallet_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.customer_wallet_transactions_id_seq'::regclass);

--
-- Name: delivery_dispatch_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch_items ALTER COLUMN id SET DEFAULT nextval('public.delivery_dispatch_items_id_seq'::regclass);

--
-- Name: delivery_leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_leave_requests ALTER COLUMN id SET DEFAULT nextval('public.delivery_leave_requests_id_seq'::regclass);

--
-- Name: delivery_location_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_logs ALTER COLUMN id SET DEFAULT nextval('public.delivery_location_logs_id_seq'::regclass);

--
-- Name: delivery_partner_referral_bonuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partner_referral_bonuses ALTER COLUMN id SET DEFAULT nextval('public.delivery_partner_referral_bonuses_id_seq'::regclass);

--
-- Name: delivery_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs ALTER COLUMN id SET DEFAULT nextval('public.delivery_runs_id_seq'::regclass);
--
-- Name: order_batch_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_batch_items ALTER COLUMN id SET DEFAULT nextval('public.order_batch_items_id_seq'::regclass);
--
-- Name: order_status_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_logs ALTER COLUMN id SET DEFAULT nextval('public.order_status_logs_id_seq'::regclass);

--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);

--
-- Name: product_banner id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_banner ALTER COLUMN id SET DEFAULT nextval('public.product_banner_id_seq'::regclass);

--
-- Name: product_batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches ALTER COLUMN id SET DEFAULT nextval('public.product_batches_id_seq'::regclass);

--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);

--
-- Name: product_variants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants ALTER COLUMN id SET DEFAULT nextval('public.product_variants_id_seq'::regclass);

--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);

--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);

--
-- Name: refunds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds ALTER COLUMN id SET DEFAULT nextval('public.refunds_id_seq'::regclass);

--
-- Name: stock_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances ALTER COLUMN id SET DEFAULT nextval('public.stock_balances_id_seq'::regclass);

--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);

--
-- Name: stock_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers ALTER COLUMN id SET DEFAULT nextval('public.stock_transfers_id_seq'::regclass);

--
-- Name: subscription_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_logs ALTER COLUMN id SET DEFAULT nextval('public.subscription_logs_id_seq'::regclass);

--
-- Name: subscription_renewal_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_renewal_attempts ALTER COLUMN id SET DEFAULT nextval('public.subscription_renewal_attempts_id_seq'::regclass);

--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);

--
-- Name: warehouses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouses_id_seq'::regclass);

--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);

--
-- Name: api_integrations_config api_integrations_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_integrations_config
    ADD CONSTRAINT api_integrations_config_pkey PRIMARY KEY (id);

--
-- Name: app_configs app_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_configs
    ADD CONSTRAINT app_configs_pkey PRIMARY KEY (id);

--
-- Name: app_configs app_configs_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_configs
    ADD CONSTRAINT app_configs_platform_key UNIQUE (platform);

--
-- Name: auth_otp_challenges auth_otp_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_otp_challenges
    ADD CONSTRAINT auth_otp_challenges_pkey PRIMARY KEY (id);

--
-- Name: branch_sectors branch_sectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_sectors
    ADD CONSTRAINT branch_sectors_pkey PRIMARY KEY (id);

--
-- Name: branches branches_branch_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_branch_code_key UNIQUE (branch_code);

--
-- Name: branches branches_branch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_branch_id_key UNIQUE (branch_id);

--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);
--
-- Name: categories categories_category_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_category_id UNIQUE (category_id);

--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

--
-- Name: containers containers_container_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_container_id_key UNIQUE (container_id);

--
-- Name: containers containers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_pkey PRIMARY KEY (id);

--
-- Name: customer_activity_logs customer_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activity_logs
    ADD CONSTRAINT customer_activity_logs_pkey PRIMARY KEY (id);

--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);

--
-- Name: customer_bill_items customer_bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_bill_items
    ADD CONSTRAINT customer_bill_items_pkey PRIMARY KEY (id);

--
-- Name: customer_bills customer_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_bills
    ADD CONSTRAINT customer_bills_pkey PRIMARY KEY (bill_id);

--
-- Name: customer_container_balances customer_container_balances_customer_id_packaging_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_container_balances
    ADD CONSTRAINT customer_container_balances_customer_id_packaging_type_id_key UNIQUE (customer_id, container_id);

--
-- Name: customer_container_balances customer_container_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_container_balances
    ADD CONSTRAINT customer_container_balances_pkey PRIMARY KEY (id);

--
-- Name: customer_feedback customer_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_pkey PRIMARY KEY (id);
--
-- Name: customer_wallet_transactions customer_wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_wallet_transactions
    ADD CONSTRAINT customer_wallet_transactions_pkey PRIMARY KEY (id);

--
-- Name: customers customers_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_new_pkey PRIMARY KEY (customer_id);

--
-- Name: delivery_dispatch_items delivery_dispatch_items_delivery_run_id_product_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch_items
    ADD CONSTRAINT delivery_dispatch_items_delivery_run_id_product_variant_id_key UNIQUE (delivery_run_id, product_variant_id);

--
-- Name: delivery_dispatch_items delivery_dispatch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch_items
    ADD CONSTRAINT delivery_dispatch_items_pkey PRIMARY KEY (id);

--
-- Name: delivery_leave_requests delivery_leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_leave_requests
    ADD CONSTRAINT delivery_leave_requests_pkey PRIMARY KEY (id);

--
-- Name: delivery_location_logs delivery_location_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_logs
    ADD CONSTRAINT delivery_location_logs_pkey PRIMARY KEY (id);

--
-- Name: delivery_partner_referral_bonuses delivery_partner_referral_bonuses_bonus_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partner_referral_bonuses
    ADD CONSTRAINT delivery_partner_referral_bonuses_bonus_id_key UNIQUE (bonus_id);

--
-- Name: delivery_partner_referral_bonuses delivery_partner_referral_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partner_referral_bonuses
    ADD CONSTRAINT delivery_partner_referral_bonuses_pkey PRIMARY KEY (id);

--
-- Name: delivery_partners delivery_partners_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_new_pkey PRIMARY KEY (delivery_partner_id);

--
-- Name: delivery_run_addresses delivery_run_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_addresses
    ADD CONSTRAINT delivery_run_addresses_pkey PRIMARY KEY (id);

--
-- Name: delivery_runs delivery_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_pkey PRIMARY KEY (id);

--
-- Name: device_information device_information_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_information
    ADD CONSTRAINT device_information_pkey PRIMARY KEY (device_id);

--
-- Name: device_sessions device_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_pkey PRIMARY KEY (id);

--
-- Name: device_sessions device_sessions_refresh_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_refresh_jti_key UNIQUE (refresh_jti);
--
-- Name: order_batch_items order_batch_items_batch_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_batch_items
    ADD CONSTRAINT order_batch_items_batch_id_variant_id_key UNIQUE (batch_id, variant_id);

--
-- Name: order_batch_items order_batch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_batch_items
    ADD CONSTRAINT order_batch_items_pkey PRIMARY KEY (id);

--
-- Name: order_batches order_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_batches
    ADD CONSTRAINT order_batches_pkey PRIMARY KEY (batch_id);
--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);

--
-- Name: order_status_logs order_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_logs
    ADD CONSTRAINT order_status_logs_pkey PRIMARY KEY (id);

--
-- Name: orders orders_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_id_key UNIQUE (order_id);

--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);

--
-- Name: product_banner product_banner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_banner
    ADD CONSTRAINT product_banner_pkey PRIMARY KEY (id);

--
-- Name: product_batches product_batches_batch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_batch_id_key UNIQUE (batch_id);

--
-- Name: product_batches product_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);

--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);

--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);

--
-- Name: product_variants product_variants_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_variant_id_key UNIQUE (variant_id);

--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

--
-- Name: products products_product_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_product_id UNIQUE (product_id);

--
-- Name: purchase_entries purchase_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_entries
    ADD CONSTRAINT purchase_entries_pkey PRIMARY KEY (id);

--
-- Name: purchase_entries purchase_entries_purchase_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_entries
    ADD CONSTRAINT purchase_entries_purchase_number_key UNIQUE (purchase_number);

--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);

--
-- Name: referrals referrals_refer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_refer_id_key UNIQUE (refer_id);

--
-- Name: referrals referrals_referrer_customer_id_referred_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_customer_id_referred_customer_id_key UNIQUE (referrer_customer_id, referred_customer_id);

--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);

--
-- Name: refunds refunds_refund_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_refund_number_key UNIQUE (refund_number);

--
-- Name: role_assignments role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT role_assignments_pkey PRIMARY KEY (id);

--
-- Name: stock_balances stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_pkey PRIMARY KEY (id);

--
-- Name: stock_balances stock_balances_warehouse_id_product_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_warehouse_id_product_variant_id_key UNIQUE (warehouse_id, product_variant_id);

--
-- Name: stock_movements stock_movements_movement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_movement_id_key UNIQUE (movement_id);

--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);

--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);

--
-- Name: stock_transfers stock_transfers_transfer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_transfer_id_key UNIQUE (transfer_id);

--
-- Name: subscription_custom_schedule subscription_custom_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_custom_schedule
    ADD CONSTRAINT subscription_custom_dates_pkey PRIMARY KEY (id);

--
-- Name: subscription_items subscription_items_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_pkey1 PRIMARY KEY (id);

--
-- Name: subscription_logs subscription_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_logs
    ADD CONSTRAINT subscription_logs_pkey PRIMARY KEY (id);

--
-- Name: subscription_pauses subscription_pauses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pauses
    ADD CONSTRAINT subscription_pauses_pkey PRIMARY KEY (id);

--
-- Name: subscription_refunds subscription_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_refunds
    ADD CONSTRAINT subscription_refunds_pkey PRIMARY KEY (id);

--
-- Name: subscription_renewal_attempts subscription_renewal_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_renewal_attempts
    ADD CONSTRAINT subscription_renewal_attempts_pkey PRIMARY KEY (id);

--
-- Name: subscription_weekly_schedule subscription_weekly_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_weekly_schedule
    ADD CONSTRAINT subscription_weekly_schedule_pkey PRIMARY KEY (id);

--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

--
-- Name: subscriptions subscriptions_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscription_id_key UNIQUE (subscription_id);

--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (ticket_id);

--
-- Name: branch_sectors uq_branch_sector; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_sectors
    ADD CONSTRAINT uq_branch_sector UNIQUE (branch_id, sector_index);

--
-- Name: branches uq_branches_branch_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT uq_branches_branch_id UNIQUE (branch_id);
--
-- Name: delivery_runs uq_delivery_runs_run_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT uq_delivery_runs_run_id UNIQUE (run_id);

--
-- Name: orders uq_orders_order_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT uq_orders_order_id UNIQUE (order_id);

--
-- Name: product_variants uq_product_variants_variant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT uq_product_variants_variant_id UNIQUE (variant_id);

--
-- Name: products uq_products_product_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT uq_products_product_id UNIQUE (product_id);

--
-- Name: orders uq_subscription_delivery; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT uq_subscription_delivery UNIQUE (subscription_id, scheduled_date, delivery_slot);

--
-- Name: subscriptions uq_subscriptions_subscription_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT uq_subscriptions_subscription_id UNIQUE (subscription_id);

--
-- Name: warehouses uq_warehouses_warehouse_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT uq_warehouses_warehouse_id UNIQUE (warehouse_id);

--
-- Name: users users_new_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_new_email_key UNIQUE (email);

--
-- Name: users users_new_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_new_phone_key UNIQUE (phone);

--
-- Name: users users_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_new_pkey PRIMARY KEY (user_id);

--
-- Name: users users_new_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_new_referral_code_key UNIQUE (referral_code);

--
-- Name: users users_new_user_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_new_user_name_key UNIQUE (user_name);

--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);

--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);

--
-- Name: warehouses warehouses_warehouse_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_warehouse_id_key UNIQUE (warehouse_id);

--
-- Name: customer_addresses_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_addresses_address_id ON public.customer_addresses USING btree (address_id);

--
-- Name: idx_api_integrations_config_active_cat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_integrations_config_active_cat ON public.api_integrations_config USING btree (is_active, category);

--
-- Name: idx_api_integrations_config_cat_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_api_integrations_config_cat_key ON public.api_integrations_config USING btree (category, config_key);

--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.admin_audit_logs USING btree (action, created_at DESC);

--
-- Name: idx_audit_logs_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_admin ON public.admin_audit_logs USING btree (admin_id, created_at DESC);

--
-- Name: idx_audit_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_date ON public.admin_audit_logs USING btree (created_at DESC);

--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource ON public.admin_audit_logs USING btree (target_type, target_id);

--
-- Name: idx_auth_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_logs_user_id ON public.auth_logs USING btree (user_id);

--
-- Name: idx_auth_otp_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_otp_lookup ON public.auth_otp_challenges USING btree (contact, purpose, created_at DESC);

--
-- Name: idx_branch_sectors_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_sectors_branch_id ON public.branch_sectors USING btree (branch_id);

--
-- Name: idx_branch_sectors_delivery_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branch_sectors_delivery_partner ON public.branch_sectors USING btree (delivery_partner_id);

--
-- Name: idx_branches_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_active ON public.branches USING btree (is_active);

--
-- Name: idx_branches_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_branch_id ON public.branches USING btree (branch_id);

--
-- Name: idx_branches_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_city ON public.branches USING btree (city);
--
-- Name: idx_carts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carts_user_id ON public.carts USING btree (user_id);

--
-- Name: idx_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_active ON public.categories USING btree (category_id);

--
-- Name: idx_contact_enquiries_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_enquiries_product_id ON public.contact_enquiries USING btree (product_id);

--
-- Name: idx_custom_dates_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_dates_date ON public.subscription_custom_schedule USING btree (delivery_date);

--
-- Name: idx_custom_dates_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_dates_item ON public.subscription_custom_schedule USING btree (subscription_item_id);

--
-- Name: idx_custom_schedule_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_schedule_lookup ON public.subscription_custom_schedule USING btree (subscription_item_id, delivery_date);

--
-- Name: idx_customer_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_activity ON public.customer_activity_logs USING btree (customer_id);

--
-- Name: idx_customer_activity_logs_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_activity_logs_customer_id ON public.customer_activity_logs USING btree (customer_id);

--
-- Name: idx_customer_addresses_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_customer ON public.customer_addresses USING btree (customer_id);

--
-- Name: idx_customer_addresses_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_customer_id ON public.customer_addresses USING btree (customer_id);

--
-- Name: idx_customer_addresses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_user ON public.customer_addresses USING btree (user_id);

--
-- Name: idx_customer_bills_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_bills_customer_id ON public.customer_bills USING btree (customer_id);

--
-- Name: idx_customer_container_balances_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_container_balances_customer_id ON public.customer_container_balances USING btree (customer_id);

--
-- Name: idx_customer_feedback_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_feedback_customer_id ON public.customer_feedback USING btree (customer_id);

--
-- Name: idx_customer_feedback_ref_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_feedback_ref_id ON public.customer_feedback USING btree (reference_id);
--
-- Name: idx_customer_wallet_transactions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_wallet_transactions_customer_id ON public.customer_wallet_transactions USING btree (customer_id);

--
-- Name: idx_customers_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_branch_id ON public.customers USING btree (branch_id);

--
-- Name: idx_delivery_partners_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_partners_branch_id ON public.delivery_partners USING btree (branch_id);

--
-- Name: idx_delivery_partners_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_partners_user_id ON public.delivery_partners USING btree (user_id);

--
-- Name: idx_delivery_runs_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_runs_branch_date ON public.delivery_runs USING btree (branch_id, run_date);

--
-- Name: idx_delivery_runs_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_runs_branch_id ON public.delivery_runs USING btree (branch_id);

--
-- Name: idx_delivery_runs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_runs_date ON public.delivery_runs USING btree (run_date DESC);

--
-- Name: idx_delivery_runs_delivery_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_runs_delivery_partner_id ON public.delivery_runs USING btree (delivery_partner_id);

--
-- Name: idx_delivery_runs_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_delivery_runs_number ON public.delivery_runs USING btree (run_id);

--
-- Name: idx_delivery_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_runs_status ON public.delivery_runs USING btree (status) WHERE ((status)::text <> ALL ((ARRAY['completed'::character varying, 'cancelled'::character varying])::text[]));

--
-- Name: idx_device_info_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_device_info_device_id ON public.device_information USING btree (device_id);

--
-- Name: idx_device_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_user ON public.device_sessions USING btree (user_id, revoked_at, expires_at);
--
-- Name: idx_dispatch_items_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_items_run ON public.delivery_dispatch_items USING btree (delivery_run_id);

--
-- Name: idx_dispatch_items_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_items_variant ON public.delivery_dispatch_items USING btree (product_variant_id);
--
-- Name: idx_dll_user_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dll_user_recorded ON public.delivery_location_logs USING btree (user_id, recorded_at DESC);

--
-- Name: idx_dp_ref_bonus_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dp_ref_bonus_partner ON public.delivery_partner_referral_bonuses USING btree (partner_id);

--
-- Name: idx_dp_ref_bonus_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dp_ref_bonus_status ON public.delivery_partner_referral_bonuses USING btree (status);

--
-- Name: idx_feedback_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_customer ON public.customer_feedback USING btree (customer_id);

--
-- Name: idx_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_action ON public.subscription_logs USING btree (action);

--
-- Name: idx_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_created ON public.subscription_logs USING btree (created_at);

--
-- Name: idx_logs_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_sub ON public.subscription_logs USING btree (subscription_id);

--
-- Name: idx_order_batch_items_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_batch_items_batch ON public.order_batch_items USING btree (batch_id);

--
-- Name: idx_order_batch_items_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_batch_items_variant ON public.order_batch_items USING btree (variant_id);

--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);

--
-- Name: idx_order_items_product_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_variant_id ON public.order_items USING btree (product_variant_id);

--
-- Name: idx_orders_arriving_notified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_arriving_notified ON public.orders USING btree (delivery_partner_id, scheduled_date, is_arriving_notified) WHERE (is_arriving_notified = false);

--
-- Name: idx_orders_customer_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_date ON public.orders USING btree (customer_id, scheduled_date);

--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);

--
-- Name: idx_orders_partner_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_partner_date ON public.orders USING btree (delivery_partner_id, scheduled_date);

--
-- Name: idx_orders_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_scheduled_date ON public.orders USING btree (scheduled_date);

--
-- Name: idx_orders_scheduled_slot_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_scheduled_slot_status ON public.orders USING btree (scheduled_date, delivery_slot, status);

--
-- Name: idx_pauses_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pauses_dates ON public.subscription_pauses USING btree (start_date, end_date);

--
-- Name: idx_pauses_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pauses_lookup ON public.subscription_pauses USING btree (subscription_id, subscription_item_id, start_date, end_date);

--
-- Name: idx_pauses_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pauses_sub ON public.subscription_pauses USING btree (subscription_id);

--
-- Name: idx_product_variants_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_product_id ON public.product_variants USING btree (product_id);

--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);

--
-- Name: idx_purchase_entries_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_entries_batch ON public.purchase_entries USING btree (batch_number) WHERE (batch_number IS NOT NULL);

--
-- Name: idx_purchase_entries_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_entries_expiry ON public.purchase_entries USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);

--
-- Name: idx_purchase_entries_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_entries_variant ON public.purchase_entries USING btree (variant_id, created_at DESC);

--
-- Name: idx_purchase_entries_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_entries_vendor ON public.purchase_entries USING btree (vendor_id, created_at DESC);

--
-- Name: idx_purchase_entries_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_entries_warehouse ON public.purchase_entries USING btree (warehouse_id, created_at DESC);

--
-- Name: idx_referrals_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_code ON public.referrals USING btree (referral_code);

--
-- Name: idx_referrals_referred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referred ON public.referrals USING btree (referred_customer_id);

--
-- Name: idx_referrals_referred_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referred_user ON public.referrals USING btree (referred_user_id);

--
-- Name: idx_referrals_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_customer_id);

--
-- Name: idx_referrals_referrer_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer_user ON public.referrals USING btree (referrer_user_id);

--
-- Name: idx_referrals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_status ON public.referrals USING btree (status);

--
-- Name: idx_refunds_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_created ON public.refunds USING btree (created_at);

--
-- Name: idx_refunds_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_customer ON public.refunds USING btree (customer_id);

--
-- Name: idx_refunds_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_order ON public.refunds USING btree (order_id);

--
-- Name: idx_refunds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_status ON public.refunds USING btree (status);

--
-- Name: idx_renewal_attempts_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_renewal_attempts_customer ON public.subscription_renewal_attempts USING btree (customer_id);

--
-- Name: idx_renewal_attempts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_renewal_attempts_status ON public.subscription_renewal_attempts USING btree (status);

--
-- Name: idx_renewal_attempts_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_renewal_attempts_sub ON public.subscription_renewal_attempts USING btree (subscription_id);

--
-- Name: idx_role_assignments_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_assignments_role ON public.role_assignments USING btree (role_id);

--
-- Name: idx_role_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_assignments_user ON public.role_assignments USING btree (user_id);

--
-- Name: idx_role_assignments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_assignments_user_id ON public.role_assignments USING btree (user_id);

--
-- Name: idx_run_addresses_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_addresses_order ON public.delivery_run_addresses USING btree (customer_id);

--
-- Name: idx_run_addresses_run_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_addresses_run_seq ON public.delivery_run_addresses USING btree (run_id, sequence_no);

--
-- Name: idx_run_addresses_run_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_addresses_run_status ON public.delivery_run_addresses USING btree (run_id, delivery_status);

--
-- Name: idx_run_addresses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_addresses_status ON public.delivery_run_addresses USING btree (delivery_status) WHERE ((delivery_status)::text <> ALL (ARRAY[('delivered'::character varying)::text, ('failed'::character varying)::text]));

--
-- Name: idx_stock_balances_product_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_balances_product_variant_id ON public.stock_balances USING btree (product_variant_id);

--
-- Name: idx_stock_balances_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_balances_warehouse_id ON public.stock_balances USING btree (warehouse_id);

--
-- Name: idx_stock_movements_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at);

--
-- Name: idx_stock_movements_product_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_product_variant_id ON public.stock_movements USING btree (product_variant_id);

--
-- Name: idx_stock_movements_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_reference ON public.stock_movements USING btree (reference_type, reference_id);

--
-- Name: idx_stock_movements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_type ON public.stock_movements USING btree (movement_type);

--
-- Name: idx_stock_movements_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_variant ON public.stock_movements USING btree (product_variant_id);

--
-- Name: idx_stock_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (warehouse_id);

--
-- Name: idx_stock_transfer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfer_created ON public.stock_transfers USING btree (created_at);

--
-- Name: idx_stock_transfer_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfer_from ON public.stock_transfers USING btree (from_warehouse_id);

--
-- Name: idx_stock_transfer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfer_status ON public.stock_transfers USING btree (transfer_status);

--
-- Name: idx_stock_transfer_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfer_to ON public.stock_transfers USING btree (to_warehouse_id);

--
-- Name: idx_stock_transfer_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfer_variant ON public.stock_transfers USING btree (product_variant_id);

--
-- Name: idx_stock_transfers_product_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfers_product_variant_id ON public.stock_transfers USING btree (product_variant_id);

--
-- Name: idx_subscription_items_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_items_active ON public.subscription_items USING btree (subscription_id, status);

--
-- Name: idx_subscription_items_product_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_items_product_variant_id ON public.subscription_items USING btree (product_variant_id);

--
-- Name: idx_subscription_items_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_items_subscription_id ON public.subscription_items USING btree (subscription_id);

--
-- Name: idx_subscription_pauses_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_pauses_subscription_id ON public.subscription_pauses USING btree (subscription_id);

--
-- Name: idx_subscriptions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions USING btree (customer_id);

--
-- Name: idx_subscriptions_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_dates ON public.subscriptions USING btree (start_date, end_date);

--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);

--
-- Name: idx_support_tickets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_user ON public.support_tickets USING btree (user_id);

--
-- Name: idx_user_devices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_devices_user_id ON public.user_devices USING btree (user_id);

--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);

--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);

--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);

--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);

--
-- Name: idx_wallet_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_customer ON public.customer_wallet_transactions USING btree (customer_id);

--
-- Name: idx_warehouses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_code ON public.warehouses USING btree (code);

--
-- Name: idx_warehouses_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_created_at ON public.warehouses USING btree (created_at);

--
-- Name: idx_warehouses_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_deleted_at ON public.warehouses USING btree (deleted_at);

--
-- Name: idx_warehouses_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_is_active ON public.warehouses USING btree (is_active);

--
-- Name: idx_warehouses_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_warehouse_id ON public.warehouses USING btree (warehouse_id);

--
-- Name: idx_warehouses_warehouse_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_warehouse_type ON public.warehouses USING btree (warehouse_type);

--
-- Name: subscription_custom_dates_subscription_item_id_delivery_dat_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscription_custom_dates_subscription_item_id_delivery_dat_key ON public.subscription_custom_schedule USING btree (subscription_item_id, delivery_date);

--
-- Name: subscription_items_pkey; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscription_items_pkey ON public.subscription_items USING btree (subscription_item_id);

--
-- Name: customer_container_balances customer_container_balances_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_container_balances
    ADD CONSTRAINT customer_container_balances_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.containers(container_id) ON DELETE RESTRICT;
--
-- Name: customers customers_new_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_new_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

--
-- Name: delivery_dispatch_items delivery_dispatch_items_delivery_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch_items
    ADD CONSTRAINT delivery_dispatch_items_delivery_run_id_fkey FOREIGN KEY (delivery_run_id) REFERENCES public.delivery_runs(run_id) ON DELETE CASCADE;

--
-- Name: delivery_partners delivery_partners_new_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_new_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
--
-- Name: auth_logs fk_auth_logs_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_logs
    ADD CONSTRAINT fk_auth_logs_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
--
-- Name: carts fk_carts_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT fk_carts_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

--
-- Name: contact_enquiries fk_contact_enquiries_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_enquiries
    ADD CONSTRAINT fk_contact_enquiries_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE CASCADE;

--
-- Name: delivery_runs fk_delivery_runs_branch_id_branches; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT fk_delivery_runs_branch_id_branches FOREIGN KEY (branch_id) REFERENCES public.branches(branch_id) ON DELETE CASCADE;
--
-- Name: order_items fk_order_items_order_id_orders; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_order_id_orders FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;

--
-- Name: order_items fk_order_items_product_variant_id_product_variants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_product_variant_id_product_variants FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(variant_id) ON DELETE CASCADE;

--
-- Name: product_variants fk_product_variants_product_id_products; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT fk_product_variants_product_id_products FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE CASCADE;

--
-- Name: referrals fk_referrals_referred_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT fk_referrals_referred_user FOREIGN KEY (referred_customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

--
-- Name: referrals fk_referrals_referrer_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT fk_referrals_referrer_user FOREIGN KEY (referrer_customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

--
-- Name: role_assignments fk_role_assignments_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignments
    ADD CONSTRAINT fk_role_assignments_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

--
-- Name: stock_balances fk_stock_balances_product_variant_id_product_variants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT fk_stock_balances_product_variant_id_product_variants FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(variant_id) ON DELETE CASCADE;

--
-- Name: stock_balances fk_stock_balances_warehouse_id_warehouses; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT fk_stock_balances_warehouse_id_warehouses FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(warehouse_id) ON DELETE CASCADE;

--
-- Name: stock_movements fk_stock_movements_product_variant_id_product_variants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_stock_movements_product_variant_id_product_variants FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(variant_id) ON DELETE CASCADE;

--
-- Name: stock_transfers fk_stock_transfers_product_variant_id_product_variants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT fk_stock_transfers_product_variant_id_product_variants FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(variant_id) ON DELETE CASCADE;

--
-- Name: subscription_items fk_subscription_items_product_variant_id_product_variants; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT fk_subscription_items_product_variant_id_product_variants FOREIGN KEY (product_variant_id) REFERENCES public.product_variants(variant_id) ON DELETE CASCADE;

--
-- Name: subscription_items fk_subscription_items_subscription_id_subscriptions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT fk_subscription_items_subscription_id_subscriptions FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(subscription_id) ON DELETE CASCADE;

--
-- Name: subscription_pauses fk_subscription_pauses_subscription_id_subscriptions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pauses
    ADD CONSTRAINT fk_subscription_pauses_subscription_id_subscriptions FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(subscription_id) ON DELETE CASCADE;

--
-- Name: support_tickets fk_support_tickets_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT fk_support_tickets_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

--
-- Name: user_devices fk_user_devices_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT fk_user_devices_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

--
-- Name: order_batch_items order_batch_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_batch_items
    ADD CONSTRAINT order_batch_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.order_batches(batch_id) ON DELETE CASCADE;

--
-- Name: subscriptions subscriptions_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.customer_addresses(address_id);

--
-- PostgreSQL database dump complete
--

\unrestrict g4PpIesoFxrfsJlXehMYbAsNhzMtbOvoDnlbd7K5VdYU5cuYZuwMIxUG5KDnnwC

