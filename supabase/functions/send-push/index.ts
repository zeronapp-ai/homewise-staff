// Yeni randevu olustugunda ilgili personelin kayitli cihazlarina Web Push gonderir.
// public.appointments uzerindeki trigger tarafindan pg_net ile cagrilir.
//
// Gerekli Edge Function secret'lari:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_HOOK_SECRET
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:zeronapp.ai@gmail.com";
const PUSH_HOOK_SECRET = Deno.env.get("PUSH_HOOK_SECRET") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// setVapidDetails gecersiz/bos anahtarda exception atar; modul yuklenirken degil
// istek aninda ve sadece bir kez calistir.
let vapidHazir = false;
function vapidHazirla() {
  if (vapidHazir) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidHazir = true;
}

const IKON =
  "https://ik.imagekit.io/uiuf7hq8x/Handyystaff.png?updatedAt=1786916778121";

type Randevu = {
  id: string;
  staff_id: number;
  service: string | null;
  address: string | null;
  appointment_date: string;
  appointment_time: string | null;
  status: string | null;
  read_by_staff: boolean | null;
};

function govdeOlustur(r: Randevu) {
  const tarih = new Date(r.appointment_date).toLocaleDateString("tr-TR");
  const saat = r.appointment_time || "Belirtilmemiş";
  return `${r.service || "Hizmet"} · ${tarih} ${saat} · ${r.address || "Adres yok"}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Trigger disindan cagrilamasin
  if (!PUSH_HOOK_SECRET || req.headers.get("x-push-hook-secret") !== PUSH_HOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response("VAPID keys not configured", { status: 500 });
  }

  try {
    vapidHazirla();
  } catch (e) {
    return new Response(`Invalid VAPID keys: ${String(e)}`, { status: 500 });
  }

  let randevu: Randevu;
  try {
    const govde = await req.json();
    randevu = govde.record ?? govde;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!randevu?.staff_id || !randevu?.id) {
    return new Response("Missing staff_id/id", { status: 400 });
  }

  // Iptal/tamamlanmis randevular icin bildirim gonderme
  if (randevu.status === "cancelled" || randevu.status === "completed") {
    return Response.json({ skipped: "status" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: abonelikler, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("staff_id", randevu.staff_id);

  if (error) {
    return new Response(`DB error: ${error.message}`, { status: 500 });
  }
  if (!abonelikler?.length) {
    return Response.json({ sent: 0, reason: "no subscriptions" });
  }

  // Turkce karakterler icin yuku UTF-8 bayt olarak gonder. Duz string
  // verildiginde kutuphane latin-1 varsayabiliyor ve "ı, ş, ğ" bozuluyor.
  const yuk = Buffer.from(
    JSON.stringify({
      title: "Yeni randevu atandı",
      body: govdeOlustur(randevu),
      tag: randevu.id,
      icon: IKON,
      url: "/bildirimler",
    }),
    "utf-8",
  );

  let gonderilen = 0;
  const olenAbonelikler: string[] = [];

  await Promise.all(
    abonelikler.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          yuk,
        );
        gonderilen++;
      } catch (e) {
        const kod = (e as { statusCode?: number })?.statusCode;
        // 404/410 = abonelik artik gecersiz, temizle
        if (kod === 404 || kod === 410) olenAbonelikler.push(a.id);
        else console.error("push failed", kod, String(e));
      }
    }),
  );

  if (olenAbonelikler.length) {
    await supabase.from("push_subscriptions").delete().in("id", olenAbonelikler);
  }

  return Response.json({ sent: gonderilen, removed: olenAbonelikler.length });
});
