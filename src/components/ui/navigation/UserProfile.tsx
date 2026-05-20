import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/Button"
import { cx, focusRing } from "@/lib/utils"
import { ChevronsUpDown } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { fetchProfile } from "@/lib/supabase-queries"
import { supabase } from "@/integrations/supabase/client"
import { DropdownUserProfile } from "./DropdownUserProfile"

/** Generate a deterministic pastel background color from a string seed */
function seedColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 60%, 75%)`
}

export function UserProfile() {
  const { user, isGoogleUser } = useAuth()
  const [profileName, setProfileName] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchProfile(user.id).then((p) => {
      if (p?.name) setProfileName(p.name)
    }).catch(() => {})

    const channel = supabase
      .channel("profile_name_watch")
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (payload: any) => {
        if (payload.new?.name !== undefined) setProfileName(payload.new.name || null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const displayName = profileName || user?.email || "User"
  const initials = profileName
    ? profileName.slice(0, 2).toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() || "U")

  // Google users get their avatar; email users get a colored initials circle
  const avatarUrl = isGoogleUser ? user?.user_metadata?.avatar_url : null
  const bgColor = useMemo(() => seedColor(user?.id || "default"), [user?.id])

  return (
    <DropdownUserProfile>
      <Button
        aria-label="User settings"
        variant="ghost"
        className={cx(
          "group flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted data-[state=open]:bg-muted",
          focusRing,
        )}
      >
        <span className="flex items-center gap-2.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-7 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-foreground"
              style={{ backgroundColor: bgColor }}
              aria-hidden="true"
            >
              {initials}
            </span>
          )}
          <span className="truncate text-[13px]">{displayName}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Button>
    </DropdownUserProfile>
  )
}
