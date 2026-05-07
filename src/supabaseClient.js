import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rhfxiczpqrdypyqcknxm.supabase.co";
const supabaseKey = "sb_publishable_MmljhcIJGTgSg83rt0qhjA_RYh31ZMW";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);