import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiAddLine, RiPriceTag3Line, RiDeleteBinLine, RiEditLine,
  RiLoader4Line, RiCloseLine, RiCheckLine,
} from "@remixicon/react"
import { toast } from "sonner"
import { AsciiEmpty } from "@/components/micro/AsciiEmpty"
import { motion } from "motion/react"

interface Tag {
  id: string
  name: string
  color: string | null
  created_at: string
}

const COLORS = [
  "hsl(30 10% 10%)", "hsl(0 72% 51%)", "hsl(200 80% 50%)",
  "hsl(150 60% 40%)", "hsl(270 60% 55%)", "hsl(40 90% 50%)",
]

export default function TagsPage() {
  const { user } = useAuth()
  const [tags, setTags] = useState<Tag[]>([])
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
      .from("tags")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setTags(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleSave() {
    if (!user || !name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from("tags").update({ name: name.trim(), color }).eq("id", editingId)
        if (error) throw error
        toast.success("Tag updated")
      } else {
        const { error } = await supabase.from("tags").insert({ name: name.trim(), color, user_id: user.id })
        if (error) throw error
        toast.success("Tag created")
      }
      setName(""); setColor(COLORS[0]); setShowForm(false); setEditingId(null)
      load()
    } catch (err: any) {
      toast.error("Failed to save tag", { description: err?.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("tags").delete().eq("id", id)
      if (error) throw error
      toast.success("Tag deleted")
      setDeleteConfirmId(null)
      load()
    } catch (err: any) {
      toast.error("Failed to delete tag", { description: err?.message })
      setDeleteConfirmId(null)
    }
  }

  function startEdit(t: Tag) {
    setEditingId(t.id); setName(t.name); setColor(t.color || COLORS[0]); setShowForm(true)
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
          <span className="ghost-text">TAGS</span>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">Tags</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">Label your subscriptions with tags</p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Button className="w-full sm:w-auto" onClick={() => { setShowForm(true); setEditingId(null); setName(""); setColor(COLORS[0]) }}>
            <RiAddLine className="mr-1.5 size-4" /> New Tag
          </Button>
        </motion.div>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{editingId ? "Edit Tag" : "New Tag"}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted-foreground hover:text-foreground">
              <RiCloseLine className="size-5" />
            </button>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
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

      <div className="mt-6 flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <div className="w-full">
            <AsciiEmpty
              variant="tag"
              title="No tags yet"
              subtitle="Create one to label your subscriptions across folders."
            />
          </div>
        ) : (
          tags.map((t) => (
            <div key={t.id} className="group flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3 pr-1.5 transition-colors hover:bg-muted/50">
              <div className="size-3 rounded-full" style={{ backgroundColor: t.color || COLORS[0] }} />
              <span className="text-sm font-medium text-foreground">{t.name}</span>
              <button onClick={() => startEdit(t)} className="rounded-full p-1 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:text-foreground transition-opacity">
                <RiEditLine className="size-3.5" />
              </button>
              {deleteConfirmId === t.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDelete(t.id)} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/20">Del</button>
                  <button onClick={() => setDeleteConfirmId(null)} className="rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">×</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirmId(t.id)} className="rounded-full p-1 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition-opacity">
                  <RiDeleteBinLine className="size-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    </div>
  )
}
