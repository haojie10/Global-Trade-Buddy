require('dotenv').config();

async function test() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  const deleteUrl = `${supabaseUrl}/storage/v1/object/report-images/img_1782786441090_588.png`;
  const res = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  console.log('Status Code:', res.status);
  try {
    const json = await res.json();
    console.log('Response JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    const text = await res.text();
    console.log('Response Text:', text);
  }
}

test();
