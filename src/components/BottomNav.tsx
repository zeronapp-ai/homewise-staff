import { Link } from "@tanstack/react-router";
import { LayoutGrid, CalendarCheck2, CalendarRange, UserRound, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const items = [
  { to: "/", icon: LayoutGrid, label: "Panel" },
  { to: "/randevular", icon: CalendarCheck2, label: "Randevularım" },
  { to: "/takvim", icon: CalendarRange, label: "Takvim" },
  { to: "/bildirimler", icon: Bell, label: "Bildirimler" },
  { to: "/profil", icon: UserRound, label: "Profil" },
] as const;

export function BottomNav() {
  const { staff } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!staff) return;

    const fetchUnreadCount = async () => {
      const { data: appointments, error } = await supabase
        .from("appointments")
        .select("id, status, read_by_staff")
        .eq("staff_id", staff.id);

      if (error) {
        console.error("Okunmamış bildirim sayısı alınamadı:", error);
        return;
      }

      const unread = (appointments || []).filter((a) => a.status === "pending" && !a.read_by_staff).length;
      setUnreadCount(unread);
    };

    fetchUnreadCount();

    const subscription = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `staff_id=eq.${staff.id}` },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [staff]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] lg:bottom-6 lg:max-w-md lg:px-0">
      <div className="relative animate-fade-up">
        <div className="flex items-center justify-center gap-8 rounded-t-3xl bg-card px-4 pb-6 pt-4 shadow-card lg:rounded-full lg:pb-4">
          {items.map((item, i) => {
            const Icon = item.icon;
            const isBildirimler = item.to === "/bildirimler";
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                className="tap relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-primary [&.active]:bg-primary-soft [&.active]:text-primary"
                activeOptions={{ exact: item.to === "/" }}
              >
                {isBildirimler ? (
                  <Bell className="h-[22px] w-[22px]" strokeWidth={2} />
                ) : (
                  <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                )}
                {isBildirimler && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
