import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, staffTokenAyarla, staffTokenAl } from '@/lib/supabase';

type Staff = {
  id: number;
  name: string;
  phone: string;
  photo_url: string;
  location: string;
  experience: number;
  price: number;
  rating: number;
  completed_jobs: number;
  commission_debt: number;
};

type AuthContextType = {
  staff: Staff | null;
  isAuthenticated: boolean;
  /** Sayfa acilirken kayitli oturum okunuyor mu. Route korumasi bunu kullanmali. */
  isInitializing: boolean;
  /** Giris istegi surerken true. Sadece giris butonunu kilitlemek icin. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  // DIKKAT: Bu iki durum ayri tutulmali. Ikisi tek bir bayrakta birlestirilirse
  // giris denemesi sirasinda korumali layout "Yukleniyor" ekranina gecip Login
  // bilesenini unmount ediyor; boylece setError ile yazilan hata mesaji da
  // bilesen ile birlikte yok oluyor ve kullanici neden giremedigini goremiyor.
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Oturum durumunu kontrol et
  useEffect(() => {
    const checkAuth = () => {
      try {
        const sessionData = sessionStorage.getItem('staff_session');
        if (sessionData) {
          const { staff } = JSON.parse(sessionData);
          // Token olmadan randevu/izin sorgulari RLS'e takilip bos doner; bu
          // durumda oturumu gecerli saymak yerine yeniden giris istiyoruz.
          if (staff && staffTokenAl()) {
            setStaff(staff);
          } else {
            sessionStorage.removeItem('staff_session');
            staffTokenAyarla(null);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (!email || !password) {
        throw new Error("Email ve şifre gereklidir");
      }

      // Şifreyi hash'le
      const passwordHash = await hashPassword(password);

      // DIKKAT: staff_panels'i buradan dogrudan okuyamayiz; RLS SELECT politikasi
      // auth.uid() istiyor ve bu panel Supabase Auth kullanmiyor. Dogrulama
      // staff_login (SECURITY DEFINER) fonksiyonu icinde yapiliyor.
      const { data, error } = await supabase.rpc("staff_login", {
        p_email: email.trim(),
        p_password_hash: passwordHash,
      });

      if (error) {
        throw new Error("Sunucuya ulaşılamadı: " + error.message);
      }

      const sonuc = data as { status: string; token?: string; staff?: Staff } | null;

      if (!sonuc) {
        throw new Error("Sunucudan yanıt alınamadı");
      }

      if (sonuc.status === "not_found") {
        throw new Error("Bu e-posta ile kayıtlı panel bulunamadı");
      }

      if (sonuc.status === "wrong_password") {
        throw new Error("Şifre hatalı");
      }

      if (sonuc.status === "inactive") {
        throw new Error("Bu panel pasifleştirilmiş. Yöneticiyle görüşün.");
      }

      if (sonuc.status === "no_staff") {
        throw new Error("Panele bağlı personel kaydı bulunamadı");
      }

      if (sonuc.status !== "ok" || !sonuc.staff) {
        throw new Error("Giriş başarısız (beklenmeyen yanıt: " + sonuc.status + ")");
      }

      if (!sonuc.token) {
        throw new Error("Oturum anahtarı alınamadı, tekrar deneyin");
      }

      const staffData = sonuc.staff;

      // Once token: bundan sonraki her sorgu bu personelin verisini gorebilsin.
      staffTokenAyarla(sonuc.token);

      setStaff(staffData);
      sessionStorage.setItem('staff_session', JSON.stringify({ staffId: staffData.id, email, staff: staffData }));
    } catch (error: any) {
      throw new Error(error.message || "Giriş başarısız");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const token = staffTokenAl();
    setStaff(null);
    sessionStorage.removeItem('staff_session');
    // Once yerel durumu temizle, sunucudaki oturumu bosuna beklemeden kapat.
    staffTokenAyarla(null);
    if (token) {
      void supabase?.rpc('staff_logout', { p_token: token });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        staff,
        isAuthenticated: !!staff,
        isInitializing,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
