import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET')

  if (!cloudName || !uploadPreset) {
    return new Response(
      JSON.stringify({ error: 'Cloudinary configuration not found' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ cloud_name: cloudName, upload_preset: uploadPreset }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
