import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Settings2,
  BellRing,
  LifeBuoy,
  ShieldCheck,
  LogOut,
  Star,
  Phone,
  MapPin,
  BriefcaseBusiness,
} from "lucide-react";
import { PhoneShell, ScreenHeader, IconButton, Panels } from "@/components/PhoneShell";
import { useAuth } from "@/lib/auth-context";
import profilFoto from "@/assets/profil.jpg";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profilim | Homewise" },
      {
        name: "description",
        content:
          "Homewise personel profiliniz: iletişim bilgileri, çalışma bölgesi, tamamlanan iş sayısı ve puanınız.",
      },
      { property: "og:title", content: "Profilim | Homewise" },
      {
        property: "og:description",
        content: "Kişisel bilgileriniz ve hesap ayarlarınız.",
      },
    ],
  }),
  component: Profil,
});

function Profil() {
  const router = useRouter();
  const navigate = useNavigate();
  const { staff, isLoading, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  if (isLoading) {
    return (
      <PhoneShell>
        <ScreenHeader title="Profil" left={<IconButton aria-label="Geri" onClick={() => router.history.back()}><ArrowLeft className="h-5 w-5" /></IconButton>} />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </PhoneShell>
    );
  }

  if (!staff) {
    return (
      <PhoneShell>
        <ScreenHeader title="Profil" left={<IconButton aria-label="Geri" onClick={() => router.history.back()}><ArrowLeft className="h-5 w-5" /></IconButton>} />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Personel bulunamadı</p>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <ScreenHeader
        title="Profil"
        left={
          <IconButton aria-label="Geri" onClick={() => router.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
        }
        right={
          <IconButton aria-label="Ayarlar">
            <Settings2 className="h-5 w-5" />
          </IconButton>
        }
      />

      <Panels>
        <section className="px-5 lg:col-span-5 lg:px-0">
          <div className="flex animate-fade-up flex-col items-center rounded-2xl bg-card p-6 shadow-card lg:p-8">
            <img
              src={staff.photo_url || profilFoto}
              alt={`${staff.name} profil fotoğrafı`}
              width={640}
              height={640}
              className="h-28 w-28 animate-pop rounded-2xl object-cover lg:h-36 lg:w-36"
            />
            <h2 className="mt-4 text-xl font-bold lg:text-2xl">{staff.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {staff.phone}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {staff.location}
            </p>

            <div className="mt-5 grid w-full grid-cols-2 gap-4">
              <div className="rounded-xl bg-surface p-4 text-center">
                <p className="flex items-center justify-center gap-1.5 text-lg font-bold">
                  <BriefcaseBusiness className="h-4 w-4 text-primary" /> {staff.completed_jobs}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Tamamlanan iş</p>
              </div>
              <div className="rounded-xl bg-surface p-4 text-center">
                <p className="flex items-center justify-center gap-1 text-lg font-bold">
                  {typeof staff.rating === 'number' ? staff.rating.toFixed(1) : '0.0'} <Star className="h-4 w-4 fill-warning text-warning" />
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Ortalama puan</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 px-5 lg:col-span-7 lg:mt-0 lg:px-0">
          <div
            className="animate-fade-up divide-y divide-border rounded-2xl bg-card px-5 shadow-card lg:px-6"
            style={{ animationDelay: "80ms" }}
          >
            <Link
              to="/bildirimler"
              className="tap flex w-full items-center justify-between py-4 hover:text-primary"
            >
              <span className="flex items-center gap-3 text-sm font-semibold">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <BellRing className="h-4 w-4" />
                </span>
                Bildirimler
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            {[
              { icon: ShieldCheck, ad: "Hesap Güvenliği" },
              { icon: LifeBuoy, ad: "Yardım / Destek" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.ad}
                  type="button"
                  className="tap flex w-full items-center justify-between py-4 hover:text-primary"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    {s.ad}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="tap mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive py-3.5 text-sm font-bold text-destructive hover:bg-destructive-soft"
          >
            <LogOut className="h-4 w-4" /> Çıkış Yap
          </button>
        </section>
      </Panels>
    </PhoneShell>
  );
}
