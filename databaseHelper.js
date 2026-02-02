const { createClient } = require("@supabase/supabase-js");

// ==============================================
// 🔐 Create Supabase client (Server / Vercel safe)
// ==============================================
function getSupabase() {
  if (!process.env.SUPABASE_URL) {
    throw new Error("❌ SUPABASE_URL is missing");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

// ==============================================
// 📞 Normalize phone (keep leading zero)
// ==============================================
function normalizePhone(phone) {
  if (!phone) return "";
  return phone.toString().replace(/\D/g, "");
}

// ==============================================
// ✅ INSERT NEW BOOKING
// ==============================================
async function insertBookingToSupabase(booking) {
  console.log("📥 INSERT BOOKING REQUEST:", booking);

  try {
    const supabase = getSupabase();

    const payload = {
      name: booking.name,
      phone: normalizePhone(booking.phone),
      service: booking.service,
      appointment: booking.appointment,
      status: "new",
      time: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("bookings")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("❌ SUPABASE INSERT ERROR:", error);
      return null;
    }

    console.log("✅ SUPABASE INSERT SUCCESS:", data);
    return data;
  } catch (err) {
    console.error("❌ INSERT EXCEPTION:", err.message);
    return null;
  }
}

// ==============================================
// 🔎 FIND LAST BOOKING BY PHONE
// ==============================================
async function findLastBookingByPhone(rawPhone) {
  try {
    const supabase = getSupabase();
    const phone = normalizePhone(rawPhone);

    console.log("🔍 Searching booking for phone:", phone);

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("❌ FIND BOOKING ERROR:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("❌ FIND BOOKING EXCEPTION:", err.message);
    return null;
  }
}

// ==============================================
// 🔄 UPDATE BOOKING STATUS
// ==============================================
async function updateBookingStatus(id, newStatus) {
  try {
    const supabase = getSupabase();

    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      console.error("❌ UPDATE STATUS ERROR:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("❌ UPDATE STATUS EXCEPTION:", err.message);
    return false;
  }
}

// ==============================================
// 📊 GET ALL BOOKINGS (Dashboard)
// ==============================================
async function getAllBookingsFromSupabase() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ FETCH BOOKINGS ERROR:", error);
      return [];
    }

    return data;
  } catch (err) {
    console.error("❌ FETCH BOOKINGS EXCEPTION:", err.message);
    return [];
  }
}

// ==============================================
// 📤 EXPORTS
// ==============================================
module.exports = {
  insertBookingToSupabase,
  findLastBookingByPhone,
  updateBookingStatus,
  getAllBookingsFromSupabase,
};
