import { redirect } from "next/navigation";

export default function RootPage() {
  // Root-Route leitet immer auf den Avatar-Seller
  redirect("/avatar-seller");
}

