import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Verify user is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized')

    const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin')
    if (!roleData || roleData.length === 0) throw new Error('শুধুমাত্র অ্যাডমিন এই কাজ করতে পারে')

    const { action, backupData } = await req.json()

    if (action === 'export') {
      // Export all tables
      const tables = ['branches', 'categories', 'customers', 'products', 'product_images', 'product_variants', 'sales', 'sale_items', 'sales_returns', 'sales_return_items', 'stock_movements', 'profiles', 'user_roles']
      const backup: Record<string, any[]> = {}

      for (const table of tables) {
        const { data, error } = await supabaseAdmin.from(table).select('*')
        if (error) {
          console.error(`Error exporting ${table}:`, error.message)
          backup[table] = []
        } else {
          backup[table] = data || []
        }
      }

      return new Response(JSON.stringify({
        success: true,
        backup: {
          version: '1.0',
          exported_at: new Date().toISOString(),
          exported_by: user.email,
          data: backup
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'restore') {
      if (!backupData?.data) throw new Error('ব্যাকআপ ডেটা পাওয়া যায়নি')

      const restoreOrder = [
        'branches', 'categories', 'customers', 'products', 'product_images',
        'product_variants', 'sales', 'sale_items', 'sales_returns',
        'sales_return_items', 'stock_movements'
      ]

      // Clear tables in reverse order to avoid FK issues
      const clearOrder = [...restoreOrder].reverse()
      for (const table of clearOrder) {
        await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      }

      // Restore
      let restored = 0
      for (const table of restoreOrder) {
        const rows = backupData.data[table]
        if (rows && rows.length > 0) {
          // Insert in batches of 100
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100)
            const { error } = await supabaseAdmin.from(table).insert(batch)
            if (error) {
              console.error(`Restore error for ${table}:`, error.message)
            } else {
              restored += batch.length
            }
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `${restored}টি রেকর্ড সফলভাবে পুনরুদ্ধার হয়েছে`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'reset') {
      const tablesToClear = [
        'sales_return_items', 'sales_returns', 'sale_items', 'sales',
        'stock_movements', 'product_images', 'product_variants', 'products',
        'customers'
      ]

      for (const table of tablesToClear) {
        await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'সকল ডেটা সফলভাবে মুছে ফেলা হয়েছে। শাখা, ক্যাটেগরি ও ব্যবহারকারী তথ্য অক্ষত আছে।'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('অবৈধ অ্যাকশন')
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
