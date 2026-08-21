import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCheck,
  CalendarPlus,
  BadgeCheck,
  Receipt,
  Star,
} from "lucide-react";
import { PhoneShell, ScreenHeader, IconButton, Panels } from "@/components/PhoneShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  pushAboneligiKur,
  iosAnaEkranaEklemeliMi,
  type PushDurumu,
} from "@/lib/notification-service";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({
    meta: [
      { title: "Bildirimler | Handyy" },
      {
        name: "description",
        content:
          "Yeni randevu, komisyon ve müşteri değerlendirme bildirimlerinizi Handyy panelinden takip edin.",
      },
      { property: "og:title", content: "Bildirimler | Handyy" },
      {
        property: "og:description",
        content: "Randevu, ödeme ve değerlendirme bildirimleriniz.",
      },
    ],
  }),
  component: Bildirimler,
});

const ikonlar = {
  randevu: CalendarPlus,
  onay: BadgeCheck,
  komisyon: Receipt,
  puan: Star,
} as const;

type Bildirim = {
  id: number;
  appointment_id: string;
  tip: keyof typeof ikonlar;
  baslik: string;
  metin: string;
  zaman: string;
  okundu: boolean;
};

const baslangic: Bildirim[] = [
  {
    id: 1,
    tip: "randevu",
    baslik: "Yeni randevu atandı",
    metin: "Ayşe Demir · 16 Ağustos, 14:00 · Kadıköy",
    zaman: "5 dk önce",
    okundu: false,
  },
  {
    id: 2,
    tip: "komisyon",
    baslik: "Komisyon ödemesi hatırlatması",
    metin: "Bu ay ödenecek komisyon tutarınız ₺1.860.",
    zaman: "2 saat önce",
    okundu: false,
  },
  {
    id: 3,
    tip: "puan",
    baslik: "Yeni değerlendirme",
    metin: "Selin Öztürk işinizi 5 yıldız ile değerlendirdi.",
    zaman: "Dün",
    okundu: false,
  },
  {
    id: 4,
    tip: "onay",
    baslik: "İzin talebiniz onaylandı",
    metin: "24 Ağustos için izin gününüz onaylandı.",
    zaman: "2 gün önce",
    okundu: true,
  },
];

function Bildirimler() {
  const router = useRouter();
  const { staff, isLoading: authLoading } = useAuth();
  const [liste, setListe] = useState<Bildirim[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [iosKurulumGerek, setIosKurulumGerek] = useState(false);
  const [pushDurum, setPushDurum] = useState<PushDurumu | null>(null);
  const [izinIsteniyor, setIzinIsteniyor] = useState(false);
  const [kapatmaNotu, setKapatmaNotu] = useState(false);
  const okunmamis = liste.filter((b) => !b.okundu).length;

  // Izin durumunu oku. Izin istemeyi NotificationService (root) yonetiyor,
  // burada tekrar istemiyoruz ki iki ayri prompt cakismasin.
  useEffect(() => {
    setIosKurulumGerek(iosAnaEkranaEklemeliMi());

    if (!('Notification' in window)) {
      setPushDurum({ ok: false, sebep: 'Bu tarayıcı bildirim API’sini desteklemiyor' });
      return;
    }

    setNotificationStatus(Notification.permission as any);

    // Bu cihaz push'a gercekten kayitli mi? Telefonda konsol acilamadigi icin
    // sonucu her durumda ekranda gosteriyoruz.
    if (!staff) return;
    if (Notification.permission === 'granted') {
      pushAboneligiKur(staff.id).then(setPushDurum);
    } else {
      setPushDurum({
        ok: false,
        sebep: `Bildirim izni: "${Notification.permission}" — izin verilmeden cihaz kaydedilemez`,
      });
    }
  }, [staff]);

  // Switch acildiginda: once tarayici iznini iste, izin gelirse cihazi push'a
  // abone et. Personel bildirimleri acmayi unutmasin diye switch her zaman
  // ekranda duruyor; kapali oldugu surece de goze carpiyor.
  const bildirimleriAc = async () => {
    if (!('Notification' in window)) {
      setPushDurum({ ok: false, sebep: 'Bu tarayıcı bildirim API’sini desteklemiyor' });
      return;
    }

    setIzinIsteniyor(true);
    try {
      // DIKKAT: Izin daha once "denied" yapildiysa tarayici yeni bir sorma
      // penceresi ACMAZ, aninda "denied" doner. Bu durumda kullaniciyi tarayici
      // ayarlarina yonlendirmek disinda yapabilecegimiz bir sey yok.
      const izin = await Notification.requestPermission();
      setNotificationStatus(izin as any);

      if (izin === 'granted' && staff) {
        // Izin verilir verilmez cihazi push'a abone et, uygulama kapaliyken de bildirim gelsin
        setPushDurum(await pushAboneligiKur(staff.id));
      } else {
        setPushDurum({
          ok: false,
          sebep:
            izin === 'denied'
              ? 'Bildirim izni reddedilmiş — tarayıcı ayarlarından “İzin ver” yapman gerekiyor'
              : `Bildirim izni verilmedi (${izin})`,
        });
      }
    } finally {
      setIzinIsteniyor(false);
    }
  };

  const switchDegistir = () => {
    // Verilmis bir izni koddan geri alamayiz; kapatma yalnizca tarayici
    // ayarlarindan yapilabiliyor, bunu kullaniciya soyluyoruz.
    if (notificationStatus === 'granted') {
      setKapatmaNotu(true);
      return;
    }
    setKapatmaNotu(false);
    void bildirimleriAc();
  };

  useEffect(() => {
    if (authLoading || !staff) return;

    const fetchBildirimler = async () => {
      try {
        // Fetch personelin tüm appointments'ını
        const { data: appointments, error } = await supabase
          .from("appointments")
          .select("*")
          .eq("staff_id", staff.id)
          // Bildirim akisi randevunun ne zaman OLUSTURULDUGUNA gore siralanir;
          // randevu tarihine gore siralamak yeni gelen talebi listenin dibine atiyordu
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Appointments'ı bildirime çevir
        const bildirimler: Bildirim[] = (appointments || []).map((apt, idx) => {
          const tarih = new Date(apt.appointment_date).toLocaleDateString("tr-TR");
          const saat = apt.appointment_time || "Belirtilmemiş";
          const tip = apt.status === "completed" ? "onay" : "randevu";

          return {
            id: idx,
            appointment_id: apt.id,
            tip: tip as keyof typeof ikonlar,
            baslik: tip === "onay" ? "Randevu tamamlandı" : "Yeni randevu atandı",
            metin: `${apt.service} · ${tarih} ${saat} · ${apt.address}`,
            zaman: "Yeni",
            okundu: apt.read_by_staff || apt.status === "completed",
          };
        });

        // Tarayıcı bildirimini NotificationService (root) yönetiyor, burada tekrar gösterme
        setListe(bildirimler);
      } catch (error) {
        console.error("Bildirimler yüklenemedi:", error);
        setListe([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBildirimler();

    // Realtime subscription
    const subscription = supabase
      .channel("appointments_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `staff_id=eq.${staff.id}` },
        () => {
          fetchBildirimler();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [staff, authLoading]);

  if (authLoading || loading) {
    return (
      <PhoneShell>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <ScreenHeader
        title="Bildirimler"
        left={
          <IconButton aria-label="Geri" onClick={() => router.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
        }
        right={
          <IconButton
            aria-label="Tümünü okundu işaretle"
            onClick={async () => {
              try {
                const appointmentIds = liste.map((b) => b.appointment_id);
                if (appointmentIds.length === 0) return;

                await supabase
                  .from("appointments")
                  .update({ read_by_staff: true })
                  .in("id", appointmentIds);

                setListe((p) => p.map((b) => ({ ...b, okundu: true })));
              } catch (error) {
                console.error("Bildirimler işaretle başarısız:", error);
              }
            }}
          >
            <CheckCheck className="h-5 w-5" />
          </IconButton>
        }
      />

      <Panels>
        <div className="px-5 lg:col-span-8 lg:col-start-3 lg:px-0">
          <p className="animate-fade-up text-xs font-semibold text-muted-foreground">
            {okunmamis > 0
              ? `${okunmamis} okunmamış bildirim`
              : "Tüm bildirimleri okudunuz"}
          </p>

          {iosKurulumGerek ? (
            <div className="mt-3 animate-fade-up rounded-xl bg-primary-soft p-4 text-xs text-foreground">
              <p className="font-bold">📲 iPhone'da bildirim almak için</p>
              <p className="mt-1 text-muted-foreground">
                iPhone yalnızca ana ekrana eklenmiş uygulamalara bildirim gönderebilir.
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>Safari'de alttaki <span className="font-semibold">Paylaş</span> düğmesine dokun</li>
                <li><span className="font-semibold">Ana Ekrana Ekle</span>'yi seç</li>
                <li>Uygulamayı <span className="font-semibold">ana ekrandaki simgeden</span> aç</li>
                <li>Bu sayfaya gel ve bildirimlere izin ver</li>
              </ol>
            </div>
          ) : (
            <>
              <div className="mt-3 flex animate-fade-up items-center justify-between gap-4 rounded-xl bg-surface p-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">Bildirimleri aç</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {izinIsteniyor
                      ? 'Cihaz kaydediliyor…'
                      : notificationStatus === 'granted'
                        ? 'Yeni randevu geldiğinde bildirim alırsın'
                        : 'Kapalı — yeni randevuları kaçırabilirsin'}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationStatus === 'granted'}
                  aria-label="Bildirimleri aç"
                  disabled={izinIsteniyor}
                  onClick={switchDegistir}
                  className={
                    'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ' +
                    (notificationStatus === 'granted' ? 'bg-success' : 'bg-border')
                  }
                >
                  <span
                    className={
                      'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ' +
                      (notificationStatus === 'granted' ? 'left-6' : 'left-1')
                    }
                  />
                </button>
              </div>

              {notificationStatus === 'denied' && (
                <div className="mt-3 animate-fade-up rounded-xl bg-destructive-soft p-4 text-xs text-foreground">
                  <p className="font-bold">🔕 Bildirimler engellenmiş</p>
                  <p className="mt-1 text-muted-foreground">
                    Tarayıcı bu site için izni daha önce reddettiğinden switch'i açmak yeni
                    bir izin penceresi açamıyor. Tarayıcı ayarlarından bu site için bildirim
                    iznini “İzin ver” yapman gerekiyor.
                  </p>
                </div>
              )}

              {kapatmaNotu && (
                <div className="mt-3 animate-fade-up rounded-xl bg-primary-soft p-4 text-xs text-foreground">
                  <p className="font-bold">Bildirimler zaten açık</p>
                  <p className="mt-1 text-muted-foreground">
                    Kapatmak için tarayıcı ayarlarından bu sitenin bildirim iznini kaldırman
                    gerekiyor; uygulama verilmiş bir izni kendi başına geri alamıyor.
                  </p>
                </div>
              )}
            </>
          )}

          {pushDurum && (
            <div
              className={
                "mt-3 animate-fade-up rounded-xl p-3 text-[11px] " +
                (pushDurum.ok
                  ? "bg-success-soft text-success"
                  : "bg-destructive-soft text-destructive")
              }
            >
              {pushDurum.ok ? (
                <p className="font-semibold">
                  📱 Bu cihaz kayıtlı — uygulama kapalıyken de bildirim gelir
                </p>
              ) : (
                <>
                  <p className="font-semibold">
                    ⚠️ Uygulama kapalıyken bildirim gelmez
                  </p>
                  <p className="mt-1 opacity-90">{pushDurum.sebep}</p>
                </>
              )}
            </div>
          )}

          <div className="mt-4 space-y-3">
            {liste.map((b, i) => {
              const Icon = ikonlar[b.tip];
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={async () => {
                    try {
                      await supabase
                        .from("appointments")
                        .update({ read_by_staff: true })
                        .eq("id", b.appointment_id);

                      setListe((p) =>
                        p.map((x) => (x.id === b.id ? { ...x, okundu: true } : x)),
                      );
                    } catch (error) {
                      console.error("Bildirim işaretle başarısız:", error);
                    }
                  }}
                  className="tap flex w-full animate-fade-up items-start gap-3 rounded-2xl bg-card p-4 text-left shadow-card hover:-translate-y-0.5 lg:p-5"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
                      (b.okundu
                        ? "bg-surface text-muted-foreground"
                        : "bg-primary-soft text-primary")
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">{b.baslik}</span>
                      {!b.okundu && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {b.metin}
                    </span>
                    <span className="mt-2 block text-[11px] font-semibold text-muted-foreground">
                      {b.zaman}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Panels>
    </PhoneShell>
  );
}
