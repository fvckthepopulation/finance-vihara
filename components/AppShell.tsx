"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { AuthUser, logout, me } from "@/lib/api";
import { APP_VERSION } from "@/lib/version";
import { BrandLogo } from "./BrandLogo";
import { ViharaSelector } from "./ViharaSelector";

function HamburgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /**
   * Sembunyikan item bila pengguna tidak punya izin ini. Boleh beberapa —
   * artinya "salah satu cukup", dipakai menu Persetujuan yang relevan bagi
   * pemegang izin menyetujui jenis transaksi mana pun.
   */
  permission?: string | string[];
  sub?: boolean; // sub-menu — indented under the item above
  /** Hanya untuk pemegang akses tingkat yayasan (scope global/entity). */
  yayasanOnly?: boolean;
  /** Sembunyikan pada instance mode yayasan tunggal. */
  hideInSingleEntity?: boolean;
};
type NavSection = { title: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: "Pengelolaan Dana",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
        ),
      },
      {
        href: "/dana",
        label: "Penerimaan Dana Umat",
        permission: "penerimaan.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 13s-6-3.5-6-7a4 4 0 0 1 6-3.46A4 4 0 0 1 14 6c0 3.5-6 7-6 7z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Transaksi",
    items: [
      {
        href: "/penerimaan",
        label: "Input Penerimaan",
        permission: "penerimaan.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8h12M8 3l5 5-5 5" />
            <path d="M2 12h6" />
          </svg>
        ),
      },
      {
        href: "/pengeluaran",
        label: "Daftar Pengeluaran",
        permission: "pembayaran.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3h10v10H3z" />
            <path d="M5.5 6.5h5M5.5 9.5h3" />
          </svg>
        ),
      },
      {
        href: "/pembayaran",
        label: "Input Pengeluaran",
        permission: "pembayaran.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 8H2M8 3L3 8l5 5" />
            <path d="M14 12H8" />
          </svg>
        ),
      },
      {
        href: "/persetujuan",
        label: "Persetujuan",
        // Tampil bagi pemegang salah satu izin menyetujui. Halamannya
        // sendiri memeriksa lagi per baris.
        permission: ["pembayaran.approve", "penerimaan.approve"],
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8.5l3.5 3.5L14 4" />
          </svg>
        ),
      },
      {
        href: "/riwayat",
        label: "Semua Transaksi",
        // Dulu menu ini menumpang izin "cash.view" — izin menu Kas & Bank,
        // yang tidak ada hubungannya. Kini punya izin sendiri sehingga bisa
        // diberikan atau dicabut per role di Admin -> Roles.
        permission: "transaksi.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3l2 2" />
          </svg>
        ),
      },
      {
        href: "/cash",
        label: "Kas & Bank",
        permission: "cash.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="4" width="14" height="9" rx="1.5" />
            <path d="M1 7h14" />
          </svg>
        ),
      },
      {
        href: "/petty-cash",
        label: "Kas Kecil",
        permission: "petty_cash.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v6M6 7h3.5a1.5 1.5 0 0 1 0 3H6" />
          </svg>
        ),
      },
      {
        href: "/rekonsiliasi",
        label: "Rekonsiliasi",
        permission: "reconcile.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5h10M3 8h7M3 11h4" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Laporan",
    items: [
      {
        href: "/laporan",
        label: "Laporan Keuangan",
        permission: "reports.pl.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 2h8l2 2v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
            <path d="M5 8h6M5 11h4" />
          </svg>
        ),
      },
      {
        href: "/cetak",
        label: "Laporan Penerimaan Dana",
        permission: "reports.pl.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6V2h8v4M4 12H2V6h12v6h-2" />
            <rect x="4" y="10" width="8" height="4" />
          </svg>
        ),
      },
      {
        href: "/anggaran",
        label: "Anggaran",
        permission: "anggaran.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="3" />
            <circle cx="8" cy="8" r="0.5" fill="currentColor" />
          </svg>
        ),
      },
      {
        href: "/konsolidasi",
        label: "Konsolidasi Yayasan",
        permission: "konsolidasi.view",
        yayasanOnly: true,
        hideInSingleEntity: true,
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v4M8 6L3 10M8 6l5 4" />
            <circle cx="8" cy="2.5" r="1.5" />
            <circle cx="3" cy="12" r="2" />
            <circle cx="13" cy="12" r="2" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        href: "/jurnal",
        label: "Jurnal Manual",
        permission: "journal.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h12v10H2zM5 3v10M2 7h12" />
          </svg>
        ),
      },
      {
        href: "/admin/coa",
        label: "Chart of Accounts",
        permission: "coa.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h12v10H2zM5 3v10M2 7h12M2 11h12" />
          </svg>
        ),
      },
      {
        href: "/admin/pengeluaran",
        label: "Master Pengeluaran",
        permission: "masters.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 2h7l3 3v9H3z" />
            <path d="M5.5 7.5h5M5.5 10h3" />
          </svg>
        ),
      },
      {
        href: "/admin/penerima",
        label: "Master Penerima",
        permission: "masters.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="5.5" r="2.5" />
            <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" />
          </svg>
        ),
      },
      {
        href: "/admin/rekening",
        label: "Master Rekening",
        // Pemegang master boleh melihat katalognya; pengelola rekening
        // (cash.account.manage) memang pemiliknya (FV-30).
        permission: ["masters.view", "cash.account.manage"],
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="12" height="8" rx="1.5" />
            <path d="M2 7h12M4.5 10h3" />
          </svg>
        ),
      },
      {
        href: "/admin/vihara",
        label: "Vihara",
        permission: "masters.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 14h12M3 14V8l5-4 5 4v6M6 14V10h4v4" />
          </svg>
        ),
      },
      {
        href: "/admin/users",
        label: "Users",
        permission: "users.manage",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="6" r="3" />
            <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" />
          </svg>
        ),
      },
      {
        href: "/admin/roles",
        label: "Roles",
        permission: "roles.manage",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1l6 3v4c0 4-3 6-6 7-3-1-6-3-6-7V4l6-3z" />
          </svg>
        ),
      },
      {
        href: "/admin/entities",
        // Istilah "Entitas"/"Entities" tidak dipakai pengguna; di seluruh
        // aplikasi tingkat ini disebut Yayasan (FV-34).
        label: "Yayasan",
        permission: "masters.view",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 14h12M4 14V4l4-2 4 2v10M6.5 7h3M6.5 10h3" />
          </svg>
        ),
      },
    ],
  },
];

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function AppShell({ children, title, subtitle, actions }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    me()
      .then(setUser)
      .catch(() => {
        setAuthError(true);
        router.push("/login");
      });
  }, [router]);

  // Close mobile drawer whenever route changes
  useEffect(() => setMobileOpen(false), [pathname]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (authError) return null;

  const sidebarSections = (
    <>
      {SECTIONS.map((section) => {
            const visibleItems = section.items.filter(
              (item) =>
                (!item.permission ||
                  (Array.isArray(item.permission)
                    ? item.permission.some((p) => user?.permissions.includes(p) ?? false)
                    : (user?.permissions.includes(item.permission) ?? false))) &&
                // Konsolidasi dkk. hanya untuk pemegang akses tingkat
                // yayasan. Catatan: user dengan BEBERAPA vihara tetap bukan
                // level yayasan — dulu cek `vihara_id == null` keliru
                // meloloskan mereka.
                (!item.yayasanOnly || (user?.can_see_yayasan_level ?? false)) &&
                // Instance yayasan tunggal: sembunyikan menu lintas-vihara.
                (!item.hideInSingleEntity || !(user?.app?.single_entity_mode ?? false)),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title} className="mt-3">
                <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-km-ink-muted">
                  {section.title}
                </p>
                {visibleItems.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 py-2 transition ${
                        item.sub ? "pl-9 pr-4 text-[12px]" : "px-4 text-[13px]"
                      } ${
                        active
                          ? "bg-km-accent-soft font-medium text-km-accent-ink"
                          : "text-km-ink-soft hover:bg-km-bg hover:text-km-ink"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 flex-shrink-0 ${
                          active ? "opacity-100" : "opacity-65"
                        }`}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
    </>
  );

  const sidebarBrand = (
    <div className="flex items-center gap-2 border-b border-km-border px-4 pb-4 pt-4 md:pt-0">
      <BrandLogo size={32} />
      <div className="leading-tight">
        <p className="text-[13px] font-medium text-km-ink">Vihara Finance</p>
        <p className="text-[10px] text-km-ink-muted">Modul Keuangan · v{APP_VERSION}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-km-bg p-2 sm:p-4 gap-0">
      <div className="flex w-full overflow-hidden rounded-xl border border-km-border">
        {/* DESKTOP SIDEBAR — tinggi penuh, daftar menu scroll sendiri */}
        <aside className="hidden md:flex md:flex-col w-[200px] flex-shrink-0 border-r border-km-border bg-km-panel pt-4 h-full">
          {sidebarBrand}
          <nav className="flex-1 overflow-y-auto pb-4">{sidebarSections}</nav>
        </aside>

        {/* MOBILE DRAWER */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}
        <aside
          className={`md:hidden fixed top-0 left-0 z-50 flex h-screen w-[240px] flex-col bg-km-panel border-r border-km-border transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-km-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BrandLogo size={32} />
              <div className="leading-tight">
                <p className="text-[13px] font-medium text-km-ink">Vihara Finance</p>
                <p className="text-[10px] text-km-ink-muted">Modul Keuangan · v{APP_VERSION}</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1.5 text-km-ink-muted hover:bg-km-bg hover:text-km-ink"
              aria-label="Tutup menu"
            >
              <CloseIcon />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto pb-4">{sidebarSections}</nav>
        </aside>

        {/* MAIN — konten scroll sendiri; header tetap sticky di atasnya */}
        <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
          {/* TOPBAR */}
          <header className="sticky top-0 z-10 flex h-[60px] items-center justify-between gap-2 border-b border-km-border bg-km-panel px-3 sm:px-5">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex-shrink-0 rounded-md border border-km-border bg-km-panel-soft p-2 text-km-ink-soft hover:bg-km-bg"
              aria-label="Buka menu"
            >
              <HamburgerIcon />
            </button>
            <div className="min-w-0 flex-1">
              {title && (
                <p className="truncate text-[14px] sm:text-[15px] font-medium text-km-ink">
                  {title}
                </p>
              )}
              {subtitle && (
                <p className="truncate text-[11px] sm:text-[12px] text-km-ink-muted">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {actions}
              <ViharaSelector />
              {user && (
                <div className="flex items-center gap-2 border-l border-km-border pl-2 sm:pl-3 ml-1">
                  <div className="hidden sm:block text-right leading-tight">
                    <p className="text-[12px] font-medium text-km-ink">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-km-ink-muted">
                      {user.roles.join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="rounded-md p-1.5 text-km-ink-muted hover:bg-km-bg hover:text-km-ink"
                    title="Keluar"
                    aria-label="Keluar"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10 3h3v10h-3" />
                      <path d="M2 8h8M7 5l3 3-3 3" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* CONTENT */}
          <main className="flex-1 bg-km-bg p-3 sm:p-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
