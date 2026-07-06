"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Briefcase, MapPin } from "lucide-react";
import type { Location } from "@/lib/data/locations";
import { logout } from "@/app/login/actions";

export function Topbar({
  isGm,
  locations,
  userLocationName,
}: {
  isGm: boolean;
  locations: Location[];
  userLocationName: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocation = searchParams.get("location") ?? "all";

  function onLocationChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("location");
    else params.set("location", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center justify-between px-8 py-4 border-b border-line bg-paper">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-line">
          <Briefcase size={14} className="text-muted" />
          <span className="text-sm font-medium text-ink">
            {isGm ? "General Manager (all locations)" : "Store Manager"}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-line">
          <MapPin size={14} className="text-muted" />
          {isGm ? (
            <select
              value={currentLocation}
              onChange={(e) => onLocationChange(e.target.value)}
              className="text-sm font-medium bg-transparent outline-none pr-1 text-ink"
            >
              <option value="all">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-ink">
              {userLocationName} (locked to this location)
            </span>
          )}
        </div>
      </div>
      <form action={logout}>
        <button className="text-sm font-semibold text-muted hover:text-ink">Sign out</button>
      </form>
    </div>
  );
}
