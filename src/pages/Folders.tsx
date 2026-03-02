import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { RiFolderLine, RiAddLine, RiDeleteBinLine } from "@remixicon/react"

interface Folder { id: string; name: string; color: string }

export default function Folders() {
  const { user } = useAuth()
  const [folders, setFolders] = useState<Folder[]>([])
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#3B82F6")

  useEffect(() => {
    if (!user) return
    supabase.from("folders").select("*").order("name").then(({ data }) => setFolders((data as Folder[]) || []))
  }, [user])

  const addFolder = async () => {
    if (!newName.trim() || !user) return
    const { data } = await supabase.from("folders").insert({ name: newName, color: newColor, user_id: user.id }).select().single()
    if (data) { setFolders((f) => [...f, data as Folder]); setNewName("") }
  }

  const deleteFolder = async (id: string) => {
    await supabase.from("folders").delete().eq("id", id)
    setFolders((f) => f.filter((x) => x.id !== id))
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Folders</h1>
      <div className="mt-6 flex gap-3">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New folder name" className="flex-1" />
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="size-10 cursor-pointer rounded border" />
        <Button onClick={addFolder}><RiAddLine className="size-4" /></Button>
      </div>
      <div className="mt-4 space-y-2">
        {folders.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="size-4 rounded" style={{ backgroundColor: f.color }} />
              <span className="font-medium text-gray-900 dark:text-white">{f.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => deleteFolder(f.id)}><RiDeleteBinLine className="size-4 text-red-500" /></Button>
          </div>
        ))}
        {folders.length === 0 && <p className="py-8 text-center text-gray-500">No folders yet</p>}
      </div>
    </div>
  )
}
