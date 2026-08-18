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
      { title: "Randevularım | Handyy" },
      {
        name: "description",
        content:
          "Bekleyen ve tamamlanan temizlik randevularınızı görüntüleyin, işleri tamamlandı olarak işaretleyin.",
      },
      { property: "og:title", content: "Randevularım | Handyy" },
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
  const [bekleyenGoster, setBekleyenGoster] = useState(10);
  const [bitenGoster, setBitenGoster] = useState(10);

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

  const fullListe = sekme === "bekliyor" ? bekleyen : biten;
  const gosterilecekSayisi = sekme === "bekliyor" ? bekleyenGoster : bitenGoster;
  const liste = fullListe.slice(0, gosterilecekSayisi);
  const dahahaVarMi = fullListe.length > gosterilecekSayisi;

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
              onClick={() => {
                setSekme(k);
                setBekleyenGoster(10);
                setBitenGoster(10);
              }}
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

      <Panels className="mt-4 lg:mt-8">
        <section className="space-y-2 px-4 lg:col-span-12 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:px-0">
          {liste.length === 0 && (
            <div className="animate-pop py-12 text-center lg:col-span-2">
              <CalendarX2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">
                {sekme === "bekliyor"
                  ? "Şu an bekleyen randevunuz yok"
                  : "Henüz tamamlanmış randevunuz yok"}
              </p>
            </div>
          )}

          {liste.map((r, i) => {
            const tarih = new Date(r.appointment_date).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });

            return (
              <article
                key={r.id}
                className="animate-fade-up rounded-lg bg-card p-3 shadow-card transition-transform hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-xs font-bold">{r.service}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      {tarih} {r.appointment_time}
                    </p>
                  </div>
                  {sekme === "tamamlandi" ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                      {tl(r.total_price)}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-tight text-muted-foreground">
                  <MapPin className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                  <span className="line-clamp-2">{r.address}</span>
                </p>

                {r.notes && (
                  <p className="mt-1 flex items-start gap-1 text-[10px] leading-tight text-muted-foreground">
                    <StickyNote className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                    <span className="line-clamp-1">{r.notes}</span>
                  </p>
                )}

                {r.user_phone && (
                  <a
                    href={`tel:${r.user_phone.replace(/\s/g, "")}`}
                    className="tap mt-1.5 flex items-center gap-1.5 rounded-lg bg-primary-soft px-2 py-1.5 text-[10px] font-bold text-primary hover:brightness-95"
                  >
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="flex-1 truncate">{r.user_phone}</span>
                  </a>
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
                        className={`tap mt-2 w-full rounded-lg py-2 text-[11px] font-bold transition-opacity ${
                          canComplete
                            ? "bg-success text-success-foreground hover:brightness-105"
                            : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                        }`}
                      >
                        {canComplete ? "Tamamlandı" : "Tarihi gelmedi"}
                      </button>
                    );
                  })()
                ) : (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-success">
                    <BanknoteArrowUp className="h-3 w-3" /> {tl(r.total_price)}
                  </p>
                )}
              </article>
            );
          })}

          {dahahaVarMi && (
            <button
              onClick={() => {
                if (sekme === "bekliyor") {
                  setBekleyenGoster((p) => p + 10);
                } else {
                  setBitenGoster((p) => p + 10);
                }
              }}
              className="tap col-span-full rounded-lg bg-primary-soft py-2 text-center text-xs font-bold text-primary hover:brightness-95 lg:col-span-2"
            >
              Daha Fazla Göre ({fullListe.length - gosterilecekSayisi} kalan)
            </button>
          )}
        </section>
      </Panels>
    </PhoneShell>
  );
}
