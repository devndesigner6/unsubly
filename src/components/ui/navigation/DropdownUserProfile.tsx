import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSubMenu,
  DropdownMenuSubMenuContent,
  DropdownMenuSubMenuTrigger,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu"
import { Monitor, Moon, Sun } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useTheme } from "next-themes"
import { usePlan } from "@/hooks/usePlan"
import * as React from "react"

export type DropdownUserProfileProps = {
  children: React.ReactNode
  align?: "center" | "start" | "end"
}

export function DropdownUserProfile({ children, align = "start" }: DropdownUserProfileProps) {
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const { isPro, openCheckout } = usePlan()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="sm:!min-w-[calc(var(--radix-dropdown-menu-trigger-width))]">
        <DropdownMenuLabel className="flex items-center gap-2">
          {user?.email || "User"}
          {isPro && <span className="text-[9px] font-medium text-gold bg-gold/10 px-1.5 py-0.5 rounded-full">PRO</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isPro && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={openCheckout} className="text-gold">
                Upgrade to Pro - ₹349
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuSubMenu>
            <DropdownMenuSubMenuTrigger>Theme</DropdownMenuSubMenuTrigger>
            <DropdownMenuSubMenuContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem aria-label="Switch to Light Mode" value="light" iconType="check">
                  <Sun className="size-4 shrink-0" aria-hidden="true" /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem aria-label="Switch to Dark Mode" value="dark" iconType="check">
                  <Moon className="size-4 shrink-0" aria-hidden="true" /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem aria-label="Switch to System Mode" value="system" iconType="check">
                  <Monitor className="size-4 shrink-0" aria-hidden="true" /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubMenuContent>
          </DropdownMenuSubMenu>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
