import { useEffect, useState } from "react";
import { Share, MoreVertical, Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

declare global {
  interface Window {
    __pwaDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    // Kurulu uygulamada gösterme
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    setPlatform(detectPlatform());

    // Root layout'taki script tarafından yakalanmış olabilir
    if (window.__pwaDeferredPrompt) {
      setDeferred(window.__pwaDeferredPrompt);
      setVisible(true);
      return;
    }

    // Geç gelişler için
    const onReady = () => {
      if (window.__pwaDeferredPrompt) {
        setDeferred(window.__pwaDeferredPrompt);
        setVisible(true);
      }
    };
    window.addEventListener("pwa-install-ready", onReady);

    // Ek dinleyici (backup)
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__pwaDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // 6 saniye sonra olay gelmezse yine de talimat göster
    const timer = setTimeout(() => setVisible(true), 6000);

    return () => {
      window.removeEventListener("pwa-install-ready", onReady);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const close = () => setVisible(false);

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-40 bg-card shadow-card rounded-2xl p-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-80"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Kapat"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="pr-6 text-sm font-semibold text-foreground">
        Uygulamayı ana ekranına ekle
      </p>

      {deferred ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Handyy'i tek dokunuşla açabilirsin.
          </p>
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              window.__pwaDeferredPrompt = null;
              close();
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-105"
          >
            <Download className="h-4 w-4" />
            Yükle
          </button>
        </>
      ) : platform === "ios" ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <Share className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Alttaki Paylaş ikonuna dokun, ardından "Ana Ekrana Ekle"yi seç.
        </p>
      ) : platform === "android" ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <MoreVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Sağ üstteki üç noktaya dokun, ardından "Uygulamayı yükle"yi seç.
        </p>
      ) : (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Adres çubuğunun sağındaki yükleme simgesine tıkla.
        </p>
      )}
    </div>
  );
}
