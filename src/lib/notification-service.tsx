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

const VAPID_PUBLIC_KEY = import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string | undefined;

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(base64);
  const cikti = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) cikti[i] = ham.charCodeAt(i);
  return cikti;
}

function bufferToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let ikili = "";
  for (const bayt of bytes) ikili += String.fromCharCode(bayt);
  return btoa(ikili).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Cihazi Web Push'a abone eder ve aboneligi veritabanina yazar. Bu sayede
 * uygulama tamamen kapaliyken bile sunucu bildirim gonderebilir.
 */
export async function pushAboneligiKur(staffId: number) {
  if (!VAPID_PUBLIC_KEY) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const kayit = await navigator.serviceWorker.ready;
    const abonelik =
      (await kayit.pushManager.getSubscription()) ??
      (await kayit.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const p256dh = bufferToBase64Url(abonelik.getKey("p256dh"));
    const auth = bufferToBase64Url(abonelik.getKey("auth"));
    if (!p256dh || !auth) return;

    await supabase.from("push_subscriptions").upsert(
      {
        staff_id: staffId,
        endpoint: abonelik.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
  } catch (e) {
    console.error("Push aboneligi kurulamadi:", e);
  }
}

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
      Notification.requestPermission().then((izin) => {
        if (izin === "granted") pushAboneligiKur(staffId);
      });
    } else if (Notification.permission === "granted") {
      pushAboneligiKur(staffId);
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
