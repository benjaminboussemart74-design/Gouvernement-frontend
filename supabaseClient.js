//
// Initialisation du client Supabase côté navigateur.
// Ce fichier exporte une instance prête à l'emploi pour le reste de l'application.
//
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Les constantes ci-dessous sont fournies par l'utilisateur. Dans un contexte réel,
// la clé devrait être stockée côté serveur ou dans des variables d'environnement.
const SUPABASE_URL = "https://yyquczbuhxbfnefwgxxc.supabase.co";
const SUPABASE_KEY = "sb_publishable_fcf6k4PmCc0_RV95yG6NDA_2ole5HUK";

// Export de l'instance Supabase pour un usage dans main.js
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
