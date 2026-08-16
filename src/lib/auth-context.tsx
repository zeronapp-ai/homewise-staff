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
        throw new Error("Email ve şifre gerekli");
      }

      // Şifreyi hash'le
      const passwordHash = await hashPassword(password);

      // Önce Supabase'den verileri çek
      let staffData: any = null;
      try {
        const { data: panel, error: panelError } = await supabase
          .from("staff_panels")
          .select("*")
          .eq("email", email)
          .single();

        if (!panelError && panel) {
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

          if (!staffError && staff) {
            staffData = staff;
          }
        }
      } catch (dbError) {
        console.log("Database error, trying fallback...");
      }

      // Eğer database'den veri çekilemediyse hata fırla
      if (!staffData) {
        throw new Error("Giriş bilgileri yanlış");
      }

      if (!staffData) {
        throw new Error("Giriş bilgileri yanlış");
      }

      setStaff(staffData as Staff);
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
