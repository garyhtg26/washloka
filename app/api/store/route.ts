import {
  branchAliases,
  branchSettingsId,
  requestBranch,
  sameBranch,
} from "@/lib/branches";
import { readBranchSettings, readStoreBankSettings } from "@/lib/branch-settings";
import { photoStorageReady, uploadPhoto } from "@/lib/storage/photos";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { readStore } from "@/lib/store";
import { db, firebaseReady } from "@/lib/firebase/admin";
import {
  ApiError,
  identity,
  requireAdmin,
  requireManager,
  sameOrigin,
} from "@/lib/firebase/access";
import { defaultStore } from "@/lib/defaults";
import { calculateOrderPrice } from "@/lib/pricing";
import { defaultSpeed, normalizeServices, serviceAllowsSpeed, serviceAvailableSpeeds, serviceUnitRate } from "@/lib/catalog";
import {
  orderSchema,
  updateSchema,
  pricesSchema,
  promoSchema,
} from "@/lib/order-validation";
import type { Order } from "@/lib/types";
import { serverFailure } from "@/lib/server-diagnostics";
import { paymentLocked } from "@/lib/payments/policy";
import { bankDetails, manualLocked, safeManualSummary } from "@/lib/payments/manual-policy";
import { signalPaymentChange } from "@/lib/payments/service";
import {
  memberCodeHash,
  validMemberCode,
  validMemberWallet,
} from "@/lib/membership-code";
import { prepareEarn, commitEarn } from "@/lib/loyalty";
import { eligibleMemberDiscount } from "@/lib/membership-eligibility";
import { prepareRewardIntent, commitRewardIntent, prepareRewardReservation, commitRewardReservation } from "@/lib/reward-intent";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
function fail(e: unknown) {
  if (e instanceof ApiError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError)
    return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
  console.error("D’Fable API failure", serverFailure(e));
  return NextResponse.json(
    { error: "Layanan sedang tidak tersedia. Coba lagi beberapa saat." },
    { status: 500 },
  );
}
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(
      await readStore(await identity(req), requestBranch(req.url)),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const branch = requestBranch(req.url);
    if (!firebaseReady())
      throw new ApiError(
        503,
        "Firebase belum dikonfigurasi. Pesanan belum bisa diterima.",
      );
    const user = (await identity(req, true))!;
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 1700000)
      throw new ApiError(413, "Foto terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data tidak valid.");
    }
    const database = db();
    let id = "";
    if (body.action === "order") {
      const input = orderSchema.parse(body.data);
      if ((input.usePoints && input.pointsLimit === undefined) ||
          (input.useMembershipBalance && input.membershipLimit === undefined))
        throw new ApiError(409, "Muat ulang halaman dan periksa kembali pilihan poin dan saldo.");
      if (input.source === "pos") requireAdmin(user, branch);
      if (branch === "buzzwash" && input.insurance)
        throw new ApiError(400, "Perlindungan cucian belum tersedia di BuzzWash.");
      if (input.source === "pos" && (input.usePoints || input.useMembershipBalance))
        throw new ApiError(400, "Pilihan poin dan saldo hanya tersedia untuk pesanan pelanggan.");
      if (branch === "buzzwash" && !bankDetails(await readStoreBankSettings(database, branch), branch).configured)
        throw new ApiError(409, "Pemesanan BuzzWash belum tersedia sampai rekening toko dikonfigurasi.");
      if (
        input.source !== "pos" &&
        (input.posPayment ||
          input.expectedTotal !== undefined ||
          input.membershipCode)
      )
        throw new ApiError(400, "Pilihan pembayaran kasir tidak tersedia.");
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
      }).format(new Date());
      if (input.date < today)
        throw new ApiError(400, "Jadwal tidak boleh di masa lalu.");
      const requestIds = branchAliases(branch).map(
        (alias) =>
          "DF-" +
          createHash("sha256")
            .update(`${alias}:${user.uid}:${input.requestId}`)
            .digest("hex")
            .slice(0, 12)
            .toUpperCase(),
      );
      const priorRequests = await Promise.all(
        requestIds.map((orderId) => database.doc(`orders/${orderId}`).get()),
      );
      const priorIndex = priorRequests.findIndex((prior) => prior.exists);
      if (priorIndex >= 0) {
        const existing = priorRequests[priorIndex];
        if (
          existing.get("createdBy") !== user.uid ||
          !sameBranch(existing.get("branchId"), branch)
        )
          throw new ApiError(409, "Konflik nomor pesanan.");
        id = requestIds[priorIndex];
        return NextResponse.json({ store: await readStore(user, branch), id });
      }
      id = requestIds[0];
      const ref = database.doc(`orders/${id}`);
      if (input.membershipCode) {
        await database.runTransaction(async (tx) => {
          const attemptRef = database.doc(`membershipCodeAttempts/${user.uid}`);
          const attemptSnap = await tx.get(attemptRef);
          const now = Date.now();
          const attempts = (attemptSnap.get("attempts") || []).filter(
            (value: number) => Number.isFinite(value) && value > now - 3600000,
          );
          if (attempts.length >= 30)
            throw new ApiError(
              429,
              "Terlalu banyak percobaan kode member. Coba lagi nanti.",
            );
          tx.set(attemptRef, { attempts: [...attempts, now] });
        });
      }
      let photoPath = "";
      if (input.photo) {
        if (!photoStorageReady())
          throw new ApiError(
            503,
            "Penyimpanan foto belum diaktifkan. Hapus foto atau hubungi toko.",
          );
        const bytes = Buffer.from(input.photo.split(",")[1], "base64");
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length > 1100000)
          throw new ApiError(400, "Foto JPEG tidak valid.");
        photoPath = `orders/${user.uid}/${id}.jpg`;
        await uploadPhoto(photoPath, bytes);
      }
      await database.runTransaction(async (tx) => {
        const codeHash = input.membershipCode
          ? memberCodeHash(input.membershipCode)
          : null;
        const codeRef = codeHash
          ? database.doc(`membershipCodes/${codeHash}`)
          : null;
        const [settings, prior, rate, codeSnap, bankSettings] = await Promise.all([
          readBranchSettings(database, branch, tx),
          tx.get(ref),
          tx.get(database.doc(`rateLimits/${user.uid}`)),
          codeRef ? tx.get(codeRef) : Promise.resolve(null),
          branch === "buzzwash" ? readStoreBankSettings(database, branch, tx) : Promise.resolve(null),
        ]);
        if (prior.exists) return;
        if (branch === "buzzwash" && !bankDetails(bankSettings, branch).configured)
          throw new ApiError(409, "Rekening BuzzWash belum tersedia. Coba lagi nanti.");
        let customerUid: string | null =
          input.source === "web" ? user.uid : null;
        if (codeRef) {
          const codeData = codeSnap?.data();
          if (!validMemberCode(codeData, branch, Date.now()))
            throw new ApiError(
              409,
              "Kode member tidak berlaku, kedaluwarsa, atau sudah digunakan. Minta kode baru untuk toko ini.",
            );
          customerUid = codeData!.uid as string;
        }
        const membership = customerUid
          ? await tx.get(database.doc(`memberships/${customerUid}`))
          : null;
        if (codeRef && !validMemberWallet(membership?.data(), codeHash!))
          throw new ApiError(
            409,
            "Kode member tidak berlaku atau saldo sudah habis. Minta pelanggan memeriksa saldo dan membuat kode baru.",
          );
        const cutoff = Date.now() - 3600000;
        const attempts = (rate.get("orders") || []).filter(
          (t: number) => t > cutoff,
        );
        if (attempts.length >= (user.admin ? 120 : 10))
          throw new ApiError(429, "Terlalu banyak pesanan. Coba lagi nanti.");
        const services = normalizeServices(settings.get("services"), branch);
        const service = services.find((item) => item.id === input.service);
        if (!service)
          throw new ApiError(400, "Layanan yang dipilih tidak tersedia.");
        const speed = input.speed || "regular";
        if (!serviceAllowsSpeed(service, speed))
          throw new ApiError(
            400,
            "Kecepatan ini tidak tersedia untuk layanan.",
          );
        if (input.kg < (service.minimumQuantity || 1))
          throw new ApiError(
            400,
            `Jumlah minimum layanan ini ${service.minimumQuantity || 1} ${service.unit}.`,
          );
        if (service.maximumQuantity && input.kg > service.maximumQuantity)
          throw new ApiError(400, `Maksimum layanan ini ${service.maximumQuantity} ${service.unit} per paket.`);
        if (service.unit !== "kg" && !Number.isInteger(input.kg))
          throw new ApiError(400, "Jumlah item harus berupa bilangan bulat.");
        if (service.startingAt && input.source === "pos" && input.posPayment === "cash")
          throw new ApiError(409, "Harga akhir perlu dikonfirmasi sebelum menerima pembayaran.");
        const unitPrice = serviceUnitRate(service, speed);
        const washService = services.find((item) => item.id === "wash")!;
        const washPrice = serviceUnitRate(washService);
        const now = new Date().toISOString();
        const {
          requestId,
          photo,
          expectedTotal,
          membershipCode,
          ...cleanInput
        } = input;
        void requestId;
        void photo;
        void membershipCode;
        const clean = {
          ...cleanInput,
          membershipDiscount: eligibleMemberDiscount(membership?.data()),
          express: speed !== "regular",
          unit: service.unit,
          speed,
          pricingVersion: 2 as const,
          minimumQuantity: service.minimumQuantity || 1,
          ...(service.maximumQuantity ? { maximumQuantity: service.maximumQuantity } : {}),
          ...(service.pricingModel ? { pricingModel: service.pricingModel } : {}),
          ...(service.startingAt ? { startingAt: true, pricePending: true } : {}),
        };
        const calculatedTotal =
          calculateOrderPrice({ ...clean, unitPrice, washPrice }, input.kg) +
          (input.insurance ? 1000 : 0);
        if (
          input.source === "pos" &&
          input.posPayment === "cash" &&
          expectedTotal !== calculatedTotal
        )
          throw new ApiError(
            409,
            "Harga layanan berubah. Periksa ulang tagihan sebelum menerima tunai.",
          );
        const status = input.source === "pos" ? 3 : 0;
        const token = randomUUID();
        const order: Order = {
          ...clean,
          id,
          token,
          uid: customerUid,
          branchId: branch,
          actualKg: input.source === "pos" ? input.kg : null,
          status,
          paid: input.source === "pos" && input.posPayment === "cash",
          ...(input.source === "pos" && input.posPayment === "cash"
            ? { paymentMethod: "cash" as const, paidAt: now }
            : {}),
          shippingFee: input.source === "pos" ? 0 : null,
          total: calculatedTotal,
          unitPrice,
          washPrice,
          photo: "",
          photoPath,
          createdAt: now,
          history: [{ status, at: now }],
        };
        const reservation = input.source === "web"
          ? await prepareRewardReservation(tx, database, order, calculatedTotal - (input.insurance ? 1000 : 0), null, false)
          : null;
        const earn = order.paid ? await prepareEarn(tx, database, order) : null;
        const earnedFields = commitEarn(tx, database, order, earn, now);
        const reservedFields = reservation ? commitRewardReservation(tx, database, order, reservation, now) : {};
        tx.create(ref, { ...order, ...earnedFields, ...reservedFields, createdBy: user.uid });
        if (codeRef) tx.delete(codeRef);
        tx.create(database.doc(`tracking/${token}`), { orderId: id });
        tx.set(database.doc(`rateLimits/${user.uid}`), {
          orders: [...attempts, Date.now()],
          updatedAt: now,
        });
        if (input.source === "web")
          tx.set(
            database.doc(`users/${user.uid}`),
            {
              name: input.name,
              phone: input.phone,
              email: user.email,
              updatedAt: now,
            },
            { merge: true },
          );
        else
          tx.set(
            database.doc(
              `walkInCustomers/${createHash("sha256").update(input.phone).digest("hex")}`,
            ),
            { name: input.name, phone: input.phone, updatedAt: now },
            { merge: true },
          );
      });
    } else if (body.action === "update") {
      requireAdmin(user, branch);
      const v = updateSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`orders/${v.id}`);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
        const o = snap.data() as Order;
        if (!sameBranch(o.branchId, branch))
          throw new ApiError(
            409,
            "Pesanan berada di toko lain. Buka workspace yang sesuai.",
          );
        if (v.status < o.status)
          throw new ApiError(400, "Status tidak boleh mundur.");
        if (v.paid && v.shippingFee === null)
          throw new ApiError(400, "Konfirmasi ongkir sebelum menandai lunas.");
        if (o.unit && o.unit !== "kg" && !Number.isInteger(v.actualKg))
          throw new ApiError(400, "Jumlah aktual item harus bilangan bulat.");
        if (o.maximumQuantity && v.actualKg > o.maximumQuantity)
          throw new ApiError(400, `Maksimum layanan ini ${o.maximumQuantity} ${o.unit || "kg"} per paket.`);
        if (v.confirmedUnitPrice !== undefined && (!o.startingAt || !o.pricePending))
          throw new ApiError(400, "Harga layanan ini tidak menunggu konfirmasi.");
        if (v.confirmedUnitPrice !== undefined && v.confirmedUnitPrice < o.unitPrice)
          throw new ApiError(400, "Harga akhir tidak boleh kurang dari harga mulai.");
        const updatedUnitPrice = v.confirmedUnitPrice ?? o.unitPrice;
        if (!o.rewardsReservedAt && (o.membershipUsed || 0) > 0 && v.actualKg !== o.actualKg)
          throw new ApiError(
            409,
            "Jumlah tidak dapat diubah setelah saldo membership digunakan.",
          );
        const serviceTotal = calculateOrderPrice({ ...o, unitPrice: updatedUnitPrice }, v.actualKg);
        if (!o.rewardsReservedAt && (o.pointsUsed || 0) + (o.membershipUsed || 0) > serviceTotal)
          throw new ApiError(
            409,
            "Poin dan saldo membership yang digunakan melebihi harga layanan. Minta pelanggan mengurangi penggunaannya terlebih dahulu.",
          );
        const total =
          serviceTotal -
          (o.pointsUsed || 0) -
          (o.membershipUsed || 0) +
          (o.insurance ? 1000 : 0) +
          (v.shippingFee ?? 0);
        if (v.paid !== o.paid)
          throw new ApiError(
            409,
            "Periksa bukti transfer melalui menu pembayaran untuk mengonfirmasi tagihan. Status lunas tidak dapat diubah dari form pesanan.",
          );
        if (
          (paymentLocked(o.payment) ||
            manualLocked(o.manualPayment) ||
            o.paid ||
            o.paymentReconciliationRequired) &&
          (updatedUnitPrice !== o.unitPrice || total !== o.total ||
            v.actualKg !== o.actualKg ||
            v.shippingFee !== o.shippingFee)
        )
          throw new ApiError(
            409,
            "Tagihan terkunci selama pembayaran sedang diperiksa atau sudah lunas. Periksa pembayaran terlebih dahulu.",
          );
        if (o.paid && v.paid && total !== o.total)
          throw new ApiError(
            400,
            "Batalkan tanda lunas sebelum mengubah tagihan.",
          );
        const needsRewards = !!o.uid && !o.rewardsReservedAt && !o.rewardsAppliedAt &&
          !!(o.usePoints || o.useMembershipBalance) && v.shippingFee !== null &&
          (!o.pricePending || v.confirmedUnitPrice !== undefined);
        if (needsRewards && (o.paid || o.paymentReconciliationRequired || paymentLocked(o.payment) || manualLocked(o.manualPayment)))
          throw new ApiError(409, "Poin dan saldo tidak dapat diterapkan selama pembayaran sedang diproses.");
        const rewards = needsRewards
          ? await prepareRewardIntent(tx, database, o, serviceTotal, v.shippingFee!)
          : null;
        const reservation = o.rewardsReservedAt && !o.paid &&
          !o.paymentReconciliationRequired && !paymentLocked(o.payment) && !manualLocked(o.manualPayment)
          ? await prepareRewardReservation(
              tx, database, o, serviceTotal, v.shippingFee,
              !o.pricePending || v.confirmedUnitPrice !== undefined,
            )
          : null;
        if (!rewards && !reservation && total === 0 && !o.paid)
          throw new ApiError(409, "Minta pelanggan mengurangi poin sebelum mengubah jumlah atau ongkir ini.");
        const history = [...o.history];
        if (v.status !== o.status)
          history.push({ status: v.status, at: new Date().toISOString() });
        const now = new Date().toISOString();
        const rewardFields = rewards ? commitRewardIntent(tx, database, o, rewards, now)
          : reservation ? commitRewardReservation(tx, database, o, reservation, now) : {};
        tx.update(ref, {
          status: v.status,
          actualKg: v.actualKg,
          shippingFee: v.shippingFee,
          ...(v.confirmedUnitPrice !== undefined ? { unitPrice: updatedUnitPrice, pricePending: false } : {}),
          paid: v.paid,
          total,
          ...rewardFields,
          ...((rewards || reservation) && o.manualPayment?.hasProof &&
              ((rewards?.total ?? reservation?.total ?? total) !== o.total || v.actualKg !== o.actualKg || v.shippingFee !== o.shippingFee)
            ? { manualPayment: safeManualSummary({
                method: "bank_transfer", status: "unpaid", amount: null, hasProof: false,
                ...(o.manualPayment.bank ? { bank: o.manualPayment.bank } : {}),
              }) }
            : {}),
          history,
          paymentRevision: (o.paymentRevision || 0) + 1,
          updatedBy: user.uid,
          updatedAt: now,
        });
        if (
          total !== o.total ||
          updatedUnitPrice !== o.unitPrice ||
          v.actualKg !== o.actualKg ||
          v.shippingFee !== o.shippingFee ||
          v.paid !== o.paid || rewards !== null || reservation !== null
        )
          signalPaymentChange(tx, database, o.branchId);
      });
    } else if (body.action === "prices") {
      requireManager(user, branch);
      const prices = pricesSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`settings/${branchSettingsId(branch)}`);
        const snap = await readBranchSettings(database, branch, tx);
        const settings = { ...defaultStore, ...snap.data() };
        const currentServices = normalizeServices(settings.services, branch);
        if (
          prices.length !== currentServices.length ||
          currentServices.some(
            (service) =>
              prices.some((price) => price.id === service.id) === false,
          )
        )
          throw new ApiError(400, "Daftar layanan harus lengkap.");
        const services = currentServices.map((service) => {
          const update = prices.find((price) => price.id === service.id)!;
          if (service.rates && !update.rates)
            throw new ApiError(
              400,
              `Tarif kecepatan ${service.name} belum lengkap.`,
            );
          if (!service.rates && update.rates)
            throw new ApiError(
              400,
              `Tarif kecepatan ${service.name} tidak digunakan.`,
            );
          const rates = service.rates ? update.rates! : undefined;
          if (rates && serviceAvailableSpeeds(service).some((speed) => rates[speed] === undefined))
            throw new ApiError(400, `Tarif kecepatan ${service.name} belum lengkap.`);
          if (rates && Object.keys(rates).some((speed) => !serviceAvailableSpeeds(service).includes(speed as keyof typeof rates)))
            throw new ApiError(400, `Kecepatan yang dipilih tidak tersedia untuk ${service.name}.`);
          return {
            ...service,
            price: rates?.[defaultSpeed(service)] ?? update.price,
            ...(rates ? { rates } : {}),
          };
        });
        tx.set(
          ref,
          { services, promo: settings.promo, updatedBy: user.uid },
          { merge: true },
        );
      });
    } else if (body.action === "promo") {
      requireManager(user, branch);
      const promo = promoSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`settings/${branchSettingsId(branch)}`);
        const snap = await readBranchSettings(database, branch, tx);
        tx.set(
          ref,
          {
            services: normalizeServices(snap.get("services"), branch),
            promo,
            updatedBy: user.uid,
          },
          { merge: true },
        );
      });
    } else throw new ApiError(400, "Aksi tidak dikenal.");
    return NextResponse.json({ store: await readStore(user, branch), id });
  } catch (e) {
    return fail(e);
  }
}
