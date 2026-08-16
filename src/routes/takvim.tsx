import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  TriangleAlert,
  CalendarOff,
} from "lucide-react";
import { PhoneShell, ScreenHeader, IconButton, Panels } from "@/components/PhoneShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/takvim")({
  head: () => ({
    meta: [
      { title: "Takvim | Homewise" },
      {
        name: "description",
        content:
          "Aylık takvimden randevulu günlerinizi görün ve müsait olmadığınız günler için izin işaretleyin.",
      },
      { property: "og:title", content: "Takvim | Homewise" },
      {
        property: "og:description",
        content: "İzin günlerinizi takvimden işaretleyin.",
      },
    ],
  }),
  component: Takvim,
});

const AYLAR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function Takvim() {
  const router = useRouter();
  const { staff, isLoading: authLoading } = useAuth();
  const [ay, setAy] = useState(new Date().getMonth());
  const [yil, setYil] = useState(new Date().getFullYear());
  const [izinler, setIzinler] = useState<string[]>([]);
  const [randevulu, setRandevulu] = useState<number[]>([]);
  const [randevuDetaylari, setRandevuDetaylari] = useState<any[]>([]);
  const [secili, setSecili] = useState<number | null>(null);
  const [toggle, setToggle] = useState(false);
  const [uyari, setUyari] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !staff) return;

    const fetchData = async () => {
      try {
        // İzinleri çek
        const { data: leaves, error: leavesError } = await supabase
          .from("staff_leaves")
          .select("date")
          .eq("staff_id", staff.id)
          .gte("date", `${yil}-${String(ay + 1).padStart(2, "0")}-01`)
          .lt("date", `${yil}-${String(ay + 2).padStart(2, "0")}-01`);

        if (leavesError) console.error("İzinler yüklenemedi:", leavesError);
        const leavesList = (leaves || []).map((l) => l.date);
        setIzinler(leavesList);

        // Randevuları çek
        const { data: appointments, error: appError } = await supabase
          .from("appointments")
          .select("*")
          .eq("staff_id", staff.id)
          .gte("appointment_date", `${yil}-${String(ay + 1).padStart(2, "0")}-01`)
          .lt("appointment_date", `${yil}-${String(ay + 2).padStart(2, "0")}-01`)
          .eq("status", "pending");

        if (appError) console.error("Randevular yüklenemedi:", appError);

        const appointmentsList = (appointments && Array.isArray(appointments) && appointments.length > 0)
          ? appointments
          : (appointments && typeof appointments === 'object'
            ? Object.values(appointments).filter(v => v && typeof v === 'object')
            : []);

        const randevuGunleri = appointmentsList
          .map((a) => parseInt(a.appointment_date.split("-")[2]))
          .filter((v, i, a) => a.indexOf(v) === i);

        setRandevulu(randevuGunleri);
        setRandevuDetaylari(appointmentsList);
      } catch (error) {
        console.error("Takvim verileri yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Realtime subscription
    const subscription = supabase
      .channel("takvim_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_leaves", filter: `staff_id=eq.${staff.id}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `staff_id=eq.${staff.id}` },
        () => fetchData()
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [staff, authLoading, ay, yil]);

  const anahtar = `${yil}-${ay}`;
  const gunSayisi = new Date(yil, ay + 1, 0).getDate();
  const ilkGun = (new Date(yil, ay, 1).getDay() + 6) % 7;
  const ayIzinleri = izinler.filter((x) => x.startsWith(anahtar + "-"));

  const ayDegistir = (yon: number) => {
    let m = ay + yon;
    let y = yil;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setAy(m);
    setYil(y);
    setSecili(null);
    setUyari(false);
  };

  const gunSec = (g: number) => {
    setUyari(false);
    setSecili(g);
    const tarih = `${yil}-${String(ay + 1).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
    // Her gün seçildiğinde, o güne ait randevuları filtrele
    const gunuRandevular = randevuDetaylari.filter((a) => a.appointment_date === tarih && a.status === 'pending');
    // Scroll paneli aşağıya alıp randevuları göster (burada state güncelle)
    // Toggle: sadece izin verme işlemi için, başlangıçta false olsun
    setToggle(false);
  };

  const kaydet = async () => {
    if (secili === null || !staff) return;

    try {
      const tarih = `${yil}-${String(ay + 1).padStart(2, "0")}-${String(secili).padStart(2, "0")}`;

      if (toggle) {
        // İzin ekle
        await supabase.from("staff_leaves").insert({
          staff_id: staff.id,
          date: tarih,
        });
      } else {
        // İzin kaldır
        await supabase.from("staff_leaves").delete().eq("staff_id", staff.id).eq("date", tarih);
      }

      setSecili(null);
    } catch (error) {
      console.error("İzin işlemi başarısız:", error);
    }
  };

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
        title="Takvim"
        left={
          <IconButton aria-label="Geri" onClick={() => router.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
        }
        right={
          <IconButton aria-label="Takvim">
            <CalendarRange className="h-5 w-5" />
          </IconButton>
        }
      />

      <Panels>
        <section className="px-5 lg:col-span-7 lg:px-0">
          <div className="animate-fade-up rounded-2xl bg-card p-5 shadow-card lg:p-8">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Önceki ay"
                onClick={() => ayDegistir(-1)}
                className="tap flex h-9 w-9 items-center justify-center rounded-full bg-surface hover:text-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p key={anahtar} className="animate-pop text-base font-bold lg:text-xl">
                {AYLAR[ay]} {yil}
              </p>
              <button
                type="button"
                aria-label="Sonraki ay"
                onClick={() => ayDegistir(1)}
                className="tap flex h-9 w-9 items-center justify-center rounded-full bg-surface hover:text-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div key={anahtar + "-grid"} className="mt-5 grid grid-cols-7 gap-y-2 text-center lg:gap-y-3">
              {GUNLER.map((g) => (
                <span key={g} className="text-[11px] font-semibold text-muted-foreground">
                  {g}
                </span>
              ))}
              {Array.from({ length: ilkGun }).map((_, i) => (
                <span key={"b" + i} />
              ))}
              {Array.from({ length: gunSayisi }).map((_, i) => {
                const g = i + 1;
                const izinli = izinler.includes(`${anahtar}-${g}`);
                const dolu = randevulu.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => gunSec(g)}
                    style={{ animationDelay: `${i * 8}ms` }}
                    className={
                      "tap relative mx-auto flex h-10 w-10 animate-fade-up flex-col items-center justify-center rounded-xl text-sm font-semibold lg:h-12 lg:w-12 " +
                      (izinli
                        ? "bg-destructive-soft text-destructive"
                        : secili === g
                          ? "bg-primary text-primary-foreground shadow-float"
                          : "text-foreground hover:bg-surface")
                    }
                  >
                    {g}
                    {dolu && (
                      <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-success" />
                    )}
                    {izinli && (
                      <span className="absolute -bottom-0.5 text-[8px] font-bold">
                        İzinli
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 px-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" /> Randevulu gün
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" /> İzinli gün
            </span>
          </div>
        </section>

        <section className="mt-4 px-5 lg:col-span-5 lg:mt-0 lg:px-0">
          {uyari && (
            <div className="flex animate-pop items-start gap-2 rounded-2xl bg-destructive-soft p-4 text-xs font-semibold text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Bu günde randevunuz var, önce iptal edilmesi gerekir.
            </div>
          )}

          {secili !== null ? (
            <div className="mt-4 animate-pop rounded-2xl bg-card p-5 shadow-card lg:mt-0 lg:p-6">
              <p className="text-sm font-bold">
                {secili} {AYLAR[ay]} - Randevular
              </p>

              {(() => {
                const tarih = `${yil}-${String(ay + 1).padStart(2, "0")}-${String(secili).padStart(2, "0")}`;
                const gunuRandevular = randevuDetaylari.filter((a) => a.appointment_date === tarih && a.status === 'pending');

                return (
                  <>
                    {gunuRandevular.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {gunuRandevular.map((r) => (
                          <div key={r.id} className="rounded-xl bg-destructive-soft p-3">
                            <p className="text-sm font-bold text-destructive">{r.service}</p>
                            <p className="mt-1 text-xs text-destructive/80">{r.appointment_time} · {r.address}</p>
                            <p className="mt-1 text-xs font-semibold text-destructive">₺{r.total_price}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-muted-foreground">Bu günde randevunuz yok</p>
                    )}

                    <div className="mt-6 border-t pt-4">
                      <p className="text-sm font-bold mb-3">
                        {gunuRandevular.length > 0 ? "İzin alması yasak (randevu var)" : "Bu gün için izin ver"}
                      </p>
                      {gunuRandevular.length === 0 && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Bu gün için izin ver
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={toggle}
                              aria-label="İzin durumu"
                              onClick={() => setToggle((v) => !v)}
                              className={
                                "relative h-7 w-12 rounded-full transition-colors duration-300 " +
                                (toggle ? "bg-primary" : "bg-border")
                              }
                            >
                              <span
                                className={
                                  "absolute top-1 h-5 w-5 rounded-full bg-card transition-all duration-300 " +
                                  (toggle ? "left-6" : "left-1")
                                }
                              />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={kaydet}
                            className="tap mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:brightness-110"
                          >
                            Kaydet
                          </button>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="mt-4 hidden animate-fade-up rounded-2xl bg-card p-6 shadow-card lg:mt-0 lg:block">
              <h2 className="text-base font-bold">Bu ayın izinleri</h2>
              {ayIzinleri.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarOff className="h-4 w-4" /> Bu ay için izin günü yok.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {ayIzinleri.map((x) => (
                    <li
                      key={x}
                      className="flex animate-slide-in items-center justify-between rounded-xl bg-destructive-soft px-4 py-3 text-sm font-semibold text-destructive"
                    >
                      {x.split("-")[2]} {AYLAR[ay]} {yil}
                      <span className="text-xs">İzinli</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Bir güne tıklayarak izin ekleyebilir veya kaldırabilirsiniz.
              </p>
            </div>
          )}
        </section>
      </Panels>
    </PhoneShell>
  );
}
