// Fix type errors in queries
import { supabase } from "@/integrations/supabase/client"

export async function fetchSubscriptions(userId: string) {
  const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", userId).order("next_billing_date", { ascending: true })
  if (error) throw error
  // Hide cancelled subscriptions older than 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  return (data || []).filter((sub: any) => {
    if (sub.status !== "cancelled") return true
    // Keep cancelled subs for 1 day so user can see them
    return sub.cancelled_at && sub.cancelled_at > oneDayAgo
  })
}

export async function fetchSubscriptionById(id: string) {
  const { data, error } = await supabase.from("subscriptions").select("*").eq("id", id).single()
  if (error) throw error
  return data
}

export async function createSubscription(subscription: any) {
  const { data, error } = await supabase.from("subscriptions").insert(subscription).select().single()
  if (error) throw error
  return data
}

export async function updateSubscription(id: string, updates: any) {
  const { data, error } = await supabase.from("subscriptions").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteSubscription(id: string) {
  // Check for linked escrow vaults first
  const { count } = await supabase.from("escrow_vaults").select("*", { count: "exact", head: true }).eq("subscription_id", id)
  if (count && count > 0) {
    throw new Error(`Cannot delete: ${count} escrow vault(s) are linked to this subscription. Remove or unlink them first.`)
  }
  const { error } = await supabase.from("subscriptions").delete().eq("id", id)
  if (error) throw error
}

export async function fetchFolders(userId: string) {
  const { data, error } = await supabase.from("folders").select("*").eq("user_id", userId).order("name")
  if (error) throw error
  return data || []
}

export async function createFolder(folder: any) {
  const { data, error } = await supabase.from("folders").insert(folder).select().single()
  if (error) throw error
  return data
}

export async function updateFolder(id: string, updates: any) {
  const { data, error } = await supabase.from("folders").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteFolder(id: string) {
  const { error } = await supabase.from("folders").delete().eq("id", id)
  if (error) throw error
}

export async function fetchTags(userId: string) {
  const { data, error } = await supabase.from("tags").select("*").eq("user_id", userId).order("name")
  if (error) throw error
  return data || []
}

export async function createTag(tag: any) {
  const { data, error } = await supabase.from("tags").insert(tag).select().single()
  if (error) throw error
  return data
}

export async function updateTag(id: string, updates: any) {
  const { data, error } = await supabase.from("tags").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteTag(id: string) {
  const { error } = await supabase.from("tags").delete().eq("id", id)
  if (error) throw error
}

export async function fetchPaymentMethods(userId: string) {
  const { data, error } = await supabase.from("payment_methods").select("*").eq("user_id", userId).order("name")
  if (error) throw error
  return data || []
}

export async function createPaymentMethod(pm: any) {
  const { data, error } = await supabase.from("payment_methods").insert(pm).select().single()
  if (error) throw error
  return data
}

export async function updatePaymentMethod(id: string, updates: any) {
  const { data, error } = await supabase.from("payment_methods").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deletePaymentMethod(id: string) {
  const { error } = await supabase.from("payment_methods").delete().eq("id", id)
  if (error) throw error
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()
  if (error && error.code !== "PGRST116") throw error
  return data
}

export async function updateProfile(userId: string, updates: any) {
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().single()
  if (error) throw error
  return data
}

export async function fetchSubscriptionTags(subscriptionId: string) {
  const { data, error } = await supabase.from("subscription_tags").select("tag_id").eq("subscription_id", subscriptionId)
  if (error) throw error
  return (data || []).map((t) => t.tag_id)
}

export async function setSubscriptionTags(subscriptionId: string, tagIds: string[]) {
  await supabase.from("subscription_tags").delete().eq("subscription_id", subscriptionId)
  if (tagIds.length > 0) {
    const { error } = await supabase.from("subscription_tags").insert(tagIds.map((tag_id) => ({ subscription_id: subscriptionId, tag_id })))
    if (error) throw error
  }
}

export async function getFolderSubscriptionCount(folderId: string) {
  const { count, error } = await supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("folder_id", folderId)
  if (error) throw error
  return count || 0
}

export async function getTagSubscriptionCount(tagId: string) {
  const { count, error } = await supabase.from("subscription_tags").select("*", { count: "exact", head: true }).eq("tag_id", tagId)
  if (error) throw error
  return count || 0
}

export async function getPaymentMethodSubscriptionCount(pmId: string) {
  const { count, error } = await supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("payment_method_id", pmId)
  if (error) throw error
  return count || 0
}

export async function getVaultCountForSubscription(subscriptionId: string) {
  const { count, error } = await supabase.from("escrow_vaults").select("*", { count: "exact", head: true }).eq("subscription_id", subscriptionId)
  if (error) throw error
  return count || 0
}
