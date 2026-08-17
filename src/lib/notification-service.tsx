import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const IKON =
  "https://ik.imagekit.io/uiuf7hq8x/homewisestaff.png?updatedAt=1786916778121";

type Randevu = {
  id: string;
  service: string | null;
  address: string | null;
  appointment_date: string;
  appointment_time: string | null;
  status: string | null;
  read_by_staff: boolean | null;
};

const bildirilenKey = (staffId: number) => `bildirilen_randevular_${staffId}`;
const kurulumKey = (staffId: number) => `bildirim_kurulumu_${staffId}`;

function metinOlustur(r: Randevu) {
  const tarih = new Date(r.appointment_date).toLocaleDateString("tr-TR");
  const saat = r.appointment_time || "Belirtilmemiş";
  return `${r.service || "Hizmet"} · ${tarih} ${saat} · ${r.address || "Adres yok"}`;
}

/**
 * Uygulama boyunca ayakta kalan bildirim servisi. Root'a bağlı olduğu için
 * sayfa değiştirince unmount olmaz; hangi ekranda olursan ol yeni randevu
 * geldiğinde tarayıcı bildirimi düşer.
 */
export function NotificationService() {
  const { staff, isAuthenticated } = useAuth();
  const bildirilenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !staff) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const staffId = staff.id;

    // Daha önce bildirimi gösterilmiş randevuları yükle (refresh'te tekrar etmesin)
    try {
      const kayit = localStorage.getItem(bildirilenKey(staffId));
      bildirilenRef.current = new Set(kayit ? JSON.parse(kayit) : []);
    } catch {
      bildirilenRef.current = new Set();
    }

    const kaydet = () => {
      try {
        localStorage.setItem(
          bildirilenKey(staffId),
          JSON.stringify([...bildirilenRef.current])
        );
      } catch {
        /* localStorage dolu/kapalı olabilir, bildirim yine de gösterildi */
      }
    };

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    let iptal = false;

    const kontrolEt = async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, service, address, appointment_date, appointment_time, status, read_by_staff")
        .eq("staff_id", staffId)
        .order("appointment_date", { ascending: false });

      if (iptal || error || !data) return;

      const okunmayanlar = (data as Randevu[]).filter(
        (r) => !r.read_by_staff && r.status !== "completed" && r.status !== "cancelled"
      );

      // İlk kurulumda mevcut randevuları sessizce işaretle, geçmişi bildirim yağmuruna çevirme
      const ilkKurulum = !localStorage.getItem(kurulumKey(staffId));
      if (ilkKurulum) {
        okunmayanlar.forEach((r) => bildirilenRef.current.add(r.id));
        localStorage.setItem(kurulumKey(staffId), "1");
        kaydet();
        return;
      }

      const yeniler = okunmayanlar.filter((r) => !bildirilenRef.current.has(r.id));
      if (yeniler.length === 0) return;

      yeniler.forEach((r) => {
        if (Notification.permission === "granted") {
          new Notification("Yeni randevu atandı", {
            body: metinOlustur(r),
            icon: IKON,
            badge: IKON,
            tag: r.id,
            requireInteraction: true,
          });
        }
        bildirilenRef.current.add(r.id);
      });
      kaydet();
    };

    kontrolEt();

    // Realtime: yeni randevu anında düşsün
    const kanal = supabase
      .channel(`bildirim_servisi_${staffId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `staff_id=eq.${staffId}`,
        },
        () => kontrolEt()
      )
      .subscribe();

    // Realtime bağlantısı koparsa diye yedek yoklama
    const zamanlayici = window.setInterval(kontrolEt, 30000);

    // Sekmeye geri dönünce de kontrol et
    const gorunurluk = () => {
      if (document.visibilityState === "visible") kontrolEt();
    };
    document.addEventListener("visibilitychange", gorunurluk);

    return () => {
      iptal = true;
      window.clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", gorunurluk);
      kanal.unsubscribe();
    };
  }, [isAuthenticated, staff?.id]);

  return null;
}
