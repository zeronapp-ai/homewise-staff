'use server';

import { supabase } from "@/lib/supabase";

export async function loginStaff(email: string, password: string) {
  try {
    if (!email || !password) {
      throw new Error("Email ve şifre gerekli");
    }

    // Şifreyi hash'le
    const passwordHash = await hashPassword(password);

    // Panel bilgilerini veritabanından çek
    const { data: panel, error: panelError } = await supabase
      .from("staff_panels")
      .select("*")
      .eq("email", email)
      .single();

    if (panelError || !panel) {
      throw new Error("Giriş bilgileri yanlış");
    }

    // Şifreyi kontrol et
    if (panel.password_hash !== passwordHash) {
      throw new Error("Giriş bilgileri yanlış");
    }

    // Panel aktif mi kontrol et
    if (!panel.is_active) {
      throw new Error("Bu panel pasifleştirilmiştir");
    }

    // Personel verilerini çek
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("id", panel.staff_id)
      .single();

    if (staffError || !staff) {
      throw new Error("Personel verisi bulunamadı");
    }

    return {
      staff,
      staffId: staff.id,
      success: true,
    };
  } catch (error: any) {
    throw new Error(error.message || "Giriş başarısız");
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
