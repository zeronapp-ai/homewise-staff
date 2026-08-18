import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

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
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Oturum durumunu kontrol et
  useEffect(() => {
    const checkAuth = () => {
      try {
        const sessionData = sessionStorage.getItem('staff_session');
        if (sessionData) {
          const { staff } = JSON.parse(sessionData);
          if (staff) {
            setStaff(staff);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
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

      const sonuc = data as { status: string; staff?: Staff } | null;

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

      const staffData = sonuc.staff;

      setStaff(staffData);
      sessionStorage.setItem('staff_session', JSON.stringify({ staffId: staffData.id, email, staff: staffData }));
    } catch (error: any) {
      throw new Error(error.message || "Giriş başarısız");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setStaff(null);
    sessionStorage.removeItem('staff_session');
  };

  return (
    <AuthContext.Provider
      value={{
        staff,
        isAuthenticated: !!staff,
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
