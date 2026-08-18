import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const IKON =
  "https://ik.imagekit.io/uiuf7hq8x/Handyystaff.png?updatedAt=1786916778121";

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

/** iPhone / iPad / iPod (masaustu Safari degil) */
export function iosCihazMi() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS kendini Mac gibi tanitir, dokunmatik varsa iPad'dir
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Uygulama ana ekrandan (PWA olarak) mi acilmis? */
export function anaEkrandanMiAcildi() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS'ta Web Push yalnizca uygulama ana ekrana eklenip oradan acildiginda
 * calisir; normal Safari sekmesinde Notification API hic tanimli degildir.
 */
export function iosAnaEkranaEklemeliMi() {
  return iosCihazMi() && !anaEkrandanMiAcildi();
}

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

export type PushDurumu =
  | { ok: true }
  | { ok: false; sebep: string };

/** Service worker kaydi patlarsa hatayi teshis tablosuna yazar. */
export async function swKayitHatasiBildir(hata: unknown) {
  await teshisYaz(null, {
    ok: false,
    sebep: `SW register() hatasi: ${(hata as Error)?.name ?? ""} ${(hata as Error)?.message ?? String(hata)}`,
  });
}

/**
 * Cihazin push kurulumunda nerede takildigini veritabanina yazar. Telefonda
 * konsol acilamadigi icin teshis bilgisi baska turlu disari cikmiyor.
 */
async function teshisYaz(staffId: number | null, durum: PushDurumu) {
  try {
    let swKayitli = false;
    let swHazir = false;
    if ("serviceWorker" in navigator) {
      swKayitli = (await navigator.serviceWorker.getRegistrations()).length > 0;
      swHazir = !!navigator.serviceWorker.controller;
    }

    await supabase.from("push_diagnostics").insert({
      staff_id: staffId,
      izin: "Notification" in window ? Notification.permission : "API yok",
      sw_kayitli: swKayitli,
      sw_hazir: swHazir,
      vapid_var: !!VAPID_PUBLIC_KEY,
      push_destek: "PushManager" in window,
      standalone: anaEkrandanMiAcildi(),
      sonuc: durum.ok ? "basarili" : "basarisiz",
      sebep: durum.ok ? null : durum.sebep,
      user_agent: navigator.userAgent,
    });
  } catch {
    /* teshis yazilamazsa asil akis etkilenmemeli */
  }
}

/**
 * Cihazi Web Push'a abone eder ve aboneligi veritabanina yazar. Bu sayede
 * uygulama tamamen kapaliyken bile sunucu bildirim gonderebilir.
 *
 * Basarisizlik sebebini dondurur: telefonda konsola bakilamadigi icin hata
 * sessiz kalmamali, arayuzde gosterilebilmeli.
 */
/**
 * Aktif bir service worker garanti eder. Kayit yoksa kendisi kaydeder ve
 * aktiflesmesini bekler.
 *
 * navigator.serviceWorker.ready aktif worker yoksa sonsuza kadar bekler ve
 * hata firlatmaz; bu yuzden ona guvenmiyoruz. Kayit sirasinda cikan hata da
 * yutulmamali, cagirana aynen iletilmeli.
 */
async function serviceWorkerHazirla(): Promise<ServiceWorkerRegistration> {
  // register() zaten kayitliysa mevcut kaydi doner. getRegistration'a
  // guvenmiyoruz: uc worker slotu da bos bir kayit donebiliyor.
  const kayit = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  if (kayit.active) return kayit;

  const aktiflesmeyiBekle = new Promise<void>((cozul, reddet) => {
    const dinle = () => {
      const worker = kayit.installing ?? kayit.waiting ?? kayit.active;
      if (!worker) return; // slotlar henuz bos, updatefound'u bekle
      if (worker.state === "activated") return cozul();
      if (worker.state === "redundant") {
        return reddet(new Error("Service worker kurulumu basarisiz oldu (redundant)"));
      }
      worker.addEventListener("statechange", dinle, { once: true });
    };
    kayit.addEventListener("updatefound", dinle);
    dinle();
  });

  await Promise.race([
    aktiflesmeyiBekle,
    // ready, aktif worker olustugu anda cozulur; slotlar bos kaldiginda yedek
    navigator.serviceWorker.ready.then(() => undefined),
    new Promise<never>((_, reddet) =>
      setTimeout(
        () =>
          reddet(
            new Error(
              `Service worker 20 sn icinde aktiflesmedi (active:${!!kayit.active} installing:${!!kayit.installing} waiting:${!!kayit.waiting})`
            )
          ),
        20000
      )
    ),
  ]);

  return kayit;
}

export async function pushAboneligiKur(staffId: number): Promise<PushDurumu> {
  const durum = await pushAboneligiKurIc(staffId);
  await teshisYaz(staffId, durum);
  return durum;
}

async function pushAboneligiKurIc(staffId: number): Promise<PushDurumu> {
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, sebep: "VITE_VAPID_PUBLIC_KEY tanimli degil (Vercel env + yeniden deploy gerekiyor)" };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, sebep: "Bu tarayici Web Push desteklemiyor" };
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return { ok: false, sebep: "Bildirim izni verilmemis" };
  }

  let hazirlamaNotu = "";
  let kayit: ServiceWorkerRegistration | undefined;
  try {
    kayit = await serviceWorkerHazirla();
  } catch (e) {
    // Aktiflesmeyi bekleyemedik; yine de eldeki kayitla abonelik denenmeli.
    // subscribe() aktif worker olmadan da basarili olabiliyor.
    hazirlamaNotu = String((e as Error)?.message ?? e);
    kayit = (await navigator.serviceWorker.getRegistration("/")) ?? undefined;
    if (!kayit) {
      return { ok: false, sebep: `Service worker hazirlanamadi: ${hazirlamaNotu}` };
    }
  }

  try {
    // "AbortError: push service error" cogu zaman gecicidir (FCM'e anlik
    // ulasamama). Birkac kez, araliklari acarak dene.
    let abonelik = await kayit.pushManager.getSubscription();
    let sonHata: unknown = null;

    for (let deneme = 1; !abonelik && deneme <= 3; deneme++) {
      try {
        abonelik = await kayit.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (e) {
        sonHata = e;
        if (deneme < 3) await new Promise((r) => setTimeout(r, deneme * 2000));
      }
    }

    if (!abonelik) {
      const ad = (sonHata as Error)?.name ?? "";
      const mesaj = (sonHata as Error)?.message ?? String(sonHata);
      return { ok: false, sebep: `3 denemede abone olunamadi: ${ad} ${mesaj}`.trim() };
    }

    const p256dh = bufferToBase64Url(abonelik.getKey("p256dh"));
    const auth = bufferToBase64Url(abonelik.getKey("auth"));
    if (!p256dh || !auth) {
      return { ok: false, sebep: "Abonelik anahtarlari okunamadi" };
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
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

    if (error) return { ok: false, sebep: `Veritabanina yazilamadi: ${error.message}` };
    return { ok: true };
  } catch (e) {
    console.error("Push aboneligi kurulamadi:", e);
    const asilHata = `${(e as Error)?.name ?? ""} ${(e as Error)?.message ?? String(e)}`.trim();
    return {
      ok: false,
      sebep: hazirlamaNotu ? `${asilHata} | SW notu: ${hazirlamaNotu}` : asilHata,
    };
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

    if (Notification.permission === "granted") {
      pushAboneligiKur(staffId);
    } else if (Notification.permission === "default" && !iosCihazMi()) {
      // iOS izin istegini yalnizca kullanici dokunusundan kabul eder; otomatik
      // cagirmak izni kalici olarak yakabilir. Orada butona birakiyoruz.
      Notification.requestPermission().then((izin) => {
        if (izin === "granted") pushAboneligiKur(staffId);
        else teshisYaz(staffId, { ok: false, sebep: `izin istendi, sonuc: ${izin}` });
      });
    } else {
      teshisYaz(staffId, {
        ok: false,
        sebep: `izin durumu: ${Notification.permission} (otomatik istenmedi)`,
      });
    }

    let iptal = false;

    const kontrolEt = async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, service, address, appointment_date, appointment_time, status, read_by_staff")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false });

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
