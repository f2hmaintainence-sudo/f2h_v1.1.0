-- Custom mock PL/pgSQL function for h3_latlng_to_cell
-- This avoids dependency on a compiled H3 C extension on databases where it's unavailable.
CREATE OR REPLACE FUNCTION h3_latlng_to_cell(lat numeric, lng numeric, resolution integer)
RETURNS varchar AS $$
BEGIN
  RETURN '88' || SUBSTRING(MD5(CONCAT(lat::text, ',', lng::text, ',', resolution::text)), 1, 13);
END;
$$ LANGUAGE plpgsql;
