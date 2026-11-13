import type { BranchId } from "@/lib/branches";
import "./service-store-heading.css";

export default function ServiceStoreHeading({ branch }: { branch: BranchId }) {
  const buzz = branch === "buzzwash";
  return (
    <div className="section-heading service-store-heading" data-scroll-reveal>
      <div className="service-store-brand">
        <img
          src={buzz ? "/buzzwash-logo-compact.webp" : "/dfable-logo-compact.webp"}
          alt={buzz ? "Logo BuzzWash" : "Logo D’Fable Laundry"}
          width={160}
          height={54}
        />
      </div>
      <div className="service-store-title">
        <h2>Layanan & harga</h2>
        <p>{buzz ? "BuzzWash · Cibubur" : "D’Fable · Karang Tengah"}</p>
      </div>
    </div>
  );
}
