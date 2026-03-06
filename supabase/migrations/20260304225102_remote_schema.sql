


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."movement_type" AS ENUM (
    'in',
    'out'
);


ALTER TYPE "public"."movement_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'pix',
    'debit_card',
    'credit_card'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."product_unit" AS ENUM (
    'kg',
    'g',
    'lt',
    'und'
);


ALTER TYPE "public"."product_unit" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_store_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  membership_store_id UUID;
BEGIN
  SELECT store_id INTO membership_store_id
  FROM public.store_memberships
  WHERE user_id = (SELECT auth.uid())
  LIMIT 1;

  RETURN membership_store_id;
END;
$$;


ALTER FUNCTION "public"."get_user_store_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_store_id"("uid" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  sid uuid;
BEGIN
  SELECT store_id INTO sid FROM public.users WHERE id = uid;
  RETURN sid;
END;
$$;


ALTER FUNCTION "public"."get_user_store_id"("uid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "stock" numeric(10,3) DEFAULT '0'::smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "store_id" "uuid",
    "deleted_at" timestamp with time zone,
    "unit" "public"."product_unit" DEFAULT 'und'::"public"."product_unit" NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sale_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(10,3) NOT NULL,
    "price_at_sale" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "store_id" "uuid",
    "cost_at_sale" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."sale_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "total" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "store_id" "uuid",
    "payment_method" "public"."payment_method" DEFAULT 'cash'::"public"."payment_method" NOT NULL
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "type" "public"."movement_type" NOT NULL,
    "quantity" numeric(10,3) NOT NULL,
    "unit_cost" numeric(10,4),
    "reason" "text",
    "sale_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "entry_must_have_cost" CHECK ((("type" <> 'in'::"public"."movement_type") OR ("unit_cost" IS NOT NULL))),
    CONSTRAINT "stock_movements_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."store_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_memberships"
    ADD CONSTRAINT "user_store_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_memberships"
    ADD CONSTRAINT "user_store_memberships_user_id_store_id_key" UNIQUE ("user_id", "store_id");



CREATE INDEX "idx_stock_movements_product_id" ON "public"."stock_movements" USING "btree" ("product_id");



CREATE INDEX "idx_stock_movements_sale_id" ON "public"."stock_movements" USING "btree" ("sale_id");



CREATE INDEX "idx_user_store_memberships_store_id" ON "public"."store_memberships" USING "btree" ("store_id");



CREATE INDEX "idx_user_store_memberships_user_id" ON "public"."store_memberships" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."store_memberships"
    ADD CONSTRAINT "user_store_memberships_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete products from their store" ON "public"."products" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can delete sale_items from their store" ON "public"."sale_items" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can delete sales from their store" ON "public"."sales" FOR DELETE USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert products to their store" ON "public"."products" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert sale_items to their store" ON "public"."sale_items" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert sales to their store" ON "public"."sales" FOR INSERT WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can insert stock movements for their store" ON "public"."stock_movements" FOR INSERT WITH CHECK (("store_id" IN ( SELECT "store_memberships"."store_id"
   FROM "public"."store_memberships"
  WHERE ("store_memberships"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can manage their store stock movements" ON "public"."stock_movements" USING (("store_id" IN ( SELECT "store_memberships"."store_id"
   FROM "public"."store_memberships"
  WHERE ("store_memberships"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("store_id" IN ( SELECT "store_memberships"."store_id"
   FROM "public"."store_memberships"
  WHERE ("store_memberships"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can update products from their store" ON "public"."products" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"())) WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can update sale_items from their store" ON "public"."sale_items" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"())) WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can update sales from their store" ON "public"."sales" FOR UPDATE USING (("store_id" = "public"."get_user_store_id"())) WITH CHECK (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view products from their store" ON "public"."products" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view sale_items from their store" ON "public"."sale_items" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view sales from their store" ON "public"."sales" FOR SELECT USING (("store_id" = "public"."get_user_store_id"()));



CREATE POLICY "Users can view their assigned store" ON "public"."stores" FOR SELECT USING (("id" IN ( SELECT "store_memberships"."store_id"
   FROM "public"."store_memberships"
  WHERE ("store_memberships"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can view their own memberships" ON "public"."store_memberships" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sale_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





























































































































































































GRANT ALL ON FUNCTION "public"."get_user_store_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_store_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_store_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_store_id"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_store_id"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_store_id"("uid" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."sale_items" TO "anon";
GRANT ALL ON TABLE "public"."sale_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."store_memberships" TO "anon";
GRANT ALL ON TABLE "public"."store_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."store_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


