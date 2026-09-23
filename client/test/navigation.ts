import { vi } from "vitest";

// Stand-ins for next/navigation. Tests set `nav.search` / `nav.pathname` and read `nav.router` calls.
export const nav = {
  router: { replace: vi.fn(), push: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
  search: new URLSearchParams(),
  pathname: "/",
  reset() {
    Object.values(this.router).forEach((fn) => fn.mockReset());
    this.search = new URLSearchParams();
    this.pathname = "/";
  },
};

export const navigationMock = {
  useRouter: () => nav.router,
  useSearchParams: () => nav.search,
  usePathname: () => nav.pathname,
};
