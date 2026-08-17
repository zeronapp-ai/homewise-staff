import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  History,
  Check,
  MapPin,
  CalendarClock,
  BanknoteArrowUp,
  CalendarX2,
  Phone,
  StickyNote,
} from "lucide-react";
import { PhoneShell, ScreenHeader, IconButton, Panels } from "@/components/PhoneShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/randevular")({
  head: () => ({
    meta: [
      { title: "Randevularım | Homewise" },
      {
        name: "description",
        content:
          "Bekleyen ve tamamlanan temizlik randevularınızı görüntüleyin, işleri tamamlandı olarak işaretleyin.",
      },
      { property: "og:title", content: "Randevularım | Homewise" },
      {
        property: "og:description",
        content: "Bekleyen ve tamamlanan randevularınızı yönetin.",
      },
    ],
  }),
  component: Randevular,
});

type Randevu = {
  id: string;
  user_id: string;
  appointment_date: string;
  appointment_time: string;
  service: string;
  address: string;
  status: string;
  total_price: number | null;
  user_phone: string | null;
  notes: string | null;
};

const tl = (n: number | null) => "₺" + (n || 0).toLocaleString("tr-TR");

function Randevular() {
  const router = useRouter();
  const { staff, isLoading: authLoading } = useAuth();
  const [sekme, setSekme] = useState<"bekliyor" | "tamamlandi">("bekliyor");
  const [bekleyen, setBekleyen] = useState<Randevu[]>([]);
  const [biten, setBiten] = useState<Randevu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !staff) return;

    const fetchAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("*")
          .eq("staff_id", staff.id)
          .order("appointment_date", { ascending: false })
          .order("appointment_time", { ascending: false });

        if (error) throw error;

        const appointments = (data || []) as Randevu[];
        const pending = appointments.filter((a) => a.status === "pending" || a.status === null);
        const completed = appointments.filter((a) => a.status === "completed");

        setBekleyen(pending);
        setBiten(completed);
      } catch (error) {
        console.error("Randevular yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [staff, authLoading]);

  const tamamla = async (r: Randevu) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", r.id);

      if (error) throw error;

      setBekleyen((p) => p.filter((x) => x.id !== r.id));
      setBiten((p) => [r, ...p]);
    } catch (error) {
      console.error("Randevu güncellenemedi:", error);
    }
  };

  const liste = sekme === "bekliyor" ? bekleyen : biten;

  if (loading || authLoading) {
    return (
      <PhoneShell>
        <ScreenHeader
          title="Randevularım"
          left={
            <IconButton aria-label="Geri" onClick={() => router.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </IconButton>
          }
        />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <ScreenHeader
        title="Randevularım"
        left={
          <IconButton aria-label="Geri" onClick={() => router.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
        }
        right={
          <IconButton aria-label="Geçmiş">
            <History className="h-5 w-5" />
          </IconButton>
        }
      />

      <div
        className="animate-fade-up px-5 lg:max-w-sm lg:px-0"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex rounded-full bg-surface p-1">
          {(["bekliyor", "tamamlandi"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSekme(k)}
              className={
                "tap flex-1 rounded-full py-2.5 text-sm font-semibold " +
                (sekme === k
                  ? "bg-primary text-primary-foreground shadow-float"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {k === "bekliyor" ? "Bekliyor" : "Tamamlandı"}
              <span className="ml-1.5 text-xs opacity-70">
                {k === "bekliyor" ? bekleyen.length : biten.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Panels className="mt-5 lg:mt-8">
        <section className="space-y-4 px-5 lg:col-span-12 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:px-0">
          {liste.length === 0 && (
            <div className="animate-pop py-16 text-center lg:col-span-2">
              <CalendarX2 className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {sekme === "bekliyor"
                  ? "Şu an bekleyen randevunuz yok"
                  : "Henüz tamamlanmış randevunuz yok"}
              </p>
            </div>
          )}

          {liste.map((r, i) => {
            const tarih = new Date(r.appointment_date).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            });

            return (
              <article
                key={r.id}
                className="animate-fade-up rounded-2xl bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5 lg:p-6"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold">{r.service}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      {tarih} · {r.appointment_time}
                    </p>
                  </div>
                  {sekme === "tamamlandi" ? (
                    <span className="flex h-8 w-8 shrink-0 animate-pop items-center justify-center rounded-full bg-success-soft text-success">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                      {tl(r.total_price)}
                    </span>
                  )}
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {r.address}
                </p>

                {r.notes && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {r.notes}
                  </p>
                )}

                {r.user_phone ? (
                  <a
                    href={`tel:${r.user_phone.replace(/\s/g, "")}`}
                    className="tap mt-3 flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-sm font-bold text-primary hover:brightness-95"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    {r.user_phone}
                    <span className="ml-auto text-[11px] font-semibold opacity-70">
                      Aramak için dokun
                    </span>
                  </a>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    Telefon numarası kayıtlı değil
                  </p>
                )}

                {sekme === "bekliyor" ? (
                  (() => {
                    const appointmentDate = new Date(r.appointment_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    appointmentDate.setHours(0, 0, 0, 0);
                    const canComplete = today >= appointmentDate;

                    return (
                      <button
                        type="button"
                        onClick={() => tamamla(r)}
                        disabled={!canComplete}
                        className={`tap mt-4 w-full rounded-xl py-3 text-sm font-bold transition-opacity ${
                          canComplete
                            ? "bg-success text-success-foreground hover:brightness-105"
                            : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                        }`}
                      >
                        {canComplete ? "Tamamlandı Olarak İşaretle" : "Randevu tarihi gelmedi"}
                      </button>
                    );
                  })()
                ) : (
                  <p className="mt-4 flex items-center gap-1.5 text-sm font-bold text-success">
                    <BanknoteArrowUp className="h-4 w-4" /> Kazanç: {tl(r.total_price)}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      </Panels>
    </PhoneShell>
  );
}
