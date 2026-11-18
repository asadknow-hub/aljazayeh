"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PageTitleContextValue = {
  title: string;
  setTitle: (title: string) => void;
};

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");

  const value = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(title: string) {
  const ctx = useContext(PageTitleContext);
  if (!ctx) {
    throw new Error("usePageTitle must be used within PageTitleProvider");
  }

  useLayoutEffect(() => {
    ctx.setTitle(title);
  }, [ctx, title]);
}

export function useCurrentPageTitle(): string {
  const ctx = useContext(PageTitleContext);
  if (!ctx) {
    throw new Error(
      "useCurrentPageTitle must be used within PageTitleProvider",
    );
  }
  return ctx.title;
}
