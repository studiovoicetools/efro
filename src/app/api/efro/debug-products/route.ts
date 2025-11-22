import { NextResponse } from "next/server";
import { mockCatalog, EfroProduct } from "@/lib/products/mockCatalog";

type DebugProductsResponse = {
  products: EfroProduct[];
  source: string;
};

export async function GET(request: Request): Promise<NextResponse<DebugProductsResponse>> {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop") ?? "local-dev";

  // TEMP: Immer mockCatalog zurueckgeben,
  // damit EFRO Brain stabil mit Daten arbeiten kann.
  return NextResponse.json({
    products: mockCatalog,
    source: `mockCatalog (debug, shop=${shop})`,
  });
}
