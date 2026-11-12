import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import Studio from "@/components/studio";

export const metadata: Metadata = {
  title: "Washloka — Clean at Your Fingertips",
  description: "Temukan laundry pilihanmu dan pantau pesanan dengan Washloka.",
};

export default function Page() {
  return (
    <AuthProvider scope="customer">
      <Studio />
    </AuthProvider>
  );
}
