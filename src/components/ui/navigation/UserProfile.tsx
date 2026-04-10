import { useState, useEffect } from "react"
import { Button } from "@/components/Button"
import { cx, focusRing } from "@/lib/utils"
import { ChevronsUpDown } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { fetchProfile } from "@/lib/supabase-queries"
import { supabase } from "@/integrations/supabase/client"
import { DropdownUserProfile } from "./DropdownUserProfile"

export function UserProfile() {
  const { user } = useAuth()
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

  return (
    <DropdownUserProfile>
      <Button
        aria-label="User settings"
        variant="ghost"
        className={cx(
          "group flex w-full items-center justify-between rounded-md px-1 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200/50 data-[state=open]:bg-gray-200/50 hover:dark:bg-gray-800/50 data-[state=open]:dark:bg-gray-900",
          focusRing,
        )}
      >
        <span className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300" aria-hidden="true">
            {initials}
          </span>
          <span className="truncate">{displayName}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700 group-hover:dark:text-gray-400" aria-hidden="true" />
      </Button>
    </DropdownUserProfile>
  )
}
