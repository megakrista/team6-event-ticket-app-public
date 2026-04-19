import { NextRequest } from "next/server";
import { error, success } from "@/lib/api-response";
import { expireStalePendingOrders } from "@/services/orderservices";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return error("Cron is not configured", 503);
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return error("Unauthorized", 401);
  }

  const expired = await expireStalePendingOrders();
  return success({ expired });
}
