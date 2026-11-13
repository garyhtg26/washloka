import { z } from "zod";
import { brandCopy } from "./brand-copy";
import { branchMediaPath, branchSchema } from "./branches";
export const mediaSlots = [
  "promo",
  "people",
  "member",
  "wash",
  "complete",
  "iron",
] as const;
export type MediaSlot = (typeof mediaSlots)[number];
export type MediaImageKey = MediaSlot | `washloka${Capitalize<MediaSlot>}`;
export const mediaSlotSchema = z.enum(mediaSlots);
export const WASHLOKA_MEDIA_THEME = "washloka";

// Preserve earlier artwork while allowing newly uploaded Washloka artwork to
// replace each default image without overwriting the previous brand's files.
export function contentImageKey(slot: MediaSlot): MediaImageKey {
  return `washloka${slot[0].toUpperCase()}${slot.slice(1)}` as MediaImageKey;
}

export function bannerStoragePath(
  branch: unknown,
  slot: unknown,
  theme: unknown = null,
) {
  const store = branchSchema.parse(branch);
  const selectedSlot = mediaSlotSchema.parse(slot);
  if (theme === null) return branchMediaPath(branch, selectedSlot);
  if (theme === WASHLOKA_MEDIA_THEME)
    return store === "buzzwash"
      ? `banners/buzzwash/washloka/${selectedSlot}/image.jpg`
      : `banners/washloka/${selectedSlot}/image.jpg`;
  throw new Error("INVALID_BANNER_THEME");
}

export function bannerUploadTarget(
  branch: unknown,
  slot: MediaSlot,
  version: string,
) {
  const selectedBranch = branchSchema.parse(branch);
  const selectedSlot = mediaSlotSchema.parse(slot);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      version,
    )
  )
    throw new Error("INVALID_BANNER_VERSION");
  const theme = WASHLOKA_MEDIA_THEME;
  const params = new URLSearchParams({ v: version, branch: selectedBranch });
  if (theme) params.set("theme", theme);
  return {
    key: contentImageKey(selectedSlot),
    path: bannerStoragePath(selectedBranch, selectedSlot, theme),
    url: `/api/media/banners/${selectedSlot}?${params}`,
  };
}
export const defaultImages: Record<MediaSlot, string> = {
  promo: "/washloka/hero.webp",
  people: "/unsplash/laundry-web.webp",
  member: "/unsplash/folding-web.webp",
  wash: "/shirt-optimized.webp",
  complete: "/unsplash/clean-web.webp",
  iron: "/unsplash/ironing-web.webp",
};
const banner = z
  .object({
    title: z.string().trim().min(1).max(80),
    button: z.string().trim().min(1).max(35),
    active: z.boolean(),
  })
  .strict();
export const contentSchema = z
  .object({
    people: banner,
    member: banner,
    tracking: z
      .object({ title: z.string().trim().min(1).max(80), active: z.boolean() })
      .strict(),
  })
  .strict();
export type SiteContent = z.infer<typeof contentSchema> & {
  images?: Partial<Record<MediaImageKey, string>>;
};
export const defaultContent: SiteContent = {
  people: { title: "Jemput & antar", button: "Jadwalkan jemput", active: true },
  member: {
    title: "Membership Washloka",
    button: "Lihat membership",
    active: true,
  },
  tracking: { title: "Lacak pesanan", active: true },
};
export function siteContent(value?: Partial<SiteContent>): SiteContent {
  const people = { ...defaultContent.people, ...value?.people };
  const member = { ...defaultContent.member, ...value?.member };
  if (["Paket bulanan", "Membership D’Fable"].includes(member.title))
    member.title = "Membership Washloka";
  if (member.button === "Lihat paket") member.button = "Lihat membership";
  const tracking = { ...defaultContent.tracking, ...value?.tracking };
  return {
    people: {
      ...people,
      title: brandCopy(people.title, defaultContent.people.title),
      button: brandCopy(people.button, defaultContent.people.button),
    },
    member: {
      ...member,
      title: brandCopy(member.title, defaultContent.member.title),
      button: brandCopy(member.button, defaultContent.member.button),
    },
    tracking: {
      ...tracking,
      title: brandCopy(tracking.title, defaultContent.tracking.title),
    },
    images: { ...value?.images },
  };
}
export function siteImage(content: SiteContent, slot: MediaSlot) {
  const value = content.images?.[contentImageKey(slot)];
  return value &&
    new RegExp(
      `^/api/media/banners/${slot}\\?v=[a-f0-9-]+(?:&branch=(?:dfablelaundry|cinere|bogor|buzzwash))?&theme=washloka$`,
    ).test(value)
    ? value
    : defaultImages[slot];
}
