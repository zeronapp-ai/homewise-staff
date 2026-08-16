import { createAPIFileRoute } from "@tanstack/react-start/api";
import { supabase } from "@/lib/supabase";

export const APIRoute = createAPIFileRoute("/api/staff/$id")({
  GET: async ({ params }) => {
    try {
      const staffId = Number(params.id);

      if (!staffId) {
        return new Response(JSON.stringify({ error: "Invalid staff ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("id", staffId)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Personel bulunamadı" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("API error:", error);
      return new Response(JSON.stringify({ error: "Sunucu hatası" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
