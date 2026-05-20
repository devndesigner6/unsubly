import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiAddLine, RiFolderLine, RiDeleteBinLine, RiEditLine,
  RiLoader4Line, RiCloseLine, RiCheckLine,
} from "@remixicon/react"
import { toast } from "sonner"
import { AsciiEmpty } from "@/components/micro/AsciiEmpty"
import { motion } from "motion/react"

interface Folder {
  id: string
  name: string
  color: string | null
  created_at: string
}

const COLORS = [
  "hsl(30 10% 10%)", "hsl(0 72% 51%)", "hsl(200 80% 50%)",
  "hsl(150 60% 40%)", "hsl(270 60% 55%)", "hsl(40 90% 50%)",
]

export default function FoldersPage() {
  const { user } = useAuth()
  const [folders, setFolders] = useState<Folder[]>([])
  const [subCounts, setSubCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [hoverFolderId, setHoverFolderId] = useState<string | null>(null)

  async function load() {
    if (!user) return
    const [{ data: folderData }, { data: subsData }] = await Promise.all([
      supabase.from("folders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("folder_id").eq("user_id", user.id).not("folder_id", "is", null),
    ])
    setFolders(folderData || [])
    // Build count map
    const counts: Record<string, number> = {}
    for (const sub of subsData || []) {
      if (sub.folder_id) counts[sub.folder_id] = (counts[sub.folder_id] || 0) + 1
    }
    setSubCounts(counts)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleSave() {
    if (!user || !name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from("folders").update({ name: name.trim(), color }).eq("id", editingId)
        if (error) throw error
        toast.success("Folder updated")
      } else {
        const { error } = await supabase.from("folders").insert({ name: name.trim(), color, user_id: user.id })
        if (error) throw error
        toast.success("Folder created")
      }
      setName(""); setColor(COLORS[0]); setShowForm(false); setEditingId(null)
      load()
    } catch (err: any) {
      toast.error("Failed to save folder", { description: err?.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("folders").delete().eq("id", id)
      if (error) throw error
      toast.success("Folder deleted")
      setDeleteConfirmId(null)
      load()
    } catch (err: any) {
      toast.error("Failed to delete folder", { description: err?.message })
      setDeleteConfirmId(null)
    }
  }

  function startEdit(f: Folder) {
    setEditingId(f.id); setName(f.name); setColor(f.color || COLORS[0]); setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="relative overflow-hidden">
          <span className="ghost-text">FOLDERS</span>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">Folders</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">Organize your subscriptions into folders</p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Button className="w-full sm:w-auto" onClick={() => { setShowForm(true); setEditingId(null); setName(""); setColor(COLORS[0]) }}>
            <RiAddLine className="mr-1.5 size-4" /> New Folder
          </Button>
        </motion.div>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{editingId ? "Edit Folder" : "New Folder"}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted-foreground hover:text-foreground">
              <RiCloseLine className="size-5" />
            </button>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Color:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Select color ${c}`}
                className={`size-6 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <RiCheckLine className="mr-1.5 size-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div
        className="folder-list mt-6 space-y-2"
        data-has-active={hoverFolderId != null || undefined}
        onMouseLeave={() => setHoverFolderId(null)}
      >
        {folders.length === 0 ? (
          <AsciiEmpty
            variant="cabinet"
            title="No folders yet"
            subtitle="Create your first folder to organize subscriptions by purpose, project, or owner."
          />
        ) : (
          folders.map((f) => (
            <div
              key={f.id}
              data-active={hoverFolderId === f.id || undefined}
              onMouseEnter={() => setHoverFolderId(f.id)}
              className="folder-tab flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="size-4 rounded" style={{ backgroundColor: f.color || COLORS[0] }} />
                <div>
                  <span className="font-medium text-foreground">{f.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {subCounts[f.id] ? `${subCounts[f.id]} subscription${subCounts[f.id] !== 1 ? "s" : ""}` : "No subscriptions"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(f)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <RiEditLine className="size-4" />
                </button>
                {deleteConfirmId === f.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(f.id)} className="rounded-lg px-2 py-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20">Delete</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirmId(f.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <RiDeleteBinLine className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </div>
  )
}
