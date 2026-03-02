import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { RiPriceTag3Line, RiAddLine, RiDeleteBinLine } from "@remixicon/react"

interface Tag { id: string; name: string; color: string }

export default function Tags() {
  const { user } = useAuth()
  const [tags, setTags] = useState<Tag[]>([])
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#6B7280")

  useEffect(() => {
    if (!user) return
    supabase.from("tags").select("*").order("name").then(({ data }) => setTags((data as Tag[]) || []))
  }, [user])

  const addTag = async () => {
    if (!newName.trim() || !user) return
    const { data } = await supabase.from("tags").insert({ name: newName, color: newColor, user_id: user.id }).select().single()
    if (data) { setTags((t) => [...t, data as Tag]); setNewName("") }
  }

  const deleteTag = async (id: string) => {
    await supabase.from("tags").delete().eq("id", id)
    setTags((t) => t.filter((x) => x.id !== id))
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
      <div className="mt-6 flex gap-3">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New tag name" className="flex-1" />
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="size-10 cursor-pointer rounded border" />
        <Button onClick={addTag}><RiAddLine className="size-4" /></Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900">
            <div className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="text-sm text-gray-900 dark:text-white">{t.name}</span>
            <button onClick={() => deleteTag(t.id)} className="text-gray-400 hover:text-red-500"><RiDeleteBinLine className="size-3.5" /></button>
          </div>
        ))}
        {tags.length === 0 && <p className="w-full py-8 text-center text-gray-500">No tags yet</p>}
      </div>
    </div>
  )
}
