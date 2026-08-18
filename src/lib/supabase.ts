import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const TOKEN_ANAHTARI = "staff_token";

// DIKKAT: Panel Supabase Auth kullanmiyor, bu yuzden RLS politikalari auth.uid()
// ile calisamaz. Girişte alinan oturum token'i her istekte x-staff-token
// basligiyla gidiyor; politikalar personeli bu baslikten cozuyor. Baslik yoksa
// appointments/staff_leaves sorgulari sessizce 0 satir doner.
function istemciOlustur(token?: string | null) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    return createClient(
      supabaseUrl,
      supabaseAnonKey,
      token ? { global: { headers: { "x-staff-token": token } } } : undefined
    );
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    return null;
  }
}

function kayitliTokenOku(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(TOKEN_ANAHTARI);
  } catch {
    return null;
  }
}

// Sayfa yenilendiginde token'i modul yuklenirken geri koyuyoruz; aksi halde
// ilk sorgular baslik olmadan gidip bos sonuc donerdi.
let supabase: any = istemciOlustur(kayitliTokenOku());

export function staffTokenAyarla(token: string | null) {
  if (typeof window !== "undefined") {
    try {
      if (token) sessionStorage.setItem(TOKEN_ANAHTARI, token);
      else sessionStorage.removeItem(TOKEN_ANAHTARI);
    } catch {
      // sessionStorage kapali olabilir; istemci yine de token ile kurulur
    }
  }
  supabase = istemciOlustur(token);
}

export function staffTokenAl(): string | null {
  return kayitliTokenOku();
}

export { supabase };
