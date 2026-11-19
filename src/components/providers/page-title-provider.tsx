"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Where the header's back button leads, and the page that said so. */
type BackTarget = { href: string; forPath: string };

type PageTitleContextValue = {
  title: string;
  setTitle: (title: string) => void;
  back: BackTarget | null;
  setBack: (
    next:
      | BackTarget
      | null
      | ((current: BackTarget | null) => BackTarget | null),
  ) => void;
};

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [back, setBack] = useState<BackTarget | null>(null);

  const value = useMemo(
    () => ({ title, setTitle, back, setBack }),
    [title, back],
  );

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

function useHeaderContext(caller: string): PageTitleContextValue {
  const ctx = useContext(PageTitleContext);
  if (!ctx) throw new Error(`${caller} must be used within PageTitleProvider`);
  return ctx;
}

export function usePageTitle(title: string) {
  const { setTitle } = useHeaderContext("usePageTitle");

  useLayoutEffect(() => {
    setTitle(title);
  }, [setTitle, title]);
}

export function useCurrentPageTitle(): string {
  return useHeaderContext("useCurrentPageTitle").title;
}

/**
 * Says where the header's back button leads from this page, for pages whose
 * list is not simply one level up in the address (a leave request goes back
 * to Reception's leave list).
 */
export function useBackTarget(href: string) {
  const { setBack } = useHeaderContext("useBackTarget");
  const pathname = usePathname();

  useLayoutEffect(() => {
    const mine = { href, forPath: pathname };
    setBack(mine);
    return () => setBack((current) => (current === mine ? null : current));
  }, [setBack, href, pathname]);
}

/** The back target the page on screen declared, if it declared one. */
export function useDeclaredBackTarget(): string | null {
  const { back } = useHeaderContext("useDeclaredBackTarget");
  const pathname = usePathname();
  return back && back.forPath === pathname ? back.href : null;
}
