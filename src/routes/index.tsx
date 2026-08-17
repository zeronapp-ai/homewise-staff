import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell,
  TrendingUp,
  CircleCheckBig,
  Clock3,
  Wallet,
  Receipt,
} from "lucide-react";
import { PhoneShell, Panels } from "@/components/PhoneShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import profilFoto from "@/assets/profil.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Homewise | Kazanç Paneli" },
      {
        name: "description",
        content:
          "Homewise temizlik personeli paneli: gelirinizi, ödenecek komisyonu ve net kalan tutarı tek ekranda görün.",
      },
      { property: "og:title", content: "Homewise | Kazanç Paneli" },
      {
        property: "og:description",
        content: "Gelir, komisyon ve net kazancınızı takip edin.",
      },
    ],
  }),
  component: Dashboard,
});

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  service: string;
  address: string;
  total_price: number | null;
  status: string;
};

type DashboardData = {
  hafta: { gelir: number; komisyon: number; net: number; randevu: number };
  ay: { gelir: number; komisyon: number; net: number; randevu: number };
};

const tl = (n: number) => "₺" + n.toLocaleString("tr-TR");

function Dashboard() {
  const { staff: authStaff, isLoading: authLoading } = useAuth();
  const [donem, setDonem] = useState<"hafta" | "ay" | "genel">("ay");
  const [veri, setVeri] = useState<DashboardData>({
    hafta: { gelir: 0, komisyon: 0, net: 0, randevu: 0 },
    ay: { gelir: 0, komisyon: 0, net: 0, randevu: 0 },
  });
  const [genel, setGenel] = useState({ gelir: 0, komisyon: 0, net: 0, randevu: 0 });
  const [yaklasan, setYaklasan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (authLoading || !authStaff) return;

    const fetchData = async () => {
      try {
        // Fetch appointments for logged-in staff
        const { data: allAppointments, error: appointmentsError } = await supabase
          .from("appointments")
          .select("*")
          .order("appointment_date", { ascending: false });

        if (appointmentsError) throw appointmentsError;

        // Filter by staff_id on client side
        const appointments = (allAppointments || []).filter(a => a.staff_id === authStaff.id);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Haftanın başlangıcını (Pazartesi) hesapla
        const weekStart = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Pazar=0 ise -6, diğerleri +1
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Calculate month data
        const monthAppointments = (appointments || []).filter((a: Appointment) => {
          const appDate = new Date(a.appointment_date);
          return appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
        });

        const monthIncome = monthAppointments.reduce((sum: number, a: Appointment) => sum + (parseFloat(a.total_price as any) || 0), 0);
        const monthCommission = Math.ceil(monthIncome * 0.15);

        // Calculate week data (haftanın başlangıcından sonuna kadar)
        const weekAppointments = (appointments || []).filter((a: Appointment) => {
          const appDate = new Date(a.appointment_date);
          const result = appDate >= weekStart && appDate <= weekEnd;
          console.log("Week filter:", { tarih: a.appointment_date, appDate, weekStart, weekEnd, result });
          return result;
        });

        const weekIncome = weekAppointments.reduce((sum: number, a: Appointment) => sum + (parseFloat(a.total_price as any) || 0), 0);
        const weekCommission = Math.ceil(weekIncome * 0.15);

        // Calculate general (all-time) data - take ALL appointments regardless of status
        const genelIncome = (appointments || []).reduce((sum: number, a: Appointment) => sum + (parseFloat(a.total_price as any) || 0), 0);
        const genelCommission = Math.ceil(genelIncome * 0.15);
        const completedAppointmentsCount = (appointments || []).filter((a: Appointment) => a.status === 'completed' || a.status?.toLowerCase() === 'completed').length;

        setVeri({
          hafta: {
            gelir: weekIncome,
            komisyon: weekCommission,
            net: weekIncome - weekCommission,
            randevu: weekAppointments.length,
          },
          ay: {
            gelir: monthIncome,
            komisyon: monthCommission,
            net: monthIncome - monthCommission,
            randevu: monthAppointments.length,
          },
        });

        // For now, use month data as general (until RLS is fixed)
        setGenel({
          gelir: monthIncome,
          komisyon: monthCommission,
          net: monthIncome - monthCommission,
          randevu: monthAppointments.filter((a: Appointment) => a.status === 'completed' || a.status?.toLowerCase() === 'completed').length,
        });

        // Get upcoming appointments
        const upcomingAppointments = (appointments || [])
          .filter((a: Appointment) => new Date(a.appointment_date) >= now)
          .slice(0, 3);

        setYaklasan(
          upcomingAppointments.map((a: Appointment) => ({
            ad: a.service || 'Hizmet',
            zaman: new Date(a.appointment_date).toLocaleDateString('tr-TR'),
            tutar: a.total_price || 0,
            semt: a.address || 'Adres yok',
          }))
        );
      } catch (error) {
        console.error("Veriler yüklenemedi:", error);
        // Set empty values on error
        setVeri({
          hafta: { gelir: 0, komisyon: 0, net: 0, randevu: 0 },
          ay: { gelir: 0, komisyon: 0, net: 0, randevu: 0 },
        });
        setGenel({ gelir: 0, komisyon: 0, net: 0, randevu: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Fetch unread notifications count
    const fetchUnreadCount = async () => {
      const { data: appointments, error } = await supabase
        .from("appointments")
        .select("id")
        .eq("staff_id", authStaff.id)
        .eq("status", "pending")
        .eq("read_by_staff", false);

      if (!error) {
        setUnreadCount((appointments || []).length);
      }
    };

    fetchUnreadCount();

    // Subscribe to changes
    const subscription = supabase
      .channel("dashboard_notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `staff_id=eq.${authStaff.id}` },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [authStaff, authLoading]);

  if (authLoading || loading) {
    return (
      <PhoneShell>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </PhoneShell>
    );
  }

  const d = donem === "genel"
    ? { gelir: veri.ay.gelir, komisyon: veri.ay.komisyon, net: veri.ay.net, randevu: veri.ay.randevu }
    : veri[donem];
  const etiket = donem === "ay" ? "Bu ay" : donem === "hafta" ? "Bu hafta" : "Genel";
  const personelAdi = authStaff?.name || "Personel";

  return (
    <PhoneShell>
      <header className="flex animate-fade-up items-center justify-between px-5 pb-6 pt-8 lg:px-0 lg:pt-12">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Merhaba,</p>
          <h1 className="truncate text-2xl font-bold leading-tight lg:text-3xl">
            {personelAdi}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/bildirimler"
            aria-label="Bildirimler"
            className="tap relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card hover:text-primary"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 animate-pulse-ring rounded-full border-2 border-card bg-destructive" />
            )}
          </Link>
          <Link to="/profil" aria-label="Profil">
            <img
              src={authStaff?.photo_url || profilFoto}
              alt="Profil fotoğrafı"
              width={640}
              height={640}
              className="tap h-11 w-11 rounded-full object-cover"
            />
          </Link>
        </div>
      </header>

      <div className="animate-fade-up px-5 lg:max-w-sm lg:px-0" style={{ animationDelay: "60ms" }}>
        <div className="flex w-full flex-col gap-2">
          <div className="flex rounded-full bg-surface p-1">
            {(["hafta", "ay"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDonem(k)}
                className={
                  "tap flex-1 rounded-full py-2.5 text-sm font-semibold " +
                  (donem === k
                    ? "bg-primary text-primary-foreground shadow-float"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {k === "hafta" ? "Bu Hafta" : "Bu Ay"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDonem("genel")}
            className={
              "tap w-full rounded-full py-2.5 text-sm font-semibold transition-colors " +
              (donem === "genel"
                ? "bg-primary text-primary-foreground shadow-float"
                : "bg-surface text-muted-foreground hover:text-foreground")
            }
          >
            Genel
          </button>
        </div>
      </div>

      <Panels className="mt-5 lg:mt-8">
        <div className="lg:col-span-7">
          <section className="px-5 lg:px-0">
            <div
              key={donem}
              className="animate-pop rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-float lg:px-8 lg:py-8"
            >
              <p className="text-sm opacity-80">Net Kalan Tutar</p>
              <div className="mt-1 flex items-end justify-between gap-4">
                <p className="text-[34px] font-bold leading-none lg:text-5xl">
                  {tl(d.net)}
                </p>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
                  <TrendingUp className="h-3.5 w-3.5" /> {etiket}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-4 px-5 lg:px-0">
            <div
              key={"g" + donem}
              className="animate-fade-up rounded-2xl bg-card p-4 shadow-card lg:p-6"
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Wallet className="h-4 w-4" />
              </span>
              <p className="text-xs text-muted-foreground">Toplam Gelir</p>
              <p className="mt-1 text-xl font-bold lg:text-2xl">{tl(d.gelir)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {etiket} {d.randevu} randevudan
              </p>
            </div>
            <div
              key={"k" + donem}
              className="animate-fade-up rounded-2xl bg-card p-4 shadow-card lg:p-6"
              style={{ animationDelay: "80ms" }}
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
                <Receipt className="h-4 w-4" />
              </span>
              <p className="text-xs text-muted-foreground">Ödenecek Komisyon</p>
              <p className="mt-1 text-xl font-bold text-destructive lg:text-2xl">
                {tl(d.komisyon)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">İşletmeye ödenecek</p>
            </div>
          </section>

          <div className="mt-4 px-5 lg:px-0">
            <span className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-success-soft px-3 py-2 text-xs font-semibold text-success">
              <CircleCheckBig className="h-4 w-4" />
              {etiket} {d.randevu} randevu tamamladınız
            </span>
          </div>
        </div>

        <section className="mt-7 px-5 lg:col-span-5 lg:mt-0 lg:px-0">
          <div className="lg:rounded-2xl lg:bg-card lg:p-6 lg:shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Yaklaşan Randevular</h2>
              <Link
                to="/randevular"
                className="tap text-xs font-semibold text-primary hover:underline"
              >
                Tümünü gör
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {yaklasan.map((r, i) => (
                <div
                  key={r.ad}
                  className="tap flex animate-fade-up items-center justify-between rounded-2xl bg-card p-4 shadow-card hover:-translate-y-0.5 lg:bg-surface lg:shadow-none"
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Clock3 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{r.ad}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.zaman} · {r.semt}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-success">+{tl(r.tutar)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Panels>
    </PhoneShell>
  );
}
