import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiAddLine, RiFolderLine, RiDeleteBinLine, RiEditLine,
  RiLoader4Line, RiCloseLine, RiCheckLine,
} from "@remixicon/react"

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
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setFolders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleSave() {
    if (!user || !name.trim()) return
    setSaving(true)
    if (editingId) {
      await supabase.from("folders").update({ name: name.trim(), color }).eq("id", editingId)
    } else {
      await supabase.from("folders").insert({ name: name.trim(), color, user_id: user.id })
    }
    setName(""); setColor(COLORS[0]); setShowForm(false); setEditingId(null); setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from("folders").delete().eq("id", id)
    setDeleteConfirmId(null)
    load()
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
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Folders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organize your subscriptions into folders</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setName(""); setColor(COLORS[0]) }}>
          <RiAddLine className="mr-1.5 size-4" /> New Folder
        </Button>
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
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
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

      <div className="mt-6 space-y-2">
        {folders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <RiFolderLine className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No folders yet. Create one to organize your subscriptions.</p>
          </div>
        ) : (
          folders.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="size-4 rounded" style={{ backgroundColor: f.color || COLORS[0] }} />
                <span className="font-medium text-foreground">{f.name}</span>
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
  )
}
