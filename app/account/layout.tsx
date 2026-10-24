import { Suspense } from "react";
import { AccountNav } from "@/components/account/account-nav";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <Suspense fallback={<div className="h-[33px] border-b border-line" />}>
        <AccountNav />
      </Suspense>
      {children}
    </main>
  );
}
