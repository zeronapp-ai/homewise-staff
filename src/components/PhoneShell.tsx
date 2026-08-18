import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

/** Mobilde tek kolon telefon genişliği, geniş ekranlarda ferah panel düzeni. */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto w-full max-w-[430px] pb-32 lg:max-w-6xl lg:px-10 lg:pb-40">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

/** Geniş ekranda çok kolonlu, mobilde tek kolon içerik ızgarası. */
export function Panels({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 " + className}>
      {children}
    </div>
  );
}

export function ScreenHeader({
  title,
  left,
  right,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="flex animate-fade-up items-center justify-between px-5 pb-4 pt-8 lg:px-0 lg:pb-8">
      <div className="flex h-11 w-11 items-center justify-center">{left}</div>
      <h1 className="truncate text-lg font-bold lg:text-2xl">{title}</h1>
      <div className="flex h-11 w-11 items-center justify-center">{right}</div>
    </header>
  );
}

export function IconButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={
        "tap flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-card hover:text-primary " +
        className
      }
    >
      {children}
    </button>
  );
}
