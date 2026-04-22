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
import { ArrowUpRight, Monitor, Moon, Sun, Wallet } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { useTheme } from "next-themes"
import { Link } from "react-router-dom"
import * as React from "react"

export type DropdownUserProfileProps = {
  children: React.ReactNode
  align?: "center" | "start" | "end"
}

export function DropdownUserProfile({ children, align = "start" }: DropdownUserProfileProps) {
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const { walletAddress, disconnectWallet } = useAlgorand()

  React.useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="sm:!min-w-[calc(var(--radix-dropdown-menu-trigger-width))]">
        <DropdownMenuLabel>{user?.email || "User"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link to="/settings">
            <DropdownMenuItem>Settings</DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
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
        {walletAddress && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={disconnectWallet}>
                <Wallet className="size-4 shrink-0" aria-hidden="true" />
                Disconnect wallet ({walletAddress.slice(0, 6)}…{walletAddress.slice(-4)})
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
